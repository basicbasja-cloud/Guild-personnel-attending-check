import { useState, useRef, useEffect, useCallback } from 'react';

type Phase = 'waiting' | 'ready' | 'too_soon' | 'go' | 'result';

interface ReactionTestProps {
  onScore?: (score: number) => void;
}

export function ReactionTest({ onScore }: ReactionTestProps) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [score, setScore] = useState<number | null>(null);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem('gwm_reaction_best')) || 0; } catch { return 0; }
  });
  const [attempts, setAttempts] = useState(0);
  const timeoutRef = useRef<number>(0);
  const startRef = useRef(0);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const start = useCallback(() => {
    setPhase('ready');
    setScore(null);
    const delay = 1500 + Math.random() * 3000;
    timeoutRef.current = window.setTimeout(() => {
      setPhase('go');
      startRef.current = performance.now();
    }, delay);
  }, []);

  const handleClick = () => {
    if (phase === 'ready') {
      clearTimeout(timeoutRef.current);
      setPhase('too_soon');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - startRef.current);
      setScore(ms);
      setAttempts((a) => a + 1);
      // Lower is better → convert to score where higher = faster
      const scoreVal = Math.max(1, Math.round(1000 / ms * 10));
      onScore?.(scoreVal);
      if (best === 0 || ms < best) {
        setBest(ms);
        try { localStorage.setItem('gwm_reaction_best', String(ms)); } catch { /* noop */ }
      }
      setPhase('result');
      return;
    }
    if (phase === 'waiting' || phase === 'too_soon' || phase === 'result') {
      start();
    }
  };

  const bgClass =
    phase === 'go' ? 'bg-emerald-700'
    : phase === 'too_soon' ? 'bg-rose-700'
    : phase === 'result' ? 'bg-slate-800'
    : 'bg-slate-800';

  const text =
    phase === 'waiting' ? 'Click to Start'
    : phase === 'ready' ? 'Wait for green...'
    : phase === 'too_soon' ? 'Too soon! Click to retry'
    : phase === 'go' ? 'CLICK NOW!'
    : `${score}ms`;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        className={`w-full h-32 rounded-2xl ${bgClass} border border-slate-600
          text-white font-bold text-lg transition-colors duration-100 select-none
          ${phase === 'go' ? 'animate-pulse shadow-lg shadow-emerald-500/30' : ''}
          ${phase === 'waiting' ? 'hover:bg-slate-700' : ''}
          active:scale-[0.98] cursor-pointer`}
      >
        {text}
      </button>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">Best: <strong className="text-amber-400">{best > 0 ? `${best}ms` : '—'}</strong></span>
        <span className="text-slate-400">Attempts: <strong className="text-white">{attempts}</strong></span>
      </div>
      {phase === 'result' && score != null && (
        <span className={`text-sm font-medium ${score <= 200 ? 'text-emerald-400' : score <= 300 ? 'text-amber-400' : 'text-slate-400'}`}>
          {score <= 200 ? '⚡ Lightning fast!' : score <= 300 ? '👍 Good reaction' : '🐢 A bit slow'}
        </span>
      )}
    </div>
  );
}
