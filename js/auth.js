/**
 * Bluff or Believe — Authentication Controller
 * Interfaces with FastAPI Authentication Backend (auth_api.py).
 * Manages modal UI, registration, login, logout, account deletion,
 * error presentation, and local session persistence.
 */

(function () {
  'use strict';

  // Configurable API base URL with local development fallback
  const API_BASE_URL = window.TRUTH_POOL_API_BASE_URL || window.BLUFF_API_BASE_URL || 'https://truthpool-api-50046996624.development.catalystappsail.in';
  const STORAGE_KEY = 'bluff_auth_session';
  let onAuthExpired = null;

  // Module-level references populated by initAuthUI().
  // These must be declared here so window.BluffAuth can expose them
  // via wrappers without causing a ReferenceError.
  let _openModal = () => {};
  let _syncHeaderState = () => {};
  let _loadPlayerStatsAndHistory = () => {};

  /**
   * Session Management
   */
  const SessionManager = {
    get() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.access_token && parsed.user) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    },

    set(data) {
      if (!data || !data.access_token || !data.user) return;
      // Strictly store only token and sanitized user details; never passwords
      const payload = {
        access_token: String(data.access_token),
        user: {
          id: data.user.id,
          username: String(data.user.username || ''),
          email: String(data.user.email || '')
        },
        saved_at: Date.now()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Could not save session to localStorage:', err);
      }
    },

    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore removal error
      }
    }
  };

  /**
   * Helper to format API error responses into clean, user-friendly messages
   */
  function formatErrorMessage(errData, defaultMsg = 'An unexpected error occurred.') {
    if (!errData) return defaultMsg;

    // Handle string detail
    if (typeof errData.detail === 'string') {
      return errData.detail;
    }

    // Handle Pydantic validation error array
    if (Array.isArray(errData.detail) && errData.detail.length > 0) {
      const messages = errData.detail.map((item) => {
        const fieldName = Array.isArray(item.loc) && item.loc.length > 1
          ? String(item.loc[item.loc.length - 1]).charAt(0).toUpperCase() + String(item.loc[item.loc.length - 1]).slice(1)
          : 'Field';
        const msg = item.msg ? item.msg.replace(/^Value error,\s*/i, '') : 'Invalid value';
        return `${fieldName}: ${msg}`;
      });
      return messages.join(' • ');
    }

    if (errData.message && typeof errData.message === 'string') {
      return errData.message;
    }

    return defaultMsg;
  }

  /**
   * API Client Service
   */
  const AuthService = {
    async checkHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        return res.ok;
      } catch {
        return false;
      }
    },

    async register(username, email, password) {
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
      } catch {
        throw new Error(`Authentication server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw new Error(formatErrorMessage(data, 'Registration failed. Please check your inputs.'));
      }

      return data;
    },

    async login(email, password) {
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      } catch {
        throw new Error(`Authentication server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(formatErrorMessage(data, 'Login failed. Please check your credentials.'));
      }

      return data;
    },

    async logout(token) {
      if (!token) return;
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch {
        // Logout silently continues on frontend even if network dropped
      }
    },

    async deleteAccount(token) {
      if (!token) {
        throw new Error('No active session.');
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/auth/account`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch {
        throw new Error(`Authentication server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Session has expired. Please sign in again.');
        }
        throw new Error(formatErrorMessage(data, 'Account deletion failed.'));
      }

      return data;
    },

    async saveGameRound(payload) {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        return { guest: true };
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/games/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload)
        });
      } catch {
        throw new Error(`Server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        throw new Error('Session has expired. Please sign in again.');
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Failed to save completed game round.'));
      }

      return data;
    },

    async getGameHistory(limit = 20, offset = 0) {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        throw new Error('No active session.');
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/games/history?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch {
        throw new Error(`Server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        throw new Error('Session has expired. Please sign in again.');
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Failed to retrieve game history.'));
      }

      return data;
    },

    async getPlayerStats() {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        throw new Error('No active session.');
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/players/me/stats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch {
        throw new Error(`Server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        throw new Error('Session has expired. Please sign in again.');
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Failed to retrieve player statistics.'));
      }

      return data;
    },

    async getPlayerAchievements() {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        throw new Error('No active session.');
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/players/me/achievements`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch {
        throw new Error(`Server is unreachable. Please verify the backend is running at ${API_BASE_URL}.`);
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        throw new Error('Session has expired. Please sign in again.');
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Failed to retrieve player achievements.'));
      }

      return data;
    },

    async recordQuestionCompleted(fandomId, questionId) {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        return { guest: true, newly_unlocked_badges: [] };
      }

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/fandom/question-completed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            fandom_id: String(fandomId),
            question_id: Number(questionId)
          })
        });
      } catch (err) {
        console.warn('Network error recording question completion:', err);
        return { error: true, network_error: true, newly_unlocked_badges: [] };
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        return { expired: true, newly_unlocked_badges: [] };
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn('API error recording question completion:', data);
        return { error: true, detail: data, newly_unlocked_badges: [] };
      }

      return data;
    },

    async getFandomProgress(fandomId = null) {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        return null;
      }

      const query = fandomId ? `?fandom_id=${encodeURIComponent(fandomId)}` : '';
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/fandom/progress${query}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch {
        return null;
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        return null;
      }

      if (!res.ok) return null;
      return await res.json().catch(() => null);
    },

    async getFandomBadges(fandomId = null) {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        return null;
      }

      const query = fandomId ? `?fandom_id=${encodeURIComponent(fandomId)}` : '';
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/fandom/badges${query}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      } catch {
        return null;
      }

      if (res.status === 401) {
        SessionManager.clear();
        if (typeof onAuthExpired === 'function') onAuthExpired();
        return null;
      }

      if (!res.ok) return null;
      return await res.json().catch(() => null);
    }
  };

  /**
   * UI Controller
   */
  function initAuthUI() {
    // Overwrite module-level references with real implementations once DOM is ready.
    // Header triggers
    const authTriggerBtn = document.getElementById('auth-trigger-btn');
    const authTriggerText = document.getElementById('auth-trigger-text');
    const statsTriggerBtn = document.getElementById('stats-trigger-btn');
    const btnNavLogin = document.getElementById('btn-nav-login');
    const btnNavRegister = document.getElementById('btn-nav-register');
    const navGuestActions = document.getElementById('nav-guest-actions');

    // Setup screen quick stats banner
    const setupPlayerBanner = document.getElementById('setup-player-banner');
    const playerBannerName = document.getElementById('player-banner-name');
    const playerBannerBest = document.getElementById('player-banner-best');
    const playerBannerAcc = document.getElementById('player-banner-acc');
    const btnBannerViewStats = document.getElementById('btn-banner-view-stats');

    // Modal elements
    const authModal = document.getElementById('auth-modal');
    const authBackdrop = document.getElementById('auth-modal-backdrop');
    const authCloseBtn = document.getElementById('auth-modal-close');

    // Guest Mode (Tabs & Forms)
    const guestPanel = document.getElementById('auth-guest-panel');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const modalTitle = document.getElementById('auth-modal-title');
    const modalSubtitle = document.getElementById('auth-modal-subtitle');
    const authAlert = document.getElementById('auth-alert');

    // Forms
    const formLogin = document.getElementById('form-login');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const btnSubmitLogin = document.getElementById('btn-submit-login');

    const formRegister = document.getElementById('form-register');
    const registerUsernameInput = document.getElementById('register-username');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const btnSubmitRegister = document.getElementById('btn-submit-register');

    // User Panel (Authenticated Mode)
    const userPanel = document.getElementById('auth-user-panel');
    const userAlert = document.getElementById('auth-user-alert');
    const tabUserProfile = document.getElementById('tab-user-profile');
    const tabUserHistory = document.getElementById('tab-user-history');
    const tabUserAchievements = document.getElementById('tab-user-achievements');
    const userSubpanelProfile = document.getElementById('user-subpanel-profile');
    const userSubpanelHistory = document.getElementById('user-subpanel-history');
    const userSubpanelAchievements = document.getElementById('user-subpanel-achievements');

    // Profile Details
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const btnLogout = document.getElementById('btn-logout');

    // Safe Deletion Flow
    const btnShowDeleteConfirm = document.getElementById('btn-show-delete-confirm');
    const deleteConfirmBox = document.getElementById('delete-confirm-box');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');

    // Stats & History Elements
    const btnRefreshHistory = document.getElementById('btn-refresh-history');
    const playerStatRounds = document.getElementById('player-stat-rounds');
    const playerStatAnswered = document.getElementById('player-stat-answered');
    const playerStatCorrect = document.getElementById('player-stat-correct');
    const playerStatAccuracy = document.getElementById('player-stat-accuracy');
    const playerStatBest = document.getElementById('player-stat-best');

    const historyLoading = document.getElementById('history-loading');
    const historyErrorContainer = document.getElementById('history-error-container');
    const historyErrorText = document.getElementById('history-error-text');
    const btnRetryHistory = document.getElementById('btn-retry-history');
    const historyEmptyContainer = document.getElementById('history-empty-container');
    const historyTableContainer = document.getElementById('history-table-container');
    const historyTableBody = document.getElementById('history-table-body');

    if (!authTriggerBtn || !authModal) return;

    let currentMode = 'login'; // 'login' | 'register'
    let currentUserSubTab = 'profile'; // 'profile' | 'history' | 'achievements'

    // Alert helper
    function showAlert(elem, message, type = 'error') {
      if (!elem) return;
      elem.textContent = message;
      elem.className = `auth-alert auth-alert-${type}`;
      elem.style.display = 'block';
    }

    function clearAlert(elem) {
      if (!elem) return;
      elem.textContent = '';
      elem.style.display = 'none';
      elem.className = 'auth-alert';
    }

    // Sub-tab Switcher for Authenticated User
    function setUserSubTab(subTab) {
      currentUserSubTab = subTab;
      clearAlert(userAlert);

      const allTabs = [
        { btn: tabUserProfile, panel: userSubpanelProfile, key: 'profile' },
        { btn: tabUserHistory, panel: userSubpanelHistory, key: 'history' },
        { btn: tabUserAchievements, panel: userSubpanelAchievements, key: 'achievements' }
      ];

      allTabs.forEach(item => {
        if (!item.btn) return;
        if (item.key === subTab) {
          item.btn.classList.add('active');
          item.btn.setAttribute('aria-selected', 'true');
          if (item.panel) item.panel.style.display = 'block';
        } else {
          item.btn.classList.remove('active');
          item.btn.setAttribute('aria-selected', 'false');
          if (item.panel) item.panel.style.display = 'none';
        }
      });
    }

    // Load Player Statistics & Game History from API
    async function loadPlayerStatsAndHistory() {
      const session = SessionManager.get();
      if (!session || !session.access_token) return;

      if (historyErrorContainer) historyErrorContainer.style.display = 'none';
      if (historyTableContainer) historyTableContainer.style.display = 'none';
      if (historyEmptyContainer) historyEmptyContainer.style.display = 'none';
      if (historyLoading) historyLoading.style.display = 'flex';

      try {
        const [stats, historyData] = await Promise.all([
          AuthService.getPlayerStats(),
          AuthService.getGameHistory(20, 0)
        ]);

        // Render aggregate stats
        if (playerStatRounds) playerStatRounds.textContent = stats.completed_rounds;
        if (playerStatAnswered) playerStatAnswered.textContent = stats.total_questions_answered;
        if (playerStatCorrect) playerStatCorrect.textContent = stats.total_correct_answers;
        if (playerStatAccuracy) playerStatAccuracy.textContent = `${stats.overall_accuracy}%`;
        if (playerStatBest) playerStatBest.textContent = `${stats.best_score} pts`;

        // Update home screen player banner
        if (playerBannerBest) playerBannerBest.textContent = stats.best_score;
        if (playerBannerAcc) playerBannerAcc.textContent = `${stats.overall_accuracy}%`;

        // Sync Level & XP into UI via BluffXP
        if (window.BluffXP && typeof window.BluffXP.syncFromStats === 'function') {
          window.BluffXP.syncFromStats(stats);
        }

        const games = (historyData && historyData.games) ? historyData.games : [];
        if (games.length === 0) {
          if (historyLoading) historyLoading.style.display = 'none';
          if (historyEmptyContainer) historyEmptyContainer.style.display = 'block';
        } else {
          if (historyTableBody) {
            historyTableBody.innerHTML = '';
            for (const g of games) {
              const tr = document.createElement('tr');

              let dateStr = '—';
              if (g.completed_at) {
                try {
                  const dt = new Date(g.completed_at);
                  dateStr = dt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                } catch {
                  dateStr = g.completed_at.slice(0, 16);
                }
              }

              const catStr = g.category && g.category !== 'all' ? g.category : 'Mixed';
              const diffStr = g.difficulty && g.difficulty !== 'all' ? g.difficulty : 'Mixed';
              const diffClass = ['easy', 'medium', 'hard'].includes(diffStr.toLowerCase())
                ? diffStr.toLowerCase()
                : 'medium';

              tr.innerHTML = `
                <td><span style="color: var(--text-muted); font-size: 0.8rem;">${dateStr}</span></td>
                <td><strong style="color: #fff;">${g.score}</strong> <span style="font-size: 0.72rem; color: var(--text-dim);">pts</span></td>
                <td><span class="badge" style="font-size: 0.72rem; padding: 2px 7px;">${catStr}</span></td>
                <td><span class="badge badge-difficulty-${diffClass}" style="font-size: 0.72rem; padding: 2px 7px;">${diffStr}</span></td>
                <td><strong style="color: #38bdf8;">${g.accuracy}%</strong></td>
              `;
              historyTableBody.appendChild(tr);
            }
          }
          if (historyLoading) historyLoading.style.display = 'none';
          if (historyTableContainer) historyTableContainer.style.display = 'block';
        }
      } catch (err) {
        if (historyLoading) historyLoading.style.display = 'none';
        if (historyErrorContainer) {
          if (historyErrorText) historyErrorText.textContent = err.message || 'Failed to load game history.';
          historyErrorContainer.style.display = 'block';
        }
      }
    }

    // Wire module-level stubs to real implementations now that closures are ready
    _openModal = openModal;
    _syncHeaderState = syncHeaderState;
    _loadPlayerStatsAndHistory = loadPlayerStatsAndHistory;

    // Refresh UI based on session
    function syncHeaderState() {
      const session = SessionManager.get();
      if (session && session.user && session.user.username) {
        if (navGuestActions) navGuestActions.style.display = 'none';
        if (authTriggerBtn) {
          authTriggerBtn.style.display = 'flex';
          authTriggerText.textContent = session.user.username;
          authTriggerBtn.setAttribute('title', `Signed in as ${session.user.username}`);
          authTriggerBtn.classList.add('authenticated');
        }
        if (statsTriggerBtn) statsTriggerBtn.style.display = 'flex';
        if (setupPlayerBanner) {
          setupPlayerBanner.style.display = 'flex';
          if (playerBannerName) playerBannerName.textContent = session.user.username;
        }

        // Silently fetch quick stats in background for banner & XP sync
        AuthService.getPlayerStats()
          .then((stats) => {
            if (playerBannerBest) playerBannerBest.textContent = `${stats.best_score} pts`;
            if (playerBannerAcc) playerBannerAcc.textContent = `${stats.overall_accuracy}%`;
            if (window.BluffXP && typeof window.BluffXP.syncFromStats === 'function') {
              window.BluffXP.syncFromStats(stats);
            }
          })
          .catch(() => {});

        // Refresh achievements for the dashboard
        if (window.BluffAchievements && typeof window.BluffAchievements.refreshAchievements === 'function') {
          window.BluffAchievements.refreshAchievements();
        }

        // Refresh fandom badges
        if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.refresh === 'function') {
          window.TruthPoolFandomBadges.refresh();
        }
      } else {
        if (window.BluffXP && typeof window.BluffXP.reset === 'function') {
          window.BluffXP.reset();
        }
        if (window.BluffAchievements && typeof window.BluffAchievements.reset === 'function') {
          window.BluffAchievements.reset();
        }
        if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.refresh === 'function') {
          window.TruthPoolFandomBadges.refresh();
        }
        if (navGuestActions) navGuestActions.style.display = 'flex';
        if (authTriggerBtn) {
          authTriggerBtn.style.display = 'none';
          authTriggerText.textContent = 'Sign In';
          authTriggerBtn.setAttribute('title', 'Sign In or Register');
          authTriggerBtn.classList.remove('authenticated');
        }
        if (statsTriggerBtn) statsTriggerBtn.style.display = 'none';
        if (setupPlayerBanner) setupPlayerBanner.style.display = 'none';
      }

      // Refresh Fandom Badges, Fandom Selection, and Dashboard components if available
      if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.refresh === 'function') {
        window.TruthPoolFandomBadges.refresh();
      }
      if (window.TruthPoolFandomSelection && typeof window.TruthPoolFandomSelection.refresh === 'function') {
        const grid = document.getElementById('fandoms-grid');
        if (grid) window.TruthPoolFandomSelection.refresh(grid, null, window.TruthPoolLaunchFandom);
      }
      if (window.TruthPoolDashboard && typeof window.TruthPoolDashboard.refresh === 'function') {
        window.TruthPoolDashboard.refresh();
      }
    }

    // Open Modal
    function openModal(targetTab = 'profile') {
      clearAlert(authAlert);
      clearAlert(userAlert);
      if (deleteConfirmBox) deleteConfirmBox.style.display = 'none';

      const session = SessionManager.get();
      if (session && session.user) {
        // Show User Profile Mode
        guestPanel.style.display = 'none';
        userPanel.style.display = 'block';
        profileUsername.textContent = session.user.username || 'User';
        profileEmail.textContent = session.user.email || '—';

        if (targetTab === 'history' || targetTab === 'stats') {
          setUserSubTab('history');
          loadPlayerStatsAndHistory();
        } else if (targetTab === 'achievements') {
          setUserSubTab('achievements');
          if (window.BluffAchievements) window.BluffAchievements.refreshAchievements();
        } else {
          setUserSubTab('profile');
        }
      } else {
        // Show Guest Mode (Sign In / Register)
        userPanel.style.display = 'none';
        guestPanel.style.display = 'block';
        setGuestTab(currentMode);
      }

      authModal.style.display = 'flex';
      authTriggerBtn.setAttribute('aria-expanded', 'true');
    }

    // Close Modal
    function closeModal() {
      authModal.style.display = 'none';
      authTriggerBtn.setAttribute('aria-expanded', 'false');
      clearAlert(authAlert);
      clearAlert(userAlert);
      if (deleteConfirmBox) deleteConfirmBox.style.display = 'none';
    }

    // Tab Switcher for Guest
    function setGuestTab(mode) {
      currentMode = mode;
      clearAlert(authAlert);

      if (mode === 'login') {
        tabLogin.classList.add('active');
        tabLogin.setAttribute('aria-selected', 'true');
        tabRegister.classList.remove('active');
        tabRegister.setAttribute('aria-selected', 'false');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
        modalTitle.textContent = 'Welcome to Truth Pool';
        modalSubtitle.textContent = 'Sign in to your Truth Pool account';
      } else {
        tabRegister.classList.add('active');
        tabRegister.setAttribute('aria-selected', 'true');
        tabLogin.classList.remove('active');
        tabLogin.setAttribute('aria-selected', 'false');
        formRegister.style.display = 'block';
        formLogin.style.display = 'none';
        modalTitle.textContent = 'Create Account';
        modalSubtitle.textContent = 'Register to join the Truth Pool arena';
      }
    }

    // Handle 401 Session Expiration
    function handleSessionExpired() {
      SessionManager.clear();
      syncHeaderState();
      userPanel.style.display = 'none';
      guestPanel.style.display = 'block';
      setGuestTab('login');
      showAlert(authAlert, 'Your session has expired or the server restarted. Please sign in again.', 'error');
    }

    // Register module-level callback for 401 expiration
    onAuthExpired = handleSessionExpired;

    // Event Bindings
    authTriggerBtn.addEventListener('click', () => openModal('profile'));
    if (statsTriggerBtn) statsTriggerBtn.addEventListener('click', () => openModal('history'));
    if (btnBannerViewStats) btnBannerViewStats.addEventListener('click', () => openModal('history'));

    if (tabUserProfile) tabUserProfile.addEventListener('click', () => setUserSubTab('profile'));
    if (tabUserHistory) tabUserHistory.addEventListener('click', () => {
      setUserSubTab('history');
      loadPlayerStatsAndHistory();
    });
    if (tabUserAchievements) tabUserAchievements.addEventListener('click', () => {
      setUserSubTab('achievements');
      if (window.BluffAchievements) window.BluffAchievements.refreshAchievements();
    });
    if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', () => loadPlayerStatsAndHistory());
    if (btnRetryHistory) btnRetryHistory.addEventListener('click', () => loadPlayerStatsAndHistory());

    authCloseBtn.addEventListener('click', closeModal);
    authBackdrop.addEventListener('click', closeModal);

    // Escape Key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && authModal.style.display === 'flex') {
        closeModal();
      }
    });

    tabLogin.addEventListener('click', () => setGuestTab('login'));
    tabRegister.addEventListener('click', () => setGuestTab('register'));

    // Handle Login Submit
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert(authAlert);

      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;

      if (!email || !password) {
        showAlert(authAlert, 'Please enter both email and password.');
        return;
      }

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.textContent = 'Signing in...';

      try {
        const response = await AuthService.login(email, password);
        SessionManager.set(response);
        syncHeaderState();
        formLogin.reset();
        closeModal();
      } catch (err) {
        showAlert(authAlert, err.message);
      } finally {
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.textContent = 'Sign In';
      }
    });

    // Handle Register Submit
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert(authAlert);

      const username = registerUsernameInput.value.trim();
      const email = registerEmailInput.value.trim();
      const password = registerPasswordInput.value;

      // Client-side quick checks
      if (!username || username.length < 3) {
        showAlert(authAlert, 'Username must be at least 3 characters.');
        return;
      }
      if (!email) {
        showAlert(authAlert, 'Please enter a valid email address.');
        return;
      }
      if (!password || password.length < 8) {
        showAlert(authAlert, 'Password must be at least 8 characters long.');
        return;
      }

      btnSubmitRegister.disabled = true;
      btnSubmitRegister.textContent = 'Creating account...';

      try {
        const response = await AuthService.register(username, email, password);
        SessionManager.set(response);
        syncHeaderState();
        formRegister.reset();
        closeModal();
      } catch (err) {
        showAlert(authAlert, err.message);
      } finally {
        btnSubmitRegister.disabled = false;
        btnSubmitRegister.textContent = 'Create Account';
      }
    });

    // Handle Logout
    btnLogout.addEventListener('click', async () => {
      const session = SessionManager.get();
      btnLogout.disabled = true;
      btnLogout.textContent = 'Signing out...';

      if (session && session.access_token) {
        await AuthService.logout(session.access_token);
      }

      SessionManager.clear();
      if (window.BluffXP && typeof window.BluffXP.reset === 'function') {
        window.BluffXP.reset();
      }
      syncHeaderState();
      btnLogout.disabled = false;
      btnLogout.textContent = 'Sign Out';
      closeModal();
    });

    // Account Deletion Flow (Safe confirmation)
    btnShowDeleteConfirm.addEventListener('click', () => {
      deleteConfirmBox.style.display = 'block';
    });

    btnCancelDelete.addEventListener('click', () => {
      deleteConfirmBox.style.display = 'none';
      clearAlert(userAlert);
    });

    btnConfirmDelete.addEventListener('click', async () => {
      const session = SessionManager.get();
      if (!session || !session.access_token) {
        handleSessionExpired();
        return;
      }

      btnConfirmDelete.disabled = true;
      btnConfirmDelete.textContent = 'Deleting...';

      try {
        await AuthService.deleteAccount(session.access_token);
        SessionManager.clear();
        syncHeaderState();
        closeModal();
      } catch (err) {
        if (err.message && err.message.includes('expired')) {
          handleSessionExpired();
        } else {
          showAlert(userAlert, err.message, 'error');
        }
      } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = 'Yes, Delete Account';
      }
    });

    // Quick Nav Auth Buttons
    if (btnNavLogin) {
      btnNavLogin.addEventListener('click', () => openModal('login'));
    }
    if (btnNavRegister) {
      btnNavRegister.addEventListener('click', () => openModal('register'));
    }

    // Initial sync
    syncHeaderState();
  }

  // Export public namespace.
  // openModal / syncHeaderState / loadPlayerStatsAndHistory are inner functions
  // of initAuthUI() — expose them via wrapper functions so callers always
  // reach the live implementation after initAuthUI() has run.
  window.BluffAuth = {
    SessionManager,
    AuthService,
    API_BASE_URL,
    initAuthUI,
    openModal: (...args) => _openModal(...args),
    openStatsModal: () => _openModal('history'),
    openAchievementsModal: () => _openModal('achievements'),
    syncHeaderState: (...args) => _syncHeaderState(...args),
    loadPlayerStatsAndHistory: (...args) => _loadPlayerStatsAndHistory(...args)
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
  } else {
    initAuthUI();
  }
})();
