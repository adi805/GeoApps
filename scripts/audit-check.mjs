// CI dependency gate: `npm audit --omit=dev` with a documented, expiring allowlist.
// Run with: node scripts/audit-check.mjs  (or `npm run audit:ci`)
//
// Plain `npm audit --audit-level=high` has no way to accept a single advisory, so
// one unpatchable transitive finding reddens every PR until upstream ships a fix.
// This keeps the gate blocking on high/critical and keeps that escape hatch — but
// an escape hatch nobody prunes is not a gate, so every entry now expires and an
// entry that is no longer reported is a failure instead of a warning.
//
// Both entries this file used to carry had rotted. node-forge
// (GHSA-86w9-cpqp-85rv) was allowlisted as "no patched version exists" when 1.4.0
// was the latest release; 1.4.3 has since shipped and clears all 21 advisories
// that covered 1.4.0, so the dependency is upgraded instead. braces
// (GHSA-vfj7-8cjw-p6xm) is not reported at all any more. Deleting them both left
// the allowlist empty, which is the only state that needs no maintenance.
//
// Rules for adding an entry: there must be no patched version available, the
// vulnerable code must not reach a GeoLibre runtime path, the reason has to say
// why on both counts, and `expires` has to name the date you will look again.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Severities that fail the build. Moderate/low are left to Dependabot PRs.
const BLOCKING = new Set(["high", "critical"]);

// Shape: [ghsaId, { reason, expires }]. Empty is the goal, not an oversight.
const ALLOWLIST = new Map([]);

// Tests and offline reproductions replay a recorded report through this variable.
// CI never sets it, so the gate always asks npm for a live answer there.
const REPLAY = process.env.AUDIT_CHECK_REPORT;

let audit;
if (REPLAY) {
  try {
    audit = { stdout: readFileSync(REPLAY, "utf8") };
  } catch (e) {
    console.error(`AUDIT_CHECK_REPORT could not be read: ${e.message}`);
    process.exit(1);
  }
} else {
  audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    // npm is npm.cmd on Windows, which Node will not resolve without a shell.
    shell: process.platform === "win32",
  });
}

// The gate must fail closed: anything short of a report we can actually read is
// an error, never an implicit "clean". npm's exit code can't carry that, since
// it also goes non-zero merely because vulnerabilities exist — so the report
// itself is the signal.
function unusable(why, detail) {
  console.error(`npm audit did not return a usable report: ${why}`);
  if (detail) console.error(detail);
  process.exit(1);
}

if (audit.error) unusable("npm could not be run.", audit.error.message);
if (audit.signal) unusable(`npm was killed by ${audit.signal}.`, audit.stderr);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  unusable("stdout was not JSON.", audit.stdout || audit.stderr);
}

// A registry outage, an auth failure or an npm internal error still prints valid
// JSON — but an `{error, message}` envelope with no `vulnerabilities` key rather
// than a report. Left unchecked, `report.vulnerabilities ?? {}` would read that
// as zero advisories and pass the gate exactly when the audit did not run.
if (report === null || typeof report !== "object" || Array.isArray(report)) {
  unusable("stdout was JSON but not an object.", audit.stdout);
}
if (report.error) {
  // A registry outage fills the top-level `message` and leaves `error.summary`
  // and `error.detail` empty strings; other npm errors do the reverse. Try all
  // three so the failure output carries whichever one npm populated.
  unusable(
    "npm reported an error.",
    report.error.detail || report.error.summary || report.message || audit.stderr,
  );
}
// Arrays are typeof "object" too, and an array would yield zero entries below
// rather than an error — so a malformed report would read as clean.
if (
  typeof report.vulnerabilities !== "object" ||
  report.vulnerabilities === null ||
  Array.isArray(report.vulnerabilities)
) {
  unusable("the report has no `vulnerabilities` section.", audit.stdout);
}

// Flatten the report to one entry per advisory. `via` holds advisory objects for
// the package that actually carries the flaw, and plain package-name strings for
// the dependents that only inherit it — so collecting the objects covers every
// affected package without counting the same advisory once per dependent.
const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities)) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object") continue;
    // Fail closed on an advisory we cannot name: fall back to a key built from
    // whatever npm did give us. It can never match an ALLOWLIST entry (those are
    // GHSA ids), so a high/critical one still blocks instead of being dropped.
    const id =
      /(GHSA-[\w-]+)/.exec(via.url ?? "")?.[1] ??
      `unidentified advisory (${via.url ?? via.source ?? via.name})`;
    const entry = advisories.get(id) ?? {
      title: via.title,
      severity: via.severity,
      url: via.url,
      packages: new Set(),
      direct: false,
    };
    entry.packages.add(via.name);
    // A finding on a package the repo depends on directly is always actionable:
    // bump the range. Only a transitive, unreachable leaf earns an allowlist.
    entry.direct ||= Boolean(vuln.isDirect);
    advisories.set(id, entry);
  }
}

// The allowlist is validated before the report is judged, so a broken or expired
// entry fails the same PR that would otherwise have been waved through by it.
const problems = [];
const now = Date.now();
for (const [id, entry] of ALLOWLIST) {
  if (entry === null || typeof entry !== "object") {
    problems.push(`${id}: entry must be { reason, expires }`);
    continue;
  }
  if (typeof entry.reason !== "string" || entry.reason.trim().length < 40) {
    problems.push(
      `${id}: \`reason\` must state why no patched version exists AND why the vulnerable code is unreachable`,
    );
  }
  if (
    typeof entry.expires !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) ||
    Number.isNaN(Date.parse(entry.expires))
  ) {
    problems.push(`${id}: \`expires\` must be a YYYY-MM-DD date`);
  } else if (Date.parse(`${entry.expires}T23:59:59Z`) < now) {
    problems.push(
      `${id}: allowlist entry expired on ${entry.expires} — re-check the advisory, then delete it or re-justify it with a new date`,
    );
  }
}

const blocking = [...advisories].filter(
  ([id, a]) => BLOCKING.has(a.severity) && !ALLOWLIST.has(id),
);
const allowed = [...advisories].filter(([id]) => ALLOWLIST.has(id));
const ignored = [...advisories].filter(([, a]) => !BLOCKING.has(a.severity));

for (const [id] of allowed) {
  if (!advisories.has(id)) continue;
  if (advisories.get(id).direct) {
    problems.push(
      `${id}: affects a direct dependency — bump its range instead of allowlisting it`,
    );
  }
  if (advisories.get(id).severity === "critical") {
    problems.push(`${id}: critical advisories are never allowlisted`);
  }
}

// A stale entry is a failure, not a warning. It means nobody looked at the
// advisory after it stopped being reported, which is exactly how this file ended
// up carrying two entries that no longer described reality.
for (const id of ALLOWLIST.keys()) {
  if (!advisories.has(id)) {
    problems.push(`${id}: allowlisted but no longer reported — delete the entry`);
  }
}

for (const [id, a] of allowed) {
  const entry = ALLOWLIST.get(id);
  console.log(
    `allowed  ${String(a.severity).padEnd(8)} ${id}  ${[...a.packages].join(", ")}  (until ${entry?.expires ?? "?"})`,
  );
  if (entry?.reason) console.log(`         ${entry.reason}`);
}

if (ignored.length > 0) {
  const counts = {};
  for (const [, a] of ignored) counts[a.severity] = (counts[a.severity] ?? 0) + 1;
  const ringkas = Object.entries(counts)
    .map(([sev, n]) => `${n} ${sev}`)
    .join(", ");
  console.log(`\n${ignored.length} moderate/low advisor${ignored.length === 1 ? "y" : "ies"} not blocking (${ringkas}) — Dependabot's job.`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} allowlist problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nThe allowlist in scripts/audit-check.mjs has to describe the world as it is today.");
  process.exit(1);
}

if (blocking.length === 0) {
  console.log(`\nNo unallowed high/critical advisories (${allowed.length} allowlisted).`);
  process.exit(0);
}

// Grouped per package: 21 advisories on one leaf is one decision (upgrade it),
// not 21 separate ones, and 21 lines of the same fix is how the output gets
// scrolled past instead of read.
const byPackage = new Map();
for (const [id, a] of blocking) {
  for (const pkg of a.packages) {
    const list = byPackage.get(pkg) ?? [];
    list.push({ id, severity: a.severity, title: a.title, url: a.url });
    byPackage.set(pkg, list);
  }
}

console.error(
  `\n${blocking.length} unallowed high/critical advisor${blocking.length === 1 ? "y" : "ies"} across ${byPackage.size} package${byPackage.size === 1 ? "" : "s"}:`,
);
for (const [pkg, list] of byPackage) {
  const high = list.filter((x) => x.severity === "high").length;
  const critical = list.length - high;
  const parts = [high > 0 ? `${high} high` : "", critical > 0 ? `${critical} critical` : ""]
    .filter(Boolean)
    .join(", ");
  console.error(`\n  ${pkg} — ${parts}`);
  for (const a of list) {
    console.error(`    ${a.severity.padEnd(8)} ${a.id}  ${a.title}`);
    if (a.url) console.error(`             ${a.url}`);
  }
}
console.error("\nUpgrade the dependency, or add a justified, expiring entry to ALLOWLIST in scripts/audit-check.mjs.");
process.exit(1);
