/* Carousel posts (carousel job): the pure half of the editor's slide strip and the client's carousel, so a test can hold it.
 *   moveSlide(slides, from, to)   a new array with one slide moved, the rest in order
 *   removeSlide(slides, i)        a new array without slide i
 *   addSlides(slides, urls, max)  { slides, added, skipped }: urls added to the end until the limit
 *   ratioLabel(w, h)              "1:1", "4:5", "16:9"..., else "1.33:1"
 *   ratioWarning(sizes)           the first slide whose shape differs from slide 1, as { n, label }, else null
 *   counterLine(n, max)           "1 slide", "7 slides. Slide 1 is the cover.", "20 of 20, Instagram's limit."
 *   viewing(scrollLeft, width, n) the 0 based slide a scroller is on
 *   carouselNote(item, slide, extra) a change note on a carousel prefixed with the slide on view ("Slide 4: ..."), same write */
import { COPY } from '../shared/copy.js';
import { SLIDES_MAX, slidesOf, carouselAllowed } from '../shared/slides.js';

const C = () => COPY.carousel;
export function moveSlide(slides, from, to) {
  const list = Array.isArray(slides) ? slides.slice() : [];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const [one] = list.splice(from, 1);
  list.splice(to, 0, one);
  return list;
}
export const removeSlide = (slides, i) => (Array.isArray(slides) ? slides.filter((_, k) => k !== i) : []);
export function addSlides(slides, urls, max = SLIDES_MAX) {
  const list = Array.isArray(slides) ? slides.slice() : [];
  const room = Math.max(0, max - list.length);
  const clean = (Array.isArray(urls) ? urls : []).map(u => String(u || '').trim()).filter(Boolean);
  const take = clean.slice(0, room);
  return { slides: [...list, ...take.map(url => ({ url, alt: '' }))], added: take.length, skipped: clean.length - take.length };
}
const NAMED = [[1, 1], [4, 5], [5, 4], [3, 4], [4, 3], [2, 3], [3, 2], [16, 9], [9, 16], [1.91, 1]];
export function ratioLabel(w, h) {
  const W = Number(w); const H = Number(h);
  if (!(W > 0 && H > 0)) return '';
  const r = W / H;
  const hit = NAMED.find(([a, b]) => Math.abs(r - a / b) / (a / b) < 0.02);
  return hit ? `${hit[0]}:${hit[1]}` : `${Math.round(r * 100) / 100}:1`;
}
/** sizes: [{ w, h }] in slide order (missing entries not measured yet). */
export function ratioWarning(sizes) {
  const list = Array.isArray(sizes) ? sizes : [];
  const first = list[0];
  if (!first || !(first.w > 0 && first.h > 0)) return null;
  const r0 = first.w / first.h;
  for (let i = 1; i < list.length; i++) {
    const s = list[i];
    if (!s || !(s.w > 0 && s.h > 0)) continue;
    if (Math.abs(s.w / s.h - r0) / r0 >= 0.02) return { n: i + 1, label: ratioLabel(s.w, s.h) };
  }
  return null;
}
export function counterLine(n, max = SLIDES_MAX) {
  if (n >= max) return C().limit(max);
  return n === 1 ? C().one : C().many(n);
}
export const viewing = (scrollLeft, width, n) => (width > 0 && n > 0 ? Math.max(0, Math.min(n - 1, Math.round(Number(scrollLeft) / width))) : 0);
/** The request-change body for a post: a carousel's note names the picture the client was on, cut to the server's 500. */
export function carouselNote(item, slide, extra) {
  const n = slidesOf(item).length;
  if (!extra || !carouselAllowed(item) || n < 2 || item?.video?.url) return extra;
  const i = Math.max(0, Math.min(n - 1, Number(slide) || 0));
  return { ...extra, note: (C().changePrefix(i + 1) + String(extra.note || '')).slice(0, 500) };
}
