import type { Title } from '../../hooks/useTitles';

interface TitleBadgeProps {
  title: Title;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TitleBadge({ title, size = 'sm', className = '' }: TitleBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium transition-opacity duration-200
        bg-violet-900/50 text-violet-200 border border-violet-600/40
        ${sizeClasses[size]} ${className}`}
      title={title.description ?? title.name}
    >
      <span>{title.icon_emoji}</span>
      <span className="truncate max-w-30">{title.name}</span>
    </span>
  );
}
