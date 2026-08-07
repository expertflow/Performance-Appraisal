#!/usr/bin/env python3
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import paramiko

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'
NEW_KEY = 'sk-c28TC3zB28Jxiev0Juzkxej6694bVs9Vz8bB0oonmArdWUXF'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)

def run(cmd):
    _, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    return stdout.read().decode('utf-8', errors='replace').strip()

# Test moonshot.cn endpoint
print('=== Testing api.moonshot.cn ===')
r1 = run(f'''curl -s -w "\\nHTTP:%{{http_code}}" -X POST https://api.moonshot.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {NEW_KEY}" \
  -d \'{{"model":"moonshot-v1-8k","messages":[{{"role":"user","content":"hi"}}],"max_tokens":5}}\' ''')
print(r1[:300])

# Test kimi.ai endpoint
print('\n=== Testing api.kimi.ai ===')
r2 = run(f'''curl -s -w "\\nHTTP:%{{http_code}}" -X POST https://api.kimi.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {NEW_KEY}" \
  -d \'{{"model":"moonshot-v1-8k","messages":[{{"role":"user","content":"hi"}}],"max_tokens":5}}\' ''')
print(r2[:300])

# Update .env with new key
print('\n=== Updating .env ===')
out = run(f"sed -i '/^KIMI_API_KEY/d' /opt/hr-suite/.env && echo 'KIMI_API_KEY={NEW_KEY}' >> /opt/hr-suite/.env && grep KIMI /opt/hr-suite/.env")
print(out)

# Restart backend
print('\n=== Restarting PM2 ===')
run('pm2 restart hr-suite-backend')
import time; time.sleep(3)
health = run('curl -s http://localhost:3000/health')
print('Health:', health)

client.close()
print('Done!')
