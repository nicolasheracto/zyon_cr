/* === AUTENTICAÇÃO (auth.js) ===
   - Credenciais fixas para ambiente local/demo
   - Sessão persistida em sessionStorage */

(() => {
  const SESSION_KEY = 'zyon_session';

  const CREDENTIALS = {
    username: 'admin',
    password: 'admin'
  };

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.username) return null;
      return session;
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    return Boolean(getSession());
  }

  function login(username, password) {
    const user = String(username ?? '').trim();
    const pass = String(password ?? '');

    if (user !== CREDENTIALS.username || pass !== CREDENTIALS.password) {
      return { ok: false, message: 'Usuário ou senha inválidos.' };
    }

    const session = {
      username: CREDENTIALS.username,
      loggedAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  function requireAuth() {
    if (!isAuthenticated()) {
      window.location.replace('index.html');
      return false;
    }
    return true;
  }

  function bindLogoutLinks(selector = 'a.logout') {
    document.querySelectorAll(selector).forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      });
    });
  }

  window.ZyonAuth = {
    login,
    logout,
    getSession,
    isAuthenticated,
    requireAuth,
    bindLogoutLinks
  };
})();
