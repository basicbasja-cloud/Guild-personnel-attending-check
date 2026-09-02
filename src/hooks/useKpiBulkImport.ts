import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ParsedKpiRow } from '../lib/kpiExcel';
import type { Profile } from '../types';
import { invalidateKpiBoardCache } from './useKpiBoard';
import { invalidateKpiEntriesCache } from '../components/kpi/KpiAwardsBoard';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BulkImportResult {
  total:      number;
  success:    number;
  skipped:    number;
  errors:     { row: number; characterName: string; message: string }[];
}

interface UseKpiBulkImportResult {
  importing: boolean;
  results:   BulkImportResult | null;
  bulkImport: (rows: ParsedKpiRow[], weekStart: string, profiles: Profile[]) => Promise<BulkImportResult>;
  reset:     () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useKpiBulkImport(): UseKpiBulkImportResult {
  const [importing, setImporting] = useState(false);
  const [results, setResults]     = useState<BulkImportResult | null>(null);

  const bulkImport = useCallback(
    async (rows: ParsedKpiRow[], weekStart: string, profiles: Profile[]): Promise<BulkImportResult> => {
      setImporting(true);
      setResults(null);

      // Build a lookup: character_name or username → user_id
      // Prefer character_name match, fallback to username
      // Disabled members are excluded — their rows will be reported as skipped.
      const profileMap = new Map<string, string>();
      for (const p of profiles) {
        if (p.is_disabled === true) continue;
        if (p.character_name) {
          profileMap.set(p.character_name.toLowerCase().trim(), p.id);
        }
        // Also store by username as fallback
        if (!profileMap.has(p.username.toLowerCase().trim())) {
          profileMap.set(p.username.toLowerCase().trim(), p.id);
        }
      }
      const disabledNames = new Set(
        profiles
          .filter((p) => p.is_disabled === true)
          .flatMap((p) => [p.username.toLowerCase().trim(), (p.character_name ?? '').toLowerCase().trim()])
      );

      const result: BulkImportResult = {
        total: rows.length,
        success: 0,
        skipped: 0,
        errors: [],
      };

      for (const row of rows) {
        // Skip rows with validation errors
        if (row.errors.length > 0) {
          result.skipped++;
          result.errors.push({
            row: row.rowNumber,
            characterName: row.characterName,
            message: row.errors.join('; '),
          });
          continue;
        }

        // Find user by character name
        const lookupKey = row.characterName.toLowerCase().trim();
        const userId = profileMap.get(lookupKey);

        if (!userId) {
          result.skipped++;
          result.errors.push({
            row: row.rowNumber,
            characterName: row.characterName,
            message: disabledNames.has(lookupKey)
              ? `"${row.characterName}" is currently disabled — entry skipped.`
              : `User not found for "${row.characterName}". Check the name matches a guild member's character name or username.`,
          });
          continue;
        }

        // Upsert the entry
        const { error: rpcErr } = await supabase.rpc('upsert_kpi_weekly_entry', {
          target_user_id:           userId,
          target_week_start:        weekStart,
          target_role_tag:          row.roleTag,
          damage_dealt_value:       row.damage_dealt,
          siege_damage_value:       row.siege_damage,
          damage_taken_value:       row.damage_taken,
          kills_value:              row.kills,
          deaths_value:             row.deaths,
          assists_value:            row.assists,
          healing_done_value:       row.healing_done,
          ally_revives_value:       row.ally_revives,
          resources_gathered_value: row.resources_gathered,
        });

        if (rpcErr) {
          result.errors.push({
            row: row.rowNumber,
            characterName: row.characterName,
            message: rpcErr.message,
          });
        } else {
          result.success++;
        }
      }

      // Invalidate caches so the board and profiles refresh
      invalidateKpiBoardCache(weekStart);
      invalidateKpiEntriesCache(weekStart);

      setImporting(false);
      setResults(result);
      return result;
    },
    [],
  );

  const reset = useCallback(() => {
    setResults(null);
    setImporting(false);
  }, []);

  return { importing, results, bulkImport, reset };
}
