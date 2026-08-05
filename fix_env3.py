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

# Upload the fixed index.js
sftp = client.open_sftp()
sftp.put(
    r'D:\Github\Performance-Appraisal\backend\src\index.js',
    '/opt/hr-suite/src/index.js'
)
sftp.close()
print('Uploaded index.js\n')

# Restart PM2
run(client, 'pm2 restart hr-suite-backend --update-env')
time.sleep(3)

# Health check
run(client, 'curl -s http://localhost:3000/health')

# Check startup logs for DIRECTUS_TOKEN
run(client, 'pm2 logs hr-suite-backend --lines 20 --nostream 2>&1 | tail -25')

# Test sync
print('\n=== Testing sync ===')
run(client, 'curl -s -X POST http://localhost:3000/api/v1/employees/sync')

client.close()
print('\nDone.')
