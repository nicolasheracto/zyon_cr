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
  const noteEmissionFields = document.getElementById('noteEmissionFields');
  const noteNatureza = document.getElementById('noteNatureza');
  const noteItemsCfopBody = document.getElementById('noteItemsCfopBody');
  const fiscalConfigModal = document.getElementById('fiscalConfigModal');
  const fiscalConfigForm = document.getElementById('fiscalConfigForm');
  const cancelNoteModal = document.getElementById('cancelNoteModal');
  const cancelJustification = document.getElementById('cancelJustification');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const cancelFromDetailBtn = document.getElementById('cancelFromDetailBtn');

  let noteIdToCancel = null;
  let detailNoteId = null;

  function getNoteStatus(note) {
    return note.status || 'Autorizada';
  }

  function isNoteAuthorized(note) {
    return getNoteStatus(note) === 'Autorizada';
  }

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

  function getFiscalConfig() {
    return {
      ...app.defaults.fiscalConfig,
      ...app.getData(app.KEYS.fiscalConfig, app.defaults.fiscalConfig)
    };
  }

  function setFiscalConfig(config) {
    app.setData(app.KEYS.fiscalConfig, config);
  }

  function getClients() {
    return app.getData(app.KEYS.clients, []);
  }

  function findClientByName(name) {
    return getClients().find((c) => c.nome === name);
  }

  function suggestCfopForClient(clientName) {
    const client = findClientByName(clientName);
    const doc = v.onlyDigits(client?.documento || '');
    if (doc.length === 14) return '6102';
    return '5102';
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
    return body + mod11Digit(body);
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

  function validateBeforeEmission(sale) {
    const emitterCheck = v.validateFiscalEmitter(getFiscalConfig());
    if (!emitterCheck.ok) {
      return { ok: false, message: emitterCheck.errors[0] + ' Abra Configurações do emitente.' };
    }
    const noteCheck = v.validateNoteEmission(getNoteFormData(), sale);
    if (!noteCheck.ok) {
      return { ok: false, message: noteCheck.errors[0] };
    }
    return { ok: true };
  }

  function buildNotePayload(sale, noteForm) {
    const fiscal = getFiscalConfig();
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
        cfop: noteForm.itemCfops[index],
        lineTotal,
        icms
      };
    });

    const icmsTotal = items.reduce((acc, i) => acc + i.icms, 0);
    const productsTotal = items.reduce((acc, i) => acc + i.lineTotal, 0);

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
      total: sale.total || productsTotal,
      icmsTotal,
      date: new Date().toLocaleString('pt-BR'),
      xmlSimulated: true
    };
  }

  function renderDanfe(noteOrSale, noteForm) {
    const isNote = Boolean(noteOrSale.saleId);
    const fiscal = getFiscalConfig();
    const sale = isNote ? getSales().find((s) => s.id === noteOrSale.saleId) : noteOrSale;
    const payload = isNote ? noteOrSale : buildNotePayload(noteOrSale, noteForm);

    const cancelled = getNoteStatus(payload) === 'Cancelada';
    document.getElementById('danfeTitle').textContent = payload.numberDisplay || `NF-e ${payload.series}/${payload.number}`;

    let cancelBanner = '';
    if (cancelled) {
      cancelBanner = `<div class="danfe-cancelled-banner">
        NF-e CANCELADA em ${app.escapeHtml(payload.cancelledAt || '—')}
        ${payload.cancelProtocol ? ` · Protocolo: ${app.escapeHtml(payload.cancelProtocol)}` : ''}
        <br><span style="font-weight:400;font-size:0.9rem">Motivo: ${app.escapeHtml(payload.cancelReason || '—')}</span>
      </div>`;
    }

    document.getElementById('danfeMeta').innerHTML = `
      ${cancelBanner}
      <p><strong>Status:</strong> ${app.escapeHtml(getNoteStatus(payload))}</p>
      <p><strong>Chave:</strong> ${app.escapeHtml(formatAccessKey(payload.accessKey))}</p>
      <p><strong>Natureza:</strong> ${app.escapeHtml(payload.naturezaOperacao)}</p>
      ${payload.protocol ? `<p><strong>Protocolo autorização:</strong> ${app.escapeHtml(payload.protocol)}</p>` : ''}
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

    document.getElementById('danfeTotals').innerHTML = `
      <p>Base de cálculo ICMS: <strong>${app.formatCurrency(payload.total)}</strong></p>
      <p>ICMS (18% simulado): <strong>${app.formatCurrency(payload.icmsTotal || 0)}</strong></p>
      <p class="danfe-total-line">Valor total da NF-e: <strong>${app.formatCurrency(payload.total)}</strong></p>
    `;

    previewPanel.hidden = false;
    return payload;
  }

  function renderNoteItemsCfop(sale) {
    if (!sale?.items?.length) {
      noteItemsCfopBody.innerHTML = '<tr><td colspan="3" class="table-empty">Venda sem itens.</td></tr>';
      return;
    }

    const suggested = suggestCfopForClient(sale.customer);
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

  function onSaleSelected() {
    const saleId = salesSelect.value;
    if (!saleId) {
      noteEmissionFields.hidden = true;
      previewBtn.disabled = true;
      emitBtn.disabled = true;
      previewPanel.hidden = true;
      return;
    }

    const sale = getSales().find((s) => s.id === saleId);
    if (!sale) return;

    noteEmissionFields.hidden = false;
    noteNatureza.value = '';
    renderNoteItemsCfop(sale);
    previewBtn.disabled = false;
    emitBtn.disabled = false;
    previewPanel.hidden = true;
  }

  function loadFiscalConfigForm() {
    const cfg = getFiscalConfig();
    document.getElementById('cfgRazao').value = cfg.razaoSocial || '';
    document.getElementById('cfgCnpj').value = cfg.cnpj || '';
    document.getElementById('cfgIe').value = cfg.ie || '';
    document.getElementById('cfgEndereco').value = cfg.endereco || '';
    document.getElementById('cfgSerie').value = cfg.serie || '1';
  }

  function updateKpis() {
    const sales = getSales();
    const notes = getNotes();
    const authorized = notes.filter(isNoteAuthorized);
    const cancelled = notes.filter((n) => getNoteStatus(n) === 'Cancelada');
    const pending = sales.filter((s) => saleAvailableForNfe(s, notes)).length;
    const total = authorized.reduce((acc, n) => acc + (n.total || 0), 0);
    app.setText('fiscalKpiNotes', String(authorized.length));
    app.setText('fiscalKpiCancelled', String(cancelled.length));
    app.setText('fiscalKpiPending', String(pending));
    app.setText('fiscalKpiTotal', app.formatCurrency(total));
  }

  function saleAvailableForNfe(sale, notes) {
    if (!sale.noteNumber) return true;
    const linked = notes.find((n) => n.saleId === sale.id);
    return linked ? !isNoteAuthorized(linked) : true;
  }

  function fillSalesOptions() {
    const notes = getNotes();
    const sales = getSales().filter((s) => saleAvailableForNfe(s, notes));
    salesSelect.innerHTML = '<option value="">Selecione uma venda</option>';
    sales.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.date} — ${s.customer} — ${app.formatCurrency(s.total)} (${(s.items || []).length} itens)`;
      salesSelect.appendChild(opt);
    });
    noteEmissionFields.hidden = true;
    previewBtn.disabled = true;
    emitBtn.disabled = true;
    previewPanel.hidden = true;
  }

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
            <span data-action="view-note" data-id="${n.id}" title="Ver DANFE">👁️</span>
            ${authorized ? `<span data-action="cancel-note" data-id="${n.id}" title="Cancelar NF-e">🚫</span>` : ''}
          </td>
        </tr>`;
      }),
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

  function unlinkSaleFromNote(note) {
    if (!note?.saleId) return;
    const sales = getSales();
    const sale = sales.find((s) => s.id === note.saleId);
    if (sale) {
      sale.noteNumber = null;
      setSales(sales);
    }
  }

  function openCancelModal(note) {
    noteIdToCancel = note.id;
    cancelJustification.value = '';
    document.getElementById('cancelNoteSummary').textContent =
      `${note.numberDisplay || note.number} · ${note.customer} · ${app.formatCurrency(note.total)}`;
    document.getElementById('cancelResult').hidden = true;
    document.querySelectorAll('#cancelSteps li').forEach((s) => s.classList.remove('done', 'active', 'error'));
    confirmCancelBtn.disabled = false;
    confirmCancelBtn.hidden = false;
    cancelNoteModal.style.display = 'flex';
  }

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
      resultEl.textContent = 'Cancelamento homologado pela SEFAZ (simulação).';
      resultEl.className = 'transmit-result success';
      confirmCancelBtn.hidden = true;
      onComplete();
    }, 650);
  }

  function executeCancelNote(noteId, reason) {
    const notes = getNotes();
    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx < 0) return;

    const note = notes[idx];
    if (!isNoteAuthorized(note)) {
      app.notify('Esta nota já está cancelada.');
      return;
    }

    note.status = 'Cancelada';
    note.cancelledAt = new Date().toLocaleString('pt-BR');
    note.cancelReason = reason;
    note.cancelProtocol = `CANC${Date.now()}`.slice(-15);
    notes[idx] = note;
    setNotes(notes);

    unlinkSaleFromNote(note);

    app.notify('NF-e cancelada (simulação). A venda pode receber nova emissão.');
    noteIdToCancel = null;
    fillSalesOptions();
    renderNotes();

    if (detailNoteId === noteId) {
      renderDanfe(note);
      document.getElementById('noteDetailContent').innerHTML = previewPanel.innerHTML;
      cancelFromDetailBtn.hidden = true;
    }
  }

  function showNoteDetail(note) {
    detailNoteId = note.id;
    renderDanfe(note);
    document.getElementById('noteDetailContent').innerHTML = previewPanel.innerHTML;
    cancelFromDetailBtn.hidden = !isNoteAuthorized(note);
    noteDetailModal.style.display = 'flex';
  }

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

  fiscalConfigForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      razaoSocial: document.getElementById('cfgRazao').value.trim(),
      cnpj: document.getElementById('cfgCnpj').value.trim(),
      ie: document.getElementById('cfgIe').value.trim(),
      endereco: document.getElementById('cfgEndereco').value.trim(),
      serie: document.getElementById('cfgSerie').value.trim()
    };

    const validation = v.validateFiscalEmitter(config);
    if (!validation.ok) {
      app.notify(validation.errors[0]);
      return;
    }

    setFiscalConfig(config);
    fiscalConfigModal.style.display = 'none';
    app.notify('Emitente NF-e salvo.');
  });

  previewBtn?.addEventListener('click', () => {
    const sale = getSales().find((s) => s.id === salesSelect.value);
    if (!sale) {
      app.notify('Selecione uma venda.');
      return;
    }

    const check = validateBeforeEmission(sale);
    if (!check.ok) {
      app.notify(check.message);
      return;
    }

    renderDanfe(sale, getNoteFormData());
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

    const check = validateBeforeEmission(sale);
    if (!check.ok) {
      app.notify(check.message);
      return;
    }

    const noteForm = getNoteFormData();

    runTransmitSimulation(() => {
      const note = buildNotePayload(sale, noteForm);
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

  salesSelect?.addEventListener('change', onSaleSelected);

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

  confirmCancelBtn?.addEventListener('click', () => {
    if (!noteIdToCancel) return;

    const justification = cancelJustification?.value.trim() || '';
    const check = v.validateCancelJustification(justification);
    if (!check.ok) {
      app.notify(check.errors[0]);
      return;
    }

    if (!confirm('Confirmar o cancelamento desta NF-e? A venda voltará a ficar disponível para nova emissão.')) {
      return;
    }

    const noteId = noteIdToCancel;
    runCancelSimulation(() => {
      executeCancelNote(noteId, justification);
    });
  });

  cancelFromDetailBtn?.addEventListener('click', () => {
    const note = getNotes().find((n) => n.id === detailNoteId);
    if (note && isNoteAuthorized(note)) {
      noteDetailModal.style.display = 'none';
      openCancelModal(note);
    }
  });

  fillSalesOptions();
  renderNotes();
});
