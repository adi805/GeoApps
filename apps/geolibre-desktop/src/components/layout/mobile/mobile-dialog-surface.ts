/**
 * Full-screen surface for the field dialogs below the 768 px breakpoint.
 *
 * `DialogContent` already fills the viewport minus a 0.5 rem inset, so a phone
 * is only a couple of overrides away from a true field surface: drop the inset,
 * the rounding and the border below `md`, and let the dialog own the whole
 * screen with its own internal scroll region. Desktop sizing is untouched, and
 * no dialog markup or logic changes, which is what keeps the three large
 * dialogs reviewable while their deeper decomposition is still pending.
 */
export const MOBILE_DIALOG_SURFACE =
  "max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0";
