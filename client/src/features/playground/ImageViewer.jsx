import { useState, useRef, useEffect } from 'react';
import { VscClose, VscZoomIn, VscZoomOut } from 'react-icons/vsc';

const ImageViewer = ({ src, alt, isOpen, onClose }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') handleZoomIn();
            if (e.key === '-') handleZoomOut();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + 0.25, 5));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - 0.25, 0.25));
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.max(0.25, Math.min(5, prev + delta)));
    };

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <div
            className="image-viewer-overlay"
            onClick={onClose}
            ref={containerRef}
        >
            <div className="image-viewer-controls">
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleZoomOut(); }} title="Zoom Out">
                    <VscZoomOut size={20} />
                </button>
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleZoomIn(); }} title="Zoom In">
                    <VscZoomIn size={20} />
                </button>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleReset(); }} title="Reset">
                    Reset
                </button>
                <button className="btn-icon" onClick={onClose} title="Close">
                    <VscClose size={20} />
                </button>
            </div>
            <div
                className="image-viewer-content"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <img
                    src={src}
                    alt={alt}
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                    draggable={false}
                />
            </div>
        </div>
    );
};

export default ImageViewer;
