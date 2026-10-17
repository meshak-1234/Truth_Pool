#!/usr/bin/env node
/**
 * Truth Pool — Fandom Badge Configuration Validator
 * Run: node scripts/validate_fandom_badges.js
 *
 * Checks:
 *  1. JSON parses successfully.
 *  2. Exactly 22 badges exist.
 *  3. Exactly 11 fandoms are represented.
 *  4. Each fandom has exactly two badges (tier 1 and tier 2).
 *  5. All badge_ids are unique.
 *  6. Tier 1 requires exactly 100 questions.
 *  7. Tier 2 requires exactly 200 questions.
 *  8. Every fandom_id maps to a real dataset file in data/.
 *  9. Every required field is present and non-empty.
 * 10. total_questions is 200 for every badge.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const BADGE_FILE  = path.join(ROOT, 'data', 'fandom_badges.json');
const DATA_DIR    = path.join(ROOT, 'data');

// --- Colour helpers (safe fallback when colours unsupported) --------
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function pass(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg) { console.error(`  ${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`  ${YELLOW}ℹ${RESET} ${msg}`); }

// --- Required fields on every badge ---------------------------------
const REQUIRED_FIELDS = [
  'fandom_id',
  'dataset_file',
  'badge_id',
  'badge_tier',
  'title',
  'description',
  'required_questions',
  'total_questions',
  'visual_theme',
  'icon',
  'unlock_condition'
];

// --- Expected datasets mapped to the actual files in data/ ----------
// fandom_id value (from JSON category field) -> dataset filename
const DATASET_MAP = {
  'Ben 10'          : 'ben_10_combined.json',
  'Bleach'          : 'bleach_combined.json',
  'DC Universe'     : 'dc_combined.json',
  'Demon Slayer'    : 'demon_slayer_combined.json',
  'Dragon Ball'     : 'dragon_ball_combined.json',
  'Game of Thrones' : 'game_of_thrones_combined.json',
  'Marvel Universe' : 'marvel_combined.json',
  'My Hero Academia': 'my_hero_academia_combined.json',
  'Naruto'          : 'naruto_combined.json',
  'One Piece'       : 'one_piece_combined.json',
  'The Boys'        : 'the_boys_combined.json'
};

const EXPECTED_FANDOM_COUNT = 11;
const EXPECTED_BADGE_COUNT  = 22;
const TIER1_REQUIRED        = 100;
const TIER2_REQUIRED        = 200;
const TOTAL_QUESTIONS       = 200;

// ====================================================================
// Main
// ====================================================================
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    pass(label);
    passed++;
  } else {
    fail(label + (detail ? ` — ${detail}` : ''));
    failed++;
  }
}

console.log();
console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  TRUTH POOL — FANDOM BADGE CONFIGURATION VALIDATOR${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
console.log();

// --------------------------------------------------------------------
// [1] JSON parsing
// --------------------------------------------------------------------
console.log(`${BOLD}[1] JSON Parse${RESET}`);
let badges;
try {
  const raw = fs.readFileSync(BADGE_FILE, 'utf-8');
  badges = JSON.parse(raw);
  check('fandom_badges.json is valid JSON', true);
  check('Top-level value is an array', Array.isArray(badges));
} catch (e) {
  check('fandom_badges.json is valid JSON', false, e.message);
  process.exit(1);
}
console.log();

// --------------------------------------------------------------------
// [2] Badge count
// --------------------------------------------------------------------
console.log(`${BOLD}[2] Badge Count${RESET}`);
check(
  `Exactly ${EXPECTED_BADGE_COUNT} badges exist`,
  badges.length === EXPECTED_BADGE_COUNT,
  `Found ${badges.length}`
);
console.log();

// --------------------------------------------------------------------
// [3] Required fields on every badge
// --------------------------------------------------------------------
console.log(`${BOLD}[3] Required Fields${RESET}`);
let missingFields = 0;
for (const badge of badges) {
  for (const field of REQUIRED_FIELDS) {
    const present = field in badge && badge[field] !== null && badge[field] !== '';
    if (!present) {
      fail(`badge_id="${badge.badge_id || '?'}" missing field "${field}"`);
      failed++;
      missingFields++;
    }
  }
}
if (missingFields === 0) {
  check('All badges have every required field', true);
  passed++;
} else {
  // individual failures already logged above
}
console.log();

// --------------------------------------------------------------------
// [4] Fandom coverage
// --------------------------------------------------------------------
console.log(`${BOLD}[4] Fandom Coverage${RESET}`);
const byFandom = {};
for (const badge of badges) {
  const fid = badge.fandom_id;
  if (!byFandom[fid]) byFandom[fid] = [];
  byFandom[fid].push(badge);
}

const foundFandoms = Object.keys(byFandom);
check(
  `Exactly ${EXPECTED_FANDOM_COUNT} fandoms represented`,
  foundFandoms.length === EXPECTED_FANDOM_COUNT,
  `Found ${foundFandoms.length}: ${foundFandoms.join(', ')}`
);

for (const [fid, bs] of Object.entries(byFandom)) {
  check(
    `Fandom "${fid}" has exactly 2 badges`,
    bs.length === 2,
    `Found ${bs.length}`
  );
}
console.log();

// --------------------------------------------------------------------
// [5] Unique badge_ids
// --------------------------------------------------------------------
console.log(`${BOLD}[5] Unique badge_ids${RESET}`);
const idSet = new Set();
let dupeIds = [];
for (const badge of badges) {
  if (idSet.has(badge.badge_id)) dupeIds.push(badge.badge_id);
  idSet.add(badge.badge_id);
}
check(
  'All badge_ids are unique',
  dupeIds.length === 0,
  dupeIds.length > 0 ? `Duplicates: ${dupeIds.join(', ')}` : ''
);
console.log();

// --------------------------------------------------------------------
// [6] Tier thresholds
// --------------------------------------------------------------------
console.log(`${BOLD}[6] Tier Thresholds${RESET}`);
for (const badge of badges) {
  if (badge.badge_tier === 1) {
    check(
      `"${badge.badge_id}" (tier 1) requires_questions = ${TIER1_REQUIRED}`,
      badge.required_questions === TIER1_REQUIRED,
      `Got ${badge.required_questions}`
    );
  } else if (badge.badge_tier === 2) {
    check(
      `"${badge.badge_id}" (tier 2) required_questions = ${TIER2_REQUIRED}`,
      badge.required_questions === TIER2_REQUIRED,
      `Got ${badge.required_questions}`
    );
  } else {
    check(`"${badge.badge_id}" has valid tier (1 or 2)`, false, `Got ${badge.badge_tier}`);
  }
}
console.log();

// --------------------------------------------------------------------
// [7] total_questions = 200 everywhere
// --------------------------------------------------------------------
console.log(`${BOLD}[7] total_questions${RESET}`);
for (const badge of badges) {
  check(
    `"${badge.badge_id}" total_questions = ${TOTAL_QUESTIONS}`,
    badge.total_questions === TOTAL_QUESTIONS,
    `Got ${badge.total_questions}`
  );
}
console.log();

// --------------------------------------------------------------------
// [8] fandom_id maps to a real dataset file in data/
// --------------------------------------------------------------------
console.log(`${BOLD}[8] Dataset File Existence${RESET}`);
for (const badge of badges) {
  const expectedFile = DATASET_MAP[badge.fandom_id];
  if (!expectedFile) {
    check(
      `fandom_id "${badge.fandom_id}" is a known fandom`,
      false,
      'Not in DATASET_MAP'
    );
    continue;
  }
  check(
    `fandom_id "${badge.fandom_id}" -> "${expectedFile}" declared in badge`,
    badge.dataset_file === expectedFile,
    `Badge has "${badge.dataset_file}"`
  );
  const filePath = path.join(DATA_DIR, expectedFile);
  check(
    `Dataset file "${expectedFile}" exists on disk`,
    fs.existsSync(filePath)
  );
}
console.log();

// --------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------
console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  RESULTS: ${passed} passed  |  ${failed} failed${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
console.log();

if (failed === 0) {
  console.log(`${GREEN}${BOLD}✅  All badge configuration checks passed.${RESET}`);
  console.log();
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}⚠️   ${failed} check(s) failed — see above.${RESET}`);
  console.log();
  process.exit(1);
}
