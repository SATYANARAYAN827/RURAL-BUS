import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverEffect?: boolean;
}

export const Card: FC<CardProps> = ({
  children,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg ${
        hoverEffect
          ? 'hover:border-slate-700 hover:shadow-slate-800/30 transition-all duration-200'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
