import { useEffect, useRef } from 'react';
import { ClassId, xpRequired } from '@idle/shared';
import type { TickerState } from '@/lib/useCharacterTicker';

const CLASS_COLORS: Record<number, string> = {
  [ClassId.Warrior]: '#8fb4d9',
  [ClassId.Mage]: '#c084fc',
  [ClassId.Rogue]: '#4ade80',
};

/** Sprite geométrico simples (sem assets de imagem) — cor + ícone por classe. */
function drawSprite(ctx: CanvasRenderingContext2D, classId: number, t: number) {
  const bob = Math.sin(t / 400) * 4;
  const cx = 55;
  const cy = 75 + bob;

  ctx.fillStyle = CLASS_COLORS[classId] ?? '#9ca3af';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (classId === ClassId.Warrior) {
    // espada na diagonal
    ctx.moveTo(cx - 14, cy + 14);
    ctx.lineTo(cx + 14, cy - 14);
  } else if (classId === ClassId.Mage) {
    // cruz (cajado)
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
  } else {
    // adaga vertical
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
  }
  ctx.stroke();
}

/**
 * Canvas 2D puro — sem lógica de jogo, só desenha o último tick recebido via
 * WebSocket (§5 do spec: "PiP é puramente uma view"). Roda em
 * requestAnimationFrame pra manter a animação de "bob" suave entre ticks.
 */
export function PipCanvas({ state, classId }: { state: TickerState; classId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame: number;
    function render(t: number) {
      ctx!.fillStyle = '#0a0a0f';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      drawSprite(ctx!, classId, t);

      const s = stateRef.current;
      if (s) {
        const pct = Math.min(1, s.xp / xpRequired(s.level));
        ctx!.fillStyle = '#27272a';
        ctx!.fillRect(10, 130, 280, 10);
        ctx!.fillStyle = '#22c55e';
        ctx!.fillRect(10, 130, 280 * pct, 10);

        ctx!.fillStyle = '#f4f4f5';
        ctx!.font = '12px ui-sans-serif, system-ui';
        ctx!.fillText(`Lv ${s.level} · Power ${s.combatPower}`, 90, 66);
        ctx!.fillText(`Gold ${s.gold.toLocaleString()}`, 90, 82);
        ctx!.fillText(`+${s.pending.pendingXp} XP pendente`, 90, 98);
      } else {
        ctx!.fillStyle = '#9ca3af';
        ctx!.font = '12px ui-sans-serif, system-ui';
        ctx!.fillText('Conectando…', 90, 75);
      }

      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [classId]);

  return <canvas ref={canvasRef} width={300} height={150} style={{ borderRadius: 8, display: 'block' }} />;
}
