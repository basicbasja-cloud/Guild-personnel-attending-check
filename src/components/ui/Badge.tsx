import { useEffect, useState } from 'react';

interface BadgeProps {
  count: number;
  size?: 'sm' | 'md';
  color?: string;
  pulse?: boolean;
}

export function Badge({ count, size = 'sm', color, pulse = false }: BadgeProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (count > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 200);
      return () => clearTimeout(timer);
    }
  }, [count]);

  if (count <= 0) return null;

  const sizeClasses = size === 'sm'
    ? 'min-w-[18px] h-[18px] text-[10px] px-1'
    : 'min-w-[22px] h-[22px] text-xs px-1.5';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold leading-none select-none
        ${sizeClasses}
        ${color ?? 'bg-rose-600 text-white'}
        ${animate ? 'scale-110' : 'scale-100'}
        ${pulse ? 'animate-pulse' : ''}
        transition-transform duration-150
      `}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
