/* === MÓDULO PRINCIPAL DO SISTEMA (app.js) ===
   - Este é o coração do projeto Zyon ERP. 
   - Ele é carregado em TODAS as páginas.
   - Responsabilidades principais:
     1. Gerenciar o banco de dados (ler e gravar no localStorage ou Cookies).
     2. Criar os dados iniciais de exemplo (seed) na primeira vez que o sistema abre.
     3. Fornecer funções utilitárias compartilhadas (ex: formatar moeda, notificações na tela, formatar HTML seguro).
     4. Exportar o objeto global `window.ZyonApp` para que as outras telas consigam usar essas funções.
*/

(() => {
  /* ================= CONFIGURAÇÃO DO BANCO DE DADOS ================= */

  /**
   * Dicionário de chaves do banco de dados (LocalStorage/Cookies).
   * Utilizamos o prefixo 'zyon_' para garantir que não haja conflitos com outros sites hospedados no mesmo domínio.
   * @constant {Object}
   */
  const KEYS = {
    clients: 'zyon_clients',        /* Clientes cadastrados */
    products: 'zyon_products',       /* Produtos em estoque */
    sales: 'zyon_sales',             /* Vendas realizadas */
    fiscalNotes: 'zyon_fiscal_notes',/* Notas fiscais emitidas */
    fiscalConfig: 'zyon_fiscal_config', /* Dados da empresa (Emitente NF-e) */
    settings: 'zyon_settings',       /* Configurações gerais do sistema */
    sellers: 'zyon_sellers',         /* Vendedores cadastrados */
    suppliers: 'zyon_suppliers',     /* Fornecedores cadastrados */
    stockOrders: 'zyon_stock_orders' /* Pedidos de reposição de estoque */
  };

  /**
   * Dados Iniciais (Seed / Default)
   * Utilizados para popular o banco de dados na primeira vez que o sistema é executado em um navegador novo.
   * @constant {Object}
   */
  const defaults = {
    settings: {
      companyName: 'Zyon ERP',
      lowStockThreshold: 10 // Abaixo disso, o produto fica com selo "Estoque Baixo" vermelho
    },
    fiscalConfig: {
      razaoSocial: 'Zyon Comércio Ltda',
      cnpj: '12.345.678/0001-90',
      ie: '123.456.789.012',
      endereco: 'Av. Comercial, 1000 - Centro - São Paulo/SP',
      serie: '1'
    },
    clients: [
      {
        id: crypto.randomUUID(),
        nome: 'Consumidor Final', // Muito usado em PDV para vendas rápidas
        documento: '000.000.000-00',
        contato: 'CF',
        status: 'Ativo',
        tipo: 'pf'
      },
      {
        id: crypto.randomUUID(),
        nome: 'Cliente Teste',
        documento: '123.456.789-00',
        contato: 'cliente@teste.com',
        status: 'Ativo',
        tipo: 'pf'
      }
    ],
    products: [
      // Produtos de exemplo
      { id: crypto.randomUUID(), sku: 'P001', nome: 'Arroz 5kg', preco: 29.9, quantidade: 24 },
      { id: crypto.randomUUID(), sku: 'P002', nome: 'Feijão 1kg', preco: 8.5, quantidade: 8 },
      { id: crypto.randomUUID(), sku: 'P003', nome: 'Óleo 900ml', preco: 7.9, quantidade: 14 }
    ],
    sales: [],       // Lista de Vendas começa vazia
    fiscalNotes: [], // Lista de Notas Fiscais começa vazia
    sellers: [
      { id: crypto.randomUUID(), nome: 'Vendedor', documento: '111.222.333-44', contato: 'vendedor@teste.com', comissao: 5, status: 'Ativo' }
    ],
    suppliers: [
      { id: crypto.randomUUID(), nome: 'Zyon Sistemas Innova Simples', documento: '00.000.000/0001-00', contato: 'desenvolvimento@zyonsistemas.com.br', endereco: 'Rua Teste, 110', status: 'Ativo' }
    ],
    stockOrders: []  // Pedidos de reposição começa vazio
  };

  /* ================= DETECÇÃO DE AMBIENTE (Cookies vs LocalStorage) ================= 
     - O LocalStorage padrão do navegador às vezes é bloqueado se o usuário abrir o arquivo .html direto pelo File Explorer (file://).
     - Esse teste rápido tenta gravar um Cookie. Se funcionar, usa Cookie como banco de dados. Senão, tenta usar o LocalStorage.
  */
  let useCookies = false;
  try {
    document.cookie = "zyon_test=1; SameSite=Lax";
    if (document.cookie.indexOf("zyon_test=") !== -1) {
      useCookies = true;
      // Apaga o cookie de teste imediatamente
      document.cookie = "zyon_test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  } catch (e) {
    useCookies = false;
  }
  
  console.log(`[Zyon ERP] Motor de Armazenamento: ${useCookies ? 'Cookies' : 'LocalStorage (Fallback - protocolo file:// detectado)'}`);

  /* ================= FUNÇÕES DE MANIPULAÇÃO DE DADOS DO BANCO ================= */

  /**
   * Verifica se uma chave específica já existe e possui dados gravados no banco.
   * 
   * @param {string} key - A chave a ser pesquisada (ex: 'zyon_clients').
   * @returns {boolean} `true` se a chave existir no Cookies ou LocalStorage.
   */
  function hasData(key) {
    if (useCookies) {
      const nameEQ = key + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return true;
      }
      return false;
    } else {
      return localStorage.getItem(key) !== null;
    }
  }

  /**
   * Lê um dado do banco, decodifica o JSON e retorna o objeto JavaScript pronto para uso.
   * Em caso de falha de conversão, retorna o valor de fallback por segurança.
   * 
   * @param {string} key - A chave de acesso do banco (ex: KEYS.sales).
   * @param {any} fallback - O valor padrão a ser retornado caso a chave não exista ou o JSON esteja corrompido (ex: []).
   * @returns {any} O objeto recuperado ou o fallback.
   */
  function getData(key, fallback) {
    try {
      if (useCookies) {
        const nameEQ = key + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i];
          while (c.charAt(0) === ' ') c = c.substring(1, c.length);
          if (c.indexOf(nameEQ) === 0) {
            // Descodifica o JSON armazenado no cookie e converte de volta para Objeto Javascript
            const decoded = decodeURIComponent(c.substring(nameEQ.length, c.length));
            return JSON.parse(decoded);
          }
        }
      } else {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      }
      return fallback;
    } catch {
      return fallback; /* Se der erro de parse (JSON quebrado), ignora e devolve o fallback seguro */
    }
  }

  /**
   * Serializa um valor JavaScript em JSON e salva permanentemente no banco escolhido (Cookies ou LocalStorage).
   * 
   * @param {string} key - A chave onde o dado será gravado.
   * @param {any} value - O dado a ser salvo (Objeto, Array, String, etc).
   * @returns {void}
   */
  function setData(key, value) {
    try {
      if (useCookies) {
        const jsonStr = JSON.stringify(value);
        const encoded = encodeURIComponent(jsonStr); // Evita bugar com caracteres especiais em cookies
        
        // Define o cookie para durar 1 ano inteiro
        const date = new Date();
        date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
        const expires = "; expires=" + date.toUTCString();
        
        document.cookie = key + "=" + encoded + expires + "; path=/; SameSite=Lax";
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.error("Erro ao salvar dados no Zyon ERP", e);
    }
  }

  /**
   * Executada na inicialização do script: 
   * Varre todas as "tabelas" do banco e verifica se elas existem. Se não existirem, escreve os dados de exemplo (Seed) da constante `defaults`.
   * Possui tratamento de migração para configurações legadas (ex: módulo fiscal antigo).
   * 
   * @returns {void}
   */
  function ensureSeedData() {
    if (!hasData(KEYS.settings)) setData(KEYS.settings, defaults.settings);
    
    // Tratamento especial para CFG fiscal para evitar perdas se já existisse um formato legado
    if (!hasData(KEYS.fiscalConfig)) {
      const settings = getData(KEYS.settings, defaults.settings);
      const legacy = settings.fiscal || {};
      setData(KEYS.fiscalConfig, {
        razaoSocial: legacy.razaoSocial || defaults.fiscalConfig.razaoSocial,
        cnpj: legacy.cnpj || defaults.fiscalConfig.cnpj,
        ie: legacy.ie || defaults.fiscalConfig.ie,
        endereco: legacy.endereco || defaults.fiscalConfig.endereco,
        serie: legacy.serie || defaults.fiscalConfig.serie
      });
    }

    if (!hasData(KEYS.clients)) {
      setData(KEYS.clients, defaults.clients);
    } else {
      // Reparo de segurança: as vezes o array quebra e salva como string, nós refazemos.
      const clients = getData(KEYS.clients, []);
      if (!Array.isArray(clients)) setData(KEYS.clients, defaults.clients);
    }
    
    if (!hasData(KEYS.products)) setData(KEYS.products, defaults.products);
    if (!hasData(KEYS.sales)) setData(KEYS.sales, defaults.sales);
    if (!hasData(KEYS.fiscalNotes)) setData(KEYS.fiscalNotes, defaults.fiscalNotes);
    if (!hasData(KEYS.sellers)) setData(KEYS.sellers, defaults.sellers);
    if (!hasData(KEYS.suppliers)) setData(KEYS.suppliers, defaults.suppliers);
    if (!hasData(KEYS.stockOrders)) setData(KEYS.stockOrders, defaults.stockOrders);
  }

  /* ================= UTILS (Funções auxiliares para telas) ================= */

  /**
   * Formata um número puramente matemático (ex: 1500.5) para formato de moeda brasileira visual (ex: R$ 1.500,50).
   * 
   * @param {number} value - O valor financeiro.
   * @returns {string} String formatada com R$ e duas casas decimais.
   */
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  /**
   * Gera uma string da data e hora atual no padrão brasileiro (ex: 15/09/2023 15:45:00).
   * 
   * @returns {string} A data atual do sistema do usuário.
   */
  function nowPtBr() {
    return new Date().toLocaleString('pt-BR');
  }

  /**
   * Procura um elemento HTML pelo seu ID e injeta a hora atual, atualizando-a a cada segundo (Loop Infinito).
   * Geralmente utilizado no Topbar superior direito do layout.
   * 
   * @param {string} [elementId='clock'] - O ID da `<span>` ou `<div>` que será o relógio.
   * @returns {void}
   */
  function startClock(elementId = 'clock') {
    const clockEl = document.getElementById(elementId);
    if (!clockEl) return;
    const render = () => { clockEl.textContent = nowPtBr(); };
    
    render(); // Mostra logo de cara
    setInterval(render, 1000); // Fica num loop infinito piscando o relógio a cada 1000 milissegundos
  }

  /**
   * Lê as configurações de sistema e injeta o "Nome da Empresa" (Nome Fantasia) em todas as tags 
   * HTML que tiverem a classe `.js-company-name` (geralmente localizadas na Sidebar e Topbar).
   * 
   * @returns {void}
   */
  function applyBranding() {
    const settings = getData(KEYS.settings, defaults.settings);
    document.querySelectorAll('.js-company-name').forEach((el) => {
      el.textContent = settings.companyName || 'Zyon ERP';
    });
  }

  /**
   * Exibe uma notificação flutuante temporária na tela (Toast).
   * Cria uma `div` dinamicamente no final do `body`, anima usando a classe CSS `.show`, e depois a destrói para não pesar o DOM.
   * 
   * @param {string} message - O texto a ser exibido para o usuário (Ex: "Produto salvo com sucesso!").
   * @returns {void}
   */
  function notify(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Aguarda o próximo frame de renderização para garantir que a transição CSS dispare
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300); // 300ms é o tempo da animação CSS de Fade Out configurada no style.css
    }, 2000); // Fica vísivel por 2 segundos inteiros
  }

  /**
   * Soma rapidamente o total financeiro bruto de uma lista de vendas repassadas via parâmetro.
   * 
   * @param {Array<Object>} sales - Array contendo objetos com a propriedade `total`.
   * @returns {number} A soma matemática bruta.
   */
  function sumSalesTotal(sales) {
    return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
  }

  /**
   * Filtro de proteção contra XSS (Cross-Site Scripting).
   * Converte caracteres perigosos como `<script>` e aspas em representações numéricas seguras do HTML (`&lt;script&gt;`).
   * Fundamental para strings cadastradas pelo usuário que vão ser renderizadas na tela via `.innerHTML`.
   * 
   * @param {string} value - A string suspeita a ser higienizada.
   * @returns {string} A string segura, pronta para ir pra tela.
   */
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Atualiza o `textContent` de um elemento HTML de forma segura, verificando primeiro se ele existe no DOM.
   * 
   * @param {string} id - O ID do elemento alvo.
   * @param {string} text - O novo texto.
   * @returns {void}
   */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Injeta as `<tr>` e `<td>` HTML dentro de um `<tbody>` de tabela na tela.
   * Se o array de linhas estiver vazio, cria uma linha bonitinha com a mensagem centralizada de "Nenhum dado encontrado".
   * 
   * @param {HTMLElement} tbody - O nó DOM onde as linhas serão injetadas.
   * @param {Array<string>} rows - Array contendo os trechos de HTML de cada linha gerada.
   * @param {number} emptyColspan - O número de colunas totais da tabela (para que o texto vazio não quebre a grid da tabela).
   * @param {string} emptyMessage - O que exibir se a tabela estiver em branco.
   * @returns {void}
   */
  function renderTable(tbody, rows, emptyColspan, emptyMessage) {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${emptyColspan}" class="table-empty">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.join('');
  }

  /**
   * Facilidade para carregar TODO O BANCO num único objeto massivo. 
   * Muito utilizado na tela de Relatórios e Dashboard para processar todas as métricas cruzadas.
   * 
   * @returns {Object} Um espelho completo do banco contendo `sales`, `products`, `clients`, etc.
   */
  function loadStore() {
    return {
      sales: getData(KEYS.sales, []),
      products: getData(KEYS.products, []),
      clients: getData(KEYS.clients, []),
      sellers: getData(KEYS.sellers, []),
      suppliers: getData(KEYS.suppliers, []),
      fiscalNotes: getData(KEYS.fiscalNotes, []),
      stockOrders: getData(KEYS.stockOrders, []),
      settings: getData(KEYS.settings, defaults.settings)
    };
  }

  /* ================= REGRAS DE NEGÓCIO DE EXCLUSÃO (DEPENDÊNCIAS RELACIONAIS) ================= */

  /**
   * Verifica se um cliente está vinculado a pelo menos uma venda (chave estrangeira fraca: nome do cliente).
   * Impede a exclusão do cliente se ele possuir histórico financeiro atrelado.
   * 
   * @param {string} clientName - Nome exato do cliente a ser verificado.
   * @param {Array<Object>} [sales=null] - (Opcional) Array de vendas em memória. Se não fornecido, busca do banco local.
   * @returns {boolean} `true` se ele tiver vendas atreladas.
   */
  function clientHasLinkedSales(clientName, sales = null) {
    const list = sales ?? getData(KEYS.sales, []);
    if (!Array.isArray(list)) return false;
    const name = String(clientName ?? '').trim();
    return list.some((sale) => String(sale.customer ?? '').trim() === name);
  }

  /**
   * Verifica se um vendedor realizou vendas.
   * Semelhante à regra de clientes, protege o sistema de quebras de consistência na exclusão de um funcionário que já operou o caixa.
   * 
   * @param {string} sellerName - Nome do vendedor.
   * @param {Array<Object>} [sales=null] - (Opcional) Array de vendas.
   * @returns {boolean} `true` se o vendedor tiver histórico de operações.
   */
  function sellerHasLinkedSales(sellerName, sales = null) {
    const list = sales ?? getData(KEYS.sales, []);
    if (!Array.isArray(list)) return false;
    const name = String(sellerName ?? '').trim();
    return list.some((sale) => String(sale.seller ?? '').trim() === name);
  }

  /**
   * Verifica se um Fornecedor possui Pedidos de Reposição de Estoque associados ao seu ID.
   * 
   * @param {string} supplierId - ID (UUID) do fornecedor.
   * @param {Array<Object>} [orders=null] - (Opcional) Pedidos de estoque.
   * @returns {boolean} `true` se houver pedidos atrelados.
   */
  function supplierHasLinkedOrders(supplierId, orders = null) {
    const list = orders ?? getData(KEYS.stockOrders, []);
    if (!Array.isArray(list)) return false;
    const id = String(supplierId ?? '').trim();
    return list.some((order) => String(order.supplierId ?? '').trim() === id);
  }

  /**
   * Validação de Estorno Crítico: Eu quero deletar um pedido de reposição de estoque que eu já finalizei no passado.
   * Mas os itens do pedido JÁ FORAM SOMADOS nas prateleiras físicas. Será que já venderam esse item? 
   * Se venderam, e eu deletar o pedido, as prateleiras ficarão com quantidade negativa (erro financeiro).
   * 
   * Essa função valida se "estornar" a contabilidade matemática desse pedido para as prateleiras vai ser seguro.
   * 
   * @param {Object} order - O pedido de reposição que queremos deletar.
   * @param {Array<Object>} products - O banco de dados contendo o estoque físico atual dos produtos.
   * @returns {Object} `{ ok: boolean, message?: string }` indicando se pode apagar, e caso não, qual o motivo impeditivo.
   */
  function canReverseStockReceipt(order, products) {
    // Se o pedido está em trânsito/pendente (ainda não somou mercadorias nas prateleiras), pode deletar à vontade sem risco.
    if (!order || order.status !== 'Recebido') return { ok: true };

    for (const item of order.items || []) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        return { ok: false, message: 'Produto do pedido não foi encontrado no estoque atual.' };
      }

      const qtyReceived = item.qtyReceived ?? item.quantity ?? 0;
      
      // Validação de Segurança 1: Se nós recebemos isso sem gravar a quantidade que existia ANTES do pedido chegar (Rastreio)
      // é sinal que ocorreu no sistema legado. Como não temos ponto de restauração, não podemos estornar com segurança.
      if (item.qtyBeforeReceive == null) {
        return {
          ok: false,
          message: `Pedido #${order.id.slice(0, 8)}: Recepção sem metadados de rastreio contábil. Não é possível excluir esta compra com segurança.`
        };
      }

      // Validação de Segurança 2: Equação de balanço
      // A prateleira AGORA precisaria ser obrigatoriamente a (quantidade anterior + quanto recebemos)
      // Se a matemática não bater, significa que houveram VENDAS ou AJUSTES MANUAIS na prateleira DEPOIS do recebimento do pedido.
      // E remover esse pedido do banco implicaria num desvio cego dos saldos do lojista.
      const expectedQty = item.qtyBeforeReceive + qtyReceived;
      if (prod.quantidade !== expectedQty) {
        return {
          ok: false,
          message: `Ocorreu movimentação física no estoque do produto "${prod.nome}" após a recepção. A exclusão deste lote de reposição não é mais permitida.`
        };
      }
    }
    // Todas as verificações passaram, é seguro fazer rollback de banco.
    return { ok: true };
  }

  /**
   * Função executável base: É rodada no topo de todo arquivo JS secundário (ex: `vendas.js`, `dashboard.js`)
   * para ligar recursos visuais sistêmicos da página carregada.
   * 
   * @returns {Object} Referência para o objeto global da biblioteca (`window.ZyonApp`).
   */
  function initPage() {
    startClock();
    applyBranding();
    return window.ZyonApp; // Devolve referência para o dev fazer um chaining rápido: const app = ZyonApp.initPage();
  }

  /* ================= INICIALIZAÇÃO DA SESSÃO ================= */
  ensureSeedData(); // Garante o boot do DB imediatamente quando esse JS for parseado pelo script tag HTML

  /* ================= EXPORTAÇÃO (Objeto Global window.ZyonApp) ================= */
  // Todas as funções declaradas internamente viram públicas (Singleton) aqui.
  window.ZyonApp = {
    KEYS,
    defaults,
    getData,
    setData,
    formatCurrency,
    startClock,
    applyBranding,
    notify,
    sumSalesTotal,
    escapeHtml,
    initPage,
    setText,
    renderTable,
    loadStore,
    clientHasLinkedSales,
    sellerHasLinkedSales,
    supplierHasLinkedOrders,
    canReverseStockReceipt
  };
})();
