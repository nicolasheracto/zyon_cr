/* === GERENCIAMENTO DE CLIENTES (clientes.js) ===
   - Responsável pela tela "clientes.html" (ATENÇÃO: Módulo obsoleto/legado na v1.0.2)
   - Funcionalidades: listar todos, buscar por nome/CPF, visualizar detalhes, editar nome e ativar/inativar
   - NOTA: Este arquivo está em processo de depreciação. O sistema agora usa a interface unificada em `cadastros.js`.
*/

/**
 * Evento disparado quando o DOM da página legado `clientes.html` carrega.
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o ambiente da página
  const app = window.ZyonApp.initPage();

  // Mapeia os elementos do DOM
  const tableBody = document.getElementById('clientsTableBody');
  const searchInput = document.getElementById('clientSearch');
  const clearBtn = document.getElementById('clearClientSearch');

  /**
   * Obtém a lista atualizada de clientes do localStorage via API unificada ZyonApp.
   * @returns {Array<Object>} Array contendo os objetos de cliente.
   */
  function getClients() {
    return app.getData(app.KEYS.clients, []);
  }

  /**
   * Salva a lista de clientes de volta no localStorage, sobrescrevendo a anterior.
   * @param {Array<Object>} clients - Nova lista completa de clientes.
   * @returns {void}
   */
  function setClients(clients) {
    app.setData(app.KEYS.clients, clients);
  }

  /**
   * Renderiza a tabela de clientes na interface legada.
   * Lê o valor da barra de pesquisa e filtra os resultados (case-insensitive).
   * Injeta o HTML diretamente no `<tbody>`.
   * 
   * @returns {void}
   */
  function render() {
    const clients = getClients();
    
    // Pega o termo digitado, transformando em minúsculas para uma busca "case-insensitive"
    const term = (searchInput?.value || '').toLowerCase().trim();
    
    // Filtra clientes buscando o termo no nome, documento ou contato
    const filtered = clients.filter((c) =>
      [c.nome, c.documento, c.contato].join(' ').toLowerCase().includes(term)
    );

    // Limpa a tabela
    tableBody.innerHTML = '';

    // Se a busca não retornar nada, exibe mensagem vazia
    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado.</td></tr>';
      return;
    }

    // Cria as linhas da tabela (<tr>) para cada cliente filtrado
    filtered.forEach((client) => {
      const tr = document.createElement('tr');
      const active = client.status === 'Ativo';
      
      // Constrói o HTML interno da linha
      tr.innerHTML = `
        <td>
          <strong style="color: var(--text-dark); display: block; font-size: 1rem;">${client.nome}</strong>
          <span style="font-size: 0.85rem; color: var(--text-light);">${client.contato || '-'}</span>
        </td>
        <td style="color: var(--text-light);">${client.documento || '-'}</td>
        <td><span class="status-badge ${active ? 'status-active' : 'status-inactive'}">${client.status}</span></td>
        <td class="action-btns">
          <!-- Botões de ação. Usam atributos "data-" para guardar o ID e a ação -->
          <span title="Visualizar" data-action="view" data-id="${client.id}">👁️</span>
          <span title="Editar" data-action="edit" data-id="${client.id}">✏️</span>
          <span title="${active ? 'Inativar' : 'Ativar'}" data-action="toggle" data-id="${client.id}">${active ? '🚫' : '✅'}</span>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /* 
   * Delegador de Eventos (Event Delegation) para a Tabela:
   * Em vez de adicionar um "addEventListener" para CADA botão gerado dentro do loop de renderização,
   * adicionamos UM listener na tabela inteira. Quando houver clique em qualquer lugar da tabela,
   * o script verifica se o alvo do clique (event.target) possui os atributos "data-action" (Ex: edit, view).
   */
  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const clients = getClients();
    // Encontra a posição (índice) exata do cliente no Array para poder modificá-lo
    const idx = clients.findIndex((c) => c.id === id);
    if (idx < 0) return;

    // Ação: Exibir um alerta nativo simples com os dados completos do cliente
    if (action === 'view') {
      const c = clients[idx];
      alert(`Nome: ${c.nome}\nDocumento: ${c.documento}\nContato: ${c.contato}\nStatus: ${c.status}`);
      return;
    }

    // Ação: Abre um prompt nativo do navegador para alterar apenas o nome de forma rápida
    if (action === 'edit') {
      const newName = prompt('Novo nome do cliente:', clients[idx].nome);
      if (!newName) return; // Se cancelar ou deixar vazio, aborta a edição
      
      clients[idx].nome = newName.trim();
      setClients(clients);
      app.notify('Cliente atualizado.');
      render(); // Atualiza a tela para refletir o novo nome
      return;
    }

    // Ação: Inverte o status de 'Ativo' para 'Inativo' ou vice-versa (Soft Delete)
    if (action === 'toggle') {
      clients[idx].status = clients[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
      setClients(clients);
      app.notify('Status alterado.');
      render(); // Atualiza a tela
    }
  });

  // Re-renderiza a tabela automaticamente enquanto o usuário digita na busca (Instant Search)
  searchInput?.addEventListener('input', render);

  // Limpa o campo de texto de busca e restaura a tabela para o estado inicial
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    render();
  });

  // Chama a renderização inicial ao terminar de carregar a página
  render();
});
