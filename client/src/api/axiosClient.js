import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/', // Proxy handle base url
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`; // Hoặc header tùy chỉnh của app hiện tại
      // App cũ dùng header gì?
      // Xem public/js/auth.js để check. 
      // Main.js: headers: { 'Content-Type': 'application/json' } và body content.
      // Cần check xem auth token gửi đi ntn.
      // public/js/tokens.js: fetch('/admin/tokens?token=' + authToken) ?
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Handle 401 - Token expired or invalid
    if (error.response && error.response.status === 401) {
      // Clear token from localStorage
      localStorage.removeItem('authToken');

      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
