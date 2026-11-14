import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useFeedback } from '../ui/feedback';

/**
 * Asks "Leave without saving?" when navigating away (links, back swipe) or
 * closing the tab while `dirty` is true. Call `allowLeave()` right before
 * navigating after a successful save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const feedback = useFeedback();
  const skip = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skip.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    feedback
      .confirm({
        title: 'Leave without saving?',
        message: 'Your changes on this page will be lost.',
        confirmLabel: 'Leave',
        danger: true,
      })
      .then((ok) => {
        if (cancelled) return;
        if (ok) blocker.proceed();
        else blocker.reset();
      });
    return () => {
      cancelled = true;
    };
    // `feedback` is recreated each render; only react to the blocker changing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    allowLeave: useCallback(() => {
      skip.current = true;
    }, []),
  };
}
