# Deployment Guide for Ubuntu VPS

This guide will walk you through deploying your Petanca Murcia App to an Ubuntu VPS using FileZilla and PuTTY.

## Prerequisites

1.  **Ubuntu VPS**: You should have root access or a user with sudo privileges.
2.  **FileZilla**: For uploading files.
3.  **PuTTY**: For SSH access to run commands.
4.  **Node.js**: Installed on your local machine (to build the app).

---

## Step 1: Prepare the Application Locally

Before uploading, we need to build the frontend assets.

1.  Open your terminal in the project folder.
2.  Run the build command:
    ```bash
    npm run build
    ```
    This will create a `dist` folder containing the optimized frontend code.

3.  Prepare the files to upload. You will need to upload the following files and folders:
    -   `dist/` (The folder created in step 2)
    -   `server.ts`
    -   `package.json`
    -   `package-lock.json`
    -   `types.ts`
    -   `tsconfig.json`

    **Note:** Do NOT upload `node_modules`. We will install dependencies on the server.

---

## Step 2: Connect to VPS via PuTTY

1.  Open PuTTY.
2.  Enter your VPS IP address and click **Open**.
3.  Login with your username (usually `root` or `ubuntu`) and password.

---

## Step 3: Install Node.js on VPS

Run the following commands to install Node.js (version 20 is recommended):

```bash
# Update package list
sudo apt update

# Install curl if not present
sudo apt install -y curl

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

---

## Step 4: Upload Files via FileZilla

1.  Open FileZilla.
2.  Connect to your VPS using the IP, username, and password (port 22 for SFTP).
3.  Navigate to the directory where you want to host the app (e.g., `/var/www/petanca-app` or `/home/ubuntu/petanca-app`).
    -   If the directory doesn't exist, create it.
4.  Upload the files prepared in **Step 1** (`dist`, `server.ts`, `package.json`, `package-lock.json`, `types.ts`, `tsconfig.json`) to this directory.

---

## Step 5: Install Dependencies and Start the App

Back in PuTTY:

1.  Navigate to your app directory:
    ```bash
    cd /path/to/your/app
    # Example: cd /var/www/petanca-app
    ```

2.  Install production dependencies:
    ```bash
    npm install --production
    ```

3.  Install PM2 (Process Manager) to keep your app running in the background:
    ```bash
    sudo npm install -g pm2
    ```

4.  Start the application with PM2:
    ```bash
    pm2 start npm --name "petanca-app" -- start
    ```

5.  Save the PM2 list so it restarts on reboot:
    ```bash
    pm2 save
    pm2 startup
    # Follow the instruction printed by the command above
    ```

Your app should now be running on port 3000!

---

## Step 6: Configure Nginx (Recommended)

To access your app via domain or IP on port 80 (standard HTTP) instead of port 3000, use Nginx.

1.  Install Nginx:
    ```bash
    sudo apt install -y nginx
    ```

2.  Create a configuration file:
    ```bash
    sudo nano /etc/nginx/sites-available/petanca-app
    ```

3.  Paste the following configuration (replace `your_domain_or_ip` with your actual IP or domain):
    ```nginx
    server {
        listen 80;
        server_name your_domain_or_ip;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

4.  Enable the site:
    ```bash
    sudo ln -s /etc/nginx/sites-available/petanca-app /etc/nginx/sites-enabled/
    ```

5.  Test configuration and restart Nginx:
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```

Now you can access your app at `http://your_domain_or_ip`.
