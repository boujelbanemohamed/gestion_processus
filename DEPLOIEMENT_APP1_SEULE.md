# 🚀 Déploiement de l'Application 1 seule sur Red Hat

Ce guide vous permet de déployer uniquement l'application 1 (Gestion des processus) maintenant, et d'ajouter l'application 2 plus tard.

---

## 📋 Étapes pour déployer l'Application 1 seule

### ÉTAPE 1 : Se connecter au serveur

```bash
ssh root@VOTRE_IP_SERVEUR
```

### ÉTAPE 2 : Installer Docker (si pas déjà fait)

```bash
# Mettre à jour
yum update -y

# Installer les dépendances
yum install -y yum-utils device-mapper-persistent-data lvm2

# Ajouter le dépôt Docker
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Installer Docker
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Démarrer Docker
systemctl start docker
systemctl enable docker

# Vérifier
docker --version
```

### ÉTAPE 3 : Créer la structure

```bash
mkdir -p /opt/applications/apps/api
mkdir -p /opt/applications/apps/web
mkdir -p /opt/applications/backups
```

### ÉTAPE 4 : Transférer les fichiers

**Depuis votre PC** :

```bash
# Transférer l'application 1
scp -r /Users/mohamed/apps/* root@VOTRE_IP_SERVEUR:/opt/applications/apps/

# Transférer le docker-compose pour une seule app
scp /Users/mohamed/docker-compose-app1-only.yml root@VOTRE_IP_SERVEUR:/opt/applications/docker-compose.yml

# Transférer le script de déploiement
scp /Users/mohamed/apps/deploy.sh root@VOTRE_IP_SERVEUR:/opt/applications/
```

### ÉTAPE 5 : Configurer les variables d'environnement

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

chmod 600 .env
```

```bash
cd /opt/applications/apps/web

# Créer le fichier .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4000/api/v1
EOF
```

### ÉTAPE 6 : Configurer les permissions

```bash
cd /opt/applications
chmod +x deploy.sh
mkdir -p apps/api/uploads
chmod 755 apps/api/uploads
```

### ÉTAPE 7 : Configurer le firewall

```bash
firewall-cmd --permanent --add-port=4000/tcp
firewall-cmd --permanent --add-port=5173/tcp
firewall-cmd --permanent --add-port=5432/tcp
firewall-cmd --reload
```

### ÉTAPE 8 : Construire et démarrer

```bash
cd /opt/applications

# Construire les images
docker-compose build

# Démarrer les services
docker-compose up -d

# Vérifier
docker-compose ps
```

### ÉTAPE 9 : Initialiser la base de données

```bash
# Attendre que PostgreSQL soit prêt
sleep 20

# Initialiser
docker-compose exec api-app1 npx prisma generate
docker-compose exec api-app1 npx prisma migrate deploy

# Si vous avez un seed
docker-compose exec api-app1 npm run seed
```

### ÉTAPE 10 : Vérifier

```bash
# Tester l'API
curl http://localhost:4000/api/v1/health

# Voir les logs
docker-compose logs -f
```

**✅ Votre application 1 est maintenant accessible sur : `http://VOTRE_IP:5173`**

---

## 🔄 Ajouter l'Application 2 plus tard

Quand vous serez prêt à ajouter l'application 2, suivez ces étapes :

### ÉTAPE 1 : Préparer l'application 2

```bash
# Sur le serveur
cd /opt/applications
mkdir -p apps2/api apps2/web
```

**Depuis votre PC**, transférez l'application 2 :

```bash
scp -r /chemin/vers/app2/* root@VOTRE_IP_SERVEUR:/opt/applications/apps2/
```

### ÉTAPE 2 : Copier les Dockerfiles

```bash
cd /opt/applications
cp apps/api/Dockerfile apps2/api/Dockerfile
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf
```

### ÉTAPE 3 : Configurer l'application 2

```bash
# Backend
cd /opt/applications/apps2/api
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=changez-ce-secret-app2
JWT_REFRESH_SECRET=changez-ce-refresh-secret-app2
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF
chmod 600 .env

# Frontend
cd /opt/applications/apps2/web
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4001/api/v1
EOF
```

### ÉTAPE 4 : Remplacer docker-compose.yml

```bash
cd /opt/applications

# Sauvegarder l'ancien (optionnel)
cp docker-compose.yml docker-compose-app1-only.yml.backup

# Télécharger ou transférer le nouveau docker-compose.yml complet
# Depuis votre PC :
# scp /Users/mohamed/apps/docker-compose.yml root@VOTRE_IP:/opt/applications/
```

### ÉTAPE 5 : Ajouter les services de l'app 2

```bash
cd /opt/applications

# Arrêter les services actuels
docker-compose down

# Ouvrir le firewall pour les nouveaux ports
firewall-cmd --permanent --add-port=4001/tcp
firewall-cmd --permanent --add-port=5174/tcp
firewall-cmd --permanent --add-port=5433/tcp
firewall-cmd --reload

# Construire les nouvelles images
docker-compose build

# Démarrer tous les services (app 1 + app 2)
docker-compose up -d

# Vérifier
docker-compose ps
```

### ÉTAPE 6 : Initialiser la base de données de l'app 2

```bash
sleep 20

docker-compose exec api-app2 npx prisma generate
docker-compose exec api-app2 npx prisma migrate deploy
```

**✅ Les deux applications sont maintenant déployées !**

---

## 📝 Notes importantes

1. **Pas de perte de données** : Les données de l'application 1 sont conservées dans le volume Docker `postgres-app1-data`
2. **Pas d'interruption** : Vous pouvez ajouter l'app 2 sans affecter l'app 1
3. **Ports différents** : L'app 2 utilise des ports différents (4001, 5174, 5433)
4. **Réseaux isolés** : Chaque application a son propre réseau Docker

---

## 🆘 En cas de problème

### Revenir à l'app 1 seule

```bash
cd /opt/applications

# Restaurer l'ancien docker-compose.yml
cp docker-compose-app1-only.yml.backup docker-compose.yml

# Redémarrer
docker-compose down
docker-compose up -d
```

### Vérifier les services

```bash
docker-compose ps
docker-compose logs
```

