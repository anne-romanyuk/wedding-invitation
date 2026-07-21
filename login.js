const form = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const errorText = document.getElementById("loginError");
const requestedReturnTo = new URLSearchParams(location.search).get("returnTo");
const returnTo = requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
  ? requestedReturnTo
  : "/editor.html";

fetch("/api/auth/status")
  .then((response) => response.json())
  .then((status) => {
    if (status.authenticated) location.replace(returnTo.startsWith("/") ? returnTo : "/editor.html");
  })
  .catch(() => {});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  errorText.textContent = "";
  passwordInput.removeAttribute("aria-invalid");
  button.disabled = true;
  button.textContent = "Входим…";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value, returnTo })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Не удалось войти");
    location.replace(result.returnTo || "/editor.html");
  } catch (error) {
    passwordInput.setAttribute("aria-invalid", "true");
    errorText.textContent = error.message;
    passwordInput.focus();
  } finally {
    button.disabled = false;
    button.textContent = "Войти";
  }
});
