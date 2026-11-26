// Shared API endpoint for all SmartRoute AI pages.
// Local default matches the Flask backend started with: python backend/app.py
// For a different host, set window.SMARTROUTE_API_BASE before this script.
(function () {
  const configured = String(window.SMARTROUTE_API_BASE || "").trim();
  const host = window.location.hostname || "127.0.0.1";
  const localHost = ["localhost", "127.0.0.1"].includes(host) ? "127.0.0.1" : host;
  window.SMARTROUTE_API_BASE = (configured || "http://" + localHost + ":5001/api").replace(/\/$/, "");
})();