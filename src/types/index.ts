export type AttendanceStatus = 'join' | 'not_join' | 'maybe';

export interface Profile {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  character_name: string | null;
  character_class: string | null;
  is_management: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  week_start: string; // ISO date string (Monday of the week)
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
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
