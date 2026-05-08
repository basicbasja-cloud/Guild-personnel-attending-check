import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: { username: string; avatar_url: string | null } | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  attendance_override: { label: 'Attendance Override', color: 'text-yellow-400', emoji: '📋' },
  admin_delete_user: { label: 'Account Deleted', color: 'text-red-400', emoji: '🗑️' },
  party_assign: { label: 'Party Assigned', color: 'text-indigo-400', emoji: '⚔️' },
  party_remove: { label: 'Party Removed', color: 'text-slate-400', emoji: '↩️' },
};

type FilterType = 'all' | keyof typeof ACTION_LABELS;

interface AuditLogModalProps {
  onClose: () => void;
}

export function AuditLogModal({ onClose }: AuditLogModalProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = supabase
      .from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(username,avatar_url)')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter !== 'all') query.eq('action', filter);

    query.then(({ data }) => {
      if (cancelled) return;
      setEntries((data as AuditEntry[]) ?? []);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, filter]);

  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    setPage(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Audit Log</h2>
            <p className="text-slate-400 text-xs mt-0.5">Recent management actions</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 py-3 border-b border-slate-800 shrink-0 overflow-x-auto">
          {(['all', ...Object.keys(ACTION_LABELS)] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {f === 'all' ? 'All' : (ACTION_LABELS[f]?.emoji ?? '') + ' ' + (ACTION_LABELS[f]?.label ?? f)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No audit entries found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 border-b border-slate-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 text-left">Time</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 text-left">Action</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 text-left">By</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {entries.map((e) => {
                  const cfg = ACTION_LABELS[e.action];
                  return (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(e.created_at), 'MMM d HH:mm')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${cfg?.color ?? 'text-slate-300'}`}>
                          {cfg?.emoji ?? ''} {cfg?.label ?? e.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {e.actor?.avatar_url ? (
                            <img src={e.actor.avatar_url} className="w-5 h-5 rounded-full shrink-0" alt="" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-700 shrink-0" />
                          )}
                          <span className="text-white text-xs">{e.actor?.username ?? 'System'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs max-w-xs truncate">
                        {e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >
            ◀ Prev
          </button>
          <span className="text-slate-500 text-xs">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={entries.length < PAGE_SIZE}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helper to write an audit log entry — call from any action handler. */
export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    });
  } catch (err) {
    console.error('[AuditLog] write failed:', err);
  }
}
