#!/usr/bin/env python3
"""
Clean all dummy/seed data from the HR Suite database.
Keeps: admin@expertflow.com and zaeem.ahmad@expertflow.com accounts only.
"""
import paramiko, time

HOST = '169.58.125.199'
USER = 'root'
PASS = 'a0QOB1971D2rc9rq'

sql_commands = [
    # Remove all job postings (cascades to applications)
    "DELETE FROM recruitment.job_posting;",
    # Remove all job requisitions
    "DELETE FROM recruitment.job_requisition;",
    # Remove all job applications (should already be gone via cascade, but just in case)
    "DELETE FROM recruitment.job_application;",
    # Remove dummy user accounts (keep only admin and zaeem)
    "DELETE FROM auth_local.account WHERE email NOT IN ('admin@expertflow.com','zaeem.ahmad@expertflow.com');",
    # Remove all notifications
    "DELETE FROM app_notifications;",
    # Remove appraisal data
    "TRUNCATE project.appraisal_goals CASCADE;",
    "TRUNCATE project.appraisal_records CASCADE;",
    "TRUNCATE project.appraisal_cycles CASCADE;",
]

verify_commands = [
    ("recruitment.job_posting",      "SELECT COUNT(*) FROM recruitment.job_posting;"),
    ("recruitment.job_requisition",  "SELECT COUNT(*) FROM recruitment.job_requisition;"),
    ("recruitment.job_application",  "SELECT COUNT(*) FROM recruitment.job_application;"),
    ("auth_local.account",           "SELECT COUNT(*) FROM auth_local.account;"),
    ("app_notifications",            "SELECT COUNT(*) FROM app_notifications;"),
    ("project.appraisal_cycles",     "SELECT COUNT(*) FROM project.appraisal_cycles;"),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)
print(f"[OK] Connected to {HOST}")

def run_sql(sql):
    cmd = f'psql -U hruser -d hrdb -c "{sql}"'
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return out, err

print("\n--- Cleaning dummy data ---")
for sql in sql_commands:
    out, err = run_sql(sql)
    if err and 'ERROR' in err:
        print(f"  [ERR] {sql[:60]}... -> {err}")
    else:
        print(f"  [OK]  {sql[:60]}...")

print("\n--- Verifying counts ---")
for label, sql in verify_commands:
    out, err = run_sql(sql)
    # Extract the count number from psql output
    lines = [l.strip() for l in out.split('\n') if l.strip()]
    count = '?'
    for line in lines:
        if line.isdigit():
            count = line
            break
    print(f"  {label}: {count} rows")

client.close()
print("\n[DONE] Cleanup complete.")
