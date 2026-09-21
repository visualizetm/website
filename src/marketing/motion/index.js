// Marketing motion primitives. See docs/MARKETING-MOTION.md for the full
// API, the four CSS tokens, and one usage example per export.
export { Reveal, Stagger } from './Reveal';
export { Parallax } from './Parallax';
export { Counter } from './Counter';
export { SectionNumber } from './SectionNumber';
export { Marquee } from './Marquee';
// The scroll-driven set (Site Prompt 6, cut down in Site Prompt 11: Pin,
// Curtain and TrackScroll are gone, Scene below is what Home is built on).
// ScaleIn, WordReveal and Tone need the engine only for their motion and
// rest at their final state without it; the client pages use them.
export { ScaleIn } from './ScaleIn';
export { WordReveal } from './WordReveal';
export { Tone } from './Tone';
export { useScrollProgress, useScrollEngine, useScrollRefresh } from './useScroll';
export { useMotionPreference, useCoarsePointer, useMediaQuery, useRevealOnce, prefersReducedMotion, isCoarsePointer, cssMs, cx } from './shared';
// Site Prompt 11: the one primitive Home is built on. See docs/SCENE-ENGINE.md.
export { Scene, REVEAL_SPAN } from './Scene';
