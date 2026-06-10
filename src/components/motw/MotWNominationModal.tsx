import { useState, useMemo } from 'react';
import { useMemberOfWeek } from '../../hooks/useMemberOfWeek';
import { useAllProfiles } from '../../hooks/useAllProfiles';

interface MotWNominationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MotWNominationModal({ isOpen, onClose }: MotWNominationModalProps) {
  const { current, nominate, remove } = useMemberOfWeek(true);
  const { profiles } = useAllProfiles();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.character_name ?? '').toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const handleNominate = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    const ok = await nominate(selectedUserId, reason.trim());
    setSaving(false);
    if (ok) {
      showToast('🌟 Member of the Week nominated!');
    } else {
      showToast('Failed to nominate');
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    const ok = await remove();
    setSaving(false);
    if (ok) {
      showToast('Member of the Week removed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] bg-(--color-bg-secondary) border border-(--color-border) rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) shrink-0">
          <h2 className="text-(--color-text-primary) font-bold text-lg">🌟 Member of the Week</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated) transition-colors">✕</button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-900/60 text-emerald-200 text-sm border border-emerald-700/50">
            {toast}
          </div>
        )}

        {/* Current MotW */}
        {current && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-amber-900/30 border border-amber-700/40">
            <p className="text-amber-300 text-xs font-semibold mb-1">Current</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌟</span>
                <span className="text-(--color-text-primary) text-sm font-medium">
                  {current.profile?.character_name ?? current.profile?.username ?? 'Unknown'}
                </span>
                {current.reason && (
                  <span className="text-(--color-text-muted) text-xs">— {current.reason}</span>
                )}
              </div>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="text-xs px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Select member */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-(--color-text-secondary) text-sm font-medium mb-1.5">Select Member</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full px-3 py-2 rounded-lg bg-(--color-bg-elevated) border border-(--color-border)
                text-(--color-text-primary) placeholder-(--color-text-muted) text-sm
                focus:outline-none focus:ring-2 focus:ring-(--color-accent) transition-colors"
              autoFocus
            />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1 border border-(--color-border) rounded-lg p-1">
            {filtered.slice(0, 30).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedUserId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                  ${selectedUserId === p.id
                    ? 'bg-(--color-accent)/20 text-(--color-text-primary) ring-1 ring-(--color-accent)'
                    : 'text-(--color-text-secondary) hover:bg-(--color-bg-elevated) hover:text-(--color-text-primary)'
                  }`}
              >
                {p.character_name ?? p.username}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-(--color-text-muted) text-sm text-center py-4">No members found</p>
            )}
          </div>

          <div>
            <label className="block text-(--color-text-secondary) text-sm font-medium mb-1.5">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this member deserves recognition..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-(--color-bg-elevated) border border-(--color-border)
                text-(--color-text-primary) placeholder-(--color-text-muted) text-sm
                focus:outline-none focus:ring-2 focus:ring-(--color-accent) transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-(--color-border) shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated) transition-colors text-sm font-medium">Cancel</button>
          <button
            onClick={handleNominate}
            disabled={saving || !selectedUserId}
            className="px-5 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            {saving ? 'Nominating…' : '🌟 Nominate'}
          </button>
        </div>
      </div>
    </div>
  );
}
