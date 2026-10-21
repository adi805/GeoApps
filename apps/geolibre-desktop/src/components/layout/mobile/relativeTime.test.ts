import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relativeOpenedAt } from "./relativeTime";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");

/** An ISO timestamp `seconds` before the pinned clock. */
function before(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

describe("relativeOpenedAt", () => {
  it("describes the last minute in seconds", () => {
    assert.equal(relativeOpenedAt(before(30), "en", NOW), "30 seconds ago");
  });

  it("describes the last hour in minutes", () => {
    assert.equal(relativeOpenedAt(before(2 * 60), "en", NOW), "2 minutes ago");
  });

  it("describes the last day in hours", () => {
    assert.equal(relativeOpenedAt(before(2 * 3600), "en", NOW), "2 hours ago");
  });

  it("describes the last week in days", () => {
    assert.equal(relativeOpenedAt(before(3 * 86400), "en", NOW), "3 days ago");
  });

  it("uses weeks and months for old timestamps instead of a day count", () => {
    // The E2E seed is pinned to January, so by late October it is ~293 days old.
    // Stopping at days, as the layer panel's helper does, would print "293 days ago".
    const seeded = "2026-01-01T00:00:00.000Z";
    assert.equal(relativeOpenedAt(seeded, "en", NOW), "10 months ago");
    assert.equal(relativeOpenedAt(before(14 * 86400), "en", NOW), "2 weeks ago");
    // `numeric: "auto"` says "last year" rather than "1 year ago".
    assert.equal(relativeOpenedAt(before(400 * 86400), "en", NOW), "last year");
  });

  it("localizes the phrase for the Indonesian UI", () => {
    assert.equal(relativeOpenedAt(before(2 * 3600), "id", NOW), "2 jam yang lalu");
  });

  it("describes a timestamp in the future when the clock has drifted", () => {
    assert.equal(relativeOpenedAt(new Date(NOW + 2 * 3600 * 1000).toISOString(), "en", NOW), "in 2 hours");
  });

  it("returns the raw value when the timestamp cannot be parsed", () => {
    assert.equal(relativeOpenedAt("not-a-date", "en", NOW), "not-a-date");
    assert.equal(relativeOpenedAt("", "en", NOW), "");
  });
});
