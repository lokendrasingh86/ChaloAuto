import axios from 'axios';

export const API_ORIGIN: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired or invalid session sends the user back to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    const isAuthCall = url.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthCall && localStorage.getItem('token')) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
