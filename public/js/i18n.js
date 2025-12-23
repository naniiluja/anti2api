// i18n Module - Internationalization using i18next
// Supports: Vietnamese (vi), English (en)

let i18nextInstance = null;
let currentLanguage = localStorage.getItem('language') || 'vi';

const resources = {
    vi: null,
    en: null
};

// Load translation file
async function loadTranslations(lang) {
    if (resources[lang]) return resources[lang];
    
    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
        resources[lang] = await response.json();
        return resources[lang];
    } catch (error) {
        console.error(`Failed to load ${lang} translations:`, error);
        return null;
    }
}

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
        current && current[key] !== undefined ? current[key] : null, obj);
}

// Translation function
function t(key, params = {}) {
    const translation = getNestedValue(resources[currentLanguage], key);
    
    if (!translation) {
        // Fallback to English
        const fallback = getNestedValue(resources['en'], key);
        if (!fallback) return key;
        return interpolate(fallback, params);
    }
    
    return interpolate(translation, params);
}

// Interpolate variables in translation string
function interpolate(str, params) {
    if (!params || typeof str !== 'string') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => 
        params[key] !== undefined ? params[key] : match);
}

// Change language
async function changeLanguage(lang) {
    if (!['vi', 'en'].includes(lang)) return;
    
    // Load translations if not already loaded
    if (!resources[lang]) {
        await loadTranslations(lang);
    }
    
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    // Update language selector
    const selector = document.getElementById('languageSelector');
    if (selector) selector.value = lang;
    
    // Update all translatable elements
    updatePageTranslations();
}

// Update all elements with data-i18n attribute
function updatePageTranslations() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);
        if (translation && translation !== key) {
            el.textContent = translation;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translation = t(key);
        if (translation && translation !== key) {
            el.placeholder = translation;
        }
    });
    
    // Update titles/tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const translation = t(key);
        if (translation && translation !== key) {
            el.title = translation;
        }
    });
    
    // Update data-tooltip (for help tips)
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        const translation = t(key);
        if (translation && translation !== key) {
            el.setAttribute('data-tooltip', translation);
        }
    });
    
    // Update document title
    document.title = t('app.title');
    
    // Update html lang attribute
    document.documentElement.lang = currentLanguage === 'vi' ? 'vi' : 'en';
}

// Initialize i18n
async function initI18n() {
    // Load both languages
    await Promise.all([
        loadTranslations('vi'),
        loadTranslations('en')
    ]);
    
    // Create language selector if not exists
    createLanguageSelector();
    
    // Apply initial translations
    updatePageTranslations();
}

// Create language selector dropdown
function createLanguageSelector() {
    // Create selector for login form (always visible)
    const loginForm = document.getElementById('loginForm');
    if (loginForm && !loginForm.querySelector('.language-selector')) {
        const loginSelector = createSelectorElement('languageSelectorLogin');
        // Add to top of login form
        const loginWrapper = document.createElement('div');
        loginWrapper.className = 'language-selector-wrapper';
        loginWrapper.style.cssText = 'text-align: right; margin-bottom: 1rem;';
        loginWrapper.appendChild(loginSelector);
        loginForm.insertBefore(loginWrapper, loginForm.firstChild);
    }
    
    // Create selector for header (after login)
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !headerRight.querySelector('.language-selector')) {
        const headerSelector = createSelectorElement('languageSelector');
        headerRight.insertBefore(headerSelector, headerRight.firstChild);
    }
}

// Helper to create selector element
function createSelectorElement(id) {
    const selector = document.createElement('select');
    selector.id = id;
    selector.className = 'language-selector';
    selector.innerHTML = `
        <option value="vi">🇻🇳 Tiếng Việt</option>
        <option value="en">🇺🇸 English</option>
    `;
    selector.value = currentLanguage;
    selector.onchange = (e) => {
        changeLanguage(e.target.value);
        // Sync all selectors
        document.querySelectorAll('.language-selector').forEach(sel => {
            sel.value = e.target.value;
        });
    };
    return selector;
}

// Get current language
function getCurrentLanguage() {
    return currentLanguage;
}

// Export for global use
window.t = t;
window.changeLanguage = changeLanguage;
window.initI18n = initI18n;
window.updatePageTranslations = updatePageTranslations;
window.getCurrentLanguage = getCurrentLanguage;
