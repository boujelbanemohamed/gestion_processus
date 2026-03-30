# 📡 SIM Manager — Déploiement Docker

## Architecture

```
┌─────────────────────────────────────────────┐
│         sim_manager_network (bridge)         │
│                                              │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │  sim_frontend │    │  sim_backend     │   │
│  │  Nginx:80    │───▶│  Node.js:3001    │   │
│  │  port: 3002  │    │                  │   │
│  └──────────────┘    └────────┬─────────┘   │
│                               │              │
│                      ┌────────▼─────────┐   │
│                      │  sim_db          │   │
│                      │  PostgreSQL:5432 │   │
│                      │  port: 5435      │   │
│                      └──────────────────┘   │
└─────────────────────────────────────────────┘
```

## Déploiement rapide

```bash
# 1. Copier le dossier sur le serveur
scp -r sim-manager-docker/ user@VOTRE_SERVEUR:/opt/sim-manager/

# 2. Se connecter au serveur
ssh user@VOTRE_SERVEUR

# 3. Aller dans le dossier
cd /opt/sim-manager

# 4. Lancer le déploiement
chmod +x deploy.sh
./deploy.sh
```

## Accès

| URL | Description |
|-----|-------------|
| `http://IP_SERVEUR:3002` | Application web |
| `localhost:5435` | PostgreSQL direct (DBeaver/pgAdmin) |

## Credentials PostgreSQL

| Paramètre | Valeur |
|-----------|--------|
| Host | `localhost` (depuis l'hôte) |
| Port | `5435` |
| Base | `sim_manager` |
| User | `sim_user` |
| Password | `sim_pass_2025` |

> ⚠️ Changez le mot de passe dans `docker-compose.yml` avant de déployer en production !

## Commandes utiles

```bash
# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Voir les logs en temps réel
docker compose logs -f

# Logs d'un seul service
docker compose logs -f sim_backend
docker compose logs -f sim_db

# Redémarrer un service
docker compose restart sim_backend

# État des containers
docker compose ps

# Accéder à la base de données
docker exec -it sim_manager_db psql -U sim_user -d sim_manager

# Sauvegarde de la base
docker exec sim_manager_db pg_dump -U sim_user sim_manager > backup_$(date +%Y%m%d).sql

# Restauration
docker exec -i sim_manager_db psql -U sim_user -d sim_manager < backup.sql

# Mise à jour (rebuild sans downtime)
docker compose build --no-cache
docker compose up -d
```

## Structure des fichiers

```
sim-manager-docker/
├── docker-compose.yml       ← Configuration principale
├── deploy.sh                ← Script de déploiement
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── server.js            ← API Express
│   ├── db.js                ← Connexion PostgreSQL
│   └── package.json
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf           ← Proxy /api → backend
│   └── index.html           ← Application web
└── postgres/
    └── init_db.sql          ← Création des tables (auto au 1er démarrage)
```
