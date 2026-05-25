document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const tableBody = document.getElementById('clientsTableBody');
  const searchInput = document.getElementById('clientSearch');
  const clearBtn = document.getElementById('clearClientSearch');

  function getClients() {
    return app.getData(app.KEYS.clients, []);
  }

  function setClients(clients) {
    app.setData(app.KEYS.clients, clients);
  }

  function render() {
    const clients = getClients();
    const term = (searchInput?.value || '').toLowerCase().trim();
    const filtered = clients.filter((c) =>
      [c.nome, c.documento, c.contato].join(' ').toLowerCase().includes(term)
    );

    tableBody.innerHTML = '';

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado.</td></tr>';
      return;
    }

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

  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const clients = getClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx < 0) return;

    if (action === 'view') {
      const c = clients[idx];
      alert(`Nome: ${c.nome}\nDocumento: ${c.documento}\nContato: ${c.contato}\nStatus: ${c.status}`);
      return;
    }

    if (action === 'edit') {
      const newName = prompt('Novo nome do cliente:', clients[idx].nome);
      if (!newName) return;
      clients[idx].nome = newName.trim();
      setClients(clients);
      app.notify('Cliente atualizado.');
      render();
      return;
    }

    if (action === 'toggle') {
      clients[idx].status = clients[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
      setClients(clients);
      app.notify('Status alterado.');
      render();
    }
  });

  searchInput?.addEventListener('input', render);
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    render();
  });

  render();
});
