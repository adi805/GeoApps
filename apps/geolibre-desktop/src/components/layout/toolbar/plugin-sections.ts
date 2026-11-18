/**
 * Sectioning the registered plugins for a surface.
 *
 * The predicate is the caller's, not this module's: the Plugins menu and the
 * command palette both pass `isKebunPlugin` from the KEBUN preset, so the preset
 * stays the only list of what counts as a kebun plugin (#122). Keeping the
 * predicate out also keeps this module import-free, which is what lets a test in
 * the app project load it: the app is a composite TypeScript project, so it may
 * not import source outside its own include.
 */

/** A list split in two, both sides in the order they were given. */
export interface PluginPartition<T> {
  /** Plugins the predicate accepts: the curated, always-visible section. */
  primary: T[];
  /** Everything else, so no plugin ever disappears from the list. */
  rest: T[];
}

/**
 * Splits plugins into the ones `predicate` accepts and the rest.
 *
 * Total and disjoint by construction: every input plugin lands on exactly one
 * side, so a surface can render the primary section first and the remainder
 * second without checking for an entry it lost.
 *
 * @param plugins - Plugins in registration order.
 * @param predicate - Which side a plugin belongs on.
 * @returns Both sides, each in registration order.
 */
export function partitionPlugins<T>(
  plugins: readonly T[],
  predicate: (plugin: T) => boolean,
): PluginPartition<T> {
  const primary: T[] = [];
  const rest: T[] = [];
  for (const plugin of plugins) {
    if (predicate(plugin)) primary.push(plugin);
    else rest.push(plugin);
  }
  return { primary, rest };
}
