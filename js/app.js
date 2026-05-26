/* === MÓDULO PRINCIPAL (app.js) ===
   - Gerencia acesso ao localStorage (chaves e dados padrão)
   - Fornece funções utilitárias para todas as páginas
   - Expõe o objeto global ZyonApp com todos os recursos compartilhados */

(() => {
  /* Chaves do localStorage para cada tipo de dado */
  const KEYS = {
    clients: 'zyon_clients',        /* Clientes cadastrados */
    products: 'zyon_products',       /* Produtos em estoque */
    sales: 'zyon_sales',             /* Vendas realizadas */
    fiscalNotes: 'zyon_fiscal_notes',/* Notas fiscais emitidas */
    fiscalConfig: 'zyon_fiscal_config', /* Emitente NF-e (tela fiscal) */
    settings: 'zyon_settings',       /* Configurações gerais do sistema */
    sellers: 'zyon_sellers',         /* Vendedores cadastrados */
    suppliers: 'zyon_suppliers',     /* Fornecedores cadastrados */
    stockOrders: 'zyon_stock_orders' /* Pedidos de reposição de estoque */
  };

  /* Dados padrão (seed) — usados na primeira execução ou quando não há dados salvos */
  const defaults = {
    settings: {
      companyName: 'Zyon ERP',
      lowStockThreshold: 10
    },
    fiscalConfig: {
      razaoSocial: 'Zyon Comércio Ltda',
      cnpj: '12.345.678/0001-90',
      ie: '123.456.789.012',
      endereco: 'Av. Comercial, 1000 - Centro - São Paulo/SP',
      serie: '1'
    },
    clients: [
      {
        id: crypto.randomUUID(),
        nome: 'Consumidor Final',     /* Cliente padrão para vendas sem CPF */
        documento: '000.000.000-00',
        contato: 'CF',
        status: 'Ativo',
        tipo: 'pf'
      },
      {
        id: crypto.randomUUID(),
        nome: 'João Silva',
        documento: '123.456.789-00',
        contato: 'joao.silva@email.com',
        status: 'Ativo',
        tipo: 'pf'
      }
    ],
    products: [
      /* Produtos de exemplo para demonstração inicial */
      { id: crypto.randomUUID(), sku: 'P001', nome: 'Arroz 5kg', preco: 29.9, quantidade: 24 },
      { id: crypto.randomUUID(), sku: 'P002', nome: 'Feijão 1kg', preco: 8.5, quantidade: 8 },
      { id: crypto.randomUUID(), sku: 'P003', nome: 'Óleo 900ml', preco: 7.9, quantidade: 14 }
    ],
    sales: [],       /* Nenhuma venda inicialmente */
    fiscalNotes: [], /* Nenhuma nota fiscal inicialmente */
    sellers: [
      /* Vendedor padrão de exemplo */
      { id: crypto.randomUUID(), nome: 'Carlos Vendedor', documento: '111.222.333-44', contato: 'carlos@email.com', comissao: 5, status: 'Ativo' }
    ],
    suppliers: [
      /* Fornecedor padrão de exemplo */
      { id: crypto.randomUUID(), nome: 'Distribuidora ABC Ltda', documento: '00.000.000/0001-00', contato: 'abc@distribuidora.com', endereco: 'Av. Principal, 1000', status: 'Ativo' }
    ],
    stockOrders: []  /* Nenhum pedido inicialmente */
  };

  /* Lê dados do localStorage; retorna fallback se não existir */
  function getData(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback; /* Em caso de erro (JSON inválido), retorna fallback */
    }
  }

  /* Salva dados no localStorage como JSON */
  function setData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /* Garante que os dados padrão sejam salvos na primeira execução */
  function ensureSeedData() {
    if (!localStorage.getItem(KEYS.settings)) setData(KEYS.settings, defaults.settings);
    if (!localStorage.getItem(KEYS.fiscalConfig)) {
      const settings = getData(KEYS.settings, defaults.settings);
      const legacy = settings.fiscal || {};
      setData(KEYS.fiscalConfig, {
        razaoSocial: legacy.razaoSocial || defaults.fiscalConfig.razaoSocial,
        cnpj: legacy.cnpj || defaults.fiscalConfig.cnpj,
        ie: legacy.ie || defaults.fiscalConfig.ie,
        endereco: legacy.endereco || defaults.fiscalConfig.endereco,
        serie: legacy.serie || defaults.fiscalConfig.serie
      });
    }
    if (!localStorage.getItem(KEYS.clients)) {
      setData(KEYS.clients, defaults.clients);
    } else {
      const clients = getData(KEYS.clients, []);
      if (!Array.isArray(clients)) setData(KEYS.clients, defaults.clients);
    }
    if (!localStorage.getItem(KEYS.products)) setData(KEYS.products, defaults.products);
    if (!localStorage.getItem(KEYS.sales)) setData(KEYS.sales, defaults.sales);
    if (!localStorage.getItem(KEYS.fiscalNotes)) setData(KEYS.fiscalNotes, defaults.fiscalNotes);
    if (!localStorage.getItem(KEYS.sellers)) setData(KEYS.sellers, defaults.sellers);
    if (!localStorage.getItem(KEYS.suppliers)) setData(KEYS.suppliers, defaults.suppliers);
    if (!localStorage.getItem(KEYS.stockOrders)) setData(KEYS.stockOrders, defaults.stockOrders);
  }

  /* Formata valor numérico como moeda BRL (R$ 1.234,56) */
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  /* Retorna a data/hora atual formatada no padrão pt-BR */
  function nowPtBr() {
    return new Date().toLocaleString('pt-BR');
  }

  /* Inicia o relógio em tempo real em um elemento HTML pelo ID */
  function startClock(elementId = 'clock') {
    const clockEl = document.getElementById(elementId);
    if (!clockEl) return;
    const render = () => {
      clockEl.textContent = nowPtBr();
    };
    render();
    setInterval(render, 1000); /* Atualiza a cada 1 segundo */
  }

  /* Aplica o nome da empresa (vindo das configurações) em elementos com classe .js-company-name */
  function applyBranding() {
    const settings = getData(KEYS.settings, defaults.settings);
    document.querySelectorAll('.js-company-name').forEach((el) => {
      el.textContent = settings.companyName || 'Zyon ERP';
    });
  }

  /* Exibe uma notificação toast (mensagem flutuante por 2 segundos) */
  function notify(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300); /* Remove do DOM após animação */
    }, 2000);
  }

  /* Soma o total de um array de vendas */
  function sumSalesTotal(sales) {
    return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initPage() {
    startClock();
    applyBranding();
    return window.ZyonApp;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderTable(tbody, rows, emptyColspan, emptyMessage) {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${emptyColspan}" class="table-empty">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.join('');
  }

  function loadStore() {
    return {
      sales: getData(KEYS.sales, []),
      products: getData(KEYS.products, []),
      clients: getData(KEYS.clients, []),
      sellers: getData(KEYS.sellers, []),
      suppliers: getData(KEYS.suppliers, []),
      fiscalNotes: getData(KEYS.fiscalNotes, []),
      stockOrders: getData(KEYS.stockOrders, []),
      settings: getData(KEYS.settings, defaults.settings)
    };
  }

  function clientHasLinkedSales(clientName, sales = null) {
    const list = sales ?? getData(KEYS.sales, []);
    if (!Array.isArray(list)) return false;
    const name = String(clientName ?? '').trim();
    return list.some((sale) => String(sale.customer ?? '').trim() === name);
  }

  function sellerHasLinkedSales(sellerName, sales = null) {
    const list = sales ?? getData(KEYS.sales, []);
    if (!Array.isArray(list)) return false;
    const name = String(sellerName ?? '').trim();
    return list.some((sale) => String(sale.seller ?? '').trim() === name);
  }

  function canReverseStockReceipt(order, products) {
    if (!order || order.status !== 'Recebido') return { ok: true };

    for (const item of order.items || []) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        return { ok: false, message: 'Produto do pedido não encontrado no estoque.' };
      }

      const qtyReceived = item.qtyReceived ?? item.quantity ?? 0;
      if (item.qtyBeforeReceive == null) {
        return {
          ok: false,
          message: `Pedido #${order.id.slice(0, 8)}: recepção sem rastreio. Não é possível excluir com segurança.`
        };
      }

      const expectedQty = item.qtyBeforeReceive + qtyReceived;
      if (prod.quantidade !== expectedQty) {
        return {
          ok: false,
          message: `Houve movimentação no estoque de "${prod.nome}". Exclusão da recepção não permitida.`
        };
      }
    }

    return { ok: true };
  }

  /* Popula dados iniciais se necessário */
  ensureSeedData();

  /* Expõe as funções e constantes globalmente para uso em todas as páginas */
  window.ZyonApp = {
    KEYS,
    defaults,
    getData,
    setData,
    formatCurrency,
    startClock,
    applyBranding,
    notify,
    sumSalesTotal,
    escapeHtml,
    initPage,
    setText,
    renderTable,
    loadStore,
    clientHasLinkedSales,
    sellerHasLinkedSales,
    canReverseStockReceipt
  };
})();
