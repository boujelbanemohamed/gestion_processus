# 🚀 Guide de déploiement Red Hat - Étape par étape

Ce guide vous accompagne pas à pas pour déployer vos deux applications sur un serveur Red Hat Enterprise Linux.

---

## 📋 PRÉREQUIS

- Serveur Red Hat Enterprise Linux (RHEL) 7/8/9 ou CentOS 7/8
- Accès root ou utilisateur avec privilèges sudo
- Connexion Internet active
- Au moins 4 Go de RAM
- Au moins 20 Go d'espace disque libre
- Vos fichiers d'application prêts à transférer

---

## ÉTAPE 1 : Se connecter au serveur Red Hat

```bash
# Depuis votre PC, connectez-vous au serveur
ssh root@VOTRE_IP_SERVEUR

# Ou si vous utilisez un utilisateur avec sudo
ssh utilisateur@VOTRE_IP_SERVEUR
sudo su -
```

**✅ Vérification** : Vous devez voir le prompt du serveur Red Hat.

---

## ÉTAPE 2 : Mettre à jour le système

```bash
# Mettre à jour tous les packages
yum update -y

# Installer les outils de base nécessaires
yum install -y wget curl git vim
```

**✅ Vérification** : Aucune erreur dans la sortie.

---

## ÉTAPE 3 : Installer Docker

### 3.1 Installer les dépendances

```bash
yum install -y yum-utils device-mapper-persistent-data lvm2
```

### 3.2 Ajouter le dépôt Docker

```bash
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

### 3.3 Installer Docker Engine

```bash
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3.4 Démarrer Docker

```bash
# Démarrer le service Docker
systemctl start docker

# Activer Docker au démarrage
systemctl enable docker

# Vérifier que Docker fonctionne
docker --version
```

**✅ Vérification** : Vous devez voir la version de Docker (ex: `Docker version 24.x.x`).

### 3.5 Vérifier Docker Compose

```bash
docker compose version
```

**✅ Vérification** : Vous devez voir la version de Docker Compose.

**⚠️ Si Docker Compose n'est pas installé**, exécutez :

```bash
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
docker-compose --version
```

---

## ÉTAPE 4 : Configurer Docker

```bash
# Créer le répertoire de configuration
mkdir -p /etc/docker

# Créer le fichier de configuration
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Redémarrer Docker pour appliquer la configuration
systemctl restart docker

# Vérifier que Docker fonctionne toujours
docker ps
```

**✅ Vérification** : La commande `docker ps` doit s'exécuter sans erreur.

---

## ÉTAPE 5 : Créer la structure des dossiers

```bash
# Créer le répertoire principal
mkdir -p /opt/applications

# Créer la structure pour les deux applications
mkdir -p /opt/applications/apps/api
mkdir -p /opt/applications/apps/web
mkdir -p /opt/applications/apps2/api
mkdir -p /opt/applications/apps2/web
mkdir -p /opt/applications/backups

# Vérifier la structure
ls -la /opt/applications/
```

**✅ Vérification** : Vous devez voir les dossiers `apps/` et `apps2/`.

---

## ÉTAPE 6 : Transférer les fichiers depuis votre PC

### 6.1 Depuis votre PC (Mac/Linux)

Ouvrez un **nouveau terminal** sur votre PC et exécutez :

```bash
# Remplacez VOTRE_IP_SERVEUR par l'IP de votre serveur Red Hat

# Transférer l'application 1
scp -r /Users/mohamed/apps/* root@VOTRE_IP_SERVEUR:/opt/applications/apps/

# Transférer les fichiers Docker
scp /Users/mohamed/apps/docker-compose.yml root@VOTRE_IP_SERVEUR:/opt/applications/
scp /Users/mohamed/apps/deploy.sh root@VOTRE_IP_SERVEUR:/opt/applications/

# Transférer l'application 2 (remplacez le chemin par votre chemin réel)
scp -r /chemin/vers/votre/app2/* root@VOTRE_IP_SERVEUR:/opt/applications/apps2/
```

### 6.2 Depuis Windows (avec WinSCP)

1. Téléchargez et installez **WinSCP**
2. Connectez-vous au serveur avec vos identifiants
3. Naviguez vers `/opt/applications/`
4. Transférez :
   - Le dossier `apps/` complet
   - Le fichier `docker-compose.yml`
   - Le fichier `deploy.sh`
   - Le dossier de votre application 2 vers `apps2/`

### 6.3 Vérifier sur le serveur

Revenez sur le serveur et vérifiez :

```bash
cd /opt/applications

# Vérifier que les fichiers sont présents
ls -la
ls -la apps/
ls -la apps2/

# Vérifier docker-compose.yml
cat docker-compose.yml | head -20
```

**✅ Vérification** : Vous devez voir `docker-compose.yml`, `deploy.sh`, et les dossiers `apps/` et `apps2/`.

---

## ÉTAPE 7 : Copier les Dockerfiles pour l'application 2

```bash
cd /opt/applications

# Copier les Dockerfiles de l'app 1 vers l'app 2
cp apps/api/Dockerfile apps2/api/Dockerfile
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf

# Vérifier
ls -la apps2/api/Dockerfile
ls -la apps2/web/Dockerfile
ls -la apps2/web/nginx.conf
```

**✅ Vérification** : Les trois fichiers doivent exister dans `apps2/`.

---

## ÉTAPE 8 : Configurer les variables d'environnement

### 8.1 Application 1 - Backend

```bash
cd /opt/applications/apps/api

# Créer le fichier .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public
JWT_SECRET=changez-ce-secret-en-production-avec-une-valeur-securisee
JWT_REFRESH_SECRET=changez-ce-refresh-secret-en-production-avec-une-valeur-securisee
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=production
EOF

# Sécuriser le fichier
chmod 600 .env

# Vérifier
cat .env
```

**✅ Vérification** : Le fichier `.env` doit contenir les variables.

### 8.2 Application 1 - Frontend

```bash
cd /opt/applications/apps/web

# Créer le fichier .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4000/api/v1
EOF

# Vérifier
cat .env.production
```

**✅ Vérification** : Le fichier doit contenir `VITE_API_URL=http://localhost:4000/api/v1`.

### 8.3 Application 2 - Backend

```bash
cd /opt/applications/apps2/api

# Créer le fichier .env (adaptez selon votre application 2)
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=changez-ce-secret-app2-en-production-avec-une-valeur-securisee
JWT_REFRESH_SECRET=changez-ce-refresh-secret-app2-en-production-avec-une-valeur-securisee
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF

chmod 600 .env

# Vérifier
cat .env
```

**✅ Vérification** : Le fichier `.env` doit contenir les variables pour l'app 2.

### 8.4 Application 2 - Frontend

```bash
cd /opt/applications/apps2/web

# Créer le fichier .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://localhost:4001/api/v1
EOF

# Vérifier
cat .env.production
```

**✅ Vérification** : Le fichier doit contenir `VITE_API_URL=http://localhost:4001/api/v1`.

---

## ÉTAPE 9 : Configurer les permissions

```bash
cd /opt/applications

# Rendre le script de déploiement exécutable
chmod +x deploy.sh

# Créer les dossiers pour les uploads
mkdir -p apps/api/uploads apps2/api/uploads
chmod 755 apps/api/uploads apps2/api/uploads

# Vérifier
ls -la deploy.sh
ls -la apps/api/uploads
```

**✅ Vérification** : `deploy.sh` doit être exécutable (permissions `-rwxr-xr-x`).

---

## ÉTAPE 10 : Configurer le firewall

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

**✅ Vérification** : Vous devez voir les ports 4000, 4001, 5173, 5174, 5432, 5433 dans la liste.

**⚠️ Si firewalld n'est pas actif**, vous pouvez l'activer :

```bash
systemctl start firewalld
systemctl enable firewalld
# Puis répétez les commandes ci-dessus
```

---

## ÉTAPE 11 : Construire les images Docker

```bash
cd /opt/applications

# Construire toutes les images (cela peut prendre 5-10 minutes)
docker-compose build

# OU avec docker compose (nouvelle syntaxe)
docker compose build
```

**⏱️ Temps estimé** : 5-10 minutes selon la vitesse de votre connexion.

**✅ Vérification** : À la fin, vous devez voir `Successfully built` pour chaque image.

**⚠️ En cas d'erreur**, vérifiez les logs :

```bash
docker-compose build 2>&1 | tee build.log
cat build.log
```

---

## ÉTAPE 12 : Vérifier que les images sont créées

```bash
# Lister toutes les images Docker
docker images

# Vous devriez voir des images comme :
# - gestion-processus-api-app1
# - gestion-processus-web-app1
# - gestion-processus-api-app2
# - gestion-processus-web-app2
# - postgres:16-alpine (x2)
```

**✅ Vérification** : Vous devez voir au moins 6 images.

---

## ÉTAPE 13 : Démarrer les services

```bash
cd /opt/applications

# Démarrer tous les services en arrière-plan
docker-compose up -d

# OU avec la nouvelle syntaxe
docker compose up -d
```

**✅ Vérification** : Vous devez voir des messages comme `Creating...` puis `Created` et `Started`.

---

## ÉTAPE 14 : Vérifier l'état des services

```bash
cd /opt/applications

# Voir l'état de tous les services
docker-compose ps

# Vous devriez voir tous les services avec le statut "Up"
```

**✅ Vérification** : Tous les services doivent avoir le statut `Up` (ou `Up (healthy)` pour PostgreSQL).

**⚠️ Si un service est `Exit` ou `Restarting`**, consultez les logs :

```bash
docker-compose logs nom-du-service
# Exemple : docker-compose logs api-app1
```

---

## ÉTAPE 15 : Attendre que PostgreSQL soit prêt

```bash
# Attendre 15-20 secondes que PostgreSQL démarre complètement
sleep 20

# Vérifier que PostgreSQL est prêt
docker-compose exec postgres-app1 pg_isready -U postgres
docker-compose exec postgres-app2 pg_isready -U postgres
```

**✅ Vérification** : Vous devez voir `postgres-app1:5432 - accepting connections` pour les deux bases.

---

## ÉTAPE 16 : Initialiser les bases de données

### 16.1 Application 1

```bash
cd /opt/applications

# Générer le client Prisma
docker-compose exec api-app1 npx prisma generate

# Appliquer les migrations
docker-compose exec api-app1 npx prisma migrate deploy

# Si vous avez un script seed (optionnel)
docker-compose exec api-app1 npm run seed
```

**✅ Vérification** : Vous devez voir `Applied migration` ou `No pending migrations`.

### 16.2 Application 2

```bash
# Générer le client Prisma
docker-compose exec api-app2 npx prisma generate

# Appliquer les migrations
docker-compose exec api-app2 npx prisma migrate deploy

# Si vous avez un script seed (optionnel)
docker-compose exec api-app2 npm run seed
```

**✅ Vérification** : Vous devez voir `Applied migration` ou `No pending migrations`.

---

## ÉTAPE 17 : Vérifier que tout fonctionne

### 17.1 Vérifier les conteneurs

```bash
# Voir tous les conteneurs en cours d'exécution
docker ps

# Vous devriez voir 6 conteneurs :
# - postgres-app1
# - postgres-app2
# - api-app1
# - api-app2
# - web-app1
# - web-app2
```

**✅ Vérification** : Tous les 6 conteneurs doivent être en cours d'exécution.

### 17.2 Tester les APIs

```bash
# Tester l'API de l'application 1
curl http://localhost:4000/api/v1/health

# Tester l'API de l'application 2
curl http://localhost:4001/api/v1/health
```

**✅ Vérification** : Vous devez recevoir une réponse JSON avec `{"status":"ok"}` ou similaire.

### 17.3 Vérifier les logs

```bash
# Voir les logs de tous les services
docker-compose logs --tail=50

# Voir les logs d'un service spécifique
docker-compose logs api-app1
docker-compose logs web-app1
```

**✅ Vérification** : Aucune erreur critique dans les logs.

---

## ÉTAPE 18 : Accéder aux applications

### 18.1 Depuis le serveur

```bash
# Tester depuis le serveur
curl http://localhost:5173
curl http://localhost:5174
```

### 18.2 Depuis votre navigateur

Ouvrez votre navigateur et accédez à :

- **Application 1** : `http://VOTRE_IP_SERVEUR:5173`
- **Application 2** : `http://VOTRE_IP_SERVEUR:5174`

**✅ Vérification** : Les applications doivent se charger dans votre navigateur.

**⚠️ Si vous ne pouvez pas accéder**, vérifiez :

1. Le firewall (étape 10)
2. Que les ports sont bien ouverts : `netstat -tulpn | grep -E '5173|5174'`
3. Les logs : `docker-compose logs web-app1`

---

## ÉTAPE 19 : Configurer le démarrage automatique (optionnel mais recommandé)

```bash
# Créer un service systemd
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

# Vérifier
systemctl status docker-apps.service
```

**✅ Vérification** : Le service doit être `enabled` et `active`.

---

## ÉTAPE 20 : Test final

### 20.1 Redémarrer le serveur (test)

```bash
# Redémarrer le serveur
reboot
```

**⏱️ Attendre** : 2-3 minutes que le serveur redémarre.

### 20.2 Vérifier après redémarrage

```bash
# Se reconnecter
ssh root@VOTRE_IP_SERVEUR

# Vérifier que les services sont démarrés
docker-compose ps

# Tester les APIs
curl http://localhost:4000/api/v1/health
curl http://localhost:4001/api/v1/health
```

**✅ Vérification** : Tous les services doivent être `Up` automatiquement.

---

## 📋 Checklist finale

Cochez chaque étape au fur et à mesure :

- [ ] Étape 1 : Connecté au serveur
- [ ] Étape 2 : Système mis à jour
- [ ] Étape 3 : Docker installé
- [ ] Étape 4 : Docker configuré
- [ ] Étape 5 : Structure créée
- [ ] Étape 6 : Fichiers transférés
- [ ] Étape 7 : Dockerfiles copiés
- [ ] Étape 8 : Variables d'environnement configurées
- [ ] Étape 9 : Permissions configurées
- [ ] Étape 10 : Firewall configuré
- [ ] Étape 11 : Images construites
- [ ] Étape 12 : Images vérifiées
- [ ] Étape 13 : Services démarrés
- [ ] Étape 14 : État vérifié
- [ ] Étape 15 : PostgreSQL prêt
- [ ] Étape 16 : Bases de données initialisées
- [ ] Étape 17 : Fonctionnement vérifié
- [ ] Étape 18 : Applications accessibles
- [ ] Étape 19 : Démarrage automatique configuré
- [ ] Étape 20 : Test après redémarrage réussi

---

## 🆘 Dépannage rapide

### Les conteneurs ne démarrent pas

```bash
# Voir les logs
docker-compose logs

# Redémarrer un service
docker-compose restart api-app1

# Rebuild complet
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps postgres-app1

# Vérifier les logs PostgreSQL
docker-compose logs postgres-app1

# Tester la connexion
docker-compose exec postgres-app1 psql -U postgres -d cursor_process
```

### Ports déjà utilisés

```bash
# Vérifier les ports
netstat -tulpn | grep -E '4000|4001|5173|5174'

# Arrêter les processus qui utilisent ces ports
# (identifiez le PID et utilisez kill)
```

### Les applications ne sont pas accessibles

```bash
# Vérifier le firewall
firewall-cmd --list-ports

# Vérifier que les conteneurs écoutent
docker-compose ps
docker-compose logs web-app1
```

---

## ✅ Félicitations !

Vos deux applications sont maintenant déployées et fonctionnelles sur Red Hat !

**URLs d'accès** :
- Application 1 : `http://VOTRE_IP:5173`
- Application 2 : `http://VOTRE_IP:5174`

**Commandes utiles** :
```bash
cd /opt/applications
./deploy.sh start      # Démarrer
./deploy.sh stop       # Arrêter
./deploy.sh logs       # Voir les logs
./deploy.sh backup     # Sauvegarder
```

