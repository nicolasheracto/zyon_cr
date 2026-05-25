/* === GESTÃO DE ESTOQUE (estoque.html) ===
   - Aba "Produtos": cadastro, listagem e ajuste manual de quantidade
   - Aba "Pedidos": criação, recebimento e cancelamento de pedidos de compra
   - Ao receber um pedido, as quantidades dos produtos são atualizadas automaticamente */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  /* === REFERÊNCIAS AOS ELEMENTOS DOM === */

  /* Aba Produtos */
  const form = document.getElementById('productForm');
  const tableBody = document.getElementById('stockTableBody');
  const lowCountEl = document.getElementById('lowStockCount');
  const lowStockBadge = document.getElementById('lowStockBadge');
  const settings = app.getData(app.KEYS.settings, app.defaults.settings);

  /* Aba Pedidos */
  const ordersTableBody = document.getElementById('ordersTableBody');
  const modal = document.getElementById('orderModal');
  const modalTitle = document.getElementById('modalTitle');
  const orderForm = document.getElementById('orderForm');
  const orderSupplier = document.getElementById('orderSupplier');
  const orderItems = document.getElementById('orderItems');
  const addItemBtn = document.getElementById('addItemBtn');
  const cancelOrderBtn = document.getElementById('cancelOrderBtn');
  const btnNewOrder = document.getElementById('btnNewOrder');

  /* Navegação por abas */
  const tabs = document.getElementById('estoqueTabs');
  const tabProdutos = document.getElementById('tabProdutos');
  const tabPedidos = document.getElementById('tabPedidos');

  let editingOrderId = null; /* ID do pedido sendo editado (null = novo pedido) */

  /* === FUNÇÕES DE ACESSO A DADOS === */

  function getProducts() {
    return app.getData(app.KEYS.products, []);
  }

  function setProducts(products) {
    app.setData(app.KEYS.products, products);
  }

  function getOrders() {
    return app.getData(app.KEYS.stockOrders, []);
  }

  function setOrders(orders) {
    app.setData(app.KEYS.stockOrders, orders);
  }

  /* === RENDERIZAÇÃO DA ABA PRODUTOS === */

  function renderProducts() {
    const products = getProducts();
    /* Calcula quantos produtos estão com estoque baixo */
    const lowCount = products.filter((p) => (p.quantidade || 0) <= settings.lowStockThreshold).length;
    if (lowCountEl) lowCountEl.textContent = `${lowCount}`;
    if (lowStockBadge) lowStockBadge.style.display = lowCount > 0 ? 'inline-block' : 'none';

    tableBody.innerHTML = '';
    if (!products.length) {
      tableBody.innerHTML = '<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>';
      return;
    }

    products.forEach((p) => {
      const isLow = (p.quantidade || 0) <= settings.lowStockThreshold;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.sku}</td>
        <td>${p.nome}</td>
        <td>${app.formatCurrency(p.preco)}</td>
        <td>${p.quantidade}</td>
        <td>${isLow ? '<span class="status-badge status-inactive">Baixo</span>' : '<span class="status-badge status-active">OK</span>'}</td>
        <td class="action-btns">
          <span data-id="${p.id}" data-action="inc" title="Adicionar 1">➕</span>
          <span data-id="${p.id}" data-action="dec" title="Remover 1">➖</span>
          <span data-id="${p.id}" data-action="remove" title="Excluir">🗑️</span>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /* === RENDERIZAÇÃO DA ABA PEDIDOS === */

  function renderOrders() {
    const orders = getOrders();
    ordersTableBody.innerHTML = '';
    if (!orders.length) {
      ordersTableBody.innerHTML = '<tr><td colspan="7">Nenhum pedido encontrado.</td></tr>';
      return;
    }

    /* Exibe os pedidos do mais recente para o mais antigo */
    orders.slice().reverse().forEach((order) => {
      const tr = document.createElement('tr');
      const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
      const total = order.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
      const isPending = order.status === 'Pendente';

      tr.innerHTML = `
        <td><strong>#${order.id.slice(0, 8)}</strong></td>
        <td>${order.supplierName}</td>
        <td>${order.date}</td>
        <td>${itemCount} itens</td>
        <td>${app.formatCurrency(total)}</td>
        <td><span class="status-badge ${isPending ? 'status-inactive' : 'status-active'}">${order.status}</span></td>
        <td class="action-btns">
          ${isPending ? '<span title="Receber" data-action="receive" data-id="' + order.id + '">✅ Receber</span>' : ''}
          ${isPending ? '<span title="Cancelar" data-action="cancel" data-id="' + order.id + '">🚫 Cancelar</span>' : ''}
          <span title="Visualizar" data-action="view" data-id="${order.id}">👁️</span>
        </td>
      `;
      ordersTableBody.appendChild(tr);
    });
  }

  /* === FUNÇÕES DO MODAL DE PEDIDOS === */

  /* Popula os selects de fornecedores (do cadastro) e produtos */
  function populateSelects() {
    const suppliers = app.getData(app.KEYS.suppliers, []).filter((s) => s.status === 'Ativo');
    orderSupplier.innerHTML = '<option value="">Selecione...</option>';
    suppliers.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nome + (s.documento ? ' - ' + s.documento : '');
      orderSupplier.appendChild(opt);
    });

    const products = getProducts();
    document.querySelectorAll('.item-product').forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = '<option value="">Selecione o produto...</option>';
      products.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.sku + ' - ' + p.nome + ' (R$ ' + p.preco?.toFixed(2) + ')';
        opt.dataset.preco = p.preco; /* Armazena o preço para auto-preenchimento */
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    });
  }

  /* Adiciona uma linha de item no formulário do pedido */
  function addOrderItem(productId, qty, price) {
    const div = document.createElement('div');
    div.className = 'row order-item';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <select class="item-product" style="flex:2;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
        <option value="">Selecione o produto...</option>
      </select>
      <input type="number" class="item-qty" placeholder="Qtd" min="1" value="${qty || 1}" style="flex:0.5;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
      <input type="number" class="item-price" placeholder="Preço unit." step="0.01" min="0.01" value="${price || ''}" style="flex:0.7;padding:0.75rem;border:1px solid var(--border);border-radius:8px" required>
      <button type="button" class="remove-item-btn" title="Remover item" style="flex:0;background:none;border:none;font-size:1.3rem;cursor:pointer;padding:0.5rem">✕</button>
    `;
    orderItems.appendChild(div);
    populateSelects();
    if (productId) {
      const sel = div.querySelector('.item-product');
      if (sel) sel.value = productId;
    }

    /* Botão para remover esta linha de item (mínimo 1 item) */
    div.querySelector('.remove-item-btn').addEventListener('click', () => {
      if (orderItems.querySelectorAll('.order-item').length <= 1) {
        app.notify('O pedido precisa de pelo menos 1 item.');
        return;
      }
      div.remove();
    });

    /* Auto-preenche o preço ao selecionar um produto */
    const productSel = div.querySelector('.item-product');
    if (productSel) {
      productSel.addEventListener('change', () => {
        const selectedOpt = productSel.options[productSel.selectedIndex];
        const priceInput = div.querySelector('.item-price');
        if (selectedOpt && selectedOpt.dataset.preco && !priceInput.value) {
          priceInput.value = selectedOpt.dataset.preco;
        }
      });
    }
  }

  /* Abre o modal para criar ou editar um pedido */
  function openOrderModal(orderId) {
    editingOrderId = orderId;
    modalTitle.textContent = orderId ? 'Editar Pedido' : 'Novo Pedido de Estoque';
    orderForm.reset();
    orderItems.innerHTML = '';
    addOrderItem(null, 1, null); /* Adiciona primeira linha vazia */

    /* Se for edição, carrega os dados do pedido existente */
    if (orderId) {
      const orders = getOrders();
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        orderSupplier.value = order.supplierId;
        orderItems.innerHTML = '';
        order.items.forEach((item) => {
          addOrderItem(item.productId, item.quantity, item.unitPrice);
        });
      }
    }

    populateSelects();
    modal.style.display = 'flex';
  }

  /* Fecha o modal de pedido */
  function closeOrderModal() {
    modal.style.display = 'none';
    editingOrderId = null;
  }

  /* === EVENT LISTENERS === */

  /* Navegação por abas */
  tabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (!tab) return;

    tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');

    tabProdutos.style.display = tab === 'produtos' ? '' : 'none';
    tabPedidos.style.display = tab === 'pedidos' ? '' : 'none';

    if (tab === 'pedidos') renderOrders();
  });

  /* Cadastro de novo produto (aba Produtos) */
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const sku = document.getElementById('sku')?.value.trim();
    const nome = document.getElementById('nomeProduto')?.value.trim();
    const preco = Number(document.getElementById('precoProduto')?.value || 0);
    const quantidade = Number(document.getElementById('qtdProduto')?.value || 0);

    if (!sku || !nome || preco <= 0 || quantidade < 0) {
      app.notify('Preencha os dados do produto corretamente.');
      return;
    }

    const products = getProducts();
    products.push({ id: crypto.randomUUID(), sku, nome, preco, quantidade });
    setProducts(products);
    form.reset();
    app.notify('Produto cadastrado.');
    renderProducts();
  });

  /* Ajuste manual de estoque (➕, ➖, 🗑️) na tabela de produtos */
  tableBody?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const products = getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx < 0) return;

    if (action === 'inc') products[idx].quantidade += 1;
    if (action === 'dec') products[idx].quantidade = Math.max(0, products[idx].quantidade - 1);
    if (action === 'remove') products.splice(idx, 1);

    setProducts(products);
    renderProducts();
  });

  /* Botões do modal de pedido */
  btnNewOrder?.addEventListener('click', () => openOrderModal(null));
  cancelOrderBtn?.addEventListener('click', closeOrderModal);
  addItemBtn?.addEventListener('click', () => addOrderItem(null, 1, null));

  /* Submit do formulário de pedido (cria ou edita) */
  orderForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    const supplierId = orderSupplier.value;
    if (!supplierId) { app.notify('Selecione um fornecedor.'); return; }

    const suppliers = app.getData(app.KEYS.suppliers, []);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) { app.notify('Fornecedor não encontrado.'); return; }

    /* Coleta os itens do formulário */
    const itemRows = orderItems.querySelectorAll('.order-item');
    const items = [];
    let valid = true;

    itemRows.forEach((row) => {
      const productSel = row.querySelector('.item-product');
      const qtyInput = row.querySelector('.item-qty');
      const priceInput = row.querySelector('.item-price');
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
      app.notify('Preencha todos os itens corretamente.');
      return;
    }

    const orders = getOrders();
    const now = new Date().toLocaleString('pt-BR');

    if (editingOrderId) {
      /* Edição de pedido existente */
      const idx = orders.findIndex((o) => o.id === editingOrderId);
      if (idx >= 0) {
        orders[idx].supplierId = supplierId;
        orders[idx].supplierName = supplier.nome;
        orders[idx].items = items;
        orders[idx].date = now;
      }
      app.notify('Pedido atualizado.');
    } else {
      /* Criação de novo pedido com status "Pendente" */
      orders.push({
        id: crypto.randomUUID(),
        supplierId,
        supplierName: supplier.nome,
        date: now,
        items,
        status: 'Pendente'
      });
      app.notify('Pedido criado com sucesso.');
    }

    setOrders(orders);
    closeOrderModal();
    renderOrders();
  });

  /* Fecha modal ao clicar no fundo escuro */
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeOrderModal();
  });

  /* Ações na tabela de pedidos: visualizar, receber, cancelar */
  ordersTableBody?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;

    const orders = getOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx < 0) return;

    /* Visualizar detalhes do pedido */
    if (action === 'view') {
      const o = orders[idx];
      let msg = 'Pedido: #' + o.id.slice(0, 8) + '\n';
      msg += 'Fornecedor: ' + o.supplierName + '\n';
      msg += 'Data: ' + o.date + '\n';
      msg += 'Status: ' + o.status + '\n\n';
      msg += 'Itens:\n';
      o.items.forEach((item, i) => {
        msg += (i + 1) + '. ' + item.productName + ' - Qtd: ' + item.quantity + ' x R$ ' + item.unitPrice.toFixed(2) + '\n';
      });
      alert(msg);
      return;
    }

    /* Receber pedido: atualiza o estoque e marca como "Recebido" */
    if (action === 'receive') {
      if (!confirm('Receber este pedido? O estoque será atualizado.')) return;
      const products = getProducts();
      const order = orders[idx];
      order.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          prod.quantidade = (prod.quantidade || 0) + item.quantity;
        }
      });
      setProducts(products);
      orders[idx].status = 'Recebido';
      orders[idx].receivedDate = new Date().toLocaleString('pt-BR');
      setOrders(orders);
      app.notify('Pedido recebido! Estoque atualizado.');
      renderProducts(); /* Atualiza a tabela de produtos com as novas quantidades */
      renderOrders();
      return;
    }

    /* Cancelar pedido: apenas altera o status */
    if (action === 'cancel') {
      if (!confirm('Cancelar este pedido?')) return;
      orders[idx].status = 'Cancelado';
      setOrders(orders);
      app.notify('Pedido cancelado.');
      renderOrders();
      return;
    }
  });

  /* Renderiza a aba Produtos na inicialização */
  renderProducts();
});
