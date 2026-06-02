/* === TELA DE LOGIN (login.js) ===
   - Valida credenciais via ZyonAuth e redireciona ao dashboard
   - Interage com a UI para mostrar erros de autenticação
*/

/**
 * Script de controle exclusivo da página `index.html` (Tela de Login).
 * Gerencia a submissão do formulário, as mensagens de erro visuais e o bloqueio do botão durante o carregamento.
 * 
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Obtém a instância global de autenticação injetada pelo auth.js
  const auth = window.ZyonAuth;
  
  // Seleção de elementos da interface do usuário (DOM)
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('loginError');
  const submitBtn = form?.querySelector('button[type="submit"]');

  // Aborta a execução para evitar erros de console se o HTML estiver sem os campos esperados
  if (!form || !auth) return;

  // Proteção UX: Se o usuário logado acessar a página index.html (ex: clicou em voltar),
  // ele não precisa ver o formulário de login de novo. Redireciona ele pro dashboard automaticamente.
  if (auth.isAuthenticated()) {
    window.location.replace('dashboard.html');
    return;
  }

  /**
   * Exibe uma mensagem de texto vermelha alertando o usuário sobre uma falha de credencial.
   * Modifica a propriedade hidden da div de alerta (`<div id="loginError">`).
   * 
   * @param {string} message - A mensagem de erro a ser exibida (Ex: "Usuário ou senha inválidos").
   * @returns {void}
   */
  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  /**
   * Oculta a div de alerta e apaga seu texto interno.
   * Acionado antes de uma nova tentativa de login ou enquanto o usuário digita.
   * 
   * @returns {void}
   */
  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  /**
   * Listener de submissão do formulário. Disparado ao apertar "Enter" ou clicar em "Entrar".
   * 
   * @param {SubmitEvent} event - O objeto de evento disparado pelo HTMLFormElement.
   */
  form.addEventListener('submit', (event) => {
    // Interrompe o comportamento padrão do navegador que recarregaria a página inteira
    event.preventDefault();
    
    clearError();

    // Desabilita o botão para evitar múltiplos disparos de API (Duplos cliques ansiosos)
    if (submitBtn) submitBtn.disabled = true;

    // Repassa os valores preenchidos no form para o core de Autenticação (auth.js) processar a lógica
    const result = auth.login(usernameInput.value, passwordInput.value);

    // Se a credencial bateu com o mock/banco: Acesso Permitido
    if (result.ok) {
      window.location.href = 'dashboard.html';
      return;
    }

    // ==========================================
    // FALHA NO LOGIN (Acesso Negado)
    // ==========================================
    
    // Exibe o motivo do erro na tela
    showError(result.message);
    
    // Limpa a senha errada por questão de UX e devolve o cursor piscante para o campo da senha
    passwordInput.value = '';
    passwordInput.focus();
    
    // Libera o botão de Submit para o usuário tentar errar de novo
    if (submitBtn) submitBtn.disabled = false;
  });

  // UX Fix: Assim que o usuário toca no teclado para corrigir a senha/nome, a mensagem de erro vermelha some.
  usernameInput?.addEventListener('input', clearError);
  passwordInput?.addEventListener('input', clearError);
});
