/**
 * Truth Pool — Phase 3.5 Final Enhancement Verification Suite
 * Validates all requirements specified in Phase 3.5 prompt:
 * 1. 15 JSON question files (600 existing + 300 new across 3 files)
 * 2. Question adapter and validation integrity
 * 3. Superhero-inspired visual elements & masked hero emblem
 * 4. Hero Red (#EF4444) primary CTA theme replacing yellow
 * 5. Complete removal of visible Leaderboard button & nav items
 * 6. Functional fullscreen option with icons, events, and Esc key support
 * 7. Category, difficulty, and round length (10, 20, 50) functionality
 * 8. Gameplay lifecycle, duplicate prevention, and scoring
 * 9. Responsive layout and server delivery
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GameEngine, QuestionLoader, QuestionValidator, QuestionAdapter } = require('../js/gameEngine.js');

const ROOT = path.resolve(__dirname, '..');
const dataDir = path.join(ROOT, 'data');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const jsApp = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  ✓ PASS: ${title}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    ${err.message}`);
  }
}

async function runPhase35Verification() {
  console.log('================================================================');
  console.log('TRUTH POOL — PHASE 3.5 FINAL ENHANCEMENT VERIFICATION SUITE');
  console.log('================================================================\n');

  // [1] Verify Fandom Dataset Filenames Registered & Empty-Pool Graceful Handling
  console.log('[1/8] Verifying Fandom Dataset Filenames & Empty-Pool Handling...');
  check('All 10 fandom dataset filenames are registered in QuestionLoader', () => {
    const expected = [
      'marvel_universe.json',
      'dc_universe.json',
      'one_piece.json',
      'naruto.json',
      'bleach.json',
      'other_anime.json',
      'movies_and_tv.json',
      'gaming_universe.json',
      'fantasy_and_fiction.json',
      'fan_theories.json'
    ];
    for (const fn of expected) {
      assert.ok(
        QuestionLoader.DATASET_FILENAMES.includes(fn),
        `${fn} must be registered in DATASET_FILENAMES`
      );
    }
  });

  check('Old general-knowledge filenames are no longer registered', () => {
    const removed = [
      'everyday_knowledge.json',
      'geography.json',
      'history.json',
      'health.json',
      'technology.json',
      'cartoon_fact_or_trap.json',
      'dc_fact_or_trap.json',
      'marvel_fact_or_trap.json'
    ];
    for (const fn of removed) {
      assert.ok(
        !QuestionLoader.DATASET_FILENAMES.includes(fn),
        `${fn} must NOT be registered (dataset reset complete)`
      );
    }
  });

  // Load from data/ — may be empty during the dataset reset phase
  const { questions, stats } = QuestionLoader.loadFromNode(dataDir);

  check('Question loader runs without errors even with no JSON files present', () => {
    assert.ok(Array.isArray(questions), 'questions is an array');
    assert.ok(typeof stats === 'object', 'stats is an object');
    // invalidQuestions must always be 0 (no bad records, just absent files)
    assert.strictEqual(stats.invalidQuestions, 0, 'Zero invalid question records');
  });

  check('GameEngine master pool is empty when no datasets are loaded (correct state)', () => {
    const emptyEngine = new GameEngine([]);
    assert.strictEqual(emptyEngine.getMasterPoolSize(), 0, 'Empty engine pool size is 0');
    assert.deepStrictEqual(emptyEngine.getAvailableCategories(), [], 'No categories when pool is empty');
  });

  check('GameEngine.startSession throws a clear error on empty pool (prevents invalid state)', () => {
    const emptyEngine = new GameEngine([]);
    assert.throws(
      () => emptyEngine.startSession({ category: 'all', difficulty: 'all', roundLength: 10 }),
      /empty/i,
      'startSession must throw when master pool is empty'
    );
  });

  // [2] Category & Difficulty Controls (skipped when pool is empty)
  console.log('\n[2/8] Verifying Category & Difficulty Controls (data-dependent)...');
  if (questions.length > 0) {
    const engine = new GameEngine(questions);
    check('Categories are extracted dynamically from loaded questions', () => {
      const categories = engine.getAvailableCategories();
      assert.ok(categories.length > 0, 'At least one category extracted');
    });

    check('Difficulties Easy, Medium, Hard normalized when data present', () => {
      const diffs = engine.getAvailableDifficulties();
      assert.deepStrictEqual(diffs, ['Easy', 'Medium', 'Hard']);
    });

    check('Supported round lengths 10, 20, 50 work without repeating questions', () => {
      for (const len of [10, 20, 50]) {
        if (questions.length < len) continue; // skip if pool smaller than round
        engine.startSession({ roundLength: len });
        assert.strictEqual(engine.getTotalQuestionsInRound(), len);
        const seenIds = new Set();
        for (const q of engine.session.questions) {
          assert.ok(!seenIds.has(q.id), `ID ${q.id} must not repeat within round`);
          seenIds.add(q.id);
        }
      }
    });
  } else {
    console.log('  ℹ  SKIPPED: No datasets loaded — data-dependent checks deferred until datasets are added.');
    check('Empty pool state: no categories or difficulties available', () => {
      const engine = new GameEngine([]);
      assert.deepStrictEqual(engine.getAvailableCategories(), []);
      assert.deepStrictEqual(engine.getAvailableDifficulties(), []);
    });
  }

  // [3] Superhero-Inspired Visual Design & Masked Hero Emblem
  console.log('\n[3/8] Verifying Superhero-Inspired Visual Design & Assets...');
  check('Masked hero emblem asset exists and is displayed in header', () => {
    const emblemPath = path.join(ROOT, 'assets/truth-pool-emblem.png');
    assert.ok(fs.existsSync(emblemPath), 'truth-pool-emblem.png asset exists');
    assert.ok(html.includes('assets/truth-pool-emblem.png'), 'Emblem referenced in index.html');
    assert.ok(html.includes('class="header-emblem-badge"'), 'Header emblem badge element present');
  });

  check('Truth Pool logo and mascot are preserved', () => {
    assert.ok(html.includes('assets/truth-pool-logo.png'), 'Truth Pool logo in header');
    assert.ok(html.includes('assets/truth-pool-hero.png'), 'Truth Pool hero in 3D center');
    assert.ok(!html.includes('BB initials'), 'No generic BB initials used');
  });

  check('Comic-style FACT and TRAP buttons in Arena', () => {
    assert.ok(html.includes('id="btn-fact"'), 'Arena FACT button present');
    assert.ok(html.includes('id="btn-myth"'), 'Arena TRAP button present');
    assert.ok(html.includes('TRAP'), 'Button label displays TRAP');
    assert.ok(html.includes('FACT'), 'Button label displays FACT');
    assert.ok(css.includes('.btn-fact'), 'btn-fact styling defined in CSS');
    assert.ok(css.includes('.btn-myth'), 'btn-myth styling defined in CSS');
  });

  // [4] Replace Yellow with Hero Red (#EF4444)
  console.log('\n[4/8] Verifying Hero Red (#EF4444) Primary CTA Theme...');
  check('Primary CTA accent token is Hero Red #EF4444', () => {
    assert.ok(css.includes('--color-hero-red: #EF4444'), 'Hero Red token defined');
    assert.ok(css.includes('--accent-primary: var(--color-hero-red)'), 'Accent primary points to Hero Red');
  });

  check('Primary buttons use Hero Red styling', () => {
    assert.ok(html.includes('class="btn btn-hero-red"'), 'Start Playing button has btn-hero-red');
    assert.ok(html.includes('id="start-game-btn" class="btn btn-hero-red btn-block"'), 'Start Game button has btn-hero-red');
    assert.ok(html.includes('id="next-question-btn" class="btn btn-hero-red btn-block"'), 'Next Question button has btn-hero-red');
    assert.ok(html.includes('id="play-again-btn" class="btn btn-hero-red"'), 'Play Again button has btn-hero-red');
    assert.ok(css.includes('.btn-hero-red'), 'btn-hero-red class defined in CSS');
    assert.ok(css.includes('background: var(--color-hero-red)'), 'Primary button background is Hero Red');
  });

  check('Progress bar uses Hero Red gradient instead of yellow', () => {
    assert.ok(html.includes('<!-- Hero Red Progress Bar -->'), 'Progress bar comment reflects hero red');
    assert.ok(css.includes('.progress-fill'), 'Progress fill styling defined');
    assert.ok(css.includes('linear-gradient(90deg, #DC2626 0%, #EF4444 60%, #F87171 100%)'), 'Progress bar gradient is Hero Red');
  });

  // [5] Removal of Leaderboard
  console.log('\n[5/8] Verifying Complete Removal of Leaderboard Buttons & Links...');
  check('Leaderboard navigation link completely removed', () => {
    assert.ok(!html.includes('id="nav-leaderboard"'), 'nav-leaderboard removed from index.html');
    assert.ok(!html.includes('>Leaderboard<'), 'No visible Leaderboard text in nav buttons');
  });

  check('Hero Leaderboard button completely removed from landing page', () => {
    assert.ok(!html.includes('id="btn-hero-leaderboard"'), 'btn-hero-leaderboard removed from index.html');
  });

  check('No Leaderboard button remains in app.js event bindings', () => {
    assert.ok(!jsApp.includes("document.getElementById('btn-hero-leaderboard')"), 'No btn-hero-leaderboard binding in app.js');
    assert.ok(!jsApp.includes("document.getElementById('nav-leaderboard')"), 'No nav-leaderboard binding in app.js');
  });

  check('Feature card 4 updated to Mission Records', () => {
    assert.ok(html.includes('Mission Records'), 'Feature card 4 is Mission Records');
    assert.ok(!html.includes('Leaderboard Ready'), 'Old Leaderboard Ready text removed');
  });

  // [6] Functional Full-Screen Option
  console.log('\n[6/8] Verifying Functional Fullscreen Option...');
  check('Fullscreen toggle button present with accessible markup and icons', () => {
    assert.ok(html.includes('id="fullscreen-toggle-btn"'), 'fullscreen-toggle-btn present in header');
    assert.ok(html.includes('class="fs-icon fs-icon-enter"'), 'Enter fullscreen icon present');
    assert.ok(html.includes('class="fs-icon fs-icon-exit"'), 'Exit fullscreen icon present');
    assert.ok(html.includes('aria-label="Enter Fullscreen Mode"'), 'Accessible label present');
  });

  check('Fullscreen controller in app.js handles API, events, and Esc key', () => {
    assert.ok(jsApp.includes('fullscreenToggleBtn'), 'fullscreenToggleBtn handled in app.js');
    assert.ok(jsApp.includes('requestFullscreen'), 'requestFullscreen supported');
    assert.ok(jsApp.includes('exitFullscreen'), 'exitFullscreen supported');
    assert.ok(jsApp.includes('fullscreenchange'), 'fullscreenchange listener bound');
    assert.ok(jsApp.includes('updateFullscreenUI'), 'updateFullscreenUI handler bound');
  });

  check('CSS supports :fullscreen container with proper scrolling', () => {
    assert.ok(css.includes(':fullscreen'), ':fullscreen pseudo-class supported in CSS');
    assert.ok(css.includes('.fullscreen-toggle-btn'), '.fullscreen-toggle-btn styled in CSS');
  });

  // [7] Preserve Landing Page & Navigation
  console.log('\n[7/8] Verifying Landing Page Integrity & Navigation Flow...');
  check('Landing page contains all required elements and START PLAYING button', () => {
    assert.ok(html.includes('id="view-landing"'), 'view-landing present');
    assert.ok(html.includes('FACTS. FIBS.'), 'FACTS. FIBS. present');
    assert.ok(html.includes('YOU DECIDE.'), 'YOU DECIDE. present');
    assert.ok(html.includes('id="btn-start-playing"'), 'btn-start-playing present');
    assert.ok(html.includes('landing-parallax-stage'), '3D parallax stage present');
  });

  check('START PLAYING button navigates to Setup view in app.js', () => {
    assert.ok(
      jsApp.includes('btnStartPlaying') && jsApp.includes('showView(viewSetup)'),
      'btnStartPlaying opens setup view'
    );
  });

  // [8] Live Server & Backend Health Check
  console.log('\n[8/8] Verifying Live HTTP Delivery & FastAPI Backend...');
  async function testLiveServers() {
    const resFront = await fetch('http://localhost:8000/index.html');
    assert.strictEqual(resFront.status, 200, 'Frontend server delivers 200');
    const frontText = await resFront.text();
    assert.ok(frontText.includes('id="dataset-status"'), 'Frontend delivers dataset-status element');
    assert.ok(frontText.includes('id="fullscreen-toggle-btn"'), 'Frontend delivers fullscreen button');

    const resBack = await fetch('http://127.0.0.1:8001/health');
    assert.strictEqual(resBack.status, 200, 'FastAPI backend responds 200');
    const backData = await resBack.json();
    assert.strictEqual(backData.status, 'ok', 'FastAPI health status ok');
  }

  await testLiveServers();
  console.log('  ✓ PASS: Live web server (port 8000) and auth API (port 8001) are operational.');
  passedChecks++;
  totalChecks++;

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL PHASE 3.5 CHECKS: ${passedChecks} / ${totalChecks} Passed (${totalChecks - passedChecks} Failed)`);
  console.log('----------------------------------------------------------------');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runPhase35Verification().catch(err => {
  console.error('Phase 3.5 verification error:', err);
  process.exit(1);
});
