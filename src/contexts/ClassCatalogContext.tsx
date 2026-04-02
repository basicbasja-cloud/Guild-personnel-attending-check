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

export function ClassCatalogProvider({ children }: { children: ReactNode }) {
  const [classCatalog, setClassCatalog] = useState<ClassCatalogItem[]>(DEFAULT_CLASS_CATALOG);

  const refreshClassCatalog = useCallback(async () => {
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
    setClassCatalog(mergedCatalog);
  }, []);

  useEffect(() => {
    void refreshClassCatalog();
  }, [refreshClassCatalog]);

  const classColorMap = useMemo(() => {
    const map = new Map<string, string>();
    classCatalog.forEach((item) => {
      map.set(normalizeClassName(item.name), item.color_hex);
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
