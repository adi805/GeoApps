/**
 * Relative time for the home screen's project rows.
 *
 * The composition for issue 102 draws each row's context line as "12 lapisan ·
 * 2 jam lalu". The layer count is not in the recent-project record, but the
 * timestamp is, so this helper covers the half that the app can actually
 * measure: how long ago the project was opened.
 *
 * It mirrors `relativeSyncTime` in `panels/layer-panel/layer-panel-utils.ts`
 * rather than importing it: a panel utility is not a home-screen dependency,
 * and the layer panel's version stops at days, which would print the E2E seed
 * (a fixed January timestamp) as "293 days ago" for the rest of the year.
 *
 * The `now` argument exists so tests can pin the clock; callers pass only the
 * first two arguments.
 */

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const MONTH_SECONDS = 30 * DAY_SECONDS;
const YEAR_SECONDS = 365 * DAY_SECONDS;

/**
 * Formats a timestamp as a localized relative time.
 *
 * @param iso - The ISO timestamp to describe, e.g. a project's `openedAt`.
 * @param locale - The UI locale (`id`, `en`, ...).
 * @param now - Current epoch milliseconds; defaults to `Date.now()`.
 * @returns The localized phrase ("2 jam lalu"), or `iso` when it cannot be parsed.
 */
export function relativeOpenedAt(iso: string, locale: string, now: number = Date.now()): string {
  const elapsedSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (!Number.isFinite(elapsedSeconds)) return iso;

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const magnitude = Math.abs(elapsedSeconds);
  if (magnitude < MINUTE_SECONDS) return formatter.format(elapsedSeconds, "second");
  if (magnitude < HOUR_SECONDS) {
    return formatter.format(Math.round(elapsedSeconds / MINUTE_SECONDS), "minute");
  }
  if (magnitude < DAY_SECONDS) {
    return formatter.format(Math.round(elapsedSeconds / HOUR_SECONDS), "hour");
  }
  if (magnitude < WEEK_SECONDS) {
    return formatter.format(Math.round(elapsedSeconds / DAY_SECONDS), "day");
  }
  if (magnitude < MONTH_SECONDS) {
    return formatter.format(Math.round(elapsedSeconds / WEEK_SECONDS), "week");
  }
  if (magnitude < YEAR_SECONDS) {
    return formatter.format(Math.round(elapsedSeconds / MONTH_SECONDS), "month");
  }
  return formatter.format(Math.round(elapsedSeconds / YEAR_SECONDS), "year");
}
