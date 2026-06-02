/* === PDV (PONTO DE VENDA) - vendas.js ===
   - Tela principal de operação do caixa.
   - Gerencia o carrinho de compras (adicionar/remover produtos).
   - Controla descontos, acréscimos e cálculo de troco no checkout.
   - Finaliza a venda descontando o estoque automaticamente.
*/

/**
 * Evento principal acionado quando a página PDV.html é carregada.
 * Gerencia todo o ciclo de vida de uma Venda (Carrinho -> Pagamento -> Baixa de Estoque).
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();

  /* ================= ESTADO INTERNO DO CAIXA (State Management) ================= 
     Estas variáveis guardam os dados vitais da venda atual na memória RAM (Volátil).
     Se a página for recarregada (F5), a venda atual é perdida e o carrinho é limpo.
     Só são salvas no LocalStorage quando o usuário clica em "Finalizar Venda".
  */
  
  /** @type {Array<Object>} Lista de produtos inseridos no carrinho atual. Ex: [{ id: '123', name: 'Arroz', qty: 2, price: 15.50 }] */
  let items = [];
  
  /** @type {Array<Object>} Formas de pagamento passadas pelo cliente. Ex: [{ method: 'Dinheiro', amount: 50.00 }] */
  let payments = [];
  
  /** @type {number} Valor total do desconto aplicado pelo operador (em R$) */
  let discount = 0;
  
  /** @type {number} Valor de taxa/frete extra cobrado do cliente (em R$) */
  let surcharge = 0;

  /* ================= MAPEAMENTO DO DOM (Interface) ================= */
  const seller = document.getElementById('seller');
  const customer = document.getElementById('customer');
  const productSelect = document.getElementById('productSelect');
  const quantityInput = document.getElementById('quantityInput');
  const tableBody = document.getElementById('items-body');
  const paymentList = document.getElementById('payment-list');

  /**
   * Lê os vendedores registrados no banco de dados e cria as opções (`<option>`) 
   * no combobox HTML `<select id="seller">`.
   * Bloqueia a seleção de vendedores marcados como "Inativos".
   * 
   * @returns {void}
   */
  function loadSellerOptions() {
    const sellers = app.getData(app.KEYS.sellers, []);
    seller.innerHTML = sellers.map((s) => 
      `<option value="${s.nome}" ${s.status !== 'Ativo' ? 'disabled' : ''}>${s.nome}${s.status !== 'Ativo' ? ' (Inativo)' : ''}</option>`
    ).join('');
    
    // UX: Se a lista de vendedores for carregada, auto-seleciona o primeiro vendedor Ativo para agilizar a venda.
    if (!seller.value && sellers.length) {
      seller.value = sellers.find((s) => s.status === 'Ativo')?.nome || sellers[0].nome;
    }
  }

  /**
   * Lê os clientes com status 'Ativo' do banco e preenche o combobox de clientes `<select id="customer">`.
   * @returns {void}
   */
  function loadCustomerOptions() {
    const clients = app.getData(app.KEYS.clients, []).filter((c) => c.status === 'Ativo');
    customer.innerHTML = clients.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
  }

  /**
   * Puxa o catálogo de produtos do banco de dados e exibe no `<select id="productSelect">`.
   * Filtro Crítico: Só exibe produtos com `quantidade > 0` para impedir venda de produto zerado.
   * @returns {void}
   */
  function loadProductsOptions() {
    const products = app.getData(app.KEYS.products, []).filter((p) => p.quantidade > 0);
    productSelect.innerHTML = products.map((p) => `<option value="${p.id}">${p.nome} (${p.sku})</option>`).join('');
  }

  /**
   * Motor de Renderização do Carrinho.
   * Apaga a tabela do HTML e a redesenha inteira lendo a variável de estado `items`.
   * 
   * @returns {void}
   */
  function renderItems() {
    tableBody.innerHTML = '';
    items.forEach((item, index) => {
      const tr = document.createElement('tr');
      // Cada linha mostra: Nome | Qtde | Preço Unitário | Preço Total Calculado (Qtde * Preço) | Botão X (Excluir)
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${app.formatCurrency(item.price)}</td>
        <td><strong>${app.formatCurrency(item.qty * item.price)}</strong></td>
        <td style="text-align:center;">
          <!-- O atributo 'data-index' guarda a posição real daquele item dentro da Array 'items' -->
          <button data-index="${index}" class="remove-item-btn" title="Remover item">X</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  /**
   * Calcula o valor bruto dos produtos no carrinho. 
   * Ignora taxas ou descontos adicionais no cálculo.
   * 
   * @returns {number} Somatório em Reais.
   */
  function getSubtotal() {
    return items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  /**
   * Responsável por calcular e pintar na interface todos os números do resumo do caixa
   * (Subtotal, Acréscimo, Desconto e Total Liquido).
   * 
   * @returns {void}
   */
  function updateTotals() {
    const subtotal = getSubtotal();
    
    // O Total Final é igual à soma dos produtos, mais o frete, menos o desconto.
    const total = subtotal + surcharge - discount;
    
    // Atualiza os painéis (Cards HTML)
    document.getElementById('subtotal').textContent = app.formatCurrency(subtotal);
    document.getElementById('discount').textContent = app.formatCurrency(discount);
    document.getElementById('surcharge').textContent = app.formatCurrency(surcharge);
    document.getElementById('total').textContent = app.formatCurrency(total);
    
    // Pega o total pago e subtrai da dívida. O "Math.max" impede que o texto fique negativo (ex: R$ -10,00 a Pagar) caso tenha havido troco.
    document.getElementById('due-amount').textContent = app.formatCurrency(Math.max(total - getTotalPaid(), 0));
    
    // Transporta o nome do cliente selecionado lá em cima pro Modal de Pagamento
    document.getElementById('modal-customer').textContent = customer.value || 'Consumidor Final';
  }

  /**
   * Soma as frações de pagamentos feitas (ex: cliente deu 50 no pix e 20 no dinheiro).
   * @returns {number} O valor total que o caixa já capturou em mãos.
   */
  function getTotalPaid() {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }

  /**
   * Executada dentro do Modal de Checkout.
   * Responsável por calcular o troco e listar graficamente a "Fita" (Extrato) dos pagamentos inseridos.
   * @returns {void}
   */
  function refreshPayments() {
    paymentList.innerHTML = ''; // Limpa a <ul> do modal
    
    // Recria a lista
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
    
    // Matemática do Troco: Se o valor recebido for maior que o preço final da compra, gera o troco. Senão o troco é 0.
    const change = Math.max(paid - total, 0);
    
    // Pinta os valores calculados na tela
    document.getElementById('total-paid').textContent = app.formatCurrency(paid);
    document.getElementById('change').textContent = app.formatCurrency(change);
    document.getElementById('due-amount').textContent = app.formatCurrency(Math.max(total - paid, 0));
  }

  /**
   * Disparada ao clicar no botão [+ Adicionar].
   * Transfere o produto do `<select>` pro carrinho virtual (`items`).
   * Faz a contabilidade crítica de bloqueio de estoque.
   * 
   * @returns {void}
   */
  function addItem() {
    const productId = productSelect.value;
    const qty = Number(quantityInput.value || 1);
    
    if (!productId || qty <= 0) return; // Aborta tentativa de colocar quantidade zero ou negativa

    // Consulta o banco para saber quanto daquele produto existe fisicamente na loja
    const products = app.getData(app.KEYS.products, []);
    const product = products.find((p) => p.id === productId);
    if (!product) return; // Falha de integridade (Ex: produto foi excluído em outra aba)

    /* Verifica se o mesmo produto já estava no carrinho antes de tentarem inserí-lo de novo */
    const already = items.find((i) => i.id === product.id);
    const usedQty = already ? already.qty : 0; // Quantidade atual ocupando espaço no carrinho
    
    // VALIDAÇÃO CRÍTICA DE ESTOQUE MATEMÁTICO:
    // A soma do que já estava no carrinho + o que ele quer colocar AGORA, passa do limite disponível?
    if (usedQty + qty > product.quantidade) {
      app.notify(`Estoque Insuficiente. Restam apenas ${product.quantidade} unidades de ${product.nome}.`);
      return;
    }

    // Se já estava no carrinho (ex: bipou com o leitor de código de barras 2 vezes), apenas incrementa. 
    if (already) {
      already.qty += qty;
    } else {
      // Se for a primeira vez, cria o objeto inteiro.
      items.push({ id: product.id, name: product.nome, qty, price: product.preco });
    }
    
    // Atualiza a tabela HTML e os painéis de dinheiro
    renderItems();
    updateTotals();
    
    // Opcional/UX: Reseta o input de quantidade de volta pra 1
    quantityInput.value = '1';
  }

  /**
   * Destrói a venda em andamento, zerando carrinho, pagamentos, descontos e repintando a tela limpa.
   * Usado para abortar a venda.
   * 
   * @returns {void}
   */
  function clearSale() {
    items = [];
    payments = [];
    discount = 0;
    surcharge = 0;
    
    renderItems();
    refreshPayments();
    updateTotals();
    document.getElementById('modal-item-list').innerHTML = ''; // Esvazia o cupom do modal
  }

  /**
   * Abre o Modal gigante de Checkout quando o usuário clica em "Ir para Pagamento".
   * Renderiza a listinha parecida com "nota fiscal paulista" (extrato de itens).
   * 
   * @returns {void}
   */
  function openModal() {
    const modal = document.getElementById('checkoutModal');
    modal.style.display = 'flex';
    
    const itemList = document.getElementById('modal-item-list');
    itemList.innerHTML = '';

    if (!items.length) {
      itemList.innerHTML = '<li style="color:#9ca3af; text-align:center;">Carrinho Vazio</li>';
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

  /**
   * Oculta o modal de Checkout e retorna à tela do PDV
   * @returns {void}
   */
  function closeModal() {
    document.getElementById('checkoutModal').style.display = 'none';
  }

  /**
   * Registra um evento de injeção de dinheiro no caixa pelo operador.
   * O sistema automaticamente tenta abater o valor que falta pagar integralmente com o método escolhido.
   * 
   * @param {string} method - 'Dinheiro', 'PIX', 'Débito' ou 'Crédito'
   * @returns {void}
   */
  function addPayment(method) {
    const total = getSubtotal() + surcharge - discount;
    const paid = getTotalPaid();
    const remaining = total - paid;
    
    // Prevenção de erro: Tentar registrar o cartão sendo que a conta já foi quitada no dinheiro.
    if (remaining <= 0) {
      app.notify('A venda já foi 100% paga. Você pode finalizá-la.');
      return;
    }
    
    // Adiciona o pagamento no array 
    payments.push({ method, amount: remaining });
    refreshPayments(); 
  }

  /**
   * CORE: FUNÇÃO DE CONCLUSÃO DE VENDA.
   * Disparada quando o operador clica no botão Verde do modal "Finalizar Venda".
   * Realiza a persistência final dos dados e dedução física no armazém.
   * 
   * @returns {void}
   */
  function finalizeSale() {
    const total = getSubtotal() + surcharge - discount;
    
    // Validação de Segurança 1: A venda não tem produtos adicionados, ou total zerado.
    if (!items.length || total <= 0) {
      app.notify('Operação inválida: Adicione produtos na venda.');
      return;
    }
    
    // Validação de Segurança 2: O operador quer emitir o cupom mas ainda falta dinheiro.
    if (getTotalPaid() < total) {
      app.notify('Calote identificado: Finalize os pagamentos faltantes antes de concluir a venda.');
      return;
    }

    /* PASSO 1: Persistência do Histórico Financeiro */
    const sales = app.getData(app.KEYS.sales, []);
    sales.push({
      id: crypto.randomUUID(), // Gera um ID único
      date: new Date().toLocaleString('pt-BR'),
      seller: seller.value,
      customer: customer.value || 'Consumidor Final',
      items, // Grava a array de itens de forma clonada (Snapshpot de como era na época)
      total,
      payments,
      noteNumber: null // A NF-e ainda não foi emitida pela contabilidade, vai nulo.
    });
    // Salva o histórico
    app.setData(app.KEYS.sales, sales);

    /* PASSO 2: Baixa do Estoque (Mover o ativo físico) */
    const products = app.getData(app.KEYS.products, []);
    items.forEach((item) => {
      // Localiza o produto na prateleira real (banco de dados)
      const product = products.find((p) => p.id === item.id);
      if (product) {
        // Reduz a quantidade deduzindo o que o cliente levou. 
        // Math.max evita a catástrofe do estoque virar negativo se der um bug concorrente.
        product.quantidade = Math.max(0, product.quantidade - item.qty);
      }
    });
    // Salva os produtos
    app.setData(app.KEYS.products, products);

    // Conclusão com Sucesso
    app.notify('Venda concluída e faturada com sucesso!');
    closeModal();
    clearSale(); // Reseta o estado do PDV para o próximo cliente da fila
    
    // Repopula a caixa de produtos. Se o cara comprou o último Arroz, o Arroz vai sumir da lista do caixa.
    loadProductsOptions(); 
  }

  // ============================================================================
  // EVENT LISTENERS DE INTERAÇÃO DO USUÁRIO
  // ============================================================================

  // Botão "Adicionar Produto" (Icone de Mais na tela central)
  document.getElementById('addItemBtn')?.addEventListener('click', addItem);
  
  // Botão Vermelho de Aplicar Desconto
  document.getElementById('applyDiscountBtn')?.addEventListener('click', () => {
    // Abre um popup do navegador pra perguntar o valor em R$
    const value = Number(prompt('Aplicar desconto em Reais (R$):', `${discount}`) || 0);
    // Garante que o desconto nunca seja negativo e anômalo
    discount = Math.max(0, value);
    updateTotals(); // Recalcula a conta inteira do lado direito
  });
  
  // Botão Azul de Aplicar Acréscimo / Taxa Extra
  document.getElementById('applySurchargeBtn')?.addEventListener('click', () => {
    const value = Number(prompt('Acréscimo ou Frete em Reais (R$):', `${surcharge}`) || 0);
    surcharge = Math.max(0, value);
    updateTotals();
  });

  // Botão Cancelar (Lixeira Vermelha do PDV)
  document.getElementById('cancelSaleBtn')?.addEventListener('click', () => {
    if(confirm("Deseja realmente abortar e cancelar todos os itens desta venda?")) {
      clearSale();
    }
  });

  document.getElementById('openCheckoutBtn')?.addEventListener('click', openModal);
  document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
  document.getElementById('finalizeSaleBtn')?.addEventListener('click', finalizeSale);
  
  // Botões de forma de pagamento que ficam dentro do Modal
  document.getElementById('payCashBtn')?.addEventListener('click', () => addPayment('Dinheiro'));
  document.getElementById('payPixBtn')?.addEventListener('click', () => addPayment('PIX'));
  document.getElementById('payDebitBtn')?.addEventListener('click', () => addPayment('Débito'));
  document.getElementById('payCreditBtn')?.addEventListener('click', () => addPayment('Crédito'));

  /* 
   * Deletar item do carrinho (Event Delegation).
   * Ouve cliques na tabela inteira, se o clique for num botão de remover, puxa o Index gravado nele.
   */
  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('remove-item-btn')) return;
    
    const index = Number(target.dataset.index);
    items.splice(index, 1); // Splice: Deleta 1 item do array a partir do índice apontado (Index)
    
    // Atualiza interface
    renderItems();
    updateTotals();
  });

  // UX Fix: Fechar o modal ao clicar fora dele (No fundo cinza escuro translúcido)
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('checkoutModal');
    if (event.target === modal) closeModal();
  });

  /* INICIALIZAÇÃO OBRIGATÓRIA DA TELA */
  loadSellerOptions();
  loadCustomerOptions();
  loadProductsOptions();
  clearSale(); // Assegura que todas as variáveis arranquem limpas
});
