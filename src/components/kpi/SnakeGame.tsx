import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID_SIZE = 20;
const CELL_SIZE = 18;
const TICK_MS = 140;
const INITIAL_SPEED = 140;
const SPEED_BOOST = 3; // ms faster per food eaten

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Cell = { x: number; y: number };

interface LeaderboardEntry {
  username: string;
  score: number;
  created_at: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface SnakeGameProps {
  userId: string;
  username: string;
}

export function SnakeGame({ userId, username }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Mutable refs for game loop
  const snakeRef = useRef<Cell[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Cell>({ x: 15, y: 10 });
  const dirRef = useRef<Direction>('RIGHT');
  const nextDirRef = useRef<Direction>('RIGHT');
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const tickRef = useRef(TICK_MS);
  const loopRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // ── Fetch leaderboard ──────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('mini_game_scores')
      .select('username, score, created_at')
      .eq('game_type', 'snake')
      .order('score', { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data as LeaderboardEntry[]);
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // ── Spawn food ─────────────────────────────────────────────────────────
  const spawnFood = useCallback((snake: Cell[]): Cell => {
    const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
    let cell: Cell;
    do {
      cell = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (occupied.has(`${cell.x},${cell.y}`));
    return cell;
  }, []);

  // ── Reset game ─────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = 'RIGHT';
    nextDirRef.current = 'RIGHT';
    scoreRef.current = 0;
    gameOverRef.current = false;
    tickRef.current = INITIAL_SPEED;
    setScore(0);
    setGameState('idle');
    foodRef.current = spawnFood(snakeRef.current);
  }, [spawnFood]);

  // ── Draw ────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

    // Grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        ctx.strokeStyle = '#1e293b';
        ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Snake body
    const snake = snakeRef.current;
    for (let i = snake.length - 1; i >= 0; i--) {
      const c = snake[i];
      const ratio = i / snake.length;
      const r = Math.round(34 + ratio * 40);
      const g = Math.round(197 - ratio * 60);
      const b = Math.round(94 - ratio * 30);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const pad = i === 0 ? 1 : 2;
      const radius = 3;
      const x = c.x * CELL_SIZE + pad;
      const y = c.y * CELL_SIZE + pad;
      const w = CELL_SIZE - pad * 2;
      const h = CELL_SIZE - pad * 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
    }

    // Snake eyes (head)
    if (snake.length > 0) {
      const head = snake[0];
      const hx = head.x * CELL_SIZE;
      const hy = head.y * CELL_SIZE;
      ctx.fillStyle = 'white';
      const dir = dirRef.current;
      if (dir === 'UP' || dir === 'DOWN') {
        ctx.beginPath();
        ctx.arc(hx + 5, hy + 6, 2, 0, Math.PI * 2);
        ctx.arc(hx + 13, hy + 6, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(hx + 6, hy + 5, 2, 0, Math.PI * 2);
        ctx.arc(hx + 6, hy + 13, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Food with glow
    const food = foodRef.current;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  // ── Game tick ──────────────────────────────────────────────────────────
  const gameTick = useCallback(() => {
    if (gameOverRef.current) return;

    dirRef.current = nextDirRef.current;
    const snake = snakeRef.current;
    const head = { ...snake[0] };

    switch (dirRef.current) {
      case 'UP':    head.y--; break;
      case 'DOWN':  head.y++; break;
      case 'LEFT':  head.x--; break;
      case 'RIGHT': head.x++; break;
    }

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      gameOverRef.current = true;
      setGameState('over');
      return;
    }

    // Self collision
    if (snake.some((c) => c.x === head.x && c.y === head.y)) {
      gameOverRef.current = true;
      setGameState('over');
      return;
    }

    snake.unshift(head);

    // Eat food
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      tickRef.current = Math.max(60, tickRef.current - SPEED_BOOST);
      foodRef.current = spawnFood(snake);
    } else {
      snake.pop();
    }

    draw();
  }, [draw, spawnFood]);

  // ── Game loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = (time: number) => {
      if (gameOverRef.current) return;
      if (time - lastTimeRef.current >= tickRef.current) {
        lastTimeRef.current = time;
        gameTick();
      }
      loopRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    loopRef.current = requestAnimationFrame(loop);

    return () => {
      if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    };
  }, [gameState, gameTick]);

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') {
        if (e.key === 'Enter' || e.key === ' ') startGame();
        return;
      }
      const opposite: Record<Direction, Direction> = {
        UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
      };
      let newDir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': newDir = 'UP'; break;
        case 'ArrowDown': case 's': case 'S': newDir = 'DOWN'; break;
        case 'ArrowLeft': case 'a': case 'A': newDir = 'LEFT'; break;
        case 'ArrowRight': case 'd': case 'D': newDir = 'RIGHT'; break;
      }
      if (newDir) changeDirection(newDir);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState]);

  // ── Draw on mount / state change ──────────────────────────────────────
  useEffect(() => { draw(); }, [draw]);

  // ── Start ──────────────────────────────────────────────────────────────
  const startGame = () => {
    resetGame();
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = 'RIGHT';
    nextDirRef.current = 'RIGHT';
    foodRef.current = spawnFood(snakeRef.current);
    setGameState('playing');
  };

  // ── Save score ─────────────────────────────────────────────────────────
  const saveScore = async () => {
    setSaving(true);
    await supabase.from('mini_game_scores').insert({
      user_id: userId,
      username,
      score: scoreRef.current,
      game_type: 'snake',
    });
    setSaving(false);
    await fetchLeaderboard();
    setShowLeaderboard(true);
  };

  // ── Set high score from leaderboard ────────────────────────────────────
  useEffect(() => {
    const myBest = leaderboard.find((e) => e.username === username);
    if (myBest) setHighScore(myBest.score);
  }, [leaderboard, username]);

  // ── Direction helper (shared by keyboard, swipe, and D-pad) ──────────
  const changeDirection = useCallback((newDir: Direction) => {
    if (gameState !== 'playing') return;
    const opposite: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    if (newDir !== opposite[dirRef.current]) {
      nextDirRef.current = newDir;
    }
  }, [gameState]);

  // ── Touch controls ─────────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx < 10 && absDy < 10) return;
    const newDir: Direction = absDx > absDy
      ? (dx > 0 ? 'RIGHT' : 'LEFT')
      : (dy > 0 ? 'DOWN' : 'UP');
    changeDirection(newDir);
  };

  // ── D-pad button handler ───────────────────────────────────────────────
  const padDir = (dir: Direction) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    changeDirection(dir);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Score + High Score */}
      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-slate-500 text-xs">Score</p>
          <p className="text-white font-bold font-mono text-lg">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-slate-500 text-xs">Best</p>
          <p className="text-amber-400 font-bold font-mono text-lg">{highScore || '-'}</p>
        </div>
        <button
          onClick={() => { setShowLeaderboard(!showLeaderboard); if (!showLeaderboard) fetchLeaderboard(); }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          className="rounded-xl border-2 border-slate-700"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded-xl">
            <button
              onClick={startGame}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/40 transition-all hover:scale-105 active:scale-95"
            >
              🐍 Start Game
            </button>
          </div>
        )}
        {gameState === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 rounded-xl gap-3">
            <p className="text-red-400 font-bold text-lg">Game Over</p>
            <p className="text-white font-mono text-2xl font-bold">{scoreRef.current}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={startGame}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-sm font-bold rounded-lg transition-all hover:scale-105"
              >
                🔄 Play Again
              </button>
              {scoreRef.current > 0 && (
                <button
                  onClick={saveScore}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-bold rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : '💾 Save Score'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      {gameState === 'playing' && (
        <p className="text-slate-500 text-xs">Arrow keys / WASD · D-pad below · swipe on canvas</p>
      )}

      {/* ── D-pad ──────────────────────────────────────────────────────── */}
      {gameState === 'playing' && (
        <div className="flex flex-col items-center gap-1 select-none">
          <button
            onMouseDown={padDir('UP')}
            onTouchStart={padDir('UP')}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-600 active:border-indigo-500 text-white text-2xl transition-colors touch-none"
          >
            ▲
          </button>
          <div className="flex items-center gap-1">
            <button
              onMouseDown={padDir('LEFT')}
              onTouchStart={padDir('LEFT')}
              className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-600 active:border-indigo-500 text-white text-2xl transition-colors touch-none"
            >
              ◀
            </button>
            <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-900/60 border border-slate-700/50 text-slate-600 text-xs">
              🐍
            </div>
            <button
              onMouseDown={padDir('RIGHT')}
              onTouchStart={padDir('RIGHT')}
              className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-600 active:border-indigo-500 text-white text-2xl transition-colors touch-none"
            >
              ▶
            </button>
          </div>
          <button
            onMouseDown={padDir('DOWN')}
            onTouchStart={padDir('DOWN')}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-600 active:border-indigo-500 text-white text-2xl transition-colors touch-none"
          >
            ▼
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="w-full bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
            <span className="text-white text-xs font-semibold">🏆 Snake Leaderboard</span>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="text-slate-400 hover:text-white text-xs"
            >✕</button>
          </div>
          <div className="divide-y divide-slate-700/60 max-h-40 overflow-y-auto">
            {leaderboard.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">No scores yet — be the first!</p>
            ) : (
              leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2 ${
                    entry.username === username ? 'bg-indigo-900/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${
                      i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className={`text-sm ${entry.username === username ? 'text-indigo-300 font-semibold' : 'text-slate-300'}`}>
                      {entry.username}
                      {entry.username === username && <span className="text-[10px] text-indigo-400 ml-1">(you)</span>}
                    </span>
                  </div>
                  <span className="text-white font-mono text-sm font-semibold">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
