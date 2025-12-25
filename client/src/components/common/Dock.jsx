import { useRef, useState } from 'react';
import { gsap } from 'gsap';

const Dock = ({
    items,
    panelHeight = 68,
    baseItemSize = 50,
    magnification = 70
}) => {
    const dockRef = useRef(null);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const handleMouseMove = (e) => {
        if (!dockRef.current) return;

        const dockItems = dockRef.current.querySelectorAll('.dock-item');
        const dockRect = dockRef.current.getBoundingClientRect();
        const mouseX = e.clientX - dockRect.left;

        dockItems.forEach((item, index) => {
            const itemRect = item.getBoundingClientRect();
            const itemCenterX = itemRect.left + itemRect.width / 2 - dockRect.left;
            const distance = Math.abs(mouseX - itemCenterX);
            const maxDistance = 150;

            let scale = 1;
            if (distance < maxDistance) {
                const proximity = 1 - distance / maxDistance;
                scale = 1 + (magnification / baseItemSize - 1) * proximity * proximity;
            }

            gsap.to(item, {
                width: baseItemSize * scale,
                height: baseItemSize * scale,
                duration: 0.2,
                ease: 'power2.out'
            });
        });
    };

    const handleMouseLeave = () => {
        if (!dockRef.current) return;
        setHoveredIndex(null);

        const dockItems = dockRef.current.querySelectorAll('.dock-item');
        dockItems.forEach((item) => {
            gsap.to(item, {
                width: baseItemSize,
                height: baseItemSize,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    };

    return (
        <div className="dock-outer">
            <div
                ref={dockRef}
                className="dock-panel"
                style={{ height: panelHeight }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {items.map((item, index) => (
                    <button
                        key={index}
                        className="dock-item"
                        style={{
                            width: baseItemSize,
                            height: baseItemSize
                        }}
                        onClick={item.onClick}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <span className="dock-icon">{item.icon}</span>
                        {hoveredIndex === index && (
                            <span className="dock-label">{item.label}</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Dock;
