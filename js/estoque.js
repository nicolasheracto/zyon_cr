/* === GESTÃO DE ESTOQUE (estoque.js) ===
   - Este arquivo controla duas abas distintas:
     1. Aba "Produtos": Cadastro de novos produtos, listagem e ajuste manual de quantidade (➕/➖).
     2. Aba "Pedidos": Criação de pedidos de compra para fornecedores.
   - Quando um pedido é marcado como "Recebido", as quantidades dos produtos são somadas automaticamente ao estoque.
*/

/**
 * Evento principal do módulo de Estoque.
 * Gerencia a lógica das abas de Produtos e Ordens de Reposição, incluindo cálculos de alertas de baixo estoque.
 * 
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();

  /* ================= REFERÊNCIAS AOS ELEMENTOS DA TELA (DOM) ================= */

  /* --- Elementos da Aba Produtos --- */
  const form = document.getElementById('productForm'); // Formulário superior de adicionar novo produto
  const tableBody = document.getElementById('stockTableBody'); // <tbody> da listagem de produtos no armazém
  const lowCountEl = document.getElementById('lowStockCount'); // Header-card de Contagem de "Produtos Acabando"
  const lowStockBadge = document.getElementById('lowStockBadge'); // Elemento HTML (bolinha vermelha) do selo visual
  
  // Lê do banco o nível de alerta (Quantos itens ativam o gatilho de 'Estoque Baixo'). Fallback no `app.defaults.settings` se nulo.
  const settings = app.getData(app.KEYS.settings, app.defaults.settings); 

  /* --- Elementos da Aba Pedidos (Reposição/Ordem de Compra) --- */
  const ordersTableBody = document.getElementById('ordersTableBody');
  const modal = document.getElementById('orderModal'); // Modal Dialog gigante
  const modalTitle = document.getElementById('modalTitle');
  const orderForm = document.getElementById('orderForm');
  const orderSupplier = document.getElementById('orderSupplier'); // <select> contendo a lista de Fornecedores Ativos
  const orderItems = document.getElementById('orderItems'); // Container para as linhas dinâmicas de itens do pedido
  const addItemBtn = document.getElementById('addItemBtn'); // Botão [+ Adicionar Item] no modal
  const cancelOrderBtn = document.getElementById('cancelOrderBtn');
  const btnNewOrder = document.getElementById('btnNewOrder'); // Botão verde que chama o Modal Vazio

  /* --- Elementos de Navegação por Abas --- */
  const tabs = document.getElementById('estoqueTabs'); // Barra de navegação `div.tabs`
  const tabProdutos = document.getElementById('tabProdutos'); // View 1
  const tabPedidos = document.getElementById('tabPedidos'); // View 2

  /** @type {string|null} Guarda o UUID de um pedido se o usuário clicar no botão Editar (Lápis). Nulo indica que é um pedido novo. */
  let editingOrderId = null; 

  /* ================= FUNÇÕES DE ACESSO A DADOS (Repositórios) ================= */

  /**
   * Obtém a lista atualizada do catálogo de produtos e quantitativos físicos.
   * @returns {Array<Object>} O inventário. Ex: `[{sku: '123', quantidade: 5}]`.
   */
  function getProducts() {
    return app.getData(app.KEYS.products, []);
  }

  /**
   * Sobrescreve a tabela de produtos no LocalStorage.
   * @param {Array<Object>} products - O inventário completo atualizado.
   */
  function setProducts(products) {
    app.setData(app.KEYS.products, products);
  }

  /**
   * Obtém as ordens de reposição (Pedidos de Compra a Fornecedores).
   * @returns {Array<Object>}
   */
  function getOrders() {
    return app.getData(app.KEYS.stockOrders, []);
  }

  /**
   * Sobrescreve o histórico de ordens de reposição.
   * @param {Array<Object>} orders - Histórico completo.
   */
  function setOrders(orders) {
    app.setData(app.KEYS.stockOrders, orders);
  }

  /* ================= RENDERIZAÇÃO: ABA PRODUTOS ================= */

  /**
   * Atualiza todo o painel de produtos na interface (Limpa e Redesenha).
   * Realiza a contabilidade matemática para disparar a cor vermelha de 'Alerta de Baixo Estoque'.
   * 
   * @returns {void}
   */
  function renderProducts() {
    const products = getProducts();
    
    // Contagem Crítica: Filtra todos os produtos que estão com saldo menor ou igual ao Threshold configurado.
    const lowCount = products.filter((p) => (p.quantidade || 0) <= settings.lowStockThreshold).length;
    
    // Altera a interface de métricas visuais no topo da tela
    if (lowCountEl) lowCountEl.textContent = `${lowCount}`;
    if (lowStockBadge) lowStockBadge.style.display = lowCount > 0 ? 'inline-block' : 'none';

    tableBody.innerHTML = ''; // Limpa a tabela

    // Verifica vazio
    if (!products.length) {
      tableBody.innerHTML = '<tr><td colspan="6">Nenhum produto cadastrado no momento.</td></tr>';
      return;
    }

    products.forEach((p) => {
      // Define a regra da Badge verde (OK) ou Vermelha (Baixo)
      const isLow = (p.quantidade || 0) <= settings.lowStockThreshold;
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${p.sku}</td>
        <td>${p.nome}</td>
        <td>${app.formatCurrency(p.preco)}</td>
        <td><strong>${p.quantidade}</strong></td>
        <td>${isLow ? '<span class="status-badge status-inactive">Baixo</span>' : '<span class="status-badge status-active">OK</span>'}</td>
        <td class="action-btns">
          <!-- Botões de Micro-ajuste manual de estoque rápido (Sem precisar de nota fiscal de reposição) -->
          <span data-id="${p.id}" data-action="inc" title="Adicionar 1 (+)">➕</span>
          <span data-id="${p.id}" data-action="dec" title="Remover 1 (-)">➖</span>
          <span data-id="${p.id}" data-action="remove" title="Excluir produto do catálogo">🗑️</span>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /* ================= RENDERIZAÇÃO: ABA PEDIDOS ================= */

  /**
   * Atualiza a tabela com o histórico de Pedidos aos Fornecedores.
   * Realiza cálculos de agregação em tempo-real (Número de Itens e Custo Bruto) já que eles não são salvos direto no Pedido.
   * 
   * @returns {void}
   */
  function renderOrders() {
    const orders = getOrders();
    ordersTableBody.innerHTML = '';
    
    if (!orders.length) {
      ordersTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Nenhum pedido de reposição encontrado.</td></tr>';
      return;
    }

    const products = getProducts();

    /* Pega o Array de pedidos, clona, inverte (.reverse()) para o mais atual ficar na linha 1 da tabela, e mapeia. */
    orders.slice().reverse().forEach((order) => {
      const tr = document.createElement('tr');
      
      // Matemática: Soma a quantidade pedida (Qtd x Preço Unitário de Custo)
      const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
      const total = order.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
      
      const isPending = order.status === 'Pendente';
      
      // Validação de Integridade: Executa a função do app.js para saber se apagar o histórico desse pedido vai negativar as prateleiras hoje.
      const reverseCheck = app.canReverseStockReceipt(order, products);
      const canDelete = order.status !== 'Recebido' || reverseCheck.ok;
      
      const deleteTitle = canDelete
        ? 'Excluir pedido'
        : reverseCheck.message || 'Exclusão bloqueada por motivo contábil de segurança.';

      tr.innerHTML = `
        <td><strong>#${order.id.slice(0, 8)}</strong></td>
        <td>${order.supplierName}</td>
        <td>${order.date}</td>
        <td>${itemCount} itens</td>
        <td>${app.formatCurrency(total)}</td>
        <td><span class="status-badge ${isPending ? 'status-inactive' : 'status-active'}">${order.status}</span></td>
        <td class="action-btns">
          <!-- Botões de Fluxo Operacional: Se o caminhão não chegou, exibe os botões de controle de chegada -->
          ${isPending ? '<span title="Marcar como Recebido e somar ao estoque" data-action="receive" data-id="' + order.id + '">✅ Receber</span>' : ''}
          ${isPending ? '<span title="Cancelar a Compra" data-action="cancel" data-id="' + order.id + '">🚫 Cancelar</span>' : ''}
          
          <!-- Botão de Exclusão Física do Banco de Dados (Pode estar protegido se o Reverse Check não autorizou) -->
          ${canDelete
            ? `<span title="${app.escapeHtml(deleteTitle)}" data-action="delete" data-id="${order.id}">🗑️</span>`
            : `<span class="action-disabled" title="${app.escapeHtml(deleteTitle)}">🗑️</span>`}
            
          <span title="Visualizar Detalhes" data-action="view" data-id="${order.id}">👁️</span>
        </td>
      `;
      ordersTableBody.appendChild(tr);
    });
  }

  /* ================= LÓGICAS DO MODAL DE NOVO PEDIDO ================= */

  /**
   * Preenche as Tags `<option>` dos `Selects` (Comboboxes) dentro do modal do pedido.
   * Consulta os repositórios para injetar Fornecedores e Produtos ativados.
   * 
   * @returns {void}
   */
  function populateSelects() {
    // 1. Popula o Selecionador de Fornecedores (Topo do Modal)
    const suppliers = app.getData(app.KEYS.suppliers, []).filter((s) => s.status === 'Ativo');
    orderSupplier.innerHTML = '<option value="">Selecione...</option>';
    suppliers.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nome + (s.documento ? ' - ' + s.documento : '');
      orderSupplier.appendChild(opt);
    });

    // 2. Popula todos os Selecionadores de Produtos criados de forma dinâmica na grade de Itens.
    const products = getProducts();
    
    document.querySelectorAll('.item-product').forEach((sel) => {
      // Backwards Compatibility: Salva o ID do produto que tava ali selecionado antes de nós reescrevermos os <option>.
      const current = sel.value; 
      
      sel.innerHTML = '<option value="">Selecione o produto do catálogo...</option>';
      
      products.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.sku + ' - ' + p.nome + ' (Preço Base: R$ ' + p.preco?.toFixed(2) + ')';
        
        // Pulo do Gato: Embutir o custo no dataset do option para nosso Javascript puxar magicamente quando o cara clicar.
        opt.dataset.preco = p.preco; 
        
        sel.appendChild(opt);
      });
      // Restaura o valor após reconstruir
      if (current) sel.value = current;
    });
  }

  /**
   * Dinâmica Front-end: Injeta as Tags HTML `<input>` criando uma linha nova na fatura do Pedido.
   * Executada sempre que o operador clica no botão "➕ Adicionar Item".
   * 
   * @param {string|null} productId - (Opcional) ID do produto se já vier preenchido.
   * @param {number} qty - Quantidade.
   * @param {number|null} price - Preço da compra.
   */
  function addOrderItem(productId, qty, price) {
    const div = document.createElement('div');
    div.className = 'row order-item';
    div.style.alignItems = 'center';
    
    // Desenha as 4 Colunas: Produto(Select) | Quantidade | Custo Unitário | Remover Linha
    div.innerHTML = `
      <select class="item-product" style="flex:2;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
        <option value="">Selecione o produto...</option>
      </select>
      <input type="number" class="item-qty" placeholder="Qtd." min="1" value="${qty || 1}" style="flex:0.5;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
      <input type="number" class="item-price" placeholder="R$ Custo" step="0.01" min="0.01" value="${price || ''}" style="flex:0.7;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
      <button type="button" class="remove-item-btn" title="Remover item da nota" style="flex:0;background:none;border:none;font-size:1.3rem;cursor:pointer;padding:0.5rem">✕</button>
    `;
    
    // Adiciona o nó na div container
    orderItems.appendChild(div);
    
    // Como nós criamos um `select` novo que tá vazio de `<options>`, precisamos forçar o repopulate
    populateSelects(); 
    
    // Assinala o valor (usado na edição de pedido antigo)
    if (productId) {
      const sel = div.querySelector('.item-product');
      if (sel) sel.value = productId;
    }

    // UX: Botão de X Apaga a Si Mesmo
    div.querySelector('.remove-item-btn').addEventListener('click', () => {
      if (orderItems.querySelectorAll('.order-item').length <= 1) {
        app.notify('O pedido precisa conter pelo menos um item.');
        return;
      }
      div.remove();
    });

    // Automação: Ao selecionar um Produto, preencher sozinho a caixinha de Preço pegando do Dataset escondido.
    const productSel = div.querySelector('.item-product');
    if (productSel) {
      productSel.addEventListener('change', () => {
        const selectedOpt = productSel.options[productSel.selectedIndex];
        const priceInput = div.querySelector('.item-price');
        
        // Evita apagar o preço que o usuário digitou manualmente na mão
        if (selectedOpt && selectedOpt.dataset.preco && !priceInput.value) {
          priceInput.value = selectedOpt.dataset.preco;
        }
      });
    }
  }

  /**
   * Gatilho de Interface: Exibe o modal overlay flutuante na tela.
   * Se chamado com OrderID, funciona no modo de "Alteração". Se nulo, modo "Inclusão".
   * 
   * @param {string|null} orderId - O UUID do pedido.
   */
  function openOrderModal(orderId) {
    editingOrderId = orderId;
    modalTitle.textContent = orderId ? 'Editar Pedido de Compra' : 'Novo Pedido de Reposição';
    orderForm.reset();
    orderItems.innerHTML = '';
    
    // Abre já com 1 linha vazia esperando pro usuário não precisar clicar no "+" sozinho
    addOrderItem(null, 1, null); 

    // Lógica de Edição: Busca o JSON do pedido no localstorage e preenche todos os campos
    if (orderId) {
      const orders = getOrders();
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        orderSupplier.value = order.supplierId;
        orderItems.innerHTML = ''; // Limpa a linha inicial e injeta o array completo de compras feitas no passado
        order.items.forEach((item) => {
          addOrderItem(item.productId, item.quantity, item.unitPrice);
        });
      }
    }

    populateSelects();
    modal.style.display = 'flex';
  }

  /**
   * Oculta o dialog overlay por cima do site.
   * @returns {void}
   */
  function closeOrderModal() {
    modal.style.display = 'none';
    editingOrderId = null; // Zera a variável de estado pra não vazar pra próxima vez que abrirem
  }

  /* ================= EVENT LISTENERS (Fluxos do Usuário) ================= */

  /** Controle de Interface: Mudança de Abas (`.tabs`) */
  tabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (!tab) return;

    // Pintura da Interface de Selecionado
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');

    // Display Block/None nas Divs Mães (Uma é invisível, a outra vira visível)
    tabProdutos.style.display = tab === 'produtos' ? '' : 'none';
    tabPedidos.style.display = tab === 'pedidos' ? '' : 'none';

    // Se ele entrou na aba Pedidos, recalcula e repinta a tabela inteira puxando do banco pra evitar desatualização
    if (tab === 'pedidos') renderOrders();
  });

  /** 
   * Botão Verde (Submeter) da Form de "Novo Produto" na Aba Produtos.
   * Executa a API central de validações (`validators.js`)
   */
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const sku = document.getElementById('sku')?.value.trim();
    const nome = document.getElementById('nomeProduto')?.value.trim();
    const preco = Number(document.getElementById('precoProduto')?.value || 0);
    const quantidade = Number(document.getElementById('qtdProduto')?.value || 0);
    
    const products = getProducts();
    const validation = window.ZyonValidators.validateProduct(
      { sku, nome, preco, quantidade },
      { existing: products }
    );

    // Barragem de negócio (Ex: SKU Repetido, Nome curto, etc)
    if (!validation.ok) {
      app.notify(validation.errors[0]);
      return;
    }

    // Injeta e Salva
    products.push({ id: crypto.randomUUID(), sku: sku.toUpperCase(), nome, preco, quantidade });
    setProducts(products);
    
    form.reset();
    app.notify('Produto inserido no catálogo.');
    renderProducts();
  });

  /** 
   * Delegação de Cliques na Tabela Principal de Produtos: Ações de Micro-Ajuste Rápido (+ e -) e Deletar
   */
  tableBody?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const products = getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx < 0) return;

    // +1
    if (action === 'inc') products[idx].quantidade += 1;
    // -1 (Protegido por Math.max pra evitar saldos bizarros e negativos na prateleira)
    if (action === 'dec') products[idx].quantidade = Math.max(0, products[idx].quantidade - 1);
    // Hard Delete
    if (action === 'remove') {
      if(!confirm(`Remover "${products[idx].nome}" permanentemente do inventário?`)) return;
      products.splice(idx, 1);
    }

    setProducts(products);
    renderProducts();
  });

  /** Bind dos botões de controle de fluxo de abertura de tela do Modal de Pedidos */
  btnNewOrder?.addEventListener('click', () => openOrderModal(null));
  cancelOrderBtn?.addEventListener('click', closeOrderModal);
  addItemBtn?.addEventListener('click', () => addOrderItem(null, 1, null));

  /** 
   * SALVAR A EDIÇÃO/CRIAÇÃO DO MODAL DE PEDIDO.
   * Faz a serialização do DOM pra construir o pacote JSON massivo da estrutura `[ { item }, { item } ]`
   */
  orderForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    const supplierId = orderSupplier.value;
    if (!supplierId) { app.notify('Obrigatório escolher o Fornecedor Responsável.'); return; }

    const suppliers = app.getData(app.KEYS.suppliers, []);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) { app.notify('Cadastro do Fornecedor perdido/corrompido.'); return; }

    // Encontra todos os bloquinhos HTML "div.order-item" que representam a grade e varre 1 por 1 lendo os inputs de valor
    const itemRows = orderItems.querySelectorAll('.order-item');
    const items = [];
    let valid = true;

    itemRows.forEach((row) => {
      const productSel = row.querySelector('.item-product');
      const qtyInput = row.querySelector('.item-qty');
      const priceInput = row.querySelector('.item-price');
      
      // Validação boba de sanidade frontend
      if (!productSel?.value || !qtyInput?.value || !priceInput?.value) {
        valid = false;
        return;
      }
      
      items.push({
        productId: productSel.value,
        productName: productSel.options[productSel.selectedIndex]?.textContent || '',
        quantity: Number(qtyInput.value),
        unitPrice: Number(priceInput.value)
      });
    });

    if (!valid || !items.length) {
      app.notify('Existem erros nas linhas. Preencha todos os campos vazios.');
      return;
    }

    const orders = getOrders();
    const now = new Date().toLocaleString('pt-BR');

    if (editingOrderId) {
      // ATUALIZAÇÃO (UPDATE) - Mantém a Array com UUID inalterado
      const idx = orders.findIndex((o) => o.id === editingOrderId);
      if (idx >= 0) {
        orders[idx].supplierId = supplierId;
        orders[idx].supplierName = supplier.nome;
        orders[idx].items = items;
        orders[idx].date = now; // Data de revisão
      }
      app.notify('Nota de Reposição Retificada.');
    } else {
      // CRIAÇÃO (INSERT) - Cria novo pedido como STATUS: PENDENTE (Em andamento/Trânsito)
      orders.push({
        id: crypto.randomUUID(),
        supplierId,
        supplierName: supplier.nome,
        date: now,
        items,
        status: 'Pendente' // <-- CRÍTICO: Não afeta estoques ainda!
      });
      app.notify('Pedido emitido.');
    }

    // Persistência
    setOrders(orders);
    closeOrderModal();
    renderOrders();
  });

  /** Background Click Helper: Clicou no cinza atrás do modal, fecha o modal */
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeOrderModal();
  });

  /** 
   * OPERAÇÕES DE MESA DA TABELA DE PEDIDOS
   * Intercepta qualquer clique dentro do TBody Histórico de Ordens.
   */
  ordersTableBody?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    
    // Dataset Attributes
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const orders = getOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx < 0) return;

    /* AÇÃO VISUAL: Popup Nativo Detalhado ("Extrato" da Compra) */
    if (action === 'view') {
      const o = orders[idx];
      let msg = 'Ordem de Compra: #' + o.id.slice(0, 8) + '\n';
      msg += 'Fornecedor: ' + o.supplierName + '\n';
      msg += 'Criada em: ' + o.date + '\n';
      msg += 'Status Logístico: ' + o.status + '\n\n';
      msg += 'Fatura Declarada:\n';
      o.items.forEach((item, i) => {
        msg += (i + 1) + '. ' + item.productName + ' - Qtd: ' + item.quantity + ' un x R$ ' + item.unitPrice.toFixed(2) + '\n';
      });
      alert(msg);
      return;
    }

    /* AÇÃO CONTÁBIL: MARCAR COMO RECEBIDO.
       Pega a nota do caminhão que chegou na loja e dá CARGA NO ESTOQUE dos produtos envolvidos na transação. */
    if (action === 'receive') {
      if (!confirm('Atenção: Os produtos na nota serão somados ao Saldo Físico na sua prateleira agora. Continuar?')) return;
      
      const products = getProducts();
      const order = orders[idx];
      
      // Laço Matemático Financeiro
      order.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          // ============================================
          // SEGURANÇA: SNAPSHOT DE REVERSÃO
          // ============================================
          // Guarda secretamente quanto do produto tinha ANTES para a gente conseguir desfazer essa ação depois se o usuário errar.
          item.qtyBeforeReceive = prod.quantidade || 0;
          item.qtyReceived = item.quantity;
          
          // Aplicação Físca: Saldo final = Saldo Antigo + Quantidade Chegando na Caixa
          prod.quantidade = item.qtyBeforeReceive + item.qtyReceived;
        }
      });
      
      setProducts(products); // Commit Inventário Físico
      
      // Commit Logístico 
      orders[idx].status = 'Recebido';
      orders[idx].receivedDate = new Date().toLocaleString('pt-BR');
      setOrders(orders);
      
      app.notify('A carga foi contabilizada e recebida! Atualizando estoques.');
      renderProducts(); /* Recarrega visualmente a aba de produtos pra atualizar a Badge de Estoque Baixo se for o caso */
      renderOrders();
      return;
    }

    /* AÇÃO: CANCELAR -> Não mexe na quantidade de nenhum produto (Soft Delete) */
    if (action === 'cancel') {
      if (!confirm('Abortar este pedido junto ao fornecedor?')) return;
      orders[idx].status = 'Cancelado';
      setOrders(orders);
      app.notify('Pedido de compra abortado e cancelado.');
      renderOrders();
      return;
    }

    /* AÇÃO: DELETAR -> Se o botão de apagar não tiver sido bloqueado por uso do produto lá na função do app.js
       ele autoriza reverter tudo. */
    if (action === 'delete') {
      const order = orders[idx];
      const products = getProducts();
      
      // Validador Externo (ZyonApp.canReverseStockReceipt) -> Checa a integridade da equação (ex: o cara já vendeu esse lote, e se eu estornar agora vai bugar as prateleiras no negativo)
      const reverseCheck = app.canReverseStockReceipt(order, products);
      if (!reverseCheck.ok) {
        app.notify(reverseCheck.message); // Explica porque não vai deixar. Ex: "Houve movimentação no saldo".
        return;
      }

      // UX: Avisa que a reversão fará uma mutação matemática reversa se a carga já estava contabilizada
      let msg = 'Excluir esta via no histórico e descartá-la?';
      if (order.status === 'Recebido') {
        msg = 'O sistema atestou que não houve vendas deste lote.\n\nAutorizar estorno do banco de dados e remoção retroativa do estoque?';
      }
      if (!confirm(msg)) return;

      // Se passou nas confirmações, realiza a mutação matemática reversa.
      if (order.status === 'Recebido') {
        order.items.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId);
          if (prod && item.qtyBeforeReceive != null) {
            // Reverte usando nosso Snapshot Secreto
            prod.quantidade = item.qtyBeforeReceive;
          }
        });
        setProducts(products); // Commit Físico
        renderProducts();
      }

      // Destruição do Logístico Histórico
      orders.splice(idx, 1);
      setOrders(orders);
      app.notify('Pedido extraído e removido com segurança.');
      renderOrders();
      return;
    }
  });

  /* ====================================================================
   * INIT: Disparo automático da primeira renderização completa na tela 
   * ==================================================================== */
  renderProducts();
});
