// ── Milestone definitions for auto-earn titles ────────────────────────────

export const STREAK_MILESTONES = [
  { weeks: 5,  titleTrigger: 'streak_5',  label: '5-Week Streak',  emoji: '🔥' },
  { weeks: 10, titleTrigger: 'streak_10', label: '10-Week Streak', emoji: '⚡' },
  { weeks: 15, titleTrigger: 'streak_15', label: '15-Week Streak', emoji: '💀' },
] as const;

export const ATTENDANCE_100_TRIGGER = 'attendance_100';

export const KPI_MVP_TRIGGER = 'kpi_mvp';
