FROM nginx:alpine

# Copier le frontend
COPY index.html /usr/share/nginx/html/index.html

# Config Nginx : sert le frontend ET proxyfie /api vers le backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
