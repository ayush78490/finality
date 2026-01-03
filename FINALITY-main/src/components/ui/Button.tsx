import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    children: React.ReactNode;
}

export default function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    style,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold border-none cursor-pointer transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden';

    const sizeStyles = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-3 text-lg',
    };

    const variantStyles: Record<ButtonVariant, { className: string; style?: React.CSSProperties }> = {
        primary: {
            className: 'hover:-translate-y-0.5 active:translate-y-0',
            style: {
                backgroundColor: 'var(--color-accent-primary)',
                color: '#000000',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
            },
        },
        secondary: {
            className: 'text-white',
            style: {
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '2px solid var(--color-border-light)',
                color: 'var(--color-text-primary)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            },
        },
        success: {
            className: 'text-white hover:-translate-y-0.5',
            style: {
                backgroundColor: 'var(--color-success)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            },
        },
        danger: {
            className: 'text-white hover:-translate-y-0.5',
            style: {
                backgroundColor: 'var(--color-danger)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            },
        },
        ghost: {
            className: 'border-2',
            style: {
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            },
        },
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    const variantConfig = variantStyles[variant];
    const classes = [
        baseStyles,
        sizeStyles[size],
        variantConfig.className,
        widthStyle,
        className,
    ].filter(Boolean).join(' ');

    const combinedStyle = { ...variantConfig.style, ...style };

    return (
        <button className={classes} style={combinedStyle} {...props}>
            {children}
        </button>
    );
}
