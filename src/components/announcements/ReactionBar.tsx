import { useState } from 'react';
import type { ReactionSummary } from '../../types';

const ALL_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;

interface ReactionBarProps {
  /** Current summary for this announcement */
  summary: ReactionSummary[];
  /** Is the current user logged in? */
  canReact: boolean;
  /** Called when user clicks an emoji */
  onToggle: (emoji: string) => Promise<void>;
  /** Called when user clicks an emoji not in the summary yet */
  onAdd: (emoji: string) => Promise<void>;
}

export function ReactionBar({ summary, canReact, onToggle, onAdd }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleClick = async (emoji: string) => {
    const existing = summary.find((s) => s.emoji === emoji);
    if (existing) {
      await onToggle(emoji);
    } else {
      await onAdd(emoji);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-3">
      {/* Existing reactions */}
      {summary.map((s) => (
        <button
          key={s.emoji}
          onClick={() => canReact && handleClick(s.emoji)}
          disabled={!canReact}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all
            ${s.reacted
              ? 'bg-indigo-900/50 border border-indigo-600/60 text-indigo-200'
              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
            }
            disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <span className="text-sm leading-none">{s.emoji}</span>
          <span className="tabular-nums">{s.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      {canReact && (
        <div className="relative">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full
              bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300
              hover:border-slate-500 transition-all text-xs"
            title="Add reaction"
          >
            +
          </button>

          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-slate-900 border border-slate-700
                rounded-xl shadow-2xl p-2 flex gap-1">
                {ALL_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleClick(emoji);
                      setPickerOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg
                      hover:bg-slate-800 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
