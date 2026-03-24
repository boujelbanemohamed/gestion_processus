FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Utilisateur non-root pour la sécurité
RUN addgroup -S simgroup && adduser -S simuser -G simgroup && \
    chown -R simuser:simgroup /app
USER simuser

EXPOSE 3001

CMD ["node", "server.js"]
