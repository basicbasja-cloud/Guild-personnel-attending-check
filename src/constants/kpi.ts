import type { KpiMetricKey, KpiRoleTag } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// KPI CONSTANTS  v4.0  —  Sword of Justice Guild League  (Patch 1.2.3 Meta)
//
// v4.0 FULL REWORK: additive formulas with role-specific weights.
// No division by deaths — instead, explicit death-penalty subtraction.
//
// DYNAMIC CLASSIFICATION:
//   ROLE_DPS_ASSASSIN ← DPS_DMG when kills>10 & siege<dmg×0.15
//   ROLE_DPS_SIEGE    ← DPS_DMG when siege>dmg×1.5
//
// ROLES: DPS_DMG · DPS_ASSASSIN · DPS_SIEGE · TANK · HEALER · RESOURCE
// ─────────────────────────────────────────────────────────────────────────────

// ── Roles ─────────────────────────────────────────────────────────────────────

export const KPI_ROLES: {
  tag: KpiRoleTag;
  label: string;
  shortLabel: string;
  scoringFormula: string;
  description: string;
}[] = [
  {
    tag: 'ROLE_DPS_DMG',
    label: 'DPS Damage',
    shortLabel: 'DPS DMG',
    scoringFormula: 'dmg×0.4 + siege×0.2 + kills×20000 + assists×5000 - deaths×8000',
    description: 'Standard backline/ranged DPS — continuous safe damage, kills, tower chipping.',
  },
  {
    tag: 'ROLE_DPS_ASSASSIN',
    label: 'Assassin',
    shortLabel: 'Assassin',
    scoringFormula: 'dmg×0.55 + kills×50000 + assists×4000 - DP  (DP=0 if Takedowns≥deaths×2 else DP=deaths×3000)',
    description: 'Glass-cannon dive class — disrupt enemy backlines, trade kills. Death penalty waived when KDA≥2:1.',
  },
  {
    tag: 'ROLE_DPS_SIEGE',
    label: 'Siege Specialist',
    shortLabel: 'Siege',
    scoringFormula: 'siege×0.20 + dmg×0.30 + kills×30000 + assists×10000 - deaths×8000',
    description: 'Objective/tower pusher — destroy structures. Death penalty rewards smart positioning.',
  },
  {
    tag: 'ROLE_TANK',
    label: 'Tank',
    shortLabel: 'Tank',
    scoringFormula: 'taken×0.15 + assists×15000 + dmg×0.25 - deaths×5000',
    description: 'Frontline juggernaut — absorb damage, zone enemies, anchor every team fight.',
  },
  {
    tag: 'ROLE_HEALER',
    label: 'Healer',
    shortLabel: 'Healer',
    scoringFormula: 'healing×0.35 + assists×6000 + revives×50000 - deaths×6000',
    description: 'Backline sustain support — heal allies, revive fallen teammates, stay alive.',
  },
  {
    tag: 'ROLE_RESOURCE',
    label: 'Resource',
    shortLabel: 'Resource',
    scoringFormula: 'resources×1000 + taken×0.20 + assists×15000 - deaths×15000',
    description: 'Dedicated logistics — gather map objectives and materials. High death penalty to encourage survival.',
  },
];

// ── Metrics ───────────────────────────────────────────────────────────────────

export const KPI_METRICS: Record<
  KpiMetricKey,
  { label: string; compactLabel: string; help: string }
> = {
  damage_dealt: {
    label: 'Player Damage',
    compactLabel: 'Damage',
    help: 'Total damage dealt to enemy players.',
  },
  siege_damage: {
    label: 'Siege Damage',
    compactLabel: 'Siege',
    help: 'Damage dealt to towers, flags, and structures.',
  },
  damage_taken: {
    label: 'Damage Receive',
    compactLabel: 'Taken',
    help: 'Total damage received from enemies.',
  },
  kills: {
    label: 'Kills',
    compactLabel: 'Kills',
    help: 'Enemy players killed (final hit).',
  },
  deaths: {
    label: 'Deaths',
    compactLabel: 'Deaths',
    help: 'Times you died. Lower is better for progressive comparison.',
  },
  assists: {
    label: 'Assists',
    compactLabel: 'Assists',
    help: 'Kill participation without the final hit.',
  },
  healing_done: {
    label: 'Healing Done',
    compactLabel: 'Healing',
    help: 'Total HP healed on allies.',
  },
  ally_revives: {
    label: 'Ally Revives',
    compactLabel: 'Revives',
    help: 'Allies revived after falling.',
  },
  resources_gathered: {
    label: 'Resources Gathered',
    compactLabel: 'Resources',
    help: 'Jungle resource points supplied to the guild.',
  },
};

// ── Role → visible metrics (Personal Dashboard) ───────────────────────────────

export const KPI_ROLE_METRICS: Record<KpiRoleTag, KpiMetricKey[]> = {
  ROLE_DPS_DMG:      ['damage_dealt', 'siege_damage', 'kills',         'assists', 'deaths'],
  ROLE_DPS_ASSASSIN: ['kills',         'assists',      'damage_dealt',           'deaths'],
  ROLE_DPS_SIEGE:    ['siege_damage', 'damage_dealt',  'kills',         'assists'],
  ROLE_TANK:         ['damage_taken', 'assists',       'damage_dealt',           'deaths'],
  ROLE_HEALER:       ['healing_done', 'ally_revives',  'assists',               'deaths'],
  ROLE_RESOURCE:     ['resources_gathered', 'damage_taken', 'assists',           'deaths'],
};

// ── Empty values for form initialisation ─────────────────────────────────────

export const EMPTY_KPI_VALUES: Record<KpiMetricKey, number> = {
  damage_dealt:       0,
  siege_damage:       0,
  damage_taken:       0,
  kills:              0,
  deaths:             0,
  assists:            0,
  healing_done:       0,
  ally_revives:       0,
  resources_gathered: 0,
};

// ── Board definitions ─────────────────────────────────────────────────────────

export interface KpiBoardMeta {
  name: string;
  emoji: string;
  label: string;
  subtitle: string;
  formula: string;
  colorClass: string;
  accentColor: string;
  rankColors: [string, string, string];
}

export const KPI_BOARDS: KpiBoardMeta[] = [
  {
    name:        'board_glass_cannon',
    emoji:       '🔥',
    label:       'Glass Cannon',
    subtitle:    'Highest raw damage + kill output',
    formula:     'dmg×0.35 + kills×25000 + assists×3000',
    colorClass:  [
      'bg-gradient-to-br from-red-950/70 to-orange-950/70',
      'border border-red-500/40',
      'hover:shadow-red-900/30 hover:shadow-lg',
    ].join(' '),
    accentColor: '#EF4444',
    rankColors:  ['text-amber-300', 'text-slate-300', 'text-amber-700'],
  },
  {
    name:        'board_game_changer',
    emoji:       '🛡️',
    label:       'Game Changer',
    subtitle:    'Tank front-line impact [TANK ONLY]',
    formula:     'taken×0.35 + assists×200 − deaths×3000',
    colorClass:  [
      'bg-gradient-to-br from-blue-950/70 to-indigo-950/70',
      'border border-blue-500/40',
      'hover:shadow-blue-900/30 hover:shadow-lg',
    ].join(' '),
    accentColor: '#3B82F6',
    rankColors:  ['text-amber-300', 'text-slate-300', 'text-amber-700'],
  },
  {
    name:        'board_gatebreaker',
    emoji:       '🏰',
    label:       'Gatebreaker',
    subtitle:    'Highest structure destruction output',
    formula:     'siege×0.15 + kills×10000 + assists×3000',
    colorClass:  [
      'bg-gradient-to-br from-amber-950/70 to-yellow-950/70',
      'border border-amber-500/40',
      'hover:shadow-amber-900/30 hover:shadow-lg',
    ].join(' '),
    accentColor: '#F59E0B',
    rankColors:  ['text-amber-300', 'text-slate-300', 'text-amber-700'],
  },
  {
    name:        'board_logistics_master',
    emoji:       '📦',
    label:       'Logistics Master',
    subtitle:    'Resource supply & survival',
    formula:     'resources×1400 + taken×0.04 + assists×2000',
    colorClass:  [
      'bg-gradient-to-br from-emerald-950/70 to-teal-950/70',
      'border border-emerald-500/40',
      'hover:shadow-emerald-900/30 hover:shadow-lg',
    ].join(' '),
    accentColor: '#10B981',
    rankColors:  ['text-amber-300', 'text-slate-300', 'text-amber-700'],
  },
  {
    name:        'board_resilient_guardian',
    emoji:       '💚',
    label:       'Resilient Guardian',
    subtitle:    'Crucial revives & sustained healing',
    formula:     'healing×0.3 + revives×60000 + assists×2000',
    colorClass:  [
      'bg-gradient-to-br from-rose-950/70 to-pink-950/70',
      'border border-rose-500/40',
      'hover:shadow-rose-900/30 hover:shadow-lg',
    ].join(' '),
    accentColor: '#F43F5E',
    rankColors:  ['text-amber-300', 'text-slate-300', 'text-amber-700'],
  },
];

// ── Rank tier config ──────────────────────────────────────────────────────────

export interface RankTierMeta {
  label: string;
  thaiLabel: string;
  threshold: string;
  badgeClass: string;
  borderClass: string;
  nearMissPrefix: string;
}

export const RANK_TIER_CONFIG: Record<number, RankTierMeta> = {
  1: {
    label:          'Calibrating',
    thaiLabel:      'คลื่นลูกใหม่',
    threshold:      '< 100% of role baseline',
    badgeClass:     'bg-cyan-950/60 text-cyan-200 border border-cyan-700',
    borderClass:    'border-cyan-800/40',
    nearMissPrefix: 'อีก',
  },
  2: {
    label:          'Backbone',
    thaiLabel:      'กองหน้าแกนหลัก',
    threshold:      '100–119% of role baseline',
    badgeClass:     'bg-indigo-950/70 text-indigo-200 border border-indigo-700',
    borderClass:    'border-indigo-700/40',
    nearMissPrefix: 'อีก',
  },
  3: {
    label:          'MVP',
    thaiLabel:      'ไร้พ่ายเหนือหล้า',
    threshold:      '≥ 120% of role baseline',
    badgeClass:     'bg-amber-950/80 text-amber-200 border border-amber-600 shadow-sm shadow-amber-900/40',
    borderClass:    'border-amber-600/50',
    nearMissPrefix: '',
  },
};

// ── Progressive state → UI config ────────────────────────────────────────────

export interface ProgressiveStateMeta {
  colorClass: string;
  showLabel: boolean;
}

export const PROGRESSIVE_STATE_CONFIG: Record<string, ProgressiveStateMeta> = {
  strong_up:   { colorClass: 'text-green-400',  showLabel: true  },
  up:          { colorClass: 'text-green-500',  showLabel: true  },
  stable:      { colorClass: 'text-blue-400',   showLabel: false },
  calibrating: { colorClass: 'text-slate-400',  showLabel: false },
  reset:       { colorClass: 'text-slate-500',  showLabel: false },
  baseline:    { colorClass: 'text-slate-500',  showLabel: false },
};

// ── Progressive state → Thai message per role ────────────────────────────────

type ProgressiveMessages = Partial<Record<
  KpiRoleTag,
  Partial<Record<
    KpiMetricKey,
    Partial<Record<string, string>>
  >>
>>;

export const PROGRESSIVE_MESSAGES: ProgressiveMessages = {
  ROLE_DPS_DMG: {
    damage_dealt: { strong_up: '🔥 ดาเมจพุ่ง +{X}% คมขึ้นชัดเจน!', up: '📈 ดาเมจดีขึ้น +{X}%', stable: '🎯 ดาเมจทรงตัว (Stable)', calibrating: '⚔️ กำลังปรับจังหวะโจมตี', reset: '⚙️ ปรับระบบโจมตีใหม่' },
    siege_damage: { strong_up: '🏰 ทุบป้อมแรงขึ้น +{X}%!', up: '📈 Siege ดีขึ้น +{X}%', stable: '🎯 Siege ทรงตัว (Stable)', calibrating: '🏰 สัปดาห์นี้ focus Player Fight', reset: '⚙️ ปรับแนว Siege ใหม่' },
    kills:        { strong_up: '💥 Kill เพิ่มขึ้น +{X}%!', up: '📈 Kill ดีขึ้น +{X}%', stable: '🎯 Kill ทรงตัว (Stable)', calibrating: '💥 กำลังหาจังหวะ Finish', reset: '⚙️ ปรับ Positioning ใหม่' },
    assists:      { strong_up: '🤝 Assist เพิ่มขึ้น +{X}%!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว', calibrating: '🤝 กำลังหาจังหวะ Team Play', reset: '⚙️ ปรับ Teamfight ใหม่' },
    deaths:       { strong_up: '🛡️ ตายน้อยลง +{X}% ยอดเยี่ยม!', up: '📈 อยู่รอดดีขึ้น +{X}%', stable: '🎯 Survival ทรงตัว', calibrating: '🔄 ฝึกจับจังหวะถอย', reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_DPS_ASSASSIN: {
    kills:        { strong_up: '💀 สังหารศัตรูเพิ่มขึ้น +{X}% — นักล่าไร้ปรานี!', up: '📈 Kill ดีขึ้น +{X}%', stable: '🎯 Kill ทรงตัว', calibrating: '🗡️ กำลังหาจุด Dive ที่ดี', reset: '⚙️ ปรับเส้นทางลอบสังหารใหม่' },
    assists:      { strong_up: '🤝 ร่วมสังหารเพิ่ม +{X}% — ทีมเวิร์คระดับเทพ!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว', calibrating: '🤝 กำลังปรับจังหวะเข้าไฟต์', reset: '⚙️ ปรับ Team Dive ใหม่' },
    damage_dealt: { strong_up: '⚡ Burst Damage เพิ่ม +{X}%!', up: '📈 ดาเมจดีขึ้น +{X}%', stable: '🎯 ดาเมจทรงตัว', calibrating: '⚡ กำลังฝึก Combo', reset: '⚙️ ปรับ Skill Rotation ใหม่' },
    deaths:       { strong_up: '🛡️ KDA ดีขึ้น — คุ้มกับการแลก!', up: '📈 อัตราแลกดีขึ้น +{X}%', stable: '🎯 Trade-off สมดุล', calibrating: '🔄 ฝึกอ่านจังหวะเข้า-ออก', reset: '⚙️ ปรับเส้นทาง Escape ใหม่' },
  },
  ROLE_DPS_SIEGE: {
    siege_damage: { strong_up: '🏰 ทลายป้อมปราการเพิ่มขึ้น +{X}% — เครื่องจักรทำลาย!', up: '📈 Siege ดีขึ้น +{X}%', stable: '🎯 Siege ทรงตัว', calibrating: '🏰 กำลังหาเส้นทางทำลายป้อม', reset: '⚙️ ปรับเส้นทาง Siege ใหม่' },
    damage_dealt: { strong_up: '⚔️ ป้องกันตัวดีขึ้น +{X}%!', up: '📈 ดาเมจดีขึ้น +{X}%', stable: '🎯 ดาเมจทรงตัว', calibrating: '⚔️ กำลังฝึกป้องกันตัวระหว่าง Siege', reset: '⚙️ ปรับ Self-Defense ใหม่' },
    kills:        { strong_up: '💥 เก็บ Kill ระหว่าง Siege เพิ่ม +{X}%!', up: '📈 Kill ดีขึ้น +{X}%', stable: '🎯 Kill ทรงตัว', calibrating: '💥 กำลังปรับ Timing', reset: '⚙️ ปรับ Kill Securing ใหม่' },
    assists:      { strong_up: '🤝 ช่วยทีมระหว่าง Siege เพิ่ม +{X}%!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว', calibrating: '🤝 กำลังฝึก Team Push', reset: '⚙️ ปรับ Push Timing ใหม่' },
  },
  ROLE_TANK: {
    damage_taken: { strong_up: '💪 ดูดดาเมจให้ทีมได้มากขึ้น +{X}%!', up: '📈 Tanking ดีขึ้น +{X}%', stable: '🎯 Tanking ทรงตัว (Stable)', calibrating: '💪 สัปดาห์นี้ไฟต์น้อยกว่าปกติ', reset: '⚙️ ปรับแนว Frontline ใหม่' },
    assists:      { strong_up: '🤝 อยู่ร่วมทุกไฟต์ +{X}%!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว (Stable)', calibrating: '🤝 กำลังหาตำแหน่ง Frontline', reset: '⚙️ ปรับ Zone Control ใหม่' },
    damage_dealt: { strong_up: '⚔️ ดาเมจตอบโต้ดีขึ้น +{X}%!', up: '📈 ดาเมจดีขึ้น +{X}%', stable: '🎯 ดาเมจทรงตัว', calibrating: '⚔️ กำลังฝึก Combo หน้าไฟต์', reset: '⚙️ ปรับ Damage Rotation ใหม่' },
    deaths:       { strong_up: '🛡️ ยืนได้นานขึ้น +{X}% — แท็งก์จริง!', up: '📈 อยู่รอดดีขึ้น +{X}%', stable: '🎯 Survival ทรงตัว', calibrating: '🔄 ฝึกอ่าน Focus Target', reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_HEALER: {
    healing_done:  { strong_up: '💚 รักษาได้มากขึ้น +{X}% ทีมรอดเพราะคุณ!', up: '📈 Healing ดีขึ้น +{X}%', stable: '🎯 Healing ทรงตัว (Stable)', calibrating: '💚 กำลังปรับ Priority การรักษา', reset: '⚙️ ปรับ Heal Rotation ใหม่' },
    ally_revives:  { strong_up: '✨ ปลุกเพื่อนได้มากขึ้น +{X}% — หน่วยกู้ชีพ!', up: '📈 Revive ดีขึ้น +{X}%', stable: '🎯 ทีมรอดโดยไม่ต้องปลุกมาก', calibrating: '✨ สัปดาห์นี้ทีมรอดดีขึ้น ก็ดี!', reset: '⚙️ ปรับ Revive Timing ใหม่' },
    assists:       { strong_up: '🤝 ร่วมไฟต์มากขึ้น +{X}% — Healer สายบู๊!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว', calibrating: '🤝 กำลังฝึก Positioning', reset: '⚙️ ปรับ Follow-up ใหม่' },
    deaths:        { strong_up: '🛡️ ตายน้อยลง +{X}% — Healer ยืนได้นาน!', up: '📈 อยู่รอดดีขึ้น +{X}%', stable: '🎯 Survival ทรงตัว', calibrating: '🔄 ฝึกตำแหน่งให้ปลอดภัยขึ้น', reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_RESOURCE: {
    resources_gathered: { strong_up: '📦 เก็บทรัพยากรได้มากขึ้น +{X}% — เส้นเลือดทีม!', up: '📈 Resource ดีขึ้น +{X}%', stable: '🎯 Resource ทรงตัว (Stable)', calibrating: '📦 กำลังปรับเส้นทางเก็บใหม่', reset: '⚙️ ปรับ Route ใหม่' },
    damage_taken:       { strong_up: '💪 อึดขึ้น รับดาเมจระหว่างเก็บได้มากขึ้น +{X}%!', up: '📈 ความอึดดีขึ้น +{X}%', stable: '🎯 ความอึดทรงตัว', calibrating: '💪 กำลังปรับ Survival Route', reset: '⚙️ ปรับเส้นทางหลบหลีกใหม่' },
    assists:            { strong_up: '🤝 ช่วยทีมระหว่างเก็บของมากขึ้น +{X}%!', up: '📈 Assist ดีขึ้น +{X}%', stable: '🎯 Assist ทรงตัว', calibrating: '🤝 กำลังปรับ Rotate', reset: '⚙️ ปรับ Support Timing ใหม่' },
    deaths:             { strong_up: '🛡️ อยู่รอดได้นานขึ้น +{X}% เก็บต่อเนื่อง!', up: '📈 อยู่รอดดีขึ้น +{X}%', stable: '🎯 Survival ทรงตัว', calibrating: '🔄 ฝึกอ่านเกมเพื่อเอาตัวรอด', reset: '⚙️ ปรับเส้นทางหลบหลีกใหม่' },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getKpiRoleLabel(roleTag: KpiRoleTag | string | null | undefined): string {
  return KPI_ROLES.find((r) => r.tag === roleTag)?.label ?? 'Unassigned';
}

export function getKpiRoleShortLabel(roleTag: KpiRoleTag | string | null | undefined): string {
  return KPI_ROLES.find((r) => r.tag === roleTag)?.shortLabel ?? '—';
}

export function formatKpiNumber(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: n >= 1000 ? 0 : n >= 100 ? 0 : 1,
  }).format(n);
}

export function getProgressiveMessage(
  roleTag: KpiRoleTag | string,
  metricKey: KpiMetricKey | string,
  state: string,
  label: string | null,
): string {
  const template =
    (PROGRESSIVE_MESSAGES as Record<string, Record<string, Record<string, string>>>)
      ?.[roleTag]?.[metricKey]?.[state];
  if (!template) return '';
  return template.replace('{X}', label ?? '');
}

// ── Dynamic Role Classification (Patch 1.2.3 Meta) ──────────────────────────

/**
 * Classify a player into the correct role based on their playstyle metrics.
 * DPS_DMG players may be reclassified as ASSASSIN or SIEGE dynamically.
 * Legacy ROLE_DPS_DEF string is mapped to ROLE_DPS_DMG.
 */
export function classifyRole(
  originalRole: KpiRoleTag | string,
  damageDealt: number,
  siegeDamage: number,
  kills: number,
): KpiRoleTag {
  // Legacy mapping
  if (originalRole === 'ROLE_DPS_DEF' as string) return 'ROLE_DPS_DMG';
  // Only DPS_DMG can be dynamically reclassified
  if (originalRole !== 'ROLE_DPS_DMG') return originalRole as KpiRoleTag;
  // Assassin: high kills (>10) AND low siege relative to damage
  if (kills > 10 && siegeDamage < (damageDealt * 0.15)) {
    return 'ROLE_DPS_ASSASSIN';
  }
  // Siege: siege dominates over player damage AND siege is meaningful (>500k)
  if (siegeDamage > (damageDealt * 1.5) && siegeDamage > 500000) {
    return 'ROLE_DPS_SIEGE';
  }
  return 'ROLE_DPS_DMG';
}

/**
 * Compute the raw_score for a player using the Patch 1.2.3 additive formulas.
 * All scores are floored to 0 (no negative scores).
 */
export function computeKpiScore(
  roleTag: KpiRoleTag,
  damageDealt: number,
  siegeDamage: number,
  damageTaken: number,
  kills: number,
  deaths: number,
  assists: number,
  healingDone: number,
  allyRevives: number,
  resourcesGathered: number,
): number {
  const d = damageDealt, s = siegeDamage, dt = damageTaken;
  const k = kills, de = deaths, a = assists;
  const h = healingDone, r = allyRevives, res = resourcesGathered;

  switch (roleTag) {
    case 'ROLE_DPS_DMG':
      return Math.max(0, Math.floor((d * 0.4) + (s * 0.2) + (k * 20000) + (a * 5000) - (de * 8000)));

    case 'ROLE_DPS_ASSASSIN': {
      const takedowns = k + (0.4 * a);
      const deathPenalty = (takedowns >= de * 2) ? 0 : de * 3000;
      return Math.max(0, Math.floor((d * 0.55) + (k * 50000) + (a * 4000) - deathPenalty));
    }

    case 'ROLE_DPS_SIEGE':
      return Math.max(0, Math.floor((s * 0.20) + (d * 0.30) + (k * 30000) + (a * 10000) - (de * 8000)));

    case 'ROLE_TANK':
      return Math.max(0, Math.floor((dt * 0.15) + (a * 15000) + (d * 0.25) - (de * 5000)));

    case 'ROLE_HEALER':
      return Math.max(0, Math.floor((h * 0.35) + (a * 6000) + (r * 50000) - (de * 6000)));

    case 'ROLE_RESOURCE':
      return Math.max(0, Math.floor((res * 1000) + (dt * 0.20) + (a * 15000) - (de * 15000)));

    default:
      return 0;
  }
}
