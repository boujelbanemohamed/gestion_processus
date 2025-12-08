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
  // Si le header Authorization est déjà défini (cas du retry après rafraîchissement), le garder
  if (config.headers.Authorization && config.headers.Authorization.startsWith('Bearer ')) {
    console.log('[Request Interceptor] Token déjà présent dans headers, conservation');
    return config;
  }
  
  // Sinon, récupérer le token depuis localStorage
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[Request Interceptor] Token ajouté depuis localStorage');
  } else {
    console.warn('[Request Interceptor] Aucun token trouvé dans localStorage');
  }
  return config;
});

// Variable pour éviter les boucles infinies de rafraîchissement
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 2;

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
    // ET qu'on n'a pas explicitement demandé de ne pas rafraîchir
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest._skipRefresh) {
      // Protection contre les boucles infinies
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.error('[Token Refresh] Trop de tentatives de rafraîchissement (' + refreshAttempts + '), déconnexion...');
        refreshAttempts = 0;
        isRefreshing = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      // Vérifier si on est déjà en train de rafraîchir (double protection)
      if (isRefreshing) {
        console.log('[Token Refresh] Déjà en cours de rafraîchissement, mise en queue...');
        // Ne pas incrémenter refreshAttempts ici car c'est déjà géré
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (!originalRequest.headers) {
              originalRequest.headers = {} as any;
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            api.defaults.headers.common.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }
      
      console.log('[Token Refresh] Erreur 401 détectée, tentative de rafraîchissement...');
      console.log('[Token Refresh] URL de la requête originale:', originalRequest.url);
      console.log('[Token Refresh] Méthode:', originalRequest.method);
      console.log('[Token Refresh] Tentative:', refreshAttempts + 1, '/', MAX_REFRESH_ATTEMPTS);
      
      // Ne pas rediriger si on est déjà sur la page de login
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      if (isLoginPage) {
        console.log('[Token Refresh] Sur la page de login, pas de rafraîchissement');
        return Promise.reject(error);
      }


      // Marquer la requête comme retry pour éviter les boucles infinies
      originalRequest._retry = true;
      isRefreshing = true;
      
      // Incrémenter AVANT le rafraîchissement pour compter correctement
      refreshAttempts++;
      console.log('[Token Refresh] Compteur de tentatives:', refreshAttempts);

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
        
        // Sauvegarder le nouveau token dans localStorage AVANT tout
        localStorage.setItem('token', newToken);
        
        // Vérifier que le token est bien sauvegardé
        const savedToken = localStorage.getItem('token');
        if (savedToken !== newToken) {
          console.error('[Token Refresh] ERREUR: Le token n\'a pas été correctement sauvegardé dans localStorage');
          throw new Error('Échec de la sauvegarde du token');
        }
        
        // Mettre à jour les headers par défaut d'axios
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

        console.log('[Token Refresh] Token rafraîchi et sauvegardé avec succès');
        
        // Traiter la queue AVANT de réessayer
        processQueue(null, newToken);
        isRefreshing = false;
        
        // Réinitialiser le compteur de tentatives après un rafraîchissement réussi
        refreshAttempts = 0;

        // Réessayer la requête originale avec le nouveau token
        console.log('[Token Refresh] Réessai de la requête originale:', originalRequest.url);
        console.log('[Token Refresh] Méthode:', originalRequest.method);
        
        // Créer une NOUVELLE configuration complètement indépendante
        // Ne PAS utiliser spread car cela peut copier des références
        const retryConfig: any = {
          method: originalRequest.method,
          url: originalRequest.url,
          baseURL: originalRequest.baseURL || API_BASE_URL,
          params: originalRequest.params,
          data: originalRequest.data,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`, // Forcer le nouveau token explicitement
          },
        };
        
        // IMPORTANT: Garder _retry pour éviter une nouvelle boucle
        // Si cette requête échoue encore, on ne veut PAS rafraîchir à nouveau
        retryConfig._retry = true;
        retryConfig._skipRefresh = true; // Flag supplémentaire pour éviter le rafraîchissement
        
        console.log('[Token Refresh] Configuration de retry créée avec nouveau token');
        console.log('[Token Refresh] Token utilisé (premiers 50 chars):', newToken.substring(0, 50) + '...');
        console.log('[Token Refresh] Header Authorization:', retryConfig.headers.Authorization.substring(0, 50) + '...');
        
        // Vérifier que le token dans localStorage correspond
        const tokenInStorage = localStorage.getItem('token');
        console.log('[Token Refresh] Token dans localStorage (premiers 50 chars):', tokenInStorage?.substring(0, 50) + '...');
        console.log('[Token Refresh] Tokens correspondent:', tokenInStorage === newToken);
        
        // L'intercepteur de requête ajoutera aussi le token depuis localStorage
        // Mais on force déjà le token dans les headers pour être sûr
        return api(retryConfig);
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
        refreshAttempts = 0; // Réinitialiser le compteur
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
