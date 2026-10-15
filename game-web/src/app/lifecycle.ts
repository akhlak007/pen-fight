import type { AppStore } from './app-store';

interface LifecycleTarget {
  hidden: boolean;
  addEventListener(type: 'visibilitychange' | 'pagehide', listener: EventListener): void;
  removeEventListener(type: 'visibilitychange' | 'pagehide', listener: EventListener): void;
}

export function attachLifecycle(
  store: AppStore,
  target: LifecycleTarget = document,
): () => void {
  const onVisibilityChange: EventListener = () => {
    if (target.hidden) {
      store.pauseForVisibility();
    } else {
      store.resumeFromVisibility();
    }
  };
  const onPageHide: EventListener = () => store.pauseForVisibility();

  target.addEventListener('visibilitychange', onVisibilityChange);
  target.addEventListener('pagehide', onPageHide);

  return () => {
    target.removeEventListener('visibilitychange', onVisibilityChange);
    target.removeEventListener('pagehide', onPageHide);
  };
}
