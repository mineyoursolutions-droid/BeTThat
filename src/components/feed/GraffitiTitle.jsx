const DRIPS = {
  1: [
    { left: '32%', h: 16, delay: 0, dur: 3400 },
    { left: '64%', h: 9, delay: 1700, dur: 3000 },
  ],
  2: [{ left: '56%', h: 23, delay: 900, dur: 3800 }],
  4: [
    { left: '28%', h: 14, delay: 420, dur: 3200 },
    { left: '70%', h: 20, delay: 2250, dur: 3600 },
  ],
  6: [{ left: '52%', h: 12, delay: 1250, dur: 3000 }],
  7: [{ left: '38%', h: 25, delay: 300, dur: 4000 }],
};

export default function GraffitiTitle({ text = 'THE WIRE', className = '' }) {
  const letters = Array.from(text);

  return (
    <h2
      aria-label={text}
      className={`graffiti-word inline-block font-display text-[26px] font-black uppercase leading-none tracking-[-0.01em] sm:text-[30px] ${className}`}
      style={{ transform: 'skewX(-7deg)' }}
    >
      <span aria-hidden="true" className="inline-flex items-end">
        {letters.map((char, i) => (
          <span key={i} className="relative inline-block" style={{ transitionDelay: `${i * 35}ms` }}>
            <span
              className={`graffiti-face ${i % 3 === 0 ? 'text-win' : 'text-primary'}`}
              style={{ transitionDelay: `${i * 35}ms` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
            {(DRIPS[i] || []).map((d, k) => (
              <span
                key={k}
                className="drip"
                style={{
                  left: d.left,
                  height: `${d.h}px`,
                  animationDelay: `${d.delay}ms`,
                  animationDuration: `${d.dur}ms`,
                }}
              />
            ))}
          </span>
        ))}
      </span>
    </h2>
  );
}