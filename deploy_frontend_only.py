#!/usr/bin/env python3
"""
Deploy only the frontend dist to the VM (no backend changes).
Run after: cd hr-suite && npx ng build --configuration production
"""
import paramiko
import os
import sys
import tarfile
import io
import time

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST          = '169.58.125.199'
USER          = 'root'
PASS          = 'a0QOB1971D2rc9rq'
WWW_DIR       = '/var/www/hr-suite'
HERE          = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(HERE, 'hr-suite', 'dist', 'hr-suite', 'browser')

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(f'     {out[:500]}')
    if err and exit_code != 0:
        print(f'     ERR: {err[:300]}')
    return out, err, exit_code

def main():
    print('\n' + '='*60)
    print('  HR Suite Frontend Deploy')
    print('='*60 + '\n')

    if not os.path.exists(FRONTEND_DIST):
        print(f'[ERROR] Frontend dist not found: {FRONTEND_DIST}')
        print('Run: cd hr-suite && npx ng build --configuration production')
        sys.exit(1)

    print(f'[OK] Frontend dist: {FRONTEND_DIST}')

    # Connect
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f'Connecting to {HOST}...')
    client.connect(HOST, username=USER, password=PASS, timeout=20)
    print('[OK] Connected!\n')

    sftp = client.open_sftp()

    # Tar the dist directory
    print('Packaging frontend dist...')
    buf = io.BytesIO()
    file_count = 0
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for root, dirs, files in os.walk(FRONTEND_DIST):
            for f in files:
                fp = os.path.join(root, f)
                arcname = os.path.relpath(fp, FRONTEND_DIST)
                tar.add(fp, arcname=arcname)
                file_count += 1
    buf.seek(0)
    size_kb = buf.getbuffer().nbytes // 1024
    print(f'  Packaged {file_count} files ({size_kb} KB)')

    # Upload
    remote_tar = f'{WWW_DIR}/frontend_upload.tar.gz'
    print(f'  Uploading to {remote_tar}...')
    sftp.putfo(buf, remote_tar)
    sftp.close()
    print('[OK] Uploaded\n')

    # Extract
    run(client, f'cd {WWW_DIR} && tar -xzf frontend_upload.tar.gz && rm frontend_upload.tar.gz',
        'Extract frontend')
    run(client, f'chown -R www-data:www-data {WWW_DIR}', 'Set ownership')
    run(client, 'systemctl reload nginx', 'Reload nginx')

    # Verify
    time.sleep(1)
    out, _, code = run(client, 'curl -s -o /dev/null -w "%{http_code}" http://localhost/', 'HTTP check')
    print(f'\n  Frontend HTTP status: {out}')

    client.close()

    print('\n' + '='*60)
    print('  FRONTEND DEPLOY COMPLETE')
    print(f'  URL: http://{HOST}')
    print('='*60 + '\n')

if __name__ == '__main__':
    main()
