import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import LanguageSelector from '../common/LanguageSelector';
import Dock from '../common/Dock';
import { VscHome, VscSettingsGear, VscSignOut, VscColorMode, VscHistory } from 'react-icons/vsc';

const MainLayout = () => {
    const { logout } = useAuth();
    const { t } = useI18n();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const activeTab = location.pathname.includes('settings')
        ? 'settings'
        : location.pathname.includes('history')
            ? 'history'
            : 'tokens';

    const dockItems = [
        {
            icon: <VscHome size={20} />,
            label: t('tabs.tokens'),
            onClick: () => navigate('/'),
            active: activeTab === 'tokens'
        },
        {
            icon: <VscHistory size={20} />,
            label: t('tabs.history') || 'History',
            onClick: () => navigate('/history'),
            active: activeTab === 'history'
        },
        {
            icon: <VscSettingsGear size={20} />,
            label: t('tabs.settings'),
            onClick: () => navigate('/settings'),
            active: activeTab === 'settings'
        },
        {
            icon: <VscSignOut size={20} />,
            label: t('app.logout'),
            onClick: logout
        },
    ];

    return (
        <div className="container">
            <div id="mainContent" className="main-content">
                <div className="header">
                    <Dock
                        items={dockItems}
                        panelHeight={48}
                        baseItemSize={36}
                        magnification={44}
                    />
                    <div className="header-right">
                        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                            <VscColorMode size={18} />
                        </button>
                        <LanguageSelector />
                    </div>
                </div>
                <div className="content">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;

