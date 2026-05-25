document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const salesSelect = document.getElementById('salesSelect');
  const notesTable = document.getElementById('fiscalNotesBody');

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

  function renderNotes() {
    const notes = getNotes();
    notesTable.innerHTML = '';
    if (!notes.length) {
      notesTable.innerHTML = '<tr><td colspan="5">Nenhuma nota emitida.</td></tr>';
      return;
    }

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

  document.getElementById('emitNoteBtn')?.addEventListener('click', () => {
    const saleId = salesSelect.value;
    if (!saleId) {
      app.notify('Selecione uma venda.');
      return;
    }

    const sales = getSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    const number = `NF-${Date.now().toString().slice(-8)}`;
    sale.noteNumber = number;
    setSales(sales);

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
    fillSalesOptions();
    renderNotes();
  });

  fillSalesOptions();
  renderNotes();
});
