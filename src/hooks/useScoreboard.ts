const STORAGE_KEY = 'gwm_minigame_bests';

interface Scoreboard {
  [gameKey: string]: number; // best score per game
}

function load(): Scoreboard {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(board: Scoreboard) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch { /* quota */ }
}

export function getBestScore(gameKey: string): number {
  return load()[gameKey] ?? 0;
}

export function recordScore(gameKey: string, score: number): { isNewBest: boolean; best: number } {
  const board = load();
  const prev = board[gameKey] ?? 0;
  if (score > prev) {
    board[gameKey] = score;
    save(board);
    return { isNewBest: true, best: score };
  }
  return { isNewBest: false, best: prev };
}

export function getAllScores(): Scoreboard {
  return load();
}

export function useScoreboard() {
  // Simple re-render trigger — call recordScore() for writes, getBestScore() for reads
  return { getBestScore, recordScore, getAllScores };
}
