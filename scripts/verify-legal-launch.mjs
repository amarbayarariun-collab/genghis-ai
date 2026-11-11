#!/usr/bin/env node
/**
 * Cheap checks for Mongolian legal pages + plan copy alignment.
 * No network, no secrets, no spend.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function ok(msg) {
  console.log(`ok  ${msg}`);
}
function fail(msg) {
  failed += 1;
  console.error(`FAIL  ${msg}`);
}

function read(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing file ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
}

const requiredFiles = [
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/components/legal/legal-doc.tsx",
  "src/components/legal/site-legal-links.tsx",
  "docs/LAUNCH_CHECKLIST.md",
  "docs/MERGE_ORDER.md",
];

for (const f of requiredFiles) {
  if (existsSync(join(root, f))) ok(`exists ${f}`);
  else fail(`exists ${f}`);
}

const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const plans = read("src/lib/plans.ts");
const links = read("src/components/legal/site-legal-links.tsx");
const pricing = read("src/components/billing/pricing-checkout.tsx");
const hero = read("src/components/chat/home-hero.tsx");
const auth = read("src/components/chat/auth-account.tsx");
const checklist = read("docs/LAUNCH_CHECKLIST.md");

for (const [label, hay, needle] of [
  ["privacy title", privacy, "Нууцлалын бодлого"],
  ["privacy draft badge source", privacy, "LegalDoc"],
  ["privacy company placeholder", privacy, "[PLACEHOLDER · компанийн албан ёсны нэр]"],
  ["terms title", terms, "Үйлчилгээний нөхцөл"],
  ["terms free tier", terms, "30 мессеж"],
  ["terms free model", terms, "grok-4.3"],
  ["terms pro price", terms, "72,000₮"],
  ["terms pro msgs", terms, "500"],
  ["terms pro images", terms, "10 зураг"],
  ["terms pro model", terms, "grok-4.7"],
  ["terms refund section", terms, "Буцаалт ба цуцлалт"],
  ["terms address placeholder", terms, "[PLACEHOLDER · албан ёсны хаяг]"],
  ["plans free msgs", plans, "messagesPerMonth: 30"],
  ["plans free model", plans, 'chatModel: "grok-4.3"'],
  ["plans paid msgs", plans, "messagesPerMonth: 500"],
  ["plans paid images", plans, "imagesPerMonth: 10"],
  ["plans paid model", plans, 'chatModel: "grok-4.7"'],
  ["plans paid mnt", plans, "priceMnt: 72_000"],
  ["link component privacy", links, 'href="/privacy"'],
  ["link component terms", links, 'href="/terms"'],
  ["pricing footer links", pricing, "SiteLegalLinks"],
  ["landing links", hero, "SiteLegalLinks"],
  ["signup links", auth, "SiteLegalLinks"],
  ["checklist #38", checklist, "#38"],
  ["checklist #42 conflicts", checklist, "known conflicts"],
  ["checklist leave #39", checklist, "#39"],
  ["checklist leave #40", checklist, "#40"],
  ["checklist QPay", checklist, "QPay"],
  ["checklist xAI", checklist, "xAI"],
  ["checklist OAuth", checklist, "GOOGLE_CLIENT_ID"],
]) {
  if (hay.includes(needle)) ok(label);
  else fail(`${label} (need ${JSON.stringify(needle)})`);
}

const draftShell = read("src/components/legal/legal-doc.tsx");
if (draftShell.includes("draft for owner review")) ok("draft banner present");
else fail("draft banner present");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall legal/launch checks passed");
