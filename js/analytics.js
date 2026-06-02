/* === ANALYTICS (analytics.js) ===
   - Motor de dados do Zyon ERP
   - Centraliza cálculos matemáticos, cruzamentos de dados e agrupamentos
   - Alimenta o Dashboard e a página de Relatórios
*/

(() => {
  /**
   * Converte uma string de data/hora no padrão brasileiro para um objeto Date nativo do JS.
   * Utilizado para normalizar datas armazenadas como string no LocalStorage antes de ordenações e filtros temporais.
   * 
   * @param {string} value - A string de data (ex: "15/08/2023, 14:30:00")
   * @returns {Date|null} O objeto Date formatado, ou null se a string for inválida.
   */
  function parsePtBrDateTime(value) {
    if (!value) return null;
    
    // Divide a string em "Data" e "Hora" usando a vírgula e espaço padrão do toLocaleString('pt-BR')
    const [datePart, timePart] = String(value).split(', ');
    
    // Extrai dia, mês e ano numéricos
    const [day, month, year] = (datePart || '').split('/').map(Number);
    if (!day || !month || !year) return null;
    
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    // Extrai hora, minuto e segundo se houver a segunda parte
    if (timePart) {
      [hours, minutes, seconds] = timePart.split(':').map(Number);
    }
    
    // Obs: No JavaScript nativo, os meses vão de 0 (Janeiro) a 11 (Dezembro), por isso usamos month - 1
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  }

  /**
   * Filtra uma lista de vendas mantendo apenas aquelas que ocorreram dentro do período solicitado.
   * O cálculo compara as datas ignorando os horários para bater corretamente com os "dias calendários".
   * 
   * @param {Array<Object>} sales - O array completo contendo todas as vendas históricas.
   * @param {string} [period='all'] - O filtro desejado: "all" (tudo), "today" (hoje), "week" (últimos 7 dias), "month" (mês atual do dia 1 até agora).
   * @returns {Array<Object>} Um novo array apenas com as vendas filtradas.
   */
  function filterSalesByPeriod(sales, period = 'all') {
    if (period === 'all') return sales;
    
    const now = new Date();
    // Congela a data no início do dia de hoje (00:00:00) para servir de régua de comparação
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return sales.filter((sale) => {
      const date = parsePtBrDateTime(sale.date);
      if (!date) return false;
      
      if (period === 'today') return date >= startOfToday;
      
      if (period === 'week') {
        const weekAgo = new Date(startOfToday);
        weekAgo.setDate(weekAgo.getDate() - 7); // Retrocede 7 dias no calendário
        return date >= weekAgo;
      }
      
      if (period === 'month') {
        // Trava no dia 1º do mês corrente
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); 
        return date >= monthStart;
      }
      return true;
    });
  }

  /**
   * Calcula o faturamento total acumulado em um array de vendas.
   * 
   * @param {Array<Object>} sales - Array contendo objetos de venda com a propriedade `total`.
   * @returns {number} O valor numérico total faturado (ex: 1540.50).
   */
  function sumSalesTotal(sales) {
    return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
  }

  /**
   * Varre os "carrinhos de compra" de todas as vendas e contabiliza quantos itens de cada produto 
   * foram vendidos e quanto de dinheiro geraram. (Utilizado no Ranking de Produtos mais vendidos).
   * 
   * @param {Array<Object>} sales - Array de vendas, onde cada venda possui um sub-array `items`.
   * @returns {Array<Object>} Uma lista de produtos aglutinados contendo `{name, qty, revenue}`.
   */
  function aggregateProducts(sales) {
    const byProduct = {}; // Dicionário temporário para agrupar as ocorrências usando o nome como chave
    
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
    // Converte o dicionário em um Array limpo
    return Object.values(byProduct);
  }

  /**
   * Agrupa a performance de compras dos clientes, definindo quem comprou mais vezes ou gastou mais dinheiro.
   * 
   * @param {Array<Object>} sales - Array de vendas.
   * @returns {Array<Object>} Uma lista de clientes `{name, purchases, revenue}` ordenada do que gastou MAIS para o que gastou MENOS.
   */
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
    // Exporta o dicionário ordenando de forma decrescente pela receita financeira (b - a)
    return Object.values(byCustomer).sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Extrai e soma os métodos de pagamento (PIX, Dinheiro, Cartão) utilizados nas vendas.
   * Contabiliza pagamentos divididos na mesma nota (ex: R$50 no pix + R$50 no dinheiro).
   * 
   * @param {Array<Object>} sales - Array de vendas com o sub-array `payments`.
   * @returns {Array<Object>} Lista dos métodos de pagamento ordenados pelo volume financeiro transacionado. `{method, total}`.
   */
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

  /**
   * Avalia a performance financeira de cada Vendedor, computando quantas vendas ele fechou e quanto isso gerou em faturamento bruto.
   * 
   * @param {Array<Object>} sales - Array de vendas onde a propriedade `seller` indica o responsável.
   * @returns {Array<Object>} Lista de vendedores ordenados de quem vendeu MAIS para quem vendeu MENOS em reais.
   */
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

  /**
   * Função Orquestradora: Recebe as tabelas "cruas" do banco de dados (ZyonApp.db) e 
   * mastiga todos os dados, gerando um "Relatório Mestre" categorizado. 
   * Essa função processa todas as informações utilizadas pelo Dashboard e pelas abas da tela de Relatórios.
   * 
   * @param {Object} data - Objeto contendo todas as entidades (tabelas) do ERP.
   * @param {Array<Object>} data.sales - Vendas históricas.
   * @param {Array<Object>} data.products - Catálogo de produtos.
   * @param {Array<Object>} data.clients - Cadastro de clientes.
   * @param {Array<Object>} data.sellers - Cadastro de vendedores.
   * @param {Array<Object>} data.suppliers - Cadastro de fornecedores.
   * @param {Array<Object>} data.fiscalNotes - Notas fiscais emitidas.
   * @param {Array<Object>} data.stockOrders - Pedidos de compra com fornecedores.
   * @param {Object} data.settings - Preferências do sistema.
   * @param {string} [period='all'] - O filtro temporal das análises financeiras.
   * 
   * @returns {Object} Um relatório complexo onde cada chave representa um painel da interface (ex: `summary`, `billing`, `products`).
   */
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

    // Aplica a limitação de data em cima do array principal de vendas antes de calcular qualquer grana
    const filteredSales = filterSalesByPeriod(sales, period);
    
    // Métricas Financeiras Fundamentais
    const revenue = sumSalesTotal(filteredSales);
    const salesCount = filteredSales.length;
    // O Ticket Médio é o Faturamento dividido pelo Número de transações (Cuidado com divisão por zero)
    const averageTicket = salesCount ? revenue / salesCount : 0;
    
    // Cálculos de Imobilizado de Estoque
    // Multiplica o Custo/Preço pela quantidade em prateleira para saber quanto dinheiro a loja tem parado em mercadorias
    const stockValue = products.reduce((sum, p) => sum + (p.preco || 0) * (p.quantidade || 0), 0);
    const threshold = settings.lowStockThreshold ?? 10;
    const lowStockProducts = products.filter((p) => (p.quantidade || 0) <= threshold);
    
    // Aglutinação dos Rankings que populam as tabelas detalhadas
    const productStats = aggregateProducts(filteredSales);
    const topByQty = [...productStats].sort((a, b) => b.qty - a.qty).slice(0, 10); // Corta os 10 primeiros
    const topByRevenue = [...productStats].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const customerStats = aggregateCustomers(filteredSales);
    
    // Classificação de Clientes por Status
    const activeClients = clients.filter((c) => c.status === 'Ativo').length;
    const inactiveClients = clients.length - activeClients;

    // Métricas exclusivas de "Hoje" (independente do filtro que o usuário clicou no Dropdown)
    // Usado nos painéis que exigem o tempo real comparado com o histórico.
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const salesToday = sales.filter((s) => (s.date || '').includes(todayStr));
    const revenueToday = sumSalesTotal(salesToday);

    // O Retorno gigante, mapeado perfeitamente para as Abas do Front-End (relatorios.js / dashboard.js) consumirem.
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
        recentSales: [...filteredSales].reverse().slice(0, 15) // Clona, Inverte cronologia e Pega as últimas 15 vendas
      },
      products: {
        topByQty,
        topByRevenue,
        lowStock: lowStockProducts,
        // Inventário ordenado do que mais tem grana parada (Quantidade x Preço)
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

  // ============================================================================
  // EXPORTAÇÃO GLOBAL
  // Disponibiliza as funções na janela do navegador para serem usadas em relatorios.js e dashboard.js
  // ============================================================================
  window.ZyonAnalytics = {
    parsePtBrDateTime,
    filterSalesByPeriod,
    sumSalesTotal,
    buildReport
  };
})();
