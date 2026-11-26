// Passenger sign-in uses the Flask API. Passwords are never stored in the browser.
async function passengerLogin() {
  const username = document.getElementById("passenger-username").value.trim();
  const password = document.getElementById("passenger-password").value;
  const error = document.getElementById("login-error");
  error.textContent = "";
  try {
    const response = await fetch(window.SMARTROUTE_API_BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sign-in failed.");
    if (result.user.role !== "passenger") throw new Error("This account is not a passenger account.");
    localStorage.setItem("smartrouteToken", result.token);
    localStorage.setItem("smartrouteUser", JSON.stringify(result.user));
    window.location.href = "passenger.html";
  } catch (problem) {
    error.textContent = problem.message || "Unable to sign in. Check that the backend is running.";
    error.className = "form-message error-message";
  }
}
document.getElementById("passenger-password").addEventListener("keydown", event => {
  if (event.key === "Enter") passengerLogin();
});
