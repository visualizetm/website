/* Cloudinary unsigned upload (Site Prompt 2, Part 5; finished and verified
 * against a real account in the upload prompt).
 *
 * A pure browser-side POST straight to Cloudinary's unsigned upload
 * endpoint: no backend function, and deliberately no API key and no API
 * secret anywhere near the client bundle. An unsigned preset is the whole
 * credential, and it can only create; it cannot read, list or delete. That
 * is the trade: clearing an image field forgets the link, it does not
 * remove the asset from Cloudinary.
 *
 * Both variables must be VITE_ prefixed. Vite only exposes VITE_* to the
 * browser, so an unprefixed name is undefined at runtime and every Upload
 * button silently never appears, which is the failure this file is written
 * to make impossible to hit quietly.
 */
export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export const cloudinaryEnabled = !!(CLOUD_NAME && UPLOAD_PRESET);

/* The formats the preset allows, and the accept attribute built from them.
 * SVG goes through the same /image/upload endpoint as the raster formats;
 * Cloudinary treats it as an image and returns a secure_url ending .svg. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const prettySize = (n) => `${Math.round((n / (1024 * 1024)) * 10) / 10}MB`;

/**
 * Why this file cannot be uploaded, or null when it can.
 * @param {File} file
 * @returns {string|null}
 */
export function validateUploadFile(file) {
  if (!file) return 'No file chosen.';
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name || 'That file'} is a ${file.type || 'unknown type'}. Use a JPEG, PNG, WebP or SVG.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name || 'That file'} is ${prettySize(file.size)}. The limit is ${prettySize(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

/**
 * Uploads one File to Cloudinary.
 *
 * Always resolves, never throws, and always says which of the four things
 * happened: not configured, rejected before sending, Cloudinary said no
 * (its own message is passed straight through, since "Upload preset not
 * found" is the one sentence that actually tells you what to fix), or the
 * network failed.
 *
 * @param {File} file
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function uploadToCloudinary(file) {
  if (!cloudinaryEnabled) return { error: 'Image uploads are not configured for this deployment.' };
  const invalid = validateUploadFile(file);
  if (invalid) return { error: invalid };

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  } catch {
    return { error: 'Could not reach Cloudinary. Check the connection and try again.' };
  }

  let data = null;
  try { data = await res.json(); } catch { /* a non-JSON body is handled below */ }

  if (!res.ok) {
    const said = data?.error?.message;
    return { error: said ? `Cloudinary: ${said}` : `Cloudinary rejected the upload (${res.status}).` };
  }
  if (!data?.secure_url) return { error: 'Cloudinary accepted the file but returned no URL.' };
  return { url: data.secure_url };
}
