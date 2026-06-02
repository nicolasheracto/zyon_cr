/* === FORMULÁRIO DE NOVO CLIENTE (adicionar-cliente.js) ===
   - Responsável por gerenciar a tela de adição de um novo cliente.
   - Captura os dados, valida e os salva no localStorage do navegador.
*/

/**
 * Evento disparado quando o DOM da página de cadastro especializado de clientes é carregado.
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o ambiente global do Zyon
  const app = window.ZyonApp.initPage();

  // Mapeia os elementos da interface
  const form = document.getElementById('clientForm');
  const cancelButtons = document.querySelectorAll('.cancel-client-btn');

  /**
   * Listener interceptador do botão "Salvar".
   * Captura os inputs do usuário, joga para o validador de negócios e grava no Banco (LocalStorage).
   * 
   * @param {SubmitEvent} event - Evento nativo de submissão do formulário.
   */
  form?.addEventListener('submit', (event) => {
    event.preventDefault(); /* Impede o reload natural da página pelo navegador */

    /* Captura os valores informados pelo usuário, removendo espaços em branco extras (trim) */
    const nome = document.getElementById('nome')?.value.trim();
    const documento = document.getElementById('documento')?.value.trim();
    const contato = document.getElementById('contato')?.value.trim();
    
    // Descobre se o usuário marcou Pessoa Física (pf) ou Pessoa Jurídica (pj) lendo os Radios Buttons
    const tipo = document.querySelector('input[name="tipoPessoa"]:checked')?.value || 'pf';

    // Recupera a lista atual de clientes cadastrados no armazenamento local
    const clients = app.getData(app.KEYS.clients, []);
    const list = Array.isArray(clients) ? clients : [];

    // Realiza a validação dos dados preenchidos usando o módulo unificado de validadores
    const validation = window.ZyonValidators.validateClient(
      { nome, documento, contato },
      { existing: list }
    );
    
    // Se a validação falhar (Ex: CPF em branco, CNPJ repetido, nome muito curto), exibe a primeira mensagem de erro e aborta a gravação
    if (!validation.ok) {
      app.notify(validation.errors[0]);
      return;
    }

    // Se os dados estiverem perfeitos, adiciona o novo objeto de cliente ao array
    list.push({
      id: crypto.randomUUID(), // Gera um identificador único universal (UUID)
      nome,
      documento,
      contato,
      status: 'Ativo',         // Clientes novos entram como 'Ativos' por padrão
      tipo
    });
    
    // Salva a lista atualizada no banco local
    app.setData(app.KEYS.clients, list);
    
    // Notifica o usuário do sucesso
    app.notify('Cliente salvo com sucesso.');

    /**
     * Aguarda 500ms (meio segundo) e redireciona o usuário de volta para a aba de clientes na tela principal de Cadastros.
     * Esse timeout é necessário para dar tempo da animação de Notificação (Toast) aparecer antes de trocar de tela.
     */
    setTimeout(() => {
      window.location.href = 'cadastros.html#clientes';
    }, 500);
  });

  /**
   * Configura os botões de cancelar para retornarem à tela de cadastros sem salvar nada.
   */
  cancelButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = 'cadastros.html#clientes';
    });
  });
});
