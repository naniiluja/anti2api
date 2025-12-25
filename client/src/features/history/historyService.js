import axiosClient from '../../api/axiosClient';

export const getHistory = async (limit = 100) => {
    return axiosClient.get(`/admin/history?limit=${limit}`);
};

export const clearHistory = async () => {
    return axiosClient.delete('/admin/history');
};

export default {
    getHistory,
    clearHistory
};
