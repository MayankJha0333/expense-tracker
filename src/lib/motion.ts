/*
 * Motion tokens. Pure numbers, so every animation in the app moves at the same pace.
 * Rule: motion explains a change (something arrived, filled up, moved). Nothing loops,
 * nothing bounces for decoration, and "Reduce motion" on the phone turns it all off.
 */
export const MOTION = {
  /** Press feedback. */
  press: 90,
  /** Small state changes: chip colours, tab pill, crossfades. */
  fast: 180,
  /** Things arriving on screen. */
  base: 320,
  /** Bars, rings and numbers filling up. */
  fill: 650,
  /** Gap between cards that arrive one after another. */
  stagger: 55,
  /** Never stagger past this many items, so long pages don't wait. */
  maxStagger: 8,
  /** How far things travel when they arrive (px). */
  rise: 14,
  /** Press-in scale for tappable cards and buttons. */
  pressScale: 0.97,
} as const;

/** Spring used for anything that settles into place (press release, sliding pills). */
export const SPRING = { damping: 18, stiffness: 240, mass: 0.7 } as const;

/** Delay for the n-th item in a list that arrives one by one. */
export const staggerDelay = (index: number) => Math.min(index, MOTION.maxStagger) * MOTION.stagger;

/** Ease-out cubic: quick start, soft landing. Used for counting numbers. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
