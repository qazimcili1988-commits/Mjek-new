import React, { useEffect, useRef } from 'react';

export interface ConfettiProps {
  active: boolean;
  onDone?: () => void;
}

export const Confetti: React.FC<ConfettiProps> = ({ active, onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#43AA8B', '#0096C7', '#F4A261', '#FE4A49', '#EE9B00', '#3B82F6', '#10B981'];
    const pieces: Array<{
      x: number;
      y: number;
      r: number;
      d: number;
      color: string;
      tilt: number;
      tiltAngle: number;
      tiltSpeed: number;
    }> = [];

    for (let i = 0; i < 140; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 2.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngle: 0,
        tiltSpeed: Math.random() * 0.08 + 0.04,
      });
    }

    let frame = 0;
    const maxFrames = 180;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.tiltAngle += p.tiltSpeed;
        p.y += p.d + Math.sin(frame * 0.02) * 1.5;
        p.x += Math.sin(p.tiltAngle) * 0.8;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        if (p.y > canvas.height) p.y = -10;

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - (frame / maxFrames) * 0.7);
        ctx.ellipse(p.x, p.y, p.r, p.r / 2, (p.tilt * Math.PI) / 180, 0, Math.PI * 2);
        ctx.fill();
      });

      frame++;
      if (frame < maxFrames) {
        animId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone?.();
      }
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, onDone]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9990] w-full h-full"
      aria-hidden="true"
    />
  );
};
