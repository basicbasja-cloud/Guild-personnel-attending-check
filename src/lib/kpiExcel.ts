import * as XLSX from 'xlsx';
import { KPI_ROLES } from '../constants/kpi';
import type { Profile } from '../types';

// ─── Template columns ────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string }[] = [
  { key: 'character_name',     label: 'Character Name'    },
  { key: 'role_tag',           label: 'Role'              },
  { key: 'damage_dealt',       label: 'Damage Dealt'      },
  { key: 'siege_damage',       label: 'Siege Damage'      },
  { key: 'damage_taken',       label: 'Damage Taken'      },
  { key: 'kills',              label: 'Kills'             },
  { key: 'deaths',             label: 'Deaths'            },
  { key: 'assists',            label: 'Assists'           },
  { key: 'healing_done',       label: 'Healing Done'      },
  { key: 'ally_revives',       label: 'Ally Revives'      },
  { key: 'resources_gathered', label: 'Resources Gathered' },
];

// ─── Parsed row type ─────────────────────────────────────────────────────────

export interface ParsedKpiRow {
  rowNumber: number;
  characterName: string;
  roleTag: string;
  damage_dealt: number;
  siege_damage: number;
  damage_taken: number;
  kills: number;
  deaths: number;
  assists: number;
  healing_done: number;
  ally_revives: number;
  resources_gathered: number;
  errors: string[];
}

// ─── Template generation ─────────────────────────────────────────────────────

const ROLE_TAG_LIST = KPI_ROLES.map((r) => r.tag);

/**
 * Generate an Excel template workbook:
 * - Header row
 * - One row per guild member (character_name pre-filled, sorted A→Z)
 * - Role column has a dropdown (data validation) with valid role tags
 * - Score columns are pre-filled with 0, ready for user to type over
 *
 * @param members — List of guild profiles to pre-populate
 * @returns Workbook as ArrayBuffer ready for download
 */
export function generateTemplateWorkbook(members: Profile[]): ArrayBuffer {
  // Sort members by character name (or username fallback), exclude test accounts
  const sorted = [...members]
    .filter((m) => !m.is_test_account)
    .sort((a, b) => {
      const nameA = (a.character_name || a.username).toLowerCase();
      const nameB = (b.character_name || b.username).toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Build rows: header + one per member
  const wsData: (string | number)[][] = [
    COLUMNS.map((c) => c.label),
    ...sorted.map((m) => {
      const name = m.character_name || m.username;
      return [name, 'ROLE_DPS_DMG', 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths — auto-size the character_name column
  ws['!cols'] = COLUMNS.map((c) => {
    let maxLen = c.label.length;
    if (c.key === 'character_name') {
      for (const m of sorted) {
        maxLen = Math.max(maxLen, (m.character_name || m.username).length);
      }
    }
    return { wch: Math.min(maxLen + 4, 40) };
  });

  // ── Data validation: Role dropdown (column B, rows 2..N) ──────────────
  const lastRow = wsData.length; // header row 1 + data rows
  if (lastRow >= 2) {
    ws['!dataValidation'] = [
      {
        type: 'list' as const,
        formula1: `"${ROLE_TAG_LIST.join(',')}"`,
        allowBlank: false,
        showErrorMessage: true,
        errorTitle: 'Invalid Role',
        error: `Select one of: ${ROLE_TAG_LIST.join(',')}`,
        sqref: `B2:B${lastRow}`,
      },
    ];
  }

  // ── Reference sheet with valid role descriptions ──────────────────────
  const roleSheetData: string[][] = [
    ['Valid Role Tags', 'Description'],
    ...KPI_ROLES.map((r) => [r.tag, r.label]),
    [],
    ['💡 Tip', 'Use the dropdown in column B of the KPI Entries sheet'],
  ];
  const roleSheet = XLSX.utils.aoa_to_sheet(roleSheetData);
  roleSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KPI Entries');
  XLSX.utils.book_append_sheet(wb, roleSheet, 'Valid Roles');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/**
 * Trigger a browser download of the KPI Excel template with pre-filled members.
 *
 * @param members — List of guild profiles to pre-populate into the template
 */
export function downloadKpiTemplate(members: Profile[]) {
  const buffer = generateTemplateWorkbook(members);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kpi-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Excel parsing ───────────────────────────────────────────────────────────

const VALID_ROLE_TAGS = new Set<string>(KPI_ROLES.map((r) => r.tag));

const NUMERIC_KEYS: (keyof ParsedKpiRow)[] = [
  'damage_dealt',
  'siege_damage',
  'damage_taken',
  'kills',
  'deaths',
  'assists',
  'healing_done',
  'ally_revives',
  'resources_gathered',
];

/**
 * Parse an uploaded Excel (.xlsx) file and return validated rows.
 * Invalid rows have their errors populated — they are not excluded so the
 * user can see what needs to be fixed.
 */
export async function parseKpiExcel(file: File): Promise<ParsedKpiRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Use the first sheet
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
  });

  // Build a header mapping (case-insensitive, trim, normalize spaces)
  const headerMap = buildHeaderMap(sheet);

  const results: ParsedKpiRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const rowNumber = i + 2; // 1-indexed, +1 for header
    const errors: string[] = [];

    const characterName = normalizeStr(row[headerMap.get('charactername') ?? ''] ?? '');

    if (!characterName) {
      errors.push('Row ' + rowNumber + ': Missing character name');
    }

    const roleTag = normalizeStr(row[headerMap.get('role') ?? ''] ?? '');

    if (!roleTag) {
      errors.push('Row ' + rowNumber + ': Missing role');
    } else if (!VALID_ROLE_TAGS.has(roleTag)) {
      errors.push(`Row ${rowNumber}: Invalid role "${roleTag}". Valid roles: ${KPI_ROLES.map(r => r.tag).join(', ')}`);
    }

    const parsed: ParsedKpiRow = {
      rowNumber,
      characterName,
      roleTag,
      damage_dealt: 0,
      siege_damage: 0,
      damage_taken: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      healing_done: 0,
      ally_revives: 0,
      resources_gathered: 0,
      errors,
    };

    for (const key of NUMERIC_KEYS) {
      const headerLabel = key
        .replace(/_/g, '')
        .toLowerCase();
      const colKey = findNumericColumnKey(row, headerMap, headerLabel);
      if (colKey) {
        const val = parseNumeric(row[colKey]);
        if (isNaN(val) || val < 0) {
          errors.push(`Row ${rowNumber}: Invalid value for "${key}"`);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed as any)[key] = val;
        }
      }
    }

    results.push(parsed);
  }

  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaderMap(sheet: XLSX.WorkSheet): Map<string, string> {
  const map = new Map<string, string>();
  const ref = sheet['!ref'];
  if (!ref) return map;

  const range = XLSX.utils.decode_range(ref);
  if (range.s.r > 0) return map; // header must be in first row

  const headerRow: unknown[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = sheet[addr];
    headerRow.push(cell ? cell.v : '');
  }

  for (let c = 0; c < headerRow.length; c++) {
    const rawLabel = String(headerRow[c] ?? '').trim();
    const normalized = rawLabel.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    if (normalized) {
      map.set(normalized, XLSX.utils.encode_cell({ r: 0, c }));
    }
  }

  return map;
}

function findNumericColumnKey(
  _row: Record<string, unknown>,
  headerMap: Map<string, string>,
  normalizedLabel: string,
): string | null {
  for (const [norm, colAddr] of headerMap) {
    if (norm === normalizedLabel) return colAddr;
  }
  return null;
}

function normalizeStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function parseNumeric(v: unknown): number {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[,\s]/g, '');
  return parseFloat(cleaned);
}
