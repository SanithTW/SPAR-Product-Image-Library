import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const GUEST_ACCESS_KEY = 'spar_download_access';

/** Temporary download access from an access code: { token, label, expiresAt } or null if missing/expired. */
export function getGuestAccess() {
  try {
    const access = JSON.parse(localStorage.getItem(GUEST_ACCESS_KEY) || 'null');
    if (access?.token && new Date(access.expiresAt).getTime() > Date.now()) return access;
  } catch {
    // Unreadable storage counts as no access.
  }
  return null;
}

export function saveGuestAccess(access) {
  try {
    localStorage.setItem(GUEST_ACCESS_KEY, JSON.stringify(access));
  } catch {
    // Storage blocked: access lasts only for this page view.
  }
}

export function clearGuestAccess() {
  try {
    localStorage.removeItem(GUEST_ACCESS_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Admin token if signed in, otherwise a valid access-code token, otherwise null. */
export function getAuthToken() {
  return localStorage.getItem('spar_admin_token') || getGuestAccess()?.token || null;
}

/** Headers for plain fetch() calls to protected endpoints such as downloads. */
export function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Interceptor to attach JWT token to all requests if available
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const redeemAccessCode = async (code) => {
  const response = await api.post('/auth/access-code', { code });
  return response.data;
};

export const listAccessCodes = async () => {
  const response = await api.get('/access-codes');
  return response.data.codes || [];
};

/** expiry: { hours } | { expiresAt } | { permanent: true }; watermark: add SPAR logo to downloads */
export const createAccessCode = async (label, expiry, watermark = true) => {
  const response = await api.post('/access-codes', { label, ...expiry, watermark });
  return response.data.accessCode;
};

export const setAccessCodeWatermark = async (id, watermark) => {
  const response = await api.patch(`/access-codes/${id}`, { watermark });
  return response.data.accessCode;
};

export const deleteAccessCode = async (id) => {
  const response = await api.delete(`/access-codes/${id}`);
  return response.data;
};

export const getProducts = async (q = '') => {
  const params = q ? { q } : {};
  const response = await api.get('/products', { params });
  return response.data;
};

export const getProductById = async (id) => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};

export const uploadProduct = async (formData) => {
  const response = await api.post('/products', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateProduct = async (id, formData) => {
  const response = await api.put(`/products/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

export const loginAdmin = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const verifyAdminSession = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getDownloadUrl = (id, options = {}) => {
  const base = import.meta.env.VITE_API_URL || '/api';
  const params = new URLSearchParams();
  if (options.size !== undefined) {
    params.set('size', options.size);
  }
  if (options.fit) {
    params.set('fit', options.fit);
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return `${base}/products/${id}/download${query}`;
};

export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || '';
  if (apiBase) {
    const serverOrigin = apiBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    return `${serverOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
};

export default api;
