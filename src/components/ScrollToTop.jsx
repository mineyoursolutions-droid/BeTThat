import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

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
// lose your place. New (PUSH) navigations still start at the top.
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

  useEffect(() => {
    if (navigationType === 'POP') {
      const saved = readPositions()[pathname];
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
