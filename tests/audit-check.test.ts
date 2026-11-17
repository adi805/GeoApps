import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("../scripts/audit-check.mjs", import.meta.url));
const CLEAN = fileURLToPath(new URL("./fixtures/audit-report-clean.json", import.meta.url));
const HIGH = fileURLToPath(new URL("./fixtures/audit-report-high.json", import.meta.url));

const REASON =
  "No patched version exists and the vulnerable code is unreachable from any GeoLibre runtime path.";

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Replays a recorded audit report, so the gate's verdict is tested without a
// registry call and without depending on which advisories exist today.
function run(report: string, script = SCRIPT): Run {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, AUDIT_CHECK_REPORT: report },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function tempFile(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "audit-check-"));
  const file = join(dir, name);
  writeFileSync(file, contents);
  return file;
}

// The allowlist is a literal in the script, so a variant with entries is made by
// rewriting that one line into a copy. Anything else would mean shipping a hook
// whose only purpose is letting tests change the gate's policy.
function scriptWithAllowlist(entries: string): string {
  // Matched as a pattern, not a literal: the real script carries its own entries,
  // and a test helper that only recognises an empty allowlist would fail the
  // moment the gate legitimately needs one.
  const marker = /const ALLOWLIST = new Map\(\[[\s\S]*?\]\);/;
  const source = readFileSync(SCRIPT, "utf8");
  assert.ok(marker.test(source), "ALLOWLIST marker moved — update this test");
  return tempFile("audit-check.mjs", source.replace(marker, `const ALLOWLIST = new Map([${entries}]);`));
}

function reportWithDirectDependency(): string {
  const report = JSON.parse(readFileSync(HIGH, "utf8")) as {
    vulnerabilities: Record<string, { isDirect: boolean }>;
  };
  for (const vuln of Object.values(report.vulnerabilities)) vuln.isDirect = true;
  return tempFile("audit-report-direct.json", JSON.stringify(report));
}

describe("audit-check", () => {
  // These two judge the verdict on a report, so they run against an empty
  // allowlist. The shipped script's own entries describe today's advisories and
  // would show up as stale against a fixture recorded on a different day.
  it("passes a clean report", () => {
    const result = run(CLEAN, scriptWithAllowlist(""));
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No unallowed high\/critical advisories/);
  });

  it("fails on a high advisory that is not allowlisted", () => {
    const result = run(HIGH, scriptWithAllowlist(""));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /node-forge — 1 high/);
    assert.match(result.stderr, /GHSA-86w9-cpqp-85rv/);
  });

  it("passes when the advisory is allowlisted and the entry is current", () => {
    const script = scriptWithAllowlist(
      `["GHSA-86w9-cpqp-85rv", { reason: ${JSON.stringify(REASON)}, expires: "2999-12-31" }]`,
    );
    const result = run(HIGH, script);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /allowed\s+high\s+GHSA-86w9-cpqp-85rv/);
  });

  it("fails when the allowlist entry has expired", () => {
    const script = scriptWithAllowlist(
      `["GHSA-86w9-cpqp-85rv", { reason: ${JSON.stringify(REASON)}, expires: "2020-01-01" }]`,
    );
    const result = run(HIGH, script);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /expired on 2020-01-01/);
  });

  it("fails when an allowlist entry is no longer reported", () => {
    const script = scriptWithAllowlist(
      `["GHSA-0000-0000-0000", { reason: ${JSON.stringify(REASON)}, expires: "2999-12-31" }]`,
    );
    const result = run(CLEAN, script);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no longer reported — delete the entry/);
  });

  it("fails when an allowlist entry names a direct dependency", () => {
    const script = scriptWithAllowlist(
      `["GHSA-86w9-cpqp-85rv", { reason: ${JSON.stringify(REASON)}, expires: "2999-12-31" }]`,
    );
    const result = run(reportWithDirectDependency(), script);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /affects a direct dependency/);
  });

  it("fails closed when the report cannot be read", () => {
    const result = run(join(tmpdir(), "audit-report-does-not-exist.json"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AUDIT_CHECK_REPORT could not be read/);
  });

  it("fails closed when the report has no vulnerabilities section", () => {
    const result = run(tempFile("audit-report-broken.json", '{"error":{"summary":"registry down"}}'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm reported an error/);
  });
});
