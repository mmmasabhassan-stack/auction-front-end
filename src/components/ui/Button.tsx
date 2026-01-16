import React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
};

export function Button(props: ButtonProps) {
  const { className, variant = 'primary', size = 'md', ...rest } = props;
  const variantClass =
    variant === 'primary'
      ? 'btn btn-primary'
      : variant === 'secondary'
        ? 'btn btn-secondary'
        : variant === 'success'
          ? 'btn btn-success'
          : variant === 'danger'
            ? 'btn btn-danger'
            : variant === 'warning'
              ? 'btn btn-warning'
              : 'btn btn-info';
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-large' : '';
  return <button className={[variantClass, sizeClass, className].filter(Boolean).join(' ')} {...rest} />;
}

