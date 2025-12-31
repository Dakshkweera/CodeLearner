import axios, {type AxiosInstance,type  AxiosError } from 'axios';
import config from '../config/config';
import type { ApiError } from '../types';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (for future auth tokens)
apiClient.interceptors.request.use(
  (config) => {
    // Future: Add auth token here
    // config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (error handling)
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: error.message || 'An unexpected error occurred',
      code: error.code,
      status: error.response?.status,
    };

    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      apiError.message = 'Request timeout - server took too long to respond';
    } else if (!error.response) {
      apiError.message = 'Cannot connect to server. Is the backend running?';
    } else if (error.response.status === 404) {
      apiError.message = 'Resource not found';
    } else if (error.response.status === 500) {
      apiError.message = 'Server error - please try again later';
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;
