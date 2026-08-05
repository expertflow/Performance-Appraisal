#!/usr/bin/env python3
"""
Hotfix: Upload employees.js + index.js to VM and restart PM2.
Fixes the 403 error on sync by:
  1. Adding httpsAgent (rejectUnauthorized: false) to axios calls
  2. Adding .trim() to token/URL
  3. Adding debug logging
  4. Fixing dotenv path in index.js
"""
import paramiko
import os
import sys
import io

# Force UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HOST    = '169.58.125.199'
USER    = 'root'
PASS    = 'a0QOB1971D2rc9rq'
APP_DIR = '/opt/hr-suite'

HERE = os.path.dirname(os.path.abspath(__file__))
EMPLOYEES_JS = os.path.join(HERE, 'backend', 'src', 'routes', 'employees.js')
INDEX_JS     = os.path.join(HERE, 'backend', 'src', 'index.js')

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(f'     {out[:500]}')
    if err:
        print(f'     STDERR: {err[:300]}')
    return out, err, exit_code

def main():
    print('\n' + '='*60)
    print('  HR Suite Hotfix: employees.js + index.js')
    print('='*60 + '\n')

    # Verify local files exist
    for f in [EMPLOYEES_JS, INDEX_JS]:
        if not os.path.exists(f):
            print(f'[ERROR] File not found: {f}')
            sys.exit(1)
        print(f'[OK] Found: {f}')

    # Connect
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f'\nConnecting to {HOST}...')
    client.connect(HOST, username=USER, password=PASS, timeout=20)
    print('[OK] Connected!\n')

    sftp = client.open_sftp()

    # Upload employees.js
    remote_employees = f'{APP_DIR}/src/routes/employees.js'
    print(f'Uploading employees.js -> {remote_employees}')
    sftp.put(EMPLOYEES_JS, remote_employees)
    print('[OK] employees.js uploaded')

    # Upload index.js
    remote_index = f'{APP_DIR}/src/index.js'
    print(f'Uploading index.js -> {remote_index}')
    sftp.put(INDEX_JS, remote_index)
    print('[OK] index.js uploaded')

    sftp.close()

    # Verify .env has DIRECTUS_TOKEN
    print('\n-- Checking .env --')
    out, _, _ = run(client, f'grep DIRECTUS_TOKEN {APP_DIR}/.env 2>/dev/null || echo "NOT FOUND"', 'check DIRECTUS_TOKEN in .env')
    if 'NOT FOUND' in out or not out.strip():
        print('[WARN] DIRECTUS_TOKEN not in .env — writing it now...')
        run(client,
            f"grep -q 'DIRECTUS_TOKEN' {APP_DIR}/.env || echo 'DIRECTUS_TOKEN=july2026-admin-token-zaeem' >> {APP_DIR}/.env",
            'append DIRECTUS_TOKEN')
        run(client,
            f"grep -q 'DIRECTUS_URL' {APP_DIR}/.env || echo 'DIRECTUS_URL=https://bs4.expertflow.com' >> {APP_DIR}/.env",
            'append DIRECTUS_URL')
    else:
        print(f'[OK] .env has: {out}')

    # Show full .env for verification
    print('\n-- Current .env --')
    run(client, f'cat {APP_DIR}/.env', 'show .env')

    # Restart PM2 with --update-env to pick up new env vars
    print('\n-- Restarting PM2 --')
    run(client, 'pm2 restart hr-suite-backend --update-env', 'pm2 restart with env update')

    import time
    time.sleep(3)

    # Check PM2 status
    print('\n-- PM2 Status --')
    run(client, 'pm2 list', 'pm2 list')

    # Check PM2 logs for the token debug line
    print('\n-- Recent PM2 logs (last 30 lines) --')
    run(client, 'pm2 logs hr-suite-backend --lines 30 --nostream 2>/dev/null || pm2 logs --lines 30 --nostream', 'pm2 logs')

    # Test the sync endpoint directly
    print('\n-- Testing sync endpoint --')
    out, _, code = run(client,
        'curl -s -X POST http://localhost:3000/api/v1/employees/sync '
        '-H "Content-Type: application/json" '
        '-H "Authorization: Bearer test" '
        '-w "\\nHTTP_STATUS:%{http_code}"',
        'curl sync endpoint')
    print(f'  Exit code: {code}')

    # Also test health
    print('\n-- Backend health --')
    run(client, 'curl -s http://localhost:3000/health', 'health check')

    print('\n' + '='*60)
    print('  HOTFIX COMPLETE')
    print('='*60)
    print('\nNext steps:')
    print('  1. Check the PM2 logs above for "[sync] Using token: july2026-..."')
    print('  2. If token shows EMPTY, the .env is not being loaded — check path')
    print('  3. Try the sync button in the UI again')
    print('  4. If still 403, check Directus token validity on bs4.expertflow.com')
    print()

    client.close()

if __name__ == '__main__':
    main()
