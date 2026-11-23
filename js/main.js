// Home page interactions for SmartRoute AI.
document.addEventListener("DOMContentLoaded", () => {
  const year = new Date().getFullYear();
  const footer = document.querySelector(".site-footer");
  if (footer) {
    const yearLabel = document.createElement("span");
    yearLabel.textContent = String(year);
    footer.appendChild(yearLabel);
  }
});