# Guide de démarrage rapide

## Installation rapide

### 1. Préparer l'application 2

```bash
# Créer la structure
mkdir -p apps2/api apps2/web

# Copier votre application 2 dans apps2/
# Votre structure doit ressembler à:
# apps2/
#   ├── api/          (backend Node.js)
#   │   ├── package.json
#   │   ├── src/
#   │   └── Dockerfile
#   └── web/          (frontend React)
#       ├── package.json
#       ├── src/
#       ├── Dockerfile
#       └── nginx.conf
```

### 2. Copier les Dockerfiles

```bash
# Pour l'API
cp apps/api/Dockerfile apps2/api/Dockerfile
# Adaptez le Dockerfile si votre structure est différente

# Pour le Web
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf
```

### 3. Configurer les variables d'environnement

```bash
# Créer le fichier .env pour l'application 2
cat > apps2/api/.env << EOF
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=your-secret-key-app2
JWT_REFRESH_SECRET=your-refresh-secret-app2
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF

# Configurer l'URL de l'API dans le frontend
cat > apps2/web/.env.production << EOF
VITE_API_URL=http://localhost:4001/api/v1
EOF
```

### 4. Démarrer les applications

```bash
# Construire et démarrer
./deploy.sh build
./deploy.sh start

# Initialiser les bases de données
./deploy.sh init-db

# Voir les logs
./deploy.sh logs
```

## Accès aux applications

- **Application 1** : http://localhost:5173
- **Application 2** : http://localhost:5174

## Commandes utiles

```bash
# Démarrer
./deploy.sh start

# Arrêter
./deploy.sh stop

# Voir les logs
./deploy.sh logs
./deploy.sh logs api-app1

# Sauvegarder les bases de données
./deploy.sh backup

# Nettoyer (supprime tout)
./deploy.sh clean
```

## Dépannage

### Port déjà utilisé
```bash
# Vérifier les ports
lsof -i :4000
lsof -i :4001
lsof -i :5173
lsof -i :5174

# Modifier les ports dans docker-compose.yml si nécessaire
```

### Erreur de connexion à la base de données
```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps postgres-app1
docker-compose ps postgres-app2

# Vérifier les logs
docker-compose logs postgres-app1
```

### Rebuild complet
```bash
./deploy.sh stop
./deploy.sh build
./deploy.sh start
./deploy.sh init-db
```

