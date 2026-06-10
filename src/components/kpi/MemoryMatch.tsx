import { useState, useCallback, useEffect } from 'react';

const EMOJIS = ['🐶','🐱','🐼','🦊','🐸','🦁','🐯','🐰','🦄','🐲','🐳','🦋'];
const PAIRS = 8;
const FLIP_DELAY = 900;

type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initCards(): Card[] {
  const chosen = shuffle(EMOJIS).slice(0, PAIRS);
  const deck = shuffle([...chosen, ...chosen]);
  return deck.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
}

interface MemoryMatchProps {
  onScore?: (score: number) => void;
}

export function MemoryMatch({ onScore }: MemoryMatchProps) {
  const [cards, setCards] = useState<Card[]>(initCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const reset = useCallback(() => {
    setCards(initCards());
    setFlipped([]);
    setLocked(false);
    setMoves(0);
    setMatches(0);
    setGameWon(false);
    setStartTime(null);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (!startTime || gameWon) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 200);
    return () => clearInterval(id);
  }, [startTime, gameWon]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    setLocked(true);
    const [a, b] = flipped;
    if (cards[a].emoji === cards[b].emoji) {
      setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
      setFlipped([]);
      setLocked(false);
      setMatches((m) => {
        const next = m + 1;
        if (next >= PAIRS) {
          setGameWon(true);
          // Score = max(0, 100 - moves * 5 + elapsed * 2)
          const timeBonus = Math.max(0, 60 - elapsed) * 2;
          const final = Math.max(10, 100 - moves * 5 + timeBonus);
          onScore?.(Math.round(final));
        }
        return next;
      });
    } else {
      const t = setTimeout(() => {
        setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c)));
        setFlipped([]);
        setLocked(false);
      }, FLIP_DELAY);
      return () => clearTimeout(t);
    }
  }, [flipped, cards]);

  const handleClick = (id: number) => {
    if (locked || gameWon || cards[id].flipped || cards[id].matched) return;
    if (!startTime) setStartTime(Date.now());
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlipped((prev) => [...prev, id]);
    setMoves((m) => m + 1);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">Moves: <strong className="text-white">{moves}</strong></span>
        <span className="text-slate-400">Matches: <strong className="text-white">{matches}/{PAIRS}</strong></span>
        {startTime && !gameWon && <span className="text-slate-400">Time: <strong className="text-white">{elapsed}s</strong></span>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleClick(card.id)}
            disabled={locked || card.matched}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl text-2xl flex items-center justify-center transition-all duration-300 select-none
              ${card.matched
                ? 'bg-emerald-900/40 border border-emerald-700/50 scale-95 opacity-70'
                : card.flipped
                  ? 'bg-slate-700 border border-indigo-500/60 scale-100'
                  : 'bg-slate-800 border border-slate-600 hover:border-indigo-400/60 hover:scale-105 cursor-pointer active:scale-95'
              }`}
          >
            {card.flipped || card.matched ? card.emoji : '❓'}
          </button>
        ))}
      </div>
      {gameWon && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-emerald-400 font-bold text-lg">🎉 You Win!</p>
          <p className="text-slate-400 text-sm">{moves} moves · {elapsed}s</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            🔄 Play Again
          </button>
        </div>
      )}
    </div>
  );
}
