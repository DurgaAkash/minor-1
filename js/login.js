// Demo passenger sign-in. Replace with secure backend authentication before deployment.
function passengerLogin() {
  const username = document.getElementById("passenger-username").value.trim();
  const password = document.getElementById("passenger-password").value;
  const error = document.getElementById("login-error");

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

document.getElementById("passenger-password").addEventListener("keydown", event => {
  if (event.key === "Enter") passengerLogin();
}
);