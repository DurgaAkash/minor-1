/* Pan-India scheduled bus search with optional GTFS-Realtime matching.
 * Sources: India_GTFS feed catalogue and Reclaim public GTFS/GTFS-RT mirrors.
 * Timetable records are source-feed schedules; live status is shown only when a fresh
 * vehicle-position feed contains a matching trip or route. No synthetic bus IDs are created.
 */
(function () {
  "use strict";

  const CATALOG_URL = "https://maps.reclaim.city/gtfs/feeds.json";
  const NETWORK_CACHE = new Map();
  const LIVE_CACHE = new Map();
  const LIVE_NETWORKS = new Set(["apsrtc", "mapsv2", "delhi", "mumbai", "gurugram", "bengaluru", "tgsrtc", "osrtc", "tricity", "hr", "amts"]);
  const STATE_ALIASES = {
    "nct of delhi": "Delhi", "delhi": "Delhi", "odisha": "Odisha", "orissa": "Odisha",
    "uttaranchal": "Uttarakhand", "pondicherry": "Puducherry", "jammu and kashmir": "Jammu and Kashmir"
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function csvRows(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") {
        row.push(cell.replace(/\r$/, ""));
        if (row.some(v => v !== "")) rows.push(row);
        row = []; cell = "";
      } else cell += ch;
    }
    row.push(cell.replace(/\r$/, ""));
    if (row.some(v => v !== "")) rows.push(row);
    if (!rows.length) return [];
    const headers = rows.shift();
    return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ""])));
  }

  function dateParts(dateText) {
    const [y, m, d] = dateText.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return { key: dateText.replace(/-/g, ""), weekday: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()] };
  }

  function activeServices(calendarText, exceptionsText, dateText) {
    const { key, weekday } = dateParts(dateText);
    const active = new Set();
    csvRows(calendarText || "").forEach(row => {
      if (key >= row.start_date && key <= row.end_date && row[weekday] === "1") active.add(row.service_id);
    });
    csvRows(exceptionsText || "").forEach(row => {
      if (row.date === key) {
        if (row.exception_type === "1") active.add(row.service_id);
        if (row.exception_type === "2") active.delete(row.service_id);
      }
    });
    return active;
  }

  function distanceKm(aLat, aLon, bLat, bLon) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function geocode(place) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=" + encodeURIComponent(place + ", India");
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Location lookup failed while searching bus data.");
    const list = await response.json();
    if (!list.length) throw new Error("Could not identify " + place + " in India.");
    const item = list[0];
    let state = item.address && (item.address.state || item.address.region || item.address.state_district);
    state = state ? (STATE_ALIASES[state.toLowerCase()] || state) : "";
    return { lat: Number(item.lat), lon: Number(item.lon), state, label: item.display_name };
  }

  async function loadCatalog() {
    if (window.__smartrouteFeedCatalog) return window.__smartrouteFeedCatalog;
    const response = await fetch(CATALOG_URL);
    if (!response.ok) throw new Error("The India bus-feed catalogue is unavailable right now.");
    const catalog = await response.json();
    if (!catalog.feeds || !Array.isArray(catalog.feeds)) throw new Error("The bus-feed catalogue returned an unexpected format.");
    window.__smartrouteFeedCatalog = catalog;
    return catalog;
  }

  async function loadFeed(feed) {
    if (NETWORK_CACHE.has(feed.id)) return NETWORK_CACHE.get(feed.id);
    if (!window.JSZip) throw new Error("The timetable reader could not be loaded. Refresh the page and try again.");
    const response = await fetch(feed.mirror || "https://maps.reclaim.city/gtfs/" + encodeURIComponent(feed.id) + ".zip");
    if (!response.ok) throw new Error("Could not download the " + feed.name + " timetable.");
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    async function read(name) {
      const file = zip.file(name);
      return file ? csvRows(await file.async("text")) : [];
    }
    const [stops, routes, trips, stopTimes, calendar, calendarDates, agencies] = await Promise.all([
      read("stops.txt"), read("routes.txt"), read("trips.txt"), read("stop_times.txt"),
      read("calendar.txt"), read("calendar_dates.txt"), read("agency.txt")
    ]);
    const data = { feed, stops, routes, trips, stopTimes, calendar, calendarDates, agencies };
    NETWORK_CACHE.set(feed.id, data);
    return data;
  }

  function formatTime(gtfsTime) {
    if (!gtfsTime || !/^\d{1,3}:\d{2}:\d{2}$/.test(gtfsTime)) return gtfsTime || "Not published";
    const [h, m] = gtfsTime.split(":").map(Number);
    const dayOffset = Math.floor(h / 24);
    const hour = h % 24;
    const formatted = String(hour % 12 || 12).padStart(2, "0") + ":" + String(m).padStart(2, "0") + (hour < 12 ? " AM" : " PM");
    return formatted + (dayOffset ? " (+" + dayOffset + " day)" : "");
  }

  async function loadLive(feed) {
    const realtime = feed.realtime || {};
    const endpoint = realtime.vehicle_positions;
    if (!endpoint) return { status: "NO_FEED", vehicles: [] };
    const url = endpoint.replace(/\.pb(?:\?.*)?$/, ".json");
    if (LIVE_CACHE.has(url) && Date.now() - LIVE_CACHE.get(url).at < 15000) return LIVE_CACHE.get(url).data;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Live positions unavailable");
      const payload = await response.json();
      const vehicles = (payload.entity || []).filter(e => e.vehicle && e.vehicle.position).map(e => ({
        tripId: e.vehicle.trip && e.vehicle.trip.tripId,
        routeId: e.vehicle.trip && e.vehicle.trip.routeId,
        label: e.vehicle.vehicle && (e.vehicle.vehicle.label || e.vehicle.vehicle.id),
        lat: Number(e.vehicle.position.latitude),
        lon: Number(e.vehicle.position.longitude),
        speed: e.vehicle.position.speed == null ? null : Number(e.vehicle.position.speed),
        timestamp: Number(e.vehicle.timestamp || payload.header && payload.header.timestamp || 0)
      }));
      const data = { status: "OK", vehicles, feedTimestamp: Number(payload.header && payload.header.timestamp || 0) };
      LIVE_CACHE.set(url, { at: Date.now(), data });
      return data;
    } catch {
      return { status: "UNAVAILABLE", vehicles: [] };
    }
  }

  async function searchFeed(data, origin, destination, dateText) {
    const active = activeServicesFromData(data, dateText);
    if (!active.size) return [];
    const originStops = data.stops.filter(s => s.stop_lat && s.stop_lon &&
      distanceKm(origin.lat, origin.lon, Number(s.stop_lat), Number(s.stop_lon)) <= 5);
    const destinationStops = data.stops.filter(s => s.stop_lat && s.stop_lon &&
      distanceKm(destination.lat, destination.lon, Number(s.stop_lat), Number(s.stop_lon)) <= 5);
    if (!originStops.length || !destinationStops.length) return [];

    const originIds = new Set(originStops.map(s => s.stop_id));
    const destinationIds = new Set(destinationStops.map(s => s.stop_id));
    const trips = new Map(data.trips.filter(t => active.has(t.service_id)).map(t => [t.trip_id, t]));
    const routeMap = new Map(data.routes.map(r => [r.route_id, r]));
    const agencyMap = new Map(data.agencies.map(a => [a.agency_id, a.agency_name]));
    const grouped = new Map();
    data.stopTimes.forEach(st => {
      if (!trips.has(st.trip_id)) return;
      if (!grouped.has(st.trip_id)) grouped.set(st.trip_id, []);
      grouped.get(st.trip_id).push(st);
    });

    const matches = [];
    for (const [tripId, times] of grouped) {
      times.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
      let start = null, end = null;
      for (let i = 0; i < times.length; i++) {
        if (!start && originIds.has(times[i].stop_id)) start = { ...times[i], index: i };
        if (start && destinationIds.has(times[i].stop_id) && i > start.index) { end = times[i]; break; }
      }
      if (!start || !end) continue;
      const trip = trips.get(tripId);
      const route = routeMap.get(trip.route_id) || {};
      const startStop = data.stops.find(s => s.stop_id === start.stop_id) || {};
      const endStop = data.stops.find(s => s.stop_id === end.stop_id) || {};
      matches.push({
        feed: data.feed, tripId, routeId: trip.route_id,
        routeName: [route.route_short_name, route.route_long_name].filter(Boolean).join(" · ") || "Route " + trip.route_id,
        agency: agencyMap.get(route.agency_id) || data.feed.name,
        headsign: trip.trip_headsign || "",
        fromStop: startStop.stop_name || origin.label,
        toStop: endStop.stop_name || destination.label,
        departure: start.departure_time || start.arrival_time,
        arrival: end.arrival_time || end.departure_time,
        startLat: Number(startStop.stop_lat), startLon: Number(startStop.stop_lon),
        endLat: Number(endStop.stop_lat), endLon: Number(endStop.stop_lon)
      });
      if (matches.length >= 25) break;
    }
    return matches;
  }

  function activeServicesFromData(data, dateText) {
    const active = new Set();
    const { key, weekday } = dateParts(dateText);
    data.calendar.forEach(row => {
      if (key >= row.start_date && key <= row.end_date && row[weekday] === "1") active.add(row.service_id);
    });
    data.calendarDates.forEach(row => {
      if (row.date === key) {
        if (row.exception_type === "1") active.add(row.service_id);
        if (row.exception_type === "2") active.delete(row.service_id);
      }
    });
    // Feeds without calendars are treated as schedule-only, not silently assumed daily.
    return active;
  }

  function liveCard(match, live) {
    if (!live || live.status !== "OK") return '<p class="small-note">Live GPS: unavailable for this feed at the moment. Timetable only.</p>';
    const vehicle = live.vehicles.find(v => v.tripId === match.tripId || (v.routeId && v.routeId === match.routeId));
    if (!vehicle) return '<p class="small-note">No live vehicle currently matched to this scheduled trip. This does not mean the service is cancelled.</p>';
    const ageSeconds = vehicle.timestamp ? Math.max(0, Math.round(Date.now() / 1000 - vehicle.timestamp)) : null;
    const fresh = ageSeconds !== null && ageSeconds <= 180;
    const label = vehicle.label ? esc(vehicle.label) : "Vehicle label not supplied";
    const speed = vehicle.speed == null ? "" : " · " + (vehicle.speed * 3.6).toFixed(0) + " km/h";
    const updated = ageSeconds === null ? "Timestamp not supplied" : ageSeconds < 60 ? "updated " + ageSeconds + " sec ago" : "updated " + Math.round(ageSeconds / 60) + " min ago";
    return '<p><strong>Live vehicle:</strong> ' + label + speed + '</p><p class="small-note">' +
      (fresh ? "LIVE GPS · " : "GPS DATA MAY BE STALE · ") + updated +
      ' · <a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + vehicle.lat + '&mlon=' + vehicle.lon + '#map=15/' + vehicle.lat + '/' + vehicle.lon + '">View current position</a></p>';
  }

  window.searchIndiaBuses = async function (fromText, toText, dateText) {
    const wrapper = '<section class="india-bus-results"><h3>Real bus services across India</h3><p class="small-note">Searching published GTFS bus timetables. Live GPS appears only for networks that publish a matching real-time feed.</p>';
    try {
      const [origin, destination, catalog] = await Promise.all([geocode(fromText), geocode(toText), loadCatalog()]);
      const states = [...new Set([origin.state, destination.state].filter(Boolean))];
      const feeds = catalog.feeds.filter(feed =>
        Array.isArray(feed.modes) && feed.modes.includes("bus") &&
        (states.length ? states.some(state => feed.state.toLowerCase() === state.toLowerCase()) : false)
      );
      if (!feeds.length) return wrapper + '<p class="muted-text">No bus timetable feed is listed for the identified state(s): ' + esc(states.join(", ") || "state not identified") + '.</p></section>';

      const allMatches = [];
      const feedErrors = [];
      for (const feed of feeds) {
        try {
          const data = await loadFeed(feed);
          const found = await searchFeed(data, origin, destination, dateText);
          found.forEach(item => allMatches.push(item));
        } catch (error) {
          feedErrors.push(feed.name + ": " + error.message);
        }
      }

      allMatches.sort((a, b) => a.departure.localeCompare(b.departure));
      if (!allMatches.length) {
        const errorNote = feedErrors.length ? '<p class="small-note">Some regional feeds could not be loaded. ' + esc(feedErrors.slice(0, 2).join("; ")) + '</p>' : "";
        return wrapper + '<p class="muted-text">No matching published bus trip was found near both locations for ' + esc(dateText) + ' in the available state feeds. This catalogue does not cover every operator or village route.</p>' + errorNote + '</section>';
      }

      const liveFeeds = [...new Map(allMatches.filter(m => m.feed.realtime && m.feed.realtime.vehicle_positions).map(m => [m.feed.id, m.feed])).values()];
      const liveByFeed = new Map();
      await Promise.all(liveFeeds.map(async feed => {
        liveByFeed.set(feed.id, await loadLive(feed));
      }));

      const cards = allMatches.slice(0, 12).map(match => {
        const live = liveByFeed.get(match.feed.id);
        const isLiveSupported = Boolean(match.feed.realtime && match.feed.realtime.vehicle_positions);
        const scheduleNote = match.feed.note ? '<p class="small-note">Feed note: ' + esc(match.feed.note) + '</p>' : "";
        return '<article class="india-bus-card"><div class="india-bus-top"><span class="status-pill status-available">PUBLISHED TIMETABLE</span><span class="small-note">' + esc(match.feed.state) + '</span></div>' +
          '<h4>' + esc(match.routeName) + '</h4><p><strong>Operator:</strong> ' + esc(match.agency) + '</p>' +
          '<p><strong>Board:</strong> ' + esc(match.fromStop) + ' · <strong>Alight:</strong> ' + esc(match.toStop) + '</p>' +
          '<p><strong>Departure:</strong> ' + esc(formatTime(match.departure)) + ' · <strong>Arrival:</strong> ' + esc(formatTime(match.arrival)) + '</p>' +
          '<p><strong>Trip reference:</strong> ' + esc(match.tripId) + '</p>' +
          (isLiveSupported ? liveCard(match, live) : '<p class="small-note">This network does not publish a live vehicle-position feed. Timetable only.</p>') +
          scheduleNote + '<p class="small-note">Source feed: ' + esc(match.feed.name) + ' · <a target="_blank" rel="noopener" href="https://github.com/reclaimchennai/India_GTFS">feed catalogue</a></p></article>';
      }).join("");
      const liveCount = [...liveByFeed.values()].filter(v => v.status === "OK").length;
      return wrapper + '<p class="small-note">Found ' + allMatches.length + ' matching trip(s) in ' + feeds.length + ' state feed(s). Live feed checks completed: ' + liveCount + '.</p>' + cards +
        '<p class="small-note">Data coverage and freshness vary by operator. Some catalogue feeds are community-built or indicative rather than official operator timetables. Verify with the operator before travel.</p></section>';
    } catch (error) {
      return wrapper + '<p class="error-message">' + esc(error.message || "Bus search is temporarily unavailable.") + '</p></section>';
    }
  };
})();