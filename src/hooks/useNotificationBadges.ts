import { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BadgeCounts {
  announcements: number;
  titles: number;
}

const LAST_READ_KEY = 'gwm_last_read_announcement_id';
const LAST_VISIT_KEY = 'gwm_last_visit_ts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLastReadAnnouncementId(): string | null {
  try { return localStorage.getItem(LAST_READ_KEY); } catch { return null; }
}

export function markAnnouncementsRead(latestId: string) {
  try { localStorage.setItem(LAST_READ_KEY, latestId); } catch { /* noop */ }
}

function getLastVisitTimestamp(): number {
  try {
    const val = localStorage.getItem(LAST_VISIT_KEY);
    return val ? Number(val) : Date.now();
  } catch { return Date.now(); }
}

export function updateLastVisitTimestamp() {
  try { localStorage.setItem(LAST_VISIT_KEY, String(Date.now())); } catch { /* noop */ }
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseNotificationBadgesResult {
  counts: BadgeCounts;
  total: number;
}

export function useNotificationBadges(
  announcements: { id: string }[],
  earnedDates: string[], // ISO timestamps of recently earned titles
): UseNotificationBadgesResult {
  const [dismissed] = useState(false);

  const counts = useMemo(() => {
    // Announcement badges: unread count = announcements newer than last read
    const lastRead = getLastReadAnnouncementId();
    let annUnread = 0;
    if (announcements.length > 0 && lastRead) {
      const lastReadIdx = announcements.findIndex((a) => a.id === lastRead);
      annUnread = lastReadIdx >= 0 ? lastReadIdx : announcements.length;
    } else if (announcements.length > 0 && !lastRead) {
      // Never read any announcements
      annUnread = announcements.length;
    }

    // Title badges: recently earned (within last 24h)
    const lastVisit = getLastVisitTimestamp();
    const titleUnread = earnedDates.filter((d) => new Date(d).getTime() > lastVisit).length;

    return {
      announcements: dismissed ? 0 : annUnread,
      titles: titleUnread,
    };
  }, [announcements, earnedDates, dismissed]);

  const total = counts.announcements + counts.titles;

  return { counts, total };
}
