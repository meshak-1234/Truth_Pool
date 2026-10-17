/**
 * Truth Pool — Phase 4A XP and Player Levels Integration Test Suite
 * Validates:
 * 1. XP calculation consistency (server-side trusted formula)
 * 2. Level derivation and threshold advancement
 * 3. Prevention of duplicate XP award on replay / identical idempotency_key
 * 4. GET /players/me/xp endpoint contract & progress percentage
 * 5. GET /players/me/stats integration with XP and Level
 * 6. Client-side XP module (js/xp.js) math and threshold consistency
 *
 * Run with: node tests/test_phase4a_xp_levels.js
 */

const assert = require('assert');
const fs = require('fs');

const API_BASE = 'http://127.0.0.1:8001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-json
  }
  return { status: res.status, headers: res.headers, data: json };
}

async function runTests() {
  console.log('======================================================');
  console.log('TRUTH POOL — PHASE 4A: XP & PLAYER LEVELS TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Health check
  console.log('[1/8] Verifying API Health...');
  const healthRes = await request('/health');
  assert.strictEqual(healthRes.status, 200, 'Health check should be 200');
  console.log('  ✓ API is running and healthy.\n');

  // Test 2: Client module unit tests (js/xp.js)
  console.log('[2/8] Validating js/xp.js logic in Node environment...');
  const xpCode = fs.readFileSync('js/xp.js', 'utf8');
  const context = { window: {} };
  const vm = require('vm');
  vm.createContext(context);
  vm.runInContext(xpCode, context);
  const BluffXP = context.window.BluffXP;

  assert.ok(BluffXP, 'BluffXP namespace must exist');
  assert.strictEqual(BluffXP.deriveLevel(0), 1, '0 XP should be Level 1');
  assert.strictEqual(BluffXP.deriveLevel(99), 1, '99 XP should be Level 1');
  assert.strictEqual(BluffXP.deriveLevel(100), 2, '100 XP should be Level 2');
  assert.strictEqual(BluffXP.deriveLevel(249), 2, '249 XP should be Level 2');
  assert.strictEqual(BluffXP.deriveLevel(250), 3, '250 XP should be Level 3');
  assert.strictEqual(BluffXP.deriveLevel(50000), 20, '50000 XP should be capped at Level 20 (MAX)');

  const prog1 = BluffXP.getLevelProgression(150);
  assert.strictEqual(prog1.level, 2, '150 XP should be level 2');
  assert.strictEqual(prog1.currentLevelStart, 100);
  assert.strictEqual(prog1.nextLevelStart, 250);
  assert.strictEqual(prog1.xpInLevel, 50);
  assert.strictEqual(prog1.xpNeededForLevel, 150);
  assert.strictEqual(prog1.xpToNextLevel, 100);
  assert.strictEqual(prog1.progressPct, 33.3);
  console.log('  ✓ Client-side progression logic validated across thresholds.\n');

  // Test 3: Unauthenticated rejection on /players/me/xp
  console.log('[3/8] Verifying rejection of unauthenticated GET /players/me/xp (401)...');
  const unauthXp = await request('/players/me/xp');
  assert.strictEqual(unauthXp.status, 401, 'Unauthenticated request must be 401');
  console.log('  ✓ Unauthenticated requests rejected.\n');

  // Test 4: Register dedicated test user
  const username = `xp_tester_${Date.now()}`;
  const email = `${username}@example.com`;
  const password = 'TestPassword123!';
  console.log(`[4/8] Registering test user (${username})...`);
  const regRes = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  assert.strictEqual(regRes.status, 201, 'Registration should succeed');
  const token = regRes.data.access_token;
  assert.ok(token, 'Access token must be provided');

  // Check initial XP
  const initialXp = await request('/players/me/xp', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(initialXp.status, 200);
  assert.strictEqual(initialXp.data.total_xp, 0, 'New user should start with 0 XP');
  assert.strictEqual(initialXp.data.player_level, 1, 'New user should start at Level 1');
  assert.strictEqual(initialXp.data.xp_to_next_level, 100, 'Need 100 XP to reach Level 2');
  console.log('  ✓ Initial state confirmed: 0 XP, Level 1.\n');

  // Test 5: Complete Round 1 -> Earn XP & Level Up to Level 2
  // Formula: 8 correct, 10 answered -> (8 * 10) + (10 * 5) = 80 + 50 = 130 XP
  // 130 XP >= 100 -> Reaches Level 2!
  console.log('[5/8] Submitting Round 1 (10 answered, 8 correct -> expected 130 XP)...');
  const r1Key = `key_xp_${Date.now()}_1`;
  const round1Res = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      score: 80,
      questions_answered: 10,
      correct_answers: 8,
      category: 'Science and Space',
      difficulty: 'Medium',
      round_length: 10,
      started_at: new Date(Date.now() - 60000).toISOString(),
      idempotency_key: r1Key,
      client_fake_xp: 99999 // Must be ignored by server!
    })
  });
  assert.strictEqual(round1Res.status, 200, 'Round 1 save should succeed');
  assert.strictEqual(round1Res.data.idempotent, false);
  assert.strictEqual(round1Res.data.xp.xp_earned, 130, 'XP earned must be exactly 130');
  assert.strictEqual(round1Res.data.xp.total_xp, 130, 'Total XP must be 130');
  assert.strictEqual(round1Res.data.xp.player_level, 2, 'Player should level up to Level 2');
  assert.strictEqual(round1Res.data.xp.leveled_up, true, 'leveled_up flag must be true');
  assert.strictEqual(round1Res.data.xp.level_before, 1);
  assert.strictEqual(round1Res.data.xp.level_after, 2);
  console.log('  ✓ Round 1 saved: 130 XP earned, leveled up to Level 2.\n');

  // Test 6: Replaying same idempotency key must not award additional XP
  console.log('[6/8] Testing duplicate round submission prevention (Idempotency)...');
  const dupRes = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      score: 80,
      questions_answered: 10,
      correct_answers: 8,
      idempotency_key: r1Key
    })
  });
  assert.strictEqual(dupRes.status, 200);
  assert.strictEqual(dupRes.data.idempotent, true, 'Duplicate request must be idempotent');
  assert.strictEqual(dupRes.data.xp.xp_earned_this_round, 0, 'No additional XP should be awarded on replay');
  assert.strictEqual(dupRes.data.xp.total_xp, 130, 'Total XP remains unchanged at 130');
  assert.strictEqual(dupRes.data.xp.leveled_up, false);
  console.log('  ✓ Duplicate prevention verified: 0 XP re-awarded, state maintained.\n');

  // Test 7: Complete Round 2 -> Advancing to Level 3
  // 10 answered, 10 correct -> (10 * 10) + (10 * 5) = 150 XP
  // Total XP: 130 + 150 = 280 XP -> Level 3 (threshold 250 XP)
  console.log('[7/8] Submitting Round 2 (10 answered, 10 correct -> 150 XP, total 280 XP)...');
  const r2Key = `key_xp_${Date.now()}_2`;
  const round2Res = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      score: 100,
      questions_answered: 10,
      correct_answers: 10,
      category: 'Marvel Universe',
      difficulty: 'Hard',
      round_length: 10,
      started_at: new Date(Date.now() - 60000).toISOString(),
      idempotency_key: r2Key
    })
  });
  assert.strictEqual(round2Res.status, 200);
  assert.strictEqual(round2Res.data.xp.xp_earned, 150);
  assert.strictEqual(round2Res.data.xp.total_xp, 280);
  assert.strictEqual(round2Res.data.xp.player_level, 3, 'Player should level up to Level 3');
  assert.strictEqual(round2Res.data.xp.leveled_up, true);
  console.log('  ✓ Round 2 saved: +150 XP earned (total 280 XP), promoted to Level 3.\n');

  // Test 8: Verify GET /players/me/stats includes XP and Level
  console.log('[8/8] Checking GET /players/me/stats contains XP and Level info...');
  const statsRes = await request('/players/me/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(statsRes.status, 200);
  assert.strictEqual(statsRes.data.completed_rounds, 2);
  assert.strictEqual(statsRes.data.total_questions_answered, 20);
  assert.strictEqual(statsRes.data.total_correct_answers, 18);
  assert.strictEqual(statsRes.data.overall_accuracy, 90.0);
  assert.strictEqual(statsRes.data.best_score, 100);
  assert.strictEqual(statsRes.data.total_xp, 280, 'Stats must include total_xp');
  assert.strictEqual(statsRes.data.player_level, 3, 'Stats must include player_level');
  assert.strictEqual(statsRes.data.xp_to_next_level, 220, 'Stats must include xp_to_next_level (500 - 280 = 220)');
  console.log('  ✓ Career stats perfectly reflect XP and Level metrics.\n');

  // Clean up test account
  await request('/auth/users/me', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('======================================================');
  console.log('ALL PHASE 4A XP & PLAYER LEVEL TESTS PASSED (8/8)!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('\n✗ Test failed with error:', err);
  process.exit(1);
});
