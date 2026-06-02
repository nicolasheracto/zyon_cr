/* === PAINEL PRINCIPAL (Dashboard - dashboard.js) === 
   - Exibe métricas diárias, número de clientes e estoque baixo.
   - Lista as últimas vendas na tabela principal.
*/

/**
 * Evento principal disparado quando a página `dashboard.html` termina de carregar no navegador.
 * Orquestra o carregamento do banco local, cruzamento de métricas do dia e exibição na tela.
 * 
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa recursos globais do Zyon (relógio, nome da marca/franquia)
  const app = window.ZyonApp.initPage();
  
  // Carrega todas as tabelas (vendas, produtos, clientes, configs) do localStorage "banco de dados em cache"
  const store = app.loadStore();
  const settings = store.settings;
  
  // ==========================================================
  // CÁLCULO DE KPIs (Indicadores-chave de desempenho)
  // ==========================================================

  // Filtra o banco histórico de vendas pegando apenas as que ocorreram no dia de "Hoje"
  const salesToday = window.ZyonAnalytics.filterSalesByPeriod(store.sales, 'today');
  
  // Soma o Faturamento Bruto (Total em R$) dessas vendas do dia
  const totalToday = window.ZyonAnalytics.sumSalesTotal(salesToday);
  
  // Calcula o Ticket Médio de hoje (Faturamento dividido pela Quantidade de vendas).
  // Se não houver vendas, define como 0 para evitar divisão por zero (NaN).
  const averageTicket = salesToday.length ? totalToday / salesToday.length : 0;
  
  // Conta quantos produtos no catálogo inteiro estão com a quantidade física igual ou abaixo do limite de alerta.
  // Utiliza a configuração global `lowStockThreshold`, assumindo 10 como padrão (fallback) caso não exista.
  const lowStock = store.products.filter((p) => (p.quantidade || 0) <= (settings.lowStockThreshold ?? 10)).length;
  
  // Conta o total absoluto de clientes na base de dados com o status setado como "Ativo"
  const activeClients = store.clients.filter((c) => c.status === 'Ativo').length;

  // ==========================================================
  // ATUALIZAÇÃO DO DOM (Interface Gráfica)
  // ==========================================================

  // Injeta os valores formatados diretamente nas tags de HTML (Cartões Superiores do Dashboard)
  app.setText('kpiSalesToday', app.formatCurrency(totalToday)); // Ex: R$ 1.500,00
  app.setText('kpiTicket', app.formatCurrency(averageTicket));   // Ex: R$ 50,00
  app.setText('kpiLowStock', `${lowStock} itens`);               // Ex: 3 itens
  app.setText('kpiClients', String(activeClients));              // Ex: 145

  // ==========================================================
  // RENDERIZAÇÃO DE TABELA (Feed de Últimas Vendas)
  // ==========================================================

  /**
   * Preenche o `<tbody>` da tabela de Últimas Vendas do Dashboard.
   * Transforma as vendas mais recentes em linhas de tabela HTML (<tr> e <td>).
   */
  app.renderTable(
    document.getElementById('latestSalesBody'), // Elemento alvo da página html
    
    // Processamento: 
    // 1. Clona o array original de vendas [...store.sales]
    // 2. Inverte a cronologia para a mais recente ficar no topo (.reverse())
    // 3. Pega apenas os 8 primeiros registros (.slice(0, 8))
    // 4. Mapeia o objeto em uma string HTML (.map())
    [...store.sales].reverse().slice(0, 8).map(
      (sale) => `<tr>
        <td>${app.escapeHtml(sale.customer || 'Consumidor Final')}</td>
        <td><strong>${app.formatCurrency(sale.total || 0)}</strong></td>
        <td>${app.escapeHtml(sale.date || '-')}</td>
      </tr>`
    ),
    3, // colspan: Define o tamanho da célula vazia caso não haja vendas no histórico
    'Nenhuma venda registrada ainda no sistema.' // Fallback: Mensagem de tabela vazia
  );
});
