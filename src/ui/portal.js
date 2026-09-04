/* Overlays portal INSIDE .lay-root so they inherit the --v- tokens
 * (tokens live on .lay-root, not :root). Falls back to body. */
export function portalRoot() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.lay-root') || document.body;
}
