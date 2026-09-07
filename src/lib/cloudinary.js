/* Cloudinary unsigned upload (Site Prompt 2, Part 5): a pure browser-side
 * POST straight to Cloudinary's unsigned upload endpoint, no backend
 * function involved. Enabled only when both env vars are present in the
 * client build; every image field hides its Upload button otherwise. */
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export const cloudinaryEnabled = !!(CLOUD_NAME && UPLOAD_PRESET);

/**
 * Uploads a File straight to Cloudinary and returns its secure_url, or null
 * on failure (disabled, network error, non-OK response). Never throws.
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadToCloudinary(file) {
  if (!cloudinaryEnabled || !file) return null;
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.secure_url || null;
  } catch {
    return null;
  }
}
