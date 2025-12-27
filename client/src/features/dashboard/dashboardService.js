import axiosClient from '../../api/axiosClient';

export const getDashboardData = async () => {
    return axiosClient.get('/admin/dashboard');
};

export default {
    getDashboardData
};
