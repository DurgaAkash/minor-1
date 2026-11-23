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

// Demo route catalogue. The search uses the passenger's entered locations;
// the catalogue will later be replaced/extended with dataset and admin-managed routes.
const demoRoutes = [
  { from: "khambhampadu", to: "tiruvuru", service: "Rural Link 101", time: "07:30 AM", duration: "35 min" },
  { from: "avadi", to: "veltech junction", service: "Village Connect 202", time: "08:00 AM", duration: "25 min" },
  { from: "tiruvuru", to: "vijayawada", service: "Town Express 303", time: "09:15 AM", duration: "1 hr 40 min" }
];

// Interactive map: Leaflet + OpenStreetMap, with Nominatim geocoding and OSRM routing.
let routeMap;
let routeLayer;
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
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(place);
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
    message.textContent = "Map route loaded • Approx. " + distanceKm + " km • " +
      (durationMin >= 60 ? Math.floor(durationMin / 60) + " hr " + durationMin % 60 + " min" : durationMin + " min") +
      ". Estimated road route, not live bus tracking.";
  } catch (error) {
    message.textContent = error.message || "Unable to load the map route right now.";
  }
}

document.getElementById("route-form").addEventListener("submit", function (event) {
  event.preventDefault();
  const from = cleanText(document.getElementById("route-from").value);
  const to = cleanText(document.getElementById("route-to").value);
  const date = document.getElementById("route-date").value;
  const results = document.getElementById("route-results");
  showRouteOnMap(from, to);

  if (from.toLowerCase() === to.toLowerCase()) {
    results.innerHTML = '<p class="error-message">Starting point and destination must be different.</p>';
    return;
  }

  const matches = demoRoutes.filter(route =>
    route.from === from.toLowerCase() && route.to === to.toLowerCase()
  );

  if (matches.length) {
    results.innerHTML = matches.map(route => `
      <article class="route-result">
        <span class="status-pill status-available">Sample route</span>
        <h3>${route.service}</h3>
        <p><strong>${from}</strong> → <strong>${to}</strong></p>
        <p>Departure: ${route.time} · Approx. travel: ${route.duration}</p>
        <p class="small-note">Travel date: ${date}</p>
      </article>
    `).join("");
  } else {
    results.innerHTML = `
      <article class="route-result">
        <span class="status-pill status-pending">No sample route found</span>
        <h3>Help us connect this route</h3>
        <p>We do not have a route record for <strong>${from}</strong> to <strong>${to}</strong> in this starter demo.</p>
        <p>Submit a bus service request below so the admin can review the travel demand.</p>
      </article>`;
    document.getElementById("request-from").value = from;
    document.getElementById("request-to").value = to;
  }
});

document.getElementById("checkin-form").addEventListener("submit", function (event) {
  event.preventDefault();
  const checkin = {
    id: "CI-" + Date.now(),
    from: cleanText(document.getElementById("checkin-from").value),
    to: cleanText(document.getElementById("checkin-to").value),
    time: document.getElementById("checkin-time").value,
    passengers: Number(document.getElementById("checkin-count").value),
    createdAt: new Date().toISOString()
  };

  if (!checkin.from || !checkin.to || checkin.from.toLowerCase() === checkin.to.toLowerCase() || checkin.passengers < 1) {
    showMessage("checkin-message", "Enter different locations and a valid passenger count.", true);
    return;
  }

  const checkins = readList(STORAGE_KEYS.checkins);
  checkins.push(checkin);
  saveList(STORAGE_KEYS.checkins, checkins);
  showMessage("checkin-message", "Check-in saved. Thank you for helping us measure rural travel demand.");
  this.reset();
  document.getElementById("checkin-count").value = 1;
});

document.getElementById("request-form").addEventListener("submit", function (event) {
  event.preventDefault();
  const request = {
    id: "SR-" + Date.now(),
    from: cleanText(document.getElementById("request-from").value),
    to: cleanText(document.getElementById("request-to").value),
    time: document.getElementById("request-time").value,
    passengers: Number(document.getElementById("request-count").value),
    reason: cleanText(document.getElementById("request-reason").value),
    status: "PENDING",
    adminNote: "",
    createdAt: new Date().toISOString()
  };

  if (!request.from || !request.to || request.from.toLowerCase() === request.to.toLowerCase() || request.passengers < 1 || !request.reason) {
    showMessage("request-message", "Please complete all fields with valid locations and passenger count.", true);
    return;
  }

  const requests = readList(STORAGE_KEYS.requests);
  requests.push(request);
  saveList(STORAGE_KEYS.requests, requests);
  showMessage("request-message", "Your request " + request.id + " has been saved for admin review.");
  this.reset();
  document.getElementById("request-count").value = 1;
  renderMyRequests();
initializeRouteMap();
});

function renderMyRequests() {
  const container = document.getElementById("my-requests");
  const requests = readList(STORAGE_KEYS.requests).slice().reverse();

  if (!requests.length) {
    container.innerHTML = '<p class="muted-text">No requests submitted yet.</p>';
    return;
  }

  container.innerHTML = requests.map(request => `
    <article class="request-result">
      <div class="request-top"><strong>${request.id}</strong><span class="status-pill ${request.status === "APPROVED" ? "status-approved" : request.status === "REJECTED" ? "status-rejected" : "status-pending"}">${request.status}</span></div>
      <p>${escapeHTML(request.from)} → ${escapeHTML(request.to)}</p>
      <p class="small-note">${escapeHTML(request.time)} · ${request.passengers} passenger(s)</p>
      ${request.adminNote ? `<p class="admin-note">Admin: ${escapeHTML(request.adminNote)}</p>` : ""}
    </article>
  `).join("");
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
initializeRouteMap();