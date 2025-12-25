import { useState, useEffect } from 'react';

const useTheme = () => {
    const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('fontSize')) || 18);

    useEffect(() => {
        document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
        localStorage.setItem('fontSize', fontSize);
    }, [fontSize]);

    const changeFontSize = (size) => {
        const newSize = Math.max(10, Math.min(24, parseInt(size) || 14));
        setFontSize(newSize);
    };

    return { fontSize, changeFontSize };
};

export default useTheme;
