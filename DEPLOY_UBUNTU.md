# Guía de Despliegue en Ubuntu VPS

Esta guía te ayudará a desplegar la aplicación en un servidor Ubuntu limpio (versión 20.04 o 22.04 recomendada).

## Prerrequisitos

*   Un servidor VPS con Ubuntu.
*   Acceso SSH al servidor.
*   Un dominio apuntando a la IP de tu servidor (opcional, pero recomendado para Nginx).

## Paso 1: Subir el código al servidor

Puedes usar `rsync`, `scp` o `git` para subir tu código.
Ejemplo usando `rsync` desde tu máquina local (excluyendo node_modules):

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' ./ usuario@tu-ip-vps:/var/www/petanca-app
```

## Paso 2: Ejecutar el script de instalación

1.  Conéctate por SSH a tu servidor.
2.  Navega a la carpeta donde subiste el código:
    ```bash
    cd /var/www/petanca-app
    ```
3.  Dale permisos de ejecución al script `setup_ubuntu.sh`:
    ```bash
    chmod +x setup_ubuntu.sh
    ```
4.  Edita el script para poner tu dominio real (opcional, busca la variable `DOMAIN`):
    ```bash
    nano setup_ubuntu.sh
    ```
5.  Ejecuta el script con `sudo`:
    ```bash
    sudo ./setup_ubuntu.sh
    ```

## ¿Qué hace el script?

1.  Actualiza el sistema Ubuntu.
2.  Instala **Node.js 20** y **Nginx**.
3.  Instala **PM2** (gestor de procesos para Node.js).
4.  Instala las dependencias del proyecto (`npm install`).
5.  Construye la aplicación (`npm run build`).
6.  Inicia la app con PM2 para que se ejecute en segundo plano y se reinicie automáticamente.
7.  Configura Nginx como "Reverse Proxy" para servir la app en el puerto 80 (HTTP).

## Comandos útiles post-instalación

*   **Ver estado de la app:** `pm2 status`
*   **Ver logs:** `pm2 logs`
*   **Reiniciar app:** `pm2 restart petanca-murcia-app`
*   **Parar app:** `pm2 stop petanca-murcia-app`

## Configuración de HTTPS (SSL)

Una vez que tu dominio esté apuntando correctamente y la app responda por HTTP, puedes activar HTTPS gratis con Certbot:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```
