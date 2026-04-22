import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface ClassCatalogItem {
  name: string;
  color_hex: string;
}

interface ClassCatalogContextValue {
  classCatalog: ClassCatalogItem[];
  getClassColor: (className: string | null | undefined) => string;
  refreshClassCatalog: () => Promise<void>;
}

const DEFAULT_CLASS_COLOR = '#475569';

const DEFAULT_CLASS_CATALOG: ClassCatalogItem[] = [
  { name: 'Ironclad (หมัด)', color_hex: '#C2A500' },
  { name: 'Celestune (พิณ)', color_hex: '#1E3A8A' },
  { name: 'Numina (โคม)', color_hex: '#7C3AED' },
  { name: 'Night walker (ดาบ)', color_hex: '#1D9BF0' },
  { name: 'Dragonsvale (กระบี่)', color_hex: '#0F766E' },
  { name: 'Bloodstrom (หอก)', color_hex: '#DC2626' },
  { name: 'Sylphs (พระ)', color_hex: '#EC4899' },
];

function normalizeClassName(className: string) {
  return className.trim().toLowerCase();
}

function toUniqueCatalog(items: ClassCatalogItem[]) {
  const seen = new Set<string>();
  const result: ClassCatalogItem[] = [];

  for (const item of items) {
    const normalized = normalizeClassName(item.name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
  }

  return result;
}

const ClassCatalogContext = createContext<ClassCatalogContextValue | null>(null);

const CLASS_CATALOG_STORAGE_KEY = 'gwm_class_catalog_v1';

function readPersistedCatalog(): ClassCatalogItem[] | null {
  try {
    const raw = localStorage.getItem(CLASS_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClassCatalogItem[];
  } catch {
    return null;
  }
}

function persistCatalog(catalog: ClassCatalogItem[]) {
  try {
    localStorage.setItem(CLASS_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch { /* ignore quota errors */ }
}

// Module-level cache — survives re-mounts and tab switches within the same
// page session. Falls back to localStorage so even page refreshes are instant.
let cachedCatalog: ClassCatalogItem[] | null = readPersistedCatalog();

export function ClassCatalogProvider({ children }: { children: ReactNode }) {
  const [classCatalog, setClassCatalog] = useState<ClassCatalogItem[]>(
    cachedCatalog ?? DEFAULT_CLASS_CATALOG
  );

  const refreshClassCatalog = useCallback(async () => {
    // Skip network call if already fetched this session.
    if (cachedCatalog !== null) {
      setClassCatalog(cachedCatalog);
      return;
    }
    const { data, error } = await supabase
      .from('class_catalog')
      .select('name,color_hex')
      .order('name', { ascending: true });

    if (error || !data) {
      setClassCatalog(DEFAULT_CLASS_CATALOG);
      return;
    }

    const mergedCatalog = toUniqueCatalog([
      ...DEFAULT_CLASS_CATALOG,
      ...(data as ClassCatalogItem[]),
    ]);
    cachedCatalog = mergedCatalog;
    persistCatalog(mergedCatalog);
    setClassCatalog(mergedCatalog);
  }, []);

  useEffect(() => {
    void refreshClassCatalog();
  }, [refreshClassCatalog]);

  const classColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (Array.isArray(classCatalog) ? classCatalog : []).forEach((item) => {
      if (item && item.name) map.set(normalizeClassName(item.name), item.color_hex);
    });
    return map;
  }, [classCatalog]);

  const getClassColor = useCallback(
    (className: string | null | undefined) => {
      if (!className) return DEFAULT_CLASS_COLOR;
      return classColorMap.get(normalizeClassName(className)) ?? DEFAULT_CLASS_COLOR;
    },
    [classColorMap]
  );

  const value = useMemo(
    () => ({ classCatalog, getClassColor, refreshClassCatalog }),
    [classCatalog, getClassColor, refreshClassCatalog]
  );

  return <ClassCatalogContext.Provider value={value}>{children}</ClassCatalogContext.Provider>;
}

export function useClassCatalog() {
  const context = useContext(ClassCatalogContext);
  if (!context) {
    throw new Error('useClassCatalog must be used within ClassCatalogProvider');
  }
  return context;
}
