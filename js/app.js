(() => {
  const KEYS = {
    clients: 'zyon_clients',
    products: 'zyon_products',
    sales: 'zyon_sales',
    fiscalNotes: 'zyon_fiscal_notes',
    settings: 'zyon_settings',
    sellers: 'zyon_sellers',
    suppliers: 'zyon_suppliers',
    stockOrders: 'zyon_stock_orders'
  };

  const defaults = {
    settings: {
      companyName: 'Zyon ERP',
      lowStockThreshold: 10
    },
    clients: [
      {
        id: crypto.randomUUID(),
        nome: 'Consumidor Final',
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
      {
        id: crypto.randomUUID(),
        sku: 'P001',
        nome: 'Arroz 5kg',
        preco: 29.9,
        quantidade: 24
      },
      {
        id: crypto.randomUUID(),
        sku: 'P002',
        nome: 'Feijão 1kg',
        preco: 8.5,
        quantidade: 8
      },
      {
        id: crypto.randomUUID(),
        sku: 'P003',
        nome: 'Óleo 900ml',
        preco: 7.9,
        quantidade: 14
      }
    ],
    sales: [],
    fiscalNotes: [],
    sellers: [
      {
        id: crypto.randomUUID(),
        nome: 'Carlos Vendedor',
        documento: '111.222.333-44',
        contato: 'carlos@email.com',
        comissao: 5,
        status: 'Ativo'
      }
    ],
    suppliers: [
      {
        id: crypto.randomUUID(),
        nome: 'Distribuidora ABC Ltda',
        documento: '00.000.000/0001-00',
        contato: 'abc@distribuidora.com',
        endereco: 'Av. Principal, 1000',
        status: 'Ativo'
      }
    ],
    stockOrders: []
  };

  function getData(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureSeedData() {
    if (!localStorage.getItem(KEYS.settings)) setData(KEYS.settings, defaults.settings);
    if (!localStorage.getItem(KEYS.clients)) setData(KEYS.clients, defaults.clients);
    if (!localStorage.getItem(KEYS.products)) setData(KEYS.products, defaults.products);
    if (!localStorage.getItem(KEYS.sales)) setData(KEYS.sales, defaults.sales);
    if (!localStorage.getItem(KEYS.fiscalNotes)) setData(KEYS.fiscalNotes, defaults.fiscalNotes);
    if (!localStorage.getItem(KEYS.sellers)) setData(KEYS.sellers, defaults.sellers);
    if (!localStorage.getItem(KEYS.suppliers)) setData(KEYS.suppliers, defaults.suppliers);
    if (!localStorage.getItem(KEYS.stockOrders)) setData(KEYS.stockOrders, defaults.stockOrders);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  function nowPtBr() {
    return new Date().toLocaleString('pt-BR');
  }

  function startClock(elementId = 'clock') {
    const clockEl = document.getElementById(elementId);
    if (!clockEl) return;
    const render = () => {
      clockEl.textContent = nowPtBr();
    };
    render();
    setInterval(render, 1000);
  }

  function applyBranding() {
    const settings = getData(KEYS.settings, defaults.settings);
    document.querySelectorAll('.js-company-name').forEach((el) => {
      el.textContent = settings.companyName || 'Zyon ERP';
    });
  }

  function notify(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function sumSalesTotal(sales) {
    return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
  }

  ensureSeedData();

  window.ZyonApp = {
    KEYS,
    defaults,
    getData,
    setData,
    formatCurrency,
    startClock,
    applyBranding,
    notify,
    sumSalesTotal
  };
})();
