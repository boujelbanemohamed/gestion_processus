import { create } from 'zustand';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  entiteId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  loadFromStorage: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, refreshToken, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    delete (api.defaults.headers.common as any).Authorization;
    set({ user: null, token: null });
  },
  isAuthenticated: () => {
    return !!get().token;
  },
  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      set({ token, user: JSON.parse(userStr) });
    }
  },
}));
