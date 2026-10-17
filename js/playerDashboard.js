/**
 * Truth Pool — Personal Player Dashboard Component (Screen 4)
 * Displays the authenticated user's lifetime stats, XP, level progression,
 * 11-fandom mastery breakdown, achievement milestones, and recent game history.
 * Strictly enforces user isolation (no leaderboards, no other users' data).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TruthPoolDashboard = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let currentContainer = null;

  /**
   * Loads all data for the authenticated player
   */
  async function loadPlayerData() {
    const session = window.BluffAuth && window.BluffAuth.SessionManager ? window.BluffAuth.SessionManager.get() : null;
    if (!session || !session.access_token) {
      return { isGuest: true };
    }

    const authService = window.BluffAuth.AuthService;
    const results = {
      isGuest: false,
      user: session.user || {},
      stats: null,
      history: [],
      xp: null,
      fandomProgress: null,
      achievements: null,
      error: null
    };

    try {
      const [statsRes, historyRes, xpRes, fandomRes, achRes] = await Promise.allSettled([
        authService.getPlayerStats(),
        authService.getGameHistory(10, 0),
        fetchXPData(session.access_token),
        fetchFandomProgress(),
        authService.getPlayerAchievements()
      ]);

      if (statsRes.status === 'fulfilled') results.stats = statsRes.value;
      if (historyRes.status === 'fulfilled' && historyRes.value && historyRes.value.rounds) {
        results.history = historyRes.value.rounds;
      }
      if (xpRes.status === 'fulfilled') results.xp = xpRes.value;
      if (fandomRes.status === 'fulfilled') results.fandomProgress = fandomRes.value;
      if (achRes.status === 'fulfilled') results.achievements = achRes.value;

      return results;
    } catch (err) {
      results.error = err.message || 'Failed to load player data';
      return results;
    }
  }

  async function fetchXPData(token) {
    if (window.BluffXP && typeof window.BluffXP.fetchCurrentXP === 'function') {
      return await window.BluffXP.fetchCurrentXP();
    }
    const apiBase = window.BluffAuth && window.BluffAuth.API_BASE_URL ? window.BluffAuth.API_BASE_URL : (window.TRUTH_POOL_API_BASE_URL || window.BLUFF_API_BASE_URL || 'http://127.0.0.1:8001');
    const res = await fetch(`${apiBase}/players/me/xp`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  }

  async function fetchFandomProgress() {
    if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.getFandomProgress === 'function') {
      const resp = await window.TruthPoolFandomBadges.getFandomProgress();
      return resp ? resp.progress : null;
    }
    return null;
  }

  /**
   * Render Dashboard View
   */
  async function loadAndRender(container) {
    if (!container) return;
    currentContainer = container;

    // Show initial loading state
    container.innerHTML = `
      <div class="dashboard-loading-state">
        <div class="spinner"></div>
        <p>Loading your personal Truth Pool dossier...</p>
      </div>
    `;

    const data = await loadPlayerData();

    // 1. Guest Mode Fallback
    if (data.isGuest) {
      renderGuestState(container);
      return;
    }

    // 2. Error State with Retry
    if (data.error && !data.stats) {
      container.innerHTML = `
        <div class="dashboard-error-state">
          <div class="error-icon">⚠️</div>
          <h3>Failed to Load Profile Dossier</h3>
          <p>${escapeHtml(data.error)}</p>
          <button type="button" class="btn btn-hero-red" id="btn-retry-dashboard">↻ Retry Loading</button>
        </div>
      `;
      const retryBtn = container.querySelector('#btn-retry-dashboard');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => loadAndRender(container));
      }
      return;
    }

    // 3. Authenticated Player View
    renderAuthenticatedDashboard(container, data);
  }

  function renderGuestState(container) {
    container.innerHTML = `
      <div class="dashboard-guest-card card">
        <div class="guest-emblem-burst">🦸</div>
        <h2 class="guest-title">Agent Profile & Mission Records Locked</h2>
        <p class="guest-subtitle">
          Sign in or create a free Truth Pool account to activate your personal gaming dashboard,
          save career accuracy, level up with XP, and track your progress across all 11 fandoms!
        </p>

        <div class="guest-perks-grid">
          <div class="guest-perk">
            <span class="perk-icon">⚡</span>
            <h4>Level Progression & XP</h4>
            <p>Earn XP on every answer and level up from Novice to Mythic Master.</p>
          </div>
          <div class="guest-perk">
            <span class="perk-icon">🎖️</span>
            <h4>22 Fandom Badges</h4>
            <p>Unlock permanent Tier 1 and Tier 2 badges across Marvel, Anime, and more.</p>
          </div>
          <div class="guest-perk">
            <span class="perk-icon">📜</span>
            <h4>Career Mission History</h4>
            <p>Review round accuracy, scores, and personal best records over time.</p>
          </div>
        </div>

        <div class="guest-actions-group">
          <button type="button" id="btn-dashboard-login" class="btn btn-hero-red">
            Sign In to Truth Pool
          </button>
          <button type="button" id="btn-dashboard-register" class="btn btn-outline-pill">
            Create Free Account
          </button>
        </div>
      </div>
    `;

    const btnLogin = container.querySelector('#btn-dashboard-login');
    const btnRegister = container.querySelector('#btn-dashboard-register');

    if (btnLogin && window.BluffAuth && window.BluffAuth.openModal) {
      btnLogin.addEventListener('click', () => window.BluffAuth.openModal('login'));
    }
    if (btnRegister && window.BluffAuth && window.BluffAuth.openModal) {
      btnRegister.addEventListener('click', () => window.BluffAuth.openModal('register'));
    }
  }

  function renderAuthenticatedDashboard(container, data) {
    const user = data.user || {};
    const stats = data.stats || {};
    const xp = data.xp || stats.xp || {};
    const history = data.history || [];
    const fandomProgress = data.fandomProgress || {};

    const level = xp.level || 1;
    const levelTitle = xp.level_title || 'Truth Novice';
    const totalXP = xp.total_xp || 0;
    const xpPct = xp.progress_pct || 0;
    const xpNeeded = xp.xp_needed || 100;

    const totalRounds = stats.total_rounds || 0;
    const answeredQs = stats.total_questions_answered || 0;
    const correctAnswers = stats.total_correct_answers || 0;
    const accuracy = stats.overall_accuracy !== null && stats.overall_accuracy !== undefined ? `${stats.overall_accuracy}%` : '0%';
    const bestScore = stats.best_score || 0;

    // Fandom progress items (11 Fandoms)
    const fandomNames = [
      'Marvel Universe', 'DC Universe', 'Naruto', 'One Piece',
      'Dragon Ball', 'Bleach', 'Demon Slayer', 'Ben 10',
      'My Hero Academia', 'Game of Thrones', 'The Boys'
    ];

    let fandomsGridHtml = '';
    for (const fName of fandomNames) {
      const fProg = fandomProgress[fName] || { completed_questions: 0, tier1_unlocked: false, tier2_unlocked: false };
      const completed = Math.max(0, Math.min(200, Number(fProg.completed_questions) || 0));
      const pct = Math.round((completed / 200) * 100);
      const isT1 = Boolean(fProg.tier1_unlocked);
      const isT2 = Boolean(fProg.tier2_unlocked);

      fandomsGridHtml += `
        <div class="dash-fandom-item">
          <div class="dash-fandom-top">
            <strong class="dash-fandom-name">${escapeHtml(fName)}</strong>
            <span class="dash-fandom-ratio">${completed} / 200</span>
          </div>
          <div class="dash-fandom-track">
            <div class="dash-fandom-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="dash-fandom-badges">
            <span class="chip-tier ${isT1 ? 'earned' : 'locked'}">${isT1 ? '✓ T1' : '🔒 T1'}</span>
            <span class="chip-tier ${isT2 ? 'earned' : 'locked'}">${isT2 ? '★ T2' : '🔒 T2'}</span>
            <button type="button" class="btn-play-mini" data-fandom="${escapeHtml(fName)}" title="Play ${escapeHtml(fName)}">Play →</button>
          </div>
        </div>
      `;
    }

    // Recent games table rows
    let historyRowsHtml = '';
    if (history.length > 0) {
      for (const r of history) {
        const dateStr = r.completed_at ? new Date(r.completed_at).toLocaleDateString() : 'Recent';
        historyRowsHtml += `
          <tr>
            <td>${escapeHtml(dateStr)}</td>
            <td><strong>${escapeHtml(r.category || 'All Categories')}</strong></td>
            <td><span class="badge badge-difficulty-${String(r.difficulty || 'mixed').toLowerCase()}">${escapeHtml(r.difficulty || 'Mixed')}</span></td>
            <td><strong style="color: var(--color-hero-red);">${r.score} pts</strong></td>
            <td>${r.accuracy !== undefined ? r.accuracy + '%' : '—'}</td>
          </tr>
        `;
      }
    } else {
      historyRowsHtml = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--color-slate-grey); padding: 24px;">
            No completed rounds yet. Choose a fandom to play your first mission!
          </td>
        </tr>
      `;
    }

    container.innerHTML = `
      <div class="dashboard-content">
        <!-- Top Navigation & Refresh -->
        <div class="setup-nav-row" style="margin-bottom: 20px;">
          <button type="button" id="btn-dash-back-menu" class="btn-back-link">
            <span aria-hidden="true">←</span> Main Menu
          </button>
          <div class="badges-header-actions-top">
            <button type="button" id="btn-refresh-dashboard" class="btn-icon-refresh" title="Refresh Dashboard">↻ Refresh Dossier</button>
          </div>
        </div>

        <!-- Profile Hero Card -->
        <section class="dash-profile-card card" aria-label="Player Profile Dossier">
          <div class="dash-profile-header">
            <div class="dash-avatar-circle" aria-hidden="true">🦸</div>
            <div class="dash-identity-col">
              <span class="dash-agent-tag">AUTHENTICATED AGENT</span>
              <h2 class="dash-username">${escapeHtml(user.username || 'Truth Agent')}</h2>
              <p class="dash-email">${escapeHtml(user.email || '')}</p>
            </div>
            <div class="dash-level-col">
              <span class="xp-level-badge-lg">Lvl ${level}</span>
              <span class="dash-level-title">${escapeHtml(levelTitle)}</span>
            </div>
          </div>

          <!-- XP Progression Bar -->
          <div class="dash-xp-section">
            <div class="dash-xp-meta">
              <span>Total XP: <strong style="color: var(--color-hero-blue);">${totalXP} XP</strong></span>
              <span>${xpPct}% to Next Level (${xpNeeded} XP needed)</span>
            </div>
            <div class="dash-xp-track">
              <div class="dash-xp-fill" style="width: ${xpPct}%;"></div>
            </div>
          </div>
        </section>

        <!-- 5-Metric Career Overview Grid -->
        <section class="dash-metrics-grid" aria-label="Career Performance Metrics">
          <div class="metric-card">
            <span class="metric-icon" aria-hidden="true">🎮</span>
            <div class="metric-data">
              <span class="metric-num">${totalRounds}</span>
              <span class="metric-lbl">Completed Rounds</span>
            </div>
          </div>
          <div class="metric-card">
            <span class="metric-icon" aria-hidden="true">🎯</span>
            <div class="metric-data">
              <span class="metric-num">${answeredQs}</span>
              <span class="metric-lbl">Questions Answered</span>
            </div>
          </div>
          <div class="metric-card">
            <span class="metric-icon" aria-hidden="true">✓</span>
            <div class="metric-data">
              <span class="metric-num" style="color: var(--color-hero-blue);">${correctAnswers}</span>
              <span class="metric-lbl">Facts Spot On</span>
            </div>
          </div>
          <div class="metric-card">
            <span class="metric-icon" aria-hidden="true">📊</span>
            <div class="metric-data">
              <span class="metric-num" style="color: var(--color-golden-yellow);">${accuracy}</span>
              <span class="metric-lbl">Overall Accuracy</span>
            </div>
          </div>
          <div class="metric-card">
            <span class="metric-icon" aria-hidden="true">🏆</span>
            <div class="metric-data">
              <span class="metric-num" style="color: var(--color-hero-red);">${bestScore}</span>
              <span class="metric-lbl">Best Score</span>
            </div>
          </div>
        </section>

        <!-- Quick Actions & Links Strip -->
        <section class="dash-shortcuts-strip">
          <button type="button" class="btn btn-hero-blue" id="btn-dash-view-badges">
            🎖️ View Fandom Badges Collection (22 Badges) →
          </button>
          <button type="button" class="btn btn-outline-pill" id="btn-dash-view-achievements">
            🏅 View Mission Achievements (10 Milestones) →
          </button>
        </section>

        <!-- 11-Fandom Mastery Grid -->
        <section class="dash-section card" aria-label="Fandom Progress Tracking">
          <div class="dash-section-header">
            <h3>Multiverse Fandom Mastery</h3>
            <span class="section-sub">Progress towards Tier 1 (100 Qs) and Tier 2 (200 Qs) across all 11 fandoms</span>
          </div>
          <div class="dash-fandoms-grid">
            ${fandomsGridHtml}
          </div>
        </section>

        <!-- Recent Mission Records Table -->
        <section class="dash-section card" aria-label="Recent Game Records">
          <div class="dash-section-header">
            <h3>Recent Mission Records</h3>
            <span class="section-sub">Chronological round history saved to your account</span>
          </div>
          <div class="history-table-container">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fandom</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                ${historyRowsHtml}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Event Bindings
    const btnBackMenu = container.querySelector('#btn-dash-back-menu');
    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => {
        const landing = document.getElementById('view-landing');
        if (landing && window.showView) window.showView(landing);
      });
    }

    const btnRefresh = container.querySelector('#btn-refresh-dashboard');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => loadAndRender(container));
    }

    const btnViewBadges = container.querySelector('#btn-dash-view-badges');
    if (btnViewBadges) {
      btnViewBadges.addEventListener('click', () => {
        const badgesView = document.getElementById('view-badges');
        if (badgesView && window.showView) window.showView(badgesView);
      });
    }

    const btnViewAch = container.querySelector('#btn-dash-view-achievements');
    if (btnViewAch && window.BluffAuth && window.BluffAuth.openAchievementsModal) {
      btnViewAch.addEventListener('click', () => window.BluffAuth.openAchievementsModal());
    }

    // Mini Play buttons on fandom items
    container.querySelectorAll('.btn-play-mini').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fandomName = btn.dataset.fandom;
        if (window.TruthPoolLaunchFandom) {
          window.TruthPoolLaunchFandom(fandomName);
        } else {
          const setupView = document.getElementById('view-setup');
          if (setupView && window.showView) window.showView(setupView);
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    loadPlayerData,
    loadAndRender,
    async refresh() {
      if (currentContainer) {
        await loadAndRender(currentContainer);
      }
    }
  };
});
