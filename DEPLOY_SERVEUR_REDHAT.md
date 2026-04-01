# Déploiement — serveur Red Hat (référence)

Document de référence pour l’environnement **production** décrit par l’équipe. À utiliser lors des `git pull` et rebuilds Docker depuis une autre machine.

## Emplacement sur le serveur

| Élément | Valeur |
|--------|--------|
| Répertoire de travail (racine du dépôt) | `/data/applications` |
| Fichier Compose | `/data/applications/docker-compose.yml` |
| Code applicatif | `/data/applications/apps/` (`apps/api`, `apps/web`) |

Après connexion SSH au serveur :

```bash
cd /data/applications
```

## Docker — noms observés

Les images Docker construites à partir de ce dépôt suivent le **nom du projet Compose** (par défaut : nom du dossier courant). Sur le serveur actuel, les images sont préfixées par `applications` :

| Service (compose) | Image typique | Conteneur (`container_name`) |
|-------------------|---------------|-------------------------------|
| `web-app1` | `applications-web-app1` | `web-gestion-processus` |
| `api-app1` | `applications-api-app1` | `api-gestion-processus` |
| `postgres-app1` | `postgres:16-alpine` | `postgres-gestion-processus` |

## Ports exposés (hôte)

| Port hôte | Service |
|-----------|---------|
| **5173** | Frontend (HTTP → port 80 dans le conteneur web) |
| **4000** | API Node |
| **5434** | PostgreSQL (mappé depuis 5432 dans le conteneur) |

Accès navigateur (remplacer par l’IP ou le DNS du serveur) :

- Application : `http://<SERVEUR>:5173`
- API : `http://<SERVEUR>:4000`

## Mise à jour après un `git push`

Sur le serveur :

```bash
cd /data/applications
git pull origin main
docker compose build --no-cache api-app1 web-app1
docker compose up -d api-app1 web-app1
```

Si la base ou Prisma évoluent, s’assurer que `api-app1` redémarre bien (les migrations sont lancées au démarrage du conteneur API selon `docker-compose.yml`).

Vérification rapide :

```bash
docker ps
docker compose logs -f api-app1 --tail 50
```

## Variables d’environnement (rappel)

- Racine : `.env` pour `VITE_API_URL`, `FRONTEND_URL`, secrets JWT, etc. (voir `.env.example`).
- API : `apps/api/.env` monté en lecture seule dans le conteneur `api-gestion-processus`.

Les URLs publiques (`VITE_API_URL`, `FRONTEND_URL`) doivent correspondre à l’adresse **réellement utilisée par le navigateur** (pas `localhost` depuis un poste client).

## Commandes utiles

```bash
# État des services
docker compose ps

# Logs
docker compose logs -f web-app1
docker compose logs -f api-app1

# Redémarrage ciblé
docker compose restart api-app1 web-app1
```

---

*Dernière mise à jour : alignée sur `docker-compose.yml` du dépôt (services `*-app1`, conteneurs `*-gestion-processus`).*
