'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
  shape: 'circle' | 'square' | 'triangle';
}

const COLORS = [
  '#818cf8', // indigo
  '#4ade80', // green
  '#fbbf24', // amber
  '#f472b6', // pink
  '#38bdf8', // sky
  '#fb923c', // orange
];

const SHAPES = ['circle', 'square', 'triangle'] as const;

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
  particleCount?: number;
  duration?: number;
}

export function Confetti({
  trigger,
  onComplete,
  particleCount = 25, // Reduced from 50 for better performance
  duration = 2000,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      
      const newPieces: ConfettiPiece[] = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        rotation: Math.random() * 360,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        scale: 0.5 + Math.random() * 0.5,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      }));
      
      setPieces(newPieces);

      const timer = setTimeout(() => {
        setPieces([]);
        setIsActive(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, isActive, particleCount, duration, onComplete]);

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute"
              initial={{
                x: `${piece.x}vw`,
                y: '-10vh',
                rotate: 0,
                scale: piece.scale,
              }}
              animate={{
                y: '110vh',
                rotate: piece.rotation + 720,
                x: `${piece.x + (Math.random() - 0.5) * 20}vw`,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2 + Math.random(),
                ease: 'linear',
              }}
            >
              {piece.shape === 'circle' && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: piece.color }}
                />
              )}
              {piece.shape === 'square' && (
                <div
                  className="w-3 h-3"
                  style={{ backgroundColor: piece.color }}
                />
              )}
              {piece.shape === 'triangle' && (
                <div
                  className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent"
                  style={{ borderBottomColor: piece.color }}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
