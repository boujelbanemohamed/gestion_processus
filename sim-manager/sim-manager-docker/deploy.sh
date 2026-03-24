#!/bin/bash
# ============================================================
#  SIM Manager — Déploiement sur serveur RedHat
# ============================================================

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   SIM Manager — Déploiement Docker       ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Vérification Docker ────────────────────────────
echo -e "${YELLOW}[1/5] Vérification de Docker...${NC}"
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker non trouvé${NC}"; exit 1
fi
if ! docker compose version &>/dev/null 2>&1; then
  echo -e "${RED}❌ Docker Compose non trouvé${NC}"; exit 1
fi
echo -e "${GREEN}✅ Docker OK${NC}"

# ── 2. Création de /data/sim-manager ─────────────────
echo -e "${YELLOW}[2/5] Création des dossiers /data/sim-manager...${NC}"

sudo mkdir -p /data/sim-manager/db
sudo mkdir -p /data/sim-manager/logs/backend
sudo mkdir -p /data/sim-manager/logs/nginx
sudo mkdir -p /data/sim-manager/logs/db
sudo mkdir -p /data/sim-manager/backups

# postgres dans le container = uid 999
sudo chown -R 999:999   /data/sim-manager/db
sudo chown -R 999:999   /data/sim-manager/logs/db
# node dans le container = uid 1000
sudo chown -R 1000:1000 /data/sim-manager/logs/backend
# nginx (root dans alpine)
sudo chmod 755 /data/sim-manager/logs/nginx

echo -e "${GREEN}✅ Structure créée :${NC}"
echo "     /data/sim-manager/"
echo "     ├── db/             ← données PostgreSQL (persistance)"
echo "     ├── logs/"
echo "     │   ├── backend/    ← app.log · error.log"
echo "     │   ├── nginx/      ← access.log · error.log"
echo "     │   └── db/         ← postgresql-YYYY-MM-DD.log"
echo "     └── backups/        ← sauvegardes manuelles"

# ── 3. Build des images ───────────────────────────────
echo -e "${YELLOW}[3/5] Build des images Docker...${NC}"
docker compose build --no-cache
echo -e "${GREEN}✅ Images construites${NC}"

# ── 4. Démarrage des containers ───────────────────────
echo -e "${YELLOW}[4/5] Démarrage des containers...${NC}"
docker compose up -d
echo -e "${GREEN}✅ Containers démarrés${NC}"

# ── 5. Vérification santé ─────────────────────────────
echo -e "${YELLOW}[5/5] Vérification de l'état...${NC}"
sleep 8
docker compose ps

sleep 3
if curl -sf http://localhost:3002/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ API répond correctement${NC}"
else
  echo -e "${YELLOW}⚠️  L'API démarre, patientez 10s puis vérifiez :${NC}"
  echo "   docker compose logs sim_backend"
fi

# ── Résumé ────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ SIM Manager déployé avec succès !                ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  🌐 Local     : http://localhost:3002                 ║${NC}"
echo -e "${GREEN}║  🌐 Réseau    : http://${SERVER_IP}:3002              ║${NC}"
echo -e "${GREEN}║  🗄️  DB port   : 5435 (DBeaver / pgAdmin)            ║${NC}"
echo -e "${GREEN}║  📁 Logs      : /data/sim-manager/logs/              ║${NC}"
echo -e "${GREEN}║  💾 Données   : /data/sim-manager/db/                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Commandes utiles :"
echo "  docker compose logs -f sim_backend              # logs backend live"
echo "  docker compose logs -f sim_db                   # logs PostgreSQL live"
echo "  tail -f /data/sim-manager/logs/backend/app.log  # fichier log app"
echo "  tail -f /data/sim-manager/logs/nginx/access.log # accès nginx"
echo "  docker compose ps                               # état des containers"
echo "  docker compose down                             # arrêter"
echo "  docker compose restart                          # redémarrer"
