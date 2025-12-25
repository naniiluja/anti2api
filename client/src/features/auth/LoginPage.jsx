import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import LanguageSelector from '../../components/common/LanguageSelector';

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
        <div className="container">
            <div id="loginForm" className="login-form" style={{ display: 'block' }}>
                <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                    <LanguageSelector />
                </div>
                <h2>{t('app.title')}</h2>
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
                        />
                    </div>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
                    <button type="submit">{t('app.login')}</button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;

