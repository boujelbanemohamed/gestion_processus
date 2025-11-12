#!/bin/bash

# Script d'installation automatisé pour Red Hat Enterprise Linux
# Usage: sudo ./install-redhat.sh

set -e

echo "=========================================="
echo "  Installation Docker et Docker Compose"
echo "  pour Red Hat Enterprise Linux"
echo "=========================================="
echo ""

# Vérifier que le script est exécuté en root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Ce script doit être exécuté en tant que root ou avec sudo"
    exit 1
fi

# ÉTAPE 1 : Mise à jour du système
echo "📦 Étape 1/10 : Mise à jour du système..."
yum update -y -q
yum install -y -q wget curl git vim yum-utils device-mapper-persistent-data lvm2
echo "✅ Système mis à jour"
echo ""

# ÉTAPE 2 : Installation de Docker
echo "🐳 Étape 2/10 : Installation de Docker..."
if ! command -v docker &> /dev/null; then
    # Ajouter le dépôt Docker
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo -q
    
    # Installer Docker
    yum install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Démarrer et activer Docker
    systemctl start docker
    systemctl enable docker
    
    echo "✅ Docker installé"
else
    echo "ℹ️  Docker est déjà installé"
fi
echo ""

# ÉTAPE 3 : Vérifier Docker Compose
echo "🔧 Étape 3/10 : Vérification de Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "📥 Installation de Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose 2>/dev/null || true
    echo "✅ Docker Compose installé"
else
    echo "ℹ️  Docker Compose est déjà installé"
fi
echo ""

# ÉTAPE 4 : Configuration Docker
echo "⚙️  Étape 4/10 : Configuration de Docker..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker
echo "✅ Docker configuré"
echo ""

# ÉTAPE 5 : Créer la structure des dossiers
echo "📁 Étape 5/10 : Création de la structure des dossiers..."
mkdir -p /opt/applications
mkdir -p /opt/applications/apps/api /opt/applications/apps/web
mkdir -p /opt/applications/apps2/api /opt/applications/apps2/web
mkdir -p /opt/applications/backups
echo "✅ Structure créée dans /opt/applications"
echo ""

# ÉTAPE 6 : Configuration du firewall
echo "🔥 Étape 6/10 : Configuration du firewall..."
if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port=4000/tcp --quiet 2>/dev/null || true
    firewall-cmd --permanent --add-port=4001/tcp --quiet 2>/dev/null || true
    firewall-cmd --permanent --add-port=5173/tcp --quiet 2>/dev/null || true
    firewall-cmd --permanent --add-port=5174/tcp --quiet 2>/dev/null || true
    firewall-cmd --permanent --add-port=5432/tcp --quiet 2>/dev/null || true
    firewall-cmd --permanent --add-port=5433/tcp --quiet 2>/dev/null || true
    firewall-cmd --reload --quiet
    echo "✅ Ports ouverts dans le firewall"
else
    echo "ℹ️  Firewalld n'est pas actif, vérifiez manuellement les ports"
fi
echo ""

# ÉTAPE 7 : Vérifier les fichiers
echo "📋 Étape 7/10 : Vérification des fichiers..."
if [ ! -f "/opt/applications/docker-compose.yml" ]; then
    echo "⚠️  ATTENTION : docker-compose.yml non trouvé dans /opt/applications/"
    echo "   Veuillez transférer les fichiers nécessaires :"
    echo "   - docker-compose.yml"
    echo "   - deploy.sh"
    echo "   - apps/ (dossier complet)"
    echo "   - apps2/ (dossier complet)"
    echo ""
    echo "   Vous pouvez utiliser SCP depuis votre PC :"
    echo "   scp -r /chemin/vers/apps root@SERVER:/opt/applications/"
    echo ""
    read -p "Appuyez sur Entrée une fois les fichiers transférés..."
fi
echo ""

# ÉTAPE 8 : Configurer les permissions
echo "🔐 Étape 8/10 : Configuration des permissions..."
if [ -f "/opt/applications/deploy.sh" ]; then
    chmod +x /opt/applications/deploy.sh
fi
chmod 755 /opt/applications/apps/api/uploads 2>/dev/null || mkdir -p /opt/applications/apps/api/uploads && chmod 755 /opt/applications/apps/api/uploads
chmod 755 /opt/applications/apps2/api/uploads 2>/dev/null || mkdir -p /opt/applications/apps2/api/uploads && chmod 755 /opt/applications/apps2/api/uploads
echo "✅ Permissions configurées"
echo ""

# ÉTAPE 9 : Créer les fichiers .env si absents
echo "📝 Étape 9/10 : Création des fichiers de configuration..."
if [ ! -f "/opt/applications/apps/api/.env" ]; then
    cat > /opt/applications/apps/api/.env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public
JWT_SECRET=changez-ce-secret-en-production
JWT_REFRESH_SECRET=changez-ce-refresh-secret-en-production
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=production
EOF
    chmod 600 /opt/applications/apps/api/.env
    echo "✅ .env créé pour apps/api"
fi

if [ ! -f "/opt/applications/apps2/api/.env" ]; then
    cat > /opt/applications/apps2/api/.env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@postgres-app2:5432/app2_db?schema=public
JWT_SECRET=changez-ce-secret-app2-en-production
JWT_REFRESH_SECRET=changez-ce-refresh-secret-app2-en-production
PORT=4001
FRONTEND_URL=http://localhost:5174
NODE_ENV=production
EOF
    chmod 600 /opt/applications/apps2/api/.env
    echo "✅ .env créé pour apps2/api"
fi
echo ""

# ÉTAPE 10 : Résumé
echo "=========================================="
echo "  Installation terminée !"
echo "=========================================="
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1. Transférez vos fichiers d'application vers /opt/applications/"
echo "   - docker-compose.yml"
echo "   - deploy.sh"
echo "   - apps/ (dossier complet)"
echo "   - apps2/ (dossier complet)"
echo ""
echo "2. Copiez les Dockerfiles pour l'app 2 :"
echo "   cd /opt/applications"
echo "   cp apps/api/Dockerfile apps2/api/Dockerfile"
echo "   cp apps/web/Dockerfile apps2/web/Dockerfile"
echo "   cp apps/web/nginx.conf apps2/web/nginx.conf"
echo ""
echo "3. Construisez et démarrez les services :"
echo "   cd /opt/applications"
echo "   docker-compose build"
echo "   docker-compose up -d"
echo "   ./deploy.sh init-db"
echo ""
echo "4. Vérifiez que tout fonctionne :"
echo "   docker-compose ps"
echo "   curl http://localhost:4000/api/v1/health"
echo ""
echo "📚 Documentation complète : INSTALLATION_REDHAT.md"
echo ""
echo "✅ Installation de base terminée !"
echo ""

