/**
 * Truth Pool — Fandom Badge Collection Controller (Phase 3)
 * Manages the Fandom Badge Collection View, interactive filtering, search,
 * backend integration (/api/fandom/badges & /api/fandom/progress),
 * original franchise-inspired SVG vector emblems, and celebration popups.
 */

(function () {
  'use strict';

  // State
  let cachedBadges = [];
  let cachedProgress = [];
  let currentFilter = 'all'; // 'all' | 'unlocked' | 'locked'
  let currentFandomFilter = 'all'; // 'all' | '<fandom_id>'
  let searchQuery = '';
  let isLoading = false;
  let activeCelebrationBadges = [];
  let celebratedBadgeIds = new Set();

  /**
   * Generates custom, original franchise-inspired vector badge SVG emblems.
   * Tailored for each fandom theme and distinct tier (Tier 1 vs Tier 2).
   */
  function renderBadgeSvg(theme, tier, isUnlocked) {
    const isTier2 = tier === 2;
    const filterId = `glow-${theme}-${tier}`;
    const opacity = isUnlocked ? '1' : '0.4';
    const primaryGlow = isUnlocked
      ? (isTier2 ? '#F59E0B' : '#38BDF8')
      : '#475569';

    // Color definitions per theme
    const themes = {
      omnitrix_green: {
        primary: '#10B981',
        secondary: '#059669',
        accent: '#34D399',
        border: isTier2 ? '#F59E0B' : '#10B981',
        icon: '<circle cx="50" cy="50" r="26" fill="#064E3B" stroke="#34D399" stroke-width="4"/><polygon points="38,32 62,32 50,50" fill="#34D399"/><polygon points="38,68 62,68 50,50" fill="#34D399"/>'
      },
      bleach_black_white: {
        primary: '#F8FAFC',
        secondary: '#0F172A',
        accent: '#E2E8F0',
        border: isTier2 ? '#F59E0B' : '#E2E8F0',
        icon: '<rect x="36" y="36" width="28" height="28" rx="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="3.5" transform="rotate(45 50 50)"/><path d="M42 50h16M50 42v16" stroke="#F8FAFC" stroke-width="3.5" stroke-linecap="round"/>'
      },
      dc_blue_gold: {
        primary: '#3B82F6',
        secondary: '#1E3A8A',
        accent: '#60A5FA',
        border: isTier2 ? '#F59E0B' : '#3B82F6',
        icon: '<path d="M50 25 L68 33 L64 62 L50 75 L36 62 L32 33 Z" fill="#1E3A8A" stroke="#60A5FA" stroke-width="3.5"/><polygon points="50,38 53,46 62,46 55,51 58,59 50,54 42,59 45,51 38,46 47,46" fill="#FBBF24"/>'
      },
      demon_slayer_red_black: {
        primary: '#EF4444',
        secondary: '#7F1D1D',
        accent: '#F87171',
        border: isTier2 ? '#F59E0B' : '#EF4444',
        icon: '<circle cx="50" cy="50" r="24" fill="#7F1D1D" stroke="#EF4444" stroke-width="3.5"/><path d="M50 32 C42 42 40 50 50 66 C60 50 58 42 50 32 Z" fill="#FBBF24"/><circle cx="50" cy="53" r="4" fill="#7F1D1D"/>'
      },
      dragon_ball_orange_gold: {
        primary: '#F97316',
        secondary: '#C2410C',
        accent: '#FBBF24',
        border: isTier2 ? '#F59E0B' : '#F97316',
        icon: '<circle cx="50" cy="50" r="25" fill="#C2410C" stroke="#FBBF24" stroke-width="3.5"/><polygon points="50,38 52,43 57,43 53,46 55,51 50,48 45,51 47,46 43,43 48,43" fill="#EF4444"/><polygon points="40,56 42,60 46,60 43,62 44,66 40,64 36,66 37,62 34,60 38,60" fill="#EF4444"/><polygon points="60,56 62,60 66,60 63,62 64,66 60,64 56,66 57,62 54,60 58,60" fill="#EF4444"/>'
      },
      got_grey_gold: {
        primary: '#94A3B8',
        secondary: '#1E293B',
        accent: '#CBD5E1',
        border: isTier2 ? '#F59E0B' : '#94A3B8',
        icon: '<path d="M35 65 L35 44 L44 52 L50 34 L56 52 L65 44 L65 65 Z" fill="#1E293B" stroke="#CBD5E1" stroke-width="3"/><circle cx="50" cy="62" r="3" fill="#FBBF24"/>'
      },
      marvel_red_gold: {
        primary: '#DC2626',
        secondary: '#991B1B',
        accent: '#F87171',
        border: isTier2 ? '#F59E0B' : '#DC2626',
        icon: '<circle cx="50" cy="50" r="25" fill="#991B1B" stroke="#EF4444" stroke-width="3.5"/><path d="M42 62 L50 36 L58 62 M45 54 h10" fill="none" stroke="#FBBF24" stroke-width="4.5" stroke-linecap="round"/>'
      },
      mha_green_red: {
        primary: '#059669',
        secondary: '#064E3B',
        accent: '#34D399',
        border: isTier2 ? '#F59E0B' : '#059669',
        icon: '<rect x="35" y="32" width="30" height="36" rx="6" fill="#064E3B" stroke="#34D399" stroke-width="3.5"/><path d="M50 40v20M40 50h20" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>'
      },
      naruto_orange_black: {
        primary: '#EA580C',
        secondary: '#7C2D12',
        accent: '#FB923C',
        border: isTier2 ? '#F59E0B' : '#EA580C',
        icon: '<circle cx="50" cy="50" r="24" fill="#7C2D12" stroke="#FB923C" stroke-width="3.5"/><path d="M50 38 A12 12 0 1 1 42 58 A8 8 0 1 1 50 46 A4 4 0 1 1 50 50" fill="none" stroke="#FBBF24" stroke-width="3" stroke-linecap="round"/>'
      },
      one_piece_red_blue: {
        primary: '#E11D48',
        secondary: '#881337',
        accent: '#FB7185',
        border: isTier2 ? '#F59E0B' : '#E11D48',
        icon: '<circle cx="50" cy="50" r="25" fill="#881337" stroke="#FBBF24" stroke-width="3.5"/><path d="M50 32v26M38 42h24M42 58c2 4 14 4 16 0" fill="none" stroke="#FBBF24" stroke-width="3.5" stroke-linecap="round"/>'
      },
      the_boys_dark_red: {
        primary: '#BE123C',
        secondary: '#4C0519',
        accent: '#FDA4AF',
        border: isTier2 ? '#F59E0B' : '#BE123C',
        icon: '<path d="M36 32 L50 68 L64 32 L54 32 L50 54 L46 32 Z" fill="#4C0519" stroke="#E11D48" stroke-width="3.5"/>'
      }
    };

    const t = themes[theme] || themes.dc_blue_gold;

    // Distinct Frame for Tier 1 vs Tier 2
    let frameMarkup;
    if (isTier2) {
      // Tier 2: Ornate Master Crest with double radiant ring and crown stars
      frameMarkup = `
        <circle cx="50" cy="50" r="45" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4 3" opacity="0.8"/>
        <polygon points="50,8 54,20 66,20 56,27 60,39 50,32 40,39 44,27 34,20 46,20" fill="#F59E0B" opacity="${isUnlocked ? '1' : '0.4'}"/>
        <circle cx="50" cy="50" r="38" fill="${t.secondary}" stroke="#F59E0B" stroke-width="3.5"/>
        <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(245,158,11,0.3)" stroke-width="1.5"/>
      `;
    } else {
      // Tier 1: Sleek Tactical Shield with clean perimeter
      frameMarkup = `
        <polygon points="50,14 84,24 76,72 50,88 24,72 16,24" fill="${t.secondary}" stroke="${t.border}" stroke-width="3.5"/>
        <polygon points="50,20 78,28 72,66 50,80 28,66 22,28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
      `;
    }

    return `
      <svg class="fandom-badge-svg ${isTier2 ? 'tier-2-svg' : 'tier-1-svg'}" viewBox="0 0 100 100" aria-hidden="true" style="opacity: ${opacity};">
        <defs>
          <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        ${frameMarkup}
        ${t.icon}
        ${!isUnlocked ? '<circle cx="50" cy="50" r="16" fill="rgba(15,23,42,0.88)" stroke="#64748B" stroke-width="2"/><path d="M46 48v-3a4 4 0 0 1 8 0v3M44 48h12v10H44z" fill="none" stroke="#94A3B8" stroke-width="2"/>' : ''}
      </svg>
    `;
  }

  /**
   * Helper to format progress requirement text matching user specification:
   * 0/200: 100 questions until Tier 1.
   * 67/200: 33 questions until Tier 1.
   * 100/200: Tier 1 earned; 100 more questions until Tier 2.
   * 199/200: 1 question until Tier 2.
   * 200/200: Both badges earned; fandom completed.
   */
  function formatFandomProgressStatus(completedQuestions) {
    const count = Math.max(0, Math.min(200, Number(completedQuestions) || 0));
    if (count < 100) {
      const remaining = 100 - count;
      return `${remaining} ${remaining === 1 ? 'question' : 'questions'} until Tier 1`;
    } else if (count === 199) {
      return '1 question until Tier 2';
    } else if (count < 200) {
      const remaining = 200 - count;
      return `Tier 1 earned; ${remaining} more questions until Tier 2`;
    } else {
      return 'Both badges earned; fandom completed!';
    }
  }

  function formatUnlockDate(isoDate) {
    if (!isoDate) return null;
    try {
      const dt = new Date(isoDate);
      return dt.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return String(isoDate).slice(0, 10);
    }
  }

  /**
   * Fetch authenticated badge & progress data from backend,
   * with seamless guest fallback loading directly from data/fandom_badges.json.
   */
  async function fetchBadgesData() {
    isLoading = true;
    renderLoadingState();

    const session = window.BluffAuth && window.BluffAuth.SessionManager
      ? window.BluffAuth.SessionManager.get()
      : null;

    if (session && session.access_token) {
      // Authenticated player: fetch from authoritative backend API
      try {
        const [badgesResp, progressResp] = await Promise.all([
          window.BluffAuth.AuthService.getFandomBadges(),
          window.BluffAuth.AuthService.getFandomProgress()
        ]);

        if (badgesResp && badgesResp.badges) {
          cachedBadges = badgesResp.badges;
          cachedProgress = progressResp && progressResp.fandoms ? progressResp.fandoms : [];
          isLoading = false;
          renderBadges();
          return;
        }
      } catch (err) {
        console.warn('[Truth Pool] Error fetching authenticated badges:', err);
        // Fall through to error handler
      }
    }

    // Guest / Unauthenticated or fallback: load canonical config
    try {
      const res = await fetch('data/fandom_badges.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawCatalog = await res.json();

      cachedBadges = rawCatalog.map(b => ({
        ...b,
        unlocked: false,
        unlocked_at: null,
        current_questions: 0,
        progress_pct: 0
      }));

      // Generate 0-progress records for all 11 fandoms
      const fandomSet = new Set(rawCatalog.map(b => b.fandom_id));
      cachedProgress = Array.from(fandomSet).sort().map(fid => ({
        fandom_id: fid,
        completed_questions: 0,
        total_questions: 200,
        progress_pct: 0,
        tier1_unlocked: false,
        tier1_unlocked_at: null,
        tier2_unlocked: false,
        tier2_unlocked_at: null
      }));

      isLoading = false;
      renderBadges();
    } catch (err) {
      isLoading = false;
      renderErrorState(err.message || 'Could not load badge catalog.');
    }
  }

  /**
   * Render loading skeleton
   */
  function renderLoadingState() {
    const container = document.getElementById('fandom-badges-content');
    if (!container) return;
    container.innerHTML = `
      <div class="badges-loading-state" role="status" aria-live="polite">
        <div class="spinner"></div>
        <p class="badges-loading-text">Loading Fandom Hall of Badges...</p>
      </div>
    `;
  }

  /**
   * Render error state with retry action
   */
  function renderErrorState(message) {
    const container = document.getElementById('fandom-badges-content');
    if (!container) return;
    container.innerHTML = `
      <div class="badges-error-state" role="alert">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <h3 class="error-title">Unable to Load Badges</h3>
        <p class="error-msg">${message}</p>
        <button type="button" id="btn-retry-badges" class="btn btn-hero-red btn-sm">↻ Retry Loading</button>
      </div>
    `;

    const retryBtn = document.getElementById('btn-retry-badges');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => fetchBadgesData());
    }
  }

  /**
   * Main rendering method
   */
  function renderBadges() {
    const container = document.getElementById('fandom-badges-content');
    if (!container) return;

    const session = window.BluffAuth && window.BluffAuth.SessionManager
      ? window.BluffAuth.SessionManager.get()
      : null;
    const isGuest = !session || !session.access_token;

    // 1. Render Summary Metrics Header
    renderSummaryMetrics(isGuest);

    // 2. Filter badges by status, fandom, and search term
    const filteredBadges = cachedBadges.filter(badge => {
      // Status filter
      if (currentFilter === 'unlocked' && !badge.unlocked) return false;
      if (currentFilter === 'locked' && badge.unlocked) return false;

      // Fandom filter
      if (currentFandomFilter !== 'all' && badge.fandom_id !== currentFandomFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = badge.title.toLowerCase().includes(q);
        const matchFandom = badge.fandom_id.toLowerCase().includes(q);
        const matchDesc = badge.description.toLowerCase().includes(q);
        if (!matchTitle && !matchFandom && !matchDesc) return false;
      }

      return true;
    });

    // 3. Render Guest notice banner if applicable
    let guestBannerHtml = '';
    if (isGuest) {
      guestBannerHtml = `
        <div class="badges-guest-banner" role="region" aria-label="Guest Mode Callout">
          <div class="guest-banner-icon" aria-hidden="true">💡</div>
          <div class="guest-banner-text">
            <strong>Browsing as Guest</strong>
            <p>Sign in or register to record your unique completed questions and permanently unlock these 22 badges.</p>
          </div>
          <button type="button" id="btn-badges-guest-login" class="btn btn-outline-pill">Sign In to Earn</button>
        </div>
      `;
    }

    // 4. Handle Empty Filter Results
    if (filteredBadges.length === 0) {
      container.innerHTML = `
        ${guestBannerHtml}
        <div class="badges-empty-state">
          <div class="empty-icon" aria-hidden="true">🔍</div>
          <h3 class="empty-title">No Badges Match Your Filters</h3>
          <p class="empty-desc">Try clearing your search term or selecting a different status filter.</p>
          <button type="button" id="btn-clear-badge-filters" class="btn btn-hero-dark btn-sm">Clear All Filters</button>
        </div>
      `;

      bindGuestBannerEvents();
      const clearBtn = document.getElementById('btn-clear-badge-filters');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          currentFilter = 'all';
          currentFandomFilter = 'all';
          searchQuery = '';
          const searchInput = document.getElementById('badges-search-input');
          if (searchInput) searchInput.value = '';
          updateFilterButtonsUi();
          renderBadges();
        });
      }
      return;
    }

    // 5. Group filtered badges by fandom
    const groupsByFandom = {};
    for (const badge of filteredBadges) {
      if (!groupsByFandom[badge.fandom_id]) {
        groupsByFandom[badge.fandom_id] = [];
      }
      groupsByFandom[badge.fandom_id].push(badge);
    }

    // Progress lookup map
    const progressMap = {};
    for (const p of cachedProgress) {
      progressMap[p.fandom_id] = p;
    }

    // 6. Build HTML for each fandom group
    let groupsHtml = '';
    const sortedFandoms = Object.keys(groupsByFandom).sort();

    for (const fandomId of sortedFandoms) {
      const badges = groupsByFandom[fandomId].sort((a, b) => a.badge_tier - b.badge_tier);
      const prog = progressMap[fandomId] || { completed_questions: 0 };
      const completed = prog.completed_questions || 0;
      const progressPercent = Math.min(100, Math.round((completed / 200) * 100));
      const statusText = formatFandomProgressStatus(completed);

      // Render cards for this fandom
      const cardsHtml = badges.map(badge => {
        const isTier2 = badge.badge_tier === 2;
        const tierLabel = isTier2 ? 'Tier 2 (200 Qs)' : 'Tier 1 (100 Qs)';
        const cardClass = `fandom-badge-card ${badge.unlocked ? 'unlocked' : 'locked'} tier-${badge.badge_tier}`;
        const unlockDate = formatUnlockDate(badge.unlocked_at);
        const currentQ = isGuest ? 0 : completed;
        const targetQ = badge.required_questions;
        const badgeProgressPct = Math.min(100, Math.round((currentQ / targetQ) * 100));

        return `
          <div class="${cardClass}"
               tabindex="0"
               role="button"
               data-badge-id="${badge.badge_id}"
               aria-label="${badge.title} — ${badge.fandom_id} ${tierLabel}: ${badge.unlocked ? 'Unlocked' : 'Locked'}">

            <div class="badge-card-header">
              <span class="badge-tier-pill ${isTier2 ? 'tier-2-pill' : 'tier-1-pill'}">
                ${isTier2 ? '★ TIER 2' : '◆ TIER 1'}
              </span>
              ${badge.unlocked
                ? `<span class="badge-status-chip unlocked-chip">✓ Unlocked</span>`
                : `<span class="badge-status-chip locked-chip">🔒 Locked</span>`}
            </div>

            <div class="badge-emblem-wrap">
              ${renderBadgeSvg(badge.visual_theme, badge.badge_tier, badge.unlocked)}
              ${badge.unlocked ? '<span class="badge-ambient-glow" aria-hidden="true"></span>' : ''}
            </div>

            <div class="badge-info-body">
              <h4 class="badge-item-title">${badge.title}</h4>
              <p class="badge-item-fandom">${badge.fandom_id}</p>
              <p class="badge-item-desc">${badge.description}</p>
            </div>

            <div class="badge-card-footer">
              <div class="badge-progress-col">
                <div class="badge-progress-meta">
                  <span class="meta-label">${badge.unlocked ? 'Mastered' : 'Progress'}</span>
                  <span class="meta-val">${currentQ} / ${targetQ} Qs</span>
                </div>
                <div class="badge-mini-track">
                  <div class="badge-mini-fill ${isTier2 ? 'fill-gold' : 'fill-cyan'}" style="width: ${badge.unlocked ? 100 : badgeProgressPct}%;"></div>
                </div>
              </div>

              ${unlockDate ? `<span class="badge-unlock-date">Earned on ${unlockDate}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      groupsHtml += `
        <section class="fandom-section-group" aria-labelledby="heading-${fandomId.replace(/\s+/g, '-')}">
          <div class="fandom-group-header">
            <div class="fandom-header-title-box">
              <h3 id="heading-${fandomId.replace(/\s+/g, '-')}" class="fandom-group-title">${fandomId}</h3>
              <span class="fandom-group-milestone">${statusText}</span>
            </div>

            <div class="fandom-header-actions">
              <div class="fandom-mastery-bar-wrap" title="${completed} of 200 questions completed">
                <span class="mastery-label">${completed} / 200</span>
                <div class="fandom-mastery-track">
                  <div class="fandom-mastery-fill" style="width: ${progressPercent}%;"></div>
                </div>
              </div>

              <button type="button"
                      class="btn btn-pill-action btn-play-fandom"
                      data-fandom="${fandomId}"
                      title="Play ${fandomId} questions">
                Play Fandom →
              </button>
            </div>
          </div>

          <div class="fandom-badges-grid">
            ${cardsHtml}
          </div>
        </section>
      `;
    }

    container.innerHTML = `
      ${guestBannerHtml}
      <div class="fandom-groups-container">
        ${groupsHtml}
      </div>
    `;

    bindGuestBannerEvents();
    bindBadgeCardClickEvents();
    bindPlayFandomEvents();
  }

  /**
   * Render overall metrics cards
   */
  function renderSummaryMetrics(isGuest) {
    const totalBadges = cachedBadges.length || 22;
    const unlockedBadges = isGuest ? 0 : cachedBadges.filter(b => b.unlocked).length;
    const completionPct = totalBadges > 0 ? Math.round((unlockedBadges / totalBadges) * 100) : 0;

    // Count fully mastered fandoms (200/200)
    let completedFandoms = 0;
    for (const p of cachedProgress) {
      if ((p.completed_questions || 0) >= 200) completedFandoms++;
    }

    const countEl = document.getElementById('summary-unlocked-count');
    const fillEl = document.getElementById('summary-completion-fill');
    const pctEl = document.getElementById('summary-completion-pct');
    const fandomsEl = document.getElementById('summary-completed-fandoms');

    if (countEl) countEl.textContent = `${unlockedBadges} / ${totalBadges}`;
    if (fillEl) fillEl.style.width = `${completionPct}%`;
    if (pctEl) pctEl.textContent = `${completionPct}%`;
    if (fandomsEl) fandomsEl.textContent = `${completedFandoms} / 11`;
  }

  /**
   * Bind guest banner sign-in action
   */
  function bindGuestBannerEvents() {
    const guestBtn = document.getElementById('btn-badges-guest-login');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        if (window.BluffAuth && typeof window.BluffAuth.openModal === 'function') {
          window.BluffAuth.openModal('login');
        }
      });
    }
  }

  /**
   * Bind click event on individual badge cards to show detailed lore modal
   */
  function bindBadgeCardClickEvents() {
    document.querySelectorAll('.fandom-badge-card').forEach(card => {
      card.addEventListener('click', () => {
        const badgeId = card.getAttribute('data-badge-id');
        const badge = cachedBadges.find(b => b.badge_id === badgeId);
        if (badge) {
          showBadgeDetailModal(badge);
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const badgeId = card.getAttribute('data-badge-id');
          const badge = cachedBadges.find(b => b.badge_id === badgeId);
          if (badge) {
            showBadgeDetailModal(badge);
          }
        }
      });
    });
  }

  /**
   * Bind "Play Fandom" shortcut button
   */
  function bindPlayFandomEvents() {
    document.querySelectorAll('.btn-play-fandom').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fandom = btn.getAttribute('data-fandom');
        if (!fandom) return;

        // Switch to Game Setup and pre-select this category
        const catSelect = document.getElementById('category-select');
        if (catSelect) {
          catSelect.value = fandom;
          // Trigger change event if listeners depend on it
          catSelect.dispatchEvent(new Event('change'));
        }

        const navPlay = document.getElementById('nav-play');
        if (navPlay) navPlay.click();
      });
    });
  }

  /**
   * Badge Lore & Detail Popover Modal
   */
  function showBadgeDetailModal(badge) {
    const modal = document.getElementById('fandom-badge-detail-modal');
    if (!modal) return;

    const emblemContainer = document.getElementById('badge-modal-emblem');
    const titleEl = document.getElementById('badge-modal-title');
    const fandomEl = document.getElementById('badge-modal-fandom');
    const tierEl = document.getElementById('badge-modal-tier');
    const descEl = document.getElementById('badge-modal-desc');
    const reqEl = document.getElementById('badge-modal-req');
    const statusPill = document.getElementById('badge-modal-status');
    const dateEl = document.getElementById('badge-modal-date');

    if (emblemContainer) {
      emblemContainer.innerHTML = renderBadgeSvg(badge.visual_theme, badge.badge_tier, badge.unlocked);
    }
    if (titleEl) titleEl.textContent = badge.title;
    if (fandomEl) fandomEl.textContent = badge.fandom_id;
    if (tierEl) {
      tierEl.textContent = badge.badge_tier === 2 ? 'Tier 2 Master' : 'Tier 1 Initiate';
      tierEl.className = `modal-tier-pill ${badge.badge_tier === 2 ? 'tier-2' : 'tier-1'}`;
    }
    if (descEl) descEl.textContent = badge.description;
    if (reqEl) reqEl.textContent = badge.unlock_condition || `Answer ${badge.required_questions} unique questions in ${badge.fandom_id}.`;

    if (statusPill) {
      statusPill.textContent = badge.unlocked ? '✓ Unlocked' : '🔒 Locked';
      statusPill.className = `modal-status-pill ${badge.unlocked ? 'unlocked' : 'locked'}`;
    }

    if (dateEl) {
      const formattedDate = formatUnlockDate(badge.unlocked_at);
      if (badge.unlocked && formattedDate) {
        dateEl.textContent = `Unlocked on ${formattedDate}`;
        dateEl.style.display = 'block';
      } else {
        dateEl.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  function closeBadgeDetailModal() {
    const modal = document.getElementById('fandom-badge-detail-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  /**
   * Badge Unlock Celebration Modal (Triggered ONLY on verified backend award response)
   */
  function showBadgeCelebration(badge) {
    if (!badge || celebratedBadgeIds.has(badge.badge_id)) return;
    celebratedBadgeIds.add(badge.badge_id);

    const modal = document.getElementById('fandom-celebration-modal');
    if (!modal) return;

    const emblemWrap = document.getElementById('celebration-emblem-wrap');
    const titleEl = document.getElementById('celebration-badge-title');
    const fandomEl = document.getElementById('celebration-badge-fandom');
    const tierEl = document.getElementById('celebration-badge-tier');
    const descEl = document.getElementById('celebration-badge-desc');

    if (emblemWrap) {
      emblemWrap.innerHTML = renderBadgeSvg(badge.visual_theme, badge.badge_tier, true);
    }
    if (titleEl) titleEl.textContent = badge.title;
    if (fandomEl) fandomEl.textContent = badge.fandom_id;
    if (tierEl) {
      tierEl.textContent = badge.badge_tier === 2 ? '★ TIER 2 MASTER UNLOCKED!' : '◆ TIER 1 INITIATE UNLOCKED!';
      tierEl.className = `celebration-tier-badge ${badge.badge_tier === 2 ? 'gold' : 'cyan'}`;
    }
    if (descEl) descEl.textContent = badge.description;

    modal.style.display = 'flex';
    modal.classList.add('active');

    // Trigger celebration particles if reduced motion is not preferred
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      triggerCelebrationParticles();
    }
  }

  function closeCelebrationModal() {
    const modal = document.getElementById('fandom-celebration-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  /**
   * Light CSS/DOM celebration particle burst
   */
  function triggerCelebrationParticles() {
    const container = document.getElementById('celebration-particles');
    if (!container) return;
    container.innerHTML = '';

    const colors = ['#F59E0B', '#38BDF8', '#10B981', '#EC4899', '#8B5CF6'];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('div');
      p.className = 'celebration-spark';
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 140;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.setProperty('--tx', `${x}px`);
      p.style.setProperty('--ty', `${y}px`);
      p.style.backgroundColor = color;
      container.appendChild(p);
    }
  }

  /**
   * Update filter button active states
   */
  function updateFilterButtonsUi() {
    document.querySelectorAll('.badge-filter-btn').forEach(btn => {
      const filter = btn.getAttribute('data-filter');
      if (filter === currentFilter) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    const fandomSelect = document.getElementById('badges-fandom-filter');
    if (fandomSelect) {
      fandomSelect.value = currentFandomFilter;
    }
  }

  /**
   * Populate fandom dropdown filter with all 11 fandoms
   */
  function populateFandomFilterOptions() {
    const select = document.getElementById('badges-fandom-filter');
    if (!select) return;

    const fandoms = [
      'Ben 10',
      'Bleach',
      'DC Universe',
      'Demon Slayer',
      'Dragon Ball',
      'Game of Thrones',
      'Marvel Universe',
      'My Hero Academia',
      'Naruto',
      'One Piece',
      'The Boys'
    ];

    select.innerHTML = '<option value="all">All Fandoms (11)</option>';
    for (const f of fandoms) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      select.appendChild(opt);
    }
  }

  /**
   * UI Initialization
   */
  function initFandomBadgesUI() {
    populateFandomFilterOptions();

    // 1. Filter Buttons (All, Unlocked, Locked)
    document.querySelectorAll('.badge-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter') || 'all';
        updateFilterButtonsUi();
        renderBadges();
      });
    });

    // 2. Fandom Dropdown Filter
    const fandomSelect = document.getElementById('badges-fandom-filter');
    if (fandomSelect) {
      fandomSelect.addEventListener('change', () => {
        currentFandomFilter = fandomSelect.value;
        renderBadges();
      });
    }

    // 3. Search Input
    const searchInput = document.getElementById('badges-search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = searchQuery ? 'inline-flex' : 'none';
        }
        renderBadges();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderBadges();
      });
    }

    // 4. Modal Close Handlers
    const detailCloseBtn = document.getElementById('badge-modal-close');
    const detailBackdrop = document.getElementById('badge-modal-backdrop');
    if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeBadgeDetailModal);
    if (detailBackdrop) detailBackdrop.addEventListener('click', closeBadgeDetailModal);

    const celebCloseBtn = document.getElementById('celebration-modal-close');
    const celebBackdrop = document.getElementById('celebration-modal-backdrop');
    const celebAckBtn = document.getElementById('btn-celebration-ack');
    if (celebCloseBtn) celebCloseBtn.addEventListener('click', closeCelebrationModal);
    if (celebBackdrop) celebBackdrop.addEventListener('click', closeCelebrationModal);
    if (celebAckBtn) celebAckBtn.addEventListener('click', closeCelebrationModal);

    // Global ESC key to close open modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeBadgeDetailModal();
        closeCelebrationModal();
      }
    });

    // Refresh trigger
    const refreshBtn = document.getElementById('btn-refresh-badges');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchBadgesData());
    }
  }

  // Public Namespace
  window.TruthPoolFandomBadges = {
    init: initFandomBadgesUI,
    loadAndRender: fetchBadgesData,
    refresh: fetchBadgesData,
    showBadgeCelebration,
    showBadgeDetailModal,
    formatProgressStatus: formatFandomProgressStatus,
    renderBadgeSvg,
    getCachedBadges: () => cachedBadges.slice(),
    getCachedProgress: () => cachedProgress.slice()
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFandomBadgesUI);
  } else {
    initFandomBadgesUI();
  }
})();
