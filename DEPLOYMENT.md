# Guide de Déploiement - Serveur EC2 Ubuntu 24.04

Ce guide vous explique comment déployer l'application Cantine sur un serveur EC2 Ubuntu 24.04 LTS.

## Prérequis

- Une instance EC2 Ubuntu 24.04 LTS
- Accès SSH à votre serveur
- Un nom de domaine (optionnel mais recommandé pour SSL)

## Étape 1 : Configuration initiale du serveur EC2

### 1.1 Connexion SSH

```bash
ssh -i votre-cle.pem ubuntu@votre-ip-ec2
```

### 1.2 Mise à jour du système

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Configuration du firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Étape 2 : Installation de Node.js

### 2.1 Installation de Node.js 20.x (LTS recommandé pour Ubuntu 24.04)

**Méthode recommandée : NodeSource (inclut npm)**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**⚠️ Important :** Node.js de NodeSource inclut déjà npm. Ne pas installer le package `npm` séparément, cela causera un conflit.

**Alternative : Installation via le dépôt Ubuntu (si NodeSource ne fonctionne pas)**

```bash
# Désinstaller Node.js de NodeSource si déjà installé
sudo apt remove -y nodejs npm
sudo apt autoremove -y

# Installer depuis le dépôt Ubuntu
sudo apt update
sudo apt install -y nodejs npm
```

### 2.2 Résolution des conflits npm (si vous avez déjà installé Node.js)

**Si vous obtenez une erreur de conflit entre nodejs et npm :**

```bash
# Vérifier la version de Node.js installée
node --version

# Vérifier si npm est disponible
npm --version

# Si npm fonctionne, pas besoin de faire quoi que ce soit
# Si npm n'est pas disponible, réinstaller Node.js proprement :
sudo apt remove -y nodejs npm
sudo apt autoremove -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Node.js de NodeSource inclut npm automatiquement.** Vous n'avez pas besoin d'installer npm séparément.

### 2.3 Vérification de l'installation

```bash
node --version
npm --version
```

Les deux commandes devraient fonctionner. Si npm n'est pas disponible :

```bash
# Vérifier où npm devrait être
which npm
ls -la /usr/bin/npm

# Si npm n'existe pas, réinstaller Node.js
sudo apt remove -y nodejs
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.4 Installation de PM2 (gestionnaire de processus)

```bash
sudo npm install -g pm2
```

## Étape 3 : Installation de MongoDB

### 3.1 Installation de MongoDB 7.0 (Ubuntu 24.04)

**⚠️ Note importante :** MongoDB 7.0 peut ne pas être disponible directement pour Ubuntu 24.04. Nous utiliserons Ubuntu 22.04 (jammy) qui est compatible.

```bash
# Installer les dépendances nécessaires
sudo apt install -y wget curl gnupg ca-certificates

# Importer la clé GPG MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Ajouter le dépôt MongoDB (utiliser jammy qui est compatible avec noble)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Mettre à jour et installer
sudo apt update
sudo apt install -y mongodb-org

# Démarrer MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Alternative : Installation de MongoDB 6.0 (si 7.0 ne fonctionne pas)**

Si la méthode ci-dessus ne fonctionne pas, utilisez MongoDB 6.0 :

```bash
# Nettoyer les tentatives précédentes
sudo rm -f /etc/apt/sources.list.d/mongodb-org-*.list
sudo rm -f /usr/share/keyrings/mongodb-server-*.gpg

# Importer la clé GPG MongoDB 6.0
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor

# Ajouter le dépôt MongoDB 6.0
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Mettre à jour et installer
sudo apt update
sudo apt install -y mongodb-org

# Démarrer MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Note :** Ubuntu 24.04 (noble) est compatible avec les packages MongoDB pour Ubuntu 22.04 (jammy).

### 3.2 Vérification de MongoDB

```bash
sudo systemctl status mongod
```

## Étape 4 : Installation de Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Étape 5 : Déploiement de l'application

### 5.1 Créer un répertoire pour l'application

```bash
sudo mkdir -p /var/www/cantine
sudo chown ubuntu:ubuntu /var/www/cantine
cd /var/www/cantine
```

### 5.2 Cloner le repository (ou transférer les fichiers)

**Option A : Via Git**
```bash
git clone https://github.com/twytty3x-bit/cantine.git .
```

**Option B : Via SCP (depuis votre machine locale)**
```bash
# Depuis votre machine locale
scp -i votre-cle.pem -r /Users/patricklabbe/Documents/Cantine/* ubuntu@votre-ip-ec2:/var/www/cantine/
```

### 5.3 Installation des dépendances

```bash
cd /var/www/cantine
npm install --production
```

### 5.4 Créer le fichier .env

```bash
nano .env
```

Contenu du fichier `.env` :

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/cantine

# JWT Secret (générez un secret fort)
JWT_SECRET=votre-secret-jwt-tres-long-et-aleatoire

# Session Secret (générez un secret fort)
SESSION_SECRET=votre-session-secret-tres-long-et-aleatoire

# Port de l'application
PORT=3000

# Environnement
NODE_ENV=production

# SMTP (optionnel - à configurer si vous utilisez l'envoi d'emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
SMTP_FROM=votre-email@gmail.com
```

**Générer des secrets :**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.5 Créer les répertoires nécessaires

```bash
mkdir -p public/uploads/products
mkdir -p temp_uploads
```

### 5.6 Initialiser la base de données

```bash
# Créer un utilisateur admin
node scripts/createAdmin.js

# Initialiser la configuration des tickets
node scripts/initTicketConfig.js
```

## Étape 6 : Configuration de PM2

### 6.1 Créer un fichier de configuration PM2

```bash
nano ecosystem.config.js
```

Contenu :

```javascript
module.exports = {
  apps: [{
    name: 'cantine',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 6.2 Créer le répertoire de logs

```bash
mkdir -p logs
```

### 6.3 Démarrer l'application avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Suivez les instructions affichées pour configurer le démarrage automatique.

### 6.4 Commandes PM2 utiles

```bash
pm2 status          # Voir le statut
pm2 logs            # Voir les logs
pm2 restart cantine # Redémarrer
pm2 stop cantine    # Arrêter
pm2 delete cantine  # Supprimer
```

## Étape 7 : Configuration de Nginx

### 7.1 Créer la configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/cantine
```

Contenu :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    # Redirection vers HTTPS (après configuration SSL)
    # return 301 https://$server_name$request_uri;

    # Pour le moment, proxy vers l'application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Augmenter la taille maximale des fichiers uploadés
    client_max_body_size 10M;
}
```

### 7.2 Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/cantine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Étape 8 : Configuration SSL avec Let's Encrypt (Optionnel mais recommandé)

### 8.1 Installation de Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.2 Obtenir un certificat SSL

```bash
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

Suivez les instructions. Certbot configurera automatiquement Nginx.

### 8.3 Renouvellement automatique

Certbot configure automatiquement le renouvellement. Vous pouvez tester avec :

```bash
sudo certbot renew --dry-run
```

## Étape 9 : Configuration MongoDB (Sécurité)

### 9.1 Activer l'authentification MongoDB (recommandé)

```bash
sudo nano /etc/mongod.conf
```

Décommentez la section `security` et ajoutez :

```yaml
security:
  authorization: enabled
```

### 9.2 Créer un utilisateur admin MongoDB

**Pour Ubuntu 24.04, MongoDB utilise `mongosh` (MongoDB Shell) :**

```bash
mongosh
```

**Si `mongosh` n'est pas installé :**
```bash
sudo apt install -y mongodb-mongosh
mongosh
```

Dans MongoDB shell :

```javascript
use admin
db.createUser({
  user: "admin",
  pwd: "votre-mot-de-passe-fort",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})
exit
```

### 9.3 Redémarrer MongoDB

```bash
sudo systemctl restart mongod
```

### 9.4 Mettre à jour MONGODB_URI dans .env

```env
MONGODB_URI=mongodb://admin:votre-mot-de-passe-fort@localhost:27017/cantine?authSource=admin
```

## Étape 10 : Configuration du firewall avancée

### 10.1 Bloquer l'accès direct au port 3000 (optionnel)

```bash
sudo ufw deny 3000/tcp
```

L'application sera accessible uniquement via Nginx (port 80/443).

## Étape 11 : Vérification et tests

### 11.1 Vérifier que l'application fonctionne

```bash
# Vérifier PM2
pm2 status

# Vérifier Nginx
sudo systemctl status nginx

# Vérifier MongoDB
sudo systemctl status mongod

# Voir les logs de l'application
pm2 logs cantine
```

### 11.2 Tester l'application

Visitez `http://votre-ip-ec2` ou `https://votre-domaine.com` dans votre navigateur.

## Étape 12 : Maintenance et mises à jour

### 12.1 Mettre à jour l'application

```bash
cd /var/www/cantine
git pull  # Si vous utilisez Git
# ou transférer les nouveaux fichiers via SCP

npm install --production
pm2 restart cantine
```

### 12.2 Sauvegarder la base de données

```bash
# Créer un script de sauvegarde
nano /home/ubuntu/backup-mongodb.sh
```

Contenu :

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mongodump --out $BACKUP_DIR/backup_$DATE
# Garder seulement les 7 derniers backups
find $BACKUP_DIR -name "backup_*" -type d -mtime +7 -exec rm -rf {} +
```

Rendre exécutable :

```bash
chmod +x /home/ubuntu/backup-mongodb.sh
```

Ajouter au crontab (sauvegarde quotidienne à 2h du matin) :

```bash
crontab -e
```

Ajouter :

```
0 2 * * * /home/ubuntu/backup-mongodb.sh
```

## Dépannage

### Problème : Erreur de connexion au serveur

**Vérifications étape par étape :**

1. **Vérifier que l'application fonctionne :**
```bash
# Vérifier le statut PM2
pm2 status

# Voir les logs de l'application
pm2 logs cantine --lines 50

# Si l'application n'est pas démarrée
pm2 start ecosystem.config.js
```

2. **Vérifier que MongoDB fonctionne :**
```bash
# Vérifier le statut
sudo systemctl status mongod

# Si MongoDB ne démarre pas
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérifier les logs MongoDB
sudo journalctl -u mongod -n 50
```

3. **Vérifier la connexion MongoDB depuis l'application :**
```bash
# Tester la connexion MongoDB
mongosh
# Dans mongosh, tapez :
# show dbs
# exit
```

4. **Vérifier le fichier .env :**
```bash
cd /var/www/cantine
cat .env
# Vérifier que MONGODB_URI est correct
# Vérifier que JWT_SECRET et SESSION_SECRET sont définis
```

5. **Vérifier que le port 3000 est accessible :**
```bash
# Vérifier si l'application écoute sur le port 3000
sudo netstat -tulpn | grep 3000
# ou
sudo ss -tulpn | grep 3000

# Tester localement
curl http://localhost:3000
```

6. **Vérifier Nginx :**
```bash
# Vérifier la configuration
sudo nginx -t

# Vérifier le statut
sudo systemctl status nginx

# Voir les logs d'erreur
sudo tail -f /var/log/nginx/error.log

# Vérifier que Nginx proxy vers le bon port
sudo cat /etc/nginx/sites-available/cantine | grep proxy_pass
```

7. **Vérifier le firewall :**
```bash
# Vérifier les règles UFW
sudo ufw status

# Si nécessaire, autoriser les ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

8. **Erreurs courantes et solutions :**

**Erreur : "Cannot connect to MongoDB"**
```bash
# Vérifier que MongoDB écoute
sudo netstat -tulpn | grep 27017

# Vérifier la connexion
mongosh "mongodb://localhost:27017"

# Vérifier MONGODB_URI dans .env
cat .env | grep MONGODB_URI
```

**Erreur : "Port 3000 already in use"**
```bash
# Trouver le processus qui utilise le port
sudo lsof -i :3000
# ou
sudo fuser -k 3000/tcp

# Redémarrer PM2
pm2 restart cantine
```

**Erreur : "JWT_SECRET is not defined"**
```bash
# Générer un secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ajouter au .env
nano .env
# Ajouter : JWT_SECRET=votre-secret-genere

# Redémarrer l'application
pm2 restart cantine
```

**Erreur : "EADDRINUSE" (port déjà utilisé)**
```bash
# Changer le port dans .env
nano .env
# Modifier PORT=3000 vers PORT=3001

# Mettre à jour Nginx pour pointer vers le nouveau port
sudo nano /etc/nginx/sites-available/cantine
# Modifier proxy_pass http://localhost:3001;

# Redémarrer
pm2 restart cantine
sudo systemctl reload nginx
```

### Problème : L'application ne démarre pas

```bash
# Vérifier les logs
pm2 logs cantine

# Vérifier les erreurs
tail -f logs/err.log

# Vérifier que le port 3000 n'est pas utilisé
sudo netstat -tulpn | grep 3000

# Vérifier les variables d'environnement
pm2 env 0
```

### Problème : Nginx ne fonctionne pas

```bash
# Vérifier la configuration
sudo nginx -t

# Vérifier les logs
sudo tail -f /var/log/nginx/error.log

# Vérifier les logs d'accès
sudo tail -f /var/log/nginx/access.log
```

### Problème : MongoDB ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u mongod -f
# ou
sudo tail -f /var/log/mongodb/mongod.log

# Vérifier les permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb

# Vérifier le statut
sudo systemctl status mongod

# Redémarrer MongoDB
sudo systemctl restart mongod
```

### Problème : mongosh non trouvé

```bash
# Installer mongosh
sudo apt install -y mongodb-mongosh
```

### Diagnostic complet rapide

Exécutez cette série de commandes pour un diagnostic complet :

```bash
echo "=== Statut PM2 ==="
pm2 status

echo "=== Statut MongoDB ==="
sudo systemctl status mongod --no-pager

echo "=== Statut Nginx ==="
sudo systemctl status nginx --no-pager

echo "=== Ports ouverts ==="
sudo netstat -tulpn | grep -E '3000|27017|80|443'

echo "=== Dernières erreurs PM2 ==="
pm2 logs cantine --lines 20 --err

echo "=== Vérification .env ==="
cd /var/www/cantine
if [ -f .env ]; then
    echo "Fichier .env existe"
    grep -E "MONGODB_URI|JWT_SECRET|SESSION_SECRET|PORT" .env | sed 's/=.*/=***/'
else
    echo "ERREUR: Fichier .env manquant!"
fi
```

## Sécurité supplémentaire

### 1. Désactiver l'accès root SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Modifier :
```
PermitRootLogin no
```

Redémarrer SSH :
```bash
sudo systemctl restart sshd
```

### 2. Configurer un pare-feu plus strict

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Installer fail2ban (protection contre les attaques brute force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Vérifier la version d'Ubuntu

```bash
lsb_release -a
```

Vous devriez voir :
```
Distributor ID: Ubuntu
Description:    Ubuntu 24.04 LTS
Release:        24.04
Codename:       noble
```

### 5. Notes spécifiques Ubuntu 24.04

- **Python** : Ubuntu 24.04 inclut Python 3.12 par défaut
- **OpenSSL** : Version 3.0+ (compatible avec les certificats modernes)
- **Systemd** : Version mise à jour avec de meilleures performances
- **MongoDB** : Utilisez le dépôt "noble" au lieu de "jammy"

## Notes importantes

1. **Sauvegardes régulières** : Configurez des sauvegardes automatiques de MongoDB
2. **Mises à jour** : Gardez le système et les dépendances à jour
3. **Monitoring** : Surveillez les logs régulièrement
4. **SSL** : Utilisez toujours HTTPS en production
5. **Variables d'environnement** : Ne commitez jamais le fichier `.env` dans Git

## Support

En cas de problème, vérifiez :
- Les logs PM2 : `pm2 logs cantine`
- Les logs Nginx : `sudo tail -f /var/log/nginx/error.log`
- Les logs MongoDB : `sudo tail -f /var/log/mongodb/mongod.log`
