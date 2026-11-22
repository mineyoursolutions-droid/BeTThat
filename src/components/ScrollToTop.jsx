import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { rememberRoute } from '@/lib/tabStacks';

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

// Per-tab stack preservation: remember each route's scroll position and
// restore it on back/forward (POP) navigation, so switching tabs does not
// lose your place. New (PUSH) navigations still start at the top — unless
// the destination is a tab screen the user has already visited, in which
// case their saved scroll position is restored (native tab behaviour:
// returning to a tab picks up where you left it).
const SCROLL_KEY = 'betthat-scroll-positions';

function readPositions() {
  try {
    return JSON.parse(window.sessionStorage.getItem(SCROLL_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePosition(pathname) {
  try {
    const positions = readPositions();
    positions[pathname] = window.scrollY;
    window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(positions));
  } catch {
    // storage unavailable — scroll restore is best-effort
  }
}

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // Directional page transitions (see index.css): forward navigations
    // slide in from the right, back navigations from the left.
    document.documentElement.dataset.navDirection = navigationType === 'POP' ? 'back' : 'forward';

    // Remember this route in its tab's stack (bottom-tab preservation).
    rememberRoute(pathname);

    const saved = readPositions()[pathname];
    const cameFromAnotherScreen = prevPathname.current !== pathname;
    prevPathname.current = pathname;

    if (navigationType === 'POP') {
      if (hash) {
        const id = getHashId(hash);
        const timer = window.setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        return () => window.clearTimeout(timer);
      }
      if (typeof saved === 'number') {
        window.scrollTo({ top: saved, left: 0, behavior: 'instant' });
        return undefined;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return undefined;
    }

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    // PUSH navigation: restore the saved scroll position when returning to
    // a screen the user has already visited (tab switches, back-to-parent);
    // brand-new destinations start at the top.
    if (cameFromAnotherScreen && typeof saved === 'number' && saved > 0) {
      window.scrollTo({ top: saved, left: 0, behavior: 'instant' });
      return undefined;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return undefined;
  }, [pathname, hash, navigationType]);

  // Record the scroll position of the route we are leaving.
  useEffect(() => {
    const onScroll = () => savePosition(pathname);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      savePosition(pathname);
    };
  }, [pathname]);

  return null;
}
