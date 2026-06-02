/* === TELA DE CADASTROS UNIFICADA (cadastros.js) ===
   - Gerencia 3 entidades em uma única página usando abas (Tabs): Clientes, Vendedores e Fornecedores.
   - Observação: Produtos não estão aqui, pois são gerenciados no módulo de Estoque.
   - O que o arquivo faz:
     1. Exibe a barra de busca, formulário de adição e tabela de dados para a aba ativa.
     2. Lida com a validação antes de salvar.
     3. Trata os botões de ação na tabela (Visualizar, Editar, Ativar/Inativar, Excluir).
*/

/**
 * Evento principal da página de Cadastros.
 * Este script é complexo porque utiliza uma "Fábrica" (Factory Pattern) para construir
 * os formulários e tabelas dinamicamente baseando-se em um dicionário de entidades.
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa a página carregando o relógio, branding e funções utilitárias da ZyonApp
  const app = window.ZyonApp.initPage();

  const tabNav = document.getElementById('tabNav');
  const tabContent = document.getElementById('tabContent');

  /**
   * CONFIGURAÇÃO CENTRAL DE ENTIDADES (O coração do arquivo)
   * Em vez de repetir código de HTML 3 vezes (para cliente, vendedor, fornecedor),
   * definimos este "Dicionário" (Object) ensinando ao script Javascript genérico 
   * como ele deve se comportar para desenhar a tabela e os campos de cada tipo.
   * @constant {Object}
   */
  const entities = {
    
    // ==========================================
    // ENTIDADE: CLIENTES
    // ==========================================
    clientes: {
      key: app.KEYS.clients, // Chave do LocalStorage onde a tabela de clientes é persistida
      label: 'Cliente',      // Nome bonitinho pra exibir na interface "Novo Cliente"
      
      // Definição dos campos HTML <input> que o sistema precisará injetar na tela
      fields: [
        { id: 'nome', label: 'Nome / Razão Social *', type: 'text', required: true },
        { id: 'documento', label: 'CPF / CNPJ *', type: 'text', required: true },
        { id: 'contato', label: 'Contato', type: 'text', required: false }
      ],
      
      /**
       * Injeta o código HTML dentro de cada linha (`<tr>`) da tabela.
       * @param {Object} item - O registro do cliente vindo do banco.
       * @param {Object} ctx - Contexto de execução injetado (funções de bloqueio de exclusão).
       * @returns {string} String HTML da linha de tabela.
       */
      renderRow: (item, ctx) => {
        const active = item.status === 'Ativo';
        
        // Verifica se a exclusão deve ser bloqueada (Integridade Relacional)
        // Um cliente que já possui vendas em andamento/concluídas não pode ser apagado
        const canDelete = ctx?.canDeleteClient ? ctx.canDeleteClient(item.nome) : true;
        
        // Proteção contra XSS no banco de dados para evitar Injeção de Scripts (escapeHtml)
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
      
      /**
       * Função para otimizar o filtro de barra de pesquisa. 
       * Junta os textos em minúsculo para a lógica do Javascript comparar se o que o usuário digitou existe ali no meio.
       * @param {Object} item - Cliente a ser mapeado.
       * @returns {string} Textão contendo os dados empacotados em letra minúscula (ex: "joão 111.111.111-11 email@test.com")
       */
      getSearchText: (item) => [item.nome, item.documento, item.contato].join(' ').toLowerCase(),
      
      /**
       * Modelagem de Banco: Formata os dados digitados num objeto padronizado antes de mandar salvar no localstorage.
       * @param {Object} form - Dados brutos do DOM do Formulário HTML.
       * @returns {Object} JSON do Cliente.
       */
      buildItem: (form) => ({
        id: crypto.randomUUID(),
        nome: form.nome.trim(),
        documento: form.documento.trim(),
        contato: (form.contato || '').trim(),
        status: 'Ativo',
        tipo: 'pf'
      }),
      // Textos exibidos nos títulos de coluna da tabela <thead>
      columns: ['Cliente / Contato', 'CPF / CNPJ', 'Status', 'Ações']
    },

    // ==========================================
    // ENTIDADE: VENDEDORES
    // ==========================================
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

    // ==========================================
    // ENTIDADE: FORNECEDORES
    // ==========================================
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

  // Estado inicial: aba padrão ao entrar na tela (se a URL não fornecer uma via hash)
  let currentTab = 'clientes';

  // Configuração de validadores: Associa cada aba a uma regra de negócio contida no `validators.js`
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

  // Mapeamento: Traduz os IDs que estão nos `<input id="...">` do HTML para as chaves internas que serão salvas no JSON
  const fieldKeyMap = {
    nomeVendedor: 'nome', docVendedor: 'documento', contatoVendedor: 'contato', comissaoVendedor: 'comissao',
    nomeFornecedor: 'nome', docFornecedor: 'documento', contatoFornecedor: 'contato', enderecoFornecedor: 'endereco'
  };

  /**
   * Helper para carregar o array do banco associado à aba em visualização atual.
   * @param {string} tab - Nome da aba (ex: 'clientes', 'vendedores')
   * @returns {Array<Object>} O array extraído do localStorage
   */
  function loadTabData(tab) {
    const cfg = entities[tab];
    if (!cfg) return [];
    const raw = app.getData(cfg.key, []);
    return Array.isArray(raw) ? raw : [];
  }

  /**
   * Helper para salvar um novo array reescrito na chave correta da aba no banco de dados.
   * @param {string} tab - Nome da aba alvo
   * @param {Array<Object>} data - Novo array completo a ser serializado.
   * @returns {void}
   */
  function saveTabData(tab, data) {
    const cfg = entities[tab];
    if (!cfg) return;
    app.setData(cfg.key, data);
  }

  /**
   * Método de Fábrica: Constrói o HTML puro do formulário de cadastro dinamicamente
   * lendo as instruções da constante `entities`.
   * 
   * @param {string} tab - Aba para a qual o formulário está sendo gerado
   * @returns {string} String contendo marcações HTML complexas `<form><input...></form>`
   */
  function buildFormHTML(tab) {
    const cfg = entities[tab];
    let html = '<form class="entity-form" data-tab="' + tab + '"><div class="row" style="flex-wrap:wrap">';
    
    // Varre os campos definidos na configuração e cria tags de <input> na tela para eles
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

  /**
   * RE-RENDERIZAÇÃO PRINCIPAL DA ABA
   * Essa função redesenha **TODA** a interface da aba ativa, do zero.
   * Acionada sempre que uma aba é clicada, uma barra de pesquisa é preenchida ou um novo item é salvo/apagado.
   * 
   * Fluxo: Limpa tela -> injeta pesquisa -> injeta form -> filtra dados do banco -> injeta tabela -> atrela eventos javascript aos botões criados
   * 
   * @param {string} tab - A aba que será renderizada no DOM
   * @returns {void}
   */
  function renderTab(tab) {
    if (!tabContent) return;
    const cfg = entities[tab];
    if (!cfg) return;

    // Carrega tudo
    const data = loadTabData(tab);
    
    // Identifica o que foi digitado no filtro de busca
    const searchTerm = (document.getElementById('search-' + tab)?.value || '').toLowerCase().trim();

    /* Filtra a tabela local se houver termo digitado */
    const filtered = searchTerm
      ? data.filter((item) => cfg.getSearchText(item).toLowerCase().includes(searchTerm))
      : data;

    let html = '';

    // PASSO 1. Injeta Barra de Pesquisa
    html += '<div class="search-container">';
    html += '  <div class="search-input-wrapper">';
    html += '    <span class="search-icon">🔍</span>';
    html += '    <input id="search-' + tab + '" type="text" placeholder="Buscar ' + cfg.label.toLowerCase() + '..." value="' + escapeHtml(searchTerm) + '">';
    html += '  </div>';
    html += '  <button class="btn-secondary clear-search-btn" data-tab="' + tab + '">Limpar</button>';
    html += '</div>';

    // PASSO 2. Injeta Formulário (Acessa o helper de criação dinamica buildFormHTML)
    html += '<div class="main-area" style="margin-bottom:1.5rem">';
    html += '  <h3 style="margin-bottom:1rem">Novo ' + cfg.label + '</h3>';
    html += buildFormHTML(tab);
    html += '</div>';

    // PASSO 3. Injeta a Tabela e desenha as colunas de cabeçalho
    html += '<div class="table-card">';
    html += '  <table><thead><tr>';
    cfg.columns.forEach((col) => { html += '<th>' + col + '</th>'; });
    html += '  </tr></thead><tbody id="tbody-' + tab + '">';

    // Cria context functions para inibir exclusões indevidas baseado nas validações relacionais do app.js
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

    // PASSO 4. Injeta as Linhas (ou mostra aviso se tiver zerado)
    if (!filtered.length) {
      html += '<tr><td colspan="' + cfg.columns.length + '">Nenhum ' + cfg.label.toLowerCase() + ' encontrado.</td></tr>';
    } else {
      filtered.forEach((item) => {
        html += '<tr data-id="' + item.id + '">' + cfg.renderRow(item, rowCtx) + '</tr>';
      });
    }

    html += '</tbody></table></div>';
    
    // Substitui todo o html da div container de uma vez pela string recém montada (Mais rápido pro DOM)
    tabContent.innerHTML = html;

    // ========================================================================================
    // RE-ATRELAÇÃO DE EVENT LISTERNERS
    // (Como usamos innerHTML, os elementos anteriores do DOM são destruídos, 
    // os botões injetados pela função recém criados precisam ser informados que eles tem click events).
    // ========================================================================================

    // Auto-filtro enquanto digita na busca
    const searchInput = document.getElementById('search-' + tab);
    if (searchInput) {
      searchInput.addEventListener('input', () => renderTab(tab));
    }

    // Botão Limpar X do filtro de busca
    tabContent.querySelectorAll('.clear-search-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('search-' + btn.dataset.tab);
        if (inp) inp.value = '';
        renderTab(btn.dataset.tab);
      });
    });

    // Submissão (Salvar) de um Novo Registro
    const form = tabContent.querySelector('.entity-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Coleta inputs baseados na configuração da array `fields`
        const formData = {};
        cfg.fields.forEach((f) => {
          const el = document.getElementById('fld-' + tab + '-' + f.id);
          if (el) formData[f.id] = el.value;
        });

        // Repassa os dados preenchidos para a regra de validação adequada (CPF repetido, etc)
        const items = loadTabData(tab);
        const validation = validators[tab](formData, { existing: items });
        if (!validation.ok) {
          app.notify(validation.errors[0]); // Mostra o erro e aborta inserção 
          return;
        }

        // Se deu tudo certo, converte pra JSON usando a regra interna, joga pro LocalStorage e repinta a tela.
        items.push(cfg.buildItem(formData));
        saveTabData(tab, items);
        app.notify(cfg.label + ' cadastrado com sucesso!');
        form.reset();
        renderTab(tab); 
      });
    }

    // Delegação de evento (Event Delegation) da tabela. 
    // Ouve qualquer clique no <tbody> e verifica se foi num botão (Visualizar, Editar, Apagar)
    const tbody = document.getElementById('tbody-' + tab);
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        
        // Pega o UUID do registro clicado contido no HTML "data-id='xxx'"
        const id = target.dataset.id;
        const action = target.dataset.action;
        if (!id || !action) return;

        const items = loadTabData(tab);
        const idx = items.findIndex((i) => i.id === id);
        if (idx < 0) return;

        /* Ação: VISUALIZAR -> Mostra um popup nativo com o registro inteiro */
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

        /* Ação: EDITAR -> Abre caixinhas de input sequenciais para alterar os valores sem tela nova */
        if (action === 'edit') {
          const current = items[idx];
          let cancelled = false;
          
          cfg.fields.forEach((f) => {
            const key = fieldKeyMap[f.id] || f.id;
            // Mostra popup pro usuário com o texto antigo já pré-preenchido
            const val = prompt(f.label + ':', current[key] ?? '');
            
            if (val === null) { cancelled = true; return; }
            if (f.required && !String(val).trim()) { cancelled = true; return; }
            
            // Grava temporariamente
            items[idx][key] = key === 'comissao' ? Number(val) : String(val).trim();
          });
          if (cancelled) { app.notify('Edição cancelada.'); return; }

          // Valida as mudanças antes de salvar definitamente no banco de dados
          const editForm = {};
          cfg.fields.forEach((f) => {
            const key = fieldKeyMap[f.id] || f.id;
            editForm[f.id] = items[idx][key];
          });
          const validation = validators[tab](editForm, { existing: items, excludeId: id });
          
          if (!validation.ok) {
            app.notify(validation.errors[0]);
            renderTab(tab); // Dá refresh para desfazer a alteração visual da variavel provisória items[idx]
            return;
          }

          saveTabData(tab, items);
          app.notify(cfg.label + ' atualizado.');
          renderTab(tab);
          return;
        }

        /* Ação: ALTERNAR STATUS -> Soft Delete/Inativar bloqueando uso nas rotinas mas mantendo os registros */
        if (action === 'toggle') {
          items[idx].status = items[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
          saveTabData(tab, items);
          app.notify('Status alterado.');
          renderTab(tab);
          return;
        }

        /* Ação: EXCLUIR -> Hard delete do array no LocalStorage (Se bloqueio de Integridade deixar) */
        if (action === 'delete') {
          if (tab === 'clientes') {
            const client = items[idx];
            if (app.clientHasLinkedSales(client.nome)) {
              app.notify('Exclusão bloqueada: Existem vendas vinculadas a este cliente no histórico financeiro.');
              return;
            }

            if (!confirm(`Excluir o cliente "${client.nome}" permanentemente e sem volta?`)) return;
            items.splice(idx, 1);
            saveTabData(tab, items);
            app.notify('Cliente excluído.');
            renderTab(tab);
            
          } else if (tab === 'vendedores') {
            const seller = items[idx];
            if (app.sellerHasLinkedSales(seller.nome)) {
              app.notify('Exclusão bloqueada: Existem vendas com comissionamento vinculadas a este vendedor.');
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
              app.notify('Exclusão bloqueada: Fornecedor possui ordens de reposição de estoque registradas.');
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

  /**
   * Helper que limpa caracteres de Tags HTML de Strings cruas para prevenir vulnerabilidade 
   * de injeção de interface na função innerHTML de formatação.
   * @param {string} str - O texto sujo a ser envelopado
   * @returns {string} O texto protegido (com `&lt;` no lugar de `<`).
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * SISTEMA DE NAVEGAÇÃO DE ABAS
   * Listener no menu superior `div#tabNav` para mudar a chave ativa e re-renderizar.
   */
  tabNav?.addEventListener('click', (e) => {
    // Busca o elemento parente que tem a classe '.tab' (pode ter clicado no ícone dentro do botão)
    const btn = e.target.closest('.tab');
    if (!btn) return;
    
    const tab = btn.dataset.tab;
    // Evita duplo render se o usuário clicar na aba que já estava lendo
    if (!tab || tab === currentTab) return;
    
    // Troca classe ativa na interface para colorir o tab clicado
    tabNav.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    
    // Seta estado e chama Render principal
    currentTab = tab;
    renderTab(tab);
  });

  // Proteção: Checagem de segurança se validators.js falhou em carregar antes (script crashou, etc)
  if (!window.ZyonValidators) {
    tabContent.innerHTML = '<p class="table-empty">Erro ao carregar módulo validador de formulários. Verifique se js/validators.js está incluso na importação.</p>';
    return;
  }

  if (!tabNav || !tabContent) {
    return;
  }

  // Identificação de DeepLink via Hash URL
  // Ex: Se o link for `cadastros.html#fornecedores`, a aba de fornecedores já acorda selecionada em vez de clientes.
  const hashTab = window.location.hash.replace('#', '');
  if (hashTab && entities[hashTab]) {
    currentTab = hashTab;
    tabNav.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === hashTab);
    });
  }

  // Dispara o primeiro render pra desenhar tudo na tela na primeira abertura
  renderTab(currentTab);
});
