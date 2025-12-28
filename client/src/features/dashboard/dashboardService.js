import axiosClient from '../../api/axiosClient';

export const getDashboardData = async (date = null) => {
    const params = date ? `?date=${date}` : '';
    return axiosClient.get(`/admin/dashboard${params}`);
};

export const getAvailableDates = async () => {
    return axiosClient.get('/admin/dashboard/dates');
};

export default {
    getDashboardData,
    getAvailableDates
};
