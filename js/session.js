/* === GUARDIÃO DE SESSÃO (session.js) ===
   - Carregar em páginas internas após auth.js
   - Bloqueia acesso sem login redirecionando para a página inicial
   - Trata os cliques nos botões de "Sair" do sistema
*/

/**
 * Evento disparado quando o HTML da página protegida termina de ser analisado pelo navegador.
 * Atua como um "middleware" de segurança no frontend.
 * 
 * Fluxo:
 * 1. Confere se o módulo de autenticação (`window.ZyonAuth`) foi carregado corretamente.
 * 2. Valida se há uma sessão ativa (`requireAuth`). Se não houver, o usuário é chutado para a página de Login.
 * 3. Se passou na validação de segurança, procura todos os botões de "Sair" na tela e atrela a eles o evento de deslogar.
 * 
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const auth = window.ZyonAuth;
  
  // Se o módulo de autenticação (auth.js) não foi carregado no HTML antes do session.js, aborta a execução
  if (!auth) return;

  // Verifica se o usuário tem permissão para acessar a página atual.
  // Se requireAuth() retornar false, significa que o token de sessão é inválido e o JavaScript já forçou um `window.location.replace` para a tela de login.
  if (!auth.requireAuth()) return;

  // Como o usuário está logado e autorizado a ver a página, 
  // vincula o evento de clique aos botões que encerram a sessão (ex: Link "Sair" na Sidebar).
  auth.bindLogoutLinks();
});
