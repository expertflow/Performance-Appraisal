#!/usr/bin/env python3
"""Upload updated ai-screen.js (Claude API) and update .env on VM."""
import paramiko, sys, io, time, os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'
APP_DIR = '/opt/hr-suite'
CLAUDE_KEY = 'REDACTED_CLAUDE_API_KEY'

LOCAL_AI_SCREEN = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend', 'src', 'routes', 'ai-screen.js'))

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    if out:
        print(f'     {out[:600]}')
    if err and code != 0:
        print(f'     ERR: {err[:300]}')
    return out, err, code

print(f'Connecting to {HOST}...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('[OK] Connected!\n')

# Step 1: Upload updated ai-screen.js
print('-- Step 1: Upload ai-screen.js (Claude API, claude-opus-4-5) --')
sftp = client.open_sftp()
sftp.put(LOCAL_AI_SCREEN, f'{APP_DIR}/src/routes/ai-screen.js')
sftp.close()
print('  [OK] Uploaded')

# Verify
run(client, f'grep -E "CLAUDE_MODEL|CLAUDE_API_URL|x-api-key" {APP_DIR}/src/routes/ai-screen.js', 'verify file content')

# Step 2: Update .env
print('\n-- Step 2: Update .env with CLAUDE_API_KEY --')
run(client, f"sed -i '/KIMI_API_KEY/d' {APP_DIR}/.env", 'remove old KIMI_API_KEY')
run(client, f"sed -i '/CLAUDE_API_KEY/d' {APP_DIR}/.env", 'remove old CLAUDE_API_KEY if any')
run(client, f"echo 'CLAUDE_API_KEY={CLAUDE_KEY}' >> {APP_DIR}/.env", 'add CLAUDE_API_KEY')
run(client, f"grep 'CLAUDE_API_KEY' {APP_DIR}/.env | sed 's/sk-ant.*/sk-ant-***/'", 'verify .env (masked)')

# Step 3: Restart PM2
print('\n-- Step 3: Restart PM2 --')
run(client, 'pm2 restart hr-suite-backend', 'restart PM2')
time.sleep(3)
run(client, 'pm2 list', 'PM2 status')

# Step 4: Health check
print('\n-- Step 4: Health check --')
run(client, 'curl -s http://localhost:3000/health', 'backend health')

# Step 5: Test AI endpoint
print('\n-- Step 5: Test AI screen endpoint --')
test_payload = '{"requirements":["Python experience","5 years experience"],"resumeText":"I have 5 years of Python development experience building web applications."}'
run(client,
    f"""curl -s -X POST http://localhost:3000/api/v1/ai/screen-resume \
-H 'Content-Type: application/json' \
-d '{test_payload}' | head -c 800""",
    'test AI endpoint')

print('\n[DONE]')
client.close()
