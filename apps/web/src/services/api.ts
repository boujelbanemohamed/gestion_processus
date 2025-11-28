import axios from 'axios';

// @ts-expect-error - Vite injecte les variables d'environnement via import.meta.env
const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Ne pas rediriger si on est déjà sur la page de login
      // Cela permet d'afficher les messages d'erreur de connexion
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      if (!isLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    // Pour les erreurs 403, on les rejette silencieusement (sans log dans la console)
    // Le message sera géré par les handlers dans les composants
    if (error.response?.status === 403) {
      // On retourne l'erreur mais sans que axios la logge automatiquement
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);
