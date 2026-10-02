#!/bin/bash

# Script de instalación automática para Ubuntu VPS
# Ejecutar con sudo: sudo ./setup_ubuntu.sh

set -e

APP_NAME="petanca-murcia-app"
PORT=3000
DOMAIN="tu-dominio.com" # CAMBIAR ESTO O PASAR COMO ARGUMENTO

# Colores para output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Iniciando instalación de $APP_NAME ===${NC}"

# 1. Actualizar sistema
echo -e "${GREEN}Actualizando paquetes del sistema...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx build-essential

# 2. Instalar Node.js (versión 20 LTS)
echo -e "${GREEN}Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Instalar PM2 globalmente
echo -e "${GREEN}Instalando PM2...${NC}"
npm install -g pm2

# 4. Preparar la aplicación
echo -e "${GREEN}Instalando dependencias de la aplicación...${NC}"
# Asumimos que estamos en el directorio de la app
npm install

echo -e "${GREEN}Construyendo la aplicación...${NC}"
npm run build

# 5. Configurar PM2
echo -e "${GREEN}Iniciando aplicación con PM2...${NC}"
# Eliminar proceso anterior si existe
pm2 delete $APP_NAME 2>/dev/null || true
# Iniciar nuevo proceso
NODE_ENV=production pm2 start npm --name "$APP_NAME" -- start
# Alternativa directa si npm start falla:
# NODE_ENV=production pm2 start index.ts --interpreter ./node_modules/.bin/tsx --name "$APP_NAME"
pm2 save
pm2 startup | tail -n 1 | bash || true # Ejecutar comando de startup si es necesario

# 6. Configurar Nginx
echo -e "${GREEN}Configurando Nginx...${NC}"

NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Activar sitio
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 7. Configurar Firewall (UFW)
echo -e "${GREEN}Configurando Firewall...${NC}"
ufw allow 'Nginx Full'
ufw allow OpenSSH
# ufw enable # Descomentar si se quiere activar automáticamente (cuidado con perder SSH)

echo -e "${GREEN}=== Instalación completada ===${NC}"
echo -e "La aplicación debería estar corriendo en http://$DOMAIN (o la IP del servidor)"
echo -e "Para ver logs: pm2 logs $APP_NAME"
