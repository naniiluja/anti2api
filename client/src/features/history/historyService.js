import axiosClient from '../../api/axiosClient';

export const getHistory = async (limit = 100) => {
    return axiosClient.get(`/admin/history?limit=${limit}`);
};

export const addHistory = async (entry) => {
    return axiosClient.post('/admin/history', entry);
};

export const clearHistory = async () => {
    return axiosClient.delete('/admin/history');
};

export default {
    getHistory,
    addHistory,
    clearHistory
};
