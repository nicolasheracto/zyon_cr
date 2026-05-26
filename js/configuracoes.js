/* === CONFIGURAÇÕES GERAIS (configuracoes.html) === */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();

  const form = document.getElementById('settingsForm');
  const companyName = document.getElementById('companyName');
  const lowStock = document.getElementById('lowStockThreshold');

  const settings = app.getData(app.KEYS.settings, app.defaults.settings);
  companyName.value = settings.companyName || 'Zyon ERP';
  lowStock.value = settings.lowStockThreshold ?? 10;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!companyName.value.trim()) {
      app.notify('Informe o nome da empresa.');
      return;
    }

    const next = {
      companyName: companyName.value.trim(),
      lowStockThreshold: Math.max(0, Number(lowStock.value || 0))
    };

    app.setData(app.KEYS.settings, next);
    app.applyBranding();
    app.notify('Configurações salvas.');
  });
});
