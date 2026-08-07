#!/usr/bin/env python3
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import paramiko

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'
KEY = 'sk-c28TC3zB28Jxiev0Juzkxej6694bVs9Vz8bB0oonmArdWUXF'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)

def run(cmd):
    _, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    return stdout.read().decode('utf-8', errors='replace').strip()

# Test DNS resolution
print('=== DNS for api.kimi.ai ===')
print(run('nslookup api.kimi.ai 2>&1 | head -5'))

print('\n=== DNS for api.moonshot.cn ===')
print(run('nslookup api.moonshot.cn 2>&1 | head -5'))

# Test TCP connectivity
print('\n=== TCP to api.kimi.ai:443 ===')
print(run('timeout 5 bash -c "echo > /dev/tcp/api.kimi.ai/443" && echo OPEN || echo CLOSED/TIMEOUT'))

print('\n=== TCP to api.moonshot.cn:443 ===')
print(run('timeout 5 bash -c "echo > /dev/tcp/api.moonshot.cn/443" && echo OPEN || echo CLOSED/TIMEOUT'))

# Try kimi.ai with verbose
print('\n=== curl verbose to api.kimi.ai ===')
print(run(f'curl -v --max-time 10 -X POST https://api.kimi.ai/v1/chat/completions -H "Authorization: Bearer {KEY}" -H "Content-Type: application/json" -d \'{{"model":"kimi-latest","messages":[{{"role":"user","content":"hi"}}],"max_tokens":5}}\' 2>&1 | tail -20'))

client.close()
