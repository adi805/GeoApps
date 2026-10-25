/**
 * Window events that open the field tools the top toolbar owns.
 *
 * Why this exists: on a phone the toolbar is replaced by the bottom tab bar
 * (see `components/layout/mobile/`), and the field tools — Field Collection,
 * GPS Tracking, Georeferencer — keep their open state inside
 * `useToolbarDialogs`, which `TopToolbar` owns. Moving that state would mean
 * rewriting how three large dialogs are mounted. Instead the mobile shell asks
 * for a tool over an event, exactly like the Browser panel already asks for the
 * Add Data dialog through `open-add-data.ts`. One owner of the state, two
 * ways to reach it.
 */

/** Window event letting any surface open one of the field tools. */
export const OPEN_FIELD_TOOL_EVENT = "geolibre:open-field-tool";

/** The field tools the mobile shell can request. */
export type FieldToolId = "fieldCollection" | "gpsTracking" | "georeferencer";

/** The detail carried by {@link OPEN_FIELD_TOOL_EVENT}. */
export interface OpenFieldToolDetail {
  tool: FieldToolId;
}

/**
 * Ask the shell to open a field tool. A no-op outside the browser, matching
 * {@link openAddData}.
 *
 * Args:
 *   tool: Which field tool to open.
 */
export function openFieldTool(tool: FieldToolId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenFieldToolDetail>(OPEN_FIELD_TOOL_EVENT, { detail: { tool } }),
  );
}

/** Window event letting any surface ask for the New Project dialog. */
export const OPEN_NEW_PROJECT_EVENT = "geolibre:open-new-project";

/**
 * Ask the shell to open the New Project dialog. A no-op outside the browser.
 *
 * The dialog's open state lives in `useToolbarDialogs` with the rest of the
 * toolbar-owned dialogs, so the mobile shell reaches it the same way it reaches
 * the field tools: one owner, two ways in.
 */
export function openNewProjectDialog(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_NEW_PROJECT_EVENT));
}

/**
 * Subscribe to New Project requests.
 *
 * Args:
 *   onRequest: Called when the dialog is requested.
 *
 * Returns:
 *   An unsubscribe function.
 */
export function onNewProjectRequest(onRequest: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_NEW_PROJECT_EVENT, onRequest);
  return () => window.removeEventListener(OPEN_NEW_PROJECT_EVENT, onRequest);
}

/**
 * Subscribe to field-tool requests.
 *
 * Args:
 *   onRequest: Called with the requested tool id.
 *
 * Returns:
 *   An unsubscribe function.
 */
export function onFieldToolRequest(onRequest: (tool: FieldToolId) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<OpenFieldToolDetail>).detail;
    if (detail && typeof detail.tool === "string") onRequest(detail.tool);
  };
  window.addEventListener(OPEN_FIELD_TOOL_EVENT, listener);
  return () => window.removeEventListener(OPEN_FIELD_TOOL_EVENT, listener);
}

/** Window event letting any surface open the command palette. */
export const OPEN_COMMAND_PALETTE_EVENT = "geolibre:open-command-palette";

/**
 * Ask the shell to open the command palette.
 *
 * A phone has no Cmd/Ctrl-K and the menu that opens the palette lives in the
 * desktop toolbar, so the mobile project sheet asks for it over an event like
 * the field tools above. The palette's open state stays in
 * `useToolbarDialogs`: one owner, two ways in. A no-op outside the browser,
 * matching {@link openFieldTool}.
 */
export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

/**
 * Subscribe to command-palette requests.
 *
 * Args:
 *   onRequest: Called when the palette is requested.
 *
 * Returns:
 *   An unsubscribe function.
 */
export function onCommandPaletteRequest(onRequest: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onRequest);
  return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onRequest);
}
