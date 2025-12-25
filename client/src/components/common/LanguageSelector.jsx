import { useI18n } from '../../context/I18nContext';

const LanguageSelector = ({ className }) => {
    const { language, changeLanguage } = useI18n();

    return (
        <select
            className={`language-selector ${className || ''}`}
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
        >
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇺🇸 English</option>
        </select>
    );
};

export default LanguageSelector;
