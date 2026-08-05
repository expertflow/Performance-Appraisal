#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import paramiko, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

def run(client, cmd):
    print(f'$ {cmd[:120]}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', 'replace').strip()
    err = stderr.read().decode('utf-8', 'replace').strip()
    if out: print(out[:600])
    if err: print('ERR:', err[:300])
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('Connected!\n')

# Test token from the VM directly
print('=== Test Directus token from VM ===')
run(client, 'curl -sk -H "Authorization: Bearer july2026-admin-token-zaeem" "https://bs4.expertflow.com/items/Employee?limit=1&fields=id,EmployeeName"')

# Check what the backend process env actually has
print('\n=== Backend process env ===')
run(client, 'cat /proc/$(pgrep -f "src/index.js" | head -1)/environ 2>/dev/null | tr "\\0" "\\n" | grep -E "DIRECTUS|TOKEN" || echo "no proc environ"')

# Check PM2 logs for startup
print('\n=== PM2 startup logs ===')
run(client, 'pm2 logs hr-suite-backend --lines 30 --nostream 2>&1 | grep -E "Directus|TOKEN|Error|error" | head -20')

# Check if the backend is actually reading the .env
print('\n=== Test backend env endpoint ===')
run(client, 'curl -s http://localhost:3000/api/v1/employees/sync 2>&1 | head -c 300')

client.close()
print('\nDone.')
