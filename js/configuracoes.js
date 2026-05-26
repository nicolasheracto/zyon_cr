/* === CONFIGURAÇÕES (configuracoes.html) === */

document.addEventListener('DOMContentLoaded', () => {
  const app = window.ZyonApp.initPage();
  const v = window.ZyonValidators;

  const form = document.getElementById('settingsForm');
  const companyName = document.getElementById('companyName');
  const lowStock = document.getElementById('lowStockThreshold');
  const fiscalRazao = document.getElementById('fiscalRazao');
  const fiscalCnpj = document.getElementById('fiscalCnpj');
  const fiscalIe = document.getElementById('fiscalIe');
  const fiscalEndereco = document.getElementById('fiscalEndereco');
  const fiscalSerie = document.getElementById('fiscalSerie');
  const fiscalCfop = document.getElementById('fiscalCfop');
  const fiscalNatureza = document.getElementById('fiscalNatureza');

  const settings = app.getData(app.KEYS.settings, app.defaults.settings);
  const fiscal = { ...app.defaults.settings.fiscal, ...(settings.fiscal || {}) };

  companyName.value = settings.companyName || 'Zyon ERP';
  lowStock.value = settings.lowStockThreshold ?? 10;
  fiscalRazao.value = fiscal.razaoSocial || '';
  fiscalCnpj.value = fiscal.cnpj || '';
  fiscalIe.value = fiscal.ie || '';
  fiscalEndereco.value = fiscal.endereco || '';
  fiscalSerie.value = fiscal.serie || '1';
  fiscalCfop.value = fiscal.cfopPadrao || '5102';
  fiscalNatureza.value = fiscal.naturezaOperacao || '';

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!companyName.value.trim()) {
      app.notify('Informe o nome da empresa.');
      return;
    }

    if (!v.isValidCNPJ(fiscalCnpj.value)) {
      app.notify('CNPJ do emitente inválido.');
      return;
    }

    if (fiscalEndereco.value.trim().length < 5) {
      app.notify('Informe o endereço completo do emitente.');
      return;
    }

    if (!/^\d{4}$/.test(fiscalCfop.value.trim())) {
      app.notify('CFOP deve conter 4 dígitos.');
      return;
    }

    const next = {
      companyName: companyName.value.trim(),
      lowStockThreshold: Math.max(0, Number(lowStock.value || 0)),
      fiscal: {
        razaoSocial: fiscalRazao.value.trim(),
        cnpj: fiscalCnpj.value.trim(),
        ie: fiscalIe.value.trim(),
        endereco: fiscalEndereco.value.trim(),
        serie: fiscalSerie.value.trim() || '1',
        cfopPadrao: fiscalCfop.value.trim(),
        naturezaOperacao: fiscalNatureza.value.trim()
      }
    };

    app.setData(app.KEYS.settings, next);
    app.applyBranding();
    app.notify('Configurações salvas.');
  });
});
