import React, { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'xs' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'default',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantClass = styles[`variant_${variant}`] || styles.variant_default;
    const sizeClass = styles[`size_${size}`] || styles.size_default;

    return (
      <button
        ref={ref}
        type={props.type || 'button'}
        className={`${styles.button} ${variantClass} ${sizeClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';