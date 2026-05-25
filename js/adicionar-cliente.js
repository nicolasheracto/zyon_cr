document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const form = document.getElementById('clientForm');
  const cancelButtons = document.querySelectorAll('.cancel-client-btn');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const nome = document.getElementById('nome')?.value.trim();
    const documento = document.getElementById('documento')?.value.trim();
    const contato = document.getElementById('contato')?.value.trim();
    const tipo = document.querySelector('input[name="tipoPessoa"]:checked')?.value || 'pf';

    if (!nome || !documento) {
      app.notify('Preencha os campos obrigatórios.');
      return;
    }

    const clients = app.getData(app.KEYS.clients, []);
    clients.push({
      id: crypto.randomUUID(),
      nome,
      documento,
      contato,
      status: 'Ativo',
      tipo
    });
    app.setData(app.KEYS.clients, clients);
    app.notify('Cliente salvo com sucesso.');
    setTimeout(() => {
      window.location.href = 'clientes.html';
    }, 500);
  });

  cancelButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = 'clientes.html';
    });
  });
});
