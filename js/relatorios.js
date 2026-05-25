document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const sales = app.getData(app.KEYS.sales, []);
  const products = app.getData(app.KEYS.products, []);
  const clients = app.getData(app.KEYS.clients, []);

  const totalRevenue = app.sumSalesTotal(sales);
  const totalSales = sales.length;
  const averageTicket = totalSales ? totalRevenue / totalSales : 0;
  const stockValue = products.reduce((sum, p) => sum + (p.preco * p.quantidade), 0);

  document.getElementById('reportRevenue').textContent = app.formatCurrency(totalRevenue);
  document.getElementById('reportSalesCount').textContent = `${totalSales}`;
  document.getElementById('reportAverageTicket').textContent = app.formatCurrency(averageTicket);
  document.getElementById('reportStockValue').textContent = app.formatCurrency(stockValue);
  document.getElementById('reportClientsCount').textContent = `${clients.length}`;

  const soldByProduct = {};
  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      soldByProduct[item.name] = (soldByProduct[item.name] || 0) + item.qty;
    });
  });

  const topProductsBody = document.getElementById('topProductsBody');
  topProductsBody.innerHTML = '';
  const entries = Object.entries(soldByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entries.length) {
    topProductsBody.innerHTML = '<tr><td colspan="2">Sem dados de venda para análise.</td></tr>';
    return;
  }
  entries.forEach(([name, qty]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>${qty}</td>`;
    topProductsBody.appendChild(tr);
  });
});
