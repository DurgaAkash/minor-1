const API_BASE = "http://127.0.0.1:5001/api";
let watchId = null;
let activeScheduleId = null;
let activePin = null;
let lastSentAt = 0;
let sendingLocation = false;

function localDateString() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

function driverMessage(message, isError = false) {
  const element = document.getElementById("driver-tracking-message");
  element.textContent = message;
  element.className = isError ? "form-message error-message" : "form-message success-message";
}

async function sendLocation(position) {
  if (!activeScheduleId || !activePin || sendingLocation) return;
  if (Date.now() - lastSentAt < 9000) return;
  sendingLocation = true;
  const coords = position.coords;
  try {
    const response = await fetch(API_BASE + "/tracking/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule_id: activeScheduleId,
        pin: activePin,
        travel_date: localDateString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Location update failed.");
    lastSentAt = Date.now();
    driverMessage("GPS sharing is active. Last sent at " + new Date().toLocaleTimeString() +
      (coords.accuracy ? " · Accuracy ±" + Math.round(coords.accuracy) + " m" : ""));
  } catch (error) {
    driverMessage(error.message || "Unable to send GPS position.", true);
  } finally {
    sendingLocation = false;
  }
}

function startTracking() {
  if (!navigator.geolocation) {
    driverMessage("This browser does not support GPS location.", true);
    return;
  }
  const scheduleId = Number(document.getElementById("tracking-schedule-id").value);
  const pin = document.getElementById("tracking-pin").value.trim();
  if (!Number.isInteger(scheduleId) || scheduleId < 1 || !/^\\d{8}$/.test(pin)) {
    driverMessage("Enter a valid schedule ID and the 8-digit PIN.", true);
    return;
  }
  activeScheduleId = scheduleId;
  activePin = pin;
  lastSentAt = 0;
  driverMessage("Requesting GPS permission from your phone...");
  watchId = navigator.geolocation.watchPosition(sendLocation, error => {
    const messages = {
      1: "Location permission denied. Allow location access in browser settings.",
      2: "GPS position is unavailable. Check location settings.",
      3: "GPS request timed out. Waiting for another position..."
    };
    driverMessage(messages[error.code] || "Unable to read GPS location.", true);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  document.getElementById("start-tracking").disabled = true;
  document.getElementById("stop-tracking").disabled = false;
}

async function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  const scheduleId = activeScheduleId;
  const pin = activePin;
  activeScheduleId = null;
  activePin = null;
  document.getElementById("start-tracking").disabled = false;
  document.getElementById("stop-tracking").disabled = true;
  if (scheduleId && pin) {
    try {
      const response = await fetch(API_BASE + "/tracking/location", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId, pin, travel_date: localDateString() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not stop tracking on server.");
      driverMessage("GPS sharing stopped. The current location has been cleared.");
    } catch (error) {
      driverMessage("GPS sharing stopped on this phone, but server cleanup failed: " + error.message, true);
    }
  } else {
    driverMessage("GPS sharing is stopped.");
  }
}

document.getElementById("start-tracking").addEventListener("click", startTracking);
document.getElementById("stop-tracking").addEventListener("click", stopTracking);
window.addEventListener("beforeunload", () => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
});
