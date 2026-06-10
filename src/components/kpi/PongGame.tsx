import { useState, useRef, useEffect, useCallback } from 'react';
import { recordScore, getBestScore } from '../../hooks/useScoreboard';

const GAME_KEY = 'pong';
const CANVAS_W = 400;
const CANVAS_H = 250;
const PADDLE_W = 10;
const PADDLE_H = 50;
const BALL_SIZE = 6;
const BALL_SPEED_INIT = 3;
const SPEED_INCREASE = 0.3;
const WIN_SCORE = 5;

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getBestScore(GAME_KEY));
  const [display, setDisplay] = useState(0);

  // Mutable refs for game loop
  const ballRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2, vx: BALL_SPEED_INIT, vy: BALL_SPEED_INIT });
  const paddleRef = useRef(CANVAS_H / 2 - PADDLE_H / 2);
  const aiPaddleRef = useRef(CANVAS_H / 2 - PADDLE_H / 2);
  const scoreRef = useRef(0);
  const rafRef = useRef(0);
  const mouseYRef = useRef(CANVAS_H / 2);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const ball = ballRef.current;
    const paddle = paddleRef.current;
    let aiPaddle = aiPaddleRef.current;

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Ball vs walls (top/bottom)
    if (ball.y - BALL_SIZE <= 0 || ball.y + BALL_SIZE >= CANVAS_H) {
      ball.vy = -ball.vy;
    }

    // Ball vs player paddle
    if (
      ball.x - BALL_SIZE <= PADDLE_W &&
      ball.y >= paddle &&
      ball.y <= paddle + PADDLE_H
    ) {
      ball.vx = Math.abs(ball.vx) + SPEED_INCREASE;
      ball.x = PADDLE_W + BALL_SIZE;
      // Add angle based on where ball hit paddle
      const hitPos = (ball.y - paddle) / PADDLE_H - 0.5;
      ball.vy += hitPos * 0.5;
    }

    // Ball vs AI paddle
    if (
      ball.x + BALL_SIZE >= CANVAS_W - PADDLE_W &&
      ball.y >= aiPaddle &&
      ball.y <= aiPaddle + PADDLE_H
    ) {
      ball.vx = -Math.abs(ball.vx) - SPEED_INCREASE;
      ball.x = CANVAS_W - PADDLE_W - BALL_SIZE;
    }

    // Scoring
    if (ball.x < 0) {
      // Player missed
      const final = scoreRef.current;
      const { best } = recordScore(GAME_KEY, final);
      setHighScore(best);
      setDisplay(final);
      setPhase('over');
      return;
    }
    if (ball.x > CANVAS_W) {
      // AI missed → player scores
      scoreRef.current += 1;
      setScore(scoreRef.current);
      if (scoreRef.current >= WIN_SCORE) {
        const final = scoreRef.current;
        const { best } = recordScore(GAME_KEY, final);
        setHighScore(best);
        setDisplay(final);
        setPhase('over');
        return;
      }
      // Reset ball
      ball.x = CANVAS_W / 2;
      ball.y = CANVAS_H / 2;
      ball.vx = BALL_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1);
      ball.vy = BALL_SPEED_INIT;
    }

    // AI follows ball with slight delay
    const aiTarget = ball.y - PADDLE_H / 2;
    aiPaddle += (aiTarget - aiPaddle) * 0.06;
    aiPaddle = Math.max(0, Math.min(CANVAS_H - PADDLE_H, aiPaddle));
    aiPaddleRef.current = aiPaddle;

    // Player paddle follows mouse
    paddleRef.current = Math.max(0, Math.min(CANVAS_H - PADDLE_H, mouseYRef.current - PADDLE_H / 2));

    // Draw
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Dashed center line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ball
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Player paddle
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(0, paddleRef.current, PADDLE_W, PADDLE_H);

    // AI paddle
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(CANVAS_W - PADDLE_W, aiPaddle, PADDLE_W, PADDLE_H);

    // Score display
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${scoreRef.current}`, CANVAS_W / 2 - 20, 20);
    ctx.fillStyle = '#64748b';
    ctx.fillText('-', CANVAS_W / 2, 18);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    ballRef.current = { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: BALL_SPEED_INIT, vy: BALL_SPEED_INIT };
    paddleRef.current = CANVAS_H / 2 - PADDLE_H / 2;
    aiPaddleRef.current = CANVAS_H / 2 - PADDLE_H / 2;
    setPhase('playing');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseYRef.current = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    };
    canvas.addEventListener('mousemove', handleMouse);
    return () => canvas.removeEventListener('mousemove', handleMouse);
  }, []);

  useEffect(() => {
    if (phase === 'playing') {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, draw]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-4 text-sm w-full justify-between">
        <span className="text-slate-400">Score: <strong className="text-white">{score}</strong></span>
        <span className="text-slate-400">Best: <strong className="text-amber-400">{highScore}</strong></span>
        <span className="text-slate-400">Win at: <strong className="text-white">{WIN_SCORE}</strong></span>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-xl border border-slate-600 w-full max-w-[400px] cursor-none select-none"
      />

      {phase === 'idle' && (
        <button onClick={startGame}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95">
          🏓 Start Pong
        </button>
      )}

      {phase === 'over' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-white font-bold text-lg">{display >= WIN_SCORE ? '🎉 You Win!' : '💀 Game Over'}</p>
          <p className="text-slate-400 text-sm">Score: {display}</p>
          {display >= highScore && display > 0 && <p className="text-amber-400 text-xs animate-pulse">🏆 New Best!</p>}
          <button onClick={startGame}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">🔄 Play Again</button>
        </div>
      )}
    </div>
  );
}
