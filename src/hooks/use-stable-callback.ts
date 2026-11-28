import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Stable identity that always calls the latest closure.
// shortcut: for event handlers only; do not call the result during render.
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
