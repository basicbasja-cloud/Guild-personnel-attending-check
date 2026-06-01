import type { KpiMetricKey, KpiRoleTag } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// KPI CONSTANTS  v2.2  —  Sword of Justice Guild League
//
// Confirmed in-game post-war stats:
//   damage_dealt, siege_damage, damage_taken, kills, deaths,
//   assists, healing_done, ally_revives, resources_gathered
//
// Removed (not in game): flag_time_sec, time_alive_sec
//
// Role scoring formulas (all use deaths as denominator = Efficiency per Life):
//   ROLE_DPS_DMG   (damage_dealt + siege_damage×1.5 + kills×500) / MAX(1, deaths)
//   ROLE_DPS_DEF   (damage_dealt + kills×500) / MAX(1, deaths)
//   ROLE_TANK      (damage_taken + assists×100) / MAX(1, deaths)
//   ROLE_HEALER    (healing_done + ally_revives×500) / MAX(1, deaths×0.3)
//   ROLE_RESOURCE  (damage_dealt + resources_gathered×2.0) / MAX(1, deaths)
// ─────────────────────────────────────────────────────────────────────────────

// ── Roles ────────────────────────────────────────────────────────────────────

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
    scoringFormula: '(damage + siege×1.5 + kills×500) / MAX(1, deaths)',
    description: 'Push lanes, burst enemies, destroy towers and flags.',
  },
  {
    tag: 'ROLE_DPS_DEF',
    label: 'DPS Defense',
    shortLabel: 'DPS DEF',
    scoringFormula: '(damage + kills×500) / MAX(1, deaths)',
    description: 'Hold lanes, eliminate enemy pushers, protect the flag.',
  },
  {
    tag: 'ROLE_TANK',
    label: 'Tank',
    shortLabel: 'Tank',
    scoringFormula: '(damage_taken + assists×100) / MAX(1, deaths)',
    description: 'Absorb damage, zone enemies, anchor every team fight.',
  },
  {
    tag: 'ROLE_HEALER',
    label: 'Healer',
    shortLabel: 'Healer',
    scoringFormula: '(healing + revives×500) / MAX(1, deaths×0.3)',
    description: 'Sustain allies, revive fallen teammates, stay alive.',
  },
  {
    tag: 'ROLE_RESOURCE',
    label: 'Resource',
    shortLabel: 'Resource',
    scoringFormula: '(damage + resources×2.0) / MAX(1, deaths)',
    description: 'Supply jungle resources that power Guild Leader skills.',
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
    help: 'Total damage dealt to enemy players (对人伤害).',
  },
  siege_damage: {
    label: 'Siege Damage',
    compactLabel: 'Siege',
    help: 'Damage dealt to towers, flags, and structures (攻城伤害).',
  },
  damage_taken: {
    label: 'Damage Receive',
    compactLabel: 'Taken',
    help: 'Total damage received from enemies (承受伤害).',
  },
  kills: {
    label: 'Kills',
    compactLabel: 'Kills',
    help: 'Enemy players killed (final hit) (击杀).',
  },
  deaths: {
    label: 'Deaths',
    compactLabel: 'Deaths',
    help: 'Times you died. Lower is better for progressive comparison (死亡).',
  },
  assists: {
    label: 'Assists',
    compactLabel: 'Assists',
    help: 'Kill participation without the final hit (助攻).',
  },
  healing_done: {
    label: 'Healing Done',
    compactLabel: 'Healing',
    help: 'Total HP healed on allies (治疗量).',
  },
  ally_revives: {
    label: 'Ally Revives',
    compactLabel: 'Revives',
    help: 'Allies revived after falling (复活队友).',
  },
  resources_gathered: {
    label: 'Resources Gathered',
    compactLabel: 'Resources',
    help: 'Jungle resource points supplied to the guild (物资采集).',
  },
};

// ── Role → visible metrics (Personal Dashboard) ──────────────────────────────
// Each role sees only the metrics relevant to their job.
// deaths is always included and uses an INVERTED progressive formula
// (fewer deaths = positive improvement).

export const KPI_ROLE_METRICS: Record<KpiRoleTag, KpiMetricKey[]> = {
  ROLE_DPS_DMG:  ['damage_dealt', 'siege_damage', 'kills',             'deaths'],
  ROLE_DPS_DEF:  ['damage_dealt', 'kills',         'assists',           'deaths'],
  ROLE_TANK:     ['damage_taken', 'assists',                            'deaths'],
  ROLE_HEALER:   ['healing_done', 'ally_revives',                       'deaths'],
  ROLE_RESOURCE: ['resources_gathered', 'damage_dealt',                 'deaths'],
};

// ── Empty values for form initialisation ────────────────────────────────────

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

// ── Specialised Boards (Public — Top 3 per board) ────────────────────────────

export interface KpiBoardMeta {
  name: string;
  emoji: string;
  label: string;
  subtitle: string;
  formula: string;          // human-readable for tooltips
  colorClass: string;       // Tailwind gradient / border classes
  accentColor: string;      // hex for rank medal tints
  rankColors: [string, string, string]; // gold / silver / bronze Tailwind text classes
}

export const KPI_BOARDS: KpiBoardMeta[] = [
  {
    name:        'board_glass_cannon',
    emoji:       '🔥',
    label:       'Glass Cannon',
    subtitle:    'Highest damage efficiency per life',
    formula:     'damage × (1 + kill_participation) / MAX(1, deaths)',
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
    subtitle:    'Most impactful team-fight presence',
    formula:     'assists × kills',
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
    formula:     'siege_damage × (1 + kills/team_kills × 0.3)',
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
    subtitle:    'Resource supply & battlefield survival',
    formula:     'damage_dealt + resources_gathered × 2.0',
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
    formula:     'ally_revives × 1000 + healing_done / 500',
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
  threshold: string;      // human-readable condition
  badgeClass: string;     // Tailwind classes for the badge chip
  borderClass: string;    // card border highlight
  nearMissPrefix: string; // message prefix for rank 1
}

export const RANK_TIER_CONFIG: Record<number, RankTierMeta> = {
  1: {
    label:          'Calibrating',
    thaiLabel:      'คลื่นลูกใหม่',
    threshold:      '< 100% of role baseline',
    badgeClass:     'bg-cyan-950/60 text-cyan-200 border border-cyan-700',
    borderClass:    'border-cyan-800/40',
    nearMissPrefix: 'อีก',   // "อีก {X}% จะขึ้น Backbone!"
  },
  2: {
    label:          'Backbone',
    thaiLabel:      'กองหน้าแกนหลัก',
    threshold:      '100–119% of role baseline',
    badgeClass:     'bg-indigo-950/70 text-indigo-200 border border-indigo-700',
    borderClass:    'border-indigo-700/40',
    nearMissPrefix: 'อีก',   // "อีก {X}% จะขึ้น MVP!"
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
// Maps the progressive_state returned by get_kpi_profile() to
// display color and neutral Thai messaging (negative % never shown).

export interface ProgressiveStateMeta {
  colorClass: string;   // Tailwind text color
  showLabel: boolean;   // whether to render the label string
}

export const PROGRESSIVE_STATE_CONFIG: Record<string, ProgressiveStateMeta> = {
  strong_up:    { colorClass: 'text-green-400',   showLabel: true  },
  up:           { colorClass: 'text-green-500',   showLabel: true  },
  stable:       { colorClass: 'text-blue-400',    showLabel: false },
  calibrating:  { colorClass: 'text-slate-400',   showLabel: false },
  reset:        { colorClass: 'text-slate-500',   showLabel: false },
  baseline:     { colorClass: 'text-slate-500',   showLabel: false },
};

// ── Progressive state → Thai message per role ────────────────────────────────
// Keyed by [role_tag][metric_key][state]

type ProgressiveMessages = Partial<Record<
  KpiRoleTag,
  Partial<Record<
    KpiMetricKey,
    Partial<Record<string, string>>
  >>
>>;

export const PROGRESSIVE_MESSAGES: ProgressiveMessages = {
  ROLE_DPS_DMG: {
    damage_dealt:    { strong_up: '🔥 ดาเมจพุ่ง +{X}% คมขึ้นชัดเจน!',      up: '📈 ดาเมจดีขึ้น +{X}%',           stable: '🎯 ดาเมจทรงตัว (Stable)',       calibrating: '⚔️ กำลังปรับจังหวะโจมตี',         reset: '⚙️ ปรับระบบโจมตีใหม่' },
    siege_damage:    { strong_up: '🏰 ทุบป้อมแรงขึ้น +{X}%!',             up: '📈 Siege ดีขึ้น +{X}%',           stable: '🎯 Siege ทรงตัว (Stable)',      calibrating: '🏰 สัปดาห์นี้ focus Player Fight',  reset: '⚙️ ปรับแนว Siege ใหม่' },
    kills:           { strong_up: '💥 Kill เพิ่มขึ้น +{X}%!',              up: '📈 Kill ดีขึ้น +{X}%',            stable: '🎯 Kill ทรงตัว (Stable)',       calibrating: '💥 กำลังหาจังหวะ Finish',          reset: '⚙️ ปรับ Positioning ใหม่' },
    deaths:          { strong_up: '🛡️ ตายน้อยลง +{X}% ยอดเยี่ยม!',        up: '📈 อยู่รอดดีขึ้น +{X}%',         stable: '🎯 Survival ทรงตัว',            calibrating: '🔄 ฝึกจับจังหวะถอย',              reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_DPS_DEF: {
    damage_dealt:    { strong_up: '🔥 ดาเมจสกัดแรงขึ้น +{X}%!',           up: '📈 ดาเมจป้องกันดีขึ้น +{X}%',    stable: '🎯 ดาเมจทรงตัว (Stable)',       calibrating: '⚔️ กำลังปรับจังหวะสกัด',          reset: '⚙️ ปรับระบบป้องกันใหม่' },
    kills:           { strong_up: '💥 สกัดศัตรูเพิ่มขึ้น +{X}%!',         up: '📈 Kill ป้องกันดีขึ้น +{X}%',    stable: '🎯 Kill ทรงตัว (Stable)',       calibrating: '💥 กำลังหาจังหวะ Peel',            reset: '⚙️ ปรับแนวป้องกันใหม่' },
    assists:         { strong_up: '🤝 ช่วยทีมได้มากขึ้น +{X}%!',          up: '📈 Assist ดีขึ้น +{X}%',         stable: '🎯 Assist ทรงตัว (Stable)',     calibrating: '🤝 กำลังหาตำแหน่ง Support',        reset: '⚙️ ปรับ Teamplay ใหม่' },
    deaths:          { strong_up: '🛡️ ตายน้อยลง +{X}% — กำแพงเหล็ก!',    up: '📈 อยู่รอดดีขึ้น +{X}%',         stable: '🎯 Survival ทรงตัว',            calibrating: '🔄 ฝึกอ่านเกมเพื่อถอยทัน',         reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_TANK: {
    damage_taken:    { strong_up: '💪 ดูดดาเมจให้ทีมได้มากขึ้น +{X}%!',   up: '📈 Tanking ดีขึ้น +{X}%',        stable: '🎯 Tanking ทรงตัว (Stable)',    calibrating: '💪 สัปดาห์นี้ไฟต์น้อยกว่าปกติ',   reset: '⚙️ ปรับแนว Frontline ใหม่' },
    assists:         { strong_up: '🤝 อยู่ร่วมทุกไฟต์ +{X}%!',            up: '📈 Assist ดีขึ้น +{X}%',         stable: '🎯 Assist ทรงตัว (Stable)',     calibrating: '🤝 กำลังหาตำแหน่ง Frontline',      reset: '⚙️ ปรับ Zone Control ใหม่' },
    deaths:          { strong_up: '🛡️ ยืนได้นานขึ้น +{X}% — แท็งก์จริง!', up: '📈 อยู่รอดดีขึ้น +{X}%',         stable: '🎯 Survival ทรงตัว',            calibrating: '🔄 ฝึกอ่าน Focus Target',          reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_HEALER: {
    healing_done:    { strong_up: '💚 รักษาได้มากขึ้น +{X}% ทีมรอดเพราะคุณ!', up: '📈 Healing ดีขึ้น +{X}%',     stable: '🎯 Healing ทรงตัว (Stable)',    calibrating: '💚 กำลังปรับ Priority การรักษา',   reset: '⚙️ ปรับ Heal Rotation ใหม่' },
    ally_revives:    { strong_up: '✨ ปลุกเพื่อนได้มากขึ้น +{X}% — หน่วยกู้ชีพ!', up: '📈 Revive ดีขึ้น +{X}%', stable: '🎯 ทีมรอดโดยไม่ต้องปลุกมาก',   calibrating: '✨ สัปดาห์นี้ทีมรอดดีขึ้น ก็ดี!',   reset: '⚙️ ปรับ Revive Timing ใหม่' },
    deaths:          { strong_up: '🛡️ ตายน้อยลง +{X}% — Healer ยืนได้นาน!', up: '📈 อยู่รอดดีขึ้น +{X}%',       stable: '🎯 Survival ทรงตัว',            calibrating: '🔄 ฝึกตำแหน่งให้ปลอดภัยขึ้น',     reset: '⚙️ ปรับ Positioning ใหม่' },
  },
  ROLE_RESOURCE: {
    resources_gathered: { strong_up: '📦 เก็บทรัพยากรได้มากขึ้น +{X}% — เส้นเลือดทีม!', up: '📈 Resource ดีขึ้น +{X}%', stable: '🎯 Resource ทรงตัว (Stable)', calibrating: '📦 กำลังปรับเส้นทางเก็บใหม่',      reset: '⚙️ ปรับ Route ใหม่' },
    damage_dealt:    { strong_up: '🔥 ดาเมจป้องกันตัวสูงขึ้น +{X}%!',     up: '📈 ดาเมจดีขึ้น +{X}%',           stable: '🎯 ดาเมจทรงตัว (Stable)',       calibrating: '⚔️ กำลังปรับรับมือศัตรูระหว่างเก็บ', reset: '⚙️ ปรับ Survival Route ใหม่' },
    deaths:          { strong_up: '🛡️ อยู่รอดได้นานขึ้น +{X}% เก็บต่อเนื่อง!', up: '📈 อยู่รอดดีขึ้น +{X}%',    stable: '🎯 Survival ทรงตัว',            calibrating: '🔄 ฝึกอ่านเกมเพื่อเอาตัวรอด',      reset: '⚙️ ปรับเส้นทางหลบหลีกใหม่' },
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

/**
 * Resolves the Thai progressive message for a given role/metric/state.
 * Substitutes {X} with the label value (e.g. "+15%").
 */
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
