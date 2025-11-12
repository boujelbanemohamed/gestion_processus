# 🐳 Déploiement Docker Compose - Deux Applications

Ce projet permet de déployer deux applications Node.js/React/PostgreSQL sur le même serveur en utilisant Docker Compose.

## 📋 Vue d'ensemble

### Application 1 : Gestion des processus
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:4000
- **Base de données** : PostgreSQL sur le port 5432

### Application 2 : Votre deuxième application
- **Frontend** : http://localhost:5174
- **Backend API** : http://localhost:4001
- **Base de données** : PostgreSQL sur le port 5433

## 🚀 Démarrage rapide

### 1. Préparer votre deuxième application

```bash
# Créer la structure
mkdir -p apps2/api apps2/web

# Copier votre application dans apps2/
# Structure attendue:
# apps2/
#   ├── api/          (backend Node.js avec package.json)
#   └── web/          (frontend React avec package.json)
```

### 2. Copier les fichiers Docker

```bash
# Dockerfiles pour l'API
cp apps/api/Dockerfile apps2/api/Dockerfile

# Dockerfiles et config Nginx pour le Web
cp apps/web/Dockerfile apps2/web/Dockerfile
cp apps/web/nginx.conf apps2/web/nginx.conf
```

### 3. Configurer les variables d'environnement

#### Application 2 - Backend (`apps2/api/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=votre-secret-jwt-app2
JWT_REFRESH_SECRET=votre-secret-refresh-app2
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
```

#### Application 2 - Frontend (`apps2/web/.env.production`)
```env
VITE_API_URL=http://localhost:4001/api/v1
```

### 4. Démarrer les applications

```bash
# Rendre le script exécutable (si pas déjà fait)
chmod +x deploy.sh

# Construire les images
./deploy.sh build

# Démarrer tous les services
./deploy.sh start

# Initialiser les bases de données
./deploy.sh init-db

# Voir les logs
./deploy.sh logs
```

## 📁 Structure du projet

```
/
├── docker-compose.yml          # Configuration Docker Compose
├── deploy.sh                   # Script de déploiement
├── .env.example                # Exemple de variables d'environnement
├── apps/                       # Application 1 (Gestion des processus)
│   ├── api/
│   │   ├── Dockerfile
│   │   └── .env
│   └── web/
│       ├── Dockerfile
│       └── nginx.conf
└── apps2/                      # Application 2
    ├── api/
    │   ├── Dockerfile
    │   └── .env
    └── web/
        ├── Dockerfile
        └── nginx.conf
```

## 🛠️ Commandes disponibles

Le script `deploy.sh` fournit plusieurs commandes :

```bash
./deploy.sh start      # Démarrer tous les services
./deploy.sh stop       # Arrêter tous les services
./deploy.sh restart    # Redémarrer tous les services
./deploy.sh build      # Construire les images Docker
./deploy.sh logs       # Voir tous les logs
./deploy.sh logs api-app1  # Voir les logs d'un service spécifique
./deploy.sh init-db    # Initialiser les bases de données
./deploy.sh backup     # Sauvegarder les bases de données
./deploy.sh clean      # Supprimer conteneurs et volumes (⚠️)
```

## 🔧 Configuration

### Modifier les ports

Si vous devez changer les ports, modifiez `docker-compose.yml` :

```yaml
# Exemple : changer le port du frontend de l'app 2
web-app2:
  ports:
    - "8080:80"  # Au lieu de 5174:80
```

Pensez aussi à mettre à jour les variables d'environnement correspondantes.

### Variables d'environnement

Créez un fichier `.env` à la racine pour les secrets :

```bash
cp .env.example .env
# Éditez .env avec vos valeurs
```

## 📊 Vérification

### Vérifier que tout fonctionne

```bash
# Voir l'état des services
docker-compose ps

# Tester les endpoints
curl http://localhost:4000/api/v1/health
curl http://localhost:4001/api/v1/health

# Voir les logs d'un service
docker-compose logs -f api-app1
```

### Accéder aux bases de données

```bash
# Application 1
docker-compose exec postgres-app1 psql -U postgres -d cursor_process

# Application 2
docker-compose exec postgres-app2 psql -U postgres -d app2_db
```

## 🔒 Sécurité (Production)

### 1. Changer les mots de passe par défaut

Modifiez `docker-compose.yml` ou utilisez un fichier `.env` :

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD_APP1:-votre-mot-de-passe-securise}
```

### 2. Utiliser HTTPS

Configurez un reverse proxy (Nginx/Traefik) avec SSL/TLS.

### 3. Limiter l'accès aux ports

En production, ne pas exposer les ports PostgreSQL directement. Utilisez des réseaux Docker internes uniquement.

## 💾 Sauvegardes

### Sauvegarde manuelle

```bash
./deploy.sh backup
```

Les sauvegardes sont créées dans `./backups/`

### Restauration

```bash
# Restaurer l'application 1
docker-compose exec -T postgres-app1 psql -U postgres cursor_process < backups/app1-YYYYMMDD-HHMMSS.sql

# Restaurer l'application 2
docker-compose exec -T postgres-app2 psql -U postgres app2_db < backups/app2-YYYYMMDD-HHMMSS.sql
```

## 🐛 Dépannage

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs
docker-compose logs

# Vérifier les ports disponibles
netstat -tulpn | grep -E '4000|4001|5173|5174|5432|5433'

# Redémarrer un service spécifique
docker-compose restart api-app1
```

### Erreur de connexion à la base de données

1. Vérifiez que PostgreSQL est démarré : `docker-compose ps`
2. Vérifiez les variables `DATABASE_URL` dans les `.env`
3. Vérifiez les logs : `docker-compose logs postgres-app1`

### Les fichiers uploadés disparaissent

Vérifiez que les volumes sont correctement montés dans `docker-compose.yml` :

```yaml
volumes:
  - ./apps/api/uploads:/app/uploads
```

### Rebuild complet

```bash
./deploy.sh stop
docker-compose build --no-cache
./deploy.sh start
./deploy.sh init-db
```

## 📚 Documentation complète

- **Guide détaillé** : Voir `DOCKER_SETUP.md`
- **Démarrage rapide** : Voir `QUICK_START.md`

## 🔄 Mise à jour

Pour mettre à jour les applications :

```bash
# Arrêter
./deploy.sh stop

# Mettre à jour le code (git pull, etc.)

# Rebuild
./deploy.sh build

# Redémarrer
./deploy.sh start
```

## 📝 Notes importantes

1. **Premier démarrage** : Les migrations Prisma doivent être exécutées avec `./deploy.sh init-db`
2. **Ports** : Assurez-vous que les ports ne sont pas déjà utilisés
3. **Ressources** : Surveillez l'utilisation RAM/CPU avec `docker stats`
4. **Logs** : Les logs sont persistants via Docker, utilisez `docker-compose logs` pour les consulter

## 🆘 Support

En cas de problème :
1. Consultez les logs : `./deploy.sh logs`
2. Vérifiez l'état des services : `docker-compose ps`
3. Consultez la documentation dans `DOCKER_SETUP.md`

