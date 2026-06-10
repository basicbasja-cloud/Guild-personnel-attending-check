import { useState, useEffect } from 'react';
import { useAllTitles } from '../../hooks/useTitles';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { supabase } from '../../lib/supabase';
import { TitleBadge } from './TitleBadge';
import type { Title, UserTitle } from '../../hooks/useTitles';
import type { Profile } from '../../types';

interface TitleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TitleManagerModal({ isOpen, onClose }: TitleManagerModalProps) {
  const { titles, refresh: refreshTitles } = useAllTitles();
  const { profiles } = useAllProfiles();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New title form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏅');
  const [newTrigger, setNewTrigger] = useState('');

  // Assign title
  const [assigningTitleId, setAssigningTitleId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(null);
      setUserTitles([]);
      setSearch('');
      setShowCreateForm(false);
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.character_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const loadUserTitles = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('user_titles')
      .select('*, title:titles(*)')
      .eq('user_id', userId);
    setUserTitles((data as UserTitle[]) ?? []);
    setLoading(false);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    loadUserTitles(userId);
  };

  const handleAssign = async (titleId: string) => {
    if (!selectedUserId) return;
    setAssigningTitleId(titleId);
    const { error } = await supabase
      .from('user_titles')
      .insert({ user_id: selectedUserId, title_id: titleId, is_auto: false });
    setAssigningTitleId(null);
    if (error) {
      showToast(error.message);
    } else {
      showToast('Title assigned!');
      loadUserTitles(selectedUserId);
    }
  };

  const handleRemove = async (titleId: string) => {
    if (!selectedUserId) return;
    const { error } = await supabase
      .from('user_titles')
      .delete()
      .eq('user_id', selectedUserId)
      .eq('title_id', titleId);
    if (error) {
      showToast(error.message);
    } else {
      showToast('Title removed');
      loadUserTitles(selectedUserId);
    }
  };

  const handleCreateTitle = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('titles').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      icon_emoji: newEmoji,
      is_auto: !!newTrigger.trim(),
      rule_trigger: newTrigger.trim() || null,
    });
    if (error) {
      showToast(error.message);
    } else {
      showToast('Title created!');
      setNewName('');
      setNewDesc('');
      setNewEmoji('🏅');
      setNewTrigger('');
      setShowCreateForm(false);
      refreshTitles();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[85vh] bg-(--color-bg-secondary) border border-(--color-border) rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) shrink-0">
          <h2 className="text-(--color-text-primary) font-bold text-lg">👑 Title Manager</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated) transition-colors">✕</button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-900/60 text-emerald-200 text-sm border border-emerald-700/50 transition-all">
            {toast}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left: User list */}
          <div className="w-1/2 border-r border-(--color-border) flex flex-col">
            <div className="p-3 border-b border-(--color-border)">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full px-3 py-1.5 rounded-lg bg-(--color-bg-elevated) border border-(--color-border)
                  text-(--color-text-primary) placeholder-(--color-text-muted) text-sm
                  focus:outline-none focus:ring-2 focus:ring-(--color-accent) transition-colors"
              />
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {filteredProfiles.slice(0, 50).map((p: Profile) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedUserId === p.id
                      ? 'bg-(--color-accent)/20 text-(--color-text-primary)'
                      : 'text-(--color-text-secondary) hover:bg-(--color-bg-elevated) hover:text-(--color-text-primary)'
                    }`}
                >
                  {p.character_name ?? p.username}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Title management */}
          <div className="w-1/2 flex flex-col">
            {selectedUserId ? (
              <>
                {/* User's current titles */}
                <div className="p-3 border-b border-(--color-border)">
                  <p className="text-(--color-text-secondary) text-xs font-medium mb-2 uppercase tracking-wide">Earned Titles</p>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <div key={i} className="h-7 bg-(--color-bg-elevated) rounded animate-pulse" />)}
                    </div>
                  ) : userTitles.length === 0 ? (
                    <p className="text-(--color-text-muted) text-sm">No titles yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userTitles.map((ut) => (
                        <div key={ut.id} className="flex items-center justify-between">
                          {ut.title && <TitleBadge title={ut.title} />}
                          <button
                            onClick={() => handleRemove(ut.title_id)}
                            className="text-(--color-text-muted) hover:text-rose-400 text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available titles to assign */}
                <div className="p-3 overflow-y-auto flex-1">
                  <p className="text-(--color-text-secondary) text-xs font-medium mb-2 uppercase tracking-wide">Assign Title</p>
                  <div className="space-y-1">
                    {titles
                      .filter((t) => !userTitles.some((ut) => ut.title_id === t.id))
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleAssign(t.id)}
                          disabled={assigningTitleId === t.id}
                          className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-(--color-bg-elevated) transition-colors"
                        >
                          <TitleBadge title={t} />
                          <span className="text-(--color-accent) text-xs">
                            {assigningTitleId === t.id ? '…' : '+'}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-(--color-text-muted) text-sm">Select a member</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Create title */}
        <div className="border-t border-(--color-border) p-3 shrink-0">
          {showCreateForm ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  className="w-12 text-center rounded-lg bg-(--color-bg-elevated) border border-(--color-border) text-(--color-text-primary) text-sm"
                  maxLength={2}
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Title name"
                  className="flex-1 px-2 py-1 rounded-lg bg-(--color-bg-elevated) border border-(--color-border) text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                />
              </div>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-2 py-1 rounded-lg bg-(--color-bg-elevated) border border-(--color-border) text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
              />
              <input
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                placeholder="Auto trigger (e.g. streak_5) — optional"
                className="w-full px-2 py-1 rounded-lg bg-(--color-bg-elevated) border border-(--color-border) text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowCreateForm(false)} className="px-3 py-1 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-elevated) text-sm transition-colors">Cancel</button>
                <button onClick={handleCreateTitle} className="px-3 py-1 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm transition-colors">Create</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-(--color-accent) hover:text-(--color-accent-hover) text-sm font-medium transition-colors"
            >
              + Create New Title
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
