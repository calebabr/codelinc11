// Product screenshots for the landing page. All are 1600×1200 (4:3) PNGs in public/screens/.
export const SCREEN_W = 1600
export const SCREEN_H = 1200

export const screens = {
  coverage: { src: '/screens/coverage.png', srcSet: '/screens/coverage-800.webp 800w, /screens/coverage.png 1600w', alt: 'The Molar Money Plans page: the three plans side by side and what yours covers, in plain English' },
  estimate: { src: '/screens/estimate.png', srcSet: '/screens/estimate-800.webp 800w, /screens/estimate.png 1600w', alt: 'The Molar Money Reports page: what you owe right now, and each bill explained' },
  plan: { src: '/screens/plan.png', srcSet: '/screens/plan-800.webp 800w, /screens/plan.png 1600w', alt: 'The Molar Money Plan My Year page: the cheapest order for your treatments and how much you save' },
} as const

// Product fan geometry. The hero's zoom ends exactly where the fan starts, so both read these.
export const FAN_CARD_WIDTH = 'min(1000px, 88vw, 120vh)' // card width before scaling
export const FAN_START_SCALE = 1.15
export const FAN_LIFT = 0.06 // cards sit 6vh above the middle so the caption fits below

// The fan's first frame in px: where the Coverage card's center is and how wide it looks.
// vw/vh are the window size (what CSS vw/vh use); stageWidth is the pinned stage's width (no scrollbar).
export function fanStartPose(vw: number, vh: number, stageWidth: number) {
  const width = Math.min(1000, vw * 0.88, vh * 1.2) * FAN_START_SCALE
  return { width, cx: stageWidth / 2, cy: vh / 2 - vh * FAN_LIFT }
}

// Phones get the 800px WebP (about 20 KB) instead of the 1600px PNG (about 300 KB).
export const SCREEN_SIZES = '(min-width: 1024px) 1000px, 88vw'
