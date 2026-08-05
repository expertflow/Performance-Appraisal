#!/usr/bin/env python3
"""
Diagnose the 403 sync error by running checks directly on the VM.
"""
import paramiko
import sys
import io

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

def run(client, cmd, desc=''):
    if desc:
        print(f'\n=== {desc} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out[:2000])
    if err and exit_code != 0:
        print(f'STDERR: {err[:500]}')
    return out, err, exit_code

def main():
    print('Connecting to VM...')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=20)
    print('[OK] Connected\n')

    # 1. Check what the server file actually looks like
    run(client, 'head -20 /opt/hr-suite/src/routes/employees.js',
        '1. employees.js first 20 lines on server')

    # 2. Check PM2 env for DIRECTUS vars
    run(client, 'pm2 env 0 2>/dev/null | grep -i directus || echo "No DIRECTUS vars in PM2 env"',
        '2. PM2 process env - DIRECTUS vars')

    # 3. Check .env file
    run(client, 'cat /opt/hr-suite/.env',
        '3. .env file contents')

    # 4. Test Directus directly from VM with curl (HTTP status only)
    run(client,
        'curl -s -o /dev/null -w "%{http_code}" '
        '-H "Authorization: Bearer july2026-admin-token-zaeem" '
        '"https://bs4.expertflow.com/items/Employee?limit=1"',
        '4. Direct curl to Directus - HTTP status')

    # 5. Test Directus with response body
    run(client,
        'curl -s '
        '-H "Authorization: Bearer july2026-admin-token-zaeem" '
        '"https://bs4.expertflow.com/items/Employee?limit=1" 2>&1 | head -c 500',
        '5. Directus response body')

    # 6. Test with Node.js inline
    run(client,
        r"""node -e "
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const axios = require('/opt/hr-suite/node_modules/axios');
const token = 'july2026-admin-token-zaeem';
console.log('Token:', token.substring(0,10) + '...');
axios.get('https://bs4.expertflow.com/items/Employee?limit=1', {
  headers: { Authorization: 'Bearer ' + token },
  httpsAgent: agent,
  timeout: 10000
}).then(r => {
  console.log('SUCCESS - status:', r.status, 'count:', r.data.data ? r.data.data.length : 'N/A');
}).catch(e => {
  console.log('ERROR:', e.message);
  if (e.response) console.log('Response status:', e.response.status, 'data:', JSON.stringify(e.response.data).substring(0,200));
});
" 2>&1""",
        '6. Node.js axios test from VM')

    # 7. Check PM2 logs
    run(client,
        'pm2 logs hr-suite-backend --lines 40 --nostream 2>&1',
        '7. PM2 logs last 40 lines')

    # 8. Test the sync endpoint and capture full response
    run(client,
        'curl -s -X POST http://localhost:3000/api/v1/employees/sync '
        '-H "Content-Type: application/json" '
        '-w "\\nHTTP_STATUS:%{http_code}"',
        '8. Sync endpoint test (no auth header)')

    # 9. Check if the token in .env has any hidden chars
    run(client,
        r"python3 -c \"import subprocess; r=subprocess.run(['cat','/opt/hr-suite/.env'],capture_output=True,text=True); lines=[l for l in r.stdout.split('\n') if 'DIRECTUS_TOKEN' in l]; print(repr(lines[0]) if lines else 'NOT FOUND')\"",
        '9. DIRECTUS_TOKEN repr (check for hidden chars)')

    # 10. Try with token read from .env in Node
    run(client,
        r"""node -e "
const path = require('path');
require('dotenv').config({ path: '/opt/hr-suite/.env' });
const token = (process.env.DIRECTUS_TOKEN || '').trim();
const url = (process.env.DIRECTUS_URL || 'https://bs4.expertflow.com').trim();
console.log('Token from .env:', JSON.stringify(token));
console.log('URL from .env:', JSON.stringify(url));
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const axios = require('/opt/hr-suite/node_modules/axios');
axios.get(url + '/items/Employee?limit=1', {
  headers: { Authorization: 'Bearer ' + token },
  httpsAgent: agent,
  timeout: 10000
}).then(r => {
  console.log('SUCCESS - status:', r.status);
}).catch(e => {
  console.log('ERROR:', e.message);
  if (e.response) console.log('HTTP', e.response.status, JSON.stringify(e.response.data).substring(0,300));
});
" 2>&1""",
        '10. Node.js with token from .env')

    client.close()
    print('\n=== DIAGNOSIS COMPLETE ===')

if __name__ == '__main__':
    main()
