/**
 * Bluff or Believe — Core Game Engine
 * Manages question validation, pool filtering, non-repeating randomization,
 * state machine, scoring, duplicate-submission prevention, and answer mapping.
 * Compatible with both Browser and Node.js environments.
 * Truth Pool v2: supports fandom-based question datasets loaded from data/.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js CommonJS
    module.exports = factory(require('fs'), require('path'));
  } else {
    // Browser global
    root.BluffEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (fs, path) {
  'use strict';

  // Fandom Dataset Filenames — Truth Pool v2 (categories added via these files)
  // Reflects the 11 fandom datasets in data/
  const FANDOM_DATASET_FILENAMES = [
    'ben_10_combined.json',
    'bleach_combined.json',
    'dc_combined.json',
    'demon_slayer_combined.json',
    'dragon_ball_combined.json',
    'game_of_thrones_combined.json',
    'marvel_combined.json',
    'my_hero_academia_combined.json',
    'naruto_combined.json',
    'one_piece_combined.json',
    'the_boys_combined.json'
  ];

  // Legacy aliases kept for backwards-compatibility with Node.js tests
  const ORIGINAL_DATASET_FILENAMES = FANDOM_DATASET_FILENAMES;
  const NEW_DATASET_FILENAMES = [];
  const DATASET_FILENAMES = FANDOM_DATASET_FILENAMES;

  const POINTS_PER_CORRECT_ANSWER = 10;
  const SUPPORTED_ROUND_LENGTHS = [10, 20, 50];

  /**
   * Question Adapter
   * Safely normalizes schema variations across legacy and newly added files
   * while strictly preserving all original raw fields.
   */
  const QuestionAdapter = {
    adapt(raw, sourceFile = '') {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return raw;
      }

      // Clone original properties so non-standard fields are never lost
      const adapted = Object.assign({}, raw);

      // Preserve original dataset ID
      adapted.original_id = raw.id;

      // Source filename is stored for diagnostics; per-file ID namespacing
      // is not applied here — new fandom datasets should use globally unique IDs.

      // 1. Claim field normalization
      if (!adapted.claim) {
        adapted.claim = adapted.statement || adapted.question || adapted.text || adapted.prompt || '';
      }

      // 2. Answer field normalization ('FACT' vs 'TRAP')
      if (!adapted.answer) {
        adapted.answer = adapted.verdict || adapted.status || adapted.type || adapted.fact_or_trap || '';
      }
      if (typeof adapted.answer === 'string') {
        const a = adapted.answer.trim().toUpperCase();
        if (a === 'FACT' || a === 'TRUE' || a === 'BELIEVE') {
          adapted.answer = 'FACT';
        } else if (a === 'TRAP' || a === 'MYTH' || a === 'FALSE' || a === 'BLUFF') {
          adapted.answer = 'TRAP';
        }
      }

      // 3. Category field normalization
      if (!adapted.category) {
        adapted.category = adapted.domain || adapted.topic || adapted.genre || '';
      }

      // 4. Difficulty field normalization
      if (!adapted.difficulty) {
        adapted.difficulty = adapted.level || adapted.tier || '';
      }

      // 5. Explanation field normalization
      if (!adapted.explanation) {
        adapted.explanation = adapted.rationale || adapted.reason || adapted.notes || adapted.details || '';
      }

      // 6. Source citation normalization
      if (!adapted.source_name) {
        adapted.source_name = adapted.source || adapted.citation || adapted.reference || '';
      }
      if (!adapted.source_url) {
        adapted.source_url = adapted.url || adapted.link || adapted.reference_url || '';
      }

      // Attach source filename metadata if provided
      if (sourceFile && !adapted.source_file) {
        adapted.source_file = sourceFile;
      }

      return adapted;
    }
  };

  /**
   * Question Validator
   */
  const QuestionValidator = {
    isValidUrl(url) {
      if (!url || typeof url !== 'string') return false;
      try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },

    validate(raw) {
      const errors = [];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { valid: false, errors: ['Record is not a valid JSON object'] };
      }

      // 1. Required fields
      const required = ['id', 'claim', 'answer', 'category', 'difficulty', 'explanation'];
      for (const req of required) {
        if (!(req in raw) || raw[req] === null || raw[req] === undefined) {
          errors.push(`Missing required field: ${req}`);
        } else if (typeof raw[req] === 'string' && raw[req].trim() === '') {
          errors.push(`Field '${req}' cannot be empty string`);
        }
      }

      // 2. ID check
      if (raw.id !== undefined && raw.id !== null) {
        const numId = Number(raw.id);
        if (isNaN(numId) || numId <= 0) {
          errors.push(`Invalid ID value: ${raw.id}`);
        }
      }

      // 3. Answer check (FACT or TRAP)
      if (raw.answer) {
        const normalizedAnswer = String(raw.answer).trim().toUpperCase();
        if (normalizedAnswer !== 'FACT' && normalizedAnswer !== 'TRAP') {
          errors.push(`Answer must be FACT or TRAP, got: ${raw.answer}`);
        }
      }

      // 4. Difficulty check (Easy, Medium, Hard)
      if (raw.difficulty) {
        const normDiff = String(raw.difficulty).trim().toLowerCase();
        if (!['easy', 'medium', 'hard'].includes(normDiff)) {
          errors.push(`Difficulty must be Easy, Medium, or Hard, got: ${raw.difficulty}`);
        }
      }

      // 5. Source URL check if present
      if (raw.source_url && String(raw.source_url).trim()) {
        if (!this.isValidUrl(String(raw.source_url).trim())) {
          errors.push(`Invalid source_url: ${raw.source_url}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    },

    sanitize(raw) {
      const normDiff = (function () {
        const d = String(raw.difficulty || '').trim().toLowerCase();
        return d.charAt(0).toUpperCase() + d.slice(1);
      })();

      // Retain all original raw properties (e.g. continuity, verification_status)
      return Object.assign({}, raw, {
        id: Number(raw.id),
        claim: String(raw.claim || '').trim(),
        answer: String(raw.answer || '').trim().toUpperCase(),
        category: String(raw.category || '').trim(),
        difficulty: normDiff,
        explanation: String(raw.explanation || '').trim(),
        source_name: String(raw.source_name || '').trim(),
        source_url: String(raw.source_url || '').trim()
      });
    }
  };

  /**
   * Question Loader
   */
  const QuestionLoader = {
    ORIGINAL_DATASET_FILENAMES,
    NEW_DATASET_FILENAMES,
    DATASET_FILENAMES,

    /**
     * Loads questions synchronously in Node.js
     */
    loadFromNode(dataDirectoryPath) {
      if (!fs || !path) {
        throw new Error('Node filesystem modules unavailable');
      }

      const allQuestions = [];
      const seenClaims = new Map();
      const stats = {
        filesProcessed: 0,
        totalRecordsRead: 0,
        validQuestions: 0,
        invalidQuestions: 0,
        duplicatesFound: 0,
        perFile: {},
        errors: []
      };

      for (const filename of DATASET_FILENAMES) {
        const fullPath = path.resolve(dataDirectoryPath, filename);
        if (!fs.existsSync(fullPath)) {
          stats.errors.push(`File not found: ${filename}`);
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const records = JSON.parse(content);
          stats.filesProcessed++;

          const fileStat = {
            file: filename,
            totalRecords: 0,
            validQuestions: 0,
            invalidQuestions: 0,
            errors: []
          };

          if (!Array.isArray(records)) {
            const err = `File content is not an array: ${filename}`;
            stats.errors.push(err);
            fileStat.errors.push(err);
            stats.perFile[filename] = fileStat;
            continue;
          }

          fileStat.totalRecords = records.length;
          stats.totalRecordsRead += records.length;

          for (const item of records) {
            const adapted = QuestionAdapter.adapt(item, filename);
            const val = QuestionValidator.validate(adapted);

            if (val.valid) {
              const sanitized = QuestionValidator.sanitize(adapted);
              allQuestions.push(sanitized);
              stats.validQuestions++;
              fileStat.validQuestions++;

              // Duplicate detection across pool
              const claimKey = sanitized.claim.toLowerCase();
              if (seenClaims.has(claimKey)) {
                stats.duplicatesFound++;
              } else {
                seenClaims.set(claimKey, { file: filename, id: sanitized.id });
              }
            } else {
              stats.invalidQuestions++;
              fileStat.invalidQuestions++;
              const errRecord = {
                file: filename,
                id: item && item.id,
                errors: val.errors
              };
              stats.errors.push(errRecord);
              fileStat.errors.push(errRecord);
            }
          }

          stats.perFile[filename] = fileStat;
        } catch (err) {
          const errMsg = `Error loading ${filename}: ${err.message}`;
          stats.errors.push(errMsg);
        }
      }

      return { questions: allQuestions, stats };
    },

    /**
     * Loads questions asynchronously in Browser via fetch
     */
    async loadFromBrowser(basePath = 'data') {
      const allQuestions = [];
      const seenClaims = new Map();
      const stats = {
        filesProcessed: 0,
        totalRecordsRead: 0,
        validQuestions: 0,
        invalidQuestions: 0,
        duplicatesFound: 0,
        perFile: {},
        errors: []
      };

      const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

      for (const filename of DATASET_FILENAMES) {
        const fileUrl = `${normalizedBase}/${filename}`;
        const fileStat = {
          file: filename,
          totalRecords: 0,
          validQuestions: 0,
          invalidQuestions: 0,
          errors: []
        };

        try {
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }
          const records = await response.json();
          stats.filesProcessed++;

          if (!Array.isArray(records)) {
            const err = `File content is not an array: ${filename}`;
            stats.errors.push(err);
            fileStat.errors.push(err);
            stats.perFile[filename] = fileStat;
            continue;
          }

          fileStat.totalRecords = records.length;
          stats.totalRecordsRead += records.length;

          for (const item of records) {
            const adapted = QuestionAdapter.adapt(item, filename);
            const val = QuestionValidator.validate(adapted);

            if (val.valid) {
              const sanitized = QuestionValidator.sanitize(adapted);
              allQuestions.push(sanitized);
              stats.validQuestions++;
              fileStat.validQuestions++;

              // Duplicate detection
              const claimKey = sanitized.claim.toLowerCase();
              if (seenClaims.has(claimKey)) {
                stats.duplicatesFound++;
              } else {
                seenClaims.set(claimKey, { file: filename, id: sanitized.id });
              }
            } else {
              stats.invalidQuestions++;
              fileStat.invalidQuestions++;
              const errRecord = {
                file: filename,
                id: item && item.id,
                errors: val.errors
              };
              stats.errors.push(errRecord);
              fileStat.errors.push(errRecord);
            }
          }

          stats.perFile[filename] = fileStat;
        } catch (err) {
          const errMsg = `Failed loading ${filename}: ${err.message}`;
          stats.errors.push(errMsg);
          fileStat.errors.push(errMsg);
          stats.perFile[filename] = fileStat;
        }
      }

      return { questions: allQuestions, stats };
    }
  };

  /**
   * Core Game Engine
   */
  class GameEngine {
    constructor(allQuestions = []) {
      this.masterPool = [];
      if (Array.isArray(allQuestions) && allQuestions.length > 0) {
        this.setMasterPool(allQuestions);
      }

      this.session = null;
    }

    setMasterPool(questions) {
      if (!Array.isArray(questions)) {
        throw new TypeError('Questions must be an array');
      }
      this.masterPool = questions
        .map(q => QuestionValidator.validate(q).valid ? QuestionValidator.sanitize(q) : null)
        .filter(Boolean);
    }

    getMasterPoolSize() {
      return this.masterPool.length;
    }

    getAvailableCategories() {
      const set = new Set();
      for (const q of this.masterPool) {
        if (q.category) set.add(q.category);
      }
      return Array.from(set).sort();
    }

    getAvailableDifficulties() {
      const set = new Set();
      for (const q of this.masterPool) {
        if (q.difficulty) set.add(q.difficulty);
      }
      const order = ['Easy', 'Medium', 'Hard'];
      return Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    /**
     * Non-destructive Fisher-Yates shuffle
     */
    static shuffle(array) {
      const copy = array.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
      }
      return copy;
    }

    /**
     * Start a new game session
     * @param {Object} options - { category: string, difficulty: string, roundLength: number }
     */
    startSession({ category = 'all', difficulty = 'all', roundLength = 10 } = {}) {
      if (this.masterPool.length === 0) {
        throw new Error('Cannot start game: Master question pool is empty');
      }

      // Filter pool by category
      let filtered = this.masterPool.slice();
      if (category && category !== 'all') {
        filtered = filtered.filter(q => q.category.toLowerCase() === category.toLowerCase());
      }

      // Filter pool by difficulty
      if (difficulty && difficulty !== 'all') {
        filtered = filtered.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());
      }

      if (filtered.length === 0) {
        throw new Error(`No questions match the selected filters (Category: ${category}, Difficulty: ${difficulty})`);
      }

      // Determine requested round length
      const requestedLength = Number(roundLength) || 10;
      const actualCount = Math.min(requestedLength, filtered.length);

      // Randomize without modifying original dataset
      const shuffled = GameEngine.shuffle(filtered);
      const sessionQuestions = shuffled.slice(0, actualCount);

      this.session = {
        config: {
          category,
          difficulty,
          roundLength: actualCount,
          requestedLength
        },
        questions: sessionQuestions,
        currentIndex: 0,
        score: 0,
        correctCount: 0,
        incorrectCount: 0,
        isQuestionAnswered: false,
        isGameOver: false,
        history: [] // record of each answered question
      };

      return this.getCurrentQuestion();
    }

    isSessionActive() {
      return Boolean(this.session && !this.session.isGameOver);
    }

    getCurrentQuestion() {
      if (!this.session || this.session.isGameOver) return null;
      if (this.session.currentIndex >= this.session.questions.length) {
        this.session.isGameOver = true;
        return null;
      }
      return this.session.questions[this.session.currentIndex];
    }

    getCurrentQuestionNumber() {
      if (!this.session) return 0;
      return this.session.currentIndex + 1;
    }

    getTotalQuestionsInRound() {
      if (!this.session) return 0;
      return this.session.questions.length;
    }

    /**
     * Submits an answer for the current question
     * @param {string} playerButton - 'FACT' or 'MYTH'
     */
    submitAnswer(playerButton) {
      if (!this.session) {
        throw new Error('No active game session');
      }

      if (this.session.isGameOver) {
        throw new Error('Game session is already finished');
      }

      if (this.session.isQuestionAnswered) {
        throw new Error('Duplicate submission prevented: Question has already been answered');
      }

      const currentQ = this.getCurrentQuestion();
      if (!currentQ) {
        throw new Error('No question available to answer');
      }

      const normalizedBtn = String(playerButton || '').trim().toUpperCase();
      if (normalizedBtn !== 'FACT' && normalizedBtn !== 'MYTH') {
        throw new Error("Answer must be 'FACT' or 'MYTH'");
      }

      // Map player button choice to dataset answer value:
      // 'FACT' -> 'FACT'
      // 'MYTH' -> 'TRAP'
      const mappedAnswer = normalizedBtn === 'FACT' ? 'FACT' : 'TRAP';
      const isCorrect = (mappedAnswer === currentQ.answer);

      // Scoring: 10 points for correct, 0 for incorrect
      const pointsAwarded = isCorrect ? POINTS_PER_CORRECT_ANSWER : 0;
      this.session.score += pointsAwarded;

      if (isCorrect) {
        this.session.correctCount++;
      } else {
        this.session.incorrectCount++;
      }

      // Mark as answered to lock against repeated calls
      this.session.isQuestionAnswered = true;

      const record = {
        questionId: currentQ.id,
        claim: currentQ.claim,
        playerButton: normalizedBtn,
        mappedAnswer,
        correctAnswer: currentQ.answer,
        isCorrect,
        pointsAwarded,
        currentScore: this.session.score,
        explanation: currentQ.explanation,
        category: currentQ.category,
        difficulty: currentQ.difficulty,
        source_name: currentQ.source_name,
        source_url: currentQ.source_url
      };

      this.session.history.push(record);

      return {
        isCorrect,
        pointsAwarded,
        score: this.session.score,
        playerButton: normalizedBtn,
        correctAnswer: currentQ.answer,
        correctAnswerLabel: currentQ.answer === 'FACT' ? 'FACT' : 'MYTH',
        explanation: currentQ.explanation,
        category: currentQ.category,
        difficulty: currentQ.difficulty,
        source_name: currentQ.source_name,
        source_url: currentQ.source_url,
        isLastQuestion: (this.session.currentIndex + 1 >= this.session.questions.length)
      };
    }

    /**
     * Advances to the next question
     */
    nextQuestion() {
      if (!this.session) {
        throw new Error('No active game session');
      }

      if (!this.session.isQuestionAnswered && !this.session.isGameOver) {
        throw new Error('Cannot advance: Current question has not been answered yet');
      }

      this.session.currentIndex++;
      this.session.isQuestionAnswered = false;

      if (this.session.currentIndex >= this.session.questions.length) {
        this.session.isGameOver = true;
        return null;
      }

      return this.getCurrentQuestion();
    }

    /**
     * Gets a complete progress / completion summary
     */
    getSummary() {
      if (!this.session) {
        return {
          score: 0,
          totalQuestions: 0,
          answeredCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          accuracyPercentage: 0,
          isGameOver: false
        };
      }

      const total = this.session.questions.length;
      const answered = this.session.correctCount + this.session.incorrectCount;
      const accuracy = answered > 0 ? Math.round((this.session.correctCount / answered) * 100) : 0;

      return {
        score: this.session.score,
        totalQuestions: total,
        answeredCount: answered,
        correctCount: this.session.correctCount,
        incorrectCount: this.session.incorrectCount,
        accuracyPercentage: accuracy,
        isGameOver: this.session.isGameOver,
        history: this.session.history.slice()
      };
    }

    reset() {
      this.session = null;
    }
  }

  return {
    QuestionValidator,
    QuestionAdapter,
    QuestionLoader,
    GameEngine,
    ORIGINAL_DATASET_FILENAMES,
    NEW_DATASET_FILENAMES,
    DATASET_FILENAMES,
    POINTS_PER_CORRECT_ANSWER,
    SUPPORTED_ROUND_LENGTHS
  };
});
