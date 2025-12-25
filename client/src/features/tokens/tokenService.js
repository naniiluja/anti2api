import axiosClient from '../../api/axiosClient';

const tokenService = {
  getAll: async () => {
    return await axiosClient.get('/admin/tokens');
  },
  
  add: async (data) => {
    return await axiosClient.post('/admin/tokens', data);
  },

  update: async (refreshToken, data) => {
    return await axiosClient.put(`/admin/tokens/${encodeURIComponent(refreshToken)}`, data);
  },

  delete: async (refreshToken) => {
    return await axiosClient.delete(`/admin/tokens/${encodeURIComponent(refreshToken)}`);
  },

  refresh: async (refreshToken) => {
    return await axiosClient.post(`/admin/tokens/${encodeURIComponent(refreshToken)}/refresh`);
  }
};

export default tokenService;
