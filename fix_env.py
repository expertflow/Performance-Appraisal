#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix the .env on the VM and restart the backend."""
import paramiko
import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

ENV = (
    "NODE_ENV=production\n"
    "PORT=3000\n"
    "DB_HOST=localhost\n"
    "DB_PORT=5432\n"
    "DB_NAME=hr_suite\n"
    "DB_USER=hr_suite_user\n"
    "DB_PASSWORD=HrSuite2025!\n"
    "DIRECTUS_URL=https://bs4.expertflow.com\n"
    "DIRECTUS_TOKEN=july2026-admin-token-zaeem\n"
    "APP_URL=http://169.58.125.199\n"
    "CORS_ORIGIN=http://169.58.125.199\n"
)

def run(client, cmd):
    print(f'$ {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', 'replace').strip()
    err = stderr.read().decode('utf-8', 'replace').strip()
    if out:
        print(out)
    if err:
        print('STDERR:', err)
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {HOST}...')
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('Connected!\n')

# Write .env via SFTP
sftp = client.open_sftp()
with sftp.open('/opt/hr-suite/.env', 'w') as f:
    f.write(ENV)
sftp.close()
print('Wrote .env\n')

# Verify
run(client, 'cat /opt/hr-suite/.env')

# Check PM2 logs to see what dotenv loaded
run(client, 'pm2 logs hr-suite-backend --lines 20 --nostream 2>&1 | tail -30')

# Test the token directly from the server
run(client, 'curl -sk -H "Authorization: Bearer july2026-admin-token-zaeem" "https://bs4.expertflow.com/items/Employee?limit=1&fields=id,EmployeeName" | head -c 200')

# Check what DIRECTUS_TOKEN the process sees via env
run(client, 'cat /proc/$(pm2 pid hr-suite-backend)/environ 2>/dev/null | tr "\\0" "\\n" | grep DIRECTUS || echo "Cannot read proc environ"')

# Try setting env var directly and test
run(client, 'DIRECTUS_TOKEN=july2026-admin-token-zaeem curl -s -X POST http://localhost:3000/api/v1/employees/sync')

client.close()
print('\nDone.')
