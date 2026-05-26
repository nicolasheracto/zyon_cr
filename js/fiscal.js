/* === FISCAL / NF-e SIMULADA (fiscal.html) === */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();
  const v = window.ZyonValidators;

  const salesSelect = document.getElementById('salesSelect');
  const notesTable = document.getElementById('fiscalNotesBody');
  const previewPanel = document.getElementById('danfePreview');
  const emitBtn = document.getElementById('emitNoteBtn');
  const previewBtn = document.getElementById('previewNoteBtn');
  const transmitModal = document.getElementById('transmitModal');
  const noteDetailModal = document.getElementById('noteDetailModal');

  let previewSale = null;

  function getSales() {
    return app.getData(app.KEYS.sales, []);
  }

  function setSales(sales) {
    app.setData(app.KEYS.sales, sales);
  }

  function getNotes() {
    return app.getData(app.KEYS.fiscalNotes, []);
  }

  function setNotes(notes) {
    app.setData(app.KEYS.fiscalNotes, notes);
  }

  function getFiscalSettings() {
    const settings = app.getData(app.KEYS.settings, app.defaults.settings);
    return { ...app.defaults.settings.fiscal, ...(settings.fiscal || {}) };
  }

  function getClients() {
    return app.getData(app.KEYS.clients, []);
  }

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

  function generateAccessKey({ cnpj, serie, number }) {
    const uf = '35';
    const now = new Date();
    const aamm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const cnpjDigits = v.onlyDigits(cnpj).padStart(14, '0').slice(0, 14);
    const model = '55';
    const seriePadded = String(serie).padStart(3, '0').slice(-3);
    const numPadded = String(number).padStart(9, '0').slice(-9);
    const tpEmis = '1';
    const codNum = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const body = uf + aamm + cnpjDigits + model + seriePadded + numPadded + tpEmis + codNum;
    const dv = mod11Digit(body);
    return body + dv;
  }

  function formatAccessKey(key) {
    return key.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  function nextNoteNumber(notes) {
    const max = notes.reduce((acc, n) => {
      const num = Number(String(n.number || '').replace(/\D/g, ''));
      return num > acc ? num : acc;
    }, 0);
    return max + 1;
  }

  function findClientByName(name) {
    return getClients().find((c) => c.nome === name);
  }

  function buildNotePayload(sale) {
    const fiscal = getFiscalSettings();
    const notes = getNotes();
    const number = nextNoteNumber(notes);
    const accessKey = generateAccessKey({ cnpj: fiscal.cnpj, serie: fiscal.serie, number });
    const client = findClientByName(sale.customer);
    const items = (sale.items || []).map((item, index) => {
      const lineTotal = (item.qty || 0) * (item.price || 0);
      const icms = lineTotal * 0.18;
      return {
        seq: index + 1,
        description: item.name,
        qty: item.qty,
        unitPrice: item.price,
        cfop: fiscal.cfopPadrao,
        lineTotal,
        icms
      };
    });
    const productsTotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
    const icmsTotal = items.reduce((acc, i) => acc + i.icms, 0);

    return {
      id: crypto.randomUUID(),
      saleId: sale.id,
      model: '55',
      series: fiscal.serie,
      number: String(number).padStart(9, '0'),
      numberDisplay: `NF-e ${fiscal.serie}/${String(number).padStart(9, '0')}`,
      accessKey,
      protocol: `${Date.now()}`.slice(-15),
      status: 'Autorizada',
      naturezaOperacao: fiscal.naturezaOperacao,
      customer: sale.customer || 'Consumidor Final',
      customerDocument: client?.documento || '000.000.000-00',
      emitter: {
        razaoSocial: fiscal.razaoSocial,
        cnpj: fiscal.cnpj,
        ie: fiscal.ie,
        endereco: fiscal.endereco
      },
      items,
      total: sale.total || productsTotal,
      icmsTotal,
      date: new Date().toLocaleString('pt-BR'),
      xmlSimulated: true
    };
  }

  function renderDanfe(noteOrSale) {
    const isNote = Boolean(noteOrSale.saleId);
    const fiscal = getFiscalSettings();
    const sale = isNote ? getSales().find((s) => s.id === noteOrSale.saleId) : noteOrSale;
    const payload = isNote ? noteOrSale : buildNotePayload(noteOrSale);

    document.getElementById('danfeTitle').textContent = payload.numberDisplay || `NF-e ${payload.series}/${payload.number}`;
    document.getElementById('danfeMeta').innerHTML = `
      <p><strong>Chave:</strong> ${app.escapeHtml(formatAccessKey(payload.accessKey))}</p>
      <p><strong>Natureza:</strong> ${app.escapeHtml(payload.naturezaOperacao || fiscal.naturezaOperacao)}</p>
      ${payload.protocol ? `<p><strong>Protocolo:</strong> ${app.escapeHtml(payload.protocol)}</p>` : ''}
    `;

    document.getElementById('danfeEmitter').innerHTML = `
      <p><strong>${app.escapeHtml(payload.emitter?.razaoSocial || fiscal.razaoSocial)}</strong></p>
      <p>CNPJ: ${app.escapeHtml(payload.emitter?.cnpj || fiscal.cnpj)}</p>
      <p>IE: ${app.escapeHtml(payload.emitter?.ie || fiscal.ie)}</p>
      <p>${app.escapeHtml(payload.emitter?.endereco || fiscal.endereco)}</p>
    `;

    document.getElementById('danfeCustomer').innerHTML = `
      <p><strong>${app.escapeHtml(payload.customer)}</strong></p>
      <p>CPF/CNPJ: ${app.escapeHtml(payload.customerDocument || '-')}</p>
      <p>Venda: ${app.escapeHtml(sale?.date || '-')}</p>
      <p>Vendedor: ${app.escapeHtml(sale?.seller || '-')}</p>
    `;

    const items = payload.items || [];
    app.renderTable(
      document.getElementById('danfeItemsBody'),
      items.map(
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

    document.getElementById('danfeTotals').innerHTML = `
      <p>Base de cálculo ICMS: <strong>${app.formatCurrency(payload.total)}</strong></p>
      <p>ICMS (18% simulado): <strong>${app.formatCurrency(payload.icmsTotal || 0)}</strong></p>
      <p class="danfe-total-line">Valor total da NF-e: <strong>${app.formatCurrency(payload.total)}</strong></p>
    `;

    previewPanel.hidden = false;
    return payload;
  }

  function updateKpis() {
    const sales = getSales();
    const notes = getNotes();
    const pending = sales.filter((s) => !s.noteNumber).length;
    const total = notes.reduce((acc, n) => acc + (n.total || 0), 0);
    app.setText('fiscalKpiNotes', String(notes.length));
    app.setText('fiscalKpiPending', String(pending));
    app.setText('fiscalKpiTotal', app.formatCurrency(total));
  }

  function fillSalesOptions() {
    const sales = getSales().filter((s) => !s.noteNumber);
    salesSelect.innerHTML = '<option value="">Selecione uma venda</option>';
    sales.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.date} — ${s.customer} — ${app.formatCurrency(s.total)} (${(s.items || []).length} itens)`;
      salesSelect.appendChild(opt);
    });
    previewSale = null;
    emitBtn.disabled = true;
    previewPanel.hidden = true;
  }

  function renderNotes() {
    const notes = getNotes();
    app.renderTable(
      notesTable,
      [...notes].reverse().map(
        (n) => `<tr>
          <td>${app.escapeHtml(n.numberDisplay || n.number)}</td>
          <td class="chave-cell" title="${app.escapeHtml(n.accessKey || '')}">${n.accessKey ? `${app.escapeHtml(formatAccessKey(n.accessKey).slice(0, 24))}…` : '—'}</td>
          <td>${app.escapeHtml(n.customer)}</td>
          <td>${app.formatCurrency(n.total)}</td>
          <td>${app.escapeHtml(n.date)}</td>
          <td><span class="status-badge status-active">${app.escapeHtml(n.status)}</span></td>
          <td class="action-btns"><span data-action="view-note" data-id="${n.id}" title="Ver DANFE">👁️</span></td>
        </tr>`
      ),
      7,
      'Nenhuma nota emitida.'
    );
    updateKpis();
  }

  function runTransmitSimulation(onComplete) {
    const steps = document.querySelectorAll('#transmitSteps li');
    const resultEl = document.getElementById('transmitResult');
    const closeBtn = document.getElementById('closeTransmitBtn');
    steps.forEach((s) => s.classList.remove('done', 'active', 'error'));
    resultEl.hidden = true;
    closeBtn.disabled = true;
    transmitModal.style.display = 'flex';

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
      resultEl.textContent = 'NF-e autorizada com sucesso (simulação). Protocolo registrado.';
      resultEl.className = 'transmit-result success';
      closeBtn.disabled = false;
      onComplete();
    }, 700);
  }

  function showNoteDetail(note) {
    renderDanfe(note);
    document.getElementById('noteDetailContent').innerHTML = previewPanel.innerHTML;
    noteDetailModal.style.display = 'flex';
  }

  previewBtn?.addEventListener('click', () => {
    const saleId = salesSelect.value;
    if (!saleId) {
      app.notify('Selecione uma venda para pré-visualizar.');
      return;
    }
    const sale = getSales().find((s) => s.id === saleId);
    if (!sale) return;
    previewSale = sale;
    renderDanfe(sale);
    emitBtn.disabled = false;
  });

  emitBtn?.addEventListener('click', () => {
    const saleId = salesSelect.value;
    if (!saleId) {
      app.notify('Selecione uma venda.');
      return;
    }
    const sales = getSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    runTransmitSimulation(() => {
      const note = buildNotePayload(sale);
      sale.noteNumber = note.numberDisplay;
      setSales(sales);

      const notes = getNotes();
      notes.push(note);
      setNotes(notes);

      app.notify('NF-e autorizada (simulação).');
      fillSalesOptions();
      renderNotes();
      renderDanfe(note);
    });
  });

  salesSelect?.addEventListener('change', () => {
    previewSale = null;
    emitBtn.disabled = true;
    previewPanel.hidden = true;
  });

  document.getElementById('closeTransmitBtn')?.addEventListener('click', () => {
    transmitModal.style.display = 'none';
  });

  transmitModal?.addEventListener('click', (e) => {
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

  notesTable?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'view-note') return;
    const note = getNotes().find((n) => n.id === target.dataset.id);
    if (note) showNoteDetail(note);
  });

  fillSalesOptions();
  renderNotes();
});
