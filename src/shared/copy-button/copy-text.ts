/**
 * Puts `text` on the visitor's clipboard: true when it got there. Only ever called from a press (browsers allow
 * clipboard writes from a user's gesture); false where there's no clipboard to write to (an old browser, a page
 * that isn't secure, the prerender), and the caller says so instead.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** How long "copied" stays on the button before it goes back to its own words. */
export const COPIED_FOR_MS = 2000;
