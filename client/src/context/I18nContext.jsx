import { createContext, useContext, useState, useEffect } from 'react';

const I18nContext = createContext({
    t: (key, params) => key,
    language: 'vi',
    changeLanguage: () => { },
    isLoading: true,
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider = ({ children }) => {
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'vi');
    const [resources, setResources] = useState({ vi: null, en: null });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadLang = async (lang) => {
            if (resources[lang]) return;
            try {
                const response = await fetch(`/locales/${lang}.json`);
                const data = await response.json();
                setResources(prev => ({ ...prev, [lang]: data }));
            } catch (error) {
                console.error(`Failed to load ${lang} translations`, error);
            }
        };

        const init = async () => {
            await Promise.all([loadLang('vi'), loadLang('en')]);
            setIsLoading(false);
        };

        init();
    }, []); // Load both on mount for simplicity

    useEffect(() => {
        localStorage.setItem('language', language);
        document.documentElement.lang = language;
    }, [language]);

    const changeLanguage = (lang) => {
        setLanguage(lang);
    };

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) =>
            current && current[key] !== undefined ? current[key] : null, obj);
    };

    const interpolate = (str, params) => {
        if (!params || typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+)\}\}/g, (match, key) =>
            params[key] !== undefined ? params[key] : match);
    };

    const t = (key, params = {}) => {
        if (isLoading || !resources[language]) return key;

        let translation = getNestedValue(resources[language], key);
        if (!translation && language !== 'en') {
            translation = getNestedValue(resources['en'], key);
        }

        return translation ? interpolate(translation, params) : key;
    };

    return (
        <I18nContext.Provider value={{ t, language, changeLanguage, isLoading }}>
            {children}
        </I18nContext.Provider>
    );
};
