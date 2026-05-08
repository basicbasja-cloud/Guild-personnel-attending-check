/**
 * Ni Shui Han (逆水寒) Guild League – map landmark definitions.
 *
 * These are the 5 named resource/objective buildings visible on the
 * actual game map (league-map.jpg, ~1209 × 634 px).
 * Positions are expressed as percentages so they scale with the board.
 *
 * Parties are placed *freely* anywhere on the map; these landmarks
 * are rendered as static reference labels only.
 */

export interface LeagueLandmark {
  id: string;
  name_zh: string;
  name_en: string;
  /** Horizontal position as % of map width */
  x: number;
  /** Vertical position as % of map height */
  y: number;
  icon: string;
}

export const LEAGUE_LANDMARKS: LeagueLandmark[] = [
  { id: 'fortress', name_zh: '要塞',   name_en: 'Fortress',     x: 56, y: 29, icon: '🏯' },
  { id: 'armory',   name_zh: '军械库', name_en: 'Armory',       x: 28, y: 46, icon: '⚔️' },
  { id: 'forge',    name_zh: '锻炉',   name_en: 'Forge',        x: 23, y: 59, icon: '🔥' },
  { id: 'lumber',   name_zh: '伐木场', name_en: 'Lumber Mill',  x: 73, y: 38, icon: '🪓' },
  { id: 'granary',  name_zh: '粮仓',   name_en: 'Granary',      x: 65, y: 59, icon: '🌾' },
];

/** Icon identifiers for party markers on the board */
export const PARTY_ICONS = [
  'pawn', 'knight', 'rook', 'queen', 'king', 'bishop',
  'sword', 'bow', 'shield', 'staff', 'spear', 'axe', 'hammer',
  'dragon', 'phoenix', 'wolf', 'tiger', 'star',
] as const;

export type PartyIcon = typeof PARTY_ICONS[number];

/** Unicode / emoji glyph for each party icon */
export const ICON_GLYPHS: Record<PartyIcon, string> = {
  pawn:    '♟',
  knight:  '♞',
  rook:    '♜',
  queen:   '♛',
  king:    '♚',
  bishop:  '♝',
  sword:   '⚔️',
  bow:     '🏹',
  shield:  '🛡️',
  staff:   '🪄',
  spear:   '🔱',
  axe:     '🪓',
  hammer:  '🔨',
  dragon:  '🐉',
  phoenix: '🦅',
  wolf:    '🐺',
  tiger:   '🐯',
  star:    '⭐',
};

/** Phase colours for attack-wave arrows */
export const PHASE_COLORS: Record<1 | 2 | 3, string> = {
  1: '#f59e0b', // amber
  2: '#ef4444', // red
  3: '#8b5cf6', // violet
};
