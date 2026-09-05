# Adding a client to the Work page

Every client is one data file in this folder. No code changes needed.

## Steps

1. **Duplicate** `example-client.js` → rename it to your client's slug, e.g. `sopes-detailing.js`.
2. **Drop images** into `public/clients/<slug>/` (create the folder). Any name works, you reference the paths in the data file, e.g. `/clients/sopes-detailing/logo.png`.
3. **Edit the data file**: change `slug`, `name`, `type`, `blurb`, and fill in the
   sections. **Delete any section the client doesn't have**, sections only render
   if present. Any image you leave out renders as a labeled placeholder, so you can
   publish a partial case study and fill it in later.
4. **Register it** in `index.js`, add one import and one array entry (first in the
   array = first on the page).

That's it. The card appears on `/work` and the case study lives at `/work/<slug>`.

## Section reference

| Section key | Renders | Fields |
|---|---|---|
| `brand` | Brand Identity | `logo`, `palette[{name,hex}]`, `typography[{family,role}]`, `images[]`, `notes` |
| `website` | Website | `url` (live link), `screenshots[]`, `notes` |
| `cards` | Business Cards | `front`, `back` (image paths), `notes` |
| `print` | Print & Product | `items[{label,image}]`, `notes` |

Card fields: `slug`, `name`, `type` (short tag like "Auto Detailer"), `blurb`
(one line), `year`, `cover` (card image, omit for a monogram placeholder).
