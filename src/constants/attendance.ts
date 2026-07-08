import type { AttendanceStatus } from '../types';

export interface StatusConfigItem {
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
}

export const STATUS_CONFIG: Record<AttendanceStatus, StatusConfigItem> = {
  join: {
    label: 'Join',
    emoji: '✅',
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-500',
    text: 'text-emerald-300',
  },
  not_join: {
    label: "Can't Join",
    emoji: '❌',
    bg: 'bg-red-900/40',
    border: 'border-red-500',
    text: 'text-red-300',
  },
  maybe: {
    label: 'Maybe',
    emoji: '🤔',
    bg: 'bg-yellow-900/40',
    border: 'border-yellow-500',
    text: 'text-yellow-300',
  },
};

export interface StatusOption {
  status: AttendanceStatus;
  emoji: string;
  label: string;
  color: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { status: 'join', emoji: '✅', label: 'Join', color: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-500' },
  { status: 'not_join', emoji: '❌', label: "Can't", color: 'bg-red-800 hover:bg-red-700 border-red-600' },
  { status: 'maybe', emoji: '🤔', label: 'Maybe', color: 'bg-yellow-800 hover:bg-yellow-700 border-yellow-600' },
];

/** Human-readable label for a given status value. */
export function getStatusLabel(status: AttendanceStatus): string {
  return STATUS_CONFIG[status].label;
}

/** Emoji for a given status value. */
export function getStatusEmoji(status: AttendanceStatus): string {
  return STATUS_CONFIG[status].emoji;
}
