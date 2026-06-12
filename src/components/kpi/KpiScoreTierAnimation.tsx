import { useState, useMemo, useEffect, useRef } from 'react';

// ── Score tier definitions ─────────────────────────────────────────────────

interface ScoreTier {
  minScore: number;
  emoji: string;
  title: string;
  subtitle: string;
  glowColor: string;
  sceneBg: string;
}

const TIERS: ScoreTier[] = [
  {
    minScore: 0,
    emoji: '🗡️',
    title: 'Recruit',
    subtitle: 'Just sharpened your blade',
    glowColor: 'rgba(148,163,184,0.3)',
    sceneBg: 'from-slate-800/60 to-slate-900/60',
  },
  {
    minScore: 1_500_000,
    emoji: '⚔️',
    title: 'Warrior',
    subtitle: 'Blooded in battle',
    glowColor: 'rgba(217,119,6,0.3)',
    sceneBg: 'from-amber-900/40 to-slate-900/60',
  },
  {
    minScore: 3_000_000,
    emoji: '🛡️',
    title: 'Knight',
    subtitle: 'Armored and unwavering',
    glowColor: 'rgba(8,145,178,0.3)',
    sceneBg: 'from-cyan-900/40 to-slate-900/60',
  },
  {
    minScore: 5_000_000,
    emoji: '🐉',
    title: 'Dragon Slayer',
    subtitle: 'Fear of no beast',
    glowColor: 'rgba(124,58,237,0.3)',
    sceneBg: 'from-violet-900/50 to-slate-900/60',
  },
  {
    minScore: 7_000_000,
    emoji: '👑',
    title: 'Demon King',
    subtitle: 'You slay the demon lord',
    glowColor: 'rgba(245,158,11,0.5)',
    sceneBg: 'from-amber-900/60 via-rose-900/30 to-slate-900/60',
  },
];

function getTier(score: number): ScoreTier {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

function getNextTier(score: number): ScoreTier | null {
  for (const t of TIERS) {
    if (score < t.minScore) return t;
  }
  return null;
}

function getTierProgress(score: number): number {
  const current = getTier(score);
  const next = getNextTier(score);
  if (!next) return 1;
  const range = next.minScore - current.minScore;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, (score - current.minScore) / range));
}

// ── Scene: Recruit (🗡️) — Training field ───────────────────────────────────

function RecruitScene() {
  return (
    <div className="relative w-full h-24 overflow-hidden rounded-xl bg-linear-to-b from-slate-800/40 to-slate-900/60">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-amber-900/20 to-transparent" />
      {[1,2,3].map(i => (
        <span key={`d${i}`} className="absolute w-1 h-1 rounded-full bg-amber-600/20"
          style={{ left: `${15 + i * 25}%`, top: '75%', animation: `ks-dust-drift 3s ${i * 0.8}s ease-in-out infinite` }} />
      ))}
      <span className="absolute left-[18%] bottom-4 text-xl select-none"
        style={{ animation: 'ks-dummy-wobble 4s ease-in-out infinite' }}>🎯</span>
      <span className="absolute left-[55%] bottom-4 text-2xl select-none z-10"
        style={{ animation: 'ks-soldier-swing 2.5s ease-in-out infinite' }}>🧍</span>
      <span className="absolute left-[70%] bottom-6 text-lg select-none"
        style={{ animation: 'ks-slash-arc 2.5s ease-in-out infinite' }}>🗡️</span>
      {[1,2,3].map(i => (
        <span key={`s${i}`} className="absolute text-xs select-none"
          style={{ left: `${65 + i * 4}%`, bottom: `${30 + i * 8}%`, animation: `ks-sparkle-pop 2.5s ${i * 0.3}s ease-in-out infinite` }}>✨</span>
      ))}
    </div>
  );
}

// ── Scene: Warrior (⚔️) — Battlefield clash ───────────────────────────────

function WarriorScene() {
  return (
    <div className="relative w-full h-24 overflow-hidden rounded-xl bg-linear-to-b from-amber-900/30 to-slate-900/60">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-amber-900/30 to-transparent" />
      <span className="absolute left-[10%] top-4 text-lg select-none opacity-20"
        style={{ animation: 'ks-smoke-drift 6s ease-in-out infinite' }}>💨</span>
      <span className="absolute right-[15%] top-2 text-lg select-none opacity-20"
        style={{ animation: 'ks-smoke-drift 8s ease-in-out infinite 3s' }}>💨</span>
      <span className="absolute left-[22%] bottom-4 text-2xl select-none z-10"
        style={{ animation: 'ks-warrior-lunge 2s ease-in-out infinite' }}>🧍</span>
      <span className="absolute right-[22%] bottom-4 text-2xl select-none z-10"
        style={{ animation: 'ks-warrior-lunge 2s ease-in-out infinite 1s' }}>🧍</span>
      <span className="absolute left-[46%] bottom-8 text-xl select-none z-20"
        style={{ animation: 'ks-clash-flash 2s ease-in-out infinite' }}>⚔️</span>
      {[1,2,3,4].map(i => (
        <span key={`c${i}`} className="absolute text-xs select-none"
          style={{
            left: `${43 + Math.random() * 14}%`,
            bottom: `${20 + Math.random() * 25}%`,
            animation: `ks-spark-fly 2s ${i * 0.15}s ease-out infinite`,
          }}>💥</span>
      ))}
    </div>
  );
}

// ── Scene: Knight (🛡️) — Fortified defender ──────────────────────────────

function KnightScene() {
  return (
    <div className="relative w-full h-24 overflow-hidden rounded-xl bg-linear-to-b from-cyan-900/30 to-slate-900/60">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-cyan-900/20 to-transparent" />
      <span className="absolute left-[8%] bottom-2 text-3xl select-none opacity-30">🏰</span>
      <span className="absolute right-[10%] bottom-1 text-2xl select-none opacity-20">🏰</span>
      <span className="absolute left-[38%] bottom-4 text-3xl select-none z-10"
        style={{ animation: 'ks-guard-idle 3s ease-in-out infinite' }}>🛡️</span>
      <span className="absolute left-[54%] bottom-6 text-xl select-none"
        style={{ animation: 'ks-shield-glow 2s ease-in-out infinite' }}>🛡️</span>
      {[1,2,3].map(i => (
        <span key={`g${i}`} className="absolute text-sm select-none"
          style={{
            left: `${36 + i * 8}%`,
            bottom: `${42 + i * 6}%`,
            animation: `ks-armor-shine 3s ${i * 0.5}s ease-in-out infinite`,
          }}>✨</span>
      ))}
      {[1,2,3,4].map(i => (
        <span key={`b${i}`} className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
          style={{
            left: `${28 + i * 12}%`,
            bottom: `${10 + Math.random() * 60}%`,
            animation: `ks-barrier-orbit 4s ${i * 0.5}s linear infinite`,
          }} />
      ))}
    </div>
  );
}

// ── Scene: Dragon Slayer (🐉) — Epic battle ──────────────────────────────

function DragonScene() {
  return (
    <div className="relative w-full h-24 overflow-hidden rounded-xl bg-linear-to-b from-violet-900/40 to-slate-900/60">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-violet-900/30 to-transparent" />
      <span className="absolute right-[15%] bottom-4 text-3xl select-none z-10"
        style={{ animation: 'ks-dragon-roar 3s ease-in-out infinite' }}>🐉</span>
      <span className="absolute right-[35%] bottom-8 text-lg select-none"
        style={{ animation: 'ks-fire-breath 3s ease-in-out infinite' }}>🔥</span>
      <span className="absolute right-[26%] bottom-10 text-sm select-none"
        style={{ animation: 'ks-fire-breath 3s ease-in-out infinite 0.5s' }}>🔥</span>
      <span className="absolute left-[18%] bottom-4 text-2xl select-none z-10"
        style={{ animation: 'ks-hero-charge 3s ease-in-out infinite' }}>🧝</span>
      <span className="absolute left-[30%] bottom-6 text-xl select-none"
        style={{ animation: 'ks-weapon-glow 1.5s ease-in-out infinite' }}>⚡</span>
      {[1,2,3,4,5].map(i => (
        <span key={`s${i}`} className="absolute text-base select-none"
          style={{
            left: `${33 + Math.random() * 34}%`,
            bottom: `${12 + Math.random() * 42}%`,
            animation: `ks-battle-spark 2s ${i * 0.3}s ease-out infinite`,
          }}>💥</span>
      ))}
      <span className="absolute left-[5%] top-1 text-sm select-none opacity-20"
        style={{ animation: 'ks-smoke-drift 7s ease-in-out infinite' }}>🌫️</span>
    </div>
  );
}

// ── Scene: Demon King (👑) — Victory over demon ──────────────────────────

function DemonKingScene() {
  return (
    <div className="relative w-full h-24 overflow-hidden rounded-xl bg-linear-to-b from-amber-900/50 via-rose-900/20 to-slate-900/60">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-amber-900/40 to-transparent" />
      <span className="absolute left-[28%] bottom-2 text-2xl select-none opacity-50"
        style={{ animation: 'ks-defeated-fade 4s ease-in-out infinite' }}>👹</span>
      <span className="absolute left-[27%] bottom-5 text-sm select-none opacity-40">❌</span>
      <span className="absolute left-[18%] bottom-6 text-sm select-none opacity-30"
        style={{ animation: 'ks-chain-swing 3s ease-in-out infinite' }}>⛓️</span>
      <span className="absolute left-[55%] bottom-4 text-3xl select-none z-10"
        style={{ animation: 'ks-king-triumph 3s ease-in-out infinite' }}>👑</span>
      <span className="absolute left-[65%] bottom-8 text-lg select-none"
        style={{ animation: 'ks-victory-flash 2s ease-in-out infinite' }}>✨</span>
      {[1,2,3,4,5].map(i => (
        <span key={`r${i}`} className="absolute w-0.5 h-8 bg-linear-to-t from-amber-400/0 via-amber-400/30 to-amber-400/0"
          style={{
            left: `${43 + i * 8}%`,
            bottom: '20%',
            transform: `rotate(${(i - 3) * 15}deg)`,
            transformOrigin: 'bottom center',
            animation: `ks-ray-pulse 3s ${i * 0.2}s ease-in-out infinite`,
          }} />
      ))}
      {[1,2,3,4,5,6].map(i => (
        <span key={`f${i}`} className="absolute text-xs select-none"
          style={{
            left: `${12 + i * 13}%`,
            top: `${3 + Math.random() * 20}%`,
            animation: `ks-confetti-fall 4s ${i * 0.3}s ease-in-out infinite`,
          }}>{['🎊','⭐','🌟','💫','✨','🎉'][i % 6]}</span>
      ))}
    </div>
  );
}

// ── Rank-up particle burst with "RANK UP!" text ──────────────────────────

function RankUpBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* Colored particles */}
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: ['#F59E0B','#10B981','#6366F1','#EC4899','#EF4444','#fff'][i % 6],
            left: `${38 + Math.random() * 24}%`,
            top: `${28 + Math.random() * 24}%`,
            animation: `ks-rank-up-burst 1.5s ease-out ${i * 0.05}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      {/* Rank up label */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl select-none font-bold text-amber-300"
        style={{ textShadow: '0 0 20px rgba(245,158,11,0.8)', animation: 'ks-rank-up-text 1.8s ease-out forwards' }}>
        ⬆ RANK UP!
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface KpiScoreTierAnimationProps {
  score: number;
  isNewBest?: boolean;
}

export function KpiScoreTierAnimation({ score, isNewBest = false }: KpiScoreTierAnimationProps) {
  const [animKey, setAnimKey] = useState(0);
  const prevScoreRef = useRef(score);
  const [showBurst, setShowBurst] = useState(false);

  const tier = useMemo(() => getTier(score), [score]);
  const nextTier = useMemo(() => getNextTier(score), [score]);
  const progress = useMemo(() => getTierProgress(score), [score]);

  // Detect tier-up
  useEffect(() => {
    if (score > 0) {
      const prevTier = getTier(prevScoreRef.current);
      if (prevTier.emoji !== tier.emoji) {
        setShowBurst(true);
        setAnimKey((k) => k + 1);
        const t = setTimeout(() => setShowBurst(false), 2200);
        return () => clearTimeout(t);
      }
      prevScoreRef.current = score;
    }
  }, [score, tier.emoji]);

  // Pick scene by tier
  const Scene = useMemo(() => {
    switch (tier.emoji) {
      case '🗡️': return RecruitScene;
      case '⚔️': return WarriorScene;
      case '🛡️': return KnightScene;
      case '🐉': return DragonScene;
      case '👑': return DemonKingScene;
      default:   return RecruitScene;
    }
  }, [tier.emoji]);

  return (
    <div className="relative" key={animKey}>
      {/* Animated scene stage */}
      <div className={`relative rounded-xl overflow-hidden border border-(--color-border)/30`}>
        <Scene />
        <RankUpBurst active={showBurst} />
      </div>

      {/* Info bar */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">{tier.title}</span>
            {isNewBest && (
              <span className="text-amber-400 text-xs font-medium animate-pulse">✦ NEW BEST</span>
            )}
          </div>
          <p className="text-slate-500 text-xs">{tier.subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-bold text-lg font-mono tabular-nums">{formatCompact(score)}</p>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${tier.glowColor}, ${nextTier.glowColor.replace('0.3','0.6').replace('0.5','0.7')})`,
                boxShadow: `0 0 6px ${tier.glowColor}`,
              }} />
          </div>
          <span className="text-slate-600 text-[10px] whitespace-nowrap">
            {nextTier.emoji} {formatCompact(nextTier.minScore - score)} to go
          </span>
        </div>
      )}

      {/* Max rank */}
      {!nextTier && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-amber-900/40 overflow-hidden">
            <div className="h-full rounded-full bg-linear-to-r from-amber-500 to-yellow-300"
              style={{ width: '100%', boxShadow: '0 0 8px rgba(245,158,11,0.5)', animation: 'ks-max-pulse 1.5s ease-in-out infinite' }} />
          </div>
          <span className="text-amber-500 text-[10px] font-medium whitespace-nowrap">MAX RANK</span>
        </div>
      )}

      {/* ── All keyframes ── */}
      <style>{`
        /* Shared */
        @keyframes ks-dust-drift {
          0%,100% { transform:translateX(0) translateY(0); opacity:0.3; }
          50%     { transform:translateX(20px) translateY(-10px); opacity:0; }
        }
        @keyframes ks-smoke-drift {
          0%,100% { transform:translateX(0) scale(1); opacity:0.2; }
          50%     { transform:translateX(-15px) scale(1.4); opacity:0.05; }
        }

        /* Recruit */
        @keyframes ks-dummy-wobble {
          0%,100% { transform:rotate(0deg) translateY(0); }
          25%     { transform:rotate(5deg) translateY(-2px); }
          75%     { transform:rotate(-3deg) translateY(1px); }
        }
        @keyframes ks-soldier-swing {
          0%,100% { transform:translateX(0) rotate(0deg); }
          25%     { transform:translateX(14px) rotate(8deg); }
          50%     { transform:translateX(0) rotate(0deg); }
        }
        @keyframes ks-slash-arc {
          0%,100% { transform:translateX(0) translateY(0) rotate(0deg); opacity:0; }
          20%     { opacity:1; }
          25%     { transform:translateX(-12px) translateY(-6px) rotate(-45deg); opacity:1; }
          40%     { opacity:1; }
          50%     { transform:translateX(0) translateY(0) rotate(0deg); opacity:0; }
        }
        @keyframes ks-sparkle-pop {
          0%,100% { transform:scale(0); opacity:0; }
          30%     { transform:scale(1.5); opacity:1; }
          60%     { transform:scale(1); opacity:0.5; }
        }

        /* Warrior */
        @keyframes ks-warrior-lunge {
          0%,100% { transform:translateX(0) scale(1); }
          25%     { transform:translateX(12px) scale(1.1); }
          50%     { transform:translateX(0) scale(1); }
        }
        @keyframes ks-clash-flash {
          0%,100% { transform:scale(1); opacity:0; }
          20%     { transform:scale(2); opacity:1; }
          30%     { transform:scale(1.5); opacity:1; }
          50%     { transform:scale(1); opacity:0; }
        }
        @keyframes ks-spark-fly {
          0%   { transform:translate(0,0) scale(0); opacity:0; }
          20%  { transform:translate(-8px,5px) scale(1.2); opacity:1; }
          60%  { transform:translate(-20px,-15px) scale(0.8); opacity:0.5; }
          100% { transform:translate(-30px,-25px) scale(0); opacity:0; }
        }

        /* Knight */
        @keyframes ks-guard-idle {
          0%,100% { transform:translateY(0) rotate(0deg); }
          50%     { transform:translateY(-3px) rotate(2deg); }
        }
        @keyframes ks-shield-glow {
          0%,100% { transform:scale(1); opacity:0.6; }
          50%     { transform:scale(1.3); opacity:1; }
        }
        @keyframes ks-armor-shine {
          0%,100% { transform:scale(0); opacity:0; }
          30%     { transform:scale(1.5); opacity:1; }
          60%     { transform:scale(0.8); opacity:0; }
        }
        @keyframes ks-barrier-orbit {
          0%   { transform:translateX(0) translateY(0) scale(1); opacity:0.3; }
          25%  { transform:translateX(8px) translateY(-8px) scale(1.3); opacity:0.7; }
          50%  { transform:translateX(0) translateY(-14px) scale(0.8); opacity:0.3; }
          75%  { transform:translateX(-8px) translateY(-8px) scale(1.3); opacity:0.7; }
          100% { transform:translateX(0) translateY(0) scale(1); opacity:0.3; }
        }

        /* Dragon */
        @keyframes ks-dragon-roar {
          0%,100% { transform:translateX(0) scale(1); }
          25%     { transform:translateX(-5px) scale(1.12) rotate(-3deg); }
          50%     { transform:translateX(0) scale(1.05) rotate(0deg); }
          75%     { transform:translateX(-3px) scale(1.08) rotate(2deg); }
        }
        @keyframes ks-fire-breath {
          0%,100% { transform:translateX(0) scale(1); opacity:0; }
          20%     { transform:translateX(-12px) scale(1.5); opacity:1; }
          40%     { transform:translateX(-25px) scale(1.2); opacity:0.7; }
          60%     { transform:translateX(-35px) scale(0.7); opacity:0.2; }
          80%     { opacity:0; }
        }
        @keyframes ks-hero-charge {
          0%,100% { transform:translateX(0) scale(1); }
          25%     { transform:translateX(16px) scale(1.1); }
          50%     { transform:translateX(0) scale(0.95); }
        }
        @keyframes ks-weapon-glow {
          0%,100% { transform:scale(0.8); opacity:0.4; }
          50%     { transform:scale(1.4); opacity:1; }
        }
        @keyframes ks-battle-spark {
          0%   { transform:translate(0,0) scale(0); opacity:1; }
          40%  { transform:translate(15px,-20px) scale(1.3); opacity:1; }
          100% { transform:translate(30px,-40px) scale(0); opacity:0; }
        }

        /* Demon King */
        @keyframes ks-defeated-fade {
          0%,100% { opacity:0.4; transform:scale(1); }
          50%     { opacity:0.2; transform:scale(0.95); }
        }
        @keyframes ks-chain-swing {
          0%,100% { transform:rotate(-5deg); }
          50%     { transform:rotate(5deg); }
        }
        @keyframes ks-king-triumph {
          0%,100% { transform:translateY(0) scale(1); }
          25%     { transform:translateY(-6px) scale(1.06); }
          50%     { transform:translateY(0) scale(1); }
          75%     { transform:translateY(-3px) scale(1.03); }
        }
        @keyframes ks-victory-flash {
          0%,100% { transform:scale(0.8); opacity:0.2; }
          50%     { transform:scale(1.6); opacity:1; }
        }
        @keyframes ks-ray-pulse {
          0%,100% { opacity:0.1; }
          50%     { opacity:0.5; }
        }
        @keyframes ks-confetti-fall {
          0%   { transform:translateY(-10px) rotate(0deg); opacity:0; }
          20%  { opacity:1; }
          80%  { opacity:0.7; }
          100% { transform:translateY(80px) rotate(360deg); opacity:0; }
        }

        /* Rank up */
        @keyframes ks-rank-up-burst {
          0%   { opacity:0; transform:translate(0,0) scale(0); }
          15%  { opacity:1; transform:translate(20px,-30px) scale(1.5); }
          100% { opacity:0; transform:translate(50px,-80px) scale(0); }
        }
        @keyframes ks-rank-up-text {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.3); }
          15%  { opacity:1; transform:translate(-50%,-50%) scale(1.3); }
          35%  { transform:translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform:translate(-50%,-65%) scale(0.8); }
        }
        @keyframes ks-max-pulse {
          0%,100% { opacity:0.6; }
          50%     { opacity:1; }
        }
      `}</style>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
