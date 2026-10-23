/**
 * Shared logic for checking GeoApps releases on GitHub. Used by both the
 * manual "Check for updates" flow in the About dialog and the automated
 * startup check (desktop only). Keeping the version math and the GitHub fetch
 * here means the two surfaces classify and compare releases identically.
 */

/**
 * Page that lists this product's releases. Points at our own repository, never
 * at the upstream project: an update prompt that links to another product's
 * download page offers the user a binary this app cannot install.
 */
export const UPDATE_URL = "https://github.com/adi805/GeoApps/releases/latest";

/**
 * GitHub REST endpoint that lists the releases of THIS repository, newest page
 * first. The app reads the whole list and picks the highest version itself.
 *
 * It used to call `/releases/latest`, which answers 404 for this repository:
 * that endpoint only considers published non-prerelease releases, and every
 * GeoApps release so far is flagged prerelease, so the check could never find
 * anything. Listing the releases makes the answer depend on the tags we
 * actually published instead of on GitHub's prerelease filter.
 *
 * The repository is ours, never the upstream project: an update prompt built
 * from upstream's releases offers a binary this app cannot install (#125).
 */
export const RELEASES_URL = "https://api.github.com/repos/adi805/GeoApps/releases?per_page=100";

/**
 * The running app version, injected by Vite at build time. Guarded so the pure
 * helpers below can be imported in a plain Node test (where the define is
 * absent) without throwing a ReferenceError.
 */
export const APP_VERSION: string =
  typeof __GEOLIBRE_VERSION__ !== "undefined" ? __GEOLIBRE_VERSION__ : "0.0.0";

/**
 * True in the Microsoft Store MSIX build, where the entire in-app update flow is
 * removed so the app updates only through the Store (Microsoft policy 10.2.5
 * rejects a Store app that updates itself outside the Store). Guarded the same
 * way as {@link APP_VERSION} so the pure helpers here stay importable in a plain
 * Node test (where the define is absent) without throwing a ReferenceError.
 * Injected by vite.config.ts; set only by the Store build (msix-store.yml).
 */
export const IS_STORE_BUILD: boolean =
  typeof __GEOLIBRE_STORE_BUILD__ !== "undefined" ? __GEOLIBRE_STORE_BUILD__ : false;

/**
 * How a newer release differs from the running version. Used to filter startup
 * notifications by the user's chosen granularity (see {@link UpdateNotificationLevel}).
 */
export type ReleaseSeverity = "major" | "minor" | "patch";

/**
 * Which releases should trigger an automated startup notification:
 * - `all`: major, minor, and patch builds
 * - `minor`: major and minor builds only
 * - `major`: major builds only
 */
export type UpdateNotificationLevel = "all" | "minor" | "major";

/** A normalized view of the latest GitHub release. */
export interface LatestRelease {
  /** Formatted version tag, e.g. `"v1.6.0"`. */
  version: string;
  /** Raw release-notes body (Markdown). May be an empty string. */
  notes: string;
  /** The release page URL, falling back to the downloads page. */
  url: string;
}

/** Stable error codes for a failed update check, resolved to i18n at call sites. */
export type UpdateCheckErrorCode = "rateLimit" | "http" | "noTag" | "network";

/** Error thrown by {@link fetchLatestRelease} for a non-abort failure. */
export class UpdateCheckError extends Error {
  readonly code: UpdateCheckErrorCode;
  readonly status?: number;

  constructor(code: UpdateCheckErrorCode, status?: number) {
    super(code);
    this.name = "UpdateCheckError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Parse a `vX.Y.Z` (or `X.Y.Z`) version into its numeric components.
 *
 * @param version - A semantic version string, optionally prefixed with `v`.
 * @returns A `[major, minor, patch]` tuple, or `null` if it does not match.
 */
export function parseVersion(version: string): [number, number, number] | null {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** A version split into its numeric triple plus its prerelease identifiers. */
interface ParsedVersion {
  triple: [number, number, number];
  prerelease: string[];
}

/**
 * Parse a version into its numeric triple and prerelease identifiers.
 *
 * Unlike {@link parseVersion} this accepts a prerelease suffix (`1.2.3-rc1`)
 * and ignores build metadata (`+sha`), because the suffix decides precedence:
 * `1.2.3-rc1` sorts below `1.2.3` and above `1.2.2`. Returns `null` for
 * anything that is not a semantic version.
 */
function parseVersionParts(version: string): ParsedVersion | null {
  const match = version
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;

  return {
    triple: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/** Compare prerelease identifier lists by SemVer 2.0.0 precedence rules. */
function comparePrerelease(current: string[], latest: string[]): number {
  // A version without a prerelease outranks the same version carrying one.
  if (current.length === 0 && latest.length === 0) return 0;
  if (current.length === 0) return 1;
  if (latest.length === 0) return -1;

  const shared = Math.min(current.length, latest.length);
  for (let index = 0; index < shared; index += 1) {
    const left = current[index];
    const right = latest[index];
    if (left === right) continue;

    const leftIsNumeric = /^\d+$/.test(left);
    const rightIsNumeric = /^\d+$/.test(right);
    if (leftIsNumeric && rightIsNumeric) return Number(left) - Number(right);
    // Numeric identifiers rank below alphanumeric ones.
    if (leftIsNumeric) return -1;
    if (rightIsNumeric) return 1;
    return left < right ? -1 : 1;
  }

  // Every shared identifier matches, so the longer list has precedence.
  return current.length - latest.length;
}

/**
 * Compare two versions by full SemVer precedence, prerelease suffix included.
 *
 * @returns A negative number if `currentVersion` is older than `latestVersion`,
 *   positive if newer, and `0` if equal or either is unparseable.
 */
export function compareVersions(currentVersion: string, latestVersion: string): number {
  const current = parseVersionParts(currentVersion);
  const latest = parseVersionParts(latestVersion);
  if (!current || !latest) return 0;

  for (let index = 0; index < current.triple.length; index += 1) {
    if (current.triple[index] !== latest.triple[index]) {
      return current.triple[index] - latest.triple[index];
    }
  }

  return comparePrerelease(current.prerelease, latest.prerelease);
}

/**
 * Ensure a version string carries the leading `v` used throughout the UI.
 */
export function formatVersion(version: string): string {
  const trimmedVersion = version.trim();
  return trimmedVersion.startsWith("v") ? trimmedVersion : `v${trimmedVersion}`;
}

/**
 * Classify how `latestVersion` differs from `currentVersion`.
 *
 * @returns `"major"`, `"minor"`, or `"patch"` when `latestVersion` is newer,
 *   or `null` when it is not newer or either version is unparseable.
 */
export function releaseSeverity(
  currentVersion: string,
  latestVersion: string,
): ReleaseSeverity | null {
  const current = parseVersionParts(currentVersion);
  const latest = parseVersionParts(latestVersion);
  if (!current || !latest) return null;
  // A negative comparison means `latestVersion` is newer; equal or older is not
  // an update at all. This also covers a newer prerelease of the same triple
  // (`1.5.1-rc1` after `1.5.1-rc0`), which the triple alone cannot distinguish.
  if (compareVersions(currentVersion, latestVersion) >= 0) return null;

  // Newer is established above, so a differing major or minor is an increase.
  if (latest.triple[0] !== current.triple[0]) return "major";
  if (latest.triple[1] !== current.triple[1]) return "minor";
  // Same major and minor: a newer patch, or a newer prerelease of one.
  return "patch";
}

/**
 * Whether a release of the given `severity` should raise a startup
 * notification under the user's chosen `level`.
 */
export function meetsNotificationLevel(
  severity: ReleaseSeverity,
  level: UpdateNotificationLevel,
): boolean {
  if (level === "all") return true;
  if (level === "minor") return severity === "major" || severity === "minor";
  return severity === "major";
}

interface GitHubRelease {
  tag_name?: unknown;
  body?: unknown;
  html_url?: unknown;
  draft?: unknown;
}

/**
 * Pick the highest version from a `/releases` response.
 *
 * Every release is considered, prereleases included: that is the whole point of
 * reading the list instead of `/releases/latest`. Drafts are skipped because
 * they are not downloadable, and so is any tag that is not a semantic version,
 * because such a tag cannot be ordered against the running version.
 *
 * @returns The chosen release, or `null` when the payload holds none that can
 *   be ordered (including a payload that is not an array at all).
 */
function pickNewestRelease(payload: unknown): GitHubRelease | null {
  if (!Array.isArray(payload)) return null;

  let newest: GitHubRelease | null = null;
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const release = entry as GitHubRelease;
    if (release.draft === true) continue;
    const tag = typeof release.tag_name === "string" ? release.tag_name.trim() : "";
    if (!parseVersionParts(tag)) continue;

    if (!newest || compareVersions(String(newest.tag_name), tag) < 0) {
      newest = release;
    }
  }

  return newest;
}

/**
 * Fetch the newest GeoApps release from GitHub.
 *
 * @param signal - Optional abort signal to cancel the request.
 * @returns The normalized newest release, prereleases included.
 * @throws {UpdateCheckError} On rate limiting, an HTTP error, a body that is not
 *   a release list, a list with no usable tag, or a network failure. An
 *   `AbortError` propagates unchanged so callers can ignore intentional
 *   cancellations.
 */
export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestRelease> {
  let response: Response;
  try {
    response = await fetch(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal,
    });
  } catch (error) {
    // Let intentional cancellations bubble up so callers can ignore them.
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new UpdateCheckError("network");
  }

  if (!response.ok) {
    // GitHub signals its primary rate limit with 403 + exhausted remaining, and
    // its secondary rate limit with 429; map both to the actionable message.
    if (
      (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") ||
      response.status === 429
    ) {
      throw new UpdateCheckError("rateLimit", response.status);
    }
    throw new UpdateCheckError("http", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // A malformed 200 body would otherwise throw a plain SyntaxError that
    // bypasses UpdateCheckError; treat it like any other failed fetch.
    throw new UpdateCheckError("network");
  }
  // The list endpoint always answers an array; anything else is a response this
  // code cannot read (an error object, a captive-portal page, a proxy).
  if (!Array.isArray(payload)) {
    throw new UpdateCheckError("network");
  }

  const release = pickNewestRelease(payload);
  if (!release || typeof release.tag_name !== "string") {
    throw new UpdateCheckError("noTag");
  }

  const htmlUrl = typeof release.html_url === "string" ? release.html_url.trim() : "";
  return {
    version: formatVersion(release.tag_name),
    // Cap the notes length; GitHub enforces no size limit on release bodies and
    // 50k is generous for any real changelog while ruling out pathological blobs.
    notes: typeof release.body === "string" ? release.body.trim().slice(0, 50_000) : "",
    // Only trust a GitHub release URL; fall back to the downloads page so a
    // tampered API response can't redirect the download action to another
    // origin (openExternalLink already blocks non-http(s) schemes).
    url: /^https:\/\/github\.com\//i.test(htmlUrl) ? htmlUrl : UPDATE_URL,
  };
}
