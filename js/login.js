// Starter keyword-based intent recognition. This is not authentication.
function showIntent() {
  const input = document.getElementById("login-intent");
  const output = document.getElementById("intent-result");
  const message = input.value.toLowerCase();

  if (!message.trim()) {
    output.textContent = "Please enter a message first.";
    return;
  }

  const passengerWords = ["passenger", "traveller", "travel", "bus", "route"];
  const wantsPassenger = passengerWords.some(word => message.includes(word));

  output.textContent = wantsPassenger
    ? "We understood that you need passenger services. Passenger sign-in will be added next."
    : "Please tell us whether you need passenger travel services.";

  output.style.color = wantsPassenger ? "#16845b" : "#a45b19";
}