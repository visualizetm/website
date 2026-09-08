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

## Uploading from the browser (Cloudinary)

The Showcase editor uploads straight from the browser to Cloudinary. There
is no server round trip and no new Vercel function: the page POSTs the file
to Cloudinary's unsigned upload endpoint and writes the returned
`secure_url` into the field.

### The two variables

Set both in Vercel, Project Settings, Environment Variables, then redeploy.
They must carry the `VITE_` prefix: Vite only exposes `VITE_*` to the
browser bundle, so an unprefixed name is `undefined` at runtime and every
Upload button silently never appears.

| Variable | Value | Without it |
|---|---|---|
| `VITE_CLOUDINARY_CLOUD_NAME` | The cloud name from the Cloudinary dashboard | No Upload button anywhere; paste a link instead |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `visualize` | Same (both are required together) |

The admin host's Content Security Policy has to allow the upload too: `connect-src` includes `https://api.cloudinary.com` in vercel.json. Without it the browser refuses the POST before it is sent, which surfaces as an upload failure with no HTTP status behind it. The images themselves come back from res.cloudinary.com and are already covered by `img-src`'s `https:`.

Nothing else is needed, and nothing else should be added. There is no API
key and no API secret in the client, by design: an unsigned preset is the
entire credential and it can only create.

### The account setup these expect

| Setting | Value |
|---|---|
| Preset name | `visualize` |
| Signing mode | Unsigned |
| Asset folder | `showcase` |
| Allowed formats | jpg, jpeg, png, webp, svg |
| Max file size | 10MB |
| Incoming transformation | `c_limit,w_2000` |

The incoming transformation caps what is *stored*: a 6000px phone photo
lands as 2000px wide, so the original in the media library is already a
sensible size. The site then asks for a smaller version again per context
(see "Widths per context" below); the two work together, they are not
alternatives.

The editor enforces the same formats and the same 10MB limit in the browser
before anything is sent, so an oversized or wrong-format file is refused
immediately with a message rather than after a slow upload.

### What the editor does

Every image field has an Upload button beside its link, and the link itself
always works: pasting a URL is never hidden behind the upload path. The
file picker offers JPEG, PNG, WebP and SVG, with no `capture` attribute, so
a phone offers the photo library, Files, and the camera rather than forcing
the camera. While a file is uploading the button shows its progress and the
link field is disabled; on success the URL lands in the field and the
preview appears immediately. On a desktop the preview box is also a drop
target.

Every failure is a toast, never a silence: too large, wrong format, network
failure, and, when Cloudinary itself refuses, its own message passed
through unchanged (which is how you find out a preset name is wrong).

The five list fields (brand gallery, website screenshots, Instagram posts,
print items) take several files at once. They upload in sequence, showing
"Uploading 3 of 7", append one list entry per file that worked, keep those
even if others failed, name the failures at the end, and stop at the list's
own cap with a message.

### Deleting

Clearing an image field removes the link from the record only. The file
stays in Cloudinary: an unsigned preset can create but cannot delete, and
giving the browser a credential that could delete would be a much worse
trade than leaving an unused file in the media library. Delete unwanted
assets in the Cloudinary dashboard. The editor says this under every filled
field.

### Widths per context

`capImageWidth()` (`src/marketing/showcase.jsx`) inserts a `c_limit,w_<n>`
segment straight after `/image/upload/`, so the public site requests a
sized version rather than the original. `c_limit` only ever scales down, so
a small original is never blown up. A URL that already carries a transform
is left alone, and a non-Cloudinary URL passes through untouched.

| Context | Width |
|---|---|
| Hero deck covers, client detail cover | 1600 |
| Client cards in the list and the hero's overflow row | 800 |
| Brand gallery, website screenshots, print items | 1600 |
| Business cards | 1200 |
| Instagram posts | 600 |
| Logos, Instagram profile image | 400 |

`scripts/cloudinary-test.mjs` asserts all of this without an account: the
endpoint and FormData shape, that no key or secret is ever sent, that
`secure_url` is what comes back, that Cloudinary's error message survives,
that validation happens before the request, and every width above.
