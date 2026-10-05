import confetti from 'canvas-confetti';

export const triggerSmallConfetti = () => {
  confetti({
    particleCount: 45,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#a855f7', '#38bdf8', '#34d399', '#fbbf24'],
    ticks: 180,
  });
};

export const triggerCelebrationConfetti = () => {
  const end = Date.now() + 2 * 1000;
  const colors = ['#c084fc', '#38bdf8', '#4ade80', '#fbbf24', '#f43f5e'];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

export const triggerLevelUpConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
    scalar: 1.2,
  });
};