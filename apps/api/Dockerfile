# Dockerfile pour l'API de l'application 1
FROM node:20-alpine AS builder

WORKDIR /app

# Afficher les versions
RUN echo "=== Versions ===" && \
    node --version && \
    npm --version

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma

# Afficher le contenu de package.json pour vérification
RUN echo "=== Contenu package.json ===" && \
    cat package.json | head -20 && \
    echo "=== Structure prisma ===" && \
    ls -la prisma/ 2>/dev/null || echo "Dossier prisma non trouvé"

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
    cat tsconfig.json 2>/dev/null || echo "tsconfig.json non trouvé"

# Générer le client Prisma avec logs
RUN echo "=== Génération du client Prisma ===" && \
    npx prisma generate 2>&1 | tee /tmp/prisma-generate.log || \
    (echo "=== ERREUR PRISMA GENERATE ===" && cat /tmp/prisma-generate.log && exit 1)

# Compiler TypeScript avec logs détaillés
RUN echo "=== Début de la compilation TypeScript ===" && \
    npm run build 2>&1 | tee /tmp/build.log || \
    (echo "=== ERREUR BUILD ===" && \
     echo "=== Log complet ===" && \
     cat /tmp/build.log && \
     echo "=== Fin du log ===" && \
     exit 1) && \
    echo "=== Compilation réussie ===" && \
    ls -la dist/ 2>/dev/null || echo "Dossier dist non trouvé"

# Image de production
FROM node:20-alpine AS production

WORKDIR /app

# Installer uniquement les dépendances de production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production

# Copier les fichiers compilés depuis le builder
COPY --from=builder /app/dist ./dist
# Générer Prisma dans l'image de production (plus fiable que copier)
RUN npx prisma generate

# Créer le dossier pour les uploads
# Installer Tesseract OCR + langues + outils PDF
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-ara \
    poppler-utils \
    ghostscript \
    imagemagick \
    && rm -rf /var/cache/apk/*
# Créer les dossiers pour les uploads et OCR
RUN mkdir -p /app/uploads /app/uploads/ocr

# Exposer le port
EXPOSE 4000

# Commande par défaut
CMD ["npm", "start"]
