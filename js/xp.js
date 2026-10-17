/**
 * Truth Pool — XP Points & Player Level System (Phase 4A)
 * Manages player XP calculation, level progression, UI badges,
 * progress bars, level-up animations, and toast notifications.
 */

(function () {
  'use strict';

  const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    850,    // Level 5
    1300,   // Level 6
    1900,   // Level 7
    2700,   // Level 8
    3700,   // Level 9
    5000,   // Level 10
    6500,   // Level 11
    8500,   // Level 12
    11000,  // Level 13
    14000,  // Level 14
    17500,  // Level 15
    21500,  // Level 16
    25500,  // Level 17
    30000,  // Level 18
    35000,  // Level 19
    40000   // Level 20 (Max Level)
  ];

  const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 20

  const LEVEL_TITLES = {
    1: 'Truth Novice',
    2: 'Fact Scout',
    3: 'Truth Seeker',
    4: 'Myth Hunter',
    5: 'Fact Checker',
    6: 'Truth Inquirer',
    7: 'Bluff Spotter',
    8: 'Truth Detective',
    9: 'Senior Sleuth',
    10: 'Master Inquirer',
    11: 'Truth Champion',
    12: 'Grand Inquisitor',
    13: 'Cipher Master',
    14: 'Archon of Truth',
    15: 'Omniscient Seer',
    16: 'Truth Oracle',
    17: 'Cosmic Mind',
    18: 'Truth Pool Titan',
    19: 'Living Legend',
    20: 'Grandmaster of Truth'
  };

  function deriveLevel(xp) {
    const val = Math.max(0, parseInt(xp, 10) || 0);
    let lvl = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (val >= LEVEL_THRESHOLDS[i]) {
        lvl = i + 1;
      } else {
        break;
      }
    }
    return Math.min(lvl, MAX_LEVEL);
  }

  function getLevelTitle(lvl) {
    return LEVEL_TITLES[lvl] || `Level ${lvl}`;
  }

  function getLevelProgression(totalXp) {
    const xp = Math.max(0, parseInt(totalXp, 10) || 0);
    const lvl = deriveLevel(xp);
    const isMax = lvl >= MAX_LEVEL;
    const currentStart = LEVEL_THRESHOLDS[lvl - 1];
    const nextStart = isMax ? null : LEVEL_THRESHOLDS[lvl];
    const xpInLevel = xp - currentStart;
    const xpNeeded = isMax ? 0 : nextStart - currentStart;
    const toNext = isMax ? 0 : Math.max(0, nextStart - xp);
    const progressPct = isMax ? 100 : Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

    return {
      totalXp: xp,
      level: lvl,
      isMaxLevel: isMax,
      title: getLevelTitle(lvl),
      currentLevelStart: currentStart,
      nextLevelStart: nextStart,
      xpInLevel: xpInLevel,
      xpNeededForLevel: xpNeeded,
      xpToNextLevel: toNext,
      progressPct: Math.round(progressPct * 10) / 10
    };
  }

  let toastTimeout = null;

  function showLevelUpToast(data) {
    const toast = document.getElementById('levelup-toast');
    if (!toast) return;

    const titleElem = document.getElementById('levelup-toast-title');
    const subElem = document.getElementById('levelup-toast-sub');
    const xpElem = document.getElementById('levelup-toast-xp');

    const lvl = data.level || deriveLevel(data.total_xp);
    const title = getLevelTitle(lvl);

    if (titleElem) titleElem.textContent = 'Level Up!';
    if (subElem) subElem.textContent = `You reached Level ${lvl} — ${title}!`;
    if (xpElem) {
      if (data.total_xp != null) {
        xpElem.textContent = `${data.total_xp} Total XP`;
      } else {
        xpElem.textContent = '';
      }
    }

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

  // Update UI Elements with XP & Level info
  function updateUI(progression) {
    // 1. Header XP Panel
    const headerPanel = document.getElementById('header-xp-panel');
    const headerBadge = document.getElementById('header-level-badge');
    const headerFill = document.getElementById('header-xp-bar-fill');
    const headerLabel = document.getElementById('header-xp-label');

    if (headerPanel) {
      headerPanel.style.display = 'flex';
      if (headerBadge) {
        headerBadge.textContent = `Lvl ${progression.level}`;
        headerBadge.className = `xp-level-badge${progression.isMaxLevel ? ' max-level' : ''}`;
      }
      if (headerFill) {
        headerFill.style.width = `${progression.progressPct}%`;
        if (progression.isMaxLevel) {
          headerFill.classList.add('max-level-fill');
        } else {
          headerFill.classList.remove('max-level-fill');
        }
      }
      if (headerLabel) {
        headerLabel.textContent = progression.isMaxLevel
          ? `${progression.totalXp} XP (MAX)`
          : `${progression.totalXp} XP`;
      }
    }

    // 2. Setup Screen Player Banner & Compact Dashboard
    const bannerBadge = document.getElementById('player-banner-level-badge');
    const bannerXpText = document.getElementById('player-banner-xp-text');
    if (bannerBadge) {
      bannerBadge.textContent = `Lvl ${progression.level}`;
      bannerBadge.className = `xp-level-badge${progression.isMaxLevel ? ' max-level' : ''}`;
    }
    if (bannerXpText) {
      bannerXpText.textContent = `${progression.totalXp} XP (${progression.title})`;
    }

    const dashFill = document.getElementById('dash-xp-bar-fill');
    const dashProgLabel = document.getElementById('dash-xp-progress-label');
    const dashNeededLabel = document.getElementById('dash-xp-needed-label');
    if (dashFill) dashFill.style.width = `${progression.progressPct}%`;
    if (dashProgLabel) {
      dashProgLabel.textContent = progression.isMaxLevel
        ? 'Max Rank Achieved!'
        : `${progression.progressPct}% towards Level ${progression.level + 1}`;
    }
    if (dashNeededLabel) {
      dashNeededLabel.textContent = progression.isMaxLevel
        ? 'Top Tier Master'
        : `${progression.xpToNextLevel} XP needed`;
    }

    // 3. Stats Modal XP Card
    const statLevelBadge = document.getElementById('player-stat-level');
    const statFill = document.getElementById('xp-stats-bar-fill');
    const statPctText = document.getElementById('xp-stats-pct-text');
    const statNeededText = document.getElementById('xp-stats-needed-text');
    const statTotalXp = document.getElementById('player-stat-xp');

    if (statLevelBadge) {
      statLevelBadge.textContent = `Level ${progression.level} — ${progression.title}`;
      if (progression.isMaxLevel) {
        statLevelBadge.classList.add('max-level');
      } else {
        statLevelBadge.classList.remove('max-level');
      }
    }
    if (statFill) {
      statFill.style.width = `${progression.progressPct}%`;
      if (progression.isMaxLevel) {
        statFill.classList.add('max-level-fill');
      } else {
        statFill.classList.remove('max-level-fill');
      }
    }
    if (statPctText) {
      statPctText.textContent = progression.isMaxLevel
        ? 'Maximum Level Reached!'
        : `${progression.progressPct}% towards Level ${progression.level + 1}`;
    }
    if (statNeededText) {
      statNeededText.textContent = progression.isMaxLevel
        ? 'Top Tier Master'
        : `${progression.xpToNextLevel} XP needed`;
    }
    if (statTotalXp) {
      statTotalXp.textContent = progression.totalXp;
    }
  }

  function syncFromStats(stats) {
    if (!stats) return;
    const totalXp = stats.total_xp || 0;
    const progression = getLevelProgression(totalXp);
    updateUI(progression);
    return progression;
  }

  function displayCompletionXP(xpResult) {
    const section = document.getElementById('completion-xp-section');
    if (!section) return;

    if (!xpResult) {
      section.style.display = 'none';
      return;
    }

    const earnedElem = document.getElementById('stat-xp-earned');
    const lvlBadge = document.getElementById('completion-xp-level');
    const lvlUpTag = document.getElementById('completion-xp-lvl-up');

    const xpEarned = xpResult.xp_earned_this_round != null
      ? xpResult.xp_earned_this_round
      : (xpResult.xp_earned || 0);

    const totalXp = xpResult.total_xp != null ? xpResult.total_xp : 0;
    const progression = getLevelProgression(totalXp);

    if (earnedElem) {
      earnedElem.textContent = `+${xpEarned} XP`;
    }

    if (lvlBadge) {
      lvlBadge.textContent = `Lvl ${progression.level} — ${progression.title}`;
      lvlBadge.className = `xp-level-badge${progression.isMaxLevel ? ' max-level' : ''}`;
    }

    if (lvlUpTag) {
      if (xpResult.leveled_up) {
        lvlUpTag.classList.add('visible');
        lvlUpTag.textContent = `🎉 LEVEL UP! (Lvl ${progression.level})`;
      } else {
        lvlUpTag.classList.remove('visible');
      }
    }

    section.style.display = 'flex';

    // Update global UI panels
    updateUI(progression);

    // If leveled up, trigger celebration toast
    if (xpResult.leveled_up) {
      showLevelUpToast({
        level: progression.level,
        title: progression.title,
        total_xp: totalXp
      });
    }
  }

  function reset() {
    const headerPanel = document.getElementById('header-xp-panel');
    if (headerPanel) headerPanel.style.display = 'none';

    const completionSection = document.getElementById('completion-xp-section');
    if (completionSection) completionSection.style.display = 'none';

    const bannerXpText = document.getElementById('player-banner-xp-text');
    if (bannerXpText) bannerXpText.textContent = '0 XP';

    const toast = document.getElementById('levelup-toast');
    if (toast) toast.classList.remove('visible');
  }

  // Export public namespace
  window.BluffXP = {
    LEVEL_THRESHOLDS,
    MAX_LEVEL,
    LEVEL_TITLES,
    deriveLevel,
    getLevelTitle,
    getLevelProgression,
    showLevelUpToast,
    updateUI,
    syncFromStats,
    displayCompletionXP,
    reset
  };

})();
