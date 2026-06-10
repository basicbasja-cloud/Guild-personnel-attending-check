import { useState, useRef, useCallback, useEffect } from 'react';
import { recordScore, getBestScore } from '../../hooks/useScoreboard';

const GAME_KEY = 'aim_trainer';
const GAME_DURATION = 15; // seconds
const TARGET_LIFETIME = 900; // ms before target disappears

interface Target {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  size: number;
}

interface AimTrainerProps {
  onScore?: (score: number) => void;
}

export function AimTrainer({ onScore }: AimTrainerProps) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getBestScore(GAME_KEY));
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targets, setTargets] = useState<Target[]>([]);
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  const timerRef = useRef<number>(0);
  const spawnRef = useRef<number>(0);

  useEffect(() => () => { clearInterval(timerRef.current); clearInterval(spawnRef.current); }, []);

  const spawnTarget = useCallback(() => {
    idRef.current += 1;
    const size = 28 + Math.random() * 20;
    setTargets((prev) => [
      ...prev,
      {
        id: idRef.current,
        x: Math.random() * 80 + 10,
        y: Math.random() * 65 + 10,
        createdAt: Date.now(),
        size,
      },
    ]);
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(GAME_DURATION);
    setTargets([]);
    setPhase('playing');

    spawnTarget();
    spawnRef.current = window.setInterval(spawnTarget, 800);

    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          clearInterval(spawnRef.current);
          const final = scoreRef.current;
          onScore?.(final);
          const { best } = recordScore(GAME_KEY, final);
          setHighScore(best);
          setPhase('over');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [spawnTarget]);

  // Remove expired targets
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const now = Date.now();
      setTargets((prev) => prev.filter((t) => now - t.createdAt < TARGET_LIFETIME));
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  const handleHit = (targetId: number) => {
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setTargets((prev) => prev.filter((t) => t.id !== targetId));
    spawnTarget(); // extra spawn on hit
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm w-full justify-between">
        <span className="text-slate-400">Hits: <strong className="text-white">{score}</strong></span>
        <span className="text-slate-400">Best: <strong className="text-amber-400">{highScore}</strong></span>
        <span className="text-slate-400">Time: <strong className={timeLeft <= 3 && phase === 'playing' ? 'text-red-400' : 'text-white'}>{timeLeft}s</strong></span>
      </div>

      {/* Game area */}
      <div className={`relative w-full h-52 rounded-xl overflow-hidden select-none
        ${phase === 'playing' ? 'bg-slate-800/80 border border-slate-600' : 'bg-slate-800/40 border border-slate-700'}`}
      >
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={startGame}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95">
              🎯 Start Aim Training
            </button>
          </div>
        )}

        {phase === 'playing' && targets.map((t) => (
          <button
            key={t.id}
            onClick={() => handleHit(t.id)}
            className="absolute rounded-full bg-rose-500 hover:bg-rose-400 cursor-crosshair transition-transform active:scale-90"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.size}px`,
              height: `${t.size}px`,
              boxShadow: '0 0 12px rgba(225,29,72,0.5)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-white font-bold text-lg">⏱ Time's Up!</p>
            <p className="text-3xl font-bold font-mono text-white">{score}</p>
            {score >= highScore && score > 0 && <p className="text-amber-400 text-xs animate-pulse">🏆 New Best!</p>}
            <button onClick={startGame}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">🔄 Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
