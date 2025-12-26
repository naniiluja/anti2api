import { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext({
    user: null,
    token: null,
    login: () => { },
    logout: () => { },
    isAuthenticated: false,
    isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('authToken'));
    // const [user, setUser] = useState(null); // This backend doesn't return a user object on login, only a token.
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if token is valid? Backend doesn't have /me endpoint visible in docs, 
        // but we can assume if token exists it's "logged in" until 401.
        // Or we can try to fetch tokens list to validate.
        setIsLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            // Backend: POST /admin/login { username, password }
            // Response: { success: true, token: "..." }
            const response = await axiosClient.post('/admin/login', { username, password });
            if (response.success) {
                setToken(response.token);
                localStorage.setItem('authToken', response.token);
                return { success: true };
            }
            return { success: false, message: response.message };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || error.message };
        }
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('authToken');
    };

    const value = {
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
