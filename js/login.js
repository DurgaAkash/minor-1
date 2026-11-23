// Basic NLP-style intent detection using keywords and phrases.
// This is a beginner-friendly demo, not a real AI model or secure authentication.

function showIntent() {
  const input = document.getElementById("login-intent");
  const output = document.getElementById("intent-result");
  const loginBox = document.getElementById("passenger-login");
  const message = input.value.toLowerCase().trim();

  loginBox.hidden = true;

  if (!message) {
    output.textContent = "Please describe what you want to do.";
    output.className = "form-message error-message";
    return;
  }

  const travelWords = [
    "passenger", "travel", "traveller", "bus", "route",
    "journey", "ticket", "schedule", "transport", "trip"
  ];

  const isPassengerIntent = travelWords.some(word => message.includes(word));

  if (isPassengerIntent) {
    output.textContent = "Passenger travel request detected. Please sign in below.";
    output.className = "form-message success-message";
    loginBox.hidden = false;
  } else {
    output.textContent = "I could not identify a travel request. Try saying: “I want to travel by bus”.";
    output.className = "form-message error-message";
  }
}

function passengerLogin() {
  const username = document.getElementById("passenger-username").value.trim();
  const password = document.getElementById("passenger-password").value;
  const error = document.getElementById("login-error");

  // Demo-only credentials. Replace with backend authentication before deployment.
  if (username === "passenger" && password === "travel123") {
    localStorage.setItem("smartrouteUser", JSON.stringify({
      username: "passenger",
      role: "passenger"
    }));
    window.location.href = "passenger.html";
  } else {
    error.textContent = "Invalid demo username or password. Please try again.";
    error.className = "form-message error-message";
  }
}