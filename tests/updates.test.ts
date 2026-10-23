import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  compareVersions,
  fetchLatestRelease,
  formatVersion,
  meetsNotificationLevel,
  parseVersion,
  releaseSeverity,
  UPDATE_URL,
  UpdateCheckError,
} from "../apps/geolibre-desktop/src/lib/updates";

describe("update version helpers", () => {
  it("parses semantic versions with and without a v prefix", () => {
    assert.deepEqual(parseVersion("1.5.0"), [1, 5, 0]);
    assert.deepEqual(parseVersion("v2.0.3"), [2, 0, 3]);
    assert.equal(parseVersion("1.5"), null);
    assert.equal(parseVersion("not-a-version"), null);
  });

  it("compares versions numerically, not lexically", () => {
    assert.ok(compareVersions("1.5.0", "1.10.0") < 0);
    assert.ok(compareVersions("1.5.0", "1.5.0") === 0);
    assert.ok(compareVersions("2.0.0", "1.9.9") > 0);
  });

  it("treats unparseable versions as equal so it never falsely reports an update", () => {
    assert.equal(compareVersions("1.5.0", "garbage"), 0);
  });

  it("normalizes a version to a leading v", () => {
    assert.equal(formatVersion("1.5.0"), "v1.5.0");
    assert.equal(formatVersion("v1.5.0"), "v1.5.0");
    assert.equal(formatVersion("  1.5.0 "), "v1.5.0");
  });
});

describe("releaseSeverity", () => {
  it("classifies the kind of newer release", () => {
    assert.equal(releaseSeverity("1.5.0", "2.0.0"), "major");
    assert.equal(releaseSeverity("1.5.0", "1.6.0"), "minor");
    assert.equal(releaseSeverity("1.5.0", "1.5.1"), "patch");
  });

  it("returns null when the candidate is not newer or is unparseable", () => {
    assert.equal(releaseSeverity("1.5.0", "1.5.0"), null);
    assert.equal(releaseSeverity("1.5.0", "1.4.9"), null);
    assert.equal(releaseSeverity("1.5.0", "v1.x"), null);
  });
});

describe("meetsNotificationLevel", () => {
  it("notifies for everything at the 'all' level", () => {
    assert.equal(meetsNotificationLevel("patch", "all"), true);
    assert.equal(meetsNotificationLevel("minor", "all"), true);
    assert.equal(meetsNotificationLevel("major", "all"), true);
  });

  it("suppresses patches at the 'minor' level", () => {
    assert.equal(meetsNotificationLevel("patch", "minor"), false);
    assert.equal(meetsNotificationLevel("minor", "minor"), true);
    assert.equal(meetsNotificationLevel("major", "minor"), true);
  });

  it("notifies only for major releases at the 'major' level", () => {
    assert.equal(meetsNotificationLevel("patch", "major"), false);
    assert.equal(meetsNotificationLevel("minor", "major"), false);
    assert.equal(meetsNotificationLevel("major", "major"), true);
  });
});

describe("version precedence with prerelease suffixes", () => {
  it("orders a prerelease below the release it precedes", () => {
    assert.ok(compareVersions("1.5.0-rc1", "1.5.0") < 0);
    assert.ok(compareVersions("1.5.0", "1.5.0-rc1") > 0);
  });

  it("orders a prerelease above the previous patch", () => {
    assert.ok(compareVersions("1.5.0", "1.5.1-rc1") < 0);
    assert.ok(compareVersions("1.5.1-rc1", "1.5.1-rc2") < 0);
    assert.ok(compareVersions("1.5.1-1", "1.5.1-10") < 0);
  });

  it("compares alphanumeric identifiers lexically, as SemVer requires", () => {
    // SemVer 2.0.0 §11.4 compares alphanumeric identifiers in ASCII order, so
    // rc10 sorts BELOW rc2. Asserted on purpose: it looks like a bug otherwise,
    // and a tag scheme that reaches rc10 would need numeric identifiers instead.
    assert.ok(compareVersions("1.5.1-rc10", "1.5.1-rc2") < 0);
  });

  it("ignores build metadata", () => {
    assert.equal(compareVersions("1.5.0+build1", "1.5.0+build2"), 0);
  });

  it("classifies a newer prerelease as a patch update", () => {
    assert.equal(releaseSeverity("0.1.0", "0.1.1-rc1"), "patch");
    assert.equal(releaseSeverity("0.1.1-rc1", "0.1.1"), "patch");
    assert.equal(releaseSeverity("0.1.1-rc1", "0.1.1-rc1"), null);
  });

  it("still keeps the strict triple parser free of prerelease tags", () => {
    assert.equal(parseVersion("1.5.0-rc1"), null);
  });
});

describe("fetchLatestRelease", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /** Answer every request with one fixed JSON payload. */
  const stubPayload = (body: unknown, init: ResponseInit = { status: 200 }) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), init)) as typeof fetch;
  };

  /** One entry of a `/releases` response. */
  const release = (tagName: string, extra: Record<string, unknown> = {}) => ({
    tag_name: tagName,
    body: "",
    html_url: `https://github.com/adi805/GeoApps/releases/tag/${tagName}`,
    draft: false,
    prerelease: true,
    ...extra,
  });

  it("normalizes the chosen release and keeps a GitHub html_url", async () => {
    stubPayload([
      release("v1.6.0", {
        body: "  notes  ",
        html_url: "https://github.com/opengeos/GeoLibre/releases/tag/v1.6.0",
      }),
    ]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.version, "v1.6.0");
    assert.equal(latest.notes, "notes");
    assert.equal(latest.url, "https://github.com/opengeos/GeoLibre/releases/tag/v1.6.0");
  });

  it("picks the highest version instead of trusting the list order", async () => {
    stubPayload([release("v0.1.0"), release("v0.2.0"), release("v0.1.9")]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.version, "v0.2.0");
  });

  it("reads prereleases instead of letting the API filter them out", async () => {
    // The state of this repository when the bug was found: every release is
    // flagged prerelease, so `/releases/latest` answered 404 and the app could
    // never see an update at all.
    stubPayload([release("v0.1.1-rc1"), release("v0.1.0")]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.version, "v0.1.1-rc1");
  });

  it("skips drafts, which cannot be downloaded", async () => {
    stubPayload([release("v0.3.0", { draft: true }), release("v0.2.0")]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.version, "v0.2.0");
  });

  it("ignores tags that are not semantic versions", async () => {
    stubPayload([release("nightly"), release("v0.3"), release("v0.2.0")]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.version, "v0.2.0");
  });

  it("falls back to the downloads page for a non-GitHub html_url", async () => {
    stubPayload([release("v1.6.0", { html_url: "http://evil.example" })]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.url, UPDATE_URL);
  });

  it("falls back to the downloads page when html_url is absent", async () => {
    stubPayload([{ tag_name: "v1.6.0" }]);
    const latest = await fetchLatestRelease();
    assert.equal(latest.url, UPDATE_URL);
    assert.equal(latest.notes, "");
  });

  it("wraps a malformed 200 body as a network error", async () => {
    globalThis.fetch = (async () => new Response("{ not json", { status: 200 })) as typeof fetch;
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "network");
      return true;
    });
  });

  it("rejects a payload that is not a release list", async () => {
    stubPayload({ message: "Not Found" });
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "network");
      return true;
    });
  });

  it("reports an exhausted rate limit", async () => {
    globalThis.fetch = (async () =>
      new Response("", {
        status: 403,
        headers: { "X-RateLimit-Remaining": "0" },
      })) as typeof fetch;
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "rateLimit");
      return true;
    });
  });

  it("treats a 429 secondary rate limit as a rate limit error", async () => {
    globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "rateLimit");
      return true;
    });
  });

  it("flags a list with no usable version tag", async () => {
    stubPayload([{ body: "no tag" }, release("nightly")]);
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "noTag");
      return true;
    });
  });

  it("flags an empty release list", async () => {
    stubPayload([]);
    await assert.rejects(fetchLatestRelease(), (error: unknown) => {
      assert.ok(error instanceof UpdateCheckError);
      assert.equal(error.code, "noTag");
      return true;
    });
  });
});
