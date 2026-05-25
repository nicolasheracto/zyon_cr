/* === CONFIGURAÇÕES (configuracoes.html) ===
   - Permite alterar o nome da empresa (aplicado via .js-company-name)
   - Permite definir o limite de estoque baixo (usado nos relatórios e badges) */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const form = document.getElementById('settingsForm');
  const companyName = document.getElementById('companyName');
  const lowStock = document.getElementById('lowStockThreshold');

  /* Carrega as configurações atuais e preenche os campos */
  const settings = app.getData(app.KEYS.settings, app.defaults.settings);
  companyName.value = settings.companyName || 'Zyon ERP';
  lowStock.value = settings.lowStockThreshold ?? 10;

  /* Submit: salva as novas configurações e reaplica o branding */
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = {
      companyName: companyName.value.trim() || 'Zyon ERP',
      lowStockThreshold: Math.max(0, Number(lowStock.value || 0))
    };
    app.setData(app.KEYS.settings, next);
    app.applyBranding(); /* Atualiza nome da empresa em toda a página */
    app.notify('Configurações salvas.');
  });
});
