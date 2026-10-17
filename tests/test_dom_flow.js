/**
 * End-to-End Headless Simulation Test for UI & GameEngine Flow
 * Run with: node tests/test_dom_flow.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { GameEngine, QuestionLoader } = require('../js/gameEngine.js');

console.log('======================================================');
console.log('BLUFF OR BELIEVE — UI & ENGINE FLOW SIMULATION');
console.log('======================================================\n');

const dataDir = path.resolve(__dirname, '../data');
const { questions, stats } = QuestionLoader.loadFromNode(dataDir);

assert.strictEqual(questions.length, 900, 'Loaded 900 questions');
const engine = new GameEngine(questions);

// 1. Test Setup / Configuration
console.log('[1/4] Testing Setup Screen Configuration...');
const categories = engine.getAvailableCategories();
assert.strictEqual(categories.length, 15, '15 categories available in setup dropdown');
const difficulties = engine.getAvailableDifficulties();
assert.deepStrictEqual(difficulties, ['Easy', 'Medium', 'Hard']);
console.log('  ✓ Categories and Difficulties dynamically extracted from dataset.');

// 2. Test Game Session Initiation
console.log('[2/4] Testing Session Initialization (Round Length = 10, Mixed)...');
const firstQ = engine.startSession({ category: 'all', difficulty: 'all', roundLength: 10 });
assert.ok(firstQ !== null, 'First question rendered');
assert.strictEqual(engine.getTotalQuestionsInRound(), 10);
assert.strictEqual(engine.getCurrentQuestionNumber(), 1);
assert.strictEqual(engine.session.score, 0);
console.log(`  ✓ Question 1 loaded: "${firstQ.claim.slice(0, 55)}..." [Category: ${firstQ.category}, Diff: ${firstQ.difficulty}]`);

// 3. Test Gameplay Loop & Duplicate Submission Lock
console.log('[3/4] Simulating 10-Question Gameplay Loop with duplicate submission checks...');
let expectedScore = 0;
let expectedCorrect = 0;
let expectedIncorrect = 0;

for (let i = 1; i <= 10; i++) {
  const q = engine.getCurrentQuestion();
  assert.ok(q, `Question ${i} should be active`);

  // Choose correct answer on even turns, incorrect on odd turns
  const shouldBeCorrect = (i % 2 === 0);
  const playerBtn = shouldBeCorrect
    ? (q.answer === 'FACT' ? 'FACT' : 'MYTH')
    : (q.answer === 'FACT' ? 'MYTH' : 'FACT');

  const result = engine.submitAnswer(playerBtn);
  assert.strictEqual(result.isCorrect, shouldBeCorrect);

  if (shouldBeCorrect) {
    expectedScore += 10;
    expectedCorrect++;
  } else {
    expectedIncorrect++;
  }

  assert.strictEqual(engine.session.score, expectedScore, `Score should match expected ${expectedScore}`);

  // Test duplicate submission guard: Calling submitAnswer again MUST fail and NOT change score
  assert.throws(() => {
    engine.submitAnswer('FACT');
  }, /Duplicate submission prevented/, 'Must block repeated submissions');
  assert.strictEqual(engine.session.score, expectedScore, 'Score must not change on duplicate submission');

  // Verify feedback payload
  assert.ok(result.explanation.length > 0, 'Explanation present in feedback');
  assert.ok(result.source_name.length > 0, 'Source name present in feedback');
  assert.ok(result.source_url.length > 0, 'Source URL present in feedback');

  // Advance to next question
  const nextQ = engine.nextQuestion();
  if (i < 10) {
    assert.ok(nextQ !== null, `Question ${i + 1} should exist`);
    assert.strictEqual(engine.getCurrentQuestionNumber(), i + 1);
  } else {
    assert.strictEqual(nextQ, null, 'Game should conclude after 10th question');
  }
}
console.log('  ✓ 10-Question round completed with full feedback and duplicate prevention.');

// 4. Test Completion Screen Summary
console.log('[4/4] Verifying Final Completion Screen Summary...');
const summary = engine.getSummary();
assert.strictEqual(summary.isGameOver, true, 'isGameOver must be true');
assert.strictEqual(summary.totalQuestions, 10, 'Total questions must be 10');
assert.strictEqual(summary.answeredCount, 10, 'Answered count must be 10');
assert.strictEqual(summary.correctCount, expectedCorrect, `Correct answers must be ${expectedCorrect}`);
assert.strictEqual(summary.incorrectCount, expectedIncorrect, `Incorrect answers must be ${expectedIncorrect}`);
assert.strictEqual(summary.score, expectedScore, `Final score must be ${expectedScore}`);
assert.strictEqual(summary.accuracyPercentage, 50, 'Accuracy should be 50%');
console.log(`  ✓ Summary stats verified: Final Score: ${summary.score} pts, Accuracy: ${summary.accuracyPercentage}%, Correct: ${summary.correctCount}, Incorrect: ${summary.incorrectCount}`);

console.log('\n======================================================');
console.log('ALL SIMULATION CHECKS PASSED SUCCESSFULLY!');
console.log('======================================================');
