/**
 * Automated Test Suite for Bluff or Believe Game Engine
 * Run with: node tests/test_game_engine.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { GameEngine, QuestionLoader, QuestionValidator } = require('../js/gameEngine.js');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAllTests() {
  console.log('======================================================');
  console.log('BLUFF OR BELIEVE — GAME ENGINE AUTOMATED TESTS');
  console.log('======================================================\n');

  const dataDir = path.resolve(__dirname, '../data');

  // Test 1: QuestionLoader handles empty data/ gracefully
  test('QuestionLoader handles empty data/ gracefully (dataset reset state)', () => {
    const { questions, stats } = QuestionLoader.loadFromNode(dataDir);
    assert.ok(Array.isArray(questions), 'questions is an array');
    assert.strictEqual(stats.invalidQuestions, 0, 'Zero invalid records when empty');
    // filesProcessed will be 0 when data/ is empty — that is correct and expected
    assert.ok(stats.filesProcessed >= 0, 'filesProcessed is non-negative');
  });

  const { questions: masterQuestions } = QuestionLoader.loadFromNode(dataDir);
  const engine = new GameEngine(masterQuestions);

  // Test 2: Engine initialization & Pool size (data-dependent)
  if (masterQuestions.length > 0) {
    test('GameEngine initializes with correct master pool size and categories', () => {
      assert.ok(engine.getMasterPoolSize() > 0, 'Pool size greater than 0 when data loaded');
      const categories = engine.getAvailableCategories();
      assert.ok(categories.length > 0, 'Categories present when data loaded');
      const difficulties = engine.getAvailableDifficulties();
      assert.deepStrictEqual(difficulties, ['Easy', 'Medium', 'Hard']);
    });
  } else {
    test('GameEngine initializes with empty pool (correct reset state)', () => {
      assert.strictEqual(engine.getMasterPoolSize(), 0, 'Pool size is 0 in reset state');
      assert.deepStrictEqual(engine.getAvailableCategories(), [], 'No categories when pool empty');
      assert.deepStrictEqual(engine.getAvailableDifficulties(), [], 'No difficulties when pool empty');
    });
  }

  // Test 3: Gameplay Answer Mapping & Scoring
  test('Correct FACT answer awards 10 points and updates score', () => {
    const mockEngine = new GameEngine([
      {
        id: 1001,
        claim: 'Sun is a star.',
        answer: 'FACT',
        category: 'Science',
        difficulty: 'Easy',
        explanation: 'Sun is classified as G-type main-sequence star.',
        source_name: 'NASA',
        source_url: 'https://nasa.gov'
      }
    ]);

    mockEngine.startSession({ roundLength: 10 });
    const result = mockEngine.submitAnswer('FACT');
    assert.strictEqual(result.isCorrect, true);
    assert.strictEqual(result.pointsAwarded, 10);
    assert.strictEqual(result.score, 10);
    assert.strictEqual(mockEngine.getSummary().score, 10);
    assert.strictEqual(mockEngine.getSummary().correctCount, 1);
    assert.strictEqual(mockEngine.getSummary().incorrectCount, 0);
  });

  test('Correct MYTH answer awards 10 points on TRAP dataset record', () => {
    const mockEngine = new GameEngine([
      {
        id: 1002,
        claim: 'Humans use only 10% of their brains.',
        answer: 'TRAP',
        category: 'Psychology',
        difficulty: 'Easy',
        explanation: 'Neuroimaging shows full brain activity.',
        source_name: 'Scientific American',
        source_url: 'https://scientificamerican.com'
      }
    ]);

    mockEngine.startSession({ roundLength: 10 });
    const result = mockEngine.submitAnswer('MYTH'); // 'MYTH' maps to 'TRAP'
    assert.strictEqual(result.isCorrect, true);
    assert.strictEqual(result.pointsAwarded, 10);
    assert.strictEqual(result.score, 10);
  });

  test('Incorrect answer awards 0 points', () => {
    const mockEngine = new GameEngine([
      {
        id: 1003,
        claim: 'Water boils at 100C everywhere.',
        answer: 'TRAP',
        category: 'Science',
        difficulty: 'Medium',
        explanation: 'Boiling point depends on atmospheric pressure.',
        source_name: 'Britannica',
        source_url: 'https://britannica.com'
      }
    ]);

    mockEngine.startSession({ roundLength: 10 });
    const result = mockEngine.submitAnswer('FACT'); // wrong choice
    assert.strictEqual(result.isCorrect, false);
    assert.strictEqual(result.pointsAwarded, 0);
    assert.strictEqual(result.score, 0);
    assert.strictEqual(mockEngine.getSummary().correctCount, 0);
    assert.strictEqual(mockEngine.getSummary().incorrectCount, 1);
  });

  // Test 4: Duplicate Submission Prevention
  test('Duplicate submission on the same question is prevented and rejects double points', () => {
    const mockEngine = new GameEngine([
      {
        id: 1004,
        claim: 'Sound travels in a vacuum.',
        answer: 'TRAP',
        category: 'Science',
        difficulty: 'Easy',
        explanation: 'Sound requires a medium.',
        source_name: 'Science',
        source_url: 'https://example.org'
      }
    ]);

    mockEngine.startSession({ roundLength: 10 });
    mockEngine.submitAnswer('MYTH'); // first submission (+10 pts)
    assert.strictEqual(mockEngine.getSummary().score, 10);

    // Attempt second submission on the same question
    let errorThrown = false;
    try {
      mockEngine.submitAnswer('MYTH');
    } catch (e) {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, true, 'Must throw error on duplicate submission');
    // Score must remain 10, not 20!
    assert.strictEqual(mockEngine.getSummary().score, 10, 'Score must not increase on duplicate submission');
  });

  // Test 5: Category Filtering (data-dependent)
  if (masterQuestions.length > 0) {
    const firstCategory = engine.getAvailableCategories()[0];
    test('Category filtering selects only questions matching requested category', () => {
      engine.startSession({ category: firstCategory, roundLength: 10 });
      const sessionQuestions = engine.session.questions;
      assert.ok(sessionQuestions.length > 0);
      for (const q of sessionQuestions) {
        assert.strictEqual(q.category, firstCategory);
      }
    });
  } else {
    test('Category filtering skipped: empty pool in reset state', () => {
      assert.throws(
        () => engine.startSession({ category: 'Marvel Universe', roundLength: 10 }),
        /empty/i,
        'startSession throws on empty pool'
      );
    });
  }

  // Test 6: Difficulty Filtering (data-dependent)
  if (masterQuestions.length > 0) {
    test('Difficulty filtering selects only questions matching requested difficulty', () => {
      engine.startSession({ difficulty: 'Hard', roundLength: 10 });
      const sessionQuestions = engine.session.questions;
      assert.ok(sessionQuestions.length > 0);
      for (const q of sessionQuestions) {
        assert.strictEqual(q.difficulty, 'Hard');
      }
    });
  } else {
    test('Difficulty filtering skipped: empty pool in reset state', () => {
      assert.throws(
        () => engine.startSession({ difficulty: 'Hard', roundLength: 10 }),
        /empty/i,
        'startSession throws on empty pool'
      );
    });
  }

  // Test 7: Supported Round Lengths (10, 20, 50) and No Repeating Questions (data-dependent)
  if (masterQuestions.length >= 50) {
    test('Round lengths 10, 20, 50 yield correct non-repeating question counts', () => {
      for (const length of [10, 20, 50]) {
        engine.startSession({ roundLength: length });
        assert.strictEqual(engine.getTotalQuestionsInRound(), length);

        // Verify no duplicate IDs within the round
        const seenIds = new Set();
        for (const q of engine.session.questions) {
          assert.ok(!seenIds.has(q.id), `Question ID ${q.id} repeated within round of length ${length}`);
          seenIds.add(q.id);
        }
      }
    });
  } else {
    test('Round lengths skipped: pool too small in reset state', () => {
      assert.throws(
        () => engine.startSession({ roundLength: 10 }),
        /empty/i,
        'startSession throws on empty pool'
      );
    });
  }

  // Test 8: Full Session Lifecycle & Completion Screen Stats
  test('Complete session lifecycle: Question progression, completion, and accuracy calculation', () => {
    const mockEngine = new GameEngine([
      { id: 1, claim: 'Claim 1', answer: 'FACT', category: 'General', difficulty: 'Easy', explanation: 'E1', source_name: 'S', source_url: 'https://s.org' },
      { id: 2, claim: 'Claim 2', answer: 'TRAP', category: 'General', difficulty: 'Easy', explanation: 'E2', source_name: 'S', source_url: 'https://s.org' },
      { id: 3, claim: 'Claim 3', answer: 'FACT', category: 'General', difficulty: 'Easy', explanation: 'E3', source_name: 'S', source_url: 'https://s.org' },
      { id: 4, claim: 'Claim 4', answer: 'TRAP', category: 'General', difficulty: 'Easy', explanation: 'E4', source_name: 'S', source_url: 'https://s.org' }
    ]);

    mockEngine.startSession({ roundLength: 4 });
    assert.strictEqual(mockEngine.getCurrentQuestionNumber(), 1);

    // Q1: Correct
    const q1 = mockEngine.getCurrentQuestion();
    const btn1 = q1.answer === 'FACT' ? 'FACT' : 'MYTH';
    mockEngine.submitAnswer(btn1);
    mockEngine.nextQuestion();

    // Q2: Incorrect
    const q2 = mockEngine.getCurrentQuestion();
    const btn2 = q2.answer === 'FACT' ? 'MYTH' : 'FACT'; // wrong button
    mockEngine.submitAnswer(btn2);
    mockEngine.nextQuestion();

    // Q3: Correct
    const q3 = mockEngine.getCurrentQuestion();
    const btn3 = q3.answer === 'FACT' ? 'FACT' : 'MYTH';
    mockEngine.submitAnswer(btn3);
    mockEngine.nextQuestion();

    // Q4: Correct
    const q4 = mockEngine.getCurrentQuestion();
    const btn4 = q4.answer === 'FACT' ? 'FACT' : 'MYTH';
    mockEngine.submitAnswer(btn4);
    const nextResult = mockEngine.nextQuestion(); // game ends

    assert.strictEqual(nextResult, null, 'nextQuestion returns null on game over');
    assert.strictEqual(mockEngine.isSessionActive(), false, 'Session is not active after last question');

    const summary = mockEngine.getSummary();
    assert.strictEqual(summary.totalQuestions, 4);
    assert.strictEqual(summary.answeredCount, 4);
    assert.strictEqual(summary.correctCount, 3);
    assert.strictEqual(summary.incorrectCount, 1);
    assert.strictEqual(summary.score, 30);
    assert.strictEqual(summary.accuracyPercentage, 75); // 3 / 4 * 100 = 75%
    assert.strictEqual(summary.isGameOver, true);
  });

  // Test 9: Malformed and Missing Fields Validation
  test('Validator detects malformed records, missing fields, and bad types', () => {
    // Missing required field
    const r1 = QuestionValidator.validate({ id: 1, claim: 'test', answer: 'FACT', category: 'C' });
    assert.strictEqual(r1.valid, false);

    // Invalid answer value
    const r2 = QuestionValidator.validate({
      id: 2, claim: 'test', answer: 'MAYBE', category: 'C', difficulty: 'Easy', explanation: 'E'
    });
    assert.strictEqual(r2.valid, false);

    // Non-numeric ID
    const r3 = QuestionValidator.validate({
      id: 'abc', claim: 'test', answer: 'FACT', category: 'C', difficulty: 'Easy', explanation: 'E'
    });
    assert.strictEqual(r3.valid, false);

    // Empty claim
    const r4 = QuestionValidator.validate({
      id: 4, claim: '   ', answer: 'FACT', category: 'C', difficulty: 'Easy', explanation: 'E'
    });
    assert.strictEqual(r4.valid, false);
  });

  // Test 10: Fandom Dataset Registry Integrity Check
  test('Fandom dataset filenames are registered; old general-knowledge files removed', () => {
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

    // Legacy NEW_DATASET_FILENAMES alias should be empty after full reset
    assert.deepStrictEqual(
      QuestionLoader.NEW_DATASET_FILENAMES,
      [],
      'NEW_DATASET_FILENAMES is empty after dataset reset'
    );

    // Old filenames must not be registered
    const removed = ['everyday_knowledge.json', 'geography.json', 'cartoon_fact_or_trap.json', 'dc_fact_or_trap.json', 'marvel_fact_or_trap.json'];
    for (const fn of removed) {
      assert.ok(
        !QuestionLoader.DATASET_FILENAMES.includes(fn),
        `${fn} must NOT be registered after reset`
      );
    }
  });

  console.log('\n------------------------------------------------------');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
