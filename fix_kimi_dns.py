#!/usr/bin/env python3
"""
Fix VM DNS to resolve api.kimi.ai, then restart PM2 backend.
Run this AFTER deploy.py has uploaded the updated ai-screen.js.
"""
import paramiko, sys, time, io

# Force UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(f'     {out[:400]}')
    if err and code != 0:
        print(f'     ERR: {err[:200]}')
    return out, err, code

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {HOST}...')
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('[OK] Connected!\n')

# Step 1: Check current DNS resolution for api.kimi.ai
print('-- Step 1: Check DNS resolution for api.kimi.ai --')
out, _, _ = run(client, 'nslookup api.kimi.ai 8.8.8.8 2>&1 | head -15', 'nslookup with Google DNS')
print()

# Step 2: Get the IP of api.kimi.ai using Google DNS
print('-- Step 2: Resolve api.kimi.ai IP via Google DNS --')
out, _, _ = run(client, "nslookup api.kimi.ai 8.8.8.8 2>&1 | grep -A2 'Name:' | grep 'Address' | tail -1 | awk '{print $2}'", 'get IP')
kimi_ip = out.strip()
print(f'     Resolved IP: {kimi_ip}')

if not kimi_ip:
    # Try dig instead
    out2, _, _ = run(client, "dig @8.8.8.8 api.kimi.ai +short 2>/dev/null | head -1", 'dig with Google DNS')
    kimi_ip = out2.strip()
    print(f'     dig IP: {kimi_ip}')

if not kimi_ip:
    print('[WARN] Could not resolve api.kimi.ai via Google DNS either.')
    print('       Will try adding Google DNS to resolv.conf instead.')
    # Add Google DNS to resolv.conf
    run(client, 
        "grep -q '8.8.8.8' /etc/resolv.conf || sed -i '1s/^/nameserver 8.8.8.8\\n/' /etc/resolv.conf",
        'add Google DNS to resolv.conf')
    # Test again
    out3, _, _ = run(client, 'nslookup api.kimi.ai 2>&1 | head -10', 'test DNS after fix')
    print(f'     After fix: {out3}')
else:
    # Add hosts entry for api.kimi.ai
    print(f'\n-- Step 3: Adding /etc/hosts entry for api.kimi.ai -> {kimi_ip} --')
    run(client,
        f"grep -q 'api.kimi.ai' /etc/hosts && sed -i '/api.kimi.ai/d' /etc/hosts; echo '{kimi_ip} api.kimi.ai' >> /etc/hosts",
        'add hosts entry')
    out4, _, _ = run(client, 'grep api.kimi.ai /etc/hosts', 'verify hosts entry')

# Step 4: Test connectivity to api.kimi.ai
print('\n-- Step 4: Test TCP connectivity to api.kimi.ai:443 --')
run(client, 'timeout 5 bash -c "echo > /dev/tcp/api.kimi.ai/443" && echo "TCP OPEN" || echo "TCP FAILED"', 'TCP test')

# Step 5: Restart PM2 backend to pick up new ai-screen.js
print('\n-- Step 5: Restart PM2 backend --')
run(client, 'pm2 restart hr-suite-backend && sleep 2 && pm2 list', 'restart PM2')

# Step 6: Test the AI endpoint
print('\n-- Step 6: Test AI screen endpoint --')
test_payload = '{"requirements":["Python experience"],"resumeText":"I have 5 years of Python development experience."}'
run(client,
    f"curl -s -X POST http://localhost:3000/api/v1/ai/screen-resume -H 'Content-Type: application/json' -d '{test_payload}' | head -c 500",
    'test AI endpoint')

print('\n[DONE] DNS fix and PM2 restart complete.')
client.close()
