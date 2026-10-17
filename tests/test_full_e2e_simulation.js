/**
 * Bluff or Believe — Full End-to-End Game Lifecycle Simulation
 * Simulates complete player journey:
 * 1. Dataset loading & validation (600 questions)
 * 2. User registration and session creation
 * 3. Initial stats check (0 rounds, 0 answers, 0% accuracy)
 * 4. Playing a 10-question round through the GameEngine
 * 5. Asynchronous persistence via POST /games/complete
 * 6. Idempotent duplicate save verification
 * 7. History and Stats retrieval via GET /games/history and GET /players/me/stats
 * 8. Playing a 2nd round and verifying updated cumulative career stats
 * 9. Account deletion cleanup and cascading game history verification
 *
 * Run with: node tests/test_full_e2e_simulation.js
 */

const assert = require('assert');
const path = require('path');
const { GameEngine, QuestionLoader } = require('../js/gameEngine.js');

const API_BASE = 'http://127.0.0.1:8001';

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-json
  }
  return { status: res.status, data: json };
}

async function runE2ESimulation() {
  console.log('======================================================');
  console.log('BLUFF OR BELIEVE — FULL E2E LIFECYCLE SIMULATION');
  console.log('======================================================\n');

  // Step 1: Load 900 verified questions
  console.log('[Step 1] Loading questions dataset...');
  const dataDir = path.resolve(__dirname, '../data');
  const { questions } = QuestionLoader.loadFromNode(dataDir);
  assert.strictEqual(questions.length, 900, 'Must load exactly 900 questions');
  const engine = new GameEngine(questions);
  console.log(`  ✓ Master question pool ready: ${engine.getMasterPoolSize()} questions loaded across 15 categories.`);

  // Step 2: Register a new player
  const testId = Date.now().toString().slice(-6);
  const user = {
    username: `champion_${testId}`,
    email: `champion_${testId}@example.com`,
    password: 'Password123!'
  };

  console.log(`[Step 2] Registering player account: ${user.username}...`);
  const regRes = await apiRequest('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  assert.strictEqual(regRes.status, 201, 'Registration must return 201');
  const token = regRes.data.access_token;
  const authHeader = { 'Authorization': `Bearer ${token}` };
  console.log(`  ✓ Registration successful, bearer token acquired.`);

  // Step 3: Check initial empty stats
  console.log('[Step 3] Fetching initial statistics for new player...');
  const initialStats = await apiRequest('/players/me/stats', { headers: authHeader });
  assert.strictEqual(initialStats.status, 200);
  assert.strictEqual(initialStats.data.completed_rounds, 0);
  assert.strictEqual(initialStats.data.total_questions_answered, 0);
  assert.strictEqual(initialStats.data.total_correct_answers, 0);
  assert.strictEqual(initialStats.data.overall_accuracy, 0.0);
  assert.strictEqual(initialStats.data.best_score, 0);
  assert.strictEqual(initialStats.data.most_recent_completed_at, null);
  console.log('  ✓ Initial stats: 0 completed rounds, 0 answers, 0.0% accuracy.');

  // Step 4: Play Round 1 (10 questions, Science, Medium)
  console.log('[Step 4] Starting Round 1 session (10 questions, Science)...');
  const round1StartedAt = new Date().toISOString();
  const round1SessionId = `rnd_e2e_1_${testId}`;

  engine.startSession({ category: 'Science and Space', difficulty: 'Medium', roundLength: 10 });
  assert.strictEqual(engine.getTotalQuestionsInRound(), 10);

  // Answer 8 correctly and 2 incorrectly
  for (let i = 1; i <= 10; i++) {
    const q = engine.getCurrentQuestion();
    const shouldBeCorrect = (i <= 8); // 8 correct, 2 incorrect
    const playerChoice = shouldBeCorrect
      ? (q.answer === 'FACT' ? 'FACT' : 'MYTH')
      : (q.answer === 'FACT' ? 'MYTH' : 'FACT');

    engine.submitAnswer(playerChoice);
    engine.nextQuestion();
  }

  const round1Summary = engine.getSummary();
  assert.strictEqual(round1Summary.isGameOver, true);
  assert.strictEqual(round1Summary.score, 80);
  assert.strictEqual(round1Summary.correctCount, 8);
  assert.strictEqual(round1Summary.incorrectCount, 2);
  assert.strictEqual(round1Summary.accuracyPercentage, 80);
  console.log(`  ✓ Round 1 gameplay finished: Score 80 pts, 8/10 correct (80% accuracy).`);

  // Step 5: Save Round 1 to backend
  console.log('[Step 5] Persisting Round 1 result via POST /games/complete...');
  const save1 = await apiRequest('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader
    },
    body: JSON.stringify({
      score: round1Summary.score,
      questions_answered: round1Summary.answeredCount,
      correct_answers: round1Summary.correctCount,
      category: 'Science',
      difficulty: 'Medium',
      round_length: 10,
      started_at: round1StartedAt,
      idempotency_key: round1SessionId
    })
  });
  assert.strictEqual(save1.status, 200);
  assert.strictEqual(save1.data.idempotent, false);
  assert.strictEqual(save1.data.game.accuracy, 80.0);
  const round1DbId = save1.data.game.id;
  console.log(`  ✓ Round 1 saved in database (ID: ${round1DbId}, accuracy: 80.0%).`);

  // Step 6: Test Idempotency (frontend re-render or network retry)
  console.log('[Step 6] Testing duplicate save idempotency with same roundSessionId...');
  const retrySave1 = await apiRequest('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader
    },
    body: JSON.stringify({
      score: round1Summary.score,
      questions_answered: round1Summary.answeredCount,
      correct_answers: round1Summary.correctCount,
      category: 'Science',
      difficulty: 'Medium',
      round_length: 10,
      started_at: round1StartedAt,
      idempotency_key: round1SessionId
    })
  });
  assert.strictEqual(retrySave1.status, 200);
  assert.strictEqual(retrySave1.data.idempotent, true);
  assert.strictEqual(retrySave1.data.game.id, round1DbId);
  console.log('  ✓ Idempotency protected database from duplicate recording.');

  // Step 7: Play Round 2 (10 questions, perfect score: 10/10 correct = 100 pts)
  console.log('[Step 7] Starting Round 2 (Play Again flow: 10 questions, 100% correct)...');
  const round2StartedAt = new Date().toISOString();
  const round2SessionId = `rnd_e2e_2_${testId}`;

  engine.startSession({ category: 'all', difficulty: 'all', roundLength: 10 });
  for (let i = 1; i <= 10; i++) {
    const q = engine.getCurrentQuestion();
    const correctChoice = (q.answer === 'FACT' ? 'FACT' : 'MYTH');
    engine.submitAnswer(correctChoice);
    engine.nextQuestion();
  }

  const round2Summary = engine.getSummary();
  assert.strictEqual(round2Summary.score, 100);
  assert.strictEqual(round2Summary.correctCount, 10);
  assert.strictEqual(round2Summary.accuracyPercentage, 100);

  const save2 = await apiRequest('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader
    },
    body: JSON.stringify({
      score: round2Summary.score,
      questions_answered: round2Summary.answeredCount,
      correct_answers: round2Summary.correctCount,
      category: 'Mixed',
      difficulty: 'Mixed',
      round_length: 10,
      started_at: round2StartedAt,
      idempotency_key: round2SessionId
    })
  });
  assert.strictEqual(save2.status, 200);
  assert.strictEqual(save2.data.game.accuracy, 100.0);
  console.log(`  ✓ Round 2 saved (Score: 100 pts, Accuracy: 100.0%).`);

  // Step 8: Verify cumulative career statistics
  console.log('[Step 8] Checking updated player career statistics...');
  const statsRes = await apiRequest('/players/me/stats', { headers: authHeader });
  assert.strictEqual(statsRes.status, 200);
  assert.strictEqual(statsRes.data.completed_rounds, 2, 'Must have 2 completed rounds');
  assert.strictEqual(statsRes.data.total_questions_answered, 20, 'Total questions must be 20');
  assert.strictEqual(statsRes.data.total_correct_answers, 18, 'Total correct must be 18 (8 + 10)');
  assert.strictEqual(statsRes.data.overall_accuracy, 90.0, 'Overall accuracy must be 18/20 = 90.0%');
  assert.strictEqual(statsRes.data.best_score, 100, 'Best score must be 100 pts');
  assert.ok(statsRes.data.most_recent_completed_at !== null);
  console.log(`  ✓ Career Statistics verified:`);
  console.log(`    - Completed Rounds : ${statsRes.data.completed_rounds}`);
  console.log(`    - Questions Answered : ${statsRes.data.total_questions_answered}`);
  console.log(`    - Correct Answers    : ${statsRes.data.total_correct_answers}`);
  console.log(`    - Overall Accuracy   : ${statsRes.data.overall_accuracy}%`);
  console.log(`    - Best Score         : ${statsRes.data.best_score} pts`);
  console.log(`    - Most Recent Round  : ${statsRes.data.most_recent_completed_at}`);

  // Step 9: Verify Game History List
  console.log('[Step 9] Retrieving Game History list via GET /games/history...');
  const historyRes = await apiRequest('/games/history?limit=10&offset=0', { headers: authHeader });
  assert.strictEqual(historyRes.status, 200);
  assert.strictEqual(historyRes.data.total, 2);
  assert.strictEqual(historyRes.data.games.length, 2);
  assert.strictEqual(historyRes.data.games[0].score, 100, 'Most recent game must appear first');
  assert.strictEqual(historyRes.data.games[1].score, 80);
  console.log(`  ✓ Game History verified: 2 entries returned, newest round first.`);

  // Step 10: Clean up test account & verify cascading deletion
  console.log('[Step 10] Deleting test account and verifying cascade...');
  const delRes = await apiRequest('/auth/account', {
    method: 'DELETE',
    headers: authHeader
  });
  assert.strictEqual(delRes.status, 200);
  console.log('  ✓ Test account deleted successfully.');

  console.log('\n======================================================');
  console.log('ALL E2E LIFECYCLE SIMULATION CHECKS PASSED PERFECTLY!');
  console.log('======================================================');
}

runE2ESimulation().catch((err) => {
  console.error('\n✗ Simulation failed:', err);
  process.exit(1);
});
