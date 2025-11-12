# Guide de déploiement Docker Compose

Ce guide explique comment déployer les deux applications sur le même serveur en utilisant Docker Compose.

## Structure des applications

```
/
├── docker-compose.yml          # Configuration principale
├── apps/                        # Application 1 (Gestion des processus)
│   ├── api/
│   │   ├── Dockerfile
│   │   └── ...
│   └── web/
│       ├── Dockerfile
│       ├── nginx.conf
│       └── ...
└── apps2/                       # Application 2 (à créer)
    ├── api/
    │   ├── Dockerfile
    │   └── ...
    └── web/
        ├── Dockerfile
        ├── nginx.conf
        └── ...
```

## Prérequis

1. **Docker** et **Docker Compose** installés sur le serveur
2. Les deux applications doivent être copiées dans les dossiers `apps/` et `apps2/`

## Ports utilisés

### Application 1 (Gestion des processus)
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- Base de données PostgreSQL: `localhost:5432`

### Application 2
- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:4001`
- Base de données PostgreSQL: `localhost:5433`

## Étapes d'installation

### 1. Préparer la structure

```bash
# Créer le dossier pour l'application 2
mkdir -p apps2/api apps2/web

# Copier votre deuxième application dans apps2/
# Structure attendue:
# apps2/api/ (backend Node.js)
# apps2/web/ (frontend React)
```

### 2. Créer les Dockerfiles pour l'application 2

Copiez les Dockerfiles de l'application 1 et adaptez-les si nécessaire :

```bash
cp apps/api/Dockerfile apps2/api/Dockerfile
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf
```

### 3. Configurer les variables d'environnement

#### Application 1 (`apps/api/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
PORT=4000
FRONTEND_URL=http://localhost:5173
```

#### Application 2 (`apps2/api/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=your-super-secret-jwt-key-app2
JWT_REFRESH_SECRET=your-super-secret-refresh-key-app2
PORT=4001
FRONTEND_URL=http://localhost:5174
```

### 4. Modifier les URLs API dans les frontends

#### Application 1 (`apps/web/.env` ou `apps/web/.env.production`)
```env
VITE_API_URL=http://localhost:4000/api/v1
```

#### Application 2 (`apps2/web/.env` ou `apps2/web/.env.production`)
```env
VITE_API_URL=http://localhost:4001/api/v1
```

### 5. Construire et démarrer les conteneurs

```bash
# Construire les images
docker-compose build

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Voir les logs d'un service spécifique
docker-compose logs -f api-app1
docker-compose logs -f web-app1
```

### 6. Initialiser les bases de données

```bash
# Pour l'application 1
docker-compose exec api-app1 npx prisma migrate deploy
docker-compose exec api-app1 npm run seed  # Si vous avez un script seed

# Pour l'application 2
docker-compose exec api-app2 npx prisma migrate deploy
docker-compose exec api-app2 npm run seed  # Si vous avez un script seed
```

## Commandes utiles

```bash
# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données)
docker-compose down -v

# Redémarrer un service spécifique
docker-compose restart api-app1

# Voir l'état des services
docker-compose ps

# Accéder au shell d'un conteneur
docker-compose exec api-app1 sh
docker-compose exec postgres-app1 psql -U postgres -d cursor_process
```

## Configuration pour la production

### 1. Utiliser un reverse proxy (Nginx)

Créez un fichier `/etc/nginx/sites-available/docker-apps` :

```nginx
# Application 1
server {
    listen 80;
    server_name app1.votredomaine.com;
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
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
    server_name app2.votredomaine.com;
    
    location / {
        proxy_pass http://localhost:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Sécuriser les mots de passe

Modifiez les mots de passe PostgreSQL et les secrets JWT dans `docker-compose.yml` ou utilisez un fichier `.env` :

```bash
# Créer un fichier .env à la racine
cat > .env << EOF
JWT_SECRET_APP1=your-very-secure-secret-key-here
JWT_REFRESH_SECRET_APP1=your-very-secure-refresh-key-here
JWT_SECRET_APP2=your-very-secure-secret-key-app2
JWT_REFRESH_SECRET_APP2=your-very-secure-refresh-key-app2
POSTGRES_PASSWORD_APP1=secure-password-here
POSTGRES_PASSWORD_APP2=secure-password-here
EOF
```

### 3. Sauvegardes automatiques

Ajoutez un service de backup dans `docker-compose.yml` :

```yaml
  backup-app1:
    image: postgres:16-alpine
    volumes:
      - postgres-app1-data:/backup-source:ro
      - ./backups:/backups
    command: >
      sh -c "
        while true; do
          pg_dump -h postgres-app1 -U postgres cursor_process > /backups/app1-$$(date +%Y%m%d-%H%M%S).sql
          sleep 86400
        done
      "
    depends_on:
      - postgres-app1
```

## Dépannage

### Les conteneurs ne démarrent pas
```bash
# Vérifier les logs
docker-compose logs

# Vérifier les ports disponibles
netstat -tulpn | grep -E '4000|4001|5173|5174|5432|5433'
```

### Erreurs de connexion à la base de données
- Vérifiez que les services PostgreSQL sont en bonne santé : `docker-compose ps`
- Vérifiez les variables d'environnement `DATABASE_URL`
- Assurez-vous que les migrations Prisma sont exécutées

### Les fichiers uploadés ne persistent pas
- Vérifiez que les volumes sont correctement montés
- Vérifiez les permissions des dossiers `uploads/`

## Notes importantes

1. **Sécurité** : Changez tous les mots de passe par défaut en production
2. **Ports** : Assurez-vous que les ports ne sont pas déjà utilisés
3. **Ressources** : Surveillez l'utilisation de la RAM et du CPU
4. **Backups** : Configurez des sauvegardes régulières des bases de données

