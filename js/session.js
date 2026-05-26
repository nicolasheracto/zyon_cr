/* === GUARDIÃO DE SESSÃO (session.js) ===
   - Carregar em páginas internas após auth.js
   - Bloqueia acesso sem login e trata o botão Sair */

document.addEventListener('DOMContentLoaded', () => {
  const auth = window.ZyonAuth;
  if (!auth) return;

  if (!auth.requireAuth()) return;

  auth.bindLogoutLinks();
});
