# ➕ Guide : Ajouter l'Application 2 après avoir déployé l'Application 1

Ce guide vous explique comment ajouter l'application 2 lorsque l'application 1 est déjà déployée et fonctionnelle.

---

## 📋 Prérequis

- ✅ Application 1 déjà déployée et fonctionnelle
- ✅ Docker et Docker Compose installés
- ✅ Fichiers de l'application 2 prêts à transférer

---

## 🔍 ÉTAPE 1 : Vérifier l'état actuel

```bash
cd /opt/applications

# Vérifier que l'app 1 fonctionne
docker-compose ps

# Tester l'API
curl http://localhost:4000/api/v1/health
```

**✅ Vérification** : L'application 1 doit être `Up` et répondre correctement.

---

## 📁 ÉTAPE 2 : Préparer la structure pour l'app 2

```bash
cd /opt/applications

# Créer les dossiers pour l'app 2
mkdir -p apps2/api
mkdir -p apps2/web
mkdir -p apps2/api/uploads

# Vérifier
ls -la apps2/
```

**✅ Vérification** : Les dossiers `apps2/api/` et `apps2/web/` doivent exister.

---

## 📤 ÉTAPE 3 : Transférer l'application 2

**Depuis votre PC** :

```bash
# Transférer l'application 2
scp -r /chemin/vers/votre/app2/* root@VOTRE_IP_SERVEUR:/opt/applications/apps2/

# Vérifier sur le serveur
ssh root@VOTRE_IP_SERVEUR
cd /opt/applications/apps2
ls -la
```

**✅ Vérification** : Vous devez voir les fichiers de votre application 2 (package.json, src/, etc.).

---

## 📋 ÉTAPE 4 : Copier les Dockerfiles

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

**✅ Vérification** : Les trois fichiers doivent exister.

---

## ⚙️ ÉTAPE 5 : Configurer les variables d'environnement de l'app 2

### 5.1 Backend

```bash
cd /opt/applications/apps2/api

# Créer le fichier .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=changez-ce-secret-app2-en-production
JWT_REFRESH_SECRET=changez-ce-refresh-secret-app2-en-production
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF

chmod 600 .env

# Vérifier
cat .env
```

**✅ Vérification** : Le fichier `.env` doit contenir les variables avec le port 4001.

### 5.2 Frontend

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

## 🔄 ÉTAPE 6 : Remplacer docker-compose.yml

### Option A : Transférer le nouveau fichier depuis votre PC

```bash
# Depuis votre PC
scp /Users/mohamed/apps/docker-compose.yml root@VOTRE_IP_SERVEUR:/opt/applications/
```

### Option B : Modifier le fichier existant

```bash
cd /opt/applications

# Sauvegarder l'ancien fichier
cp docker-compose.yml docker-compose-app1-only.yml.backup

# Éditer le fichier pour ajouter les services de l'app 2
# (Ou utilisez le fichier complet que vous avez transféré)
```

**✅ Vérification** : Le nouveau `docker-compose.yml` doit contenir les services pour les deux applications.

---

## 🔥 ÉTAPE 7 : Ouvrir les ports du firewall pour l'app 2

```bash
# Ouvrir les nouveaux ports
firewall-cmd --permanent --add-port=4001/tcp
firewall-cmd --permanent --add-port=5174/tcp
firewall-cmd --permanent --add-port=5433/tcp

# Recharger le firewall
firewall-cmd --reload

# Vérifier
firewall-cmd --list-ports
```

**✅ Vérification** : Vous devez voir les ports 4001, 5174, 5433 dans la liste.

---

## 🛑 ÉTAPE 8 : Arrêter temporairement l'app 1

```bash
cd /opt/applications

# Arrêter les services actuels (l'app 1 sera redémarrée avec l'app 2)
docker-compose down
```

**⚠️ Note** : Les données sont conservées dans les volumes Docker, aucune perte de données.

**✅ Vérification** : `docker ps` ne doit plus montrer les conteneurs de l'app 1.

---

## 🔨 ÉTAPE 9 : Construire les images de l'app 2

```bash
cd /opt/applications

# Construire uniquement les images de l'app 2 (plus rapide)
docker-compose build api-app2 web-app2 postgres-app2

# OU construire toutes les images (recommandé pour être sûr)
docker-compose build
```

**⏱️ Temps estimé** : 3-5 minutes pour l'app 2 seule, 5-10 minutes pour tout rebuild.

**✅ Vérification** : Vous devez voir `Successfully built` pour les images de l'app 2.

---

## 🚀 ÉTAPE 10 : Démarrer tous les services

```bash
cd /opt/applications

# Démarrer toutes les applications (app 1 + app 2)
docker-compose up -d

# Vérifier l'état
docker-compose ps
```

**✅ Vérification** : Vous devez voir 6 conteneurs avec le statut `Up` :
- postgres-app1
- postgres-app2
- api-app1
- api-app2
- web-app1
- web-app2

---

## ⏳ ÉTAPE 11 : Attendre que PostgreSQL soit prêt

```bash
# Attendre 15-20 secondes
sleep 20

# Vérifier que les deux bases de données sont prêtes
docker-compose exec postgres-app1 pg_isready -U postgres
docker-compose exec postgres-app2 pg_isready -U postgres
```

**✅ Vérification** : Les deux doivent répondre `accepting connections`.

---

## 🗄️ ÉTAPE 12 : Initialiser la base de données de l'app 2

```bash
cd /opt/applications

# Générer le client Prisma
docker-compose exec api-app2 npx prisma generate

# Appliquer les migrations
docker-compose exec api-app2 npx prisma migrate deploy

# Si vous avez un script seed
docker-compose exec api-app2 npm run seed
```

**✅ Vérification** : Vous devez voir `Applied migration` ou `No pending migrations`.

---

## ✅ ÉTAPE 13 : Vérifier que tout fonctionne

### 13.1 Vérifier les conteneurs

```bash
docker-compose ps
```

**✅ Vérification** : Tous les 6 conteneurs doivent être `Up`.

### 13.2 Tester les APIs

```bash
# API de l'app 1
curl http://localhost:4000/api/v1/health

# API de l'app 2
curl http://localhost:4001/api/v1/health
```

**✅ Vérification** : Les deux doivent répondre avec un JSON de statut.

### 13.3 Vérifier les logs

```bash
# Logs de l'app 1
docker-compose logs api-app1 --tail=20

# Logs de l'app 2
docker-compose logs api-app2 --tail=20
```

**✅ Vérification** : Aucune erreur critique dans les logs.

---

## 🌐 ÉTAPE 14 : Accéder aux applications

Ouvrez votre navigateur et accédez à :

- **Application 1** : `http://VOTRE_IP_SERVEUR:5173`
- **Application 2** : `http://VOTRE_IP_SERVEUR:5174`

**✅ Vérification** : Les deux applications doivent se charger correctement.

---

## 📋 Checklist d'ajout de l'app 2

- [ ] Étape 1 : Vérifié l'état de l'app 1
- [ ] Étape 2 : Créé la structure apps2/
- [ ] Étape 3 : Transféré les fichiers de l'app 2
- [ ] Étape 4 : Copié les Dockerfiles
- [ ] Étape 5 : Configuré les variables d'environnement
- [ ] Étape 6 : Remplacé docker-compose.yml
- [ ] Étape 7 : Ouvert les ports firewall
- [ ] Étape 8 : Arrêté temporairement l'app 1
- [ ] Étape 9 : Construit les images de l'app 2
- [ ] Étape 10 : Démarré tous les services
- [ ] Étape 11 : Attendu que PostgreSQL soit prêt
- [ ] Étape 12 : Initialisé la base de données de l'app 2
- [ ] Étape 13 : Vérifié que tout fonctionne
- [ ] Étape 14 : Accédé aux deux applications

---

## 🔄 Revenir à l'app 1 seule (si nécessaire)

Si vous devez revenir à l'app 1 seule :

```bash
cd /opt/applications

# Arrêter tous les services
docker-compose down

# Restaurer l'ancien docker-compose.yml
cp docker-compose-app1-only.yml.backup docker-compose.yml

# Redémarrer uniquement l'app 1
docker-compose up -d

# Vérifier
docker-compose ps
```

**✅ Vérification** : Seulement 3 conteneurs doivent être `Up` (postgres-app1, api-app1, web-app1).

---

## 🆘 Dépannage

### L'app 2 ne démarre pas

```bash
# Voir les logs
docker-compose logs api-app2
docker-compose logs web-app2

# Vérifier les erreurs de build
docker-compose build api-app2 2>&1 | tee build-app2.log
```

### Erreur de connexion à la base de données de l'app 2

```bash
# Vérifier que PostgreSQL de l'app 2 est démarré
docker-compose ps postgres-app2

# Vérifier les logs
docker-compose logs postgres-app2

# Tester la connexion
docker-compose exec postgres-app2 psql -U postgres -d app2_db
```

### L'app 1 ne fonctionne plus après l'ajout de l'app 2

```bash
# Vérifier les logs de l'app 1
docker-compose logs api-app1

# Redémarrer uniquement l'app 1
docker-compose restart api-app1 web-app1
```

---

## ✅ Félicitations !

Vous avez maintenant les deux applications déployées côte à côte :

- **Application 1** : `http://VOTRE_IP:5173` (API: `http://VOTRE_IP:4000`)
- **Application 2** : `http://VOTRE_IP:5174` (API: `http://VOTRE_IP:4001`)

Les deux applications fonctionnent indépendamment et peuvent être gérées séparément si nécessaire.

