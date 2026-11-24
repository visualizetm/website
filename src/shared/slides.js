/* Carousel posts (carousel job): a post of kind post and format portrait can hold an ordered set of pictures, `slides`
 * [{ url, alt }], 1 to 20 (Instagram's carousel limit). Mirrored byte for byte in api/_lib/slides.js (carousel-test asserts it).
 *
 * slidesOf(post) is the one read for display: the stored slides, else the legacy single picture as one slide, else none. The
 * server keeps `imageUrl` equal to the first slide's url on every write, so a thumbnail, a push or an email that reads
 * imageUrl shows the cover. */
export const SLIDES_MAX = 20;
export const SLIDE_ALT_MAX = 200;
export const slidesOf = (post) => (post?.slides?.length ? post.slides : post?.imageUrl ? [{ url: post.imageUrl, alt: '' }] : []);
/** Only a post (not an ad) in the portrait feed format carries a carousel; a missing kind or format is the default. */
export const carouselAllowed = (post) => (post?.kind || 'post') === 'post' && (post?.format || 'portrait') === 'portrait';
/** More than one picture: what the cards draw a stack icon and a count for. */
export const isCarousel = (post) => slidesOf(post).length > 1;
