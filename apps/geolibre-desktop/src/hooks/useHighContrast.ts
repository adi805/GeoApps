import { useCallback, useEffect, useState } from "react";

/**
 * Storage key for the outdoor high-contrast preference.
 *
 * Kept in `localStorage` rather than the desktop-settings blob on purpose: this
 * is a per-device legibility preference (a phone used in sunlight), not part of
 * the project or the synced profile, and it must survive before the settings
 * store finishes hydrating.
 */
export const HIGH_CONTRAST_STORAGE_KEY = "geolibre.highContrast";

/**
 * The sunlight overrides: black on white, heavier borders, darker accents.
 *
 * Only the light variant lives here. `tokens.ts` defines a single `kontras`
 * palette (black background, yellow accent) and the generated
 * `styles/tokens.css` already paints it for `:root[data-contrast="high-dark"]`,
 * so the dark case sets the attribute and lets the stylesheet do the work. The
 * sunlight case has no equivalent in `tokens.ts` — that palette is built for
 * dark screens — so it stays inline.
 */
const LIGHT_VARS: Record<string, string> = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 0%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 0%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 0% 0%",
  "--primary": "221 100% 32%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "0 0% 96%",
  "--secondary-foreground": "0 0% 0%",
  "--muted": "0 0% 94%",
  "--muted-foreground": "0 0% 18%",
  "--accent": "0 0% 92%",
  "--accent-foreground": "0 0% 0%",
  "--border": "0 0% 15%",
  "--input": "0 0% 15%",
  "--ring": "221 100% 32%",
};

const ALL_VARS = new Set(Object.keys(LIGHT_VARS));

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "1";
  } catch {
    // Private mode or a blocked store: fall back to the normal theme rather
    // than breaking the shell.
    return false;
  }
}

/**
 * Paint the high-contrast token overrides onto the document root.
 *
 * The variables are set on `<html>` instead of a wrapper element so body-level
 * portals (dialogs, menus, toasts) inherit them too; a wrapper-scoped theme
 * would leave every dialog in the normal palette.
 *
 * Args:
 *   enabled: Whether the high-contrast palette is active.
 */
function applyContrastVars(enabled: boolean): void {
  const root = document.documentElement;
  // Clear the inline tokens before anything else: a leftover light value would
  // shadow the stylesheet's dark block, because inline styles beat every
  // selector regardless of specificity.
  for (const name of ALL_VARS) root.style.removeProperty(name);
  if (!enabled) {
    root.removeAttribute("data-contrast");
    return;
  }
  const dark = root.classList.contains("dark");
  if (dark) {
    // `styles/tokens.css` owns this palette; the attribute is the whole switch.
    root.setAttribute("data-contrast", "high-dark");
    return;
  }
  for (const [name, value] of Object.entries(LIGHT_VARS)) root.style.setProperty(name, value);
  root.setAttribute("data-contrast", "high-light");
}

/**
 * Persisted outdoor high-contrast toggle.
 *
 * Returns:
 *   The current preference and a setter that persists and applies it.
 */
export function useHighContrast(): { highContrast: boolean; setHighContrast: (on: boolean) => void } {
  const [highContrast, setHighContrastState] = useState(readStoredPreference);

  const setHighContrast = useCallback((on: boolean) => {
    setHighContrastState(on);
    try {
      window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, on ? "1" : "0");
    } catch {
      // The palette still applies for this session; only persistence is lost.
    }
  }, []);

  useEffect(() => {
    applyContrastVars(highContrast);
  }, [highContrast]);

  // The palette is mode-specific, so re-apply when light/dark flips while the
  // preference is on. `useThemeMode` toggles the `.dark` class on the root.
  useEffect(() => {
    if (!highContrast) return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => applyContrastVars(true));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [highContrast]);

  return { highContrast, setHighContrast };
}
