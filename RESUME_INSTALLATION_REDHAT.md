# 📝 Résumé des étapes d'installation sur Red Hat

## 🎯 Vue d'ensemble rapide

### Ce dont vous avez besoin :
1. Serveur Red Hat avec accès root/sudo
2. Les fichiers de vos deux applications
3. Connexion Internet

### Temps estimé : 30-45 minutes

---

## 📋 Checklist d'installation

### Phase 1 : Préparation du serveur (10 min)

- [ ] **Étape 1** : Se connecter au serveur Red Hat
  ```bash
  ssh root@VOTRE_IP_SERVEUR
  ```

- [ ] **Étape 2** : Exécuter le script d'installation automatique
  ```bash
  # Transférer le script sur le serveur
  scp install-redhat.sh root@VOTRE_IP:/root/
  
  # Sur le serveur
  chmod +x install-redhat.sh
  ./install-redhat.sh
  ```
  
  **OU** suivre manuellement les étapes 1-6 de `INSTALLATION_REDHAT.md`

---

### Phase 2 : Transfert des fichiers (10 min)

- [ ] **Étape 3** : Transférer l'application 1
  ```bash
  # Depuis votre PC
  scp -r /Users/mohamed/apps root@VOTRE_IP:/opt/applications/
  scp docker-compose.yml root@VOTRE_IP:/opt/applications/
  scp deploy.sh root@VOTRE_IP:/opt/applications/
  ```

- [ ] **Étape 4** : Transférer l'application 2
  ```bash
  # Depuis votre PC (remplacez le chemin)
  scp -r /chemin/vers/app2 root@VOTRE_IP:/opt/applications/apps2
  ```

- [ ] **Étape 5** : Sur le serveur, copier les Dockerfiles
  ```bash
  ssh root@VOTRE_IP
  cd /opt/applications
  cp apps/api/Dockerfile apps2/api/Dockerfile
  cp apps/web/Dockerfile apps2/web/Dockerfile
  cp apps/web/nginx.conf apps2/web/nginx.conf
  ```

---

### Phase 3 : Configuration (5 min)

- [ ] **Étape 6** : Configurer les variables d'environnement
  ```bash
  cd /opt/applications
  
  # App 1 - Backend
  nano apps/api/.env
  # Vérifier/modifier DATABASE_URL, JWT_SECRET, etc.
  
  # App 1 - Frontend
  nano apps/web/.env.production
  # Vérifier VITE_API_URL=http://localhost:4000/api/v1
  
  # App 2 - Backend
  nano apps2/api/.env
  # Configurer selon votre application 2
  
  # App 2 - Frontend
  nano apps2/web/.env.production
  # Configurer VITE_API_URL=http://localhost:4001/api/v1
  ```

---

### Phase 4 : Déploiement (10 min)

- [ ] **Étape 7** : Construire les images Docker
  ```bash
  cd /opt/applications
  docker-compose build
  ```
  ⏱️ *Cela peut prendre 5-10 minutes*

- [ ] **Étape 8** : Démarrer les services
  ```bash
  docker-compose up -d
  ```

- [ ] **Étape 9** : Vérifier l'état
  ```bash
  docker-compose ps
  # Tous les services doivent être "Up"
  ```

- [ ] **Étape 10** : Initialiser les bases de données
  ```bash
  # Attendre 15 secondes que PostgreSQL démarre
  sleep 15
  
  # App 1
  docker-compose exec api-app1 npx prisma generate
  docker-compose exec api-app1 npx prisma migrate deploy
  
  # App 2
  docker-compose exec api-app2 npx prisma generate
  docker-compose exec api-app2 npx prisma migrate deploy
  ```

---

### Phase 5 : Vérification (5 min)

- [ ] **Étape 11** : Tester les APIs
  ```bash
  curl http://localhost:4000/api/v1/health
  curl http://localhost:4001/api/v1/health
  ```

- [ ] **Étape 12** : Accéder aux applications
  - Application 1 : http://VOTRE_IP:5173
  - Application 2 : http://VOTRE_IP:5174

---

## 🚨 En cas de problème

### Les conteneurs ne démarrent pas
```bash
docker-compose logs
docker-compose ps
```

### Erreur de connexion à la base de données
```bash
docker-compose logs postgres-app1
docker-compose exec postgres-app1 psql -U postgres -d cursor_process
```

### Ports déjà utilisés
```bash
netstat -tulpn | grep -E '4000|4001|5173|5174'
# Arrêter les processus qui utilisent ces ports
```

---

## 📚 Documentation complète

Pour plus de détails, consultez :
- **Guide complet** : `INSTALLATION_REDHAT.md`
- **Guide Docker** : `README_DOCKER.md`
- **Démarrage rapide** : `QUICK_START.md`

---

## ✅ Commandes essentielles à retenir

```bash
cd /opt/applications

# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Voir les logs
docker-compose logs -f

# Redémarrer un service
docker-compose restart api-app1

# Sauvegarder
./deploy.sh backup
```

---

## 🎉 C'est terminé !

Vos deux applications sont maintenant déployées et accessibles sur :
- **App 1** : http://VOTRE_IP:5173
- **App 2** : http://VOTRE_IP:5174

