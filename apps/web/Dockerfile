# Dockerfile pour le Frontend de l'application 1
FROM node:20-alpine AS builder

WORKDIR /app

# Afficher les versions
RUN echo "=== Versions ===" && \
    node --version && \
    npm --version

# Copier les fichiers de dépendances
COPY package*.json ./

# Afficher le contenu de package.json pour vérification
RUN echo "=== Contenu package.json ===" && \
    cat package.json | head -20

# Installer les dépendances avec logs détaillés
RUN echo "=== Installation des dépendances ===" && \
    npm ci --verbose 2>&1 | tee /tmp/npm-install.log || \
    (echo "=== ERREUR INSTALLATION ===" && cat /tmp/npm-install.log && exit 1)

# Copier le reste du code
COPY . .

# Afficher la structure des fichiers copiés
RUN echo "=== Structure des fichiers ===" && \
    ls -la && \
    echo "=== Fichiers src ===" && \
    ls -la src/ | head -20 && \
    echo "=== Fichiers tsconfig ===" && \
    cat tsconfig.json 2>/dev/null || echo "tsconfig.json non trouvé" && \
    echo "=== Fichiers vite.config ===" && \
    cat vite.config.ts 2>/dev/null || echo "vite.config.ts non trouvé"

# Variables d'environnement pour le build
# La valeur par défaut sera remplacée par le build arg du docker-compose
ARG VITE_API_URL=http://172.17.5.198:4000/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Afficher la variable d'environnement
RUN echo "=== Variables d'environnement ===" && \
    echo "VITE_API_URL=$VITE_API_URL"

# Build de l'application avec logs détaillés
RUN echo "=== Début du build ===" && \
    npm run build 2>&1 | tee /tmp/build.log && \
    echo "=== Vérification du résultat du build ===" && \
    if [ ! -d "dist" ]; then \
      echo "=== ERREUR: Le dossier dist n'existe pas ===" && \
      echo "=== Log complet ===" && \
      cat /tmp/build.log && \
      echo "=== Fin du log ===" && \
      exit 1; \
    fi && \
    echo "=== Build réussi ===" && \
    echo "=== Contenu du dossier dist ===" && \
    ls -la dist/ && \
    echo "=== Taille du dossier dist ===" && \
    du -sh dist/

# Image de production avec Nginx
FROM nginx:alpine

# Copier les fichiers buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration Nginx personnalisée (optionnel)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80
EXPOSE 80

# Commande par défaut
CMD ["nginx", "-g", "daemon off;"]

