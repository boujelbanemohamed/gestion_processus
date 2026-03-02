#!/bin/bash
BACKUP_DIR="/backup/uploads"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /opt/applications/apps/api uploads/
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +30 -delete

echo "✅ Backup créé: uploads_$DATE.tar.gz"
