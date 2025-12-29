import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ComposeProviders from './components/common/ComposeProviders';
import AppRoutes from './routes/AppRoutes';
import './index.css';

// Provider order (inside-out): Auth -> Confirm -> Toast -> I18n
// Auth is innermost as it may depend on other contexts
const providers = [
  I18nProvider,
  ToastProvider,
  ConfirmProvider,
  AuthProvider,
];

function App() {
  return (
    <BrowserRouter>
      <ComposeProviders providers={providers}>
        <AppRoutes />
      </ComposeProviders>
    </BrowserRouter>
  );
}

export default App;
