// SmartRoute AI admin dashboard. Demo data is shared through this browser's localStorage.
const ADMIN_KEYS = { requests: "smartrouteRequests", checkins: "smartrouteCheckins", user: "smartrouteUser" };

function getStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

function adminLogin() {
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  const message = document.getElementById("admin-login-message");

  if (username === "admin" && password === "admin123") {
    localStorage.setItem(ADMIN_KEYS.user, JSON.stringify({ username: "admin", role: "admin" }));
    showAdminDashboard();
  } else {
    message.textContent = "Incorrect admin username or password.";
    message.className = "form-message error-message";
  }
}

function showAdminDashboard() {
  document.getElementById("admin-login").hidden = true;
  document.getElementById("admin-dashboard").hidden = false;
  document.getElementById("admin-logout").hidden = false;
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const requests = getStoredList(ADMIN_KEYS.requests);
  const checkins = getStoredList(ADMIN_KEYS.checkins);
  const pending = requests.filter(item => item.status === "PENDING").length;
  const approved = requests.filter(item => item.status === "APPROVED").length;

  document.getElementById("total-requests").textContent = requests.length;
  document.getElementById("pending-requests").textContent = pending;
  document.getElementById("approved-requests").textContent = approved;
  document.getElementById("total-checkins").textContent = checkins.length;
  renderRequests(requests);
  renderDemandAnalysis(checkins, requests);
}

function renderRequests(requests) {
  const container = document.getElementById("admin-request-list");
  if (!requests.length) {
    container.innerHTML = '<p class="muted-text">No passenger requests have been submitted yet.</p>';
    return;
  }

  container.innerHTML = requests.slice().reverse().map(request => {
    const status = request.status || "PENDING";
    const statusClass = status === "APPROVED" ? "status-approved" : status === "REJECTED" ? "status-rejected" : "status-pending";
    const isPending = status === "PENDING";
    return `
      <article class="admin-request-card">
        <div class="request-top"><strong>${safeText(request.id)}</strong><span class="status-pill ${statusClass}">${safeText(status)}</span></div>
        <h3>${safeText(request.from)} → ${safeText(request.to)}</h3>
        <p>Preferred time: ${safeText(request.time)} · Expected passengers: <strong>${Number(request.passengers) || 0}</strong></p>
        <p>Reason: ${safeText(request.reason || "Not provided")}</p>
        <p class="small-note">Submitted: ${request.createdAt ? new Date(request.createdAt).toLocaleString() : "Date unavailable"}</p>
        <label for="note-${safeText(request.id)}">Admin note</label>
        <textarea id="note-${safeText(request.id)}" rows="2" placeholder="Add a reason or decision note">${safeText(request.adminNote || "")}</textarea>
        ${isPending ? `
          <div class="admin-actions">
            <button class="button button-primary" type="button" data-action="approve" data-id="${safeText(request.id)}">Approve</button>
            <button class="button button-danger" type="button" data-action="reject" data-id="${safeText(request.id)}">Reject</button>
          </div>` : ""}
      </article>`;
  }).join("");
}

function renderDemandAnalysis(checkins, requests) {
  const container = document.getElementById("demand-analysis");
  const totals = new Map();

  checkins.forEach(item => {
    const key = (item.from + " → " + item.to).toLowerCase();
    const current = totals.get(key) || { from: item.from, to: item.to, passengers: 0, records: 0 };
    current.passengers += Number(item.passengers) || 0;
    current.records += 1;
    totals.set(key, current);
  });

  requests.filter(item => item.status === "PENDING").forEach(item => {
    const key = (item.from + " → " + item.to).toLowerCase();
    const current = totals.get(key) || { from: item.from, to: item.to, passengers: 0, records: 0 };
    current.passengers += Number(item.passengers) || 0;
    current.records += 1;
    totals.set(key, current);
  });

  const ranked = Array.from(totals.values()).sort((a, b) => b.passengers - a.passengers);
  if (!ranked.length) {
    container.innerHTML = '<p class="muted-text">No check-in or pending request data is available yet. Passenger activity will appear here.</p>';
    return;
  }

  container.innerHTML = '<p class="small-note">Illustrative demand totals from browser check-ins plus pending request estimates. These are not ML predictions.</p>' +
    ranked.map((item, index) => `
      <article class="demand-row">
        <div><strong>${index + 1}. ${safeText(item.from)} → ${safeText(item.to)}</strong><p class="small-note">${item.records} record(s)</p></div>
        <span class="demand-count">${item.passengers} passenger(s)</span>
      </article>`).join("");
}

function updateRequest(requestId, status) {
  const requests = getStoredList(ADMIN_KEYS.requests);
  const index = requests.findIndex(item => item.id === requestId);
  if (index === -1) return;

  const note = document.getElementById("note-" + requestId);
  requests[index].status = status;
  requests[index].adminNote = note ? note.value.trim() : "";
  requests[index].reviewedAt = new Date().toISOString();
  localStorage.setItem(ADMIN_KEYS.requests, JSON.stringify(requests));
  renderAdminDashboard();
}

document.getElementById("admin-login-button").addEventListener("click", adminLogin);
document.getElementById("admin-password").addEventListener("keydown", event => {
  if (event.key === "Enter") adminLogin();
});
document.getElementById("admin-request-list").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  updateRequest(button.dataset.id, button.dataset.action === "approve" ? "APPROVED" : "REJECTED");
});
document.getElementById("refresh-analysis").addEventListener("click", renderAdminDashboard);
document.getElementById("admin-logout").addEventListener("click", () => {
  localStorage.removeItem(ADMIN_KEYS.user);
  window.location.reload();
});

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEYS.user) || "null"); }
  catch { return null; }
})();
if (savedUser && savedUser.role === "admin") showAdminDashboard();