/* === AUTENTICAÇÃO (auth.js) ===
   - Credenciais fixas para ambiente local/demo
   - Sessão persistida em sessionStorage, o que significa que o login expira ao fechar a aba
*/

(() => {
  // Chave utilizada para salvar a sessão no armazenamento local do navegador
  const SESSION_KEY = 'zyon_session';

  // Credenciais estáticas para fins de demonstração do sistema (MOCK)
  const CREDENTIALS = {
    username: 'admin',
    password: 'admin'
  };

  /**
   * Recupera a sessão atual do usuário a partir do SessionStorage do navegador.
   * O SessionStorage é volátil, ou seja, se o usuário fechar a aba, ele é deslogado.
   * 
   * @returns {Object|null} Retorna o objeto de sessão parseado `{ username, loggedAt }` ou `null` se não houver sessão ativa/válida.
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      
      const session = JSON.parse(raw);
      // Validação de integridade: se não tem username, a sessão é inválida (pode ter sido corrompida)
      if (!session?.username) return null;
      
      return session;
    } catch {
      // Se houver erro de Sintaxe no JSON gravado no storage, aborta silenciosamente
      return null;
    }
  }

  /**
   * Verifica rapidamente se o usuário tem um token de sessão válido na máquina.
   * Utilizado como "guarda" em rotas protegidas (ex: dashboard.html).
   * 
   * @returns {boolean} `true` se estiver logado, `false` se for visitante anônimo.
   */
  function isAuthenticated() {
    return Boolean(getSession());
  }

  /**
   * Tenta realizar o login comparando os dados digitados com as credenciais fixas (mockadas) em memória.
   * Em um cenário real, aqui seria feita uma requisição `fetch()` ou `axios()` para o backend validar no banco de dados com Hash (bcrypt).
   * 
   * @param {string} username - O nome de usuário inserido pelo visitante no formulário.
   * @param {string} password - A senha inserida.
   * @returns {Object} `{ ok: boolean, message?: string, session?: Object }` Retorna o status da operação.
   */
  function login(username, password) {
    // Sanitização básica: remove espaços vazios do início e fim do username digitado. A senha não tem trim() para manter espaços literais.
    const user = String(username ?? '').trim();
    const pass = String(password ?? '');

    // Validação de Credencial Hardcoded
    if (user !== CREDENTIALS.username || pass !== CREDENTIALS.password) {
      return { ok: false, message: 'Usuário ou senha inválidos.' };
    }

    // Cria o objeto de contexto de sessão que será gravado no navegador
    const session = {
      username: CREDENTIALS.username,
      loggedAt: new Date().toISOString()
    };
    
    // Converte para String e grava
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  /**
   * Encerra a sessão do usuário de forma abrupta, limpando a chave no Storage
   * e redirecionando a janela ativa de volta para a tela de login (`index.html`).
   * 
   * @returns {void}
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  /**
   * Middleware Front-end: Chamado no topo de todas as páginas privadas.
   * Se a pessoa tentar acessar `dashboard.html` direto pela URL sem estar logada, 
   * essa função "chuta" ela imediatamente devolta para o `index.html`.
   * 
   * @returns {boolean} `true` se o acesso é permitido, `false` se o usuário for ejetado.
   */
  function requireAuth() {
    if (!isAuthenticated()) {
      window.location.replace('index.html'); // replace não guarda histórico no botão 'Voltar' do navegador
      return false;
    }
    return true;
  }

  /**
   * Atrela o evento de Click do botão "Sair" na sidebar de todas as páginas
   * chamando a função de logout programático.
   * 
   * @param {string} [selector='a.logout'] - O seletor CSS do elemento HTML que representa o botão de logoff.
   * @returns {void}
   */
  function bindLogoutLinks(selector = 'a.logout') {
    document.querySelectorAll(selector).forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault(); // Interrompe o <a> de tentar navegar para o href natural dele
        logout();
      });
    });
  }

  // ============================================================================
  // EXPORTAÇÃO GLOBAL
  // Disponibiliza as funções na janela do navegador para serem consumidas no login.js e session.js
  // ============================================================================
  window.ZyonAuth = {
    login,
    logout,
    getSession,
    isAuthenticated,
    requireAuth,
    bindLogoutLinks
  };
})();
