/* === TELA DE LOGIN (login.js) ===
   - Valida credenciais via ZyonAuth e redireciona ao dashboard */

document.addEventListener('DOMContentLoaded', () => {
  const auth = window.ZyonAuth;
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('loginError');
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !auth) return;

  if (auth.isAuthenticated()) {
    window.location.replace('dashboard.html');
    return;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    if (submitBtn) submitBtn.disabled = true;

    const result = auth.login(usernameInput.value, passwordInput.value);

    if (result.ok) {
      window.location.href = 'dashboard.html';
      return;
    }

    showError(result.message);
    passwordInput.value = '';
    passwordInput.focus();
    if (submitBtn) submitBtn.disabled = false;
  });

  usernameInput?.addEventListener('input', clearError);
  passwordInput?.addEventListener('input', clearError);
});
