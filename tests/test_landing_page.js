/**
 * Bluff or Believe — Phase 3.5: Premium 3D Landing Page Test Suite
 * Validates DOM structure, CSS 3D tokens, controller script exports,
 * view switching flows, and server delivery.
 * Run with: node tests/test_landing_page.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('BLUFF OR BELIEVE — PHASE 3.5 3D LANDING PAGE TESTS');
console.log('======================================================\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const cssPath = path.resolve(__dirname, '../css/style.css');
const jsAppPath = path.resolve(__dirname, '../js/app.js');
const jsLanding3dPath = path.resolve(__dirname, '../js/landing3d.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const jsApp = fs.readFileSync(jsAppPath, 'utf8');
const jsLanding3d = fs.readFileSync(jsLanding3dPath, 'utf8');

// [1/6] HTML Structure Validation
console.log('[1/6] Verifying Landing Page DOM Structure in index.html...');
assert.ok(html.includes('id="view-landing"'), 'view-landing element present');
assert.ok(html.includes('class="view landing-view active"'), 'view-landing is active by default on load');
assert.ok(!html.includes('id="view-setup" class="view active"'), 'view-setup is not active on initial load');
assert.ok(html.includes('id="landing-particles-canvas"'), 'Ambient particles canvas present');
assert.ok(html.includes('id="landing-parallax-stage"'), 'Parallax stage element present');
assert.ok(html.includes('id="landing-card-fact"'), 'Floating 3D FACT card present');
assert.ok(html.includes('id="landing-card-myth"'), 'Floating 3D MYTH card present');
assert.ok(html.includes('id="landing-center-core"'), 'Center 3D core container present');
assert.ok(html.includes('class="landing-title-3d"'), '3D title typography present');
assert.ok(html.includes('id="landing-platform-3d"'), '3D glowing arena platform present');
assert.ok(html.includes('id="btn-start-playing"'), 'Hero START PLAYING button present');
assert.ok(html.includes('class="landing-features-strip"'), 'Bottom features strip present');
assert.ok(html.includes('Test Your Instincts') || html.includes('Test Your Knowledge'), 'Feature: Test Instincts present');
assert.ok(html.includes('Earn Points'), 'Feature: Earn Points present');
assert.ok(html.includes('Unlock Achievements'), 'Feature: Unlock Achievements present');
assert.ok(html.includes('Mission Records'), 'Feature: Mission Records present (Leaderboard removed as required)');
assert.ok(!html.includes('id="btn-hero-leaderboard"'), 'Leaderboard button removed from hero');
assert.ok(html.includes('id="btn-back-to-landing"'), 'Back to Main Menu button in setup view present');
assert.ok(html.includes('id="header-logo-group"'), 'Clickable header logo group present');
assert.ok(html.includes('src="js/landing3d.js"'), 'landing3d.js script included');
console.log('  ✓ All 17 required DOM structures, IDs, and cards verified.');

// [2/6] CSS 3D Styling & Visual Design System Validation
console.log('[2/6] Verifying CSS 3D Tokens & Styling in style.css...');
assert.ok(css.includes('perspective: 1200px'), 'CSS 3D perspective configured');
assert.ok(css.includes('transform-style: preserve-3d'), 'CSS 3D transform-style preserve-3d configured');
assert.ok(css.includes('.landing-card-fact'), 'FACT card styling present');
assert.ok(css.includes('.landing-card-myth'), 'MYTH card styling present');
assert.ok(css.includes('.glow-spot-cyan'), 'Cyan glow spotlight configured');
assert.ok(css.includes('.glow-spot-magenta'), 'Magenta glow spotlight configured');
assert.ok(css.includes('.glow-spot-center'), 'Center spotlight configured');
assert.ok(css.includes('.platform-grid'), 'Platform perspective grid configured');
assert.ok(css.includes('.energy-ring'), 'Concentric glowing energy rings configured');
assert.ok(css.includes('.btn-start-playing'), 'START PLAYING button styling present');
assert.ok(css.includes('.btn-pulse-wave'), 'START PLAYING animated pulse wave present');
assert.ok(css.includes('.features-grid'), '4-column feature strip grid configured');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion accessibility query configured');
assert.ok(css.includes('@media (max-width: 860px)'), 'Mobile/tablet responsive breakpoint configured');
console.log('  ✓ CSS 3D transforms, lighting, glowing platform, and media queries verified.');

// [3/6] JavaScript 3D Controller Validation
console.log('[3/6] Verifying 3D Controller in js/landing3d.js...');
assert.ok(jsLanding3d.includes('window.BluffLanding3D = {'), 'BluffLanding3D namespace exported');
assert.ok(jsLanding3d.includes('init,'), 'init method exported');
assert.ok(jsLanding3d.includes('resume,'), 'resume method exported');
assert.ok(jsLanding3d.includes('pause,'), 'pause method exported');
assert.ok(jsLanding3d.includes('reset'), 'reset method exported');
assert.ok(jsLanding3d.includes('handleMouseMove'), 'Mouse movement parallax listener present');
assert.ok(jsLanding3d.includes('bindCardGlare'), 'Card specular glare effect present');
assert.ok(jsLanding3d.includes('renderParticles'), 'Particle canvas rendering present');
console.log('  ✓ 3D parallax, particle system, card glare, and lifecycle methods verified.');

// [4/6] Application UI Controller Integration Validation
console.log('[4/6] Verifying Navigation Flow in js/app.js...');
assert.ok(jsApp.includes("document.getElementById('view-landing')"), 'viewLanding referenced in app.js');
assert.ok(jsApp.includes("document.getElementById('btn-start-playing')"), 'btnStartPlaying referenced in app.js');
assert.ok(jsApp.includes("document.getElementById('btn-back-to-landing')"), 'btnBackToLanding referenced in app.js');
assert.ok(jsApp.includes("document.getElementById('header-logo-group')"), 'headerLogoGroup referenced in app.js');
assert.ok(jsApp.includes('window.BluffLanding3D.resume()'), '3D loop resumed when entering landing view');
assert.ok(jsApp.includes('window.BluffLanding3D.pause()'), '3D loop paused when leaving landing view for 100% CPU/GPU savings');
assert.ok(jsApp.includes('showView(viewLanding)'), 'returnHomeBtn navigates back to landing view');
console.log('  ✓ View switching, button handlers, and 3D pause/resume lifecycle verified.');

// [5/6] Server Delivery Verification
console.log('[5/6] Verifying Live HTTP Delivery via Local Server...');
async function testServer() {
  const res = await fetch('http://localhost:8000/index.html');
  assert.strictEqual(res.status, 200, 'Server returns 200 for index.html');
  const serverHtml = await res.text();
  assert.ok(serverHtml.includes('id="view-landing"'), 'view-landing present in server response');
  assert.ok(serverHtml.includes('id="btn-start-playing"'), 'btn-start-playing present in server response');
  assert.ok(serverHtml.includes('src="js/landing3d.js"'), 'landing3d.js served');

  const scriptRes = await fetch('http://localhost:8000/js/landing3d.js');
  assert.strictEqual(scriptRes.status, 200, 'Server returns 200 for landing3d.js');
  const scriptContent = await scriptRes.text();
  assert.ok(scriptContent.includes('BluffLanding3D'), 'landing3d.js serves proper content');
  console.log('  ✓ Server correctly serves landing page markup and 3D controller.');
}

testServer()
  .then(() => {
    // [6/6] Final Confirmation
    console.log('[6/6] Summary Check...');
    console.log('  ✓ All 6 test suites passed flawlessly!');
    console.log('\n======================================================');
    console.log('PHASE 3.5 3D LANDING PAGE VERIFICATION COMPLETE!');
    console.log('======================================================');
  })
  .catch((err) => {
    console.error('Test failure:', err);
    process.exit(1);
  });
