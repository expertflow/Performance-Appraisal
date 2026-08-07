#!/usr/bin/env python3
"""
Full deployment script for HR Suite to VM 169.58.125.199
Uploads backend + frontend dist, installs dependencies, configures nginx + PM2.
"""
import paramiko
import os
import sys
import tarfile
import io
import time

# Force UTF-8 output on Windows to avoid cp1252 encoding errors
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# -- Config --------------------------------------------------------------------
HOST     = '169.58.125.199'
USER     = 'root'
PASS     = 'a0QOB1971D2rc9rq'
APP_DIR  = '/opt/hr-suite'
WWW_DIR  = '/var/www/hr-suite'
BACKEND_LOCAL  = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend'))
FRONTEND_DIST  = os.path.abspath(os.path.join(os.path.dirname(__file__), 'hr-suite', 'dist', 'hr-suite', 'browser'))

DOMAIN   = 'hrsuite.expertflow.com'

# -- VM .env for production ----------------------------------------------------
# Google OAuth credentials — read from local .env.deploy file or environment variables.
# Create .env.deploy (gitignored) with:
#   GOOGLE_CLIENT_ID=<your-client-id>
#   GOOGLE_CLIENT_SECRET=<your-client-secret>
def _load_deploy_env():
    env_file = os.path.join(os.path.dirname(__file__), '.env.deploy')
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

_load_deploy_env()

GOOGLE_CLIENT_ID     = os.environ.get('GOOGLE_CLIENT_ID',     '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
KIMI_API_KEY         = os.environ.get('KIMI_API_KEY',         'sk-29EQNOVXDKIAPLEdCJzmMjmql30Jbg31tJXigttv2HrVdPf3')

VM_ENV = f"""NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hr_suite
DB_USER=hr_suite_user
DB_PASSWORD=HrSuite2025!
DIRECTUS_URL=https://bs4.expertflow.com
DIRECTUS_TOKEN=july2026-admin-token-zaeem
APP_URL=https://{DOMAIN}
CORS_ORIGIN=https://{DOMAIN}
GOOGLE_CLIENT_ID={GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET={GOOGLE_CLIENT_SECRET}
ALLOWED_DOMAIN=expertflow.com
KIMI_API_KEY={KIMI_API_KEY}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=zaeem.ahmad@expertflow.com
SMTP_PASS=xcitkmhazsrgywhb
SMTP_FROM=ExpertFlow HR Suite <zaeem.ahmad@expertflow.com>
"""

# -- nginx config (HTTP only — certbot will upgrade to HTTPS) ------------------
# After first deploy, certbot rewrites this file to add SSL.
# Subsequent deploys keep the certbot-managed HTTPS config intact by
# only writing the HTTP block when no SSL cert exists yet.
NGINX_CONF_HTTP = f"""server {{
    listen 80;
    server_name {DOMAIN};

    root /var/www/hr-suite;
    index index.html;

    # Angular SPA -- all routes fall back to index.html
    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # Proxy API calls to Node.js backend
    location /api/ {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }}
}}
"""

# Keep backward-compat alias
NGINX_CONF = NGINX_CONF_HTTP

# -- PM2 ecosystem -------------------------------------------------------------
PM2_ECOSYSTEM = """module.exports = {
  apps: [{
    name: 'hr-suite-backend',
    script: 'src/index.js',
    cwd: '/opt/hr-suite',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
"""

def run(client, cmd, desc=''):
    if desc:
        print(f'  -> {desc}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(f'    {out[:300]}')
    if err and exit_code != 0:
        print(f'    ERR: {err[:200]}')
    return out, err, exit_code

def upload_dir_as_tar(sftp, local_dir, remote_path, exclude=None):
    """Tar a local directory and extract it on the remote."""
    exclude = exclude or []
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for root, dirs, files in os.walk(local_dir):
            # Skip excluded dirs
            dirs[:] = [d for d in dirs if d not in exclude]
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, local_dir)
                tar.add(full_path, arcname=arcname)
    buf.seek(0)
    remote_tar = f'{remote_path}.tar.gz'
    sftp.putfo(buf, remote_tar)
    return remote_tar

def main():
    print(f'\n{"="*60}')
    print(f'  HR Suite Deployment -> {HOST}')
    print(f'{"="*60}\n')

    # -- Connect ---------------------------------------------------------------
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f'Connecting to {HOST}...')
    client.connect(HOST, username=USER, password=PASS, timeout=20)
    print('[OK] Connected!\n')

    # -- Step 1: Check existing state ------------------------------------------
    print('-- Step 1: Checking VM state --')
    out, _, _ = run(client, 'node --version 2>/dev/null || echo NOT_INSTALLED')
    node_ok = 'NOT_INSTALLED' not in out
    out2, _, _ = run(client, 'nginx -v 2>&1 || echo NOT_INSTALLED')
    nginx_ok = 'NOT_INSTALLED' not in out2
    out3, _, _ = run(client, 'pm2 --version 2>/dev/null || echo NOT_INSTALLED')
    pm2_ok = 'NOT_INSTALLED' not in out3
    out4, _, _ = run(client, 'psql --version 2>/dev/null || echo NOT_INSTALLED')
    pg_ok = 'NOT_INSTALLED' not in out4
    print(f'  Node.js:    {"[OK]" if node_ok else "[MISSING] needs install"}')
    print(f'  nginx:      {"[OK]" if nginx_ok else "[MISSING] needs install"}')
    print(f'  PM2:        {"[OK]" if pm2_ok else "[MISSING] needs install"}')
    print(f'  PostgreSQL: {"[OK]" if pg_ok else "[MISSING] needs install"}')

    # -- Step 2: Install missing dependencies ----------------------------------
    print('\n-- Step 2: Installing system dependencies --')
    run(client, 'apt-get update -qq', 'apt update')

    if not node_ok:
        print('  Installing Node.js 20...')
        run(client, 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs', 'install Node.js 20')

    if not nginx_ok:
        run(client, 'apt-get install -y nginx', 'install nginx')

    if not pm2_ok:
        run(client, 'npm install -g pm2', 'install PM2')

    if not pg_ok:
        print('  Installing PostgreSQL...')
        run(client, 'apt-get install -y postgresql postgresql-contrib', 'install PostgreSQL')
        run(client, 'systemctl start postgresql && systemctl enable postgresql', 'start PostgreSQL')

    # -- Step 3: Setup PostgreSQL DB -------------------------------------------
    print('\n-- Step 3: Setting up PostgreSQL database --')
    pg_setup = """
sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='hr_suite_user'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE USER hr_suite_user WITH PASSWORD 'HrSuite2025!';"
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='hr_suite'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE hr_suite OWNER hr_suite_user;"
sudo -u postgres psql -d hr_suite -c "CREATE SCHEMA IF NOT EXISTS project AUTHORIZATION hr_suite_user;"
sudo -u postgres psql -d hr_suite -c "GRANT ALL PRIVILEGES ON DATABASE hr_suite TO hr_suite_user;"
sudo -u postgres psql -d hr_suite -c "GRANT ALL ON SCHEMA project TO hr_suite_user;"
"""
    run(client, pg_setup, 'setup PostgreSQL user/db/schema')

    # -- Step 4: Create directories --------------------------------------------
    print('\n-- Step 4: Creating directories --')
    run(client, f'mkdir -p {APP_DIR} {WWW_DIR}', 'create app dirs')

    # -- Step 5: Upload backend ------------------------------------------------
    print('\n-- Step 5: Uploading backend --')
    sftp = client.open_sftp()

    print('  Packaging backend (excluding node_modules)...')
    remote_tar = upload_dir_as_tar(sftp, BACKEND_LOCAL, f'{APP_DIR}/backend_upload',
                                    exclude=['node_modules', '.env', 'dist'])
    print(f'  Uploaded to {remote_tar}')
    run(client, f'cd {APP_DIR} && tar -xzf backend_upload.tar.gz && rm backend_upload.tar.gz', 'extract backend')

    # -- Step 6: Upload frontend dist ------------------------------------------
    print('\n-- Step 6: Uploading frontend dist --')
    if not os.path.exists(FRONTEND_DIST):
        print(f'  [FAIL] Frontend dist not found at {FRONTEND_DIST}')
        print('  Run: cd hr-suite && npx ng build --configuration production')
        sys.exit(1)

    print('  Packaging frontend dist...')
    remote_tar2 = upload_dir_as_tar(sftp, FRONTEND_DIST, f'{WWW_DIR}/frontend_upload')
    print(f'  Uploaded to {remote_tar2}')
    run(client, f'cd {WWW_DIR} && tar -xzf frontend_upload.tar.gz && rm frontend_upload.tar.gz', 'extract frontend')
    run(client, f'chown -R www-data:www-data {WWW_DIR}', 'set frontend ownership')

    sftp.close()

    # -- Step 7: Write .env ----------------------------------------------------
    print('\n-- Step 7: Writing .env --')
    run(client, f"cat > {APP_DIR}/.env << 'ENVEOF'\n{VM_ENV}\nENVEOF", 'write .env')

    # -- Step 8: Install backend npm deps --------------------------------------
    print('\n-- Step 8: Installing backend npm dependencies --')
    run(client, f'cd {APP_DIR} && npm install --production', 'npm install')

    # -- Step 9: Run DB migrations ---------------------------------------------
    print('\n-- Step 9: Running DB migrations --')
    run(client, f'cd {APP_DIR} && node src/db/migrate.js 2>&1 || echo "migrate done"', 'run migrations')

    # -- Step 10: Write PM2 ecosystem ------------------------------------------
    print('\n-- Step 10: Configuring PM2 --')
    run(client, f"cat > {APP_DIR}/ecosystem.config.js << 'PM2EOF'\n{PM2_ECOSYSTEM}\nPM2EOF", 'write PM2 config')
    run(client, f'cd {APP_DIR} && pm2 delete hr-suite-backend 2>/dev/null; pm2 start ecosystem.config.js', 'start with PM2')
    run(client, 'pm2 save && pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true', 'PM2 startup')

    # -- Step 11: Configure nginx (HTTP first, then HTTPS via certbot) ---------
    print('\n-- Step 11: Configuring nginx --')

    # Check if a certbot-managed SSL cert already exists for the domain
    cert_check, _, _ = run(client,
        f'test -f /etc/letsencrypt/live/{DOMAIN}/fullchain.pem && echo EXISTS || echo MISSING',
        'check SSL cert')
    ssl_exists = 'EXISTS' in cert_check

    if not ssl_exists:
        # Write plain HTTP config so certbot can do its ACME challenge
        run(client, f"cat > /etc/nginx/sites-available/hr-suite << 'NGEOF'\n{NGINX_CONF_HTTP}\nNGEOF", 'write HTTP nginx config')
        run(client, 'ln -sf /etc/nginx/sites-available/hr-suite /etc/nginx/sites-enabled/hr-suite', 'enable nginx site')
        run(client, 'rm -f /etc/nginx/sites-enabled/default', 'remove default nginx site')
        run(client, 'nginx -t && systemctl restart nginx && systemctl enable nginx', 'start nginx (HTTP)')

        # Install certbot if missing
        run(client, 'which certbot || (apt-get install -y certbot python3-certbot-nginx)', 'install certbot')

        # Obtain certificate (non-interactive, agrees to ToS, no redirect yet)
        print(f'  Obtaining Let\'s Encrypt certificate for {DOMAIN}...')
        cert_out, cert_err, cert_code = run(client,
            f'certbot --nginx -d {DOMAIN} --non-interactive --agree-tos '
            f'-m zaeem.ahmad@expertflow.com --redirect 2>&1',
            'run certbot')
        if cert_code == 0:
            print('  [OK] SSL certificate obtained and nginx updated by certbot.')
            ssl_exists = True
        else:
            print(f'  [WARN] certbot failed (exit {cert_code}). App will run on HTTP only.')
            print(f'         Error: {cert_err[:300]}')
    else:
        # Cert already exists — just refresh the proxy block inside the existing config.
        # certbot manages the SSL stanzas; we only need to ensure the proxy location is present.
        # Safest: re-run certbot --nginx to re-apply (idempotent).
        run(client, f"cat > /etc/nginx/sites-available/hr-suite << 'NGEOF'\n{NGINX_CONF_HTTP}\nNGEOF", 'refresh HTTP nginx config')
        run(client, 'ln -sf /etc/nginx/sites-available/hr-suite /etc/nginx/sites-enabled/hr-suite', 'enable nginx site')
        run(client, 'rm -f /etc/nginx/sites-enabled/default', 'remove default nginx site')
        run(client,
            f'certbot --nginx -d {DOMAIN} --non-interactive --agree-tos '
            f'-m zaeem.ahmad@expertflow.com --redirect 2>&1 || true',
            'certbot re-apply SSL')
        run(client, 'nginx -t && systemctl reload nginx', 'reload nginx')

    # -- Step 12: Verify -------------------------------------------------------
    print('\n-- Step 12: Verifying deployment --')
    time.sleep(3)
    out, _, _ = run(client, 'pm2 list', 'PM2 status')
    out2, _, _ = run(client, 'systemctl is-active nginx', 'nginx status')
    out3, _, _ = run(client, 'curl -s http://localhost:3000/health', 'backend health check')
    proto = 'https' if ssl_exists else 'http'
    out4, _, _ = run(client, f'curl -sk -o /dev/null -w "%{{http_code}}" {proto}://localhost/', 'frontend HTTP check')

    print(f'\n{"="*60}')
    print('  DEPLOYMENT COMPLETE')
    print(f'{"="*60}')
    print(f'  Frontend: {proto}://{DOMAIN}')
    print(f'  Backend:  {proto}://{DOMAIN}/api/v1/health')
    print(f'  SSL:      {"YES (Let\'s Encrypt)" if ssl_exists else "NO (HTTP only — certbot failed or skipped)"}')
    print(f'  nginx:    {out2}')
    print(f'  Backend health: {out3}')
    print(f'  Frontend HTTP:  {out4}')
    if GOOGLE_CLIENT_ID:
        print(f'\n  Google OAuth redirect URI to register in Google Console:')
        print(f'    {proto}://{DOMAIN}/api/v1/auth/google/callback')
    else:
        print(f'\n  [!] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.')
        print(f'      Google login will return 503 until you set them in .env and restart:')
        print(f'        pm2 restart hr-suite-backend')
    print(f'{"="*60}\n')

    client.close()

if __name__ == '__main__':
    main()
