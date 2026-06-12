import { useEffect, useState } from 'react';
import type { GuildEvent } from '../../types';

interface FloatingNotificationProps {
  event: GuildEvent;
  onDismiss: () => void;
  onClick: () => void;
}

export function FloatingNotification({ event, onDismiss, onClick }: FloatingNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200); // Wait for exit animation
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-slate-900 border border-emerald-700 rounded-xl shadow-2xl shadow-emerald-900/30 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl shrink-0">🏋️</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">New Training Scheduled!</p>
              <p className="text-emerald-300 text-xs mt-0.5 truncate">{event.title}</p>
              {event.event_date && (
                <p className="text-slate-400 text-xs mt-0.5">
                  {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {event.start_time ? ` at ${event.start_time}` : ''}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onClick}
                  className="text-xs px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
