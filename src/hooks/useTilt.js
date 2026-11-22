import { useCallback, useRef } from 'react';

// 3D pointer tilt for cards: sets --rx / --ry on the element, which the
// .tilt class in index.css turns into a perspective rotation.
// - Desktop hover only: touch pointers never get tilt values, so mobile
//   cards stay flat and tappable (Google Play touch rules untouched).
// - Honors prefers-reduced-motion: no tilt at all when the user asks
//   for reduced motion.
// - Pure CSS transform, no library, no layout work.
export function useTilt(max = 6) {
  const ref = useRef(null);

  const onPointerMove = useCallback(
    (event) => {
      const el = ref.current;
      if (!el) return;
      if (event.pointerType === 'touch') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    },
    [max],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
