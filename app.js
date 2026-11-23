const STORAGE_KEY = "smartroute-checkins-v1";
const $ = (id) => document.getElementById(id);

const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$("travelDate").value = localDate;
$("checkinDate").value = localDate;
$("travelDate").min = localDate;
$("checkinDate").min = localDate;

const sampleTrips = [
  { origin: "Khambhampadu", destination: "Tiruvuru Bus Stand", date: localDate, time: "08:00", passengers: 8 },
  { origin: "Avadi", destination: "Veltech Junction", date: localDate, time: "09:00", passengers: 5 },
  { origin: "Khambhampadu", destination: "Tiruvuru Bus Stand", date: localDate, time: "17:30", passengers: 4 }
];

function loadTrips() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? sampleTrips : JSON.parse(saved);
  } catch {
    return sampleTrips;
  }
}
let trips = loadTrips();

function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}
function clean(value) {
  return value.trim().replace(/\s+/g, " ");
}
function keyFor(trip) {
  return clean(trip.origin).toLowerCase() + "|" + clean(trip.destination).toLowerCase();
}
function groupedTrips() {
  const groups = new Map();
  trips.forEach((trip) => {
    const key = keyFor(trip);
    if (!groups.has(key)) groups.set(key, { origin: clean(trip.origin), destination: clean(trip.destination), passengers: 0, trips: 0 });
    const group = groups.get(key);
    group.passengers += Number(trip.passengers);
    group.trips += 1;
  });
  return [...groups.values()].sort((a, b) => b.passengers - a.passengers);
}
function renderDashboard() {
  const groups = groupedTrips();
  $("totalCheckins").textContent = trips.length;
  $("totalPassengers").textContent = trips.reduce((sum, trip) => sum + Number(trip.passengers), 0);
  $("routesExplored").textContent = groups.length;
  $("highDemand").textContent = groups.filter((group) => group.passengers >= 5).length;

  const rows = groups.map((group) => {
    const level = group.passengers >= 8 ? "High" : group.passengers >= 4 ? "Medium" : "Low";
    const action = level === "High" ? "Consider an extra trip" : level === "Medium" ? "Monitor demand" : "Keep current service";
    return `<tr><td>${escapeHtml(group.origin)}</td><td>${escapeHtml(group.destination)}</td><td><b>${group.passengers}</b></td><td><span class="level ${level.toLowerCase()}">${level}</span></td><td>${action}</td></tr>`;
  }).join("");
  $("demandRows").innerHTML = rows || '<tr><td colspan="5" class="empty-cell">No passenger trips recorded yet.</td></tr>';
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

$("checkinForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const trip = {
    origin: clean($("checkinOrigin").value),
    destination: clean($("checkinDestination").value),
    date: $("checkinDate").value,
    time: $("checkinTime").value,
    passengers: Number($("passengerCount").value)
  };
  if (trip.origin.toLowerCase() === trip.destination.toLowerCase()) {
    $("formMessage").textContent = "Origin and destination must be different.";
    return;
  }
  if (!Number.isInteger(trip.passengers) || trip.passengers < 1 || trip.passengers > 100) {
    $("formMessage").textContent = "Enter a passenger count between 1 and 100.";
    return;
  }
  trips.push(trip);
  saveTrips();
  renderDashboard();
  $("formMessage").textContent = "Check-in saved. Demand overview updated.";
  event.target.reset();
  $("checkinDate").value = localDate;
  $("checkinTime").value = "08:00";
  $("passengerCount").value = "1";
});

$("routeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const origin = clean($("origin").value);
  const destination = clean($("destination").value);
  if (origin.toLowerCase() === destination.toLowerCase()) {
    $("routeResults").textContent = "Choose two different locations.";
    return;
  }
  const matching = trips.filter((trip) =>
    clean(trip.origin).toLowerCase() === origin.toLowerCase() &&
    clean(trip.destination).toLowerCase() === destination.toLowerCase()
  );
  const passengerTotal = matching.reduce((sum, trip) => sum + Number(trip.passengers), 0);
  const demand = passengerTotal >= 8 ? "High demand" : passengerTotal >= 4 ? "Medium demand" : "Limited recorded demand";
  const suggestions = [
    { title: "Direct connection", detail: "Suggested first option for this origin and destination.", time: "Preferred" },
    { title: "Demand-based service", detail: matching.length ? `${passengerTotal} passenger(s) recorded across ${matching.length} check-in(s). ${demand}.` : "No matching check-ins yet. Add passenger data to estimate demand.", time: matching.length && passengerTotal >= 8 ? "Prioritize" : "Monitor" },
    { title: "Schedule planning", detail: "Review local bus timings and confirm actual service with the transport operator.", time: "Verify" }
  ];
  $("routeResults").innerHTML = suggestions.map((item) =>
    `<div class="route-result"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></div><span>${escapeHtml(item.time)}</span></div>`
  ).join("");
});

$("resetDemo").addEventListener("click", () => {
  if (!confirm("Reset all check-ins and restore the sample trips?")) return;
  trips = [...sampleTrips];
  saveTrips();
  renderDashboard();
  $("routeResults").textContent = "Demo data restored.";
  $("formMessage").textContent = "Sample data restored.";
});

renderDashboard();