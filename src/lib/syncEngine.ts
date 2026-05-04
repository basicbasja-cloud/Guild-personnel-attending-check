/**
 * SyncEngine — central mutation queue + background tick + connection status.
 *
 * War member moves are applied optimistically to UI state immediately, then
 * flushed to the database every TICK_MS milliseconds in a single batched
 * write. Coalescing by (setupId:userId) ensures only the final drag position
 * is written when a member is moved multiple times within one tick window.
 */
import { supabase } from './supabase';

export type SyncStatus = 'online' | 'syncing' | 'error' | 'offline';

export interface WarMutation {
  /** Coalesce key — last write wins per (setupId, userId) */
  key: string;
  setupId: string;
  userId: string;
  op: 'assign' | 'remove';
  partyId: string | null;
  position: number;
  isSubstitute: boolean;
}

type Listener<T> = (value: T) => void;

/** How often the queue is flushed to the database (milliseconds). */
const TICK_MS = 400;

class SyncEngineClass {
  private queue = new Map<string, WarMutation>();
  private _status: SyncStatus = 'online';
  private _isLive = false;
  private statusListeners = new Set<Listener<SyncStatus>>();
  private liveListeners = new Set<Listener<boolean>>();
  private pendingListeners = new Set<Listener<number>>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startTick();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this._status === 'offline')
          this.setStatus(this.queue.size > 0 ? 'syncing' : 'online');
      });
      window.addEventListener('offline', () => this.setStatus('offline'));
    }
  }

  // ── Mutation queue ──────────────────────────────────────────────────────

  /** Enqueue a war member mutation. Same key = last write wins (coalesce). */
  enqueue(mut: WarMutation) {
    this.queue.set(mut.key, mut);
    this.setStatus('syncing');
    this.notifyPending();
  }

  getPendingCount() {
    return this.queue.size;
  }

  // ── Status ───────────────────────────────────────────────────────────────

  getStatus(): SyncStatus {
    return this._status;
  }

  getLive(): boolean {
    return this._isLive;
  }

  /** Called by useWarSetup realtime subscription handler. */
  setLive(live: boolean) {
    if (this._isLive === live) return;
    this._isLive = live;
    this.liveListeners.forEach((cb) => cb(live));
  }

  onStatus(cb: Listener<SyncStatus>): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  onLive(cb: Listener<boolean>): () => void {
    this.liveListeners.add(cb);
    return () => this.liveListeners.delete(cb);
  }

  onPending(cb: Listener<number>): () => void {
    this.pendingListeners.add(cb);
    return () => this.pendingListeners.delete(cb);
  }

  private setStatus(s: SyncStatus) {
    if (this._status === s) return;
    this._status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private notifyPending() {
    const count = this.queue.size;
    this.pendingListeners.forEach((cb) => cb(count));
  }

  // ── Tick loop ────────────────────────────────────────────────────────────

  private startTick() {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => void this.tick(), TICK_MS);
  }

  private async tick() {
    if (this.queue.size === 0 || this._status === 'offline') return;

    // Snapshot and clear queue — new mutations during async work stay queued
    const batch = [...this.queue.values()];
    batch.forEach((m) => this.queue.delete(m.key));
    this.notifyPending();

    try {
      // Group by setupId so we batch all changes for one war in two queries
      const bySetup = new Map<string, WarMutation[]>();
      for (const m of batch) {
        const arr = bySetup.get(m.setupId) ?? [];
        arr.push(m);
        bySetup.set(m.setupId, arr);
      }

      for (const [setupId, mutations] of bySetup) {
        const allUserIds = mutations.map((m) => m.userId);
        const assigns = mutations.filter((m) => m.op === 'assign');

        // Step 1: delete all current slots for affected users in this setup
        const { error: delErr } = await supabase
          .from('war_party_members')
          .delete()
          .eq('war_setup_id', setupId)
          .in('user_id', allUserIds);

        if (delErr) throw delErr;

        // Step 2: re-insert final positions for assign operations
        if (assigns.length > 0) {
          const { error: insErr } = await supabase
            .from('war_party_members')
            .insert(
              assigns.map((m) => ({
                war_setup_id: m.setupId,
                user_id: m.userId,
                party_id: m.partyId,
                position: m.position,
                is_substitute: m.isSubstitute,
              }))
            );

          if (insErr) throw insErr;
        }
      }

      // If no new mutations arrived during the async work, go back to online
      this.setStatus(this.queue.size > 0 ? 'syncing' : 'online');
      this.notifyPending();
    } catch (err) {
      console.error('[SyncEngine] flush error:', err);
      // Re-queue failed mutations unless superseded by newer ones
      batch.forEach((m) => {
        if (!this.queue.has(m.key)) this.queue.set(m.key, m);
      });
      this.notifyPending();
      this.setStatus('error');
      // Auto-recover after 3 s so the next tick can retry
      setTimeout(() => {
        if (this._status === 'error')
          this.setStatus(this.queue.size > 0 ? 'syncing' : 'online');
      }, 3000);
    }
  }
}

/** Singleton sync engine — import this everywhere you need it. */
export const syncEngine = new SyncEngineClass();
