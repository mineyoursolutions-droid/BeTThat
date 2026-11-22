// MobileBackBar — one consistent back control for every child screen.
//
// Google Play's "Unified Navigation & Back Stack" warning comes from child
// screens that each handle back differently (some have a small text link,
// most have nothing, and the system back gesture is the only way out).
// This bar is shown at the top of every child screen on mobile only:
// a 44px back button that goes back in history when the user arrived from
// inside the app, and to the logical parent screen when they deep-linked
// straight here (no in-app history to go back to). Desktop keeps its
// existing inline back links, so desktop layouts are unchanged.
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function MobileBackBar({ to, label, className = '-mt-10 sm:-mt-14' }) {
  const navigate = useNavigate();

  const goBack = () => {
    // react-router tracks the history index on window.history.state; an
    // index above 0 means there is in-app history to go back to.
    const idx = window.history.state && typeof window.history.state.idx === 'number'
      ? window.history.state.idx
      : 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      navigate(to, { replace: true });
    }
  };

  return (
    // -mx/-mt bleed the bar to the full width and top edge of the page's
    // padded container; the page passes the matching offsets.
    <div className={`safe-top sticky top-0 z-30 -mx-5 border-b border-border/60 bg-background/95 backdrop-blur-xl sm:-mx-8 md:hidden ${className}`}>
      <div className="flex min-h-11 items-center px-2 py-1">
        <button
          type="button"
          onClick={goBack}
          aria-label={`Back to ${label}`}
          className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
          {label}
        </button>
      </div>
    </div>
  );
}
