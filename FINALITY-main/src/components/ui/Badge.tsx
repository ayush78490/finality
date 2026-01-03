import React from 'react';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    const baseStyles = 'inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide relative';

    const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
        default: {
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
        },
        success: {
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--color-success)',
            border: '1px solid var(--color-success)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
        },
        danger: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-danger)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
        },
        warning: {
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            color: 'var(--color-warning)',
            border: '1px solid var(--color-warning)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
        },
        info: {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--color-info)',
            border: '1px solid var(--color-info)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
        },
    };

    const classes = [baseStyles, className].filter(Boolean).join(' ');

    return <span className={classes} style={variantStyles[variant]}>{children}</span>;
}
