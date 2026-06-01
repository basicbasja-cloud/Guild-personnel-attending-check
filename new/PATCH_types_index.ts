// ─── KPI Types ────────────────────────────────────────────────────────────────
// APPEND these to the end of src/types/index.ts
// Also ADD `is_super_manager: boolean;` to the Profile interface after `is_admin: boolean;`

export type KpiRoleTag =
  | 'ROLE_DPS_DMG'
  | 'ROLE_DPS_DEF'
  | 'ROLE_TANK'
  | 'ROLE_HEALER'
  | 'ROLE_RESOURCE';

export type KpiMetricKey =
  | 'damage_dealt'
  | 'siege_damage'
  | 'damage_taken'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'healing_done'
  | 'ally_revives'
  | 'resources_gathered';

export type KpiProgressiveState =
  | 'baseline'
  | 'strong_up'
  | 'up'
  | 'stable'
  | 'calibrating'
  | 'reset';

/** Row returned by get_kpi_public_board() RPC */
export interface KpiBoardRow {
  board_name:      string;
  board_emoji:     string;
  board_label:     string;
  board_subtitle:  string;
  rank_no:         number;
  user_id:         string;
  username:        string;
  character_name:  string | null;
  character_class: string | null;
  role_tag:        KpiRoleTag;
  visible_score:   number | null;
}

/** Row returned by get_kpi_profile() RPC */
export interface KpiProfileRow {
  week_start:        string;
  role_tag:          KpiRoleTag;
  metric_key:        KpiMetricKey;
  metric_label:      string;
  metric_value:      number;
  progressive_pct:   number | null;
  progressive_label: string | null;
  progressive_state: KpiProgressiveState;
}

/** Raw entry from kpi_weekly_entries table */
export interface KpiWeeklyEntry {
  id:                 string;
  week_start:         string;
  user_id:            string;
  role_tag:           KpiRoleTag;
  damage_dealt:       number;
  siege_damage:       number;
  damage_taken:       number;
  kills:              number;
  deaths:             number;
  assists:            number;
  healing_done:       number;
  ally_revives:       number;
  resources_gathered: number;
  entered_by:         string | null;
  created_at:         string;
  updated_at:         string;
}

/** Input shape for upsert_kpi_weekly_entry() */
export interface KpiEntryInput {
  role_tag:           KpiRoleTag;
  damage_dealt:       number;
  siege_damage:       number;
  damage_taken:       number;
  kills:              number;
  deaths:             number;
  assists:            number;
  healing_done:       number;
  ally_revives:       number;
  resources_gathered: number;
}
