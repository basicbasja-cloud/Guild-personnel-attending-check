import { useState, useMemo } from 'react';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { AnnouncementEditorModal } from './AnnouncementEditorModal';
import type { Announcement } from '../../hooks/useAnnouncements';

interface AnnouncementsPageProps {
  isManagement: boolean;
  userId: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function AnnouncementsPage({ isManagement, userId }: AnnouncementsPageProps) {
  const { announcements, loading, error, create, update, remove } = useAnnouncements(isManagement, userId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Separate pinned from unpinned
  const pinned = useMemo(() => announcements.filter((a) => a.pinned), [announcements]);
  const unpinned = useMemo(() => announcements.filter((a) => !a.pinned), [announcements]);

  const handleSave = async (title: string, content: string, pinned: boolean) => {
    if (editTarget) {
      return await update(editTarget.id, title, content, pinned);
    }
    return await create(title, content, pinned);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setConfirmDelete(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-(--color-text-primary) font-bold text-xl flex items-center gap-2">
            📢 Announcements
          </h1>
          <p className="text-(--color-text-secondary) text-sm mt-0.5">
            Guild-wide news and updates
          </p>
        </div>

        {isManagement && (
          <button
            onClick={() => { setEditTarget(null); setEditorOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-(--color-accent) hover:bg-(--color-accent-hover)
              text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Announcement
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-900/40 border border-rose-700 rounded-lg p-3 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && announcements.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-(--color-bg-card) border border-(--color-border) rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-(--color-border) rounded w-3/4 mb-3" />
              <div className="h-4 bg-(--color-border) rounded w-full mb-2" />
              <div className="h-4 bg-(--color-border) rounded w-2/3 mb-4" />
              <div className="h-3 bg-(--color-border) rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && announcements.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📢</div>
          <h2 className="text-(--color-text-primary) text-lg font-bold mb-2">No announcements yet</h2>
          <p className="text-(--color-text-secondary) text-sm max-w-md mx-auto">
            {isManagement
              ? 'Create your first announcement to keep the guild informed.'
              : 'Check back later for guild updates.'}
          </p>
        </div>
      )}

      {/* Announcements list */}
      <div className="space-y-4">
        {/* Pinned first */}
        {pinned.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            isManagement={isManagement}
            onEdit={() => { setEditTarget(a); setEditorOpen(true); }}
            onDelete={() => setConfirmDelete(a.id)}
            showConfirmDelete={confirmDelete === a.id}
            onConfirmDelete={() => handleDelete(a.id)}
            onCancelDelete={() => setConfirmDelete(null)}
          />
        ))}

        {/* Unpinned */}
        {unpinned.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            isManagement={isManagement}
            onEdit={() => { setEditTarget(a); setEditorOpen(true); }}
            onDelete={() => setConfirmDelete(a.id)}
            showConfirmDelete={confirmDelete === a.id}
            onConfirmDelete={() => handleDelete(a.id)}
            onCancelDelete={() => setConfirmDelete(null)}
          />
        ))}
      </div>

      {/* Editor modal */}
      <AnnouncementEditorModal
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        editTarget={editTarget}
      />
    </div>
  );
}

// ── Announcement Card ──────────────────────────────────────────────────────

function AnnouncementCard({
  announcement,
  isManagement,
  onEdit,
  onDelete,
  showConfirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  announcement: Announcement;
  isManagement: boolean;
  onEdit: () => void;
  onDelete: () => void;
  showConfirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div
      className={`group bg-(--color-bg-card) border border-(--color-border) rounded-xl p-5
        transition-all duration-200
        ${announcement.pinned ? 'ring-1 ring-(--color-accent)/30' : ''}
        hover:border-(--color-accent)/30`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {announcement.pinned && (
            <span className="text-(--color-accent) shrink-0" title="Pinned">📌</span>
          )}
          <h3 className="text-(--color-text-primary) font-semibold text-base truncate">
            {announcement.title}
          </h3>
        </div>

        {isManagement && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded flex items-center justify-center text-(--color-text-muted)
                hover:text-(--color-text-primary) hover:bg-(--color-bg-elevated) transition-colors text-xs"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded flex items-center justify-center text-(--color-text-muted)
                hover:text-rose-400 hover:bg-rose-900/30 transition-colors text-xs"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-(--color-text-secondary) text-sm whitespace-pre-wrap mb-3">
        {announcement.content}
      </p>

      {/* Meta + Delete confirmation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-(--color-text-muted) text-xs">
          <span>{announcement.author_username ?? 'Unknown'}</span>
          <span>·</span>
          <span>{formatTime(announcement.created_at)}</span>
          {announcement.updated_at !== announcement.created_at && (
            <>
              <span>·</span>
              <span className="italic">edited</span>
            </>
          )}
        </div>

        {showConfirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-rose-400 text-xs">Delete?</span>
            <button
              onClick={onConfirmDelete}
              className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-xs transition-colors"
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              className="px-2 py-1 rounded bg-(--color-bg-elevated) hover:bg-(--color-border)
                text-(--color-text-secondary) text-xs transition-colors"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
