#!/usr/bin/env python3
"""Check VM state before deployment."""
import paramiko
import sys

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

def run(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {HOST}...')
client.connect(HOST, username=USER, password=PASS, timeout=15)
print('Connected!\n')

checks = [
    ('node --version', 'Node.js'),
    ('npm --version', 'npm'),
    ('nginx -v 2>&1', 'nginx'),
    ('pm2 --version 2>/dev/null || echo NOT_INSTALLED', 'PM2'),
    ('ls /var/www/ 2>/dev/null || echo EMPTY', '/var/www contents'),
    ('ls /opt/ 2>/dev/null || echo EMPTY', '/opt contents'),
    ('ls /opt/hr-suite/ 2>/dev/null || echo NOT_FOUND', '/opt/hr-suite'),
    ('cat /opt/hr-suite/.env 2>/dev/null || echo NO_ENV', '.env file'),
    ('pm2 list 2>/dev/null || echo NO_PM2', 'PM2 processes'),
    ('systemctl is-active nginx 2>/dev/null || echo inactive', 'nginx status'),
    ('cat /etc/nginx/sites-enabled/hr-suite 2>/dev/null || echo NO_NGINX_CONF', 'nginx config'),
    ('df -h / | tail -1', 'Disk space'),
    ('free -h | grep Mem', 'Memory'),
]

for cmd, label in checks:
    out, err = run(client, cmd)
    print(f'=== {label} ===')
    print(out or err or '(empty)')
    print()

client.close()
print('Done.')
