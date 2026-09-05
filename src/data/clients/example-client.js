// EXAMPLE CLIENT, duplicate this file to add a real client (see README.md).
// Every image path is optional: anything you omit renders as a labeled
// placeholder slot, so a case study can go live before all assets exist.
export default {
  slug: 'example-client',
  name: 'Example Client',
  type: 'Coffee Cart',
  blurb: 'Full brand identity, website, and print suite for a mobile espresso bar.',
  year: '2026',
  // cover: '/clients/example-client/cover.png',  // card image, omitted → monogram placeholder

  sections: {
    brand: {
      // logo: '/clients/example-client/logo.png',
      palette: [
        { name: 'Espresso', hex: '#121212' },
        { name: 'Signal Red', hex: '#d44c43' },
        { name: 'Steam', hex: '#fafafa' },
        { name: 'Crema', hex: '#c9a12a' },
      ],
      typography: [
        { family: 'Barlow Condensed', role: 'Display & headlines' },
        { family: 'Inter', role: 'Body & interface' },
      ],
      images: [],
      notes:
        'A compact, high-contrast identity built to stay legible on a cart wrap, a cup sleeve, and a 2-inch sticker. One mark, one color story, zero decoration.',
    },

    website: {
      url: 'https://example.com',
      screenshots: [],
      notes:
        'Single-page site focused on the daily location schedule and pre-orders. Built mobile-first, most customers find the cart from Instagram on their phone.',
    },

    cards: {
      // front: '/clients/example-client/card-front.png',
      // back:  '/clients/example-client/card-back.png',
      notes: 'Heavy matte stock, edge-to-edge color. The back is a loyalty punch card.',
    },

    print: {
      items: [
        { label: 'Die-cut logo stickers' },
        { label: 'Cart menu board' },
        { label: 'Cup sleeve stamp' },
      ],
      notes: 'Everything a customer touches carries the same mark.',
    },
  },
};
