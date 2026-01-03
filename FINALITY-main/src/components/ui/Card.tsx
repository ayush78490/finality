import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    glass?: boolean;
    onClick?: () => void;
}

export default function Card({
    children,
    className = '',
    hover = false,
    glass = false,
    onClick
}: CardProps) {
    const baseStyles = 'p-6 shadow-sm transition-all duration-200 relative';
    const hoverStyles = hover ? 'hover:shadow-md hover:-translate-y-0.5' : '';
    const clickableStyles = onClick ? 'cursor-pointer' : '';

    const classes = [
        baseStyles,
        hoverStyles,
        clickableStyles,
        glass ? 'glass' : '',
        className,
    ].filter(Boolean).join(' ');

    // Cyberpunk style: sharp corners, white border, angled clip
    const cardStyle: React.CSSProperties = glass ? {} : {
        backgroundColor: 'var(--color-bg-card)',
        border: '2px solid var(--color-accent-primary)',
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
        boxShadow: hover ? '0 0 20px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.05)' : 'inset 0 0 20px rgba(255, 255, 255, 0.05)',
    };

    return (
        <div className={classes} onClick={onClick} style={cardStyle}>
            {/* Corner accents */}
            <div className="absolute top-0 right-0 w-3 h-3" style={{ backgroundColor: 'var(--color-accent-primary)' }}></div>
            <div className="absolute bottom-0 left-0 w-3 h-3" style={{ backgroundColor: 'var(--color-accent-primary)' }}></div>
            {children}
        </div>
    );
}
