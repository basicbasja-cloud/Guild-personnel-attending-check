export type AttendanceStatus = 'join' | 'not_join' | 'maybe';

export interface Profile {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  character_name: string | null;
  character_class: string | null;
  main_skill_name: string | null;
  main_skill_level: number | null;
  sub_skill_name: string | null;
  sub_skill_level: number | null;
  is_management: boolean;
  is_admin: boolean;
  is_super_manager: boolean;
  is_test_account: boolean;
  logo_color: string | null;
  notes: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  week_start: string; // ISO date string (Monday of the week)
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
  set_by?: string | null;
  set_by_profile?: Profile | null;
  profile?: Profile;
}

export interface WarSetup {
  id: string;
  week_start: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WarGroup {
  id: string;
  war_setup_id: string;
  group_number: number;
  name: string;
  created_at: string;
}

export interface WarParty {
  id: string;
  group_id: string;
  party_number: number;
  icon: string | null;
  created_at: string;
}

export interface WarPartyMember {
  id: string;
  party_id: string | null; // null = substitute
  war_setup_id: string;
  user_id: string;
  position: number;
  is_substitute: boolean;
  created_at: string;
  profile?: Profile;
}

// UI helper types for drag-and-drop management
export interface PartySlot {
  partyId: string;
  groupId: string;
  position: number;
  member: WarPartyMember | null;
}

export interface GroupData {
  group: WarGroup;
  parties: {
    party: WarParty;
    members: (WarPartyMember | null)[];
  }[];
}

export const MAX_ACTIVE_MEMBERS = 60;
export const MAX_SUBSTITUTE_MEMBERS = 20;
export const MAX_MEMBERS_PER_PARTY = 6;
export const MAX_PARTIES_PER_GROUP = 5;
export const MAX_MEMBERS_PER_GROUP = MAX_MEMBERS_PER_PARTY * MAX_PARTIES_PER_GROUP; // 30

export interface ProfileSkill {
  id: string;
  user_id: string;
  skill_type: 'ultimate' | 'hero';
  skill_name: string;
  skill_level: number | null;
  sort_order: number;
  created_at: string;
}

export type GuildEventColor = 'indigo' | 'amber' | 'rose' | 'emerald' | 'sky';

export interface GuildEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null; // ISO date 'YYYY-MM-DD', null = unscheduled
  start_time: string | null; // 'HH:MM' 24-hr
  color: GuildEventColor;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── KPI Types ────────────────────────────────────────────────────────────────

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
