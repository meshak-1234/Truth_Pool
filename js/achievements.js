/**
 * Truth Pool — Achievement Badges Dashboard Module (Phase 4B)
 * Compact Laptop Viewport (1366x768 friendly)
 * Manages achievement loading, badge rendering, progress indicators,
 * subtle unlock notifications, and modal popover details.
 */

(function () {
  'use strict';

  // Canonical catalog of 10 achievements with icons and requirements
  const ACHIEVEMENTS_CATALOG = [
    {
      id: 'first_victory',
      title: 'First Victory',
      description: 'Complete your first game round.',
      icon: '🏆',
      category: 'Milestone',
      target: 1,
      progress_type: 'rounds'
    },
    {
      id: 'getting_started',
      title: 'Getting Started',
      description: 'Answer 10 questions correctly in total.',
      icon: '🎯',
      category: 'Accuracy',
      target: 10,
      progress_type: 'correct_answers'
    },
    {
      id: 'sharp_mind',
      title: 'Sharp Mind',
      description: 'Achieve at least 80% accuracy in a completed round with at least 10 questions.',
      icon: '🧠',
      category: 'Skill',
      target: 80,
      progress_type: 'round_accuracy'
    },
    {
      id: 'perfect_round',
      title: 'Perfect Round',
      description: 'Answer every question correctly in a completed round containing at least 10 questions.',
      icon: '⚡',
      category: 'Mastery',
      target: 100,
      progress_type: 'round_perfect'
    },
    {
      id: 'quiz_veteran',
      title: 'Quiz Veteran',
      description: 'Complete 10 game rounds.',
      icon: '🎖️',
      category: 'Dedication',
      target: 10,
      progress_type: 'rounds'
    },
    {
      id: 'knowledge_seeker',
      title: 'Knowledge Seeker',
      description: 'Complete 25 game rounds.',
      icon: '🔍',
      category: 'Dedication',
      target: 25,
      progress_type: 'rounds'
    },
    {
      id: 'century_club',
      title: 'Century Club',
      description: 'Answer 100 questions correctly in total.',
      icon: '💯',
      category: 'Accuracy',
      target: 100,
      progress_type: 'correct_answers'
    },
    {
      id: 'level_up',
      title: 'Level Up',
      description: 'Reach player level 5.',
      icon: '🚀',
      category: 'Progression',
      target: 5,
      progress_type: 'level'
    },
    {
      id: 'dedicated_player',
      title: 'Dedicated Player',
      description: 'Complete 50 game rounds.',
      icon: '🛡️',
      category: 'Dedication',
      target: 50,
      progress_type: 'rounds'
    },
    {
      id: 'unstoppable',
      title: 'Unstoppable',
      description: 'Complete 100 game rounds.',
      icon: '👑',
      category: 'Mastery',
      target: 100,
      progress_type: 'rounds'
    }
  ];

  let currentAchievements = [];
  let toastTimeout = null;

  function formatUnlockDate(isoDate) {
    if (!isoDate) return 'Locked';
    try {
      const dt = new Date(isoDate);
      return dt.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoDate.slice(0, 10);
    }
  }

  /**
   * Render badges into a container element
   */
  function renderBadgeGrid(container, items) {
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = `achievement-badge-card${item.unlocked ? ' unlocked' : ' locked'}`;
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('data-id', item.id);
      card.setAttribute(
        'title',
        `${item.title} — ${item.description} (${item.unlocked ? 'Unlocked: ' + formatUnlockDate(item.unlocked_at) : item.progress_label})`
      );

      const statusBadge = item.unlocked
        ? `<span class="badge-status-pill unlocked">✓ Unlocked</span>`
        : `<span class="badge-status-pill locked">${item.progress_label || 'Locked'}</span>`;

      card.innerHTML = `
        <div class="badge-icon-frame">
          <span class="badge-icon" aria-hidden="true">${item.icon}</span>
          ${item.unlocked ? '<span class="badge-glow-ring"></span>' : ''}
        </div>
        <div class="badge-content">
          <h4 class="badge-title">${item.title}</h4>
          <p class="badge-desc">${item.description}</p>
          <div class="badge-footer">
            ${statusBadge}
            ${!item.unlocked && item.progress_pct != null ? `
              <div class="badge-micro-track" title="${item.progress_pct}% complete">
                <div class="badge-micro-fill" style="width: ${item.progress_pct}%"></div>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => showBadgeDetailPopover(item));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showBadgeDetailPopover(item);
        }
      });

      container.appendChild(card);
    });
  }

  /**
   * Compact modal popover for full badge detail
   */
  function showBadgeDetailPopover(item) {
    let popover = document.getElementById('achievement-detail-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'achievement-detail-popover';
      popover.className = 'achievement-detail-popover';
      popover.innerHTML = `
        <div class="popover-backdrop" id="popover-backdrop"></div>
        <div class="popover-card">
          <button type="button" class="popover-close-btn" id="popover-close-btn" aria-label="Close">&times;</button>
          <div class="popover-icon" id="popover-icon">🏆</div>
          <h3 class="popover-title" id="popover-title">First Victory</h3>
          <span class="popover-category" id="popover-category">Milestone</span>
          <p class="popover-desc" id="popover-desc">Complete your first game round.</p>
          <div class="popover-meta" id="popover-meta">
            <span class="popover-status" id="popover-status">Locked</span>
          </div>
        </div>
      `;
      document.body.appendChild(popover);

      popover.querySelector('#popover-close-btn').addEventListener('click', () => {
        popover.classList.remove('active');
      });
      popover.querySelector('#popover-backdrop').addEventListener('click', () => {
        popover.classList.remove('active');
      });
    }

    const iconEl = popover.querySelector('#popover-icon');
    const titleEl = popover.querySelector('#popover-title');
    const catEl = popover.querySelector('#popover-category');
    const descEl = popover.querySelector('#popover-desc');
    const metaEl = popover.querySelector('#popover-meta');

    iconEl.textContent = item.icon;
    titleEl.textContent = item.title;
    catEl.textContent = item.category || 'General';
    descEl.textContent = item.description;

    if (item.unlocked) {
      metaEl.innerHTML = `
        <span class="badge-status-pill unlocked">✓ Unlocked on ${formatUnlockDate(item.unlocked_at)}</span>
      `;
    } else {
      metaEl.innerHTML = `
        <span class="badge-status-pill locked">Locked — Current Progress: ${item.progress_label || 'Incomplete'}</span>
        <div class="badge-micro-track" style="margin-top: 8px;">
          <div class="badge-micro-fill" style="width: ${item.progress_pct || 0}%"></div>
        </div>
      `;
    }

    popover.classList.add('active');
  }

  /**
   * Subtle toast notification when an achievement unlocks
   */
  function showUnlockToast(ach) {
    const toast = document.getElementById('achievement-unlock-toast');
    if (!toast) return;

    const iconEl = document.getElementById('ach-toast-icon');
    const titleEl = document.getElementById('ach-toast-title');
    const subEl = document.getElementById('ach-toast-sub');

    if (iconEl) iconEl.textContent = ach.icon || '🏆';
    if (titleEl) titleEl.textContent = 'Achievement Unlocked!';
    if (subEl) subEl.textContent = `${ach.title} — ${ach.description}`;

    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    toast.classList.remove('visible');
    void toast.offsetWidth; // trigger reflow
    toast.classList.add('visible');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4500);
  }

  /**
   * Update the dashboard achievements UI (setup dashboard + modal tab)
   */
  function updateDashboard(data) {
    if (!data) return;
    const items = data.achievements || data.items || [];
    currentAchievements = items;

    const unlockedCount = data.unlocked_count != null
      ? data.unlocked_count
      : items.filter(a => a.unlocked).length;
    const totalCount = items.length || 10;
    const completionPct = Math.round((unlockedCount / totalCount) * 100);

    // 1. Dashboard summary counters
    const dashCountEl = document.getElementById('dash-ach-count');
    const dashFillEl = document.getElementById('dash-ach-fill');
    const dashPctEl = document.getElementById('dash-ach-pct');

    if (dashCountEl) dashCountEl.textContent = `${unlockedCount} / ${totalCount}`;
    if (dashFillEl) dashFillEl.style.width = `${completionPct}%`;
    if (dashPctEl) dashPctEl.textContent = `${completionPct}%`;

    // 2. Dashboard badge grid (Setup view)
    const setupGrid = document.getElementById('setup-achievements-grid');
    if (setupGrid) {
      renderBadgeGrid(setupGrid, items);
    }

    // 3. Modal achievements tab
    const modalGrid = document.getElementById('modal-achievements-grid');
    const modalCountEl = document.getElementById('modal-ach-count');
    const modalFillEl = document.getElementById('modal-ach-fill');

    if (modalGrid) renderBadgeGrid(modalGrid, items);
    if (modalCountEl) modalCountEl.textContent = `${unlockedCount} / ${totalCount}`;
    if (modalFillEl) modalFillEl.style.width = `${completionPct}%`;
  }

  /**
   * Handle completion screen achievements
   */
  function handleRoundCompletionAchievements(achData) {
    if (!achData) return;
    const newly = achData.newly_unlocked || [];
    if (newly.length > 0) {
      // Show subtle unlock notification for the first unlocked badge
      showUnlockToast(newly[0]);

      // If multiple unlocked, queue next ones sequentially
      if (newly.length > 1) {
        let idx = 1;
        const interval = setInterval(() => {
          if (idx < newly.length) {
            showUnlockToast(newly[idx]);
            idx++;
          } else {
            clearInterval(interval);
          }
        }, 4800);
      }
    }

    if (achData.items) {
      updateDashboard({
        unlocked_count: achData.total_unlocked,
        total_count: achData.total_count,
        achievements: achData.items
      });
    }
  }

  /**
   * Fetch latest achievements from server
   */
  async function refreshAchievements() {
    if (!window.BluffAuth || !window.BluffAuth.AuthService) return;
    try {
      const data = await window.BluffAuth.AuthService.getPlayerAchievements();
      updateDashboard(data);
      return data;
    } catch {
      // Guest or offline: render catalog with 0 progress
      const defaultItems = ACHIEVEMENTS_CATALOG.map(a => ({
        ...a,
        unlocked: false,
        unlocked_at: null,
        current_val: 0,
        progress_label: '0 / ' + a.target,
        progress_pct: 0
      }));
      updateDashboard({
        unlocked_count: 0,
        total_count: defaultItems.length,
        achievements: defaultItems
      });
    }
  }

  function reset() {
    currentAchievements = [];
    const toast = document.getElementById('achievement-unlock-toast');
    if (toast) toast.classList.remove('visible');

    // Render locked catalog for guest
    const defaultItems = ACHIEVEMENTS_CATALOG.map(a => ({
      ...a,
      unlocked: false,
      unlocked_at: null,
      current_val: 0,
      progress_label: '0 / ' + a.target,
      progress_pct: 0
    }));
    updateDashboard({
      unlocked_count: 0,
      total_count: defaultItems.length,
      achievements: defaultItems
    });
  }

  // Export public namespace
  window.BluffAchievements = {
    CATALOG: ACHIEVEMENTS_CATALOG,
    updateDashboard,
    handleRoundCompletionAchievements,
    refreshAchievements,
    showUnlockToast,
    showBadgeDetailPopover,
    reset
  };

  // Auto-init initial locked grid
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      reset();
    });
  } else {
    reset();
  }
})();
