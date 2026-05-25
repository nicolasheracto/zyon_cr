document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const form = document.getElementById('productForm');
  const tableBody = document.getElementById('stockTableBody');
  const lowCountEl = document.getElementById('lowStockCount');
  const settings = app.getData(app.KEYS.settings, app.defaults.settings);

  function getProducts() {
    return app.getData(app.KEYS.products, []);
  }

  function setProducts(products) {
    app.setData(app.KEYS.products, products);
  }

  function render() {
    const products = getProducts();
    const lowCount = products.filter((p) => (p.quantidade || 0) <= settings.lowStockThreshold).length;
    if (lowCountEl) lowCountEl.textContent = `${lowCount}`;

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
    render();
  });

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
    render();
  });

  render();
});
