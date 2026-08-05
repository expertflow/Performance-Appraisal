#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import paramiko, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

def run(client, cmd):
    print(f'$ {cmd[:150]}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', 'replace').strip()
    err = stderr.read().decode('utf-8', 'replace').strip()
    if out: print(out[:800])
    if err: print('ERR:', err[:300])
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=20)
print('Connected!\n')

# Check what the .env actually contains on the server
print('=== .env content ===')
run(client, 'cat /opt/hr-suite/.env')

# Check what index.js looks like on the server
print('\n=== index.js dotenv line ===')
run(client, 'head -5 /opt/hr-suite/src/index.js')

# Test with node directly - what does the backend read?
print('\n=== Node reads token ===')
run(client, 'cd /opt/hr-suite && node -e "const path=require(\'path\'); require(\'dotenv\').config({path:path.join(\'/opt/hr-suite/src\',\'..\',\'.env\')}); console.log(\'TOKEN:\',JSON.stringify(process.env.DIRECTUS_TOKEN));"')

# Test the actual Directus call from node with the token
print('\n=== Node calls Directus ===')
run(client, 'cd /opt/hr-suite && node -e "const axios=require(\'axios\'); axios.get(\'https://bs4.expertflow.com/items/Employee?limit=1&fields=id,EmployeeName\',{headers:{Authorization:\'Bearer july2026-admin-token-zaeem\'},httpsAgent:new (require(\'https\').Agent)({rejectUnauthorized:false}),timeout:5000}).then(r=>console.log(\'OK:\',JSON.stringify(r.data))).catch(e=>console.log(\'ERR:\',e.message,e.response&&e.response.status));"')

client.close()
print('\nDone.')
