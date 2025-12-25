import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
// Lazy load pages later if needed, direct import for now
import LoginPage from '../features/auth/LoginPage';
import TokensPage from '../features/tokens/TokensPage';
import SettingsPage from '../features/settings/SettingsPage';
import HistoryPage from '../features/history/HistoryPage';
import PlaygroundPage from '../features/playground/PlaygroundPage';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <div>Loading...</div>; // Simple loading state
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return children;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route index element={<TokensPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="playground" element={<PlaygroundPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRoutes;
