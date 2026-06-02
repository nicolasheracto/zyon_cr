/* === FISCAL / NF-e SIMULADA (fiscal.js) ===
   - Este módulo simula a emissão de Notas Fiscais Eletrônicas (NF-e).
   - Não se comunica com a SEFAZ real, mas imita todo o processo:
     1. Geração de chave de acesso (Módulo 11).
     2. Geração de DANFE (Documento Auxiliar).
     3. Simulação de transmissão e cancelamento.
   - Serve para fins didáticos no ERP.
*/

/**
 * Evento de Boot da Tela Fiscal.
 * Inicia as listagens e prepara os modais para gerar o layout da "DANFE" (Documento Auxiliar da Nota Fiscal Eletrônica).
 * 
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();
  const v = window.ZyonValidators;

  /* ================= REFERÊNCIAS AOS ELEMENTOS DA TELA ================= */

  const salesSelect = document.getElementById('salesSelect'); // Combobox de vendas pendentes de faturamento
  const notesTable = document.getElementById('fiscalNotesBody'); // Tabela inferior de histórico de notas
  const previewPanel = document.getElementById('danfePreview'); // A div em formato de papel A4 branco
  const emitBtn = document.getElementById('emitNoteBtn');
  const previewBtn = document.getElementById('previewNoteBtn');
  
  // Modais (Popups Flutuantes)
  const transmitModal = document.getElementById('transmitModal');
  const noteDetailModal = document.getElementById('noteDetailModal');
  const fiscalConfigModal = document.getElementById('fiscalConfigModal');
  const fiscalConfigForm = document.getElementById('fiscalConfigForm');
  const cancelNoteModal = document.getElementById('cancelNoteModal');
  
  // Campos de Formulário
  const noteEmissionFields = document.getElementById('noteEmissionFields'); // Container dos campos
  const noteNatureza = document.getElementById('noteNatureza');
  const noteItemsCfopBody = document.getElementById('noteItemsCfopBody');
  const cancelJustification = document.getElementById('cancelJustification');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const cancelFromDetailBtn = document.getElementById('cancelFromDetailBtn');

  // Variáveis de Estado Temporário de Interface
  let noteIdToCancel = null;
  let detailNoteId = null;

  /* ================= FUNÇÕES DE ACESSO E UTILITÁRIAS ================= */

  /**
   * Helper para ler o status da nota de forma segura.
   * @param {Object} note - O objeto da nota fiscal.
   * @returns {string} Ex: 'Autorizada', 'Cancelada'.
   */
  function getNoteStatus(note) {
    return note.status || 'Autorizada';
  }

  /**
   * Verifica se a nota é válida no momento (Não foi cancelada, denegada, etc).
   * @param {Object} note - Objeto da NF-e
   * @returns {boolean} `true` se estiver autorizada.
   */
  function isNoteAuthorized(note) {
    return getNoteStatus(note) === 'Autorizada';
  }

  function getSales() { return app.getData(app.KEYS.sales, []); }
  function setSales(sales) { app.setData(app.KEYS.sales, sales); }

  function getNotes() { return app.getData(app.KEYS.fiscalNotes, []); }
  function setNotes(notes) { app.setData(app.KEYS.fiscalNotes, notes); }

  /** 
   * Carrega a configuração do Emitente (quem está emitindo a nota).
   * Funde os dados do localStorage com o fallback do `app.defaults` para evitar campos vazios no primeiro boot.
   * @returns {Object} `{ razaoSocial, cnpj, ie, endereco, serie }`
   */
  function getFiscalConfig() {
    return {
      ...app.defaults.fiscalConfig,
      ...app.getData(app.KEYS.fiscalConfig, app.defaults.fiscalConfig)
    };
  }
  function setFiscalConfig(config) { app.setData(app.KEYS.fiscalConfig, config); }

  function getClients() { return app.getData(app.KEYS.clients, []); }
  function findClientByName(name) { return getClients().find((c) => c.nome === name); }

  /**
   * Função Inteligente: Sugere o CFOP (Código Fiscal de Operações e Prestações) na tabela de itens.
   * Baseado no documento do cliente: se for CNPJ (14 digitos), o sistema entende que é pessoa jurídica e "sugere"
   * código de revenda. Se for menor, sugere venda para consumidor final.
   * 
   * @param {string} clientName - O nome do cliente salvo na venda.
   * @returns {string} O código numérico do CFOP ('5102' ou '6102' simplificados para a simulação).
   */
  function suggestCfopForClient(clientName) {
    const client = findClientByName(clientName);
    const doc = v.onlyDigits(client?.documento || '');
    
    // Regra super simplificada didática de simulação (Não usar em produção real)
    if (doc.length === 14) return '6102'; // Operação interestadual (PJ)
    return '5102'; // Operação interna (PF/Consumidor)
  }

  /* ================= SIMULAÇÃO DE NF-E E MATEMÁTICA FISCAL ================= */

  /**
   * Calcula o Dígito Verificador de base 11 (O último número da chave de acesso).
   * Padrão oficial exigido pelo manual do contribuinte da SEFAZ Nacional.
   * A lógica multiplica a chave da direita pra esquerda por multiplicadores rotativos [2 a 9].
   * 
   * @param {string} body - A string da chave com os primeiros 43 dígitos.
   * @returns {number} O dígito verificador numérico [0 a 9].
   */
  function mod11Digit(body) {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let sum = 0;
    let pos = 0;
    for (let i = body.length - 1; i >= 0; i -= 1) {
      sum += Number(body[i]) * weights[pos % weights.length];
      pos += 1;
    }
    const rest = sum % 11;
    const digit = 11 - rest;
    return digit >= 10 ? 0 : digit;
  }

  /**
   * Gera uma Chave de Acesso de NF-e completa (44 dígitos).
   * Formato Nacional: [UF] + [AAMM] + [CNPJ] + [Mod] + [Serie] + [NumeroNF] + [TpEmis] + [CodAleatorio] + [Digito]
   * 
   * @param {Object} params - Contexto da nota gerada.
   * @param {string} params.cnpj - CNPJ do emitente.
   * @param {string} params.serie - Série da nota atual.
   * @param {number} params.number - O ID incremental numérico da NFe sendo emitida.
   * @returns {string} String com exatos 44 algarismos numéricos.
   */
  function generateAccessKey({ cnpj, serie, number }) {
    const uf = '35'; // Código IBGE fixado SP pra simulação
    const now = new Date();
    // Ano e Mês (Ex: Janeiro de 2024 -> 2401)
    const aamm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    // CNPJ só os números (14 digitos cravados)
    const cnpjDigits = v.onlyDigits(cnpj).padStart(14, '0').slice(0, 14);
    
    const model = '55'; // Modelo Nacional da NF-e
    const seriePadded = String(serie).padStart(3, '0').slice(-3); // Série de 3 digitos (Ex: 001)
    const numPadded = String(number).padStart(9, '0').slice(-9); // Numeração de 9 digitos
    const tpEmis = '1'; // Emissão Normal = 1
    const codNum = String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); // Código aleatório embaralhado para compor a chave (8 digitos)
    
    // Concatena a base inteira (43 caracteres)
    const body = uf + aamm + cnpjDigits + model + seriePadded + numPadded + tpEmis + codNum;
    
    // Calcula o DV final e junta
    return body + mod11Digit(body);
  }

  /**
   * Formata a chave para leitura humana, adicionando espaços a cada 4 algarismos.
   * Ex: "1234 5678 9012 3456 ..."
   * 
   * @param {string} key - A chave de 44 dígitos.
   * @returns {string} A string com espaçamentos injetados.
   */
  function formatAccessKey(key) {
    return key.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  /**
   * Mecanismo de Auto-incremento (ID Seqüencial).
   * Acha qual foi a última nota emitida e adiciona +1.
   * 
   * @param {Array<Object>} notes - Banco de dados das NFs emitidas.
   * @returns {number} O número disponível pra uso imediato.
   */
  function nextNoteNumber(notes) {
    const max = notes.reduce((acc, n) => {
      const num = Number(String(n.number || '').replace(/\D/g, ''));
      return num > acc ? num : acc;
    }, 0);
    return max + 1; // Se array for vazia, retorna 1
  }

  /* ================= PREPARAÇÃO E EMISSÃO ================= */

  /**
   * Varre o HTML da tabela para ler os códigos CFOP digitados pelo usuário em cada produto.
   * 
   * @returns {Object} `{ naturezaOperacao: string, itemCfops: Array<string> }`
   */
  function getNoteFormData() {
    const itemCfops = [];
    noteItemsCfopBody?.querySelectorAll('tr').forEach((row) => {
      const input = row.querySelector('.item-cfop-input');
      itemCfops.push(input?.value.trim() || '');
    });
    return {
      naturezaOperacao: noteNatureza?.value.trim() || '',
      itemCfops
    };
  }

  /**
   * Checagem tripla de Regras de Negócio e preenchimento de campos obrigatórios
   * ANTES de tentar gerar a nota ou a simulação do XML.
   * 
   * @param {Object} sale - A venda que receberá a nota.
   * @returns {Object} Objeto com `.ok` bool e a `.message` do erro se houver falha de compliance.
   */
  function validateBeforeEmission(sale) {
    // 1. Checa se a loja cadastrou seu próprio CNPJ nas configs.
    const emitterCheck = v.validateFiscalEmitter(getFiscalConfig());
    if (!emitterCheck.ok) {
      return { ok: false, message: emitterCheck.errors[0] + ' Abra Configurações do emitente no topo da tela.' };
    }
    
    // 2. Checa se o formulário preenchido da Natureza não está vazio ou muito curto
    const noteCheck = v.validateNoteEmission(getNoteFormData(), sale);
    if (!noteCheck.ok) {
      return { ok: false, message: noteCheck.errors[0] };
    }
    return { ok: true };
  }

  /**
   * "Fábrica" que gera o pacote completo JSON simulando o que seria enviado/recebido
   * pelo XML da SEFAZ numa API de mensageria real.
   * 
   * @param {Object} sale - Objeto de Venda.
   * @param {Object} noteForm - Objeto com a Natureza e array de CFOPs.
   * @returns {Object} O Documento Fiscal perfeitamente estruturado.
   */
  function buildNotePayload(sale, noteForm) {
    const fiscal = getFiscalConfig();
    const notes = getNotes();
    const number = nextNoteNumber(notes);
    
    // Gera a assinatura de Validade
    const accessKey = generateAccessKey({ cnpj: fiscal.cnpj, serie: fiscal.serie, number });
    
    const client = findClientByName(sale.customer);

    // Mapeamento enriquecendo os itens com cálculos contábeis básicos de ICMs simulado
    const items = (sale.items || []).map((item, index) => {
      const lineTotal = (item.qty || 0) * (item.price || 0);
      const icms = lineTotal * 0.18; // Simulação didática fixada de 18% em tudo
      return {
        seq: index + 1,
        description: item.name,
        qty: item.qty,
        unitPrice: item.price,
        cfop: noteForm.itemCfops[index], // Atribui o CFOP que o usuário digitou na mesma linha
        lineTotal,
        icms
      };
    });

    // Somatórias Globais do Footer da Nota
    const icmsTotal = items.reduce((acc, i) => acc + i.icms, 0);
    const productsTotal = items.reduce((acc, i) => acc + i.lineTotal, 0);

    return {
      id: crypto.randomUUID(),
      saleId: sale.id, // Vínculo chave estrangeira forte
      model: '55',
      series: fiscal.serie,
      number: String(number).padStart(9, '0'),
      numberDisplay: `NF-e ${fiscal.serie}/${String(number).padStart(9, '0')}`,
      accessKey,
      protocol: `${Date.now()}`.slice(-15), // Mocka um número de Protocolo da SEFAZ baseado na hora exata
      status: 'Autorizada',
      naturezaOperacao: noteForm.naturezaOperacao,
      customer: sale.customer || 'Consumidor Final',
      customerDocument: client?.documento || '000.000.000-00',
      emitter: {
        razaoSocial: fiscal.razaoSocial,
        cnpj: fiscal.cnpj,
        ie: fiscal.ie,
        endereco: fiscal.endereco
      },
      items,
      total: sale.total || productsTotal, // Puxa o total da venda.
      icmsTotal,
      date: new Date().toLocaleString('pt-BR'),
      xmlSimulated: true // Marcação pra debug de desenvolvedor
    };
  }

  /* ================= RENDERIZAÇÃO DA TELA (DANFE E LISTAGENS) ================= */

  /**
   * Pega o Payload do Documento Fiscal e formata ele todinho injetando os dados na Div `.danfe-preview`.
   * Essa função serve tanto para a pré-visualização (ainda não salvo) quanto pra consultar uma nota já salva.
   * 
   * @param {Object} noteOrSale - Pode receber um payload de NF (`isNote = true`) ou o payload Bruto de Venda (Simulação/Preview).
   * @param {Object} [noteForm] - Os campos de formulário, exigidos caso seja uma Simulação Preview.
   * @returns {Object} O Payload gerado ou passado (Usado internamente pra outras funções encadeadas).
   */
  function renderDanfe(noteOrSale, noteForm) {
    // Descobre se passaram uma Venda (ainda não gerou NF) ou uma Nota já gerada baseada na existência do saleId
    const isNote = Boolean(noteOrSale.saleId); 
    const fiscal = getFiscalConfig();
    const sale = isNote ? getSales().find((s) => s.id === noteOrSale.saleId) : noteOrSale;
    
    // Se for preview de venda, manda processar um payload MOCK. Se não, usa a NF já pronta.
    const payload = isNote ? noteOrSale : buildNotePayload(noteOrSale, noteForm);

    const cancelled = getNoteStatus(payload) === 'Cancelada';
    document.getElementById('danfeTitle').textContent = payload.numberDisplay || `NF-e ${payload.series}/${payload.number}`;

    // Monta faixa vermelha gigante caso a NF esteja cancelada
    let cancelBanner = '';
    if (cancelled) {
      cancelBanner = `<div class="danfe-cancelled-banner">
        NF-e CANCELADA em ${app.escapeHtml(payload.cancelledAt || '—')}
        ${payload.cancelProtocol ? ` · Protocolo Homologação: ${app.escapeHtml(payload.cancelProtocol)}` : ''}
        <br><span style="font-weight:400;font-size:0.9rem">Motivo: ${app.escapeHtml(payload.cancelReason || '—')}</span>
      </div>`;
    }

    // Informações Chave da Cabeça da Nota
    document.getElementById('danfeMeta').innerHTML = `
      ${cancelBanner}
      <p><strong>Status SEFAZ:</strong> ${app.escapeHtml(getNoteStatus(payload))}</p>
      <p><strong>Chave de Acesso:</strong> ${app.escapeHtml(formatAccessKey(payload.accessKey))}</p>
      <p><strong>Natureza:</strong> ${app.escapeHtml(payload.naturezaOperacao)}</p>
      ${payload.protocol ? `<p><strong>Protocolo autorização:</strong> ${app.escapeHtml(payload.protocol)}</p>` : ''}
    `;

    // Bloco do Emitente (Remetente)
    document.getElementById('danfeEmitter').innerHTML = `
      <p><strong>${app.escapeHtml(payload.emitter?.razaoSocial || fiscal.razaoSocial)}</strong></p>
      <p>CNPJ: ${app.escapeHtml(payload.emitter?.cnpj || fiscal.cnpj)}</p>
      <p>IE: ${app.escapeHtml(payload.emitter?.ie || fiscal.ie)}</p>
      <p>${app.escapeHtml(payload.emitter?.endereco || fiscal.endereco)}</p>
    `;

    // Bloco do Destinatário (Comprador)
    document.getElementById('danfeCustomer').innerHTML = `
      <p><strong>${app.escapeHtml(payload.customer)}</strong></p>
      <p>CPF/CNPJ: ${app.escapeHtml(payload.customerDocument || '-')}</p>
      <p>Venda Base: ${app.escapeHtml(sale?.date || '-')}</p>
      <p>Vendedor: ${app.escapeHtml(sale?.seller || '-')}</p>
    `;

    // Grade de Itens da DANFE
    app.renderTable(
      document.getElementById('danfeItemsBody'),
      (payload.items || []).map(
        (item) => `<tr>
          <td>${item.seq}</td>
          <td>${app.escapeHtml(item.description)}</td>
          <td>${item.qty}</td>
          <td>${app.formatCurrency(item.unitPrice)}</td>
          <td>${app.escapeHtml(item.cfop)}</td>
          <td>${app.formatCurrency(item.lineTotal)}</td>
        </tr>`
      ),
      6,
      'Sem itens na venda.'
    );

    // Totais Financeiros no Rodapé
    document.getElementById('danfeTotals').innerHTML = `
      <p>Base de cálculo ICMS: <strong>${app.formatCurrency(payload.total)}</strong></p>
      <p>ICMS (18% simulado): <strong>${app.formatCurrency(payload.icmsTotal || 0)}</strong></p>
      <p class="danfe-total-line">Valor total da NF-e: <strong>${app.formatCurrency(payload.total)}</strong></p>
    `;

    previewPanel.hidden = false;
    return payload; 
  }

  /**
   * Constrói as linhas interativas de HTML para o usuário digitar o CFOP individual
   * para os itens da Venda que ele selecionou no dropdown.
   * 
   * @param {Object} sale - A venda bruta.
   */
  function renderNoteItemsCfop(sale) {
    if (!sale?.items?.length) {
      noteItemsCfopBody.innerHTML = '<tr><td colspan="3" class="table-empty">O carrinho desta venda estava vazio.</td></tr>';
      return;
    }

    const suggested = suggestCfopForClient(sale.customer);
    
    // Mapeia e injeta os selects de sugestão no meio da tabela para preenchimento.
    noteItemsCfopBody.innerHTML = sale.items.map(
      (item, index) => `<tr data-index="${index}">
        <td>${app.escapeHtml(item.name)}</td>
        <td>${item.qty}</td>
        <td>
          <input type="text" class="item-cfop-input" maxlength="4" inputmode="numeric"
            placeholder="${suggested}" value="${suggested}" style="width:5rem;padding:0.4rem;border:1px solid var(--border);border-radius:6px">
        </td>
      </tr>`
    ).join('');
  }

  /** 
   * Gatilho: Ao selecionar uma venda no `<select id="salesSelect">`, abre os campos de emissão
   * e destrava os botões.
   * 
   * @returns {void}
   */
  function onSaleSelected() {
    const saleId = salesSelect.value;
    if (!saleId) {
      // Esconde o card e inativa os botões de controle se ele voltou o dropdown pra vazio ("Selecione").
      noteEmissionFields.hidden = true;
      previewBtn.disabled = true;
      emitBtn.disabled = true;
      previewPanel.hidden = true;
      return;
    }

    const sale = getSales().find((s) => s.id === saleId);
    if (!sale) return; // Se a venda não foi encontrada no localStorage (Bug/Exclusão)

    noteEmissionFields.hidden = false;
    noteNatureza.value = '';
    renderNoteItemsCfop(sale); // Injeta a tabela preenchível de Códigos Fiscais (CFOP)
    previewBtn.disabled = false;
    emitBtn.disabled = false;
    previewPanel.hidden = true; // Desabilita o preview até que o usuário mande calcular de novo.
  }

  /** 
   * Helper: Pega a constante e descarrega todos os dados da loja pra dentro do formulário modal 
   * de Configuração de Emitente na tela superior direita.
   * 
   * @returns {void}
   */
  function loadFiscalConfigForm() {
    const cfg = getFiscalConfig();
    document.getElementById('cfgRazao').value = cfg.razaoSocial || '';
    document.getElementById('cfgCnpj').value = cfg.cnpj || '';
    document.getElementById('cfgIe').value = cfg.ie || '';
    document.getElementById('cfgEndereco').value = cfg.endereco || '';
    document.getElementById('cfgSerie').value = cfg.serie || '1';
  }

  /** 
   * Atualiza os "Cartões" coloridos no topo da tela (Indicadores KPIs de Volume, Notas emitidas, etc).
   * 
   * @returns {void}
   */
  function updateKpis() {
    const sales = getSales();
    const notes = getNotes();
    const authorized = notes.filter(isNoteAuthorized);
    const cancelled = notes.filter((n) => getNoteStatus(n) === 'Cancelada');
    
    // Contagem Especial: Procura vendas que NÃO TEM nota no banco ou que a nota associada a elas foi "Cancelada" e logo exigem emissão nova.
    const pending = sales.filter((s) => saleAvailableForNfe(s, notes)).length;
    
    // Soma a métrica financeira oficial do mês 
    const total = authorized.reduce((acc, n) => acc + (n.total || 0), 0);
    
    app.setText('fiscalKpiNotes', String(authorized.length));
    app.setText('fiscalKpiCancelled', String(cancelled.length));
    app.setText('fiscalKpiPending', String(pending));
    app.setText('fiscalKpiTotal', app.formatCurrency(total));
  }

  /**
   * Valida se uma venda específica está elegível para receber uma nova geração de NF-e.
   * Só retorna VERDADEIRO se ela ainda não tiver nota E SE a última nota que fizeram pra ela foi homologada como Cancelada.
   * 
   * @param {Object} sale - A venda avaliada.
   * @param {Array<Object>} notes - Todas as notas.
   * @returns {boolean} A elegibilidade.
   */
  function saleAvailableForNfe(sale, notes) {
    if (!sale.noteNumber) return true; // Nunca foi faturada.
    const linked = notes.find((n) => n.saleId === sale.id);
    
    // Se encontrou a nota, a venda só pode ser re-faturada se a nota no banco não for uma nota autorizada ativa
    return linked ? !isNoteAuthorized(linked) : true;
  }

  /** 
   * Filtra e Preenche o dropdown principal (`<select>`) com a fila de vendas disponíveis que ainda precisam ser faturadas.
   * 
   * @returns {void}
   */
  function fillSalesOptions() {
    const notes = getNotes();
    const sales = getSales().filter((s) => saleAvailableForNfe(s, notes));
    
    salesSelect.innerHTML = '<option value="">Selecione uma venda registrada no sistema</option>';
    sales.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      // Texto bonito: "25/12/2023 15:30 — Carlos Andrade — R$ 100,00 (2 itens)"
      opt.textContent = `${s.date} — ${s.customer} — ${app.formatCurrency(s.total)} (${(s.items || []).length} itens)`;
      salesSelect.appendChild(opt);
    });
    
    // Reseta estado default dos botões e paineis
    noteEmissionFields.hidden = true;
    previewBtn.disabled = true;
    emitBtn.disabled = true;
    previewPanel.hidden = true;
  }

  /**
   * Recria a tabela central da página (`<tbody>`) que lista as Notas (O Histórico Oficial de Caixa).
   * 
   * @returns {void}
   */
  function renderNotes() {
    const notes = getNotes();
    app.renderTable(
      notesTable,
      [...notes].reverse().map((n) => {
        const authorized = isNoteAuthorized(n);
        const statusClass = authorized ? 'status-active' : 'status-inactive';
        return `<tr>
          <td>${app.escapeHtml(n.numberDisplay || n.number)}</td>
          <td class="chave-cell" title="${app.escapeHtml(n.accessKey || '')}">${n.accessKey ? `${app.escapeHtml(formatAccessKey(n.accessKey).slice(0, 24))}…` : '—'}</td>
          <td>${app.escapeHtml(n.customer)}</td>
          <td>${app.formatCurrency(n.total)}</td>
          <td>${app.escapeHtml(n.date)}</td>
          <td><span class="status-badge ${statusClass}">${app.escapeHtml(getNoteStatus(n))}</span></td>
          <td class="action-btns">
            <!-- Botão de Ver a Danfe Completa -->
            <span data-action="view-note" data-id="${n.id}" title="Imprimir / Ver DANFE">👁️</span>
            
            <!-- Botão de Cancelar (Apenas exibido se a nota for Ativa) -->
            ${authorized ? `<span data-action="cancel-note" data-id="${n.id}" title="Solicitar Cancelamento de NF-e">🚫</span>` : ''}
          </td>
        </tr>`;
      }),
      7,
      'Nenhuma nota fiscal emitida até o momento.'
    );
    // Atualiza os paineis do topo após modificar a tabela do centro
    updateKpis();
  }

  /* ================= ANIMAÇÕES DE SIMULAÇÃO (TRANSMIT E CANCEL) ================= */

  /**
   * Abre a tela escura que simula o Loader enviando o XML e assinando o Certificado A1.
   * (Puro UX/MOCK. As luzes piscam e os dados são gravados localmente depois de 3 segundos).
   * 
   * @param {Function} onComplete - Função (Callback) que será chamada quando a barra azul chegar no final.
   * @returns {void}
   */
  function runTransmitSimulation(onComplete) {
    const steps = document.querySelectorAll('#transmitSteps li'); // As bolinhas de passo-a-passo
    const resultEl = document.getElementById('transmitResult');
    const closeBtn = document.getElementById('closeTransmitBtn');
    
    // Reset da animação
    steps.forEach((s) => s.classList.remove('done', 'active', 'error'));
    resultEl.hidden = true;
    closeBtn.disabled = true;
    transmitModal.style.display = 'flex';

    let index = 0;
    
    // Loop de tempo (Tick a cada 700 milissegundos)
    const interval = setInterval(() => {
      // Marca passo anterior como concluído ('done' com cor verde)
      if (index > 0) steps[index - 1].classList.remove('active');
      if (index > 0) steps[index - 1].classList.add('done');
      
      // Ativa o passo atual fazendo a bolinha pulsar em azul ('active')
      if (index < steps.length) {
        steps[index].classList.add('active');
        index += 1;
        return;
      }
      
      // Terminou todos os passos, finaliza e limpa memória.
      clearInterval(interval);
      resultEl.hidden = false;
      resultEl.textContent = 'NF-e Autorizada com Sucesso pela Secretaria da Fazenda (Ambiente Simulado). Protocolo registrado.';
      resultEl.className = 'transmit-result success';
      closeBtn.disabled = false;
      
      // Manda a execução original continuar
      onComplete(); 
    }, 700);
  }

  /**
   * Inicializa e abre a aba de Justificativa de Cancelamento.
   * @param {Object} note - O objeto a ser bloqueado.
   */
  function openCancelModal(note) {
    noteIdToCancel = note.id; // Guarda em memória o alvo
    cancelJustification.value = '';
    
    // Resumo simples de confirmação
    document.getElementById('cancelNoteSummary').textContent =
      `${note.numberDisplay || note.number} · ${note.customer} · ${app.formatCurrency(note.total)}`;
      
    document.getElementById('cancelResult').hidden = true;
    document.querySelectorAll('#cancelSteps li').forEach((s) => s.classList.remove('done', 'active', 'error'));
    confirmCancelBtn.disabled = false;
    confirmCancelBtn.hidden = false;
    
    cancelNoteModal.style.display = 'flex';
  }

  /**
   * Animação que simula a homologação de um Cancelamento Sefaz em evento evento próprio.
   * @param {Function} onComplete - Função executada após os blinks da tela terminarem.
   */
  function runCancelSimulation(onComplete) {
    const steps = document.querySelectorAll('#cancelSteps li');
    const resultEl = document.getElementById('cancelResult');
    confirmCancelBtn.disabled = true;
    
    steps.forEach((s) => s.classList.remove('done', 'active', 'error'));
    resultEl.hidden = true;

    let index = 0;
    const interval = setInterval(() => {
      if (index > 0) steps[index - 1].classList.remove('active');
      if (index > 0) steps[index - 1].classList.add('done');
      if (index < steps.length) {
        steps[index].classList.add('active');
        index += 1;
        return;
      }
      clearInterval(interval);
      resultEl.hidden = false;
      resultEl.textContent = 'Evento de Cancelamento averbado e homologado com sucesso (simulação).';
      resultEl.className = 'transmit-result success';
      confirmCancelBtn.hidden = true; // Esconde o botão e obriga fechar a aba
      onComplete();
    }, 650);
  }

  /* ================= LÓGICAS NUCLEARES DE CANCELAR E MOSTRAR ================= */

  /**
   * Remove o vínculo duro (Referência de ID) entre a Venda Histórica e a Nota que acaba de ser Cancelada.
   * Se esse vínculo for quebrado, a "Venda" vai voltar a brilhar lá na lista de vendas pendentes pedindo pra ser emitida uma Nota Nova pra ela.
   * 
   * @param {Object} note - A nota que foi anulada.
   * @returns {void}
   */
  function unlinkSaleFromNote(note) {
    if (!note?.saleId) return;
    const sales = getSales();
    const sale = sales.find((s) => s.id === note.saleId);
    if (sale) {
      sale.noteNumber = null;
      setSales(sales);
    }
  }

  /**
   * Core Funcional de Cancelamento: Pega a Nota e chuta os dados do banco alterando o status
   * para 'Cancelada' e inserindo chaves novas `.cancelledAt` contendo justificativas.
   * 
   * @param {string} noteId - ID interno da NF.
   * @param {string} reason - A justificativa ditada pelo caixa.
   * @returns {void}
   */
  function executeCancelNote(noteId, reason) {
    const notes = getNotes();
    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx < 0) return;

    const note = notes[idx];
    if (!isNoteAuthorized(note)) {
      app.notify('Esta nota já está cancelada e anulada. Nada a fazer.');
      return;
    }

    // Injeção de metadados de auditoria de estorno
    note.status = 'Cancelada';
    note.cancelledAt = new Date().toLocaleString('pt-BR');
    note.cancelReason = reason;
    note.cancelProtocol = `CANC${Date.now()}`.slice(-15);
    
    notes[idx] = note;
    setNotes(notes);

    unlinkSaleFromNote(note);

    app.notify('NF-e cancelada. A Venda respectiva foi estornada fiscalmente e aguarda nova re-emissão.');
    noteIdToCancel = null;
    
    // Repinta e recarrega os painéis e o dropdown
    fillSalesOptions();
    renderNotes();

    // Fix: Se a nota foi cancelada pelo botão DENTRO do modal de pré-visualização, a DANFE precisa ficar com a faixa vermelha AGORA.
    if (detailNoteId === noteId) {
      renderDanfe(note);
      document.getElementById('noteDetailContent').innerHTML = previewPanel.innerHTML;
      cancelFromDetailBtn.hidden = true; // Inativa o botão pra impedir clique duplo.
    }
  }

  /**
   * Apresenta o Modal Gigante de Visualização de DANFE de uma nota real.
   * Reutiliza as rotinas de HTML `.innerHTML` do preview escondido do gerador e projeta elas aqui.
   * 
   * @param {Object} note - O pacote da Nota.
   */
  function showNoteDetail(note) {
    detailNoteId = note.id;
    renderDanfe(note);
    document.getElementById('noteDetailContent').innerHTML = previewPanel.innerHTML;
    cancelFromDetailBtn.hidden = !isNoteAuthorized(note); // Oculta botão cancelar se o status já for de inativa
    noteDetailModal.style.display = 'flex';
  }

  /* ================= EVENT LISTENERS (Inputs do Usuário) ================= */

  /** Botão abrir Configurações Fiscais no painel superior */
  document.getElementById('openFiscalConfigBtn')?.addEventListener('click', () => {
    loadFiscalConfigForm();
    fiscalConfigModal.style.display = 'flex';
  });

  document.getElementById('closeFiscalConfigBtn')?.addEventListener('click', () => {
    fiscalConfigModal.style.display = 'none';
  });

  fiscalConfigModal?.addEventListener('click', (e) => {
    if (e.target === fiscalConfigModal) fiscalConfigModal.style.display = 'none';
  });

  /** Salvar Configurações (grava CNPJ, Inscrição Estadual, Razão Social, etc.) */
  fiscalConfigForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      razaoSocial: document.getElementById('cfgRazao').value.trim(),
      cnpj: document.getElementById('cfgCnpj').value.trim(),
      ie: document.getElementById('cfgIe').value.trim(),
      endereco: document.getElementById('cfgEndereco').value.trim(),
      serie: document.getElementById('cfgSerie').value.trim()
    };

    // Roda regras do validador (Ex: CNPJ não pode estar vazio)
    const validation = v.validateFiscalEmitter(config);
    if (!validation.ok) {
      app.notify(validation.errors[0]);
      return;
    }

    setFiscalConfig(config);
    fiscalConfigModal.style.display = 'none';
    app.notify('Dados do Emitente NF-e salvos com sucesso.');
  });

  /** 
   * Botão Branco Pré-visualizar (desenha a DANFE na tela pra checar como vai ficar mas não afeta banco de dados) 
   */
  previewBtn?.addEventListener('click', () => {
    const sale = getSales().find((s) => s.id === salesSelect.value);
    if (!sale) {
      app.notify('Operação Inválida: Selecione uma venda do sistema antes de pedir Preview.');
      return;
    }

    const check = validateBeforeEmission(sale);
    if (!check.ok) {
      app.notify(check.message);
      return;
    }

    // Desenha
    renderDanfe(sale, getNoteFormData());
  });

  /** 
   * Botão Verde Emitir: Dispara a animação da janela Modal 'Transmit' e dps chama a callback
   * `buildNotePayload()` que grava de verdade a emissão.
   */
  emitBtn?.addEventListener('click', () => {
    const saleId = salesSelect.value;
    if (!saleId) {
      app.notify('Selecione uma venda no quadro acima.');
      return;
    }

    const sales = getSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    const check = validateBeforeEmission(sale);
    if (!check.ok) {
      app.notify(check.message);
      return;
    }

    const noteForm = getNoteFormData();

    runTransmitSimulation(() => {
      // Callback: quando a animação da bolinha verde acaba, isso aqui roda.
      const note = buildNotePayload(sale, noteForm);
      
      sale.noteNumber = note.numberDisplay; // Associa a NF na Venda Origem (Para o Histórico do PDV ficar alinhado)
      setSales(sales);

      // Assenta a nota no array principal e salva
      const notes = getNotes();
      notes.push(note);
      setNotes(notes);

      app.notify('Protocolo de Homologação Assinado (Ambiente Simulado).');
      
      // Reinicia e exibe o que gerou.
      fillSalesOptions();
      renderNotes();
      renderDanfe(note);
    });
  });

  salesSelect?.addEventListener('change', onSaleSelected);

  document.getElementById('closeTransmitBtn')?.addEventListener('click', () => {
    transmitModal.style.display = 'none';
  });
  
  transmitModal?.addEventListener('click', (e) => {
    // Só deixa clicar fora pra fechar se o botão "Fechar" já estiver destravado (Evita fechar no meio do carregamento)
    if (e.target === transmitModal && !document.getElementById('closeTransmitBtn').disabled) {
      transmitModal.style.display = 'none';
    }
  });

  document.getElementById('closeNoteDetailBtn')?.addEventListener('click', () => {
    noteDetailModal.style.display = 'none';
  });
  noteDetailModal?.addEventListener('click', (e) => {
    if (e.target === noteDetailModal) noteDetailModal.style.display = 'none';
  });

  /** Delegação de Cliques em qualquer botão originado na Tabela de Notas Fiscais Emitidas: botões Ver (Olho) e Cancelar (Stop) */
  notesTable?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const note = getNotes().find((n) => n.id === target.dataset.id);
    if (!note) return;

    if (target.dataset.action === 'view-note') {
      showNoteDetail(note);
      return;
    }

    if (target.dataset.action === 'cancel-note') {
      openCancelModal(note);
    }
  });

  document.getElementById('closeCancelModalBtn')?.addEventListener('click', () => {
    cancelNoteModal.style.display = 'none';
    noteIdToCancel = null;
  });
  cancelNoteModal?.addEventListener('click', (e) => {
    if (e.target === cancelNoteModal) {
      cancelNoteModal.style.display = 'none';
      noteIdToCancel = null;
    }
  });

  /** 
   * Confirmar Cancelamento: 
   * Captura o botão vermelho com texto de Confirmação na caixa Justificativa e processa.
   */
  confirmCancelBtn?.addEventListener('click', () => {
    if (!noteIdToCancel) return;

    const justification = cancelJustification?.value.trim() || '';
    
    // Validadores Fiscais Nacionais proíbem menos que 15 letras em cancelamentos
    const check = v.validateCancelJustification(justification);
    if (!check.ok) {
      app.notify(check.errors[0]); // Mensagem orientativa de 15 chars
      return;
    }

    if (!confirm('Confirmar o cancelamento averbado desta NF-e? A venda voltará a ficar disponível na fila de faturamento.')) {
      return;
    }

    // Copia o ID pois o Callback roda assíncrono dps do Timeout e essa variável global pode limpar.
    const noteId = noteIdToCancel;
    runCancelSimulation(() => {
      executeCancelNote(noteId, justification);
    });
  });

  /** Botão auxiliar de cancelamento que fica dentro do Popup de Exibição da Danfe */
  cancelFromDetailBtn?.addEventListener('click', () => {
    const note = getNotes().find((n) => n.id === detailNoteId);
    if (note && isNoteAuthorized(note)) {
      noteDetailModal.style.display = 'none'; // Desmonta e esconde o popup atual da DANFE
      openCancelModal(note); // Infla o novo Popup focado em digitar a justificativa de Cancelar
    }
  });

  /* INICIALIZAÇÃO OBRIGATÓRIA DA PÁGINA */
  fillSalesOptions();
  renderNotes();
});
