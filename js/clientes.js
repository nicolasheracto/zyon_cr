/* === GERENCIAMENTO DE CLIENTES (página clientes.html) ===
   - Lista, busca, visualiza, edita e alterna status de clientes */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const tableBody = document.getElementById('clientsTableBody');
  const searchInput = document.getElementById('clientSearch');
  const clearBtn = document.getElementById('clearClientSearch');

  /* Retorna a lista de clientes do localStorage */
  function getClients() {
    return app.getData(app.KEYS.clients, []);
  }

  /* Salva a lista de clientes no localStorage */
  function setClients(clients) {
    app.setData(app.KEYS.clients, clients);
  }

  /* Renderiza a tabela filtrando pelo termo de busca */
  function render() {
    const clients = getClients();
    const term = (searchInput?.value || '').toLowerCase().trim();
    /* Filtra por nome, documento ou contato */
    const filtered = clients.filter((c) =>
      [c.nome, c.documento, c.contato].join(' ').toLowerCase().includes(term)
    );

    tableBody.innerHTML = '';

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado.</td></tr>';
      return;
    }

    /* Cria as linhas da tabela com dados do cliente e botões de ação */
    filtered.forEach((client) => {
      const tr = document.createElement('tr');
      const active = client.status === 'Ativo';
      tr.innerHTML = `
        <td>
          <strong style="color: var(--text-dark); display: block; font-size: 1rem;">${client.nome}</strong>
          <span style="font-size: 0.85rem; color: var(--text-light);">${client.contato || '-'}</span>
        </td>
        <td style="color: var(--text-light);">${client.documento || '-'}</td>
        <td><span class="status-badge ${active ? 'status-active' : 'status-inactive'}">${client.status}</span></td>
        <td class="action-btns">
          <span title="Visualizar" data-action="view" data-id="${client.id}">👁️</span>
          <span title="Editar" data-action="edit" data-id="${client.id}">✏️</span>
          <span title="${active ? 'Inativar' : 'Ativar'}" data-action="toggle" data-id="${client.id}">${active ? '🚫' : '✅'}</span>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /* Delegador de eventos: captura cliques nos botões de ação da tabela */
  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const clients = getClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx < 0) return;

    /* Ação: visualizar dados completos do cliente */
    if (action === 'view') {
      const c = clients[idx];
      alert(`Nome: ${c.nome}\nDocumento: ${c.documento}\nContato: ${c.contato}\nStatus: ${c.status}`);
      return;
    }

    /* Ação: editar nome do cliente (via prompt) */
    if (action === 'edit') {
      const newName = prompt('Novo nome do cliente:', clients[idx].nome);
      if (!newName) return;
      clients[idx].nome = newName.trim();
      setClients(clients);
      app.notify('Cliente atualizado.');
      render();
      return;
    }

    /* Ação: alternar entre Ativo e Inativo */
    if (action === 'toggle') {
      clients[idx].status = clients[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
      setClients(clients);
      app.notify('Status alterado.');
      render();
    }
  });

  /* Filtro ao digitar na busca */
  searchInput?.addEventListener('input', render);

  /* Botão limpar: limpa o campo de busca e re-renderiza */
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    render();
  });

  render();
});
