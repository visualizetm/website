# Carousel: decisions

The job is docs/CAROUSEL-PROMPT.md. Each call made without asking, with the rule that decided it.

1. (1) The shared module is src/shared/slides.js (slidesOf, carouselAllowed, isCarousel, SLIDES_MAX, SLIDE_ALT_MAX), mirrored byte for byte in api/_lib/slides.js; the server's cleaning (sanitizeSlides) lives in api/_routes/posts.js beside sanitizeVersion, because it needs the server's safeUrl and the mirror must stay pure.
2. (1) The count of 20 is checked after cleaning (an unsafe or empty entry dropped first): 21 real pictures are a 400; 21 entries of which two are empty are 19 pictures and fine. Plainer than refusing on entries that would never be written.
3. (1) A post that stops being a portrait post (it becomes an ad, a story or a video) has its stored slides cleared in the same write and keeps the cover as imageUrl. The brief's slidesOf has no kind check, so a stale carousel left on an ad would otherwise be drawn and sent; one rule, a stored carousel only ever on a portrait post, is easier to verify. Slides sent to an ad or a story are never written.
4. (1) A write that sends imageUrl alone to a carousel replaces slide 1 and keeps the rest behind it, so an older editor path or a script setting the cover keeps imageUrl equal to slides[0].url. An imageUrl sent beside slides never wins over the first slide.
5. (1) An empty slides array clears the carousel and leaves imageUrl as it was (the editor sends imageUrl '' with it when Rob removes every picture).
6. (1) The client's first draft (previous on /api/planner) carries the version's slides through slidesOf, so a carousel's earlier version shows every picture, not only its cover. planner-endpoint-test's previous check moves from three keys to four, the same exact key assertion.
7. (1) security-test's every-image-field section grows by the slide url (each unsafe url stored as nothing, each good one unchanged), since a slide url is a stored image link.
