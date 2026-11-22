import { useEffect, useState } from 'react';

// Animated counter for stats and pot amounts: counts up from 0 to the
// value with a cubic ease-out, then settles. Under
// prefers-reduced-motion it renders the final value immediately with
// no animation. Display only — no logic changes.
export default function CountUp({ value, prefix = '', suffix = '', duration = 900 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
