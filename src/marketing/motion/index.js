// Marketing motion primitives. See docs/MARKETING-MOTION.md for the full
// API, the four CSS tokens, and one usage example per export.
export { Reveal, Stagger } from './Reveal';
export { Parallax } from './Parallax';
export { Counter } from './Counter';
export { SectionNumber } from './SectionNumber';
export { Marquee } from './Marquee';
// Site Prompt 6's scroll-driven set. Everything below needs the scroll
// engine (src/marketing/scroll.js, gsap + ScrollTrigger + Lenis, dynamically
// imported on the marketing host only) and degrades to a plain resting state
// without it. Pin, Curtain, WordReveal and TrackScroll are the heavy set,
// Home only; ScaleIn and Tone are safe on any page. See
// docs/MARKETING-MOTION.md.
export { Pin } from './Pin';
export { Curtain } from './Curtain';
export { ScaleIn } from './ScaleIn';
export { WordReveal } from './WordReveal';
export { TrackScroll } from './TrackScroll';
export { Tone } from './Tone';
export { useScrollProgress, useScrollEngine, useScrollRefresh } from './useScroll';
export { useMotionPreference, useCoarsePointer, useMediaQuery, useRevealOnce, prefersReducedMotion, isCoarsePointer, cssMs, cx } from './shared';
