#!/usr/bin/env python3
"""Deploy tasks.js and time-entries.js backend files to VM and restart PM2."""
import paramiko, time, sys

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

FILES = [
    (r'd:/Github/Performance-Appraisal/backend/src/routes/tasks.js',        '/opt/hr-suite/src/routes/tasks.js'),
    (r'd:/Github/Performance-Appraisal/backend/src/routes/time-entries.js', '/opt/hr-suite/src/routes/time-entries.js'),
]

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print('    ', out[:500].encode('ascii', errors='replace').decode())
    if err:
        print('    ERR:', err[:200].encode('ascii', errors='replace').decode())
    return out

print('='*50)
print('  Deploy backend: tasks.js + time-entries.js')
print('='*50)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS)
print('[OK] Connected')

sftp = client.open_sftp()
for local, remote in FILES:
    sftp.put(local, remote)
    print(f'[OK] Uploaded {local.split("/")[-1]}')
sftp.close()

run(client, 'pm2 restart hr-suite-backend', 'Restart PM2')
time.sleep(2)
run(client, 'curl -s http://localhost:3000/api/v1/tasks | head -c 100', 'Test tasks endpoint')

client.close()
print('\n[DONE] Backend updated.')
