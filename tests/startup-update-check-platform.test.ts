import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { act, render } from "./helpers/dom";

// Loaded after the DOM harness so the hook's imports resolve against jsdom.
const { useStartupUpdateCheck } =
  await import("../apps/geolibre-desktop/src/hooks/useStartupUpdateCheck");
const { RELEASES_URL, UPDATE_URL } = await import("../apps/geolibre-desktop/src/lib/updates");
const { UPDATE_LAST_CHECK_STORAGE_KEY, UPDATE_DISMISSED_VERSION_STORAGE_KEY } =
  await import("../apps/geolibre-desktop/src/lib/storage-keys");

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type WindowWithTauri = Window & { __TAURI_INTERNALS__?: unknown };

/** Pretend to be a given runtime: Tauri shell (or not) plus a platform user agent. */
function setRuntime(tauri: boolean, userAgent: string): void {
  if (tauri) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
  } else {
    delete (window as WindowWithTauri).__TAURI_INTERNALS__;
  }
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: /Android|iPhone|iPad|iPod/i.test(userAgent) ? 5 : 0,
  });
}

/** Replace fetch with a recorder that answers with one fixed release payload. */
function recordFetch(): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(
      JSON.stringify([
        {
          tag_name: "v9.9.9",
          name: "9.9.9",
          html_url: "https://example.invalid/release",
          body: "",
          draft: false,
          prerelease: false,
          published_at: "2026-10-22T00:00:00Z",
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return calls;
}

/** Render the hook and capture what it returns. */
function renderHookProbe(): { pending: () => unknown } {
  const box: { pending: unknown } = { pending: null };
  function Probe() {
    box.pending = useStartupUpdateCheck().pending;
    return null;
  }
  render(createElement(Probe));
  return { pending: () => box.pending };
}

/** Let the startup check's fetch, JSON parse, and state update settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  window.localStorage.removeItem(UPDATE_LAST_CHECK_STORAGE_KEY);
  window.localStorage.removeItem(UPDATE_DISMISSED_VERSION_STORAGE_KEY);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (window as WindowWithTauri).__TAURI_INTERNALS__;
});

describe("startup update check is desktop only", () => {
  it("never reaches GitHub from the packaged Android app", async () => {
    setRuntime(true, ANDROID_UA);
    const calls = recordFetch();
    const probe = renderHookProbe();
    await settle();

    assert.deepEqual(calls, [], "the Android app must not query GitHub for a desktop release");
    assert.equal(probe.pending(), null);
  });

  it("still checks on the desktop Tauri shell", async () => {
    setRuntime(true, DESKTOP_UA);
    const calls = recordFetch();
    renderHookProbe();
    await settle();

    // The harness pins __GEOLIBRE_VERSION__ to "0.0.0-test", which is not
    // semver, so no severity (and therefore no prompt) can be derived here.
    // What this asserts is the gate: the desktop shell still queries GitHub,
    // and it queries our own repository.
    assert.deepEqual(calls, [RELEASES_URL]);
  });

  it("stays quiet in the browser, which reloads to the latest version", async () => {
    setRuntime(false, DESKTOP_UA);
    const calls = recordFetch();
    const probe = renderHookProbe();
    await settle();

    assert.deepEqual(calls, []);
    assert.equal(probe.pending(), null);
  });
});

describe("update endpoints point at this product", () => {
  it("reads the release list, which includes prereleases", () => {
    assert.match(RELEASES_URL, /repos\/adi805\/GeoApps\/releases\?per_page=100$/);
    // `/releases/latest` answers 404 while every release is flagged prerelease,
    // so the check must never depend on it.
    assert.doesNotMatch(RELEASES_URL, /releases\/latest/);
    assert.doesNotMatch(RELEASES_URL, /opengeos|GeoLibre/);
  });

  it("links to a download page this app's releases live on", () => {
    assert.match(UPDATE_URL, /github\.com\/adi805\/GeoApps\/releases/);
    assert.doesNotMatch(UPDATE_URL, /geolibre\.app/);
  });
});
