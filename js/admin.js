// SmartRoute AI admin dashboard.
// CSV demand forecasts and recommendations are beginner-friendly demo algorithms.
// Passenger/admin data is stored in this browser's localStorage.

const ADMIN_KEYS = { requests: "smartrouteRequests", checkins: "smartrouteCheckins", user: "smartrouteUser", schedules: "smartrouteSchedules", token: "smartrouteToken" };

async function adminApiFetch(url, options = {}) {
  const token = localStorage.getItem(ADMIN_KEYS.token) || "";
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + token }
  });
  if (response.status === 401) {
    localStorage.removeItem(ADMIN_KEYS.user);
    localStorage.removeItem(ADMIN_KEYS.token);
    window.location.reload();
  }
  return response;
}
const BUS_CAPACITY = 50;
let historicalDemand = [];
let dashboardInitialization = null;
let routeDemandChart = null;
let timeDemandChart = null;
let latestDashboardCheckins = [];
let lastAgentInputSignature = null;
let dashboardRefreshInProgress = false;

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

async function adminLogin() {
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  const message = document.getElementById("admin-login-message");
  message.textContent = "Signing in...";
  try {
    const response = await fetch("http://127.0.0.1:5001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sign-in failed.");
    if (result.user.role !== "admin") throw new Error("This account is not an admin account.");
    localStorage.setItem(ADMIN_KEYS.token, result.token);
    localStorage.setItem(ADMIN_KEYS.user, JSON.stringify(result.user));
    message.textContent = "";
    showAdminDashboard();
  } catch (error) {
    message.textContent = error.message || "Unable to sign in. Check that the backend is running.";
    message.className = "form-message error-message";
  }
}

function showAdminDashboard() {
  document.getElementById("admin-login").hidden = true;
  document.getElementById("admin-dashboard").hidden = false;
  document.getElementById("admin-logout").hidden = false;

  // Start one dashboard initialization only. Previously the page fetched
  // dashboard data immediately and then fetched it again after the CSV loaded.
  if (!dashboardInitialization) {
    dashboardInitialization = (async () => {
      await loadDemandDataset();
      await renderAdminDashboard();
    })().catch(error => {
      console.error("Admin dashboard initialization failed:", error);
      dashboardInitialization = null;
    });
  }
}

async function renderAdminDashboard(options = {}) {
  let requests = [];
  let checkins = [];
  try {
    const responses = await Promise.all([
      adminApiFetch("http://127.0.0.1:5001/api/requests"),
      adminApiFetch("http://127.0.0.1:5001/api/checkins")
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
  latestDashboardCheckins = checkins;
  renderDemandCharts(checkins);

  // Automatically re-run the decision agent when new requests or check-ins arrive.
  // This removes the need for an admin to manually start analysis for each request.
  const agentInputSignature = JSON.stringify({
    requests: requests.map(item => [item.id, item.status, item.from, item.to, item.time, item.passengers]),
    checkins: checkins.map(item => [item.id, item.from, item.to, item.time, item.passengers])
  });
  const inputsChanged = agentInputSignature !== lastAgentInputSignature;
  if (options.refreshAnalysis !== false || inputsChanged) {
    lastAgentInputSignature = agentInputSignature;
    await renderPredictionsAndAgent(checkins, requests);
  }
  await renderServerAgentHistory();
}

async function renderServerAgentHistory() {
  const box = document.getElementById("agent-recommendations");
  if (!box) return;
  try {
    const response = await adminApiFetch("http://127.0.0.1:5001/api/agent/runs");
    if (!response.ok) throw new Error("Agent history is unavailable.");
    const runs = await response.json();
    const runCount = document.getElementById("approved-requests");
    if (runCount) runCount.textContent = runs.length;
    if (!runs.length) return;
    const latest = runs.slice(0, 5);
    box.insertAdjacentHTML("beforeend", '<h3>Automatic server-side agent activity</h3>' +
      latest.map(run => `
        <article class="agent-card">
          <div class="request-top"><strong>${safeText(run.source)} → ${safeText(run.destination)}</strong><span class="status-pill status-available">AUTO ANALYSIS</span></div>
          <p><strong>Time:</strong> ${safeText(run.time_slot)} · <strong>Planning demand:</strong> ${Number(run.planning_demand)} · <strong>Suggested buses:</strong> ${Number(run.buses)}</p>
          <p><strong>Data basis:</strong> ${safeText(run.data_basis)}</p>
          <p>${safeText(run.explanation)}</p>
          <p class="small-note">Triggered by ${safeText(run.trigger_type)} · ${safeText(run.created_at)}</p>
        </article>`).join(""));
  } catch (error) {
    console.warn("Could not load automatic agent history:", error);
  }
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
    const displayStatus = status === "PENDING" ? "AI ANALYSIS" : status;
    const displayClass = status === "PENDING" ? "status-available" : statusClass;
    return `
      <article class="admin-request-card">
        <div class="request-top"><strong>Request #${safeText(request.id)}</strong><span class="status-pill ${displayClass}">${safeText(displayStatus)}</span></div>
        <h3>${safeText(request.from)} → ${safeText(request.to)}</h3>
        <p>Preferred time: ${safeText(request.time)} · Expected passengers: <strong>${Number(request.passengers) || 0}</strong></p>
        <p>Reason: ${safeText(request.reason || "Not provided")}</p>
        <p class="small-note">Submitted: ${request.createdAt ? new Date(request.createdAt).toLocaleString() : "Date unavailable"}</p>
        <p class="small-note">${status === "PENDING" ? "Automatically included in AI demand analysis. Any proposed bus schedule still requires admin approval before publication." : "Request record: " + safeText(status)}</p>
        ${request.adminNote ? `<p class="small-note">Note: ${safeText(request.adminNote)}</p>` : ""}
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
  } catch (error) {
    historicalDemand = [];
    status.textContent = error.message;
    document.getElementById("dataset-summary").innerHTML =
      '<p class="error-message">Check that the data folder and CSV file are present, then reload with Live Server.</p>';
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
      sampleCount: item.training_records,
      isModelForecast: true
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
    forecasts = calculateDemandForecast().map(item => ({ ...item, isModelForecast: false }));
    if (modelStatus) {
      modelStatus.textContent = modelDetails + " " + error.message;
      modelStatus.className = "small-note error-message";
    }
  }

  // Ensure new passenger-request routes are analysed even when the CSV/ML
  // history has never seen those routes before.
  const forecastKeys = new Set(forecasts.map(item =>
    [item.from, item.to, item.time].map(value => String(value).trim().toLowerCase()).join("|")
  ));
  requests.filter(item => item.status === "PENDING").forEach(item => {
    const key = [item.from, item.to, item.time].map(value => String(value).trim().toLowerCase()).join("|");
    if (!forecastKeys.has(key)) {
      forecasts.push({ from: item.from, to: item.to, time: item.time, forecast: 0, sampleCount: 0, isModelForecast: false });
      forecastKeys.add(key);
    }
  });

  if (!forecasts.length) {
    predictionBox.innerHTML = '<p class="muted-text">No demand forecast is available. Check the CSV dataset and prediction service.</p>';
    agentBox.innerHTML = '<p class="muted-text">No ML forecast is available. Server-side request analysis is still active.</p>';
    await renderSchedulePlans([]);
    return;
  }

  predictionBox.innerHTML = '<p class="small-note">Prediction method: ' + safeText(modelName) +
    '. Forecasts are estimates, not guaranteed passenger counts.</p>' +
    forecasts.sort((a, b) => b.forecast - a.forecast).map(item => `
      <article class="demand-row">
        <div><strong>${safeText(item.from)} → ${safeText(item.to)}</strong><p class="small-note">${safeText(item.time)} · Based on ${item.sampleCount} training records</p></div>
        <span class="demand-count">${item.isModelForecast ? item.forecast + " ML-estimated passengers" : item.sampleCount > 0 ? item.forecast + " moving-average baseline" : "No matching route history"}</span>
      </article>`).join("");

  // Explainable decision-agent layer built on top of the ML forecast.
  const recommendations = forecasts.map(item => {
    const sameRoute = entry =>
      String(entry.from).trim().toLowerCase() === item.from.trim().toLowerCase() &&
      String(entry.to).trim().toLowerCase() === item.to.trim().toLowerCase() &&
      String(entry.time).trim().toLowerCase() === item.time.trim().toLowerCase();

    const liveCheckins = checkins.filter(sameRoute)
      .reduce((sum, entry) => sum + (Number(entry.passengers) || 0), 0);
    const pendingRequests = requests.filter(entry =>
      entry.status === "PENDING" && sameRoute(entry)
    ).reduce((sum, entry) => sum + (Number(entry.passengers) || 0), 0);

    // Check-ins already feed the ML training data, so do not count them twice.
    // Half of pending request passengers are used as an extra planning signal.
    // For a route absent from the model, use a clearly labelled observed-data
    // fallback rather than presenting a zero ML forecast as a prediction.
    const hasModelForecast = item.isModelForecast === true && Number(item.sampleCount) > 0;
    const planningDemand = Math.max(0, Math.ceil(
      hasModelForecast
        ? item.forecast + pendingRequests * 0.5
        : item.forecast + pendingRequests + liveCheckins
    ));
    const busesRequired = Math.max(1, Math.ceil(planningDemand / BUS_CAPACITY));
    const extraBuses = Math.max(0, busesRequired - 1);
    const utilization = planningDemand / (busesRequired * BUS_CAPACITY);
    const confidence = item.sampleCount >= 10 ? "Stronger history" :
      item.sampleCount >= 5 ? "Moderate history" : "Limited history";

    let priority = "NORMAL";
    let action = "Keep the current service and monitor demand.";
    let reason = hasModelForecast
      ? "Random Forest estimate and pending-request signal fit within the assumed capacity."
      : "No exact Random Forest route/time forecast; this estimate uses the historical moving-average baseline, check-ins and pending requests.";
    if (extraBuses > 0) {
      priority = "HIGH";
      action = "Plan " + extraBuses + " additional bus(es) for this route and time slot.";
      reason = "Planning demand exceeds the assumed capacity of one bus.";
    } else if (utilization >= 0.8) {
      priority = "HIGH";
      action = "Consider an additional departure or a larger vehicle.";
      reason = "Estimated capacity usage is at least 80%.";
    } else if (pendingRequests > 0) {
      priority = "REVIEW";
      action = "Review pending passenger requests before confirming the service.";
      reason = "Unapproved requests indicate additional possible demand.";
    }

    return {
      ...item, planningDemand, busesRequired, extraBuses, action, reason,
      priority, utilization: Math.round(utilization * 100),
      liveCheckins, pendingRequests, confidence
    };
  }).sort((a, b) =>
    ({ HIGH: 0, REVIEW: 1, NORMAL: 2 }[a.priority] - { HIGH: 0, REVIEW: 1, NORMAL: 2 }[b.priority]) ||
    b.planningDemand - a.planningDemand
  );

  agentBox.innerHTML = `
    <p class="small-note">Uses an exact Random Forest route/time forecast when available. Otherwise it labels the moving-average or observed-data fallback. Bus capacity is assumed to be 50; admin approval is always required.</p>
    ` + recommendations.map((item, index) => `
      <article class="agent-card">
        <div class="request-top"><strong>${index + 1}. ${safeText(item.from)} → ${safeText(item.to)}</strong><span class="status-pill ${item.priority === "HIGH" ? "status-pending" : item.priority === "REVIEW" ? "status-pending" : "status-available"}">${safeText(item.priority)} PRIORITY</span></div>
        <p><strong>Time:</strong> ${safeText(item.time)}</p>
        <p><strong>${item.isModelForecast ? "Random Forest forecast" : item.sampleCount > 0 ? "Moving-average baseline" : "ML forecast unavailable"}:</strong> ${item.isModelForecast || item.sampleCount > 0 ? item.forecast + " passengers" : "No matching route history"} · <strong>Planning estimate:</strong> ${item.planningDemand} passengers</p>
        <p><strong>Estimated buses:</strong> ${item.busesRequired} at ${BUS_CAPACITY} assumed seats each · <strong>Capacity use:</strong> ${item.utilization}%</p>
        <p><strong>Evidence:</strong> ${item.liveCheckins} check-in passengers · ${item.pendingRequests} passengers in pending requests</p>
        <p><strong>Data confidence:</strong> ${safeText(item.confidence)} (${item.sampleCount} route records)</p>
        <p><strong>Why:</strong> ${safeText(item.reason)}</p>
        <p class="agent-action"><strong>Agent recommendation:</strong> ${safeText(item.action)}</p>
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
    // The backend agent owns proposals for routes triggered by live passenger
    // activity. Do not overwrite those values or an admin's decision from the UI.
    const existingResponse = await adminApiFetch("http://127.0.0.1:5001/api/schedules");
    if (!existingResponse.ok) throw new Error("Could not load existing schedule proposals.");
    const existingPlans = await existingResponse.json();
    const existingKeys = new Set(existingPlans.map(plan =>
      [plan.source, plan.destination, plan.time_slot].map(value => String(value).trim().toLowerCase()).join("|")
    ));

    for (const item of recommendations) {
      const key = [item.from, item.to, item.time].map(value => String(value).trim().toLowerCase()).join("|");
      if (existingKeys.has(key)) continue;
      const start = scheduleSlotStart(item.time);
      const departures = Array.from(
        { length: item.busesRequired },
        (_, index) => scheduleClock(start + index * 30)
      );
      const response = await adminApiFetch("http://127.0.0.1:5001/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.from,
          destination: item.to,
          time_slot: item.time,
          predicted_passengers: item.planningDemand ?? item.forecast,
          buses: item.busesRequired,
          departures
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save schedule proposal.");
      existingKeys.add(key);
    }

    const response = await adminApiFetch("http://127.0.0.1:5001/api/schedules");
    if (!response.ok) throw new Error("Could not load saved schedule proposals.");
    const plans = await response.json();
    localStorage.setItem(ADMIN_KEYS.schedules, JSON.stringify(plans));
    box.innerHTML = plans.map(plan => {
      const cls = plan.status === "APPROVED" ? "status-approved" : plan.status === "REJECTED" ? "status-rejected" : "status-pending";
      return `<article class="schedule-card">
        <div class="request-top"><strong>${safeText(plan.source)} → ${safeText(plan.destination)}</strong><span class="status-pill ${cls}">${safeText(plan.status)}</span></div>
        <p><strong>Time slot:</strong> ${safeText(plan.time_slot)} · <strong>Planning demand estimate:</strong> ${Number(plan.predicted_passengers)}</p>
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
    const response = await adminApiFetch("http://127.0.0.1:5001/api/schedules/" + encodeURIComponent(scheduleId), {
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

  const language = window.smartRouteLanguage || "en";
  const chartText = (window.smartRouteChartText && window.smartRouteChartText[language]) || window.smartRouteChartText?.en || {};

  if (!window.Chart) {
    status.textContent = chartText.chartUnavailable || "Chart library could not load. Check your internet connection and refresh.";
    return;
  }
  if (!historicalDemand.length) {
    status.textContent = chartText.noDataset || "Load the CSV dataset to display historical demand charts.";
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
      datasets: [{ label: chartText.recordedTrips || "Recorded passenger trips", data: topRoutes.map(item => item[1]), backgroundColor: "#16845b", borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => context.parsed.y + " " + (chartText.passengers || "passengers") } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: chartText.passengers || "Passengers" } }, x: { ticks: { maxRotation: 35, minRotation: 0 } } }
    }
  });

  timeDemandChart = new Chart(timeCanvas, {
    type: "doughnut",
    data: {
      labels: timeSlots.map(item => item[0]),
      datasets: [{ label: chartText.passengerTrips || "Passenger trips", data: timeSlots.map(item => item[1]), backgroundColor: ["#16845b", "#1f5f91", "#e6a23c", "#8b70b5"] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: context => context.label + ": " + context.parsed + " " + (chartText.passengers || "passengers") } } }
    }
  });

  const liveCount = checkins.reduce((sum, item) => sum + (Number(item.passengers) || 0), 0);
  status.textContent = (chartText.historicalPrefix || "Historical charts are based on") + " " + historicalDemand.length + " synthetic CSV records. " + (chartText.currentCheckins || "Current browser check-ins:") + " " + liveCount + " " + (chartText.passengers || "passengers") + ". The two sources are kept separate to avoid double counting.";
}

async function updateRequest(requestId, action) {
  const note = document.getElementById("note-" + requestId);
  const status = action === "approve" ? "APPROVED" : "REJECTED";
  try {
    const response = await adminApiFetch("http://127.0.0.1:5001/api/requests/" + encodeURIComponent(requestId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_note: note ? note.value.trim() : "" })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update request.");
    await renderAdminDashboard({ refreshAnalysis: false });
  } catch (error) {
    alert("Request update failed: " + error.message);
  }
}

document.addEventListener("smartroute:languagechange", () => renderDemandCharts(latestDashboardCheckins));

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
document.getElementById("refresh-analysis").addEventListener("click", async () => {
  const button = document.getElementById("refresh-analysis");
  button.disabled = true;
  button.textContent = "Refreshing...";
  try {
    await loadDemandDataset();
    const agentResponse = await adminApiFetch("http://127.0.0.1:5001/api/agent/analyze", { method: "POST" });
    if (!agentResponse.ok) throw new Error("Server-side demand analysis could not be refreshed.");
    await renderAdminDashboard();
  } finally {
    button.disabled = false;
    button.textContent = "Refresh Dataset & Analysis";
  }
});
document.getElementById("admin-logout").addEventListener("click", async () => {
  try { await adminApiFetch("http://127.0.0.1:5001/api/auth/logout", { method: "POST" }); }
  catch (error) { console.warn("Server sign-out could not be confirmed:", error); }
  localStorage.removeItem(ADMIN_KEYS.user);
  localStorage.removeItem(ADMIN_KEYS.token);
  window.location.reload();
});

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEYS.user) || "null"); }
  catch { return null; }
})();
if (savedUser && savedUser.role === "admin" && localStorage.getItem(ADMIN_KEYS.token)) {
  adminApiFetch("http://127.0.0.1:5001/api/auth/me")
    .then(response => { if (!response.ok) throw new Error("Session expired"); return response.json(); })
    .then(result => { if (result.user.role === "admin") showAdminDashboard(); else throw new Error("Wrong role"); })
    .catch(() => {
      localStorage.removeItem(ADMIN_KEYS.user);
      localStorage.removeItem(ADMIN_KEYS.token);
    });
}


// Poll SQLite while the admin dashboard is open. New passenger requests/check-ins
// automatically trigger the agent and refresh proposed schedules without a button click.
setInterval(async () => {
  const dashboard = document.getElementById("admin-dashboard");
  if (!dashboard || dashboard.hidden || dashboardRefreshInProgress) return;
  dashboardRefreshInProgress = true;
  try {
    await renderAdminDashboard({ refreshAnalysis: false });
  } catch (error) {
    console.error("Automatic dashboard sync failed:", error);
  } finally {
    dashboardRefreshInProgress = false;
  }
}, 15000);

// Database connection status is updated after records are loaded from the Flask API.
