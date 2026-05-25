document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp;
  app.startClock();
  app.applyBranding();

  const form = document.getElementById('settingsForm');
  const companyName = document.getElementById('companyName');
  const lowStock = document.getElementById('lowStockThreshold');

  const settings = app.getData(app.KEYS.settings, app.defaults.settings);
  companyName.value = settings.companyName || 'Zyon ERP';
  lowStock.value = settings.lowStockThreshold ?? 10;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = {
      companyName: companyName.value.trim() || 'Zyon ERP',
      lowStockThreshold: Math.max(0, Number(lowStock.value || 0))
    };
    app.setData(app.KEYS.settings, next);
    app.applyBranding();
    app.notify('Configurações salvas.');
  });
});
