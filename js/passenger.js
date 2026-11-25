// SmartRoute AI passenger dashboard.
// This frontend prototype stores demo data in this browser using localStorage.

const STORAGE_KEYS = {
  checkins: "smartrouteCheckins",
  requests: "smartrouteRequests",
  user: "smartrouteUser"
};

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function showMessage(id, message, isError = false) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.className = isError ? "form-message error-message" : "form-message success-message";
}

// Known demo bus services. Other Indian locations use the map-based road route estimate;
// this does not imply that a scheduled bus service is available.
const demoRoutes = [
  { from: "khambhampadu", to: "tiruvuru", service: "Rural Link 101", time: "07:30 AM", duration: "35 min" },
  { from: "avadi", to: "veltech junction", service: "Village Connect 202", time: "08:00 AM", duration: "25 min" },
  { from: "tiruvuru", to: "vijayawada", service: "Town Express 303", time: "09:15 AM", duration: "1 hr 40 min" }
];

// Interactive map: Leaflet + OpenStreetMap, with Nominatim geocoding and OSRM routing.
let routeMap;
let routeLayer;
let activeScheduleRoute = null;
let routeMarkers = [];

function initializeRouteMap() {
  const mapElement = document.getElementById("route-map");
  if (!mapElement || !window.L) return;

  routeMap = L.map("route-map").setView([16.9, 80.9], 8);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(routeMap);
}

async function geocodePlace(place) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=" + encodeURIComponent(place + ", India");
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("Location lookup failed. Please try again.");
  const locations = await response.json();
  if (!locations.length) throw new Error('Could not find "' + place + '". Try adding the district or state.');
  return {
    lat: Number(locations[0].lat),
    lon: Number(locations[0].lon),
    label: locations[0].display_name
  };
}

// Live location suggestions for the Route Finder.
// Search starts after two characters, is debounced/throttled, and is restricted to India.
const autocompleteTimers = new Map();
const autocompleteControllers = new Map();
const autocompleteLastRequest = new Map();
const autocompleteCache = new Map();

function closeLocationSuggestions(input) {
  const list = document.getElementById(input.id + "-suggestions");
  if (list) {
    list.hidden = true;
    list.replaceChildren();
  }
  input.setAttribute("aria-expanded", "false");
}

function attachLocationAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(inputId + "-suggestions");
  if (!input || !list) return;

  input.setAttribute("aria-expanded", "false");

  input.addEventListener("input", () => {
    const query = cleanText(input.value);
    clearTimeout(autocompleteTimers.get(inputId));
    const previousController = autocompleteControllers.get(inputId);
    if (previousController) previousController.abort();

    if (query.length < 2) {
      closeLocationSuggestions(input);
      return;
    }

    list.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "autocomplete-message";
    loading.textContent = "Finding locations in India...";
    list.replaceChildren(loading);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");

    autocompleteTimers.set(inputId, setTimeout(async () => {
      const cacheKey = query.toLocaleLowerCase();
      try {
        let places = autocompleteCache.get(cacheKey);
        if (!places) {
          const lastRequest = autocompleteLastRequest.get(inputId) || 0;
          const wait = Math.max(0, 1100 - (Date.now() - lastRequest));
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          if (cleanText(input.value).toLocaleLowerCase() !== cacheKey) return;

          const controller = new AbortController();
          autocompleteControllers.set(inputId, controller);
          autocompleteLastRequest.set(inputId, Date.now());
          const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=in&q=" + encodeURIComponent(query);
          const response = await fetch(url, {
            headers: { "Accept": "application/json" },
            signal: controller.signal
          });
          if (!response.ok) throw new Error("Location suggestions are temporarily unavailable.");
          places = await response.json();
          autocompleteCache.set(cacheKey, places);
        }

        if (cleanText(input.value).toLocaleLowerCase() !== cacheKey) return;
        list.replaceChildren();
        if (!places.length) {
          const empty = document.createElement("div");
          empty.className = "autocomplete-message";
          empty.textContent = "No matching Indian locations. Try adding a district or state.";
          list.appendChild(empty);
          return;
        }

        places.forEach(place => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "autocomplete-option";
          option.setAttribute("role", "option");
          option.textContent = place.display_name;
          option.addEventListener("click", () => {
            input.value = place.display_name;
            closeLocationSuggestions(input);
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });
          list.appendChild(option);
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        list.replaceChildren();
        const message = document.createElement("div");
        message.className = "autocomplete-message";
        message.textContent = "Suggestions unavailable. You can still type the full location.";
        list.appendChild(message);
      }
    }, 550));
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeLocationSuggestions(input);
      return;
    }
    if (event.key === "ArrowDown" && !list.hidden) {
      const firstOption = list.querySelector(".autocomplete-option");
      if (firstOption) {
        event.preventDefault();
        firstOption.focus();
      }
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => closeLocationSuggestions(input), 160);
  });
}

attachLocationAutocomplete("route-from");
attachLocationAutocomplete("route-to");

async function showRouteOnMap(from, to) {
  const message = document.getElementById("map-message");
  message.textContent = "Finding both locations and calculating a road route...";
  try {
    const [start, end] = await Promise.all([geocodePlace(from), geocodePlace(to)]);
    const routeUrl = "https://router.project-osrm.org/route/v1/driving/" +
      start.lon + "," + start.lat + ";" + end.lon + "," + end.lat +
      "?overview=full&geometries=geojson";
    const routeResponse = await fetch(routeUrl);
    if (!routeResponse.ok) throw new Error("The route service is temporarily unavailable.");
    const routeData = await routeResponse.json();
    if (routeData.code !== "Ok" || !routeData.routes || !routeData.routes.length) {
      throw new Error("No drivable route was returned for these locations.");
    }

    if (routeLayer) routeMap.removeLayer(routeLayer);
    routeMarkers.forEach(marker => routeMap.removeLayer(marker));
    routeMarkers = [];

    routeMarkers.push(L.marker([start.lat, start.lon]).addTo(routeMap).bindPopup("Start: " + escapeHTML(from)));
    routeMarkers.push(L.marker([end.lat, end.lon]).addTo(routeMap).bindPopup("Destination: " + escapeHTML(to)));
    const coordinates = routeData.routes[0].geometry.coordinates.map(point => [point[1], point[0]]);
    routeLayer = L.polyline(coordinates, { color: "#16845b", weight: 5 }).addTo(routeMap);
    routeMap.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    const distanceKm = (routeData.routes[0].distance / 1000).toFixed(1);
    const durationMin = Math.round(routeData.routes[0].duration / 60);
    const durationText = durationMin >= 60 ? Math.floor(durationMin / 60) + " hr " + durationMin % 60 + " min" : durationMin + " min";
    message.textContent = "India road route found • Approx. " + distanceKm + " km • " + durationText + ". This is a road estimate, not a confirmed bus timetable.";
    return { distanceKm, durationText, startLabel: start.label, endLabel: end.label };
  } catch (error) {
    message.textContent = error.message || "Unable to load the map route right now.";
    throw error;
  }
}

document.getElementById("route-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const from = cleanText(document.getElementById("route-from").value);
  const to = cleanText(document.getElementById("route-to").value);
  const date = document.getElementById("route-date").value;
  const results = document.getElementById("route-results");

  if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
    results.innerHTML = '<p class="error-message">Enter two different Indian locations.</p>';
    return;
  }

  results.innerHTML = '<p class="muted-text">Searching for the road route across India...</p>';
  const submitButton = this.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Searching...";

  try {
    const route = await showRouteOnMap(from, to);
    activeScheduleRoute = { from, to };
    renderPublishedSchedules();
    const sample = demoRoutes.find(item =>
      item.from === from.toLowerCase() && item.to === to.toLowerCase()
    );

    results.innerHTML = `
      <article class="route-result">
        <span class="status-pill status-available">Road route found</span>
        <h3>${escapeHTML(from)} → ${escapeHTML(to)}</h3>
        <p><strong>Approx. distance:</strong> ${route.distanceKm} km</p>
        <p><strong>Estimated driving time:</strong> ${route.durationText}</p>
        <p><strong>Travel date:</strong> ${escapeHTML(date)}</p>
        ${sample ? `<p><strong>Demo bus service:</strong> ${escapeHTML(sample.service)} · ${escapeHTML(sample.time)}</p>` : ""}
        <p class="small-note">Road directions are retrieved from OpenStreetMap/OSRM. Bus operators, fares, departure times and seat availability are not verified by this prototype.</p>
      </article>`;
    document.getElementById("request-from").value = from;
    document.getElementById("request-to").value = to;
  } catch (error) {
    activeScheduleRoute = { from, to };
    renderPublishedSchedules();
    results.innerHTML = `
      <article class="route-result">
        <span class="status-pill status-pending">Route lookup unavailable</span>
        <p>${escapeHTML(error.message || "Could not calculate this route.")}</p>
        <p>You can still submit a bus service request for this journey.</p>
      </article>`;
    document.getElementById("request-from").value = from;
    document.getElementById("request-to").value = to;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Search Routes";
  }
});

document.getElementById("checkin-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const checkin = {
    source: cleanText(document.getElementById("checkin-from").value),
    destination: cleanText(document.getElementById("checkin-to").value),
    travel_time: document.getElementById("checkin-time").value,
    passengers: Number(document.getElementById("checkin-count").value)
  };

  if (!checkin.source || !checkin.destination || checkin.source.toLowerCase() === checkin.destination.toLowerCase() || checkin.passengers < 1) {
    showMessage("checkin-message", "Enter different locations and a valid passenger count.", true);
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:5001/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkin)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Check-in could not be saved.");
    showMessage("checkin-message", "Check-in saved to SQLite successfully. Record ID: " + result.id);
  } catch (error) {
    showMessage("checkin-message", "Could not save check-in. Start the SQLite backend and try again. " + error.message, true);
    return;
  }
  this.reset();
  document.getElementById("checkin-count").value = 1;
});

document.getElementById("request-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const request = {
    source: cleanText(document.getElementById("request-from").value),
    destination: cleanText(document.getElementById("request-to").value),
    preferred_time: document.getElementById("request-time").value,
    expected_passengers: Number(document.getElementById("request-count").value),
    reason: cleanText(document.getElementById("request-reason").value)
  };

  if (!request.source || !request.destination || request.source.toLowerCase() === request.destination.toLowerCase() || request.expected_passengers < 1 || !request.reason) {
    showMessage("request-message", "Please complete all fields with valid locations and passenger count.", true);
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:5001/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request could not be submitted.");
    showMessage("request-message", "Your bus request #" + result.id + " was saved and sent for automatic AI demand analysis. Any proposed bus schedule will be published only after admin approval.");
  } catch (error) {
    showMessage("request-message", "Could not submit request. Start the SQLite backend and try again. " + error.message, true);
    return;
  }
  this.reset();
  document.getElementById("request-count").value = 1;
  renderMyRequests();
});

async function renderPublishedSchedules() {
  const container = document.getElementById("published-schedules");
  if (!container) return;
  try {
    const response = await fetch("http://127.0.0.1:5001/api/schedules?published_only=true");
    if (!response.ok) throw new Error("Published schedules could not be loaded.");
    const schedules = await response.json();
    const matchingSchedules = activeScheduleRoute
      ? schedules.filter(item =>
          String(item.source).trim().toLowerCase() === activeScheduleRoute.from.trim().toLowerCase() &&
          String(item.destination).trim().toLowerCase() === activeScheduleRoute.to.trim().toLowerCase()
        )
      : schedules;

    if (!matchingSchedules.length) {
      container.innerHTML = activeScheduleRoute
        ? '<p class="muted-text">No admin-approved schedule matches ' +
          escapeHTML(activeScheduleRoute.from) + ' → ' + escapeHTML(activeScheduleRoute.to) +
          ' yet. You can submit a bus service request for this route.</p>'
        : '<p class="muted-text">No approved bus schedules have been published yet.</p>';
      return;
    }
    if (activeScheduleRoute) {
      container.innerHTML = '<p class="small-note">Showing approved schedules for ' +
        escapeHTML(activeScheduleRoute.from) + ' → ' + escapeHTML(activeScheduleRoute.to) + '.</p>';
    } else {
      container.innerHTML = "";
    }
    container.innerHTML += matchingSchedules.map(item => `
      <article class="request-result">
        <div class="request-top"><strong>${escapeHTML(item.source)} → ${escapeHTML(item.destination)}</strong><span class="status-pill status-approved">PUBLISHED</span></div>
        <p><strong>Time slot:</strong> ${escapeHTML(item.time_slot)}</p>
        <p><strong>Estimated demand:</strong> ${Number(item.predicted_passengers)} passengers · <strong>Suggested buses:</strong> ${Number(item.buses)}</p>
        <p><strong>Departure proposals:</strong> ${(item.departures || []).map(escapeHTML).join(" · ")}</p>
        ${item.admin_note ? `<p class="admin-note">Admin: ${escapeHTML(item.admin_note)}</p>` : ""}
        <p class="small-note">Admin-approved prototype schedule. Confirm with the bus operator before travelling.</p>
      </article>`).join("");
  } catch (error) {
    container.innerHTML = '<p class="error-message">Unable to load published schedules. Make sure the SQLite backend is running.</p>';
  }
}

async function renderMyRequests() {
  const container = document.getElementById("my-requests");
  try {
    const response = await fetch("http://127.0.0.1:5001/api/requests");
    if (!response.ok) throw new Error("Request list could not be loaded.");
    const requests = await response.json();
    if (!requests.length) {
      container.innerHTML = '<p class="muted-text">No requests submitted yet.</p>';
      return;
    }
    container.innerHTML = requests.map(item => `
      <article class="request-result">
        <div class="request-top"><strong>Request #${item.id}</strong><span class="status-pill ${item.status === "APPROVED" ? "status-approved" : item.status === "REJECTED" ? "status-rejected" : "status-available"}">${escapeHTML(item.status === "PENDING" ? "AI ANALYSIS" : item.status)}</span></div>
        <p>${escapeHTML(item.source)} → ${escapeHTML(item.destination)}</p>
        <p class="small-note">${escapeHTML(item.preferred_time)} · ${item.expected_passengers} passenger(s)</p>
        ${item.admin_note ? `<p class="admin-note">Admin: ${escapeHTML(item.admin_note)}</p>` : ""}
      </article>`).join("");
  } catch (error) {
    container.innerHTML = '<p class="error-message">Unable to load requests. Make sure the SQLite backend is running.</p>';
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function logoutPassenger() {
  localStorage.removeItem(STORAGE_KEYS.user);
  window.location.href = "login.html";
}

document.getElementById("route-date").min = new Date().toISOString().split("T")[0];
document.getElementById("route-date").value = new Date().toISOString().split("T")[0];
renderMyRequests();
renderPublishedSchedules();
initializeRouteMap();

// Keep the passenger portal synchronized with admin decisions.
// This refreshes request statuses and approved schedules without requiring
// the passenger to close and reopen the dashboard.
setInterval(() => {
  renderMyRequests();
  renderPublishedSchedules();
}, 15000);

const passengerCloudStatus = document.getElementById("cloud-status");
if (passengerCloudStatus) {
  fetch("http://127.0.0.1:5001/api/health")
    .then(response => { if (!response.ok) throw new Error("Backend unavailable"); return response.json(); })
    .then(() => passengerCloudStatus.textContent = "SQLite connected. Passenger check-ins and requests are saved in the local database.")
    .catch(() => passengerCloudStatus.textContent = "SQLite backend is offline. Start python backend/app.py.");
}
