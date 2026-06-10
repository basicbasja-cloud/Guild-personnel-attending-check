import { useState, useCallback, useEffect } from 'react';
import { recordScore, getBestScore } from '../../hooks/useScoreboard';

const GAME_KEY = 'sequence_memory';
const COLORS = [
  { name: 'red',    bg: 'bg-red-500',   active: 'bg-red-300', hex: '#EF4444' },
  { name: 'blue',   bg: 'bg-blue-500',  active: 'bg-blue-300', hex: '#3B82F6' },
  { name: 'green',  bg: 'bg-green-500', active: 'bg-green-300', hex: '#10B981' },
  { name: 'yellow', bg: 'bg-yellow-500',active: 'bg-yellow-300',hex: '#F59E0B' },
];
const SHOW_DELAY = 600;
const START_LENGTH = 3;

interface SequenceMemoryProps {
  onScore?: (score: number) => void;
}

export function SequenceMemory({ onScore }: SequenceMemoryProps) {
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'over'>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIdx, setInputIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getBestScore(GAME_KEY));
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [round, setRound] = useState(1);

  const startGame = useCallback(() => {
    const seq = Array.from({ length: START_LENGTH }, () => Math.floor(Math.random() * 4));
    setSequence(seq);
    setInputIdx(0);
    setScore(0);
    setRound(1);
    setPhase('showing');
  }, []);

  // Show the sequence
  useEffect(() => {
    if (phase !== 'showing' || sequence.length === 0) return;
    let i = 0;
    const interval = setInterval(() => {
      setActiveIdx(sequence[i]);
      setTimeout(() => setActiveIdx(null), SHOW_DELAY / 2);
      i++;
      if (i >= sequence.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('input'), 300);
      }
    }, SHOW_DELAY);
    return () => clearInterval(interval);
  }, [phase, sequence]);

  const handleColorClick = useCallback((colorIdx: number) => {
    if (phase !== 'input') return;

    setActiveIdx(colorIdx);
    setTimeout(() => setActiveIdx(null), 200);

    if (colorIdx !== sequence[inputIdx]) {
      // Wrong!
      const final = score;
      onScore?.(final);
      const { best } = recordScore(GAME_KEY, final);
      setHighScore(best);
      setPhase('over');
      return;
    }

    const nextIdx = inputIdx + 1;
    if (nextIdx >= sequence.length) {
      // Round complete
      const newScore = score + 10;
      setScore(newScore);
      setRound((r) => r + 1);
      // Extend sequence
      const newSeq = [...sequence, Math.floor(Math.random() * 4)];
      setSequence(newSeq);
      setInputIdx(0);
      setTimeout(() => setPhase('showing'), 400);
    } else {
      setInputIdx(nextIdx);
    }
  }, [phase, sequence, inputIdx, score]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm w-full justify-between">
        <span className="text-slate-400">Score: <strong className="text-white">{score}</strong></span>
        <span className="text-slate-400">Best: <strong className="text-amber-400">{highScore}</strong></span>
        <span className="text-slate-400">Round: <strong className="text-white">{round}</strong></span>
      </div>

      <div className="text-slate-500 text-xs text-center h-4">
        {phase === 'idle' && 'Press Start to play'}
        {phase === 'showing' && '👀 Watch the sequence...'}
        {phase === 'input' && `✋ Repeat it (${inputIdx + 1}/${sequence.length})`}
        {phase === 'over' && '💥 Wrong!'}
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map((c, i) => (
          <button
            key={c.name}
            onClick={() => handleColorClick(i)}
            disabled={phase !== 'input'}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl transition-all duration-150
              ${activeIdx === i ? `${c.active} scale-110 shadow-lg` : c.bg}
              ${phase === 'input' ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
              ${phase === 'idle' || phase === 'over' ? 'opacity-50' : ''}
              border-2 border-white/10`}
          />
        ))}
      </div>

      {phase === 'idle' && (
        <button onClick={startGame}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
          ▶ Start Game
        </button>
      )}

      {phase === 'over' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-white text-lg font-bold">Sequence: {sequence.length}</p>
          {score >= highScore && score > 0 && <p className="text-amber-400 text-xs animate-pulse">🏆 New Best!</p>}
          <button onClick={startGame}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">🔄 Retry</button>
        </div>
      )}
    </div>
  );
}
