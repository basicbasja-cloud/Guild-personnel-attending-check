import { useState, useEffect } from 'react';
import type { Announcement } from '../../hooks/useAnnouncements';

interface AnnouncementEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, content: string, pinned: boolean) => Promise<boolean>;
  editTarget?: Announcement | null;
}

export function AnnouncementEditorModal({
  isOpen,
  onClose,
  onSave,
  editTarget,
}: AnnouncementEditorModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(editTarget?.title ?? '');
      setContent(editTarget?.content ?? '');
      setPinned(editTarget?.pinned ?? false);
      setSaving(false);
      setSaved(false);
    }
  }, [isOpen, editTarget]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const ok = await onSave(title.trim(), content.trim(), pinned);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => onClose(), 600);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel — slides up on mobile, centered on desktop */}
      <div
        className={`relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl bg-(--color-bg-secondary) border border-(--color-border)
          transition-all duration-300
          ${saved ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
          sm:mx-4 max-h-[85vh] flex flex-col`}
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) shrink-0">
          <h2 className="text-(--color-text-primary) font-bold text-lg">
            {editTarget ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated) transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-(--color-text-secondary) text-sm font-medium mb-1.5">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. War Schedule This Week"
              className="w-full px-3 py-2 rounded-lg bg-(--color-bg-elevated) border border-(--color-border)
                text-(--color-text-primary) placeholder-(--color-text-muted)
                focus:outline-none focus:ring-2 focus:ring-(--color-accent) transition-colors"
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-(--color-text-secondary) text-sm font-medium mb-1.5">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement here..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-(--color-bg-elevated) border border-(--color-border)
                text-(--color-text-primary) placeholder-(--color-text-muted)
                focus:outline-none focus:ring-2 focus:ring-(--color-accent) transition-colors resize-none"
              maxLength={5000}
            />
            <p className="text-(--color-text-muted) text-xs mt-1 text-right">
              {content.length}/5000
            </p>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-(--color-border) text-(--color-accent)
                focus:ring-(--color-accent) bg-(--color-bg-elevated)"
            />
            <span className="text-(--color-text-secondary) text-sm">
              📌 Pin this announcement (shows at top)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-(--color-border) shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-text-primary)
              hover:bg-(--color-bg-elevated) transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="px-5 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover)
              disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : editTarget ? 'Update' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
