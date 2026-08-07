#!/usr/bin/env python3
"""Quick fix: inject KIMI_API_KEY into VM .env and restart backend."""
import paramiko, sys

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'
KIMI_KEY = 'sk-29EQNOVXDKIAPLEdCJzmMjmql30Jbg31tJXigttv2HrVdPf3'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {HOST}...')
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('Connected!')

def run(cmd):
    _, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return out, err

# Remove any existing KIMI_API_KEY line and append the new one
out, err = run(f"sed -i '/^KIMI_API_KEY/d' /opt/hr-suite/.env && echo 'KIMI_API_KEY={KIMI_KEY}' >> /opt/hr-suite/.env && echo OK")
print('Inject:', out, err)

# Verify
out, err = run("grep KIMI /opt/hr-suite/.env")
print('Verify:', out)

# Restart backend
out, err = run("pm2 restart hr-suite-backend")
print('Restart:', out[:200] if out else err[:200])

# Health check
import time
time.sleep(3)
out, err = run("curl -s http://localhost:3000/health")
print('Health:', out)

client.close()
print('Done!')
