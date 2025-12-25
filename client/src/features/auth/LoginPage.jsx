import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import LanguageSelector from '../../components/common/LanguageSelector';
import Squares from '../../components/ui/Squares';
import SpotlightCard from '../../components/ui/SpotlightCard';
import './LoginPage.css';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const result = await login(username, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.message || t('messages.loginFailed'));
        }
    };

    return (
        <div className="login-page">
            {/* Animated squares background */}
            <div className="login-background">
                <Squares
                    speed={0.5}
                    squareSize={40}
                    direction="diagonal"
                    borderColor="#333"
                    hoverFillColor="#1a1a2e"
                />
            </div>

            {/* Login form with spotlight effect */}
            <div className="login-container">
                <SpotlightCard
                    className="login-spotlight-card"
                    spotlightColor="rgba(99, 102, 241, 0.2)"
                >
                    <div className="login-form-content">
                        <div className="login-header">
                            <LanguageSelector />
                        </div>
                        <h2 className="login-title">{t('app.title')}</h2>
                        <form id="login" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>{t('app.username')}</label>
                                <input
                                    type="text"
                                    id="username"
                                    required
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="login-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('app.password')}</label>
                                <input
                                    type="password"
                                    id="password"
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="login-input"
                                />
                            </div>
                            {error && <div className="login-error">{error}</div>}
                            <button type="submit" className="login-button">{t('app.login')}</button>
                        </form>
                    </div>
                </SpotlightCard>
            </div>
        </div>
    );
};

export default LoginPage;

