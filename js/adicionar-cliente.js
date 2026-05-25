/* === FORMULÁRIO DE NOVO CLIENTE (adicionar-cliente.html) ===
   - Captura os dados do formulário e salva no localStorage */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const form = document.getElementById('clientForm');
  const cancelButtons = document.querySelectorAll('.cancel-client-btn');

  /* Submit do formulário: valida e salva o cliente */
  form?.addEventListener('submit', (event) => {
    event.preventDefault(); /* Impede o reload da página */

    /* Captura valores dos campos */
    const nome = document.getElementById('nome')?.value.trim();
    const documento = document.getElementById('documento')?.value.trim();
    const contato = document.getElementById('contato')?.value.trim();
    const tipo = document.querySelector('input[name="tipoPessoa"]:checked')?.value || 'pf';

    /* Valida campos obrigatórios */
    if (!nome || !documento) {
      app.notify('Preencha os campos obrigatórios.');
      return;
    }

    /* Adiciona o novo cliente ao array e salva */
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

    /* Redireciona para a página de cadastros após breve delay */
    setTimeout(() => {
      window.location.href = 'cadastros.html';
    }, 500);
  });

  /* Botão cancelar: volta para a página de cadastros */
  cancelButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = 'cadastros.html';
    });
  });
});
