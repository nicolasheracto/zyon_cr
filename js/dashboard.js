document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const clients = app.getData(app.KEYS.clients, []);
  const products = app.getData(app.KEYS.products, []);
  const sales = app.getData(app.KEYS.sales, []);
  const settings = app.getData(app.KEYS.settings, app.defaults.settings);

  const today = new Date().toLocaleDateString('pt-BR');
  const salesToday = sales.filter((sale) => (sale.date || '').includes(today));
  const totalToday = app.sumSalesTotal(salesToday);
  const averageTicket = salesToday.length ? totalToday / salesToday.length : 0;
  const lowStock = products.filter((p) => (p.quantidade || 0) <= settings.lowStockThreshold).length;
  const activeClients = clients.filter((c) => c.status === 'Ativo').length;

  const kpiSalesToday = document.getElementById('kpiSalesToday');
  const kpiTicket = document.getElementById('kpiTicket');
  const kpiLowStock = document.getElementById('kpiLowStock');
  const kpiClients = document.getElementById('kpiClients');

  if (kpiSalesToday) kpiSalesToday.textContent = app.formatCurrency(totalToday);
  if (kpiTicket) kpiTicket.textContent = app.formatCurrency(averageTicket);
  if (kpiLowStock) kpiLowStock.textContent = `${lowStock} itens`;
  if (kpiClients) kpiClients.textContent = `${activeClients}`;

  const latestSalesBody = document.getElementById('latestSalesBody');
  if (!latestSalesBody) return;

  latestSalesBody.innerHTML = '';
  const recent = [...sales].slice(-5).reverse();
  if (!recent.length) {
    latestSalesBody.innerHTML = '<tr><td colspan="3">Nenhuma venda registrada ainda.</td></tr>';
    return;
  }

  recent.forEach((sale) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sale.customer || 'Consumidor Final'}</td>
      <td>${app.formatCurrency(sale.total || 0)}</td>
      <td>${sale.date || '-'}</td>
    `;
    latestSalesBody.appendChild(tr);
  });
});
