/* === ANALYTICS (analytics.js) ===
   - Cálculos centralizados para dashboard e relatórios */

(() => {
  function parsePtBrDateTime(value) {
    if (!value) return null;
    const [datePart, timePart] = String(value).split(', ');
    const [day, month, year] = (datePart || '').split('/').map(Number);
    if (!day || !month || !year) return null;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (timePart) {
      [hours, minutes, seconds] = timePart.split(':').map(Number);
    }
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  }

  function filterSalesByPeriod(sales, period = 'all') {
    if (period === 'all') return sales;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return sales.filter((sale) => {
      const date = parsePtBrDateTime(sale.date);
      if (!date) return false;
      if (period === 'today') return date >= startOfToday;
      if (period === 'week') {
        const weekAgo = new Date(startOfToday);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      }
      if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= monthStart;
      }
      return true;
    });
  }

  function sumSalesTotal(sales) {
    return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
  }

  function aggregateProducts(sales) {
    const byProduct = {};
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const key = item.name || 'Sem nome';
        if (!byProduct[key]) {
          byProduct[key] = { name: key, qty: 0, revenue: 0 };
        }
        byProduct[key].qty += item.qty || 0;
        byProduct[key].revenue += (item.qty || 0) * (item.price || 0);
      });
    });
    return Object.values(byProduct);
  }

  function aggregateCustomers(sales) {
    const byCustomer = {};
    sales.forEach((sale) => {
      const name = sale.customer || 'Consumidor Final';
      if (!byCustomer[name]) {
        byCustomer[name] = { name, purchases: 0, revenue: 0 };
      }
      byCustomer[name].purchases += 1;
      byCustomer[name].revenue += sale.total || 0;
    });
    return Object.values(byCustomer).sort((a, b) => b.revenue - a.revenue);
  }

  function aggregatePaymentMethods(sales) {
    const methods = {};
    sales.forEach((sale) => {
      (sale.payments || []).forEach((payment) => {
        const method = payment.method || 'Outros';
        methods[method] = (methods[method] || 0) + (payment.amount || 0);
      });
    });
    return Object.entries(methods)
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
  }

  function aggregateSellers(sales) {
    const bySeller = {};
    sales.forEach((sale) => {
      const name = sale.seller || 'Não informado';
      if (!bySeller[name]) {
        bySeller[name] = { name, sales: 0, revenue: 0 };
      }
      bySeller[name].sales += 1;
      bySeller[name].revenue += sale.total || 0;
    });
    return Object.values(bySeller).sort((a, b) => b.revenue - a.revenue);
  }

  function buildReport(data, period = 'all') {
    const {
      sales = [],
      products = [],
      clients = [],
      sellers = [],
      suppliers = [],
      fiscalNotes = [],
      stockOrders = [],
      settings = {}
    } = data;

    const filteredSales = filterSalesByPeriod(sales, period);
    const revenue = sumSalesTotal(filteredSales);
    const salesCount = filteredSales.length;
    const averageTicket = salesCount ? revenue / salesCount : 0;
    const stockValue = products.reduce((sum, p) => sum + (p.preco || 0) * (p.quantidade || 0), 0);
    const threshold = settings.lowStockThreshold ?? 10;
    const lowStockProducts = products.filter((p) => (p.quantidade || 0) <= threshold);
    const productStats = aggregateProducts(filteredSales);
    const topByQty = [...productStats].sort((a, b) => b.qty - a.qty).slice(0, 10);
    const topByRevenue = [...productStats].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const customerStats = aggregateCustomers(filteredSales);
    const activeClients = clients.filter((c) => c.status === 'Ativo').length;
    const inactiveClients = clients.length - activeClients;

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const salesToday = sales.filter((s) => (s.date || '').includes(todayStr));
    const revenueToday = sumSalesTotal(salesToday);

    return {
      period,
      summary: {
        revenue,
        salesCount,
        averageTicket,
        stockValue,
        clientsTotal: clients.length,
        activeClients,
        inactiveClients,
        productsTotal: products.length,
        lowStockCount: lowStockProducts.length,
        sellersTotal: sellers.length,
        suppliersTotal: suppliers.length,
        fiscalNotesTotal: fiscalNotes.length,
        fiscalNotesAuthorized: fiscalNotes.filter((n) => (n.status || 'Autorizada') === 'Autorizada').length,
        fiscalNotesCancelled: fiscalNotes.filter((n) => n.status === 'Cancelada').length,
        revenueToday,
        salesTodayCount: salesToday.length
      },
      billing: {
        paymentMethods: aggregatePaymentMethods(filteredSales),
        recentSales: [...filteredSales].reverse().slice(0, 15)
      },
      products: {
        topByQty,
        topByRevenue,
        lowStock: lowStockProducts,
        inventory: [...products].sort((a, b) => (b.preco * b.quantidade) - (a.preco * a.quantidade))
      },
      clients: {
        topCustomers: customerStats.slice(0, 10),
        registered: clients
      },
      team: {
        sellers: aggregateSellers(filteredSales),
        registered: sellers
      },
      operations: {
        pendingStockOrders: stockOrders.filter((o) => o.status !== 'Recebido').length,
        stockOrdersTotal: stockOrders.length,
        fiscalNotesTotal: fiscalNotes.length,
        fiscalNotesAuthorized: fiscalNotes.filter((n) => (n.status || 'Autorizada') === 'Autorizada').length,
        fiscalNotesCancelled: fiscalNotes.filter((n) => n.status === 'Cancelada').length,
        suppliersActive: suppliers.filter((s) => s.status === 'Ativo').length
      }
    };
  }

  window.ZyonAnalytics = {
    parsePtBrDateTime,
    filterSalesByPeriod,
    sumSalesTotal,
    buildReport
  };
})();
