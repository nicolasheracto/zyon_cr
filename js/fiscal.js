/* === EMISSÃO DE NOTAS FISCAIS (fiscal.html) ===
   - Lista vendas sem nota fiscal
   - Emite nota fiscal para uma venda selecionada
   - Exibe histórico de notas emitidas */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const salesSelect = document.getElementById('salesSelect');
  const notesTable = document.getElementById('fiscalNotesBody');

  /* Retorna vendas do localStorage */
  function getSales() {
    return app.getData(app.KEYS.sales, []);
  }

  /* Salva vendas no localStorage */
  function setSales(sales) {
    app.setData(app.KEYS.sales, sales);
  }

  /* Retorna notas fiscais do localStorage */
  function getNotes() {
    return app.getData(app.KEYS.fiscalNotes, []);
  }

  /* Salva notas fiscais no localStorage */
  function setNotes(notes) {
    app.setData(app.KEYS.fiscalNotes, notes);
  }

  /* Preenche o select com vendas que ainda não têm nota fiscal */
  function fillSalesOptions() {
    const sales = getSales().filter((s) => !s.noteNumber);
    salesSelect.innerHTML = '<option value="">Selecione uma venda</option>';
    sales.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.date} - ${s.customer} - ${app.formatCurrency(s.total)}`;
      salesSelect.appendChild(opt);
    });
  }

  /* Renderiza a tabela de notas fiscais emitidas */
  function renderNotes() {
    const notes = getNotes();
    notesTable.innerHTML = '';
    if (!notes.length) {
      notesTable.innerHTML = '<tr><td colspan="5">Nenhuma nota emitida.</td></tr>';
      return;
    }

    /* Exibe da mais recente para a mais antiga */
    [...notes].reverse().forEach((n) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${n.number}</td>
        <td>${n.customer}</td>
        <td>${app.formatCurrency(n.total)}</td>
        <td>${n.date}</td>
        <td><span class="status-badge status-active">Autorizada</span></td>
      `;
      notesTable.appendChild(tr);
    });
  }

  /* Botão "Emitir NF": gera número e salva a nota */
  document.getElementById('emitNoteBtn')?.addEventListener('click', () => {
    const saleId = salesSelect.value;
    if (!saleId) {
      app.notify('Selecione uma venda.');
      return;
    }

    const sales = getSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    /* Gera número único baseado no timestamp */
    const number = `NF-${Date.now().toString().slice(-8)}`;
    sale.noteNumber = number; /* Marca a venda como "com nota" */
    setSales(sales);

    /* Cria o registro da nota fiscal */
    const notes = getNotes();
    notes.push({
      id: crypto.randomUUID(),
      number,
      customer: sale.customer,
      total: sale.total,
      date: new Date().toLocaleString('pt-BR')
    });
    setNotes(notes);

    app.notify('Nota fiscal emitida.');
    fillSalesOptions(); /* Atualiza select (remove a venda que já tem nota) */
    renderNotes();
  });

  /* Inicialização */
  fillSalesOptions();
  renderNotes();
});
