// SmartRoute AI admin dashboard.
// CSV demand forecasts and recommendations are beginner-friendly demo algorithms.
// Passenger/admin data is stored in this browser's localStorage.

const ADMIN_KEYS = { requests: "smartrouteRequests", checkins: "smartrouteCheckins", user: "smartrouteUser", schedules: "smartrouteSchedules" };
const BUS_CAPACITY = 50;
let historicalDemand = [];
let routeDemandChart = null;
let timeDemandChart = null;

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
  loadDemandDataset();
}

async function renderAdminDashboard() {
  let requests = [];
  let checkins = [];
  try {
    const responses = await Promise.all([
      fetch("http://127.0.0.1:5001/api/requests"),
      fetch("http://127.0.0.1:5001/api/checkins")
    ]);
    if (responses.some(response => !response.ok)) throw new Error("SQLite API request failed.");
    const [requestRows, checkinRows] = await Promise.all(responses.map(response => response.json()));
    requests = requestRows.map(row => ({
      id: String(row.id), from: row.source, to: row.destination,
      time: row.preferred_time, passengers: row.expected_passengers,
      reason: row.reason, status: row.status, adminNote: row.admin_note || "",
      createdAt: row.created_at, dbId: row.id
    }));
    checkins = checkinRows.map(row => ({
      id: String(row.id), from: row.source, to: row.destination,
      time: row.travel_time, passengers: row.passengers, createdAt: row.created_at
    }));
    localStorage.setItem(ADMIN_KEYS.requests, JSON.stringify(requests));
    localStorage.setItem(ADMIN_KEYS.checkins, JSON.stringify(checkins));
    const status = document.getElementById("cloud-status");
    if (status) status.textContent = "SQLite connected. Passenger data loaded from the database.";
  } catch (error) {
    const status = document.getElementById("cloud-status");
    if (status) status.textContent = "SQLite backend unavailable. Start python backend/app.py and refresh.";
    document.getElementById("admin-request-list").innerHTML = '<p class="error-message">Could not load passenger records from SQLite.</p>';
    return;
  }
  const pending = requests.filter(item => item.status === "PENDING").length;
  const approved = requests.filter(item => item.status === "APPROVED").length;

  document.getElementById("total-requests").textContent = requests.length;
  document.getElementById("pending-requests").textContent = pending;
  document.getElementById("approved-requests").textContent = approved;
  document.getElementById("total-checkins").textContent = checkins.length;
  renderRequests(requests);
  renderDemandAnalysis(checkins, requests);
  renderPredictionsAndAgent(checkins, requests);
  renderDemandCharts(checkins);
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

// Load and parse the CSV file from the repository.
async function loadDemandDataset() {
  const status = document.getElementById("dataset-status");
  status.textContent = "Loading data/rural_transport_demand.csv ...";

  try {
    const response = await fetch("data/rural_transport_demand.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("CSV file could not be loaded. Open the site with VS Code Live Server.");
    const csvText = await response.text();
    historicalDemand = parseDemandCSV(csvText);
    if (!historicalDemand.length) throw new Error("The CSV file has no valid demand records.");

    status.textContent = "Dataset loaded successfully: " + historicalDemand.length +
      " records from " + new Set(historicalDemand.map(row => row.date)).size + " dates. Sample data is synthetic.";
    renderDatasetSummary();
    renderAdminDashboard();
  } catch (error) {
    historicalDemand = [];
    status.textContent = error.message;
    document.getElementById("dataset-summary").innerHTML =
      '<p class="error-message">Check that the data folder and CSV file are present, then reload with Live Server.</p>';
    renderPredictionsAndAgent(getStoredList(ADMIN_KEYS.checkins), getStoredList(ADMIN_KEYS.requests));
  }
}

function parseDemandCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(value => value.trim().toLowerCase());
  const positions = {
    date: headers.indexOf("date"),
    source: headers.indexOf("source"),
    destination: headers.indexOf("destination"),
    time: headers.indexOf("time"),
    passengers: headers.indexOf("passengers")
  };
  if (Object.values(positions).some(index => index < 0)) {
    throw new Error("CSV must contain Date, Source, Destination, Time and Passengers columns.");
  }

  return lines.slice(1).map(line => {
    const cells = line.split(",").map(value => value.trim());
    return {
      date: cells[positions.date],
      from: cells[positions.source],
      to: cells[positions.destination],
      time: cells[positions.time],
      passengers: Number(cells[positions.passengers])
    };
  }).filter(row => row.date && row.from && row.to && row.time && Number.isFinite(row.passengers) && row.passengers >= 0);
}

function renderDatasetSummary() {
  const container = document.getElementById("dataset-summary");
  const routeCount = new Set(historicalDemand.map(row => (row.from + "|" + row.to).toLowerCase())).size;
  const totalPassengers = historicalDemand.reduce((sum, row) => sum + row.passengers, 0);
  const dates = historicalDemand.map(row => row.date).sort();
  container.innerHTML = `
    <div class="dataset-metrics">
      <div><strong>${historicalDemand.length}</strong><span>CSV records</span></div>
      <div><strong>${routeCount}</strong><span>Routes</span></div>
      <div><strong>${totalPassengers}</strong><span>Total recorded passenger trips</span></div>
    </div>
    <p class="small-note">Date range: ${safeText(dates[0])} to ${safeText(dates[dates.length - 1])}. Source: project sample CSV.</p>
    <p class="small-note"><a href="data/rural_transport_demand.csv" download>Download CSV dataset</a></p>`;
}

// Forecast each route/time slot using the average of its latest three records.
function calculateDemandForecast() {
  const groups = new Map();
  historicalDemand.forEach(row => {
    const key = (row.from + "|" + row.to + "|" + row.time).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  return Array.from(groups.values()).map(rows => {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const recentRows = rows.slice(-3);
    const forecast = Math.round(recentRows.reduce((sum, row) => sum + row.passengers, 0) / recentRows.length);
    const last = rows[rows.length - 1];
    return { from: last.from, to: last.to, time: last.time, forecast, sampleCount: rows.length };
  }).sort((a, b) => b.forecast - a.forecast);
}

async function renderPredictionsAndAgent(checkins, requests) {
  const predictionBox = document.getElementById("demand-predictions");
  const agentBox = document.getElementById("agent-recommendations");
  const modelStatus = document.getElementById("ml-model-status");
  let forecasts = [];
  let modelName = "Three-record moving average (fallback)";
  let modelDetails = "Python ML service is not connected. Start the service to use Random Forest predictions.";

  try {
    const response = await fetch("http://127.0.0.1:5000/api/predict", {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) throw new Error("ML service returned HTTP " + response.status);
    const result = await response.json();
    if (!Array.isArray(result.predictions) || !result.predictions.length) {
      throw new Error("The ML service returned no predictions.");
    }
    forecasts = result.predictions.map(item => ({
      from: item.source,
      to: item.destination,
      time: item.time,
      forecast: Math.max(0, Math.round(item.predicted_passengers)),
      sampleCount: item.training_records
    }));
    modelName = result.model || "Random Forest Regression";
    const sources = result.data_sources || {};
    modelDetails = "Random Forest model active • " + result.training_samples +
      " training samples • Holdout MAE: " + result.mae + " passengers • Forecast date: " + result.forecast_date +
      " • SQLite check-ins used: " + (sources.sqlite_checkin_submissions || 0) +
      " • CSV rows used: " + (sources.csv_records_used || 0) +
      ". CSV data is synthetic and SQLite check-ins are prototype user-entered data; treat forecasts as estimates.";
    if (modelStatus) {
      modelStatus.textContent = modelDetails;
      modelStatus.className = "small-note success-message";
    }
  } catch (error) {
    forecasts = calculateDemandForecast();
    if (modelStatus) {
      modelStatus.textContent = modelDetails + " " + error.message;
      modelStatus.className = "small-note error-message";
    }
  }

  if (!forecasts.length) {
    predictionBox.innerHTML = '<p class="muted-text">No demand forecast is available. Check the CSV dataset and prediction service.</p>';
    agentBox.innerHTML = '<p class="muted-text">The recommendation assistant is waiting for demand data.</p>';
    return;
  }

  predictionBox.innerHTML = '<p class="small-note">Prediction method: ' + safeText(modelName) +
    '. Forecasts are estimates, not guaranteed passenger counts.</p>' +
    forecasts.sort((a, b) => b.forecast - a.forecast).map(item => `
      <article class="demand-row">
        <div><strong>${safeText(item.from)} → ${safeText(item.to)}</strong><p class="small-note">${safeText(item.time)} · Based on ${item.sampleCount} training records</p></div>
        <span class="demand-count">${item.forecast} passengers (estimated)</span>
      </article>`).join("");

  const recommendations = forecasts.map(item => {
    const busesRequired = Math.max(1, Math.ceil(item.forecast / BUS_CAPACITY));
    const extraBuses = Math.max(0, busesRequired - 1);
    let action;
    if (extraBuses > 0) {
      action = "Consider " + extraBuses + " additional bus(es) for this time slot. Estimated demand exceeds one bus capacity.";
    } else if (item.forecast >= BUS_CAPACITY * 0.8) {
      action = "High demand: consider a second departure, a larger vehicle, or monitoring this time slot closely.";
    } else {
      action = "One bus may be sufficient based on the current estimate. Continue monitoring passenger check-ins.";
    }

    const liveCheckins = checkins.filter(entry =>
      String(entry.from).toLowerCase() === item.from.toLowerCase() &&
      String(entry.to).toLowerCase() === item.to.toLowerCase() &&
      String(entry.time).toLowerCase() === item.time.toLowerCase()
    ).reduce((sum, entry) => sum + (Number(entry.passengers) || 0), 0);
    const pendingRequests = requests.filter(entry =>
      entry.status === "PENDING" &&
      String(entry.from).toLowerCase() === item.from.toLowerCase() &&
      String(entry.to).toLowerCase() === item.to.toLowerCase() &&
      String(entry.time).toLowerCase() === item.time.toLowerCase()
    ).reduce((sum, entry) => sum + (Number(entry.passengers) || 0), 0);

    return { ...item, busesRequired, extraBuses, action, liveCheckins, pendingRequests };
  });

  agentBox.innerHTML = `
    <p class="small-note">Recommendation assistant uses the ${safeText(modelName)} forecast and an assumed bus capacity of ${BUS_CAPACITY}. Recommendations require admin approval.</p>
    ` + recommendations.map((item, index) => `
      <article class="agent-card">
        <div class="request-top"><strong>${index + 1}. ${safeText(item.from)} → ${safeText(item.to)}</strong><span class="status-pill ${item.extraBuses ? "status-pending" : "status-available"}">${item.extraBuses ? "Extra capacity suggested" : "Monitor demand"}</span></div>
        <p><strong>Time:</strong> ${safeText(item.time)}</p>
        <p><strong>Predicted demand:</strong> ${item.forecast} passengers</p>
        <p><strong>Estimated buses needed:</strong> ${item.busesRequired} (assuming ${BUS_CAPACITY} seats per bus and one existing bus)</p>
        <p><strong>Current browser signals:</strong> ${item.liveCheckins} check-in passengers · ${item.pendingRequests} passengers in pending requests</p>
        <p class="agent-action"><strong>Recommendation:</strong> ${safeText(item.action)}</p>
      </article>`).join("");
  renderSchedulePlans(recommendations);
}


function scheduleSlotStart(slot) {
  const value = String(slot).toLowerCase();
  if (value.includes("morning")) return 420;
  if (value.includes("afternoon")) return 720;
  if (value.includes("evening")) return 1020;
  return 480;
}
function scheduleClock(total) {
  const hour = Math.floor(total / 60) % 24;
  return String(hour % 12 || 12).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0") + " " + (hour >= 12 ? "PM" : "AM");
}
async function renderSchedulePlans(recommendations) {
  const box = document.getElementById("schedule-plan-list");
  if (!box) return;
  box.innerHTML = '<p class="muted-text">Saving schedule proposals to SQLite...</p>';

  try {
    for (const item of recommendations) {
      const start = scheduleSlotStart(item.time);
      const departures = Array.from(
        { length: item.busesRequired },
        (_, index) => scheduleClock(start + index * 30)
      );
      const response = await fetch("http://127.0.0.1:5001/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.from,
          destination: item.to,
          time_slot: item.time,
          predicted_passengers: item.forecast,
          buses: item.busesRequired,
          departures
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save schedule proposal.");
    }

    const response = await fetch("http://127.0.0.1:5001/api/schedules");
    if (!response.ok) throw new Error("Could not load saved schedule proposals.");
    const plans = await response.json();
    localStorage.setItem(ADMIN_KEYS.schedules, JSON.stringify(plans));
    box.innerHTML = plans.map(plan => {
      const cls = plan.status === "APPROVED" ? "status-approved" : plan.status === "REJECTED" ? "status-rejected" : "status-pending";
      return `<article class="schedule-card">
        <div class="request-top"><strong>${safeText(plan.source)} → ${safeText(plan.destination)}</strong><span class="status-pill ${cls}">${safeText(plan.status)}</span></div>
        <p><strong>Time slot:</strong> ${safeText(plan.time_slot)} · <strong>Predicted passengers:</strong> ${Number(plan.predicted_passengers)}</p>
        <p><strong>Suggested buses:</strong> ${Number(plan.buses)} (assumed capacity ${BUS_CAPACITY} each)</p>
        <p><strong>Proposed departures:</strong> ${(plan.departures || []).map(safeText).join(" · ")}</p>
        <p class="small-note">Illustrative 30-minute intervals only; not verified operator timetables.</p>
        <label for="schedule-note-${plan.id}">Admin decision note</label>
        <textarea id="schedule-note-${plan.id}" rows="2">${safeText(plan.admin_note || "")}</textarea>
        ${plan.status === "PENDING" ? `<div class="admin-actions"><button class="button button-primary" data-schedule-action="approve" data-id="${plan.id}" type="button">Approve & Publish</button><button class="button button-danger" data-schedule-action="reject" data-id="${plan.id}" type="button">Reject</button></div>` : ""}
      </article>`;
    }).join("") || '<p class="muted-text">No schedule proposals available.</p>';
  } catch (error) {
    box.innerHTML = '<p class="error-message">Schedule database error: ' + safeText(error.message) + '. Make sure the SQLite backend is running.</p>';
  }
}

async function updateScheduleStatus(scheduleId, action) {
  const note = document.getElementById("schedule-note-" + scheduleId);
  const status = action === "approve" ? "APPROVED" : "REJECTED";
  try {
    const response = await fetch("http://127.0.0.1:5001/api/schedules/" + encodeURIComponent(scheduleId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_note: note ? note.value.trim() : "" })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update schedule.");
    await renderSchedulePlans([]);
    alert(status === "APPROVED" ? "Schedule approved and published to the Passenger Dashboard." : "Schedule proposal rejected.");
  } catch (error) {
    alert("Schedule update failed: " + error.message);
  }
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
    container.innerHTML = '<p class="muted-text">No browser check-in or pending request data yet. CSV-based forecasts are shown above.</p>';
    return;
  }

  container.innerHTML = '<p class="small-note">Passenger totals from this browser’s check-ins and pending service requests.</p>' +
    ranked.map((item, index) => `
      <article class="demand-row">
        <div><strong>${index + 1}. ${safeText(item.from)} → ${safeText(item.to)}</strong><p class="small-note">${item.records} record(s)</p></div>
        <span class="demand-count">${item.passengers} passenger(s)</span>
      </article>`).join("");
}


function renderDemandCharts(checkins) {
  const status = document.getElementById("chart-status");
  const routeCanvas = document.getElementById("route-demand-chart");
  const timeCanvas = document.getElementById("time-demand-chart");
  if (!routeCanvas || !timeCanvas) return;

  if (!window.Chart) {
    status.textContent = "Chart library could not load. Check your internet connection and refresh.";
    return;
  }
  if (!historicalDemand.length) {
    status.textContent = "Load the CSV dataset to display historical demand charts.";
    return;
  }

  const routeTotals = new Map();
  const timeTotals = new Map();
  historicalDemand.forEach(row => {
    const route = row.from + " → " + row.to;
    routeTotals.set(route, (routeTotals.get(route) || 0) + row.passengers);
    const slot = row.time;
    timeTotals.set(slot, (timeTotals.get(slot) || 0) + row.passengers);
  });

  const topRoutes = Array.from(routeTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const timeSlots = Array.from(timeTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (routeDemandChart) routeDemandChart.destroy();
  if (timeDemandChart) timeDemandChart.destroy();

  routeDemandChart = new Chart(routeCanvas, {
    type: "bar",
    data: {
      labels: topRoutes.map(item => item[0]),
      datasets: [{ label: "Recorded passenger trips", data: topRoutes.map(item => item[1]), backgroundColor: "#16845b", borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => context.parsed.y + " passengers" } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "Passengers" } }, x: { ticks: { maxRotation: 35, minRotation: 0 } } }
    }
  });

  timeDemandChart = new Chart(timeCanvas, {
    type: "doughnut",
    data: {
      labels: timeSlots.map(item => item[0]),
      datasets: [{ label: "Passenger trips", data: timeSlots.map(item => item[1]), backgroundColor: ["#16845b", "#1f5f91", "#e6a23c", "#8b70b5"] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: context => context.label + ": " + context.parsed + " passengers" } } }
    }
  });

  const liveCount = checkins.reduce((sum, item) => sum + (Number(item.passengers) || 0), 0);
  status.textContent = "Historical charts are based on " + historicalDemand.length + " synthetic CSV records. Current browser check-ins: " + liveCount + " passengers. The two sources are kept separate to avoid double counting.";
}

async function updateRequest(requestId, action) {
  const note = document.getElementById("note-" + requestId);
  const status = action === "approve" ? "APPROVED" : "REJECTED";
  try {
    const response = await fetch("http://127.0.0.1:5001/api/requests/" + encodeURIComponent(requestId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_note: note ? note.value.trim() : "" })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update request.");
    await renderAdminDashboard();
  } catch (error) {
    alert("Request update failed: " + error.message);
  }
}

document.getElementById("admin-login-button").addEventListener("click", adminLogin);
document.getElementById("admin-password").addEventListener("keydown", event => {
  if (event.key === "Enter") adminLogin();
});
document.getElementById("schedule-plan-list").addEventListener("click", event => {
  const button = event.target.closest("button[data-schedule-action]");
  if (button) updateScheduleStatus(button.dataset.id, button.dataset.scheduleAction);
});
document.getElementById("admin-request-list").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  updateRequest(button.dataset.id, button.dataset.action);
});
document.getElementById("refresh-analysis").addEventListener("click", loadDemandDataset);
document.getElementById("admin-logout").addEventListener("click", () => {
  localStorage.removeItem(ADMIN_KEYS.user);
  window.location.reload();
});

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEYS.user) || "null"); }
  catch { return null; }
})();
if (savedUser && savedUser.role === "admin") showAdminDashboard();


// Database connection status is updated after records are loaded from the Flask API.
