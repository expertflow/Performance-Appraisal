#!/usr/bin/env python3
"""
Upload a small Node.js script to the VM, run it, and print the exact
field names returned by the Directus Employee collection.
"""
import paramiko, sys, io

if hasattr(sys.stdout, 'reconfigure'):
    try: sys.stdout.reconfigure(encoding='utf-8')
    except: sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

# Node.js script to run on the VM
NODE_SCRIPT = r"""
'use strict';
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const axios = require('/opt/hr-suite/node_modules/axios');

const TOKEN = 'july2026-admin-token-zaeem';
const URL   = 'https://bs4.expertflow.com/items/Employee?limit=2';

axios.get(URL, {
  headers: { Authorization: 'Bearer ' + TOKEN },
  httpsAgent: agent,
  timeout: 10000
}).then(r => {
  const records = r.data.data || [];
  if (records.length === 0) { console.log('NO RECORDS'); return; }
  const keys = Object.keys(records[0]);
  console.log('=== FIELD NAMES (' + keys.length + ') ===');
  keys.forEach(k => console.log('  ' + k));
  console.log('\n=== FIRST RECORD ===');
  console.log(JSON.stringify(records[0], null, 2));
}).catch(e => {
  console.log('ERROR:', e.message);
  if (e.response) {
    console.log('HTTP status:', e.response.status);
    console.log('Response:', JSON.stringify(e.response.data).substring(0, 500));
  }
});
"""

# Also test with explicit fields param to see if that causes 403
NODE_SCRIPT2 = r"""
'use strict';
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const axios = require('/opt/hr-suite/node_modules/axios');

const TOKEN  = 'july2026-admin-token-zaeem';
const FIELDS = 'id,email,EmployeeName,EmployStartDate,MobileNumber,PhoneNo,status,RegionCode,DefaultProjectId,ManagerId,Seniority,Department,Designation,country,LegalEntityId';
const URL    = 'https://bs4.expertflow.com/items/Employee?fields=' + FIELDS + '&limit=2';

console.log('Testing URL:', URL.substring(0, 100) + '...');

axios.get(URL, {
  headers: { Authorization: 'Bearer ' + TOKEN },
  httpsAgent: agent,
  timeout: 10000
}).then(r => {
  console.log('SUCCESS - HTTP', r.status, '- records:', (r.data.data || []).length);
  if (r.data.data && r.data.data[0]) {
    console.log('Keys returned:', Object.keys(r.data.data[0]).join(', '));
  }
}).catch(e => {
  console.log('ERROR:', e.message);
  if (e.response) {
    console.log('HTTP status:', e.response.status);
    console.log('Response:', JSON.stringify(e.response.data).substring(0, 800));
  }
});
"""

def run(client, cmd, desc=''):
    if desc: print(f'\n=== {desc} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out[:3000])
    if err: print('STDERR:', err[:500])
    return out

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print('Connecting...')
    client.connect(HOST, username=USER, password=PASS, timeout=20)
    print('[OK] Connected\n')

    sftp = client.open_sftp()

    # Upload script 1
    sftp.putfo(io.BytesIO(NODE_SCRIPT.encode()), '/tmp/check_fields.js')
    # Upload script 2
    sftp.putfo(io.BytesIO(NODE_SCRIPT2.encode()), '/tmp/check_fields2.js')
    sftp.close()

    run(client, 'node /tmp/check_fields.js 2>&1', 'All fields from Directus (no field filter)')
    run(client, 'node /tmp/check_fields2.js 2>&1', 'With explicit fields param (the one causing 403?)')

    client.close()
    print('\n=== DONE ===')

if __name__ == '__main__':
    main()
