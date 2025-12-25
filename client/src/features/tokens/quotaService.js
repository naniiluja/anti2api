import axiosClient from '../../api/axiosClient';

const quotaService = {
  getSummary: async (refreshToken) => {
    return await axiosClient.get(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas`);
  },

  refresh: async (refreshToken) => {
    return await axiosClient.get(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas?refresh=true`);
  }
};

export default quotaService;
