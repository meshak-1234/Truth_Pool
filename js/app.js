/**
 * Truth Pool — Application UI Controller
 * Binds DOM events, controls view transitions, and interfaces with GameEngine,
 * Fandom Selection, Personal Player Dashboard, and Fandom Badges modules.
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // DOM Elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingMessage = document.getElementById('loading-message');
  const datasetStatus = document.getElementById('dataset-status');

  // Views
  const viewLanding = document.getElementById('view-landing');
  const viewSetup = document.getElementById('view-setup');
  const viewArena = document.getElementById('view-arena');
  const viewCompletion = document.getElementById('view-completion');
  const viewBadges = document.getElementById('view-badges');
  const viewDashboard = document.getElementById('view-dashboard');
  const dashboardContainer = document.getElementById('dashboard-container');

  // Landing & Navigation Elements
  const btnStartPlaying = document.getElementById('btn-start-playing');
  const btnLandingHowToPlay = document.getElementById('btn-landing-how-to-play');
  const btnBackToLanding = document.getElementById('btn-back-to-landing');
  const btnBadgesBackLanding = document.getElementById('btn-badges-back-landing');
  const btnCompletionViewBadges = document.getElementById('btn-completion-view-badges');
  const headerLogoGroup = document.getElementById('header-logo-group');
  const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');

  // Navigation Links
  const navHome = document.getElementById('nav-home');
  const navPlay = document.getElementById('nav-play');
  const navBadges = document.getElementById('nav-badges');
  const navDashboard = document.getElementById('nav-dashboard');
  const navAbout = document.getElementById('nav-about');

  // About / How to Play Modal Elements
  const aboutModal = document.getElementById('about-modal');
  const aboutModalClose = document.getElementById('about-modal-close');
  const aboutModalBackdrop = document.getElementById('about-modal-backdrop');
  const btnAboutPlayNow = document.getElementById('btn-about-play-now');

  // Fandom Selection Form Elements
  const fandomsGrid = document.getElementById('fandoms-grid');
  const fandomSearchInput = document.getElementById('fandom-search-input');
  const btnPlayAllFandoms = document.getElementById('btn-play-all-fandoms');
  const categorySelect = document.getElementById('category-select');
  const difficultySelect = document.getElementById('difficulty-select');
  const roundPillContainer = document.getElementById('round-length-pills');
  const startGameBtn = document.getElementById('start-game-btn');

  // Arena Elements
  const categoryBadge = document.getElementById('category-badge');
  const difficultyBadge = document.getElementById('difficulty-badge');
  const currentScoreElem = document.getElementById('current-score');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const questionCounterElem = document.getElementById('question-counter');
  const claimTextElem = document.getElementById('claim-text');
  const btnFact = document.getElementById('btn-fact');
  const btnMyth = document.getElementById('btn-myth');
  const btnArenaExit = document.getElementById('btn-arena-exit');
  const arenaStreakVal = document.getElementById('arena-streak-val');
  const arenaExitModal = document.getElementById('arena-exit-modal');
  const arenaExitBackdrop = document.getElementById('arena-exit-backdrop');
  const btnArenaCancelExit = document.getElementById('btn-arena-cancel-exit');
  const btnArenaConfirmExit = document.getElementById('btn-arena-confirm-exit');

  // Feedback Section
  const feedbackContainer = document.getElementById('feedback-container');
  const feedbackCard = document.getElementById('feedback-card');
  const feedbackTitle = document.getElementById('feedback-title');
  const correctAnswerPill = document.getElementById('correct-answer-pill');
  const explanationTextElem = document.getElementById('explanation-text');
  const sourceNameElem = document.getElementById('source-name');
  const sourceLinkElem = document.getElementById('source-link');
  const nextQuestionBtn = document.getElementById('next-question-btn');

  // Completion Screen
  const finalScoreElem = document.getElementById('final-score');
  const statCorrectElem = document.getElementById('stat-correct');
  const statIncorrectElem = document.getElementById('stat-incorrect');
  const statAccuracyElem = document.getElementById('stat-accuracy');
  const playAgainBtn = document.getElementById('play-again-btn');
  const returnHomeBtn = document.getElementById('return-home-btn');
  const completionSaveStatus = document.getElementById('completion-save-status');

  // State
  let engine = null;
  let selectedRoundLength = 10;
  let lastSessionConfig = null;
  let currentSessionId = null;
  let currentSessionStartedAt = null;
  let sessionSaved = false;
  let currentStreak = 0;
  let bestRoundStreak = 0;

  function updateStreakUI() {
    if (arenaStreakVal) {
      arenaStreakVal.textContent = currentStreak;
      const streakBox = document.getElementById('arena-streak-box');
      if (streakBox) {
        if (currentStreak >= 3) {
          streakBox.style.borderColor = 'rgba(239, 68, 68, 0.7)';
          streakBox.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.4)';
        } else {
          streakBox.style.borderColor = 'rgba(245, 158, 11, 0.35)';
          streakBox.style.boxShadow = 'none';
        }
      }
    }
  }

  // View Switcher
  function showView(targetView) {
    [viewLanding, viewSetup, viewArena, viewCompletion, viewBadges, viewDashboard].forEach(v => {
      if (!v) return;
      if (v === targetView) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update nav links active state
    if (navHome) navHome.classList.toggle('active', targetView === viewLanding);
    if (navPlay) navPlay.classList.toggle('active', targetView === viewSetup);
    if (navBadges) navBadges.classList.toggle('active', targetView === viewBadges);
    if (navDashboard) navDashboard.classList.toggle('active', targetView === viewDashboard);

    // Refresh components on view entry
    if (targetView === viewSetup && window.TruthPoolFandomSelection && fandomsGrid) {
      window.TruthPoolFandomSelection.refresh(fandomsGrid, engine, launchFandom);
    }
    if (targetView === viewBadges && window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.loadAndRender === 'function') {
      window.TruthPoolFandomBadges.loadAndRender();
    }
    if (targetView === viewDashboard && window.TruthPoolDashboard && typeof window.TruthPoolDashboard.loadAndRender === 'function') {
      window.TruthPoolDashboard.loadAndRender(dashboardContainer);
    }

    // Manage 3D landing animation loop
    if (window.BluffLanding3D) {
      if (targetView === viewLanding) {
        window.BluffLanding3D.resume();
      } else {
        window.BluffLanding3D.pause();
      }
    }
  }
  window.showView = showView;

  // Round length pill handlers
  if (roundPillContainer) {
    roundPillContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRoundLength = Number(btn.dataset.length) || 10;
    });
  }

  // Launch Fandom Game Session
  function launchFandom(fandomName) {
    if (!engine) return;
    const category = fandomName || (categorySelect ? categorySelect.value : 'all');
    const difficulty = difficultySelect ? difficultySelect.value : 'all';
    const roundLength = selectedRoundLength;

    lastSessionConfig = { category, difficulty, roundLength };
    currentSessionId = 'rnd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    currentSessionStartedAt = new Date().toISOString();
    sessionSaved = false;
    currentStreak = 0;
    bestRoundStreak = 0;
    updateStreakUI();

    try {
      engine.startSession({ category, difficulty, roundLength });
      showView(viewArena);
      renderCurrentQuestion();
    } catch (err) {
      alert(`Could not start game: ${err.message}`);
    }
  }
  window.TruthPoolLaunchFandom = launchFandom;

  // Live Fandom Search Filter
  if (fandomSearchInput && fandomsGrid) {
    fandomSearchInput.addEventListener('input', (e) => {
      if (window.TruthPoolFandomSelection) {
        window.TruthPoolFandomSelection.setSearchQuery(e.target.value, fandomsGrid, engine, launchFandom);
      }
    });
  }

  // Mix All Fandoms Button Handler
  if (btnPlayAllFandoms) {
    btnPlayAllFandoms.addEventListener('click', () => {
      launchFandom('all');
    });
  }

  // Load Questions & Initialize Engine
  async function initializeGame() {
    try {
      loadingMessage.textContent = 'Loading fandom question datasets...';
      const { questions, stats } = await window.BluffEngine.QuestionLoader.loadFromBrowser('data');

      if (!questions || questions.length === 0) {
        datasetStatus.textContent = 'No Questions Available';
        loadingMessage.innerHTML = `
          <span style="color: #f59e0b; font-size: 1.05rem; font-weight: 700;">📭 No questions loaded yet.</span><br>
          <span style="color: #94a3b8; font-size: 0.9rem;">
            The fandom question datasets have not been added yet.<br>
            Add JSON files to the <code>data/</code> folder and reload to start playing.
          </span>
        `;
        if (categorySelect) categorySelect.innerHTML = '<option value="all">All Categories (Mixed)</option>';
        if (startGameBtn) {
          startGameBtn.disabled = true;
          startGameBtn.title = 'No questions available';
        }
        loadingOverlay.style.display = 'none';
        return;
      }

      engine = new window.BluffEngine.GameEngine(questions);
      datasetStatus.textContent = `${engine.getMasterPoolSize()} Questions Ready`;
      console.log(`[Truth Pool] Loaded ${stats.validQuestions} valid questions across ${stats.filesProcessed} datasets:`, stats.perFile);

      // Populate Categories dynamically
      if (categorySelect) {
        const categories = engine.getAvailableCategories();
        categorySelect.innerHTML = '<option value="all">All Categories (Mixed)</option>';
        for (const cat of categories) {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          categorySelect.appendChild(opt);
        }
      }

      // Render 11 Fandom Selection Cards
      if (window.TruthPoolFandomSelection && fandomsGrid) {
        window.TruthPoolFandomSelection.renderFandomsGrid(fandomsGrid, engine, launchFandom);
        window.TruthPoolFandomSelection.fetchUserProgress().then(() => {
          window.TruthPoolFandomSelection.renderFandomsGrid(fandomsGrid, engine, launchFandom);
        });
      }

      if (startGameBtn) {
        startGameBtn.disabled = false;
        startGameBtn.title = '';
      }

      loadingOverlay.style.display = 'none';
    } catch (err) {
      console.error('Initialization error:', err);
      loadingMessage.innerHTML = `
        <span style="color: #f87171;">Error loading questions:</span><br>
        ${err.message}<br><br>
        <small style="color: #94a3b8;">Ensure the server is running (e.g. <code>python server.py</code>).</small>
      `;
    }
  }

  // Render Current Question in Arena
  function renderCurrentQuestion() {
    const q = engine.getCurrentQuestion();
    if (!q) {
      renderCompletionScreen();
      return;
    }

    const currentNum = engine.getCurrentQuestionNumber();
    const totalNum = engine.getTotalQuestionsInRound();
    const progressPercent = ((currentNum - 1) / totalNum) * 100;

    // Badges & Counters
    categoryBadge.textContent = q.category;
    difficultyBadge.textContent = q.difficulty;
    difficultyBadge.className = `badge badge-difficulty-${q.difficulty.toLowerCase()}`;
    questionCounterElem.textContent = `Question ${currentNum} of ${totalNum}`;
    progressBarFill.style.width = `${progressPercent}%`;
    currentScoreElem.textContent = engine.session.score;
    updateStreakUI();

    // Claim
    claimTextElem.textContent = q.claim;

    // Reset Answer Buttons
    btnFact.disabled = false;
    btnFact.innerHTML = '<span class="icon">✓</span> FACT <span class="kbd-hint">[F]</span>';
    btnMyth.disabled = false;
    btnMyth.innerHTML = '<span class="icon">✕</span> TRAP <span class="kbd-hint">[T]</span>';

    // Hide Feedback
    feedbackContainer.style.display = 'none';
  }

  // Handle Answer Click
  function handleAnswer(buttonChoice) {
    if (!engine || !engine.isSessionActive()) return;

    // Prevent double submission immediately by disabling buttons
    btnFact.disabled = true;
    btnMyth.disabled = true;

    try {
      const result = engine.submitAnswer(buttonChoice);

      // Streak update
      if (result.isCorrect) {
        currentStreak++;
        if (currentStreak > bestRoundStreak) bestRoundStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
      updateStreakUI();

      // Update Live Score
      currentScoreElem.textContent = result.score;

      // Update Progress bar to include this completed question
      const currentNum = engine.getCurrentQuestionNumber();
      const totalNum = engine.getTotalQuestionsInRound();
      progressBarFill.style.width = `${(currentNum / totalNum) * 100}%`;

      // Style Feedback with Truth Pool terminology
      feedbackCard.className = `card feedback-card ${result.isCorrect ? 'correct' : 'incorrect'}`;
      feedbackTitle.innerHTML = result.isCorrect
        ? '✓ Spot On! <span style="font-size: 0.9rem; opacity: 0.85;">(+10 Points)</span>'
        : '✕ Caught in the Trap! <span style="font-size: 0.9rem; opacity: 0.85;">(0 Points)</span>';

      const displayAnswer = result.correctAnswerLabel === 'MYTH' ? 'TRAP' : 'FACT';
      correctAnswerPill.textContent = `Answer: ${displayAnswer}`;
      explanationTextElem.textContent = result.explanation;

      // Source Link
      if (result.source_name) {
        sourceNameElem.textContent = result.source_name;
        sourceNameElem.parentElement.style.display = 'flex';
      } else {
        sourceNameElem.parentElement.style.display = 'none';
      }

      if (result.source_url) {
        sourceLinkElem.href = result.source_url;
        sourceLinkElem.style.display = 'inline';
      } else {
        sourceLinkElem.style.display = 'none';
      }

      // Next button text
      if (result.isLastQuestion) {
        nextQuestionBtn.innerHTML = 'View Round Results → <span class="kbd-hint">[Enter]</span>';
      } else {
        nextQuestionBtn.innerHTML = 'Next Question → <span class="kbd-hint">[Enter]</span>';
      }

      // Record fandom question completion asynchronously in backend if authenticated
      const lastRecord = engine.session && engine.session.history && engine.session.history.length > 0
        ? engine.session.history[engine.session.history.length - 1]
        : null;
      const qId = lastRecord ? lastRecord.questionId : null;
      const qFandom = lastRecord ? lastRecord.category : result.category;

      if (qId && qFandom && window.BluffAuth && window.BluffAuth.AuthService) {
        window.BluffAuth.AuthService.recordQuestionCompleted(qFandom, qId)
          .then((resp) => {
            if (resp && resp.newly_unlocked_badges && resp.newly_unlocked_badges.length > 0) {
              for (const badge of resp.newly_unlocked_badges) {
                if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.showBadgeCelebration === 'function') {
                  window.TruthPoolFandomBadges.showBadgeCelebration(badge);
                } else if (window.BluffAchievements && typeof window.BluffAchievements.showUnlockToast === 'function') {
                  window.BluffAchievements.showUnlockToast({
                    icon: '🏅',
                    title: `Badge Unlocked: ${badge.title}`,
                    description: `${badge.fandom_id} (Tier ${badge.badge_tier}) — ${badge.description}`
                  });
                }
              }
            }
          })
          .catch((err) => {
            console.warn('[Truth Pool] Non-fatal fandom progress recording error:', err);
          });
      }

      // Show Feedback Card
      feedbackContainer.style.display = 'block';
    } catch (err) {
      console.error('Answer submission error:', err);
      alert(err.message);
    }
  }

  // Next Question Button
  nextQuestionBtn.addEventListener('click', () => {
    try {
      const nextQ = engine.nextQuestion();
      if (nextQ) {
        renderCurrentQuestion();
      } else {
        renderCompletionScreen();
      }
    } catch (err) {
      console.error('Next question error:', err);
    }
  });

  // Arena Exit Modal Handlers
  if (btnArenaExit) {
    btnArenaExit.addEventListener('click', () => {
      if (arenaExitModal) arenaExitModal.style.display = 'flex';
    });
  }
  if (btnArenaCancelExit) {
    btnArenaCancelExit.addEventListener('click', () => {
      if (arenaExitModal) arenaExitModal.style.display = 'none';
    });
  }
  if (arenaExitBackdrop) {
    arenaExitBackdrop.addEventListener('click', () => {
      if (arenaExitModal) arenaExitModal.style.display = 'none';
    });
  }
  if (btnArenaConfirmExit) {
    btnArenaConfirmExit.addEventListener('click', () => {
      if (arenaExitModal) arenaExitModal.style.display = 'none';
      if (engine && engine.session) {
        engine.session.isGameOver = true;
      }
      showView(viewSetup);
    });
  }

  // Save Completed Round to Backend if Authenticated
  async function saveCompletedRound(sessionId, startedAt) {
    if (!completionSaveStatus) return;

    const session = window.BluffAuth && window.BluffAuth.SessionManager ? window.BluffAuth.SessionManager.get() : null;

    if (!session || !session.access_token) {
      completionSaveStatus.innerHTML = `
        <span class="save-status-guest">
          💡 Playing as guest. <a href="#" id="link-guest-signin">Sign in</a> to save your scores and track statistics across rounds.
        </span>
      `;
      const signinLink = document.getElementById('link-guest-signin');
      if (signinLink) {
        signinLink.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.BluffAuth && window.BluffAuth.openModal) {
            window.BluffAuth.openModal('login');
          }
        });
      }
      return;
    }

    completionSaveStatus.innerHTML = `
      <span class="save-status-saving">
        <span class="spinner-sm"></span> Saving round to your history...
      </span>
    `;

    try {
      const summary = engine.getSummary();
      const payload = {
        score: summary.score,
        questions_answered: summary.answeredCount,
        correct_answers: summary.correctCount,
        category: lastSessionConfig && lastSessionConfig.category !== 'all' ? lastSessionConfig.category : null,
        difficulty: lastSessionConfig && lastSessionConfig.difficulty !== 'all' ? lastSessionConfig.difficulty : null,
        round_length: lastSessionConfig ? lastSessionConfig.roundLength : summary.totalQuestions,
        started_at: startedAt || null,
        idempotency_key: sessionId
      };

      const saveResult = await window.BluffAuth.AuthService.saveGameRound(payload);

      // Display XP earned and level progress
      if (saveResult && saveResult.xp && window.BluffXP && typeof window.BluffXP.displayCompletionXP === 'function') {
        window.BluffXP.displayCompletionXP(saveResult.xp);
      }

      // Handle achievements unlocked from this round
      if (saveResult && saveResult.achievements && window.BluffAchievements && typeof window.BluffAchievements.handleRoundCompletionAchievements === 'function') {
        window.BluffAchievements.handleRoundCompletionAchievements(saveResult.achievements);
      }

      completionSaveStatus.innerHTML = `
        <span class="save-status-success">
          ✓ Round saved to your history!
          <button type="button" id="btn-completion-view-stats" class="btn-link-action">View My Dashboard →</button>
        </span>
      `;

      const viewStatsBtn = document.getElementById('btn-completion-view-stats');
      if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
          showView(viewDashboard);
        });
      }

      if (window.BluffAuth && window.BluffAuth.syncHeaderState) {
        window.BluffAuth.syncHeaderState();
      }

    } catch (err) {
      console.warn('Game result persistence failed:', err);
      completionSaveStatus.innerHTML = `
        <span class="save-status-error">
          ⚠️ Could not save round (${err.message}).
          <button type="button" id="btn-retry-save-round" class="btn-link-action">Retry</button>
        </span>
      `;
      const retryBtn = document.getElementById('btn-retry-save-round');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          saveCompletedRound(sessionId, startedAt);
        });
      }
    }
  }

  // Render Completion Screen
  function renderCompletionScreen() {
    const summary = engine.getSummary();
    finalScoreElem.textContent = summary.score;
    statCorrectElem.textContent = summary.correctCount;
    statIncorrectElem.textContent = summary.incorrectCount;
    statAccuracyElem.textContent = `${summary.accuracyPercentage}%`;
    progressBarFill.style.width = '100%';

    const xpSection = document.getElementById('completion-xp-section');
    if (xpSection) xpSection.style.display = 'none';

    showView(viewCompletion);

    if (!sessionSaved) {
      sessionSaved = true;
      saveCompletedRound(currentSessionId, currentSessionStartedAt);
    }
  }

  // Start Game Button Handler (Backwards Compatibility)
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      const cat = categorySelect ? categorySelect.value : 'all';
      launchFandom(cat);
    });
  }

  // Play Again Button Handler
  playAgainBtn.addEventListener('click', () => {
    if (!engine || !lastSessionConfig) return;

    currentSessionId = 'rnd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    currentSessionStartedAt = new Date().toISOString();
    sessionSaved = false;
    currentStreak = 0;
    bestRoundStreak = 0;
    updateStreakUI();

    try {
      engine.startSession(lastSessionConfig);
      showView(viewArena);
      renderCurrentQuestion();
    } catch (err) {
      alert(`Could not restart game: ${err.message}`);
    }
  });

  // Return Home Button Handler (Completion -> Landing)
  returnHomeBtn.addEventListener('click', () => {
    showView(viewLanding);
    if (window.BluffAuth && window.BluffAuth.syncHeaderState) {
      window.BluffAuth.syncHeaderState();
    }
  });

  // Start Playing Hero Button Handler -> Fandom Selection
  if (btnStartPlaying) {
    btnStartPlaying.addEventListener('click', () => {
      showView(viewSetup);
    });
  }

  // How to Play Hero Button Handler
  if (btnLandingHowToPlay) {
    btnLandingHowToPlay.addEventListener('click', () => {
      openAboutModal();
    });
  }

  // Return to Landing from Setup View
  if (btnBackToLanding) {
    btnBackToLanding.addEventListener('click', () => {
      showView(viewLanding);
    });
  }

  // Header Logo Group click -> Return to Landing
  if (headerLogoGroup) {
    headerLogoGroup.addEventListener('click', () => {
      showView(viewLanding);
    });
    headerLogoGroup.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showView(viewLanding);
      }
    });
  }

  // Feature strip cards on landing page
  document.querySelectorAll('.feature-card-action').forEach(card => {
    const handleCardAction = () => {
      const action = card.dataset.action;
      if (action === 'play') {
        showView(viewSetup);
      } else if (action === 'badges') {
        showView(viewBadges);
      } else if (action === 'dashboard' || action === 'stats') {
        showView(viewDashboard);
      } else if (action === 'achievements') {
        if (window.BluffAuth) {
          const session = window.BluffAuth.SessionManager.get();
          if (session && session.user) {
            window.BluffAuth.openAchievementsModal();
          } else {
            showView(viewSetup);
          }
        }
      }
    };
    card.addEventListener('click', handleCardAction);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardAction();
      }
    });
  });

  // Navigation Links Handlers
  if (navHome) navHome.addEventListener('click', () => showView(viewLanding));
  if (navPlay) navPlay.addEventListener('click', () => showView(viewSetup));
  if (navBadges) navBadges.addEventListener('click', () => showView(viewBadges));
  if (navDashboard) navDashboard.addEventListener('click', () => showView(viewDashboard));
  if (btnBadgesBackLanding) btnBadgesBackLanding.addEventListener('click', () => showView(viewLanding));
  if (btnCompletionViewBadges) btnCompletionViewBadges.addEventListener('click', () => showView(viewBadges));

  // Celebration modal view badges action
  const btnCelebrationAck = document.getElementById('btn-celebration-ack');
  if (btnCelebrationAck) {
    btnCelebrationAck.addEventListener('click', () => {
      showView(viewBadges);
    });
  }

  // Fullscreen Controller
  function isFullscreenActive() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function updateFullscreenUI() {
    if (!fullscreenToggleBtn) return;
    const active = isFullscreenActive();
    const enterIcon = fullscreenToggleBtn.querySelector('.fs-icon-enter');
    const exitIcon = fullscreenToggleBtn.querySelector('.fs-icon-exit');

    if (active) {
      fullscreenToggleBtn.setAttribute('title', 'Exit Fullscreen (Esc)');
      fullscreenToggleBtn.setAttribute('aria-label', 'Exit Fullscreen Mode');
      fullscreenToggleBtn.classList.add('active');
      if (enterIcon) enterIcon.style.display = 'none';
      if (exitIcon) exitIcon.style.display = 'inline-flex';
    } else {
      fullscreenToggleBtn.setAttribute('title', 'Enter Fullscreen');
      fullscreenToggleBtn.setAttribute('aria-label', 'Enter Fullscreen Mode');
      fullscreenToggleBtn.classList.remove('active');
      if (enterIcon) enterIcon.style.display = 'inline-flex';
      if (exitIcon) exitIcon.style.display = 'none';
    }
  }

  async function toggleFullscreen() {
    try {
      if (!isFullscreenActive()) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle request was prevented or not permitted:', err);
    } finally {
      updateFullscreenUI();
    }
  }

  if (fullscreenToggleBtn) {
    fullscreenToggleBtn.addEventListener('click', toggleFullscreen);
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, updateFullscreenUI);
  });
  updateFullscreenUI();

  // About / How to Play Modal Handlers
  function openAboutModal() {
    if (aboutModal) aboutModal.style.display = 'flex';
  }
  function closeAboutModal() {
    if (aboutModal) aboutModal.style.display = 'none';
  }
  if (navAbout) navAbout.addEventListener('click', openAboutModal);
  if (aboutModalClose) aboutModalClose.addEventListener('click', closeAboutModal);
  if (aboutModalBackdrop) aboutModalBackdrop.addEventListener('click', closeAboutModal);
  if (btnAboutPlayNow) {
    btnAboutPlayNow.addEventListener('click', () => {
      closeAboutModal();
      showView(viewSetup);
    });
  }

  // Button Listeners for FACT and TRAP
  btnFact.addEventListener('click', () => handleAnswer('FACT'));
  btnMyth.addEventListener('click', () => handleAnswer('MYTH'));

  // Keyboard accessibility: 1 or F for FACT, 2 or T or M for TRAP, Enter/Space for Next, Esc for Exit
  document.addEventListener('keydown', (e) => {
    // If arena exit modal is open, Esc cancels
    if (arenaExitModal && arenaExitModal.style.display === 'flex') {
      if (e.key === 'Escape') {
        arenaExitModal.style.display = 'none';
      }
      return;
    }

    if (!viewArena.classList.contains('active')) return;

    if (e.key === 'Escape') {
      if (btnArenaExit) btnArenaExit.click();
      return;
    }

    if (!btnFact.disabled) {
      if (e.key === 'f' || e.key === 'F' || e.key === '1') {
        handleAnswer('FACT');
      } else if (e.key === 't' || e.key === 'T' || e.key === 'm' || e.key === 'M' || e.key === '2') {
        handleAnswer('MYTH');
      }
    } else if (feedbackContainer.style.display === 'block') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextQuestionBtn.click();
      }
    }
  });

  // Start initialization
  initializeGame();
});
