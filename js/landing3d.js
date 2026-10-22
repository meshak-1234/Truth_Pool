/**
 * Bluff or Believe — Premium 3D Landing Page Controller
 * Lightweight 60fps 3D parallax transforms, interactive card tilt,
 * ambient glowing particle canvas, and specular lighting.
 */

(function () {
  'use strict';

  let isRunning = false;
  let animFrameId = null;

  // DOM elements
  let landingView = null;
  let parallaxStage = null;
  let factCard = null;
  let mythCard = null;
  let centerCore = null;
  let platform3D = null;
  let canvas = null;
  let ctx = null;

  // Mouse & Parallax State
  let mouseX = 0;
  let mouseY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;
  let isMouseOverWindow = false;

  // Particle System (Truth Pool Palette: Hero Blue, Hero Red, Golden Yellow, Soft Cream, Slate Grey)
  let particles = [];
  const PARTICLE_COUNT = 65;
  const PARTICLE_COLORS = [
    'rgba(37, 99, 235, ',   // Hero Blue (#2563EB)
    'rgba(239, 68, 68, ',   // Hero Red (#EF4444)
    'rgba(251, 191, 36, ',  // Golden Yellow (#FBBF24)
    'rgba(248, 250, 252, ', // Soft Cream (#F8FAFC)
    'rgba(148, 163, 184, ', // Slate Grey (#94A3B8)
    'rgba(16, 185, 129, '   // Emerald / Fact Green
  ];

  // Motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Initialize particle objects
   */
  function initParticles(width, height) {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 0.8,
        colorBase: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        baseAlpha: Math.random() * 0.5 + 0.25,
        alpha: Math.random() * 0.5 + 0.25,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -(Math.random() * 0.45 + 0.2),
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Resize Canvas
   */
  function resizeCanvas() {
    if (!canvas || !landingView) return;
    const rect = landingView.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = (rect.width || window.innerWidth) * dpr;
    canvas.height = (rect.height || window.innerHeight) * dpr;
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    initParticles(rect.width || window.innerWidth, rect.height || window.innerHeight);
  }

  /**
   * Render Particles Frame
   */
  function renderParticles(width, height) {
    if (!ctx || prefersReducedMotion) return;

    ctx.clearRect(0, 0, width, height);

    const time = Date.now() * 0.001;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Drift motion
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(time + p.pulseOffset) * 0.15;

      // Wrap-around boundaries
      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      // Mouse repulsion field
      if (isMouseOverWindow) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 1.5;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      }

      // Gentle pulsating glow
      p.alpha = p.baseAlpha + Math.sin(time * 2 + p.pulseOffset) * 0.15;
      const alphaClamped = Math.max(0.1, Math.min(0.9, p.alpha));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.colorBase + alphaClamped + ')';
      ctx.shadowColor = p.colorBase + '0.8)';
      ctx.shadowBlur = p.radius * 3;
      ctx.fill();
    }
  }

  /**
   * Animation & 3D Parallax Loop
   */
  function tick() {
    if (!isRunning) return;

    // Smooth interpolation (lerp) towards target tilt
    const lerpFactor = 0.07;
    currentTiltX += (targetTiltX - currentTiltX) * lerpFactor;
    currentTiltY += (targetTiltY - currentTiltY) * lerpFactor;

    if (!prefersReducedMotion && parallaxStage) {
      if (window.innerWidth > 860) {
        // Rotate overall 3D stage on desktop
        const rotY = currentTiltX * 10;   // deg
        const rotX = -currentTiltY * 6;  // deg
        parallaxStage.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

        // Subtle dynamic parallax offsets for cards
        if (factCard) {
          const factRotY = 16 + currentTiltX * 4;
          const factRotX = -4 - currentTiltY * 3;
          const factTransZ = 35 + currentTiltX * 15;
          factCard.style.transform = `translate3d(${(-currentTiltX * 8).toFixed(1)}px, ${(-currentTiltY * 6).toFixed(1)}px, ${factTransZ.toFixed(1)}px) rotateY(${factRotY.toFixed(2)}deg) rotateX(${factRotX.toFixed(2)}deg)`;
        }

        if (mythCard) {
          const mythRotY = -16 + currentTiltX * 4;
          const mythRotX = -4 - currentTiltY * 3;
          const mythTransZ = 35 - currentTiltX * 15;
          mythCard.style.transform = `translate3d(${(currentTiltX * 8).toFixed(1)}px, ${(-currentTiltY * 6).toFixed(1)}px, ${mythTransZ.toFixed(1)}px) rotateY(${mythRotY.toFixed(2)}deg) rotateX(${mythRotX.toFixed(2)}deg)`;
        }

        if (centerCore) {
          centerCore.style.transform = `translate3d(${(currentTiltX * 5).toFixed(1)}px, ${(currentTiltY * 4).toFixed(1)}px, 20px)`;
        }

        if (platform3D) {
          const platRotX = 70 - currentTiltY * 4;
          platform3D.style.transform = `rotateX(${platRotX.toFixed(2)}deg) rotateZ(${(currentTiltX * 3).toFixed(2)}deg) translateZ(-50px)`;
        }
      } else {
        // Static clean transforms on tablet and mobile viewports
        parallaxStage.style.transform = 'none';
        if (centerCore) centerCore.style.transform = 'none';
        if (platform3D) platform3D.style.transform = 'none';
      }
    }

    // Render particle background
    if (canvas && landingView) {
      const rect = landingView.getBoundingClientRect();
      renderParticles(rect.width || window.innerWidth, rect.height || window.innerHeight);
    }

    animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Window Mouse Movement Listener
   */
  function handleMouseMove(e) {
    if (!isRunning || prefersReducedMotion) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    mouseX = e.clientX;
    mouseY = e.clientY;
    isMouseOverWindow = true;

    // Normalized from -1 to 1
    targetTiltX = ((e.clientX / w) - 0.5) * 2;
    targetTiltY = ((e.clientY / h) - 0.5) * 2;
  }

  /**
   * Reset tilt when mouse leaves viewport
   */
  function handleMouseLeave() {
    isMouseOverWindow = false;
    targetTiltX = 0;
    targetTiltY = 0;
  }

  /**
   * Card Specular Glare & Tilt
   */
  function bindCardGlare(cardElem) {
    if (!cardElem) return;

    cardElem.addEventListener('mousemove', (e) => {
      const rect = cardElem.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      cardElem.style.setProperty('--glare-x', `${x}%`);
      cardElem.style.setProperty('--glare-y', `${y}%`);
      cardElem.style.setProperty('--glare-opacity', '0.45');
    });

    cardElem.addEventListener('mouseleave', () => {
      cardElem.style.setProperty('--glare-opacity', '0');
    });
  }

  /**
   * Device Orientation (Gyroscopic tilt on mobile/tablets)
   */
  function handleOrientation(e) {
    if (!isRunning || prefersReducedMotion || !e.gamma || !e.beta) return;
    // gamma is left-to-right (-90 to 90), beta is front-to-back (-180 to 180)
    targetTiltX = Math.max(-1, Math.min(1, e.gamma / 30));
    targetTiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }

  /**
   * Start animation loop
   */
  function resume() {
    if (isRunning) return;
    isRunning = true;
    resizeCanvas();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Pause animation loop (saves 100% GPU/CPU during active gameplay)
   */
  function pause() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  /**
   * Reset 3D transforms to default
   */
  function reset() {
    targetTiltX = 0;
    targetTiltY = 0;
    currentTiltX = 0;
    currentTiltY = 0;
    if (parallaxStage) parallaxStage.style.transform = '';
    if (factCard) factCard.style.transform = '';
    if (mythCard) mythCard.style.transform = '';
    if (centerCore) centerCore.style.transform = '';
    if (platform3D) platform3D.style.transform = '';
  }

  /**
   * Setup & DOM Binding
   */
  function init() {
    landingView = document.getElementById('view-landing');
    parallaxStage = document.getElementById('landing-parallax-stage');
    factCard = document.getElementById('landing-card-fact');
    mythCard = document.getElementById('landing-card-myth');
    centerCore = document.getElementById('landing-mascot-sphere') || document.getElementById('landing-center-core');
    platform3D = document.getElementById('landing-platform-3d') || document.querySelector('.comic-action-burst');
    canvas = document.getElementById('landing-particles-canvas');

    if (!landingView) return;

    if (canvas) {
      ctx = canvas.getContext('2d');
    }

    // Card specular sheen listeners
    bindCardGlare(factCard);
    bindCardGlare(mythCard);

    // Window events
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', resizeCanvas, { passive: true });

    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    // Start if landing view is active
    if (landingView.classList.contains('active')) {
      resume();
    }
  }

  // Public namespace (Both Truth Pool and backward compatible BluffLanding3D)
  window.BluffLanding3D = {
    init,
    resume,
    pause,
    reset
  };
  window.TruthPoolLanding3D = window.BluffLanding3D;

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
