type DbMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface DbTimingEntry {
  at: string;
  method: DbMethod;
  label: string;
  durationMs: number;
  ok: boolean;
}

declare global {
  interface Window {
    __gwmDbTimings?: DbTimingEntry[];
  }
}

const SHOULD_LOG_TIMING = import.meta.env.VITE_ENABLE_DB_TIMING !== 'false';

function recordTiming(entry: DbTimingEntry) {
  if (!SHOULD_LOG_TIMING || typeof window === 'undefined') return;

  const list = window.__gwmDbTimings ?? [];
  list.push(entry);
  if (list.length > 200) list.shift();
  window.__gwmDbTimings = list;

  const status = entry.ok ? 'ok' : 'error';
  console.info(
    `[DB ${entry.method}] ${entry.label} - ${entry.durationMs.toFixed(1)}ms (${status})`
  );
}

export async function withDbTiming<T>(
  method: DbMethod,
  label: string,
  run: () => PromiseLike<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await run();
    recordTiming({
      at: new Date().toISOString(),
      method,
      label,
      durationMs: performance.now() - start,
      ok: true,
    });
    return result;
  } catch (error) {
    recordTiming({
      at: new Date().toISOString(),
      method,
      label,
      durationMs: performance.now() - start,
      ok: false,
    });
    throw error;
  }
}
