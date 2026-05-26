/* === RELATÓRIOS (relatorios.html) === */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();
  const analytics = window.ZyonAnalytics;
  const periodSelect = document.getElementById('reportPeriod');
  const periodLabel = document.getElementById('reportPeriodLabel');
  const tabs = document.querySelectorAll('.report-tab');
  const panels = document.querySelectorAll('.report-panel');

  const periodLabels = {
    all: 'todo o período',
    today: 'hoje',
    week: 'últimos 7 dias',
    month: 'mês atual'
  };

  function statusBadge(status) {
    const active = status === 'Ativo';
    const cls = active ? 'status-active' : 'status-inactive';
    return `<span class="status-badge ${cls}">${app.escapeHtml(status)}</span>`;
  }

  function renderStatList(el, items) {
    if (!el) return;
    el.innerHTML = items
      .map(({ label, value }) => `<li><span>${app.escapeHtml(label)}</span><strong>${app.escapeHtml(value)}</strong></li>`)
      .join('');
  }

  function pct(part, total) {
    if (!total) return '0%';
    return `${((part / total) * 100).toFixed(1)}%`;
  }

  function refresh() {
    const period = periodSelect?.value || 'all';
    const store = app.loadStore();
    const report = analytics.buildReport(store, period);

    if (periodLabel) {
      periodLabel.textContent = `Exibindo: ${periodLabels[period] || period}`;
    }

    const s = report.summary;
    app.setText('reportRevenue', app.formatCurrency(s.revenue));
    app.setText('reportSalesCount', String(s.salesCount));
    app.setText('reportAverageTicket', app.formatCurrency(s.averageTicket));
    app.setText('reportStockValue', app.formatCurrency(s.stockValue));
    app.setText('reportActiveClients', String(s.activeClients));
    app.setText('reportLowStock', `${s.lowStockCount} itens`);

    renderStatList(document.getElementById('billingStats'), [
      { label: 'Faturamento no período', value: app.formatCurrency(s.revenue) },
      { label: 'Quantidade de vendas', value: String(s.salesCount) },
      { label: 'Ticket médio', value: app.formatCurrency(s.averageTicket) },
      { label: 'Faturamento hoje (geral)', value: app.formatCurrency(s.revenueToday) },
      { label: 'Vendas hoje (geral)', value: String(s.salesTodayCount) }
    ]);

    const paymentTotal = report.billing.paymentMethods.reduce((acc, p) => acc + p.total, 0);
    app.renderTable(
      document.getElementById('paymentMethodsBody'),
      report.billing.paymentMethods.map(
        (p) => `<tr>
          <td>${app.escapeHtml(p.method)}</td>
          <td>${app.formatCurrency(p.total)}</td>
          <td>${pct(p.total, paymentTotal)}</td>
        </tr>`
      ),
      3,
      'Nenhum pagamento registrado no período.'
    );

    app.renderTable(
      document.getElementById('periodSalesBody'),
      report.billing.recentSales.map(
        (sale) => `<tr>
          <td>${app.escapeHtml(sale.date || '-')}</td>
          <td>${app.escapeHtml(sale.customer || 'Consumidor Final')}</td>
          <td>${app.escapeHtml(sale.seller || '-')}</td>
          <td>${(sale.items || []).length}</td>
          <td>${app.formatCurrency(sale.total || 0)}</td>
        </tr>`
      ),
      5,
      'Nenhuma venda no período selecionado.'
    );

    app.renderTable(
      document.getElementById('topProductsQtyBody'),
      report.products.topByQty.map(
        (p) => `<tr>
          <td>${app.escapeHtml(p.name)}</td>
          <td>${p.qty}</td>
          <td>${app.formatCurrency(p.revenue)}</td>
        </tr>`
      ),
      3,
      'Sem movimentação de produtos no período.'
    );

    app.renderTable(
      document.getElementById('topProductsRevenueBody'),
      report.products.topByRevenue.map(
        (p) => `<tr>
          <td>${app.escapeHtml(p.name)}</td>
          <td>${app.formatCurrency(p.revenue)}</td>
          <td>${p.qty}</td>
        </tr>`
      ),
      3,
      'Sem receita por produto no período.'
    );

    app.renderTable(
      document.getElementById('lowStockBody'),
      report.products.lowStock.map(
        (p) => `<tr>
          <td>${app.escapeHtml(p.sku || '-')}</td>
          <td>${app.escapeHtml(p.nome)}</td>
          <td>${p.quantidade ?? 0}</td>
          <td>${app.formatCurrency(p.preco)}</td>
        </tr>`
      ),
      4,
      'Nenhum produto com estoque baixo.'
    );

    app.renderTable(
      document.getElementById('inventoryBody'),
      report.products.inventory.map((p) => {
        const lineTotal = (p.preco || 0) * (p.quantidade || 0);
        return `<tr>
          <td>${app.escapeHtml(p.sku || '-')}</td>
          <td>${app.escapeHtml(p.nome)}</td>
          <td>${p.quantidade ?? 0}</td>
          <td>${app.formatCurrency(p.preco)}</td>
          <td>${app.formatCurrency(lineTotal)}</td>
        </tr>`;
      }),
      5,
      'Nenhum produto cadastrado.'
    );

    renderStatList(document.getElementById('clientsStats'), [
      { label: 'Total cadastrados', value: String(s.clientsTotal) },
      { label: 'Ativos', value: String(s.activeClients) },
      { label: 'Inativos', value: String(s.inactiveClients) },
      { label: 'Com compras no período', value: String(report.clients.topCustomers.length) }
    ]);

    app.renderTable(
      document.getElementById('topCustomersBody'),
      report.clients.topCustomers.map(
        (c) => `<tr>
          <td>${app.escapeHtml(c.name)}</td>
          <td>${c.purchases}</td>
          <td>${app.formatCurrency(c.revenue)}</td>
        </tr>`
      ),
      3,
      'Nenhum cliente com compras no período.'
    );

    app.renderTable(
      document.getElementById('clientsListBody'),
      report.clients.registered.map(
        (c) => `<tr>
          <td>${app.escapeHtml(c.nome)}</td>
          <td>${app.escapeHtml(c.documento || '-')}</td>
          <td>${app.escapeHtml(c.contato || '-')}</td>
          <td>${statusBadge(c.status)}</td>
        </tr>`
      ),
      4,
      'Nenhum cliente cadastrado.'
    );

    app.renderTable(
      document.getElementById('sellersPerformanceBody'),
      report.team.sellers.map(
        (v) => `<tr>
          <td>${app.escapeHtml(v.name)}</td>
          <td>${v.sales}</td>
          <td>${app.formatCurrency(v.revenue)}</td>
        </tr>`
      ),
      3,
      'Nenhuma venda por vendedor no período.'
    );

    app.renderTable(
      document.getElementById('sellersListBody'),
      report.team.registered.map(
        (v) => `<tr>
          <td>${app.escapeHtml(v.nome)}</td>
          <td>${v.comissao != null ? `${v.comissao}%` : '-'}</td>
          <td>${statusBadge(v.status)}</td>
        </tr>`
      ),
      3,
      'Nenhum vendedor cadastrado.'
    );

    const ops = report.operations;
    renderStatList(document.getElementById('opsStats'), [
      { label: 'NF-e autorizadas', value: String(report.summary.fiscalNotesAuthorized ?? ops.fiscalNotesTotal) },
      { label: 'NF-e canceladas', value: String(report.summary.fiscalNotesCancelled ?? 0) },
      { label: 'Pedidos de reposição', value: String(ops.stockOrdersTotal) },
      { label: 'Pedidos pendentes', value: String(ops.pendingStockOrders) },
      { label: 'Produtos em estoque baixo', value: String(s.lowStockCount) }
    ]);

    renderStatList(document.getElementById('suppliersStats'), [
      { label: 'Fornecedores cadastrados', value: String(s.suppliersTotal) },
      { label: 'Fornecedores ativos', value: String(ops.suppliersActive) }
    ]);

    renderStatList(document.getElementById('opsReference'), [
      { label: 'Produtos no catálogo', value: String(s.productsTotal) },
      { label: 'Valor total em estoque', value: app.formatCurrency(s.stockValue) },
      { label: 'Vendedores cadastrados', value: String(s.sellersTotal) }
    ]);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((panel) => {
        const isActive = panel.dataset.panel === target;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
      });
    });
  });

  periodSelect?.addEventListener('change', refresh);
  refresh();
});
