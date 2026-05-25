/* === PDV (PONTO DE VENDA) - vendas.html ===
   - Gerencia o fluxo completo de venda:
     seleção de vendedor/cliente, adição de itens, descontos/acréscimos,
     checkout com múltiplas formas de pagamento e finalização */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  /* Estado interno da venda atual */
  let items = [];         /* Itens adicionados ao carrinho */
  let payments = [];      /* Pagamentos registrados */
  let discount = 0;       /* Valor do desconto em R$ */
  let surcharge = 0;      /* Valor do acréscimo em R$ */

  /* Referências aos elementos do DOM */
  const seller = document.getElementById('seller');
  const customer = document.getElementById('customer');
  const productSelect = document.getElementById('productSelect');
  const quantityInput = document.getElementById('quantityInput');
  const tableBody = document.getElementById('items-body');
  const paymentList = document.getElementById('payment-list');

  /* Carrega os vendedores ativos no select */
  function loadSellerOptions() {
    const sellers = app.getData(app.KEYS.sellers, []);
    seller.innerHTML = sellers.map((s) => `<option value="${s.nome}" ${s.status !== 'Ativo' ? 'disabled' : ''}>${s.nome}${s.status !== 'Ativo' ? ' (Inativo)' : ''}</option>`).join('');
    if (!seller.value && sellers.length) seller.value = sellers.find((s) => s.status === 'Ativo')?.nome || sellers[0].nome;
  }

  /* Carrega os clientes ativos no select */
  function loadCustomerOptions() {
    const clients = app.getData(app.KEYS.clients, []).filter((c) => c.status === 'Ativo');
    customer.innerHTML = clients.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
  }

  /* Carrega os produtos com estoque disponível no select */
  function loadProductsOptions() {
    const products = app.getData(app.KEYS.products, []).filter((p) => p.quantidade > 0);
    productSelect.innerHTML = products.map((p) => `<option value="${p.id}">${p.nome} (${p.sku})</option>`).join('');
  }

  /* Renderiza a tabela de itens do carrinho */
  function renderItems() {
    tableBody.innerHTML = '';
    items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${app.formatCurrency(item.price)}</td>
        <td>${app.formatCurrency(item.qty * item.price)}</td>
        <td style="text-align:center;"><button data-index="${index}" class="remove-item-btn">X</button></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /* Calcula o subtotal (soma de todos os itens sem descontos) */
  function getSubtotal() {
    return items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  /* Atualiza todos os totais na interface (subtotal, desconto, acréscimo, total) */
  function updateTotals() {
    const subtotal = getSubtotal();
    const total = subtotal + surcharge - discount;
    document.getElementById('subtotal').textContent = app.formatCurrency(subtotal);
    document.getElementById('discount').textContent = app.formatCurrency(discount);
    document.getElementById('surcharge').textContent = app.formatCurrency(surcharge);
    document.getElementById('total').textContent = app.formatCurrency(total);
    document.getElementById('due-amount').textContent = app.formatCurrency(Math.max(total - getTotalPaid(), 0));
    document.getElementById('modal-customer').textContent = customer.value || 'Consumidor Final';
  }

  /* Retorna o total pago até o momento */
  function getTotalPaid() {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }

  /* Atualiza a lista de pagamentos e o troco no modal de checkout */
  function refreshPayments() {
    paymentList.innerHTML = '';
    payments.forEach((p) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.padding = '0.5rem 0';
      li.innerHTML = `<span>${p.method}</span><strong>${app.formatCurrency(p.amount)}</strong>`;
      paymentList.appendChild(li);
    });

    const total = getSubtotal() + surcharge - discount;
    const paid = getTotalPaid();
    const change = Math.max(paid - total, 0);
    document.getElementById('total-paid').textContent = app.formatCurrency(paid);
    document.getElementById('change').textContent = app.formatCurrency(change);
    document.getElementById('due-amount').textContent = app.formatCurrency(Math.max(total - paid, 0));
  }

  /* Adiciona um produto ao carrinho, validando estoque */
  function addItem() {
    const productId = productSelect.value;
    const qty = Number(quantityInput.value || 1);
    if (!productId || qty <= 0) return;

    const products = app.getData(app.KEYS.products, []);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    /* Verifica se o produto já está no carrinho e calcula quantidade total usada */
    const already = items.find((i) => i.id === product.id);
    const usedQty = already ? already.qty : 0;
    if (usedQty + qty > product.quantidade) {
      app.notify('Quantidade acima do disponível em estoque.');
      return;
    }

    /* Adiciona ou incrementa o item no carrinho */
    if (already) {
      already.qty += qty;
    } else {
      items.push({ id: product.id, name: product.nome, qty, price: product.preco });
    }
    renderItems();
    updateTotals();
  }

  /* Limpa todos os dados da venda atual (novo carrinho) */
  function clearSale() {
    items = [];
    payments = [];
    discount = 0;
    surcharge = 0;
    renderItems();
    refreshPayments();
    updateTotals();
    document.getElementById('modal-item-list').innerHTML = '';
  }

  /* Abre o modal de checkout */
  function openModal() {
    const modal = document.getElementById('checkoutModal');
    modal.style.display = 'flex';
    const itemList = document.getElementById('modal-item-list');
    itemList.innerHTML = '';

    if (!items.length) {
      itemList.innerHTML = '<li style="color:#9ca3af; text-align:center;">Nenhum item adicionado</li>';
    } else {
      items.forEach((item) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '0.5rem 0';
        li.innerHTML = `<span>${item.qty}x ${item.name}</span><strong>${app.formatCurrency(item.qty * item.price)}</strong>`;
        itemList.appendChild(li);
      });
    }
    updateTotals();
    refreshPayments();
  }

  /* Fecha o modal de checkout */
  function closeModal() {
    document.getElementById('checkoutModal').style.display = 'none';
  }

  /* Adiciona um pagamento (preenche o valor restante automaticamente) */
  function addPayment(method) {
    const total = getSubtotal() + surcharge - discount;
    const paid = getTotalPaid();
    const remaining = total - paid;
    if (remaining <= 0) {
      app.notify('Pagamento já completo.');
      return;
    }
    payments.push({ method, amount: remaining });
    refreshPayments();
  }

  /* Finaliza a venda: salva no localStorage, atualiza estoque e limpa o carrinho */
  function finalizeSale() {
    const total = getSubtotal() + surcharge - discount;
    if (!items.length || total <= 0) {
      app.notify('Adicione itens à venda.');
      return;
    }

    if (getTotalPaid() < total) {
      app.notify('Pagamento pendente.');
      return;
    }

    /* Salva a venda */
    const sales = app.getData(app.KEYS.sales, []);
    sales.push({
      id: crypto.randomUUID(),
      date: new Date().toLocaleString('pt-BR'),
      seller: seller.value,
      customer: customer.value || 'Consumidor Final',
      items,
      total,
      payments,
      noteNumber: null
    });
    app.setData(app.KEYS.sales, sales);

    /* Atualiza o estoque (diminui a quantidade dos produtos vendidos) */
    const products = app.getData(app.KEYS.products, []);
    items.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) product.quantidade = Math.max(0, product.quantidade - item.qty);
    });
    app.setData(app.KEYS.products, products);

    app.notify('Venda finalizada com sucesso.');
    closeModal();
    clearSale();
    loadProductsOptions(); /* Recarrega produtos para refletir novo estoque */
  }

  /* === EVENT LISTENERS === */

  document.getElementById('addItemBtn')?.addEventListener('click', addItem);
  document.getElementById('applyDiscountBtn')?.addEventListener('click', () => {
    const value = Number(prompt('Desconto (R$):', `${discount}`) || 0);
    discount = Math.max(0, value);
    updateTotals();
  });
  document.getElementById('applySurchargeBtn')?.addEventListener('click', () => {
    const value = Number(prompt('Acréscimo (R$):', `${surcharge}`) || 0);
    surcharge = Math.max(0, value);
    updateTotals();
  });
  document.getElementById('cancelSaleBtn')?.addEventListener('click', clearSale);
  document.getElementById('openCheckoutBtn')?.addEventListener('click', openModal);
  document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
  document.getElementById('finalizeSaleBtn')?.addEventListener('click', finalizeSale);
  document.getElementById('payCashBtn')?.addEventListener('click', () => addPayment('Dinheiro'));
  document.getElementById('payPixBtn')?.addEventListener('click', () => addPayment('PIX'));
  document.getElementById('payDebitBtn')?.addEventListener('click', () => addPayment('Débito'));
  document.getElementById('payCreditBtn')?.addEventListener('click', () => addPayment('Crédito'));

  /* Remove item do carrinho ao clicar no X */
  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('remove-item-btn')) return;
    const index = Number(target.dataset.index);
    items.splice(index, 1);
    renderItems();
    updateTotals();
  });

  /* Fecha modal ao clicar fora do conteúdo */
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('checkoutModal');
    if (event.target === modal) closeModal();
  });

  /* Inicialização: carrega selects e limpa venda */
  loadSellerOptions();
  loadCustomerOptions();
  loadProductsOptions();
  clearSale();
});
