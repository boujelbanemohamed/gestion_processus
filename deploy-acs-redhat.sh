#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "========================================="
echo "    DÉPLOIEMENT ACS BANKING - REDHAT    "
echo "    WORKDIR: /data/applications/app_acs "
echo "========================================="

# Fonctions utilitaires
print_success() {
    echo "✅ $1"
}

print_error() {
    echo "❌ $1"
}

print_info() {
    echo "📌 $1"
}

# =========================================
# ÉTAPE 1 : VÉRIFICATION PRÉREQUIS
# =========================================
echo ""
echo "1. VÉRIFICATION DES PRÉREQUIS"

# 1.1 Vérifier si on est sur RedHat/CentOS
if [ -f /etc/redhat-release ]; then
    OS_NAME=$(cat /etc/redhat-release)
    print_success "Système détecté: $OS_NAME"
else
    print_error "Ce script est conçu pour RedHat/CentOS"
    exit 1
fi

# 1.2 Vérifier les privilèges
if [ "$EUID" -eq 0 ]; then
    print_error "Ne pas exécuter en tant que root. Utilisez un utilisateur normal avec sudo."
    exit 1
fi

# 1.3 Vérifier si l'utilisateur peut sudo
if ! sudo -v 2>/dev/null; then
    print_error "L'utilisateur n'a pas les droits sudo"
    exit 1
fi

# =========================================
# ÉTAPE 2 : VÉRIFICATION DOCKER
# =========================================
echo ""
echo "2. VÉRIFICATION DOCKER"

DOCKER_INSTALLED=false
DOCKER_COMPOSE_INSTALLED=false

# Vérifier Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    print_success "Docker installé: version $DOCKER_VERSION"
    DOCKER_INSTALLED=true
   
    # Vérifier si Docker est en cours d'exécution
    if sudo systemctl is-active --quiet docker; then
        print_success "Docker service est actif"
    else
        print_error "Docker n'est pas démarré"
        sudo systemctl start docker
        sudo systemctl enable docker
        print_success "Docker démarré et activé"
    fi
else
    print_info "Docker n'est pas installé"
    DOCKER_INSTALLED=false
fi

# Vérifier Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+')
    print_success "Docker Compose installé: version $DOCKER_COMPOSE_VERSION"
    DOCKER_COMPOSE_INSTALLED=true
elif command -v docker compose &> /dev/null; then
    print_success "Docker Compose V2 installé (plugin)"
    DOCKER_COMPOSE_INSTALLED=true
else
    print_info "Docker Compose n'est pas installé"
    DOCKER_COMPOSE_INSTALLED=false
fi

# =========================================
# ÉTAPE 3 : INSTALLATION SI NÉCESSAIRE
# =========================================
echo ""
echo "3. INSTALLATION DES PRÉREQUIS"

if [ "$DOCKER_INSTALLED" = false ]; then
    print_info "Installation de Docker..."
   
    # 1. Mettre à jour le système
    sudo dnf update -y
   
    # 2. Installer les dépendances
    sudo dnf install -y yum-utils device-mapper-persistent-data lvm2
   
    # 3. Ajouter le repository Docker
    sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
   
    # 4. Installer Docker
    sudo dnf install -y docker-ce docker-ce-cli containerd.io
   
    # 5. Démarrer et activer Docker
    sudo systemctl start docker
    sudo systemctl enable docker
   
    # 6. Ajouter l'utilisateur au groupe docker
    sudo usermod -aG docker $USER
   
    print_success "Docker installé avec succès"
    print_info "⚠️  Déconnectez-vous et reconnectez-vous pour appliquer les changements de groupe"
    echo "    Ou exécutez: newgrp docker"
    exit 1  # On quitte pour que l'utilisateur se reconnecte
fi

if [ "$DOCKER_COMPOSE_INSTALLED" = false ]; then
    print_info "Installation de Docker Compose..."
   
    # Télécharger Docker Compose
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
   
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
         -o /usr/local/bin/docker-compose
   
    sudo chmod +x /usr/local/bin/docker-compose
   
    # Vérifier l'installation
    docker-compose --version
    print_success "Docker Compose installé"
fi
# =========================================
# ÉTAPE 4 : PRÉPARATION DU RÉPERTOIRE
# =========================================
echo ""
echo "4. PRÉPARATION DE L'ENVIRONNEMENT"

APP_DIR="/data/applications/app_acs"

# Créer le répertoire si nécessaire
if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
    print_success "Répertoire créé: $APP_DIR"
else
    print_info "Répertoire existant: $APP_DIR"
fi

cd "$APP_DIR"

# =========================================
# ÉTAPE 5 : CLONAGE DU PROJET
# =========================================
echo ""
echo "5. TÉLÉCHARGEMENT DU CODE"

if [ ! -d ".git" ]; then
    print_info "Clonage du repository..."
    git clone https://github.com/boujelbanemohamed/ACS.git .
else
    print_info "Mise à jour du repository..."
    git fetch origin
    git pull origin version-locale
fi

# Vérifier la branche
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "version-locale" ]; then
    print_info "Changement vers la branche version-locale..."
    git checkout version-locale
else
    print_success "Déjà sur la branche version-locale"
fi

# =========================================
# ÉTAPE 6 : CONFIGURATION
# =========================================
echo ""
echo "6. CONFIGURATION DE L'APPLICATION"

# Créer le fichier .env
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Base de données
DB_HOST=postgres
DB_PORT=5432
DB_NAME=banking_db
DB_USER=postgres
DB_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)

# Application
NODE_ENV=production
BACKEND_PORT=5001
FRONTEND_URL=http://0.0.0.0:5000

# Sécurité
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Chemins (spécifique à RedHat)
WORKDIR=/data/applications/app_acs
EOF
   
    # Remplacer les commandes dans .env
    TEMP_FILE=$(mktemp)
    while IFS= read -r line; do
        if [[ $line == *"\$(openssl"* ]]; then
            eval echo "$line" >> "$TEMP_FILE"
        else
            echo "$line" >> "$TEMP_FILE"
        fi
    done < .env
    mv "$TEMP_FILE" .env
   
    print_success "Fichier .env créé"
else
    print_info "Fichier .env existe déjà"
fi

# Modifier server.js pour écouter sur 0.0.0.0
if grep -q "app.listen(PORT," backend/server.js; then
    if ! grep -q "0.0.0.0" backend/server.js; then
        print_info "Configuration du backend pour écouter sur toutes les interfaces..."
        cp backend/server.js backend/server.js.backup
        sed -i "s/app\.listen(PORT,/app\.listen(PORT, '0.0.0.0',/" backend/server.js
        print_success "Backend configuré pour 0.0.0.0"
    fi
fi

# Vérifier package-lock.json pour le frontend
if [ ! -f "frontend/package-lock.json" ]; then
    print_info "Génération de package-lock.json pour le frontend..."
    cd frontend
    npm install --package-lock-only --silent 2>/dev/null || echo "Note: npm peut ne pas être installé sur le serveur"
    cd ..
fi

# =========================================
# ÉTAPE 7 : CONFIGURATION DOCKER (AVEC BON WORKDIR)
# =========================================
echo ""
echo "7. CONFIGURATION DOCKER"

# Créer docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: acs_postgres
    environment:
      POSTGRES_DB: banking_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: acs_backend
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: banking_db
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      NODE_ENV: production
      BACKEND_PORT: 5001
    ports:
      - "5001:5001"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ${WORKDIR}/logs:/data/applications/app_acs/logs

  frontend:
    build: ./frontend
    container_name: acs_frontend
    ports:
      - "5000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Créer Dockerfile backend AVEC BON WORKDIR
cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /data/applications/app_acs
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5001
CMD ["node", "server.js"]
EOF

# Créer Dockerfile frontend AVEC BON WORKDIR
cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine as build
WORKDIR /data/applications/app_acs
COPY package*.json ./
RUN npm install
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=http://0.0.0.0:5001/api
RUN npm run build

FROM nginx:alpine
COPY --from=build /data/applications/app_acs/build /usr/share/nginx/html
RUN echo 'server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;
   
    location / {
        try_files $uri $uri/ /index.html;
    }
   
    location /api/ {
        proxy_pass http://backend:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}' > /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
EOF

print_success "Configuration Docker créée avec WORKDIR: /data/applications/app_acs"

# =========================================
# ÉTAPE 8 : CONSTRUCTION ET DÉMARRAGE
# =========================================
echo ""
echo "8. DÉPLOIEMENT DE L'APPLICATION"

# Charger les variables d'environnement
export $(cat .env | xargs)

print_info "Construction des images Docker (cela peut prendre quelques minutes)..."
docker-compose build

print_info "Démarrage des services..."
docker-compose up -d

print_info "Attente du démarrage complet..."
sleep 30

# =========================================
# ÉTAPE 9 : VÉRIFICATION
# =========================================
echo ""
echo "9. VÉRIFICATION"

echo "📊 État des conteneurs:"
docker-compose ps

echo ""
echo "🌐 Tests de connectivité:"

# Test frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)
if [[ "$FRONTEND_STATUS" =~ ^(200|30[0-9])$ ]]; then
    print_success "Frontend accessible (port 5000) - HTTP $FRONTEND_STATUS"
else
    print_error "Frontend non accessible - HTTP $FRONTEND_STATUS"
fi

# Test backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    print_success "Backend accessible (port 5001) - HTTP $BACKEND_STATUS"
else
    print_error "Backend non accessible - HTTP $BACKEND_STATUS"
fi

# Afficher l'IP
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
echo ""
echo "========================================="
echo "           DÉPLOIEMENT TERMINÉ          "
echo "========================================="
echo ""
echo "📁 WORKDIR: /data/applications/app_acs"
echo "🌍 ACCÈS À L'APPLICATION:"
echo "   Frontend:    http://$SERVER_IP:5000"
echo "   Backend API: http://$SERVER_IP:5001/api"
echo "   Health check: http://$SERVER_IP:5001/api/health"
echo ""
echo "📝 COMMANDES UTILES:"
echo "   Voir les logs:    docker-compose logs -f"
echo "   Redémarrer:       docker-compose restart"
echo "   Arrêter:          docker-compose down"
echo "   État:             docker-compose ps"
echo "   Shell backend:    docker exec -it acs_backend sh"
echo "   Shell postgres:   docker exec -it acs_postgres psql -U postgres"
echo ""
echo "🔧 EN CAS DE PROBLÈME:"
echo "   1. Voir logs: docker-compose logs"
echo "   2. Vérifier conteneurs: docker-compose ps"
echo "   3. Vérifier ports: sudo ss -tlnp | grep ':5000\|:5001'"
echo "   4. Reconstruire: docker-compose build --no-cache"
echo ""
echo "========================================="
