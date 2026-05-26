/* === TELA DE CADASTROS UNIFICADA (cadastros.html) ===
   - Gerencia 3 entidades com abas: Clientes, Vendedores, Fornecedores
   - Produtos são cadastrados no módulo Estoque
   - Cada entidade possui: busca textual, formulário de cadastro inline e tabela com ações
   - As ações incluem: visualizar, editar, ativar/inativar
   - Arquitetura genérica: a config (entities) define campos, renderização e regras */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();

  const tabNav = document.getElementById('tabNav');
  const tabContent = document.getElementById('tabContent');

  /* Configuração de cada entidade: chave, label, campos, renderização e regras */
  /* Produtos são cadastrados no módulo Estoque */
  const entities = {
    clientes: {
      key: app.KEYS.clients,
      label: 'Cliente',
      fields: [
        { id: 'nome', label: 'Nome / Razão Social *', type: 'text', required: true },
        { id: 'documento', label: 'CPF / CNPJ *', type: 'text', required: true },
        { id: 'contato', label: 'Contato', type: 'text', required: false }
      ],
      /* Renderiza uma linha da tabela para um item */
      renderRow: (item, ctx) => {
        const active = item.status === 'Ativo';
        const canDelete = ctx?.canDeleteClient ? ctx.canDeleteClient(item.nome) : true;
        const nome = app.escapeHtml(item.nome);
        const contato = app.escapeHtml(item.contato || '-');
        const documento = app.escapeHtml(item.documento || '-');
        const status = app.escapeHtml(item.status);
        return `
          <td><strong style="color:var(--text-dark);display:block;font-size:1rem">${nome}</strong><span style="font-size:0.85rem;color:var(--text-light)">${contato}</span></td>
          <td style="color:var(--text-light)">${documento}</td>
          <td><span class="status-badge ${active ? 'status-active' : 'status-inactive'}">${status}</span></td>
          <td class="action-btns">
            <span title="Visualizar" data-action="view" data-id="${item.id}">👁️</span>
            <span title="Editar" data-action="edit" data-id="${item.id}">✏️</span>
            <span title="${active ? 'Inativar' : 'Ativar'}" data-action="toggle" data-id="${item.id}">${active ? '🚫' : '✅'}</span>
            ${canDelete
              ? `<span title="Excluir" data-action="delete" data-id="${item.id}">🗑️</span>`
              : `<span class="action-disabled" title="Cliente com vendas vinculadas — exclusão bloqueada">🗑️</span>`}
          </td>`;
      },
      getSearchText: (item) => [item.nome, item.documento, item.contato].join(' ').toLowerCase(),
      buildItem: (form) => ({
        id: crypto.randomUUID(),
        nome: form.nome.trim(),
        documento: form.documento.trim(),
        contato: (form.contato || '').trim(),
        status: 'Ativo',
        tipo: 'pf'
      }),
      columns: ['Cliente / Contato', 'CPF / CNPJ', 'Status', 'Ações']
    },
    vendedores: {
      key: app.KEYS.sellers,
      label: 'Vendedor',
      fields: [
        { id: 'nomeVendedor', label: 'Nome *', type: 'text', required: true },
        { id: 'docVendedor', label: 'CPF *', type: 'text', required: true },
        { id: 'contatoVendedor', label: 'Contato', type: 'text', required: false },
        { id: 'comissaoVendedor', label: 'Comissão (%)', type: 'number', required: false, min: '0', max: '100', step: '0.1' }
      ],
      renderRow: (item, ctx) => {
        const active = item.status === 'Ativo';
        const canDelete = ctx?.canDeleteSeller ? ctx.canDeleteSeller(item.nome) : true;
        const nome = app.escapeHtml(item.nome);
        const contato = app.escapeHtml(item.contato || '-');
        const documento = app.escapeHtml(item.documento || '-');
        const status = app.escapeHtml(item.status);
        const comissao = item.comissao != null ? app.escapeHtml(item.comissao) + '%' : '-';
        return `
          <td><strong style="color:var(--text-dark);display:block;font-size:1rem">${nome}</strong><span style="font-size:0.85rem;color:var(--text-light)">${contato}</span></td>
          <td style="color:var(--text-light)">${documento}</td>
          <td>${comissao}</td>
          <td><span class="status-badge ${active ? 'status-active' : 'status-inactive'}">${status}</span></td>
          <td class="action-btns">
            <span title="Visualizar" data-action="view" data-id="${item.id}">👁️</span>
            <span title="Editar" data-action="edit" data-id="${item.id}">✏️</span>
            <span title="${active ? 'Inativar' : 'Ativar'}" data-action="toggle" data-id="${item.id}">${active ? '🚫' : '✅'}</span>
            ${canDelete
              ? `<span title="Excluir" data-action="delete" data-id="${item.id}">🗑️</span>`
              : `<span class="action-disabled" title="Vendedor com vendas vinculadas — exclusão bloqueada">🗑️</span>`}
          </td>`;
      },
      getSearchText: (item) => [item.nome, item.documento, item.contato].join(' ').toLowerCase(),
      buildItem: (form) => ({
        id: crypto.randomUUID(),
        nome: form.nomeVendedor.trim(),
        documento: form.docVendedor.trim(),
        contato: (form.contatoVendedor || '').trim(),
        comissao: Number(form.comissaoVendedor || 0),
        status: 'Ativo'
      }),
      columns: ['Vendedor / Contato', 'CPF', 'Comissão', 'Status', 'Ações']
    },
    fornecedores: {
      key: app.KEYS.suppliers,
      label: 'Fornecedor',
      fields: [
        { id: 'nomeFornecedor', label: 'Nome / Razão Social *', type: 'text', required: true },
        { id: 'docFornecedor', label: 'CNPJ *', type: 'text', required: true },
        { id: 'contatoFornecedor', label: 'Contato', type: 'text', required: false },
        { id: 'enderecoFornecedor', label: 'Endereço', type: 'text', required: false }
      ],
      renderRow: (item, ctx) => {
        const active = item.status === 'Ativo';
        const canDelete = ctx?.canDeleteSupplier ? ctx.canDeleteSupplier(item.id) : true;
        const nome = app.escapeHtml(item.nome);
        const contato = app.escapeHtml(item.contato || '-');
        const documento = app.escapeHtml(item.documento || '-');
        const endereco = app.escapeHtml(item.endereco || '-');
        const status = app.escapeHtml(item.status);
        return `
          <td><strong style="color:var(--text-dark);display:block;font-size:1rem">${nome}</strong><span style="font-size:0.85rem;color:var(--text-light)">${contato}</span></td>
          <td style="color:var(--text-light)">${documento}</td>
          <td style="color:var(--text-light)">${endereco}</td>
          <td><span class="status-badge ${active ? 'status-active' : 'status-inactive'}">${status}</span></td>
          <td class="action-btns">
            <span title="Visualizar" data-action="view" data-id="${item.id}">👁️</span>
            <span title="Editar" data-action="edit" data-id="${item.id}">✏️</span>
            <span title="${active ? 'Inativar' : 'Ativar'}" data-action="toggle" data-id="${item.id}">${active ? '🚫' : '✅'}</span>
            ${canDelete
              ? `<span title="Excluir" data-action="delete" data-id="${item.id}">🗑️</span>`
              : `<span class="action-disabled" title="Fornecedor com pedidos de reposição vinculados — exclusão bloqueada">🗑️</span>`}
          </td>`;
      },
      getSearchText: (item) => [item.nome, item.documento, item.contato, item.endereco].join(' ').toLowerCase(),
      buildItem: (form) => ({
        id: crypto.randomUUID(),
        nome: form.nomeFornecedor.trim(),
        documento: form.docFornecedor.trim(),
        contato: (form.contatoFornecedor || '').trim(),
        endereco: (form.enderecoFornecedor || '').trim(),
        status: 'Ativo'
      }),
      columns: ['Fornecedor / Contato', 'CNPJ', 'Endereço', 'Status', 'Ações']
    }
  };

  let currentTab = 'clientes';

  const validators = {
    clientes: (data, opts) => window.ZyonValidators.validateClient({
      nome: data.nome,
      documento: data.documento,
      contato: data.contato || ''
    }, opts),
    vendedores: (data, opts) => window.ZyonValidators.validateSeller({
      nome: data.nomeVendedor,
      documento: data.docVendedor,
      contato: data.contatoVendedor || '',
      comissao: data.comissaoVendedor
    }, opts),
    fornecedores: (data, opts) => window.ZyonValidators.validateSupplier({
      nome: data.nomeFornecedor,
      documento: data.docFornecedor,
      contato: data.contatoFornecedor || '',
      endereco: data.enderecoFornecedor || ''
    }, opts)
  };

  const fieldKeyMap = {
    nomeVendedor: 'nome', docVendedor: 'documento', contatoVendedor: 'contato', comissaoVendedor: 'comissao',
    nomeFornecedor: 'nome', docFornecedor: 'documento', contatoFornecedor: 'contato', enderecoFornecedor: 'endereco'
  };

  function loadTabData(tab) {
    const cfg = entities[tab];
    if (!cfg) return [];
    const raw = app.getData(cfg.key, []);
    return Array.isArray(raw) ? raw : [];
  }

  function saveTabData(tab, data) {
    const cfg = entities[tab];
    if (!cfg) return;
    app.setData(cfg.key, data);
  }

  /* Constrói o HTML do formulário de cadastro para uma entidade */
  function buildFormHTML(tab) {
    const cfg = entities[tab];
    let html = '<form class="entity-form" data-tab="' + tab + '"><div class="row" style="flex-wrap:wrap">';
    cfg.fields.forEach((f) => {
      const attrs = 'id="fld-' + tab + '-' + f.id + '" type="' + f.type + '"' +
        (f.required ? ' required' : '') +
        (f.step ? ' step="' + f.step + '"' : '') +
        (f.min ? ' min="' + f.min + '"' : '') +
        (f.max ? ' max="' + f.max + '"' : '') +
        (f.placeholder ? ' placeholder="' + f.placeholder + '"' : '');
      html += '<div class="form-group" style="flex:1;min-width:150px"><label for="fld-' + tab + '-' + f.id + '">' + f.label + '</label><input ' + attrs + '></div>';
    });
    html += '<div class="form-group" style="display:flex;align-items:flex-end;min-width:120px"><button class="btn-primary" type="submit">Cadastrar</button></div>';
    html += '</div></form>';
    return html;
  }

  /* Renderiza o conteúdo completo de uma aba (busca + formulário + tabela) */
  function renderTab(tab) {
    if (!tabContent) return;
    const cfg = entities[tab];
    if (!cfg) return;

    const data = loadTabData(tab);
    const searchTerm = (document.getElementById('search-' + tab)?.value || '').toLowerCase().trim();

    /* Aplica filtro de busca textual */
    const filtered = searchTerm
      ? data.filter((item) => cfg.getSearchText(item).toLowerCase().includes(searchTerm))
      : data;

    /* Monta o HTML completo da aba */
    let html = '';

    /* Barra de pesquisa */
    html += '<div class="search-container">';
    html += '  <div class="search-input-wrapper">';
    html += '    <span class="search-icon">🔍</span>';
    html += '    <input id="search-' + tab + '" type="text" placeholder="Buscar ' + cfg.label.toLowerCase() + '..." value="' + escapeHtml(searchTerm) + '">';
    html += '  </div>';
    html += '  <button class="btn-secondary clear-search-btn" data-tab="' + tab + '">Limpar</button>';
    html += '</div>';

    /* Formulário de cadastro */
    html += '<div class="main-area" style="margin-bottom:1.5rem">';
    html += '  <h3 style="margin-bottom:1rem">Novo ' + cfg.label + '</h3>';
    html += buildFormHTML(tab);
    html += '</div>';

    /* Tabela com os registros */
    html += '<div class="table-card">';
    html += '  <table><thead><tr>';
    cfg.columns.forEach((col) => { html += '<th>' + col + '</th>'; });
    html += '  </tr></thead><tbody id="tbody-' + tab + '">';

    const rowCtx = tab === 'clientes'
      ? {
          canDeleteClient: (nome) => {
            if (typeof app.clientHasLinkedSales !== 'function') return true;
            return !app.clientHasLinkedSales(nome);
          }
        }
      : tab === 'vendedores'
      ? {
          canDeleteSeller: (nome) => {
            if (typeof app.sellerHasLinkedSales !== 'function') return true;
            return !app.sellerHasLinkedSales(nome);
          }
        }
      : tab === 'fornecedores'
      ? {
          canDeleteSupplier: (id) => {
            if (typeof app.supplierHasLinkedOrders !== 'function') return true;
            return !app.supplierHasLinkedOrders(id);
          }
        }
      : {};

    if (!filtered.length) {
      html += '<tr><td colspan="' + cfg.columns.length + '">Nenhum ' + cfg.label.toLowerCase() + ' encontrado.</td></tr>';
    } else {
      filtered.forEach((item) => {
        html += '<tr data-id="' + item.id + '">' + cfg.renderRow(item, rowCtx) + '</tr>';
      });
    }

    html += '</tbody></table></div>';

    tabContent.innerHTML = html;

    /* === EVENT LISTENERS DO CONTEÚDO RENDERIZADO === */

    /* Busca ao digitar */
    const searchInput = document.getElementById('search-' + tab);
    if (searchInput) {
      searchInput.addEventListener('input', () => renderTab(tab));
    }

    /* Botão limpar busca */
    tabContent.querySelectorAll('.clear-search-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('search-' + btn.dataset.tab);
        if (inp) inp.value = '';
        renderTab(btn.dataset.tab);
      });
    });

    /* Submit do formulário de cadastro */
    const form = tabContent.querySelector('.entity-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {};
        cfg.fields.forEach((f) => {
          const el = document.getElementById('fld-' + tab + '-' + f.id);
          if (el) formData[f.id] = el.value;
        });

        const items = loadTabData(tab);
        const validation = validators[tab](formData, { existing: items });
        if (!validation.ok) {
          app.notify(validation.errors[0]);
          return;
        }

        items.push(cfg.buildItem(formData));
        saveTabData(tab, items);
        app.notify(cfg.label + ' cadastrado.');
        form.reset();
        renderTab(tab);
      });
    }

    /* Ações na tabela (view, edit, toggle, remove) */
    const tbody = document.getElementById('tbody-' + tab);
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.dataset.id;
        const action = target.dataset.action;
        if (!id || !action) return;

        const items = loadTabData(tab);
        const idx = items.findIndex((i) => i.id === id);
        if (idx < 0) return;

        /* Visualizar: exibe todos os campos via alert */
        if (action === 'view') {
          const item = items[idx];
          let msg = '';
          cfg.fields.forEach((f) => {
            const key = fieldKeyMap[f.id] || f.id;
            const val = item[key] ?? '';
            msg += f.label.replace(' *', '') + ': ' + val + '\n';
          });
          msg += 'Status: ' + item.status;
          alert(msg);
          return;
        }

        /* Editar: solicita novo valor para cada campo via prompt */
        if (action === 'edit') {
          const current = items[idx];
          let cancelled = false;
          cfg.fields.forEach((f) => {
            const key = fieldKeyMap[f.id] || f.id;
            const val = prompt(f.label + ':', current[key] ?? '');
            if (val === null) { cancelled = true; return; }
            if (f.required && !String(val).trim()) { cancelled = true; return; }
            items[idx][key] = key === 'comissao' ? Number(val) : String(val).trim();
          });
          if (cancelled) { app.notify('Edição cancelada.'); return; }

          const editForm = {};
          cfg.fields.forEach((f) => {
            const key = fieldKeyMap[f.id] || f.id;
            editForm[f.id] = items[idx][key];
          });
          const validation = validators[tab](editForm, { existing: items, excludeId: id });
          if (!validation.ok) {
            app.notify(validation.errors[0]);
            renderTab(tab);
            return;
          }

          saveTabData(tab, items);
          app.notify(cfg.label + ' atualizado.');
          renderTab(tab);
          return;
        }

        /* Alternar status (Ativo <-> Inativo) */
        if (action === 'toggle') {
          items[idx].status = items[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
          saveTabData(tab, items);
          app.notify('Status alterado.');
          renderTab(tab);
          return;
        }

        if (action === 'delete') {
          if (tab === 'clientes') {
            const client = items[idx];
            if (app.clientHasLinkedSales(client.nome)) {
              app.notify('Não é possível excluir: existem vendas vinculadas a este cliente.');
              return;
            }

            if (!confirm(`Excluir o cliente "${client.nome}" permanentemente?`)) return;
            items.splice(idx, 1);
            saveTabData(tab, items);
            app.notify('Cliente excluído.');
            renderTab(tab);
          } else if (tab === 'vendedores') {
            const seller = items[idx];
            if (app.sellerHasLinkedSales(seller.nome)) {
              app.notify('Não é possível excluir: existem vendas vinculadas a este vendedor.');
              return;
            }

            if (!confirm(`Excluir o vendedor "${seller.nome}" permanentemente?`)) return;
            items.splice(idx, 1);
            saveTabData(tab, items);
            app.notify('Vendedor excluído.');
            renderTab(tab);
          } else if (tab === 'fornecedores') {
            const supplier = items[idx];
            if (app.supplierHasLinkedOrders(supplier.id)) {
              app.notify('Não é possível excluir: existem pedidos de reposição vinculados a este fornecedor.');
              return;
            }

            if (!confirm(`Excluir o fornecedor "${supplier.nome}" permanentemente?`)) return;
            items.splice(idx, 1);
            saveTabData(tab, items);
            app.notify('Fornecedor excluído.');
            renderTab(tab);
          }
        }
      });
    }
  }

  /* Escapa caracteres HTML para evitar XSS no valor da busca */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* Navegação por abas */
  tabNav?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (!tab || tab === currentTab) return;
    tabNav.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    currentTab = tab;
    renderTab(tab);
  });

  if (!window.ZyonValidators) {
    tabContent.innerHTML = '<p class="table-empty">Erro ao carregar validadores. Verifique se js/validators.js está disponível.</p>';
    return;
  }

  if (!tabNav || !tabContent) {
    return;
  }

  const hashTab = window.location.hash.replace('#', '');
  if (hashTab && entities[hashTab]) {
    currentTab = hashTab;
    tabNav.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === hashTab);
    });
  }

  renderTab(currentTab);
});
