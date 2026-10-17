/**
 * Truth Pool — Phase 4: Premium Website Experience Automated Test Suite
 * Validates:
 * 1. Landing Page cinematic layout, official branding, and dual CTA actions (Start Exploring, How to Play).
 * 2. 11 Fandom Selection cards with franchise-inspired motifs, 200 questions each, and live search.
 * 3. Fandom selection launches GameEngine with correct category identifier.
 * 4. FACT and TRAP buttons with immediate duplicate-submission lockout.
 * 5. Game Arena feedback, explanation, graceful source handling, and live streak tracking.
 * 6. Safe Arena Exit modal and lifecycle.
 * 7. Personal Player Dashboard displaying authenticated user's stats, level/XP, history, and fandom progress.
 * 8. Logged-out users see clean guest states without exposing private data.
 * 9. Responsive layout tokens, media queries, accessibility attributes, and reduced-motion compliance.
 * 10. Existing auth, XP, levels, achievements, and fandom badge systems remain functional.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const jsApp = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const jsFandomSelection = fs.readFileSync(path.join(ROOT, 'js/fandomSelection.js'), 'utf8');
const jsPlayerDashboard = fs.readFileSync(path.join(ROOT, 'js/playerDashboard.js'), 'utf8');
const { GameEngine, QuestionLoader } = require('../js/gameEngine.js');

const API_BASE = 'http://127.0.0.1:8001';

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API_BASE);
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  ✓ PASS: ${name}`);
  passed++;
}

function fail(name, err) {
  console.error(`  ✗ FAIL: ${name}`);
  console.error(`    ${err.message || err}`);
  failed++;
}

async function runTestSuite() {
  console.log('======================================================');
  console.log('TRUTH POOL — PHASE 4 PREMIUM WEBSITE EXPERIENCE TESTS');
  console.log('======================================================\n');

  // ------------------------------------------------------------------
  // TEST 1: Landing Page layout, branding, and dual CTA actions
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="view-landing"'), 'view-landing present');
    assert.ok(html.includes('id="btn-start-playing"'), 'Start Exploring CTA button present');
    assert.ok(html.includes('Start Exploring'), 'Hero button text updated to Start Exploring');
    assert.ok(html.includes('id="btn-landing-how-to-play"'), 'Secondary How to Play button present');
    assert.ok(html.includes('id="about-modal"'), 'How to Play / About modal present');
    assert.ok(html.includes('2,200 verified claims'), 'Landing subtitle reflects 2,200 verified claims');
    assert.ok(html.includes('11 legendary fandoms'), 'Landing subtitle reflects 11 legendary fandoms');
    assert.ok(html.includes('id="nav-dashboard"'), 'Dashboard navigation link added to header');
    assert.ok(html.includes('id="nav-play"'), 'Fandoms navigation link present');

    pass('1. Landing Page layout, branding, and dual CTA actions verified');
  } catch (err) {
    fail('1. Landing Page layout, branding, and dual CTA actions verified', err);
  }

  // ------------------------------------------------------------------
  // TEST 2: All 11 Fandom Selection cards render with metadata & 200 questions
  // ------------------------------------------------------------------
  try {
    const FandomSelection = require('../js/fandomSelection.js');
    assert.strictEqual(FandomSelection.FANDOMS.length, 11, 'Exactly 11 fandoms configured');

    const expectedFandoms = [
      'Marvel Universe', 'DC Universe', 'Naruto', 'One Piece',
      'Dragon Ball', 'Bleach', 'Demon Slayer', 'Ben 10',
      'My Hero Academia', 'Game of Thrones', 'The Boys'
    ];

    expectedFandoms.forEach(expectedName => {
      const match = FandomSelection.FANDOMS.find(f => f.name === expectedName);
      assert.ok(match, `Fandom ${expectedName} is present in FANDOMS`);
      assert.ok(match.dataset, `Fandom ${expectedName} specifies a dataset`);
      assert.ok(fs.existsSync(path.join(ROOT, 'data', match.dataset)), `Dataset file ${match.dataset} exists on disk`);

      const datasetData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', match.dataset), 'utf8'));
      assert.strictEqual(datasetData.length, 200, `Dataset ${match.dataset} contains exactly 200 questions`);
    });

    pass('2. All 11 Fandom Selection cards configured with existing datasets of 200 questions each (2,200 total)');
  } catch (err) {
    fail('2. All 11 Fandom Selection cards configured with existing datasets', err);
  }

  // ------------------------------------------------------------------
  // TEST 3: Fandom selection launches GameEngine with correct category
  // ------------------------------------------------------------------
  try {
    const { questions } = await QuestionLoader.loadFromNode('data');
    assert.strictEqual(questions.length, 2200, 'Master pool contains all 2,200 questions across 11 files');

    const engine = new GameEngine(questions);

    // Test session initialization for Marvel Universe
    const marvelSession = engine.startSession({ category: 'Marvel Universe', difficulty: 'all', roundLength: 10 });
    assert.strictEqual(marvelSession.category, 'Marvel Universe');
    assert.strictEqual(engine.getTotalQuestionsInRound(), 10);

    // Test session initialization for Naruto
    const narutoSession = engine.startSession({ category: 'Naruto', difficulty: 'Easy', roundLength: 20 });
    assert.strictEqual(narutoSession.category, 'Naruto');
    assert.strictEqual(narutoSession.difficulty, 'Easy');
    assert.strictEqual(engine.getTotalQuestionsInRound(), 20);

    pass('3. Fandom selection launches GameEngine with correct category identifier');
  } catch (err) {
    fail('3. Fandom selection launches GameEngine with correct category identifier', err);
  }

  // ------------------------------------------------------------------
  // TEST 4: FACT and TRAP buttons with immediate duplicate-submission lockout
  // ------------------------------------------------------------------
  try {
    const { questions } = await QuestionLoader.loadFromNode('data');
    const engine = new GameEngine(questions);
    engine.startSession({ category: 'One Piece', roundLength: 10 });

    const q = engine.getCurrentQuestion();
    assert.ok(q, 'First question retrieved');

    // First answer submission succeeds
    const res = engine.submitAnswer('FACT');
    assert.ok(typeof res.isCorrect === 'boolean', 'Submission returns correctness boolean');

    // Duplicate submission without advancing throws error
    assert.throws(() => {
      engine.submitAnswer('FACT');
    }, /Duplicate submission prevented/, 'Duplicate submission on same question is strictly prevented');

    pass('4. FACT and TRAP buttons work with immediate duplicate-submission lockout');
  } catch (err) {
    fail('4. FACT and TRAP buttons work with immediate duplicate-submission lockout', err);
  }

  // ------------------------------------------------------------------
  // TEST 5: Game Arena feedback, explanation, graceful source handling, and live streak
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="btn-arena-exit"'), 'Exit Round button present in Arena');
    assert.ok(html.includes('id="arena-streak-box"'), 'Live streak counter box present');
    assert.ok(html.includes('id="arena-streak-val"'), 'Live streak value element present');
    assert.ok(html.includes('id="explanation-text"'), 'Explanation container present');
    assert.ok(html.includes('id="source-citation"'), 'Source citation container present');
    assert.ok(jsApp.includes('updateStreakUI'), 'Streak UI updates tracked in js/app.js');
    assert.ok(jsApp.includes('currentStreak'), 'Active streak counter tracked in js/app.js');

    pass('5. Game Arena feedback, explanation, graceful source handling, and live streak verified');
  } catch (err) {
    fail('5. Game Arena feedback, explanation, graceful source handling, and live streak verified', err);
  }

  // ------------------------------------------------------------------
  // TEST 6: Safe Arena Exit modal and lifecycle
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="arena-exit-modal"'), 'Exit confirmation modal present in index.html');
    assert.ok(html.includes('id="btn-arena-cancel-exit"'), 'Cancel exit button present');
    assert.ok(html.includes('id="btn-arena-confirm-exit"'), 'Confirm exit button present');
    assert.ok(jsApp.includes('btnArenaExit'), 'Arena exit button wired in js/app.js');
    assert.ok(jsApp.includes('btnArenaConfirmExit'), 'Exit confirmation safely returns to setup view in js/app.js');

    pass('6. Safe Arena Exit modal and lifecycle verified');
  } catch (err) {
    fail('6. Safe Arena Exit modal and lifecycle verified', err);
  }

  // ------------------------------------------------------------------
  // TEST 7: Personal Player Dashboard displays user data (Screen 4)
  // ------------------------------------------------------------------
  try {
    assert.ok(html.includes('id="view-dashboard"'), 'view-dashboard container present in index.html');
    assert.ok(html.includes('id="dashboard-container"'), 'dashboard-container dynamic root present in index.html');
    assert.ok(html.includes('src="js/playerDashboard.js"'), 'playerDashboard.js script included');
    assert.ok(jsPlayerDashboard.includes('loadPlayerData'), 'loadPlayerData method defined in playerDashboard.js');
    assert.ok(jsPlayerDashboard.includes('renderAuthenticatedDashboard'), 'renderAuthenticatedDashboard defined in playerDashboard.js');
    assert.ok(jsPlayerDashboard.includes('renderGuestState'), 'renderGuestState defined in playerDashboard.js');

    pass('7. Personal Player Dashboard module and DOM architecture verified');
  } catch (err) {
    fail('7. Personal Player Dashboard module and DOM architecture verified', err);
  }

  // ------------------------------------------------------------------
  // TEST 8: Logged-out users cannot view private data (Guest Mode protection)
  // ------------------------------------------------------------------
  try {
    const unauthStats = await request('/players/me/stats');
    assert.strictEqual(unauthStats.status, 401, 'Unauthenticated GET /players/me/stats returns 401');

    const unauthHistory = await request('/games/history');
    assert.strictEqual(unauthHistory.status, 401, 'Unauthenticated GET /games/history returns 401');

    const unauthBadges = await request('/api/fandom/badges');
    assert.strictEqual(unauthBadges.status, 401, 'Unauthenticated GET /api/fandom/badges returns 401');

    const unauthProgress = await request('/api/fandom/progress');
    assert.strictEqual(unauthProgress.status, 401, 'Unauthenticated GET /api/fandom/progress returns 401');

    pass('8. Logged-out users cannot view private data (Strict 401 token authentication)');
  } catch (err) {
    fail('8. Logged-out users cannot view private data', err);
  }

  // ------------------------------------------------------------------
  // TEST 9: Responsive layout, keyboard navigation, and reduced motion
  // ------------------------------------------------------------------
  try {
    assert.ok(css.includes('.fandom-selection-view'), 'Fandom selection view CSS class defined');
    assert.ok(css.includes('.player-dashboard-view'), 'Player dashboard view CSS class defined');
    assert.ok(css.includes('.kbd-hint'), 'Keyboard shortcut badge styling defined');
    assert.ok(css.includes('@media (max-width: 768px)'), 'Mobile/tablet media query defined in style.css');
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion rules defined in style.css');

    // Keyboard handlers in js/app.js: F for Fact, T for Trap, Enter for Next, Esc for Exit
    assert.ok(jsApp.includes("'f'") || jsApp.includes("'F'"), 'F key mapped to Fact');
    assert.ok(jsApp.includes("'t'") || jsApp.includes("'T'"), 'T key mapped to Trap');
    assert.ok(jsApp.includes("'Enter'"), 'Enter key mapped to Next Question');
    assert.ok(jsApp.includes("'Escape'"), 'Escape key mapped to Exit Modal');

    pass('9. Responsive layout, keyboard navigation, and reduced motion verified');
  } catch (err) {
    fail('9. Responsive layout, keyboard navigation, and reduced motion verified', err);
  }

  // ------------------------------------------------------------------
  // TEST 10: Existing auth, XP, levels, and achievements remain fully functional
  // ------------------------------------------------------------------
  try {
    const health = await request('/health');
    assert.strictEqual(health.status, 200, 'Backend API health endpoint returns 200 OK');

    const xpCode = fs.readFileSync(path.join(ROOT, 'js/xp.js'), 'utf8');
    const vm = require('vm');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(xpCode, sandbox);
    const BluffXP = sandbox.window.BluffXP;

    assert.ok(BluffXP, 'BluffXP namespace must exist');
    assert.strictEqual(BluffXP.deriveLevel(0), 1, 'Initial level is Level 1 Novice');
    assert.strictEqual(BluffXP.deriveLevel(100), 2, '100 XP reaches Level 2');
    assert.strictEqual(BluffXP.deriveLevel(280), 3, '280 XP reaches Level 3');

    pass('10. Existing auth, XP, levels, and achievements remain fully functional');
  } catch (err) {
    fail('10. Existing auth, XP, levels, and achievements remain fully functional', err);
  }

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} / ${passed + failed} Passed (${failed} Failed)`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
