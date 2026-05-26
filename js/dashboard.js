/* === PAINEL PRINCIPAL (Dashboard) === */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();
  const store = app.loadStore();
  const settings = store.settings;
  const salesToday = window.ZyonAnalytics.filterSalesByPeriod(store.sales, 'today');
  const totalToday = window.ZyonAnalytics.sumSalesTotal(salesToday);
  const averageTicket = salesToday.length ? totalToday / salesToday.length : 0;
  const lowStock = store.products.filter((p) => (p.quantidade || 0) <= (settings.lowStockThreshold ?? 10)).length;
  const activeClients = store.clients.filter((c) => c.status === 'Ativo').length;

  app.setText('kpiSalesToday', app.formatCurrency(totalToday));
  app.setText('kpiTicket', app.formatCurrency(averageTicket));
  app.setText('kpiLowStock', `${lowStock} itens`);
  app.setText('kpiClients', String(activeClients));

  app.renderTable(
    document.getElementById('latestSalesBody'),
    [...store.sales].reverse().slice(0, 8).map(
      (sale) => `<tr>
        <td>${app.escapeHtml(sale.customer || 'Consumidor Final')}</td>
        <td>${app.formatCurrency(sale.total || 0)}</td>
        <td>${app.escapeHtml(sale.date || '-')}</td>
      </tr>`
    ),
    3,
    'Nenhuma venda registrada ainda.'
  );
});
