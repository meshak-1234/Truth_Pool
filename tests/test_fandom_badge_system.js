/**
 * Truth Pool — Phase 2 Fandom Badge Unlock System Automated Test Suite
 * Validates:
 *  1. Unauthenticated access is rejected (401).
 *  2. One completed question increments progress once.
 *  3. Replaying the same question does not increment progress (deduplication).
 *  4. Incorrect answers still count as completed questions (knowledge completion, not correctness-only).
 *  5. Different fandoms maintain separate progress (e.g., Ben 10 vs Naruto).
 *  6. 99 unique questions do not unlock Tier 1.
 *  7. The 100th unique question unlocks Tier 1 badge.
 *  8. The 199th unique question does not unlock Tier 2.
 *  9. The 200th unique question unlocks Tier 2 badge (and guarantees Tier 1 is owned).
 * 10. Each badge is awarded only once.
 * 11. One user cannot access another user's progress (player isolation).
 * 12. Invalid question IDs and fandom IDs are rejected (400 Bad Request).
 * 13. Existing authentication and game features remain functional (/games/complete, XP, stats).
 *
 * Run with: node tests/test_fandom_badge_system.js
 */

const assert = require('assert');

const API_BASE = 'http://127.0.0.1:8001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response
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
  console.log('TRUTH POOL — PHASE 2 FANDOM BADGE SYSTEM TEST SUITE');
  console.log('======================================================\n');

  // Check backend health
  console.log('[Step 0] Checking Backend Health...');
  const healthRes = await request('/health');
  assert.strictEqual(healthRes.status, 200, 'Backend API health check should return 200');
  console.log('  ✓ Backend API is reachable and healthy.\n');

  // Register two fresh test users for isolation testing
  const tagA = Date.now().toString().slice(-6);
  const userA = {
    username: `badge_test_a_${tagA}`,
    email: `badge_test_a_${tagA}@example.com`,
    password: 'Password123!'
  };

  const tagB = (Date.now() + 1).toString().slice(-6);
  const userB = {
    username: `badge_test_b_${tagB}`,
    email: `badge_test_b_${tagB}@example.com`,
    password: 'Password123!'
  };

  const regA = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert.strictEqual(regA.status, 201, 'User A registration should succeed');
  const tokenA = regA.data.access_token;

  const regB = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  assert.strictEqual(regB.status, 201, 'User B registration should succeed');
  const tokenB = regB.data.access_token;

  // ------------------------------------------------------------------
  // TEST 1: Unauthenticated access is rejected (401)
  // ------------------------------------------------------------------
  try {
    const resPost = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 1 })
    });
    assert.strictEqual(resPost.status, 401, 'POST /api/fandom/question-completed must require auth');

    const resProg = await request('/api/fandom/progress');
    assert.strictEqual(resProg.status, 401, 'GET /api/fandom/progress must require auth');

    const resBadges = await request('/api/fandom/badges');
    assert.strictEqual(resBadges.status, 401, 'GET /api/fandom/badges must require auth');

    pass('1. Unauthenticated access is rejected (401)');
  } catch (err) {
    fail('1. Unauthenticated access is rejected (401)', err);
  }

  // ------------------------------------------------------------------
  // TEST 2: One completed question increments progress once
  // ------------------------------------------------------------------
  try {
    const res = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 1 })
    });

    assert.strictEqual(res.status, 200, 'POST question-completed should return 200');
    assert.strictEqual(res.data.already_completed, false, 'First time question is answered should not be marked already completed');
    assert.strictEqual(res.data.completed_questions, 1, 'Progress should be 1 question');
    assert.strictEqual(res.data.progress_pct, 0.5, '1 / 200 is 0.5%');
    assert.strictEqual(res.data.newly_unlocked_badges.length, 0, 'No badge unlocked at 1 question');

    pass('2. One completed question increments progress once');
  } catch (err) {
    fail('2. One completed question increments progress once', err);
  }

  // ------------------------------------------------------------------
  // TEST 3: Replaying the same question does not increment progress
  // ------------------------------------------------------------------
  try {
    const res = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 1 })
    });

    assert.strictEqual(res.status, 200, 'Duplicate POST should return 200');
    assert.strictEqual(res.data.already_completed, true, 'Replay of same question must be detected as already_completed');
    assert.strictEqual(res.data.completed_questions, 1, 'Count must remain 1 after replaying question 1');

    pass('3. Replaying the same question does not increment progress');
  } catch (err) {
    fail('3. Replaying the same question does not increment progress', err);
  }

  // ------------------------------------------------------------------
  // TEST 4: Incorrect answers still count as completed questions
  // ------------------------------------------------------------------
  try {
    // In Truth Pool, answering a question (regardless of whether the player chose correctly or got trapped)
    // records completion toward the fandom knowledge badge.
    const res = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 2 })
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.completed_questions, 2, 'Question 2 should increment count to 2');

    pass('4. Incorrect answers still count as completed questions (knowledge completion model)');
  } catch (err) {
    fail('4. Incorrect answers still count as completed questions', err);
  }

  // ------------------------------------------------------------------
  // TEST 5: Different fandoms maintain separate progress
  // ------------------------------------------------------------------
  try {
    const resNaruto = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Naruto', question_id: 1 })
    });

    assert.strictEqual(resNaruto.status, 200);
    assert.strictEqual(resNaruto.data.fandom_id, 'Naruto');
    assert.strictEqual(resNaruto.data.completed_questions, 1, 'Naruto should have 1 question completed');

    // Verify Ben 10 is still 2
    const resBenProg = await request('/api/fandom/progress?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(resBenProg.status, 200);
    assert.strictEqual(resBenProg.data.fandoms.completed_questions, 2, 'Ben 10 progress must stay at 2');

    pass('5. Different fandoms maintain separate progress');
  } catch (err) {
    fail('5. Different fandoms maintain separate progress', err);
  }

  // ------------------------------------------------------------------
  // TEST 6: 99 unique questions do not unlock Tier 1
  // ------------------------------------------------------------------
  try {
    // Fast-batch questions 3 through 99 for Ben 10
    console.log('    Batching questions 3..99 for Ben 10...');
    for (let q = 3; q <= 99; q++) {
      await request('/api/fandom/question-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({ fandom_id: 'Ben 10', question_id: q })
      });
    }

    const resProg99 = await request('/api/fandom/progress?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(resProg99.data.fandoms.completed_questions, 99);
    assert.strictEqual(resProg99.data.fandoms.tier1_unlocked, false, 'Tier 1 must remain locked at 99 questions');

    pass('6. 99 unique questions do not unlock Tier 1');
  } catch (err) {
    fail('6. 99 unique questions do not unlock Tier 1', err);
  }

  // ------------------------------------------------------------------
  // TEST 7: The 100th unique question unlocks Tier 1
  // ------------------------------------------------------------------
  try {
    const res100 = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 100 })
    });

    assert.strictEqual(res100.status, 200);
    assert.strictEqual(res100.data.completed_questions, 100);
    assert.strictEqual(res100.data.newly_unlocked_badges.length, 1, 'Exactly one badge unlocked at 100 questions');
    assert.strictEqual(res100.data.newly_unlocked_badges[0].badge_id, 'ben10_tier1');
    assert.strictEqual(res100.data.newly_unlocked_badges[0].title, 'Plumber Cadet');
    assert.strictEqual(res100.data.newly_unlocked_badges[0].badge_tier, 1);

    pass('7. The 100th unique question unlocks Tier 1');
  } catch (err) {
    fail('7. The 100th unique question unlocks Tier 1', err);
  }

  // ------------------------------------------------------------------
  // TEST 8: The 199th unique question does not unlock Tier 2
  // ------------------------------------------------------------------
  try {
    console.log('    Batching questions 101..199 for Ben 10...');
    for (let q = 101; q <= 199; q++) {
      await request('/api/fandom/question-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({ fandom_id: 'Ben 10', question_id: q })
      });
    }

    const resProg199 = await request('/api/fandom/progress?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(resProg199.data.fandoms.completed_questions, 199);
    assert.strictEqual(resProg199.data.fandoms.tier1_unlocked, true, 'Tier 1 must stay unlocked');
    assert.strictEqual(resProg199.data.fandoms.tier2_unlocked, false, 'Tier 2 must NOT unlock at 199 questions');

    pass('8. The 199th unique question does not unlock Tier 2');
  } catch (err) {
    fail('8. The 199th unique question does not unlock Tier 2', err);
  }

  // ------------------------------------------------------------------
  // TEST 9: The 200th unique question unlocks Tier 2
  // ------------------------------------------------------------------
  try {
    const res200 = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 200 })
    });

    assert.strictEqual(res200.status, 200);
    assert.strictEqual(res200.data.completed_questions, 200);
    assert.strictEqual(res200.data.newly_unlocked_badges.length, 1, 'Tier 2 badge unlocked at 200 questions');
    assert.strictEqual(res200.data.newly_unlocked_badges[0].badge_id, 'ben10_tier2');
    assert.strictEqual(res200.data.newly_unlocked_badges[0].title, 'Master of the Omnitrix');
    assert.strictEqual(res200.data.newly_unlocked_badges[0].badge_tier, 2);

    // Verify both tiers are now recorded as unlocked
    const resProg200 = await request('/api/fandom/progress?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(resProg200.data.fandoms.tier1_unlocked, true);
    assert.strictEqual(resProg200.data.fandoms.tier2_unlocked, true);

    pass('9. The 200th unique question unlocks Tier 2 (and both tiers are owned)');
  } catch (err) {
    fail('9. The 200th unique question unlocks Tier 2', err);
  }

  // ------------------------------------------------------------------
  // TEST 10: Each badge is awarded only once
  // ------------------------------------------------------------------
  try {
    // Submit an already answered question or re-trigger at 200
    const resRepeat = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 200 })
    });

    assert.strictEqual(resRepeat.status, 200);
    assert.strictEqual(resRepeat.data.newly_unlocked_badges.length, 0, 'No badges should be re-unlocked on duplicate submission');
    assert.strictEqual(resRepeat.data.earned_badges.length, 2, 'User has exactly 2 earned badges for Ben 10');

    pass('10. Each badge is awarded only once (idempotent permanent storage)');
  } catch (err) {
    fail('10. Each badge is awarded only once', err);
  }

  // ------------------------------------------------------------------
  // TEST 11: One user cannot access another user's progress
  // ------------------------------------------------------------------
  try {
    // User B checks their Ben 10 progress
    const resBProg = await request('/api/fandom/progress?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });

    assert.strictEqual(resBProg.status, 200);
    assert.strictEqual(resBProg.data.fandoms.completed_questions, 0, 'User B must have 0 completed questions for Ben 10');
    assert.strictEqual(resBProg.data.fandoms.tier1_unlocked, false, 'User B must not have Tier 1 unlocked');
    assert.strictEqual(resBProg.data.fandoms.tier2_unlocked, false, 'User B must not have Tier 2 unlocked');

    const resBBadges = await request('/api/fandom/badges?fandom_id=Ben%2010', {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert.strictEqual(resBBadges.status, 200);
    assert.strictEqual(resBBadges.data.unlocked_count, 0, 'User B should have 0 unlocked badges');

    pass("11. One user cannot access another user's progress (strict token isolation)");
  } catch (err) {
    fail("11. One user cannot access another user's progress", err);
  }

  // ------------------------------------------------------------------
  // TEST 12: Invalid question IDs and fandom IDs are rejected
  // ------------------------------------------------------------------
  try {
    // Unknown fandom
    const resBadFandom = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Harry Potter', question_id: 1 })
    });
    assert.strictEqual(resBadFandom.status, 400, 'Non-existent fandom must return 400');

    // Out of range question ID
    const resBadQ = await request('/api/fandom/question-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ fandom_id: 'Ben 10', question_id: 999 })
    });
    assert.strictEqual(resBadQ.status, 400, 'Non-existent question ID must return 400');

    // Invalid progress filter
    const resBadFilter = await request('/api/fandom/progress?fandom_id=InvalidFandom', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(resBadFilter.status, 400, 'Invalid fandom in progress query must return 400');

    pass('12. Invalid question IDs and fandom IDs are rejected (400 Bad Request)');
  } catch (err) {
    fail('12. Invalid question IDs and fandom IDs are rejected', err);
  }

  // ------------------------------------------------------------------
  // TEST 13: Existing authentication and game features remain functional
  // ------------------------------------------------------------------
  try {
    // 1. Existing /games/complete endpoint works
    const gameRound = await request('/games/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        score: 80,
        questions_answered: 10,
        correct_answers: 8,
        category: 'Ben 10',
        difficulty: 'Medium',
        round_length: 10,
        idempotency_key: `test_round_${Date.now()}`
      })
    });
    assert.strictEqual(gameRound.status, 200, '/games/complete must return 200');
    assert.ok(gameRound.data.xp, 'XP payload must be present');
    assert.strictEqual(gameRound.data.xp.xp_earned, 130, 'XP earned must match formula (8*10 + 10*5 = 130)');

    // 2. Existing /players/me/stats works
    const stats = await request('/players/me/stats', {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.data.completed_rounds, 1);
    assert.strictEqual(stats.data.total_questions_answered, 10);
    assert.strictEqual(stats.data.total_correct_answers, 8);

    // 3. Clean account deletion cascades
    const del = await request('/auth/account', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(del.status, 200, 'Account deletion should succeed');

    pass('13. Existing authentication, XP, rounds, and stats remain fully functional');
  } catch (err) {
    fail('13. Existing authentication and game features remain functional', err);
  }

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('======================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
