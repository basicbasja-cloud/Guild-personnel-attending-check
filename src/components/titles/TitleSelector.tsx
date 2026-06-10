import { useState } from 'react';
import { useUserTitles, useAllTitles } from '../../hooks/useTitles';
import { TitleBadge } from './TitleBadge';

interface TitleSelectorProps {
  userId: string;
}

export function TitleSelector({ userId }: TitleSelectorProps) {
  const { userTitles, activeTitle, loading, setActive } = useUserTitles(userId);
  const { titles } = useAllTitles();
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-(--color-bg-elevated) rounded-lg animate-pulse" />
      </div>
    );
  }

  if (userTitles.length === 0) {
    return (
      <div className="text-(--color-text-muted) text-sm py-2">
        No titles earned yet. Earn them through attendance streaks or get assigned by officers!
      </div>
    );
  }

  const handleSelect = async (titleId: string) => {
    setSaving(true);
    await setActive(titleId);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {activeTitle && (
        <div className="flex items-center gap-2">
          <span className="text-(--color-text-secondary) text-xs font-medium">Currently displaying:</span>
          <TitleBadge
            title={titles.find((t) => t.id === activeTitle.title_id) ?? {
              id: activeTitle.title_id,
              name: 'Unknown',
              description: null,
              icon_emoji: '🏅',
              is_auto: false,
              rule_trigger: null,
            }}
            size="md"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {userTitles.map((ut) => {
          const t = titles.find((x) => x.id === ut.title_id);
          if (!t) return null;
          return (
            <button
              key={ut.id}
              onClick={() => handleSelect(ut.title_id)}
              disabled={saving || ut.is_active}
              className={`transition-all duration-200 rounded-lg
                ${ut.is_active
                  ? 'ring-2 ring-(--color-accent) ring-offset-2 ring-offset-(--color-bg-primary) opacity-100'
                  : 'opacity-60 hover:opacity-100 hover:ring-1 hover:ring-(--color-border)'
                }`}
            >
              <TitleBadge title={t} size="md" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
