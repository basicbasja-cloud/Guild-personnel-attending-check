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

const SHOULD_LOG_TIMING =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DB_TIMING === 'true';

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
  run: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 15000
): Promise<T> {
  const start = performance.now();
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      // Abort the underlying request when the caller honors the signal.
      controller.abort();
      reject(new Error(`Request timed out after ${timeoutMs}ms (${label}).`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([run(controller.signal), timeoutPromise]);
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
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms (${label}).`);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
