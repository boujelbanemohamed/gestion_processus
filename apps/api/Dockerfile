# Dockerfile pour l'API de l'application 1
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma

# Installer les dépendances
RUN npm ci

# Copier le reste du code
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# Compiler TypeScript
RUN npm run build

# Image de production
FROM node:20-alpine AS production

WORKDIR /app

# Installer uniquement les dépendances de production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production

# Copier les fichiers compilés depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

# Créer le dossier pour les uploads
RUN mkdir -p /app/uploads

# Exposer le port
EXPOSE 4000

# Commande par défaut
CMD ["npm", "start"]

