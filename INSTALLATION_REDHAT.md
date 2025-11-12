# 🚀 Guide d'installation sur Red Hat Enterprise Linux

Ce guide vous accompagne étape par étape pour installer les deux applications sur un serveur Red Hat en utilisant Docker Compose.

## 📋 Prérequis

- Serveur Red Hat Enterprise Linux (RHEL) 7/8/9 ou CentOS 7/8
- Accès root ou utilisateur avec privilèges sudo
- Connexion Internet active
- Au moins 4 Go de RAM recommandés
- Au moins 20 Go d'espace disque libre

---

## ÉTAPE 1 : Mise à jour du système

```bash
# Se connecter au serveur en tant que root ou avec sudo
sudo su -

# Mettre à jour le système
yum update -y

# Installer les outils de base
yum install -y wget curl git vim
```

---

## ÉTAPE 2 : Installation de Docker

### 2.1 Installer les dépendances

```bash
yum install -y yum-utils device-mapper-persistent-data lvm2
```

### 2.2 Ajouter le dépôt Docker

```bash
# Pour RHEL 8/9 ou CentOS 8
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Pour RHEL 7 ou CentOS 7
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

### 2.3 Installer Docker Engine

```bash
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.4 Démarrer et activer Docker

```bash
# Démarrer le service Docker
systemctl start docker

# Activer Docker au démarrage
systemctl enable docker

# Vérifier l'installation
docker --version
docker compose version
```

### 2.5 Configurer Docker (optionnel mais recommandé)

```bash
# Créer le fichier de configuration
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Redémarrer Docker
systemctl restart docker
```

---

## ÉTAPE 3 : Installation de Docker Compose (si pas déjà installé)

Si Docker Compose n'est pas installé avec Docker :

```bash
# Télécharger Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Rendre exécutable
chmod +x /usr/local/bin/docker-compose

# Créer un lien symbolique
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Vérifier
docker-compose --version
```

---

## ÉTAPE 4 : Préparer la structure des dossiers

```bash
# Créer le répertoire de travail
mkdir -p /opt/applications
cd /opt/applications

# Créer la structure pour les deux applications
mkdir -p apps/api apps/web
mkdir -p apps2/api apps2/web
```

---

## ÉTAPE 5 : Transférer les fichiers de l'application 1

### 5.1 Option A : Via Git (si votre code est sur Git)

```bash
cd /opt/applications

# Cloner votre repository
git clone https://github.com/boujelbanemohamed/gestion_processus.git .

# Ou si vous avez déjà le code localement, utilisez SCP depuis votre PC
```

### 5.2 Option B : Via SCP depuis votre PC local

Depuis votre PC (Mac/Linux) :

```bash
# Transférer l'application 1
scp -r /Users/mohamed/apps/* root@VOTRE_SERVEUR_IP:/opt/applications/apps/

# Transférer les fichiers Docker
scp /Users/mohamed/docker-compose.yml root@VOTRE_SERVEUR_IP:/opt/applications/
scp /Users/mohamed/deploy.sh root@VOTRE_SERVEUR_IP:/opt/applications/
```

### 5.3 Option B : Via WinSCP (depuis Windows)

1. Téléchargez et installez WinSCP
2. Connectez-vous au serveur
3. Transférez les dossiers `apps/` vers `/opt/applications/apps/`
4. Transférez `docker-compose.yml` et `deploy.sh` vers `/opt/applications/`

---

## ÉTAPE 6 : Transférer les fichiers de l'application 2

```bash
# Depuis votre PC, transférez votre deuxième application
# Remplacez /chemin/vers/app2 par le chemin réel de votre application 2

# Via SCP (depuis Mac/Linux)
scp -r /chemin/vers/app2/* root@VOTRE_SERVEUR_IP:/opt/applications/apps2/

# Ou créez un archive et transférez-le
cd /chemin/vers/app2
tar -czf app2.tar.gz .
scp app2.tar.gz root@VOTRE_SERVEUR_IP:/opt/applications/
```

Sur le serveur :

```bash
cd /opt/applications
tar -xzf app2.tar.gz -C apps2/
rm app2.tar.gz
```

---

## ÉTAPE 7 : Copier les Dockerfiles pour l'application 2

```bash
cd /opt/applications

# Copier les Dockerfiles de l'app 1 vers l'app 2
cp apps/api/Dockerfile apps2/api/Dockerfile
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf
```

---

## ÉTAPE 8 : Configurer les variables d'environnement

### 8.1 Application 1 - Backend

```bash
cd /opt/applications/apps/api

# Créer le fichier .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public
JWT_SECRET=changez-ce-secret-en-production
JWT_REFRESH_SECRET=changez-ce-refresh-secret-en-production
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=production
EOF

# Sécuriser le fichier
chmod 600 .env
```

### 8.2 Application 1 - Frontend

```bash
cd /opt/applications/apps/web

# Créer le fichier .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4000/api/v1
EOF
```

### 8.3 Application 2 - Backend

```bash
cd /opt/applications/apps2/api

# Créer le fichier .env (adaptez selon votre application)
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=changez-ce-secret-app2-en-production
JWT_REFRESH_SECRET=changez-ce-refresh-secret-app2-en-production
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF

chmod 600 .env
```

### 8.4 Application 2 - Frontend

```bash
cd /opt/applications/apps2/web

# Créer le fichier .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4001/api/v1
EOF
```

---

## ÉTAPE 9 : Vérifier la structure

```bash
cd /opt/applications

# Vérifier que tous les fichiers sont présents
tree -L 3 -d
# Ou si tree n'est pas installé:
find . -type d -maxdepth 3 | sort

# Vérifier les Dockerfiles
ls -la apps/api/Dockerfile
ls -la apps/web/Dockerfile
ls -la apps2/api/Dockerfile
ls -la apps2/web/Dockerfile

# Vérifier docker-compose.yml
ls -la docker-compose.yml
```

---

## ÉTAPE 10 : Configurer les permissions

```bash
cd /opt/applications

# Rendre le script de déploiement exécutable
chmod +x deploy.sh

# Créer les dossiers pour les uploads
mkdir -p apps/api/uploads apps2/api/uploads
chmod 755 apps/api/uploads apps2/api/uploads
```

---

## ÉTAPE 11 : Ouvrir les ports dans le firewall

```bash
# Vérifier si firewalld est actif
systemctl status firewalld

# Si actif, ouvrir les ports nécessaires
firewall-cmd --permanent --add-port=4000/tcp
firewall-cmd --permanent --add-port=4001/tcp
firewall-cmd --permanent --add-port=5173/tcp
firewall-cmd --permanent --add-port=5174/tcp
firewall-cmd --permanent --add-port=5432/tcp
firewall-cmd --permanent --add-port=5433/tcp

# Recharger le firewall
firewall-cmd --reload

# Vérifier les ports ouverts
firewall-cmd --list-ports
```

---

## ÉTAPE 12 : Construire les images Docker

```bash
cd /opt/applications

# Construire toutes les images (cela peut prendre plusieurs minutes)
docker-compose build

# Vérifier que les images sont créées
docker images
```

**Note** : Si vous rencontrez des erreurs de build, vérifiez les logs :
```bash
docker-compose build --no-cache 2>&1 | tee build.log
```

---

## ÉTAPE 13 : Démarrer les services

```bash
cd /opt/applications

# Démarrer tous les services en arrière-plan
docker-compose up -d

# Vérifier l'état des services
docker-compose ps

# Voir les logs
docker-compose logs -f
```

---

## ÉTAPE 14 : Initialiser les bases de données

```bash
cd /opt/applications

# Attendre que PostgreSQL soit prêt (environ 10-15 secondes)
sleep 15

# Initialiser la base de données de l'application 1
docker-compose exec api-app1 npx prisma generate
docker-compose exec api-app1 npx prisma migrate deploy

# Si vous avez un script seed pour l'app 1
docker-compose exec api-app1 npm run seed

# Initialiser la base de données de l'application 2
docker-compose exec api-app2 npx prisma generate
docker-compose exec api-app2 npx prisma migrate deploy

# Si vous avez un script seed pour l'app 2
docker-compose exec api-app2 npm run seed
```

---

## ÉTAPE 15 : Vérifier que tout fonctionne

### 15.1 Vérifier les conteneurs

```bash
# Voir tous les conteneurs
docker ps

# Vérifier les logs d'un service spécifique
docker-compose logs api-app1
docker-compose logs web-app1
```

### 15.2 Tester les endpoints

```bash
# Tester l'API de l'application 1
curl http://localhost:4000/api/v1/health

# Tester l'API de l'application 2
curl http://localhost:4001/api/v1/health

# Tester depuis l'extérieur (remplacez par l'IP de votre serveur)
curl http://VOTRE_IP_SERVEUR:4000/api/v1/health
```

### 15.3 Accéder aux applications

- **Application 1** : http://VOTRE_IP_SERVEUR:5173
- **Application 2** : http://VOTRE_IP_SERVEUR:5174

---

## ÉTAPE 16 : Configurer le démarrage automatique (optionnel)

### 16.1 Créer un service systemd

```bash
cat > /etc/systemd/system/docker-apps.service << 'EOF'
[Unit]
Description=Docker Compose Applications
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/applications
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Recharger systemd
systemctl daemon-reload

# Activer le service
systemctl enable docker-apps.service

# Démarrer le service
systemctl start docker-apps.service
```

---

## ÉTAPE 17 : Configuration de la production (recommandé)

### 17.1 Utiliser un reverse proxy Nginx

```bash
# Installer Nginx
yum install -y nginx

# Créer la configuration
cat > /etc/nginx/conf.d/applications.conf << 'EOF'
# Application 1
server {
    listen 80;
    server_name app1.votredomaine.com;  # Remplacez par votre domaine
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Application 2
server {
    listen 80;
    server_name app2.votredomaine.com;  # Remplacez par votre domaine
    
    location / {
        proxy_pass http://localhost:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Démarrer Nginx
systemctl start nginx
systemctl enable nginx

# Ouvrir le port 80
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

### 17.2 Configurer SSL avec Let's Encrypt (optionnel)

```bash
# Installer certbot
yum install -y certbot python3-certbot-nginx

# Obtenir un certificat SSL
certbot --nginx -d app1.votredomaine.com -d app2.votredomaine.com

# Le renouvellement automatique est configuré par défaut
```

---

## Commandes utiles

### Gestion des services

```bash
cd /opt/applications

# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Voir les logs
docker-compose logs -f

# Voir les logs d'un service
docker-compose logs -f api-app1
```

### Sauvegardes

```bash
cd /opt/applications

# Sauvegarder les bases de données
./deploy.sh backup

# Les sauvegardes sont dans ./backups/
```

### Mise à jour

```bash
cd /opt/applications

# Arrêter
docker-compose down

# Mettre à jour le code (git pull, etc.)

# Rebuild
docker-compose build --no-cache

# Redémarrer
docker-compose up -d

# Réinitialiser les bases de données si nécessaire
docker-compose exec api-app1 npx prisma migrate deploy
```

---

## Dépannage

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs
docker-compose logs

# Vérifier l'état
docker-compose ps

# Vérifier les ports
netstat -tulpn | grep -E '4000|4001|5173|5174'
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps postgres-app1
docker-compose ps postgres-app2

# Vérifier les logs PostgreSQL
docker-compose logs postgres-app1

# Tester la connexion
docker-compose exec postgres-app1 psql -U postgres -d cursor_process
```

### Problèmes de permissions

```bash
# Vérifier les permissions des fichiers
ls -la /opt/applications

# Corriger les permissions si nécessaire
chown -R root:root /opt/applications
chmod +x /opt/applications/deploy.sh
```

---

## ✅ Checklist finale

- [ ] Docker installé et fonctionnel
- [ ] Docker Compose installé
- [ ] Fichiers de l'application 1 transférés
- [ ] Fichiers de l'application 2 transférés
- [ ] Dockerfiles copiés pour l'app 2
- [ ] Variables d'environnement configurées
- [ ] Ports firewall ouverts
- [ ] Images Docker construites
- [ ] Services démarrés
- [ ] Bases de données initialisées
- [ ] Applications accessibles
- [ ] Démarrage automatique configuré (optionnel)
- [ ] Reverse proxy configuré (optionnel)

---

## 📞 Support

En cas de problème, consultez les logs :
```bash
docker-compose logs -f
journalctl -u docker-apps -f  # Si service systemd configuré
```

