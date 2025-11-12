#!/bin/bash

# Script de déploiement Docker Compose
# Usage: ./deploy.sh [start|stop|restart|build|logs|clean]

set -e

ACTION=${1:-start}

case $ACTION in
  start)
    echo "🚀 Démarrage des applications..."
    docker-compose up -d
    echo "✅ Applications démarrées"
    echo ""
    echo "📊 Statut des services:"
    docker-compose ps
    ;;
  
  stop)
    echo "🛑 Arrêt des applications..."
    docker-compose down
    echo "✅ Applications arrêtées"
    ;;
  
  restart)
    echo "🔄 Redémarrage des applications..."
    docker-compose restart
    echo "✅ Applications redémarrées"
    ;;
  
  build)
    echo "🔨 Construction des images Docker..."
    docker-compose build --no-cache
    echo "✅ Images construites"
    ;;
  
  logs)
    SERVICE=${2:-}
    if [ -z "$SERVICE" ]; then
      docker-compose logs -f
    else
      docker-compose logs -f "$SERVICE"
    fi
    ;;
  
  clean)
    echo "🧹 Nettoyage des conteneurs et volumes..."
    read -p "⚠️  Êtes-vous sûr de vouloir supprimer tous les conteneurs et volumes? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker-compose down -v
      docker system prune -f
      echo "✅ Nettoyage terminé"
    else
      echo "❌ Nettoyage annulé"
    fi
    ;;
  
  init-db)
    echo "🗄️  Initialisation des bases de données..."
    
    echo "📦 Application 1 - Migration Prisma..."
    docker-compose exec -T api-app1 npx prisma migrate deploy || echo "⚠️  Erreur migration app1"
    
    echo "📦 Application 2 - Migration Prisma..."
    docker-compose exec -T api-app2 npx prisma migrate deploy || echo "⚠️  Erreur migration app2"
    
    echo "✅ Bases de données initialisées"
    ;;
  
  backup)
    echo "💾 Sauvegarde des bases de données..."
    BACKUP_DIR="./backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    echo "📦 Sauvegarde App1..."
    docker-compose exec -T postgres-app1 pg_dump -U postgres cursor_process > "$BACKUP_DIR/app1-$TIMESTAMP.sql"
    
    echo "📦 Sauvegarde App2..."
    docker-compose exec -T postgres-app2 pg_dump -U postgres app2_db > "$BACKUP_DIR/app2-$TIMESTAMP.sql"
    
    echo "✅ Sauvegardes créées dans $BACKUP_DIR/"
    ;;
  
  *)
    echo "Usage: $0 {start|stop|restart|build|logs|clean|init-db|backup}"
    echo ""
    echo "Commandes:"
    echo "  start     - Démarrer tous les services"
    echo "  stop      - Arrêter tous les services"
    echo "  restart   - Redémarrer tous les services"
    echo "  build     - Construire les images Docker"
    echo "  logs      - Voir les logs (optionnel: nom du service)"
    echo "  clean     - Supprimer conteneurs et volumes"
    echo "  init-db   - Initialiser les bases de données"
    echo "  backup    - Sauvegarder les bases de données"
    exit 1
    ;;
esac

