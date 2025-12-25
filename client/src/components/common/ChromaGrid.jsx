import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const ChromaGrid = ({
    children,
    radius = 300,
    damping = 0.45,
    fadeOut = 0.6,
    ease = 'power3.out'
}) => {
    const containerRef = useRef(null);
    const overlayRef = useRef(null);
    const fadeRef = useRef(null);
    const xTo = useRef(null);
    const yTo = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        const overlay = overlayRef.current;
        const fade = fadeRef.current;

        if (!container || !overlay || !fade) return;

        // Set CSS variables for radius
        container.style.setProperty('--r', `${radius}px`);
        overlay.style.setProperty('--r', `${radius}px`);
        fade.style.setProperty('--r', `${radius}px`);

        // Create GSAP quickTo animations for smooth mouse follow
        xTo.current = gsap.quickTo([container, overlay, fade], '--x', { duration: damping, ease });
        yTo.current = gsap.quickTo([container, overlay, fade], '--y', { duration: damping, ease });

        const handleMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            xTo.current(`${x}px`);
            yTo.current(`${y}px`);
        };

        const handleMouseLeave = () => {
            gsap.to(fade, { opacity: 1, duration: fadeOut, ease });
        };

        const handleMouseEnter = () => {
            gsap.to(fade, { opacity: 0, duration: fadeOut, ease });
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [radius, damping, fadeOut, ease]);

    return (
        <div className="chroma-grid-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={containerRef} className="token-grid">
                {children}
            </div>
            <div ref={overlayRef} className="chroma-overlay" />
            <div ref={fadeRef} className="chroma-fade" />
        </div>
    );
};

export default ChromaGrid;
