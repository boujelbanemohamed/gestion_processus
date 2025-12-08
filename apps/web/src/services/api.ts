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

// Variable pour éviter les boucles infinies de rafraîchissement
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercepteur pour gérer les erreurs et le rafraîchissement du token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si l'erreur est 401 et qu'on n'a pas déjà tenté de rafraîchir
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest) {
      console.log('[Token Refresh] Erreur 401 détectée, tentative de rafraîchissement...');
      console.log('[Token Refresh] URL de la requête originale:', originalRequest.url);
      console.log('[Token Refresh] Méthode:', originalRequest.method);
      
      // Ne pas rediriger si on est déjà sur la page de login
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      if (isLoginPage) {
        console.log('[Token Refresh] Sur la page de login, pas de rafraîchissement');
        return Promise.reject(error);
      }

      // Si on est déjà en train de rafraîchir, mettre la requête en queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      console.log('[Token Refresh] RefreshToken présent:', !!refreshToken);
      if (!refreshToken) {
        // Pas de refresh token, déconnexion
        console.log('[Token Refresh] Aucun refreshToken trouvé, déconnexion...');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        processQueue(error, null);
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Essayer de rafraîchir le token (utiliser axios directement pour éviter la boucle)
        console.log('[Token Refresh] Tentative de rafraîchissement du token...');
        const refreshUrl = `${API_BASE_URL}/auth/refresh`;
        console.log('[Token Refresh] URL:', refreshUrl);
        
        const response = await axios.post(refreshUrl, {
          refreshToken,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('[Token Refresh] Réponse reçue:', response.status);
        console.log('[Token Refresh] Données de réponse:', response.data);
        const { token: newToken } = response.data;
        
        if (!newToken) {
          console.error('[Token Refresh] ERREUR: Nouveau token non reçu dans la réponse');
          throw new Error('Nouveau token non reçu');
        }
        
        console.log('[Token Refresh] Nouveau token reçu, longueur:', newToken.length);
        localStorage.setItem('token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        console.log('[Token Refresh] Token rafraîchi avec succès, nouvelle requête en cours...');
        processQueue(null, newToken);
        isRefreshing = false;

        // Réessayer la requête originale avec le nouveau token
        console.log('[Token Refresh] Réessai de la requête originale:', originalRequest.url);
        return api(originalRequest);
      } catch (refreshError: any) {
        // Le rafraîchissement a échoué, déconnexion
        console.error('[Token Refresh] Erreur lors du rafraîchissement:', refreshError);
        console.error('[Token Refresh] Détails:', {
          message: refreshError.message,
          response: refreshError.response?.data,
          status: refreshError.response?.status,
          url: refreshError.config?.url,
        });
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Pour les erreurs 403, on les rejette silencieusement (sans log dans la console)
    // Le message sera géré par les handlers dans les composants
    if (error.response?.status === 403) {
      // On retourne l'erreur mais sans que axios la logge automatiquement
      return Promise.reject(error);
    }
    
    // Log pour les autres erreurs (sauf 401 déjà géré)
    if (error.response?.status !== 401) {
      console.log('[API] Erreur non-401:', error.response?.status, error.config?.url);
    }
    
    return Promise.reject(error);
  }
);
