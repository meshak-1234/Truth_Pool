/**
 * Truth Pool — Frontend Runtime Configuration
 *
 * Configures the backend API base URL for different environments.
 *
 * Priority order (highest to lowest):
 *   1. window.TRUTH_POOL_API_BASE_URL  — Injected by CDN/hosting (e.g. Netlify env inject)
 *   2. window.BLUFF_API_BASE_URL       — Legacy alias for backward compatibility
 *   3. Local development fallback       — http://127.0.0.1:8001 when on localhost
 *   4. Production fallback              — Deployed backend URL (update before deploying)
 *
 * To set the API URL at runtime without editing this file, define
 * window.TRUTH_POOL_API_BASE_URL before this script is loaded, or
 * add a <script> tag above config.js in index.html that sets:
 *
 *   window.TRUTH_POOL_API_BASE_URL = 'https://your-deployed-api.example.com';
 *
 * For same-domain deployments (frontend + backend on the same host/port),
 * set the variable to an empty string ''.
 */
(function () {
  'use strict';

  // Detect local development
  const isLocalhost = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname === ''
  );

  // Initialise config namespace if not already set
  if (!window.TRUTH_POOL_CONFIG) {
    window.TRUTH_POOL_CONFIG = {};
  }

  // --- Resolve API base URL ---
  const explicitUrl = window.TRUTH_POOL_API_BASE_URL || window.BLUFF_API_BASE_URL;

  let resolvedUrl;
  if (typeof explicitUrl === 'string') {
    // Use whatever was pre-configured (empty string means same-origin)
    resolvedUrl = explicitUrl;
  } else if (isLocalhost) {
    // Local development: backend runs on port 8001 by default
    resolvedUrl = 'http://127.0.0.1:8001';
  } else {
    // ── PRODUCTION ──────────────────────────────────────────────────────────
    // Replace the URL below with your deployed backend URL before deploying.
    // If both frontend and backend are on the same domain, set this to ''.
    // ────────────────────────────────────────────────────────────────────────
    resolvedUrl = 'https://truthpool-api-50046996624.development.catalystappsail.in';
  }

  window.TRUTH_POOL_CONFIG.API_BASE_URL = resolvedUrl;

  // Expose aliases so existing modules (auth.js, etc.) pick them up
  window.TRUTH_POOL_API_BASE_URL = resolvedUrl;
  window.BLUFF_API_BASE_URL = resolvedUrl;     // backward-compat alias
})();
