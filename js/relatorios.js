/* === MÓDULO DE RELATÓRIOS (relatorios.js) ===
   - Responsável por ler os dados consolidados pelo Motor Analytics (ZyonAnalytics)
   - Exibe estatísticas financeiras, operacionais e listagens em abas e painéis.
*/

document.addEventListener('DOMContentLoaded', () => {
  // Inicialização padrão: liga o relógio, branding e pega a referência global
  const app = window.ZyonApp.initPage();
  
  // Pegamos o motor de Analytics que também foi carregado no HTML
  const an = window.ZyonAnalytics;

  // Seletores do DOM que vamos manipular com frequência
  const periodSelect = document.getElementById('reportPeriod'); // Dropdown: Hoje, 7 Dias, Mês...
  const periodLabel = document.getElementById('reportPeriodLabel'); // Texto indicando o período atual
  
  // As abas (faturamento, produtos, clientes, etc.) e seus respectivos painéis de conteúdo
  const tabs = document.querySelectorAll('.report-tab');
  const panels = document.querySelectorAll('.report-panel');

  /**
   * Função utilitária para renderizar rapidamente uma lista HTML (`<ul>`) de estatísticas 
   * no formato "Chave: Valor" separados em lados opostos usando Flexbox.
   * 
   * @param {HTMLElement} ulElement - O elemento `<ul>` que vai receber os itens.
   * @param {Array<{label: string, value: string}>} items - Lista de objetos contendo o rótulo e o valor a ser exibido.
   * @returns {void} Não retorna nada, apenas manipula o DOM.
   */
  function renderStatList(ulElement, items) {
    if (!ulElement) return;
    ulElement.innerHTML = items.map((item) => `
      <li>
        <span>${app.escapeHtml(item.label)}</span>
        <strong>${app.escapeHtml(item.value)}</strong>
      </li>
    `).join('');
  }

  /**
   * Preenche todos os painéis e abas da tela de Relatórios com base no período de datas selecionado.
   * É a função central desta tela, englobando a injeção de dados no HTML.
   * 
   * Fluxo:
   * 1. Descobre qual é o período selecionado no Dropdown (Hoje, 7 Dias, etc).
   * 2. Pede ao ZyonAnalytics para processar/mastigar todos os dados do banco dentro desse período.
   * 3. Atualiza os "Cartões Coloridos" (KPIs) na parte superior.
   * 4. Preenche as tabelas da Aba de Faturamento.
   * 5. Preenche as tabelas da Aba de Produtos e Estoque.
   * 6. Preenche as tabelas da Aba de Clientes.
   * 7. Preenche as tabelas da Aba da Equipe (Vendedores).
   * 8. Preenche as listas da Aba Operacional.
   * 
   * @returns {void}
   */
  function refresh() {
    const period = periodSelect?.value || 'all';
    
    // Atualiza o texto visual de qual período está ativo
    if (periodLabel && periodSelect) {
      periodLabel.textContent = `Exibindo: ${periodSelect.options[periodSelect.selectedIndex].text.toLowerCase()}`;
    }

    // 2. CHAMA O MOTOR DE ANÁLISE PASSANDO O PERÍODO
    // s = Stats (Estatísticas prontas para uso)
    const s = an.analyzeAll(period);

    // ==========================================================
    // 3. ATUALIZAR CARDS SUPERIORES (KPIs GERAIS)
    // ==========================================================
    app.setText('reportRevenue', app.formatCurrency(s.totalRevenue));
    app.setText('reportSalesCount', String(s.salesCount));
    app.setText('reportAverageTicket', app.formatCurrency(s.averageTicket));
    app.setText('reportStockValue', app.formatCurrency(s.stockValue));
    app.setText('reportActiveClients', String(s.clientsCount));
    app.setText('reportLowStock', String(s.lowStockCount));

    // ==========================================================
    // 4. ABA FATURAMENTO
    // ==========================================================
    renderStatList(document.getElementById('billingStats'), [
      { label: 'Receita Bruta', value: app.formatCurrency(s.totalRevenue) },
      { label: 'Quantidade de Vendas', value: String(s.salesCount) },
      { label: 'Ticket Médio', value: app.formatCurrency(s.averageTicket) },
      { label: 'Descontos Concedidos', value: app.formatCurrency(s.totalDiscounts) },
      { label: 'Acréscimos/Taxas', value: app.formatCurrency(s.totalSurcharges) }
    ]);

    // Tabela: Formas de Pagamento mais usadas
    app.renderTable(
      document.getElementById('paymentMethodsBody'),
      s.paymentsBreakdown.map((pm) => `
        <tr>
          <td>${app.escapeHtml(pm.method)}</td>
          <td>${app.formatCurrency(pm.total)}</td>
          <td>${pm.percentage}%</td>
        </tr>
      `),
      3,
      'Nenhum pagamento registrado no período.'
    );

    // Tabela: Extrato Completo de Vendas (As últimas que ocorreram no período)
    app.renderTable(
      document.getElementById('periodSalesBody'),
      s.filteredSales.map((sale) => `
        <tr>
          <td>${app.escapeHtml(sale.date)}</td>
          <td>${app.escapeHtml(sale.customer)}</td>
          <td>${app.escapeHtml(sale.seller)}</td>
          <td>${(sale.items || []).reduce((acc, i) => acc + (i.qty || 1), 0)}</td>
          <td><strong>${app.formatCurrency(sale.total)}</strong></td>
        </tr>
      `),
      5,
      'Nenhuma venda neste período.'
    );

    // ==========================================================
    // 5. ABA PRODUTOS E ESTOQUE
    // ==========================================================
    
    // Top Produtos (Por Volume Vendido)
    app.renderTable(
      document.getElementById('topProductsQtyBody'),
      s.topProductsByQty.map((p) => `
        <tr>
          <td>${app.escapeHtml(p.name)}</td>
          <td>${p.qty}</td>
          <td>${app.formatCurrency(p.revenue)}</td>
        </tr>
      `),
      3,
      'Sem dados de vendas.'
    );

    // Top Produtos (Por Receita Financeira)
    app.renderTable(
      document.getElementById('topProductsRevenueBody'),
      s.topProductsByRevenue.map((p) => `
        <tr>
          <td>${app.escapeHtml(p.name)}</td>
          <td><strong>${app.formatCurrency(p.revenue)}</strong></td>
          <td>${p.qty}</td>
        </tr>
      `),
      3,
      'Sem dados de vendas.'
    );

    // Tabela: Produtos que estão acabando (Abaixo da linha de corte de segurança)
    app.renderTable(
      document.getElementById('lowStockBody'),
      s.lowStockProducts.map((p) => `
        <tr>
          <td>${app.escapeHtml(p.sku)}</td>
          <td>${app.escapeHtml(p.nome)}</td>
          <td><strong style="color:var(--red)">${p.quantidade}</strong></td>
          <td>${app.formatCurrency(p.preco)}</td>
        </tr>
      `),
      4,
      'Nenhum produto com estoque baixo.'
    );

    // Tabela: Inventário total (Posição Atual do Estoque Geral)
    app.renderTable(
      document.getElementById('inventoryBody'),
      s.allProducts.map((p) => `
        <tr>
          <td>${app.escapeHtml(p.sku)}</td>
          <td>${app.escapeHtml(p.nome)}</td>
          <td>${p.quantidade}</td>
          <td>${app.formatCurrency(p.preco)}</td>
          <td>${app.formatCurrency((p.preco || 0) * (p.quantidade || 0))}</td>
        </tr>
      `),
      5,
      'Nenhum produto cadastrado no catálogo.'
    );

    // ==========================================================
    // 6. ABA CLIENTES
    // ==========================================================
    renderStatList(document.getElementById('clientsStats'), [
      { label: 'Total de clientes', value: String(s.clientsCount) },
      { label: 'Clientes inativos', value: String(s.inactiveClients) },
      { label: 'Pessoas Físicas (PF)', value: String(s.pfCount) },
      { label: 'Pessoas Jurídicas (PJ)', value: String(s.pjCount) }
    ]);

    // Top Clientes que mais gastaram dinheiro
    app.renderTable(
      document.getElementById('topCustomersBody'),
      s.topCustomers.map((c) => `
        <tr>
          <td>${app.escapeHtml(c.name)}</td>
          <td>${c.count}</td>
          <td><strong>${app.formatCurrency(c.total)}</strong></td>
        </tr>
      `),
      3,
      'Sem vendas associadas a clientes neste período.'
    );

    // Lista crua de todos os clientes cadastrados
    app.renderTable(
      document.getElementById('clientsListBody'),
      s.allClients.map((c) => `
        <tr>
          <td>${app.escapeHtml(c.nome)}</td>
          <td>${app.escapeHtml(c.documento)}</td>
          <td>${app.escapeHtml(c.contato || '-')}</td>
          <td>${app.escapeHtml(c.status)}</td>
        </tr>
      `),
      4,
      'Nenhum cliente cadastrado.'
    );

    // ==========================================================
    // 7. ABA EQUIPE (Vendedores)
    // ==========================================================
    
    // Performance: Quem vendeu mais
    app.renderTable(
      document.getElementById('sellersPerformanceBody'),
      s.topSellers.map((slr) => `
        <tr>
          <td>${app.escapeHtml(slr.name)}</td>
          <td>${slr.count}</td>
          <td><strong>${app.formatCurrency(slr.total)}</strong></td>
        </tr>
      `),
      3,
      'Sem vendas associadas a vendedores.'
    );

    // Lista crua dos vendedores e suas comissões
    app.renderTable(
      document.getElementById('sellersListBody'),
      s.allSellers.map((slr) => `
        <tr>
          <td>${app.escapeHtml(slr.nome)}</td>
          <td>${slr.comissao}%</td>
          <td>${app.escapeHtml(slr.status)}</td>
        </tr>
      `),
      3,
      'Nenhum vendedor cadastrado.'
    );

    // ==========================================================
    // 8. ABA OPERACIONAL (Fornecedores e Resumo)
    // ==========================================================
    renderStatList(document.getElementById('opsStats'), [
      { label: 'Pedidos de Reposição', value: String(s.ordersTotal) },
      { label: 'Pedidos Pendentes', value: String(s.ordersPending) },
      { label: 'Pedidos Concluídos', value: String(s.ordersCompleted) },
      { label: 'Gasto com Pedidos', value: app.formatCurrency(s.ordersValue) }
    ]);

    renderStatList(document.getElementById('suppliersStats'), [
      { label: 'Total Fornecedores', value: String(s.suppliersTotal) },
      { label: 'Fornecedores Ativos', value: String(s.suppliersActive) }
    ]);

    renderStatList(document.getElementById('opsReference'), [
      { label: 'Produtos no catálogo', value: String(s.productsTotal) },
      { label: 'Valor total em estoque', value: app.formatCurrency(s.stockValue) },
      { label: 'Vendedores cadastrados', value: String(s.sellersTotal) }
    ]);
  }

  // ============================================================================
  // EVENT LISTENERS E CONTROLE DAS ABAS
  // ============================================================================
  
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Pega o nome do painel que deve ser exibido pelo dataset (data-tab="faturamento")
      const target = tab.dataset.tab;
      
      // Toggle de ativação visual das Abas (CSS)
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      
      // Oculta todos os painéis e mostra apenas o correto
      panels.forEach((panel) => {
        const isActive = panel.dataset.panel === target;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
      });
    });
  });

  // Re-renderiza tudo se o usuário mudar o Filtro de Tempo (Dropdown)
  periodSelect?.addEventListener('change', refresh);
  
  // Executa o preenchimento logo ao abrir a tela usando o valor padrão (Todo o período)
  refresh();
});
