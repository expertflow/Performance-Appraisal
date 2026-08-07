#!/usr/bin/env python3
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import paramiko

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)

def run(cmd):
    _, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    return stdout.read().decode('utf-8', errors='replace').strip()

# Check .env
print('=== .env KIMI line ===')
print(run('grep KIMI /opt/hr-suite/.env || echo NOT_FOUND'))

# Test the API key directly from the VM
print('\n=== Testing Kimi API from VM ===')
test_cmd = r"""curl -s -o /tmp/kimi_test.json -w "%{http_code}" \
  -X POST https://api.moonshot.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep KIMI_API_KEY /opt/hr-suite/.env | cut -d= -f2)" \
  -d '{"model":"moonshot-v1-8k","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'"""
http_code = run(test_cmd)
print('HTTP code:', http_code)
response = run('cat /tmp/kimi_test.json')
print('Response:', response[:500])

client.close()
