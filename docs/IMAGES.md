# IMAGES

How showcase images work today (Site Prompt 2): every image field on a
client's Showcase tab is a pasted link, nothing else. No upload endpoint, no
asset record, no CDN by default. This file is what to paste, and the
optional upload path when two environment variables are set.

## Recommended host: Cloudinary (free tier)

A free Cloudinary account gives a stable, fast, resizable image URL for
every showcase asset. Sign up at cloudinary.com, no card required for the
free tier. Two things from that account matter here:

- The cloud name, shown on the Cloudinary dashboard.
- An unsigned upload preset (Settings, Upload, Upload presets, Add upload
  preset, Signing Mode: Unsigned). Unsigned means the browser can upload
  directly with no server secret involved, which matches this project's
  no-new-function rule for this prompt.

Paste the resulting Cloudinary URL into the image field. That is the whole
manual path.

## Why not Google Drive links

`brand.logoLink` (the existing client-record field) already uses Drive
links today for internal reference, and that stays as is. But a Drive
sharing link is not a direct image URL: it points at a Drive viewer page,
not the file bytes, so an `<img src>` pointed at a typical Drive share link
either fails to load or shows a Google Docs Viewer chrome around the image,
not the image alone. Drive also rate limits and sometimes blocks
hot-linking from a browser at all. None of the showcase image fields
(cover, logos, gallery images, screenshots, card fronts and backs, print
items) should ever be a Drive link; use Cloudinary or any host that answers
the URL directly with image bytes and no viewer wrapper.

## Recommended sizes

| Field | Size | Notes |
|---|---|---|
| Cover | 1600 by 1000 | The list card and hero image; landscape, matches the card's 16:10 aspect ratio today. |
| Brand gallery images | 1600 wide | Height follows the source image; the gallery grid does not force a ratio. |
| Logos (light and dark) | SVG, or 800 wide PNG with transparency | SVG scales cleanly at any size; a PNG must have a transparent background so it sits on either a light or dark card. |
| Website screenshots | 1600 wide | A full page screenshot at this width reads clearly in the browser-chrome mockup. |
| Card front and back | 1050 by 600 | Matches a standard business card's 3.5 by 2 inch print ratio at roughly 300dpi crop margin included. |
| Print & Product items | 1600 wide | Same as the brand gallery; product photos vary in aspect ratio. |

Every field accepts any image format a browser can render; the sizes above
are a target for sharpness on a large screen without an oversized file, not
a hard requirement enforced anywhere in code.

## Optional: upload from the browser

When both `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` are present
in the client environment (as `VITE_CLOUDINARY_CLOUD_NAME` and
`VITE_CLOUDINARY_UPLOAD_PRESET`, since only `VITE_`-prefixed variables reach
the browser bundle), an Upload button appears beside every image field in
the Showcase tab. Clicking it opens the browser's file picker, uploads the
chosen file directly to Cloudinary's unsigned upload endpoint using the
preset (no server round trip, no new Vercel function), and fills the
field's link with the returned secure URL once the upload finishes. Without
both variables set, the button does not render at all; every image field
still works exactly as a plain pasted link either way.

Set the two variables in Vercel, Project Settings, Environment Variables,
then redeploy:

| Variable | Unlocks | Without it |
|---|---|---|
| VITE_CLOUDINARY_CLOUD_NAME | The Upload button beside every showcase image field | The button does not render; paste a link instead |
| VITE_CLOUDINARY_UPLOAD_PRESET | Same as above (both are required together) | Same as above |
