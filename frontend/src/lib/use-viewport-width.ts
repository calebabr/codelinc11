import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

// Current window width in px; re-renders on resize. 1280 before the browser takes over.
export function useViewportWidth() {
  return useSyncExternalStore(subscribe, () => window.innerWidth, () => 1280)
}

// md breakpoint (Tailwind): 768px and up
export function useIsDesktop() {
  return useViewportWidth() >= 768
}
