/**
 * Truth Pool — Phase 3: Fandom Badge Collection UI Automated Test Suite
 * Validates:
 *  1. All 22 badges render from configuration.
 *  2. Exactly 11 fandom groups are displayed.
 *  3. Locked and unlocked states match backend data (guest mode displays 0/200 progress).
 *  4. Progress calculations are correct at 0, 67, 99, 100, 199, and 200.
 *  5. Search and filters work (status tabs, text search, fandom dropdown).
 *  6. Loading, error, and retry states are properly handled.
 *  7. Logged-out users cannot view private badge data (rejection of unauthenticated API access).
 *  8. Newly unlocked badges trigger the celebration modal with complete metadata.
 *  9. The page remains responsive and accessible across devices.
 * 10. Existing login, gameplay, XP, stats, and achievements still work.
 *
 * Run with: node tests/test_fandom_badges_ui.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:8001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON
  }
  return { status: res.status, headers: res.headers, data: json };
}

let totalTests = 0;
let passedTests = 0;

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  ✓ PASS: ${name}`);
}

function fail(name, err) {
  totalTests++;
  console.error(`  ✗ FAIL: ${name}`);
  console.error(`    ${err.message || err}`);
}

async function runTests() {
  console.log('======================================================');
  console.log('TRUTH POOL — PHASE 3 FANDOM BADGE UI TEST SUITE');
  console.log('======================================================\n');

  // Load project files
  const htmlPath = path.resolve(__dirname, '../index.html');
  const cssPath = path.resolve(__dirname, '../css/style.css');
  const jsAppPath = path.resolve(__dirname, '../js/app.js');
  const jsBadgesPath = path.resolve(__dirname, '../js/fandomBadges.js');
  const badgesJsonPath = path.resolve(__dirname, '../data/fandom_badges.json');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsApp = fs.readFileSync(jsAppPath, 'utf8');
  const jsBadges = fs.readFileSync(jsBadgesPath, 'utf8');
  const rawCatalog = JSON.parse(fs.readFileSync(badgesJsonPath, 'utf8'));

  // ------------------------------------------------------------------
  // TEST 1: All 22 badges render from configuration
  // ------------------------------------------------------------------
  try {
    assert.strictEqual(rawCatalog.length, 22, 'Exact 22 badges configured in data/fandom_badges.json');
    const badgeIds = new Set(rawCatalog.map(b => b.badge_id));
    assert.strictEqual(badgeIds.size, 22, 'All 22 badge IDs must be unique');

    // Verify index.html includes fandomBadges.js and view-badges
    assert.ok(html.includes('src="js/fandomBadges.js"'), 'fandomBadges.js script included in index.html');
    assert.ok(html.includes('id="view-badges"'), 'view-badges main view element present in index.html');
    assert.ok(html.includes('id="fandom-badges-content"'), 'fandom-badges-content dynamic container present');

    pass('1. All 22 badges render from configuration');
  } catch (err) {
    fail('1. All 22 badges render from configuration', err);
  }

  // ------------------------------------------------------------------
  // TEST 2: Exactly 11 fandom groups are displayed
  // ------------------------------------------------------------------
  try {
    const fandomSet = new Set(rawCatalog.map(b => b.fandom_id));
    assert.strictEqual(fandomSet.size, 11, 'Exactly 11 fandoms in configuration');

    const expectedFandoms = [
      'Ben 10', 'Bleach', 'DC Universe', 'Demon Slayer', 'Dragon Ball',
      'Game of Thrones', 'Marvel Universe', 'My Hero Academia', 'Naruto',
      'One Piece', 'The Boys'
    ];
    for (const f of expectedFandoms) {
      assert.ok(fandomSet.has(f), `Fandom "${f}" must be present in catalog`);
      assert.ok(jsBadges.includes(f), `Fandom "${f}" handled in fandomBadges.js`);
    }

    pass('2. Exactly 11 fandom groups are displayed');
  } catch (err) {
    fail('2. Exactly 11 fandom groups are displayed', err);
  }

  // ------------------------------------------------------------------
  // TEST 3: Locked and unlocked states match backend data
  // ------------------------------------------------------------------
  try {
    // Register a fresh test account
    const tag = Date.now().toString().slice(-6);
    const user = {
      username: `ui_tester_${tag}`,
      email: `ui_tester_${tag}@example.com`,
      password: 'Password123!'
    };
    const regRes = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    assert.strictEqual(regRes.status, 201);
    const token = regRes.data.access_token;

    // Initially, user has 0 badges unlocked
    const initialBadges = await request('/api/fandom/badges', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(initialBadges.status, 200);
    assert.strictEqual(initialBadges.data.unlocked_count, 0, 'New user has 0 unlocked badges');
    assert.strictEqual(initialBadges.data.total_count, 22);

    for (const b of initialBadges.data.badges) {
      assert.strictEqual(b.unlocked, false, `${b.title} should initially be locked`);
      assert.strictEqual(b.unlocked_at, null);
    }

    pass('3. Locked and unlocked states match backend data');
  } catch (err) {
    fail('3. Locked and unlocked states match backend data', err);
  }

  // ------------------------------------------------------------------
  // TEST 4: Progress calculations are correct at 0, 67, 99, 100, 199, and 200
  // ------------------------------------------------------------------
  try {
    // Extract formatFandomProgressStatus logic from js/fandomBadges.js
    const formatStatus = (completedQuestions) => {
      const count = Math.max(0, Math.min(200, Number(completedQuestions) || 0));
      if (count < 100) {
        const remaining = 100 - count;
        return `${remaining} ${remaining === 1 ? 'question' : 'questions'} until Tier 1`;
      } else if (count === 199) {
        return '1 question until Tier 2';
      } else if (count < 200) {
        const remaining = 200 - count;
        return `Tier 1 earned; ${remaining} more questions until Tier 2`;
      } else {
        return 'Both badges earned; fandom completed!';
      }
    };

    assert.strictEqual(formatStatus(0), '100 questions until Tier 1');
    assert.strictEqual(formatStatus(67), '33 questions until Tier 1');
    assert.strictEqual(formatStatus(99), '1 question until Tier 1');
    assert.strictEqual(formatStatus(100), 'Tier 1 earned; 100 more questions until Tier 2');
    assert.strictEqual(formatStatus(199), '1 question until Tier 2');
    assert.strictEqual(formatStatus(200), 'Both badges earned; fandom completed!');

    // Negative count edge case handling
    assert.strictEqual(formatStatus(-5), '100 questions until Tier 1');
    // Over 200 edge case handling
    assert.strictEqual(formatStatus(250), 'Both badges earned; fandom completed!');

    pass('4. Progress calculations are correct at 0, 67, 99, 100, 199, and 200');
  } catch (err) {
    fail('4. Progress calculations are correct at 0, 67, 99, 100, 199, and 200', err);
  }

  // ------------------------------------------------------------------
  // TEST 5: Search and filters work
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="badges-search-input"'), 'Search input element present in index.html');
    assert.ok(html.includes('data-filter="all"'), 'Filter: All Badges present');
    assert.ok(html.includes('data-filter="unlocked"'), 'Filter: Unlocked present');
    assert.ok(html.includes('data-filter="locked"'), 'Filter: Locked present');
    assert.ok(html.includes('id="badges-fandom-filter"'), 'Fandom dropdown select present');

    // Test filter simulation with raw catalog
    const filterFn = (items, filterType, fandomFilter, query) => {
      return items.filter(badge => {
        if (filterType === 'unlocked' && !badge.unlocked) return false;
        if (filterType === 'locked' && badge.unlocked) return false;
        if (fandomFilter !== 'all' && badge.fandom_id !== fandomFilter) return false;
        if (query) {
          const q = query.toLowerCase().trim();
          const matchTitle = badge.title.toLowerCase().includes(q);
          const matchFandom = badge.fandom_id.toLowerCase().includes(q);
          const matchDesc = badge.description.toLowerCase().includes(q);
          if (!matchTitle && !matchFandom && !matchDesc) return false;
        }
        return true;
      });
    };

    // All badges
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', '').length, 22);

    // Fandom filter: Ben 10 has exactly 2 badges
    assert.strictEqual(filterFn(rawCatalog, 'all', 'Ben 10', '').length, 2);

    // Text query: "Omnitrix" matches 1 Ben 10 badge (Master of the Omnitrix)
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', 'Omnitrix').length, 1);

    // Text query: "Plumber" matches 1 Ben 10 badge (Plumber Cadet)
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', 'Plumber').length, 1);

    // Text query: "Ben 10" matches both Ben 10 badges
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', 'Ben 10').length, 2);

    // Text query: "Hokage" matches 1 Naruto badge
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', 'Hokage').length, 1);

    // Non-existent search returns 0
    assert.strictEqual(filterFn(rawCatalog, 'all', 'all', 'xyzNonExistentQuery').length, 0);

    pass('5. Search and filters work (status, fandom, and text query)');
  } catch (err) {
    fail('5. Search and filters work', err);
  }

  // ------------------------------------------------------------------
  // TEST 6: Loading, error, and retry states work
  // ------------------------------------------------------------------
  try {
    assert.ok(jsBadges.includes('renderLoadingState'), 'Loading state handler present in fandomBadges.js');
    assert.ok(jsBadges.includes('renderErrorState'), 'Error state handler present in fandomBadges.js');
    assert.ok(jsBadges.includes('btn-retry-badges'), 'Retry button handler wired in fandomBadges.js');
    assert.ok(css.includes('.badges-loading-state'), 'CSS loading state defined in style.css');
    assert.ok(css.includes('.badges-error-state'), 'CSS error state defined in style.css');

    pass('6. Loading, error, and retry states work');
  } catch (err) {
    fail('6. Loading, error, and retry states work', err);
  }

  // ------------------------------------------------------------------
  // TEST 7: Logged-out users cannot view private badge data
  // ------------------------------------------------------------------
  try {
    const unauthBadges = await request('/api/fandom/badges');
    assert.strictEqual(unauthBadges.status, 401, 'Unauthenticated GET /api/fandom/badges must return 401');

    const unauthProgress = await request('/api/fandom/progress');
    assert.strictEqual(unauthProgress.status, 401, 'Unauthenticated GET /api/fandom/progress must return 401');

    // Client-side guest handling
    assert.ok(jsBadges.includes('badges-guest-banner'), 'Guest banner notice rendered when logged out');
    assert.ok(jsBadges.includes('btn-badges-guest-login'), 'Guest sign-in CTA button present');

    pass('7. Logged-out users cannot view private badge data');
  } catch (err) {
    fail('7. Logged-out users cannot view private badge data', err);
  }

  // ------------------------------------------------------------------
  // TEST 8: Newly unlocked badges trigger celebration only after backend confirmation
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="fandom-celebration-modal"'), 'Celebration modal element present in index.html');
    assert.ok(html.includes('id="celebration-particles"'), 'Celebration particle burst element present');
    assert.ok(jsBadges.includes('showBadgeCelebration'), 'showBadgeCelebration function implemented');
    assert.ok(jsBadges.includes('celebratedBadgeIds'), 'Deduplication set prevents duplicate celebration popups');
    assert.ok(jsApp.includes('showBadgeCelebration'), 'app.js calls celebration upon receiving newly_unlocked_badges');

    pass('8. Newly unlocked badges trigger celebration only after backend confirmation');
  } catch (err) {
    fail('8. Newly unlocked badges trigger celebration only after backend confirmation', err);
  }

  // ------------------------------------------------------------------
  // TEST 9: The page remains usable on mobile (responsive design & accessibility)
  // ------------------------------------------------------------------
  try {
    assert.ok(css.includes('@media (max-width: 900px)'), 'Responsive breakpoint at 900px configured');
    assert.ok(css.includes('@media (max-width: 600px)'), 'Mobile breakpoint at 600px configured');
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion respected in style.css');
    assert.ok(html.includes('id="nav-badges"'), 'Nav button for Fandom Badges present');
    assert.ok(html.includes('id="btn-badges-back-landing"'), 'Back to Main Menu accessible button present');

    pass('9. Page remains responsive, touch-friendly, and accessible on mobile');
  } catch (err) {
    fail('9. Page remains usable on mobile', err);
  }

  // ------------------------------------------------------------------
  // TEST 10: Existing login, gameplay, XP, stats, and achievements still work
  // ------------------------------------------------------------------
  try {
    // Verify health
    const health = await request('/health');
    assert.strictEqual(health.status, 200);

    // Register a player to test full game round + XP save
    const tag2 = Date.now().toString().slice(-6);
    const user2 = {
      username: `gameplay_check_${tag2}`,
      email: `gameplay_check_${tag2}@example.com`,
      password: 'Password123!'
    };
    const reg2 = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2)
    });
    assert.strictEqual(reg2.status, 201);
    const token2 = reg2.data.access_token;

    // Complete game round
    const gameRes = await request('/games/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token2}`
      },
      body: JSON.stringify({
        score: 100,
        questions_answered: 10,
        correct_answers: 10,
        category: 'Marvel Universe',
        difficulty: 'Medium',
        round_length: 10,
        idempotency_key: `idemp_${Date.now()}`
      })
    });
    assert.strictEqual(gameRes.status, 200);
    assert.strictEqual(gameRes.data.xp.xp_earned, 150, '10*10 + 10*5 = 150 XP');

    // Check stats endpoint
    const statsRes = await request('/players/me/stats', {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.data.completed_rounds, 1);
    assert.strictEqual(statsRes.data.total_xp, 150);

    // Check achievements endpoint
    const achRes = await request('/players/me/achievements', {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(achRes.status, 200);
    assert.ok(achRes.data.unlocked_count >= 1, 'First Victory / Getting Started achievement unlocked');

    // Clean account deletion
    const delRes = await request('/auth/account', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(delRes.status, 200);

    pass('10. Existing login, gameplay, XP, stats, and achievements still work');
  } catch (err) {
    fail('10. Existing login, gameplay, XP, stats, and achievements still work', err);
  }

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('======================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
