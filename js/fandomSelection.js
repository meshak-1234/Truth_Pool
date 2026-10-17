/**
 * Truth Pool — Fandom Selection Component (Screen 2)
 * Renders all 11 configured fandoms in a responsive, gaming-styled grid.
 * Derives question counts directly from the game engine and displays authenticated personal progress.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TruthPoolFandomSelection = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 11 Configured Fandoms Metadata
  const FANDOMS = [
    {
      id: 'Marvel Universe',
      name: 'Marvel Universe',
      dataset: 'marvel_combined.json',
      theme: 'marvel_red_gold',
      tagline: 'Earth\'s Mightiest Heroes & Cosmic Entities',
      description: 'Avenger triumphs, mutant sagas, Infinity Stones, and multiversal incursions.',
      color: '#DC2626',
      badgeTier1: 'Avenger Recruit',
      badgeTier2: 'Multiverse Guardian'
    },
    {
      id: 'DC Universe',
      name: 'DC Universe',
      dataset: 'dc_combined.json',
      theme: 'dc_blue_gold',
      tagline: 'Gods, Vigilantes & the Justice League',
      description: 'Gotham shadows, Kryptonian strength, Speed Force truths, and Multiverse crises.',
      color: '#2563EB',
      badgeTier1: 'Justice League Initiate',
      badgeTier2: 'Crisis Survivor'
    },
    {
      id: 'Naruto',
      name: 'Naruto',
      dataset: 'naruto_combined.json',
      theme: 'naruto_orange_black',
      tagline: 'Shinobi Warfare & Ninja Way',
      description: 'Hidden Leaf jutsu masteries, chakra natures, tailed beasts, and legendary battles.',
      color: '#EA580C',
      badgeTier1: 'Genin Graduate',
      badgeTier2: 'Hokage of the Leaf'
    },
    {
      id: 'One Piece',
      name: 'One Piece',
      dataset: 'one_piece_combined.json',
      theme: 'one_piece_red_blue',
      tagline: 'The Grand Line & King of the Pirates',
      description: 'Devil Fruit mysteries, Straw Hat voyages, Ancient Weapons, and Yonko supremacy.',
      color: '#E11D48',
      badgeTier1: 'Straw Hat Recruit',
      badgeTier2: 'King of the Pirates'
    },
    {
      id: 'Dragon Ball',
      name: 'Dragon Ball',
      dataset: 'dragon_ball_combined.json',
      theme: 'dragon_ball_orange_gold',
      tagline: 'Saiyan Pride & Multiverse Tournaments',
      description: 'Super Saiyan evolutions, Shenron summons, divine God Ki, and tournament showdowns.',
      color: '#F97316',
      badgeTier1: 'Turtle School Disciple',
      badgeTier2: 'Super Saiyan God'
    },
    {
      id: 'Bleach',
      name: 'Bleach',
      dataset: 'bleach_combined.json',
      theme: 'bleach_black_white',
      tagline: 'Soul Reapers & Hollow Incursions',
      description: 'Zanpakuto releases, Bankai awakenings, Gotei 13 captains, and the Hueco Mundo war.',
      color: '#0F172A',
      badgeTier1: 'Substitute Soul Reaper',
      badgeTier2: 'Bankai Master'
    },
    {
      id: 'Demon Slayer',
      name: 'Demon Slayer',
      dataset: 'demon_slayer_combined.json',
      theme: 'demon_slayer_black_red',
      tagline: 'Breathing Techniques & Nichirin Blades',
      description: 'Total Concentration Breathing, Hashira swordsmen, blood demon arts, and Upper Moons.',
      color: '#991B1B',
      badgeTier1: 'Corps Recruit',
      badgeTier2: 'Hashira Master'
    },
    {
      id: 'Ben 10',
      name: 'Ben 10',
      dataset: 'ben_10_combined.json',
      theme: 'omnitrix_green',
      tagline: 'Galvan Tech & Omnitrix Alien DNA',
      description: 'Alien transformations, Vilgax vendettas, Azmuth creations, and Plumber lore.',
      color: '#10B981',
      badgeTier1: 'Plumber Cadet',
      badgeTier2: 'Master of the Omnitrix'
    },
    {
      id: 'My Hero Academia',
      name: 'My Hero Academia',
      dataset: 'my_hero_academia_combined.json',
      theme: 'mha_green_red',
      tagline: 'Plus Ultra & Quirk Awakenings',
      description: 'One For All legacies, Class 1-A rivalries, Pro Hero rankings, and Villain Vanguard.',
      color: '#059669',
      badgeTier1: 'UA Student',
      badgeTier2: 'Symbol of Peace'
    },
    {
      id: 'Game of Thrones',
      name: 'Game of Thrones',
      dataset: 'game_of_thrones_combined.json',
      theme: 'got_grey_gold',
      tagline: 'Westeros Dynasties & the Iron Throne',
      description: 'House Stark honor, Targaryen dragonfire, Lannister debts, and White Walker dread.',
      color: '#64748B',
      badgeTier1: 'Westeros Citizen',
      badgeTier2: 'Ruler of the Seven Kingdoms'
    },
    {
      id: 'The Boys',
      name: 'The Boys',
      dataset: 'the_boys_combined.json',
      theme: 'the_boys_dark_red',
      tagline: 'Compound V, Corrupt Supes & Vigilantes',
      description: 'Homelander chaos, Vought propaganda, Butcher vendettas, and explosive truths.',
      color: '#BE123C',
      badgeTier1: 'The Boys Recruit',
      badgeTier2: 'Vought Nightmare'
    }
  ];

  // SVG Theme Motifs (Original, franchise-inspired vector emblems)
  function renderFandomEmblemSvg(theme) {
    const motifs = {
      omnitrix_green: `
        <circle cx="50" cy="50" r="42" fill="#064E3B" stroke="#10B981" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#022C22" stroke="#34D399" stroke-width="2"/>
        <polygon points="26,30 50,45 74,30 64,22 50,33 36,22" fill="#10B981"/>
        <polygon points="26,70 50,55 74,70 64,78 50,67 36,78" fill="#10B981"/>
        <circle cx="50" cy="50" r="10" fill="#34D399" />
      `,
      bleach_black_white: `
        <circle cx="50" cy="50" r="42" fill="#0F172A" stroke="#E2E8F0" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#020617" stroke="#94A3B8" stroke-width="2"/>
        <path d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z" fill="#F8FAFC"/>
        <circle cx="50" cy="50" r="6" fill="#0F172A"/>
      `,
      dc_blue_gold: `
        <circle cx="50" cy="50" r="42" fill="#1E3A8A" stroke="#FBBF24" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#172554" stroke="#60A5FA" stroke-width="2"/>
        <polygon points="50,22 76,40 68,76 32,76 24,40" fill="#1E40AF" stroke="#FBBF24" stroke-width="2"/>
        <path d="M40 38 h12 c6 0 10 4 10 10 s-4 10 -10 10 h-12 z" fill="none" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
      `,
      demon_slayer_black_red: `
        <circle cx="50" cy="50" r="42" fill="#450A0A" stroke="#EF4444" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#1C0505" stroke="#F87171" stroke-width="2"/>
        <path d="M50 24 C40 38 36 50 50 74 C64 50 60 38 50 24 Z" fill="#EF4444"/>
        <path d="M50 36 C45 44 43 52 50 66 C57 52 55 44 50 36 Z" fill="#FBBF24"/>
      `,
      dragon_ball_orange_gold: `
        <circle cx="50" cy="50" r="42" fill="#C2410C" stroke="#FBBF24" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#7C2D12" stroke="#FDBA74" stroke-width="2"/>
        <polygon points="50,32 53,40 61,40 55,45 57,53 50,48 43,53 45,45 39,40 47,40" fill="#EF4444"/>
        <polygon points="36,54 38,59 43,59 39,63 41,68 36,65 31,68 33,63 29,59 34,59" fill="#EF4444"/>
        <polygon points="64,54 66,59 71,59 67,63 69,68 64,65 59,68 61,63 57,59 62,59" fill="#EF4444"/>
      `,
      got_grey_gold: `
        <circle cx="50" cy="50" r="42" fill="#1E293B" stroke="#CBD5E1" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#0F172A" stroke="#94A3B8" stroke-width="2"/>
        <path d="M30 68 L30 40 L42 50 L50 28 L58 50 L70 40 L70 68 Z" fill="#334155" stroke="#FBBF24" stroke-width="3"/>
        <circle cx="50" cy="62" r="4" fill="#FBBF24"/>
      `,
      marvel_red_gold: `
        <circle cx="50" cy="50" r="42" fill="#991B1B" stroke="#EF4444" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#450A0A" stroke="#FCA5A5" stroke-width="2"/>
        <path d="M40 70 L50 30 L60 70 M44 58 h12" fill="none" stroke="#FBBF24" stroke-width="5" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="28" fill="none" stroke="#FBBF24" stroke-width="2"/>
      `,
      mha_green_red: `
        <circle cx="50" cy="50" r="42" fill="#064E3B" stroke="#10B981" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#022C22" stroke="#6EE7B7" stroke-width="2"/>
        <rect x="32" y="28" width="36" height="44" rx="8" fill="#047857" stroke="#34D399" stroke-width="3"/>
        <path d="M50 38 v24 M38 50 h24" stroke="#EF4444" stroke-width="5" stroke-linecap="round"/>
      `,
      naruto_orange_black: `
        <circle cx="50" cy="50" r="42" fill="#7C2D12" stroke="#FB923C" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#431407" stroke="#FDBA74" stroke-width="2"/>
        <path d="M50 32 A16 16 0 1 1 38 60 A10 10 0 1 1 50 44 A4 4 0 1 1 50 50" fill="none" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
      `,
      one_piece_red_blue: `
        <circle cx="50" cy="50" r="42" fill="#881337" stroke="#FB7185" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#4C0519" stroke="#FDA4AF" stroke-width="2"/>
        <circle cx="50" cy="46" r="14" fill="#F8FAFC" stroke="#FBBF24" stroke-width="3"/>
        <path d="M50 26 v36 M34 40 h32 M40 64 c4 6 16 6 20 0" fill="none" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
      `,
      the_boys_dark_red: `
        <circle cx="50" cy="50" r="42" fill="#4C0519" stroke="#E11D48" stroke-width="4"/>
        <circle cx="50" cy="50" r="32" fill="#2E020E" stroke="#FB7185" stroke-width="2"/>
        <path d="M30 28 L50 74 L70 28 L58 28 L50 56 L42 28 Z" fill="#BE123C" stroke="#F43F5E" stroke-width="3"/>
      `
    };

    const content = motifs[theme] || motifs.marvel_red_gold;
    return `
      <svg class="fandom-card-emblem-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <filter id="glow-${theme}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        ${content}
      </svg>
    `;
  }

  let cachedProgress = null;
  let onSelectCallback = null;
  let activeSearchQuery = '';

  /**
   * Fetch authenticated user fandom progress
   */
  async function fetchUserProgress() {
    if (window.TruthPoolFandomBadges && typeof window.TruthPoolFandomBadges.getFandomProgress === 'function') {
      try {
        const resp = await window.TruthPoolFandomBadges.getFandomProgress();
        if (resp && resp.progress) {
          cachedProgress = resp.progress;
          return cachedProgress;
        }
      } catch (err) {
        console.warn('[FandomSelection] Progress fetch error:', err);
      }
    }
    cachedProgress = null;
    return null;
  }

  /**
   * Render the 11 fandom cards into the container
   */
  function renderFandomsGrid(container, engine, onSelect) {
    if (!container) return;
    onSelectCallback = onSelect;

    // Filter by live search query if set
    const filteredFandoms = FANDOMS.filter(f => {
      if (!activeSearchQuery) return true;
      const q = activeSearchQuery.toLowerCase().trim();
      return f.name.toLowerCase().includes(q) ||
        f.tagline.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
    });

    if (filteredFandoms.length === 0) {
      container.innerHTML = `
        <div class="fandoms-empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No Fandoms Found</h3>
          <p>No fandom matches "<strong>${escapeHtml(activeSearchQuery)}</strong>". Try another keyword or clear the search.</p>
          <button type="button" class="btn btn-outline-pill" id="btn-clear-fandom-search">Clear Search</button>
        </div>
      `;
      const clearBtn = container.querySelector('#btn-clear-fandom-search');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const searchInput = document.getElementById('fandom-search-input');
          if (searchInput) searchInput.value = '';
          activeSearchQuery = '';
          renderFandomsGrid(container, engine, onSelect);
        });
      }
      return;
    }

    let html = '';
    for (const fandom of filteredFandoms) {
      // Derive question count from engine masterPool if loaded, otherwise fallback to 200
      let questionCount = 200;
      if (engine && typeof engine.getMasterPoolSize === 'function' && engine.masterPool) {
        const count = engine.masterPool.filter(q => q.category && q.category.toLowerCase() === fandom.name.toLowerCase()).length;
        if (count > 0) questionCount = count;
      }

      // Check personal progress if available
      const prog = cachedProgress && cachedProgress[fandom.name] ? cachedProgress[fandom.name] : null;
      const completedQs = prog ? Math.max(0, Math.min(questionCount, Number(prog.completed_questions) || 0)) : 0;
      const percent = Math.round((completedQs / questionCount) * 100);
      const isTier1 = prog ? Boolean(prog.tier1_unlocked) : false;
      const isTier2 = prog ? Boolean(prog.tier2_unlocked) : false;

      const progressHtml = prog ? `
        <div class="fandom-card-progress">
          <div class="progress-info-row">
            <span class="progress-count-text"><strong>${completedQs}</strong> / ${questionCount} Questions</span>
            <span class="progress-pct-text">${percent}%</span>
          </div>
          <div class="fandom-progress-track">
            <div class="fandom-progress-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="fandom-card-badges-row">
            <span class="fandom-tier-chip ${isTier1 ? 'unlocked' : 'locked'}">
              ${isTier1 ? '✓' : '🔒'} Tier 1: ${fandom.badgeTier1}
            </span>
            <span class="fandom-tier-chip ${isTier2 ? 'unlocked' : 'locked'}">
              ${isTier2 ? '★' : '🔒'} Tier 2: ${fandom.badgeTier2}
            </span>
          </div>
        </div>
      ` : `
        <div class="fandom-card-progress guest-progress">
          <div class="progress-info-row">
            <span class="progress-count-text"><strong>${questionCount}</strong> Verified Claims</span>
            <span class="progress-guest-hint">Sign in to track progress</span>
          </div>
          <div class="fandom-progress-track">
            <div class="fandom-progress-fill" style="width: 0%;"></div>
          </div>
          <div class="fandom-card-badges-row">
            <span class="fandom-tier-chip locked">🔒 Tier 1 (100 Qs)</span>
            <span class="fandom-tier-chip locked">🔒 Tier 2 (200 Qs)</span>
          </div>
        </div>
      `;

      html += `
        <article class="fandom-card" data-fandom-id="${escapeHtml(fandom.name)}" tabindex="0" role="region" aria-label="${escapeHtml(fandom.name)} Fandom Arena">
          <div class="fandom-card-header">
            <div class="fandom-emblem-wrap">
              ${renderFandomEmblemSvg(fandom.theme)}
            </div>
            <div class="fandom-header-meta">
              <span class="fandom-dataset-chip">200 CLAIMS</span>
              <h3 class="fandom-title">${escapeHtml(fandom.name)}</h3>
              <p class="fandom-tagline">${escapeHtml(fandom.tagline)}</p>
            </div>
          </div>

          <p class="fandom-desc">${escapeHtml(fandom.description)}</p>

          ${progressHtml}

          <div class="fandom-card-actions">
            <button type="button" class="btn btn-hero-red btn-play-fandom" data-fandom="${escapeHtml(fandom.name)}" aria-label="Play ${escapeHtml(fandom.name)} Questions">
              <span class="btn-text">Enter Arena</span>
              <span class="btn-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      `;
    }

    container.innerHTML = html;

    // Attach click events on play buttons and card
    container.querySelectorAll('.btn-play-fandom').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fandomName = btn.dataset.fandom;
        if (typeof onSelectCallback === 'function') {
          onSelectCallback(fandomName);
        }
      });
    });

    container.querySelectorAll('.fandom-card').forEach(card => {
      card.addEventListener('click', () => {
        const fandomName = card.dataset.fandomId;
        if (typeof onSelectCallback === 'function') {
          onSelectCallback(fandomName);
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const fandomName = card.dataset.fandomId;
          if (typeof onSelectCallback === 'function') {
            onSelectCallback(fandomName);
          }
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
    FANDOMS,
    renderFandomEmblemSvg,
    fetchUserProgress,
    renderFandomsGrid,
    setSearchQuery(query, container, engine, onSelect) {
      activeSearchQuery = query || '';
      renderFandomsGrid(container, engine, onSelect);
    },
    async refresh(container, engine, onSelect) {
      await fetchUserProgress();
      renderFandomsGrid(container, engine, onSelect);
    }
  };
});
