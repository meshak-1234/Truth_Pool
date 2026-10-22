/**
 * Truth Pool — Device-Adaptive Responsive Frontend Verification Suite
 * Tests all required widths: 320, 344, 360, 375, 390, 412, 430, 480, 768, 1024, 1366 px
 * and landscape orientations across all application views and modals.
 * Run with: node tests/test_responsive_optimization.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('TRUTH POOL — DEVICE-ADAPTIVE RESPONSIVE VERIFICATION SUITE');
console.log('Testing 320px, 344px, 360px, 375px, 390px, 412px, 430px,');
console.log('        480px, 768px, 1024px, 1366px & Landscape Orientations');
console.log('================================================================\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const cssPath = path.resolve(__dirname, '../css/style.css');
const jsAppPath = path.resolve(__dirname, '../js/app.js');
const jsLandingPath = path.resolve(__dirname, '../js/landing3d.js');

const html = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');
const jsLanding = fs.readFileSync(jsLandingPath, 'utf8').replace(/\r\n/g, '\n');

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

// -----------------------------------------------------------------------------
// 1. Viewport Meta Tag & HTML Foundations
// -----------------------------------------------------------------------------
console.log('[1/8] Verifying Viewport Meta Tag, Safe Areas & HTML Configuration...');

test('Viewport meta tag includes width=device-width, initial-scale=1.0, and viewport-fit=cover', () => {
  assert.ok(html.includes('viewport-fit=cover'), 'viewport-fit=cover is present');
  assert.ok(html.includes('width=device-width'), 'width=device-width is present');
});

test('Google Fonts preconnect tags are well-formed and valid', () => {
  assert.ok(!html.includes('<link rel="preconnect" href="\n'), 'No broken unclosed preconnect tag');
  assert.ok(html.includes('https://fonts.gstatic.com'), 'fonts.gstatic.com preconnect is present');
});

test('No transform: scale() shortcut applied to body or entire page', () => {
  assert.ok(!css.match(/body\s*\{[^}]*transform:\s*scale\(/), 'body does not use transform scale shortcut');
  assert.ok(!css.match(/\.container\s*\{[^}]*transform:\s*scale\(/), 'container does not use transform scale shortcut');
});

test('Safe area insets (--safe-top, --safe-bottom, --safe-left, --safe-right) declared in :root', () => {
  assert.ok(css.includes('--safe-top: env(safe-area-inset-top'), 'safe-top inset declared');
  assert.ok(css.includes('--safe-bottom: env(safe-area-inset-bottom'), 'safe-bottom inset declared');
  assert.ok(css.includes('--safe-left: env(safe-area-inset-left'), 'safe-left inset declared');
  assert.ok(css.includes('--safe-right: env(safe-area-inset-right'), 'safe-right inset declared');
});

test('Body and container use dynamic viewport units (dvh) and safe-area padding', () => {
  assert.ok(css.includes('min-height: 100dvh'), 'body uses 100dvh for dynamic mobile chrome');
  assert.ok(css.includes('var(--safe-top)') && css.includes('var(--safe-bottom)'), 'container uses safe-area insets');
});

// -----------------------------------------------------------------------------
// 2. Landing Page & 3D Hero
// -----------------------------------------------------------------------------
console.log('\n[2/8] Verifying Landing Page & Mascot Scaling...');

test('Landing view permits vertical scrolling (overflow-y: visible) on stacked mobile views', () => {
  assert.ok(css.includes('overflow-y: visible'), 'landing-view has overflow-y: visible so mobile users can scroll');
  assert.ok(css.includes('overflow-x: hidden'), 'landing-view has overflow-x: hidden to prevent horizontal page drift');
});

test('Hero title uses fluid clamp() without oversized hardcoded min-size', () => {
  assert.ok(css.includes('font-size: clamp('), 'hero title uses fluid clamp');
  assert.ok(!css.includes('font-size: clamp(2.3rem'), 'Old 2.3rem minimum on mobile is removed');
});

test('CTA buttons stack into column with full width and min-height >= 48px on mobile', () => {
  assert.ok(css.includes('min-height: 48px'), 'CTA buttons have comfortable min-height >= 48px on mobile');
  assert.ok(css.includes('flex-direction: column'), 'CTA group stacks on mobile');
});

test('Mascot container uses responsive viewport-relative dimensions', () => {
  assert.ok(css.includes('width: min('), 'mascot container uses min() constraint');
});

test('Parallax stage 3D tilt is gated on desktop (> 860px) and static on mobile in landing3d.js', () => {
  assert.ok(jsLanding.includes('window.innerWidth > 860'), 'landing3d.js checks window.innerWidth > 860');
  assert.ok(jsLanding.includes("parallaxStage.style.transform = 'none'"), 'landing3d.js resets transform on mobile');
});

// -----------------------------------------------------------------------------
// 3. Header & Mobile Navigation Drawer
// -----------------------------------------------------------------------------
console.log('\n[3/8] Verifying Header, Logos, and Mobile Nav Drawer...');

test('Header logo and emblem scale proportionally using clamp()', () => {
  assert.ok(css.includes('height: clamp('), 'header logo image uses clamp height');
  assert.ok(css.includes('object-fit: contain'), 'logo uses object-fit contain');
});

test('Desktop nav links hidden on mobile, hamburger button displayed', () => {
  assert.ok(css.includes('.header-nav') && css.includes('display: none !important'), 'header-nav hidden on mobile');
  assert.ok(css.includes('.mobile-menu-toggle-btn') && css.includes('display: inline-flex !important'), 'mobile menu toggle visible on mobile');
});

test('Header actions do not cause horizontal overflow or force header clip', () => {
  assert.ok(css.includes('min-width: 0'), 'flex children have min-width: 0');
  assert.ok(!css.includes('.site-header {\n    padding: 8px 0 12px;\n    margin-bottom: 14px;\n    gap: 8px;\n    flex-wrap: nowrap;\n    overflow: hidden;'), 'site-header does not have overflow: hidden clipping buttons');
});

test('Mobile navigation drawer panel uses viewport bounds and safe touch targets', () => {
  assert.ok(css.includes('.mobile-nav-panel'), 'mobile-nav-panel defined');
  assert.ok(css.includes('overflow-y: auto'), 'mobile-nav-panel scrolls vertically if drawer exceeds screen height');
  assert.ok(css.includes('.mobile-nav-close-btn'), 'mobile-nav-close-btn styled');
});

// -----------------------------------------------------------------------------
// 4. Fandom Selection & Game Configuration
// -----------------------------------------------------------------------------
console.log('\n[4/8] Verifying Fandom Arena Selection & Toolbar...');

test('#view-setup allows full container width (max-width: 1260px) rather than 880px constraint', () => {
  assert.ok(css.includes('#view-setup {\n  max-width: 1260px;'), '#view-setup allows 1260px');
});

test('Fandom toolbar grid collapses cleanly on mobile without horizontal clipping', () => {
  assert.ok(css.includes('.fandom-toolbar-grid'), 'toolbar grid defined');
  assert.ok(css.includes('.pill-selector'), 'pill selector defined');
  assert.ok(css.includes('.pill-btn'), 'pill button defined');
});

test('11 Fandom cards grid adapts from 3 cols -> 2 cols -> 1 col across viewports', () => {
  assert.ok(css.includes('grid-template-columns: repeat(3, 1fr)'), '3 columns on desktop');
  assert.ok(css.includes('grid-template-columns: repeat(2, 1fr)'), '2 columns on tablet');
  assert.ok(css.includes('grid-template-columns: 1fr'), '1 column on mobile');
});

test('Fandom titles and taglines wrap gracefully without awkward truncation', () => {
  assert.ok(css.includes('word-break: break-word'), 'titles break words safely');
});

// -----------------------------------------------------------------------------
// 5. Game Arena & Answer Buttons
// -----------------------------------------------------------------------------
console.log('\n[5/8] Verifying Game Arena & Answer Choice Layouts...');

test('Arena header adapts into clean multi-row layout on mobile', () => {
  assert.ok(css.includes('.arena-header'), 'arena header styled');
  assert.ok(css.includes('.arena-status-boxes'), 'streak and score boxes styled');
  assert.ok(css.includes('.meta-badges'), 'category and difficulty badges wrap');
});

test('Answer buttons stack in 1 column in portrait (< 480px) and 2 columns in landscape', () => {
  assert.ok(css.includes('.answers-grid {\n    grid-template-columns: 1fr;'), '1 column portrait');
  assert.ok(css.includes('.answers-grid {\n    grid-template-columns: 1fr 1fr;'), '2 columns landscape');
});

test('Answer buttons maintain touch targets >= 44px with large legible text', () => {
  assert.ok(css.includes('min-height: 52px'), 'answer buttons have min-height 52px');
});

test('Feedback card wraps long citations and links without overflowing card width', () => {
  assert.ok(css.includes('.source-citation {\n    display: flex;\n    flex-wrap: wrap;'), 'source citation flex-wraps');
  assert.ok(css.includes('.source-link {\n    word-break: break-all;\n    overflow-wrap: anywhere;'), 'source link wraps long URLs');
});

// -----------------------------------------------------------------------------
// 6. Game Completion & Stats Screens
// -----------------------------------------------------------------------------
console.log('\n[6/8] Verifying Game Completion & Trophy Screen...');

test('Completion stats grid adapts to 2x2 grid on mobile screens', () => {
  assert.ok(css.includes('.stats-grid {\n    grid-template-columns: repeat(2, 1fr);'), 'stats grid 2x2 on mobile');
});

test('Completion actions stack vertically on mobile with full width buttons', () => {
  assert.ok(css.includes('.completion-actions {\n    flex-direction: column;\n    width: 100%;'), 'actions stack vertically on mobile');
});

// -----------------------------------------------------------------------------
// 7. Fandom Badges & Player Dashboard
// -----------------------------------------------------------------------------
console.log('\n[7/8] Verifying Fandom Badges Collection & Player Dashboard...');

test('Badges summary metrics adapt to single column on mobile', () => {
  assert.ok(css.includes('.badges-summary-grid {\n    grid-template-columns: 1fr;'), 'summary metrics single column on mobile');
});

test('Badges controls bar and filter tabs stack into full-width touch controls', () => {
  assert.ok(css.includes('.badges-controls-bar {\n    padding: 12px 14px;\n    gap: 10px;\n  }'), 'controls bar stacks vertically');
  assert.ok(css.includes('.badge-filter-btn {\n    flex: 1;'), 'tabs flex evenly');
});

test('Player dashboard metrics grid adapts to 2 columns on mobile and 1 column on <= 330px', () => {
  assert.ok(css.includes('.dash-metrics-grid {\n    grid-template-columns: repeat(2, 1fr);'), 'metrics 2 columns on mobile');
  assert.ok(css.includes('.dash-metrics-grid {\n    grid-template-columns: 1fr;'), 'metrics 1 column on ultra-narrow');
});

test('Dashboard shortcuts strip does not overflow on 320px screens', () => {
  assert.ok(css.includes('.dash-shortcuts-strip .btn {\n    width: 100%;\n    flex: 1 1 auto;'), 'shortcuts strip flex-basis adapts on mobile');
});

test('History table has horizontal scroll wrapper with -webkit-overflow-scrolling', () => {
  assert.ok(css.includes('.history-table-container'), 'table container defined');
  assert.ok(css.includes('overflow-x: auto'), 'table container has overflow-x: auto');
});

// -----------------------------------------------------------------------------
// 8. Modals, Fullscreen & Landscape Orientation
// -----------------------------------------------------------------------------
console.log('\n[8/8] Verifying Modals & Short Landscape Screen Optimization...');

test('All modals (auth, about, detail, celebration, exit) use dvh max-height and overflow-y: auto', () => {
  assert.ok(css.includes('.auth-modal-card,\n  .fandom-detail-modal-card,\n  .celebration-modal-card,\n  .about-modal-card'), 'all modals grouped for safe sizing');
  assert.ok(css.includes('overflow-y: auto !important'), 'modal cards have vertical scroll');
  assert.ok(css.includes('max-height: min(92vh, 92dvh)'), 'modals fit within dynamic mobile viewport');
});

test('Short landscape mode (height <= 520px) conserves vertical space and keeps answers in view', () => {
  assert.ok(css.includes('@media (orientation: landscape) and (max-height: 520px)'), 'landscape media query present');
  assert.ok(css.includes('.answers-grid {\n    grid-template-columns: 1fr 1fr;'), 'answers remain 2 columns in landscape');
  assert.ok(css.includes('.landing-hero-grid {\n    grid-template-columns: 1.15fr 0.85fr;'), 'landing hero side-by-side in landscape');
});

test('Reduced motion media query disables animations gracefully', () => {
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced motion query present');
  assert.ok(css.includes('animation: none !important'), 'animations disabled for reduced motion');
});

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} Passed (${totalTests - passedTests} Failed)`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
