/* === CONFIGURAÇÕES GERAIS (configuracoes.js) === 
   - Gerencia a tela de configurações do sistema.
   - Permite alterar o nome da empresa e o limite para alerta de estoque baixo.
*/

// Aguarda o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa os componentes globais e obtém a instância da aplicação
  const app = window.ZyonApp.initPage();

  // Mapeia os elementos do formulário de configurações
  const form = document.getElementById('settingsForm');
  const companyName = document.getElementById('companyName');
  const lowStock = document.getElementById('lowStockThreshold');

  // Carrega as configurações atuais do armazenamento local (ou usa os padrões)
  const settings = app.getData(app.KEYS.settings, app.defaults.settings);
  
  // Preenche os campos do formulário com os valores carregados
  companyName.value = settings.companyName || 'Zyon ERP';
  lowStock.value = settings.lowStockThreshold ?? 10;

  // Intercepta o evento de envio (submit) do formulário
  form?.addEventListener('submit', (event) => {
    event.preventDefault(); // Previne o recarregamento da página

    // Validação básica: O nome da empresa não pode estar vazio
    if (!companyName.value.trim()) {
      app.notify('Informe o nome da empresa.');
      return;
    }

    // Cria o novo objeto de configurações baseado nos dados preenchidos
    const next = {
      companyName: companyName.value.trim(),
      // Garante que o limite de estoque seja um número maior ou igual a zero
      lowStockThreshold: Math.max(0, Number(lowStock.value || 0))
    };

    // Salva as novas configurações no localStorage
    app.setData(app.KEYS.settings, next);
    
    // Reaplica o nome da empresa na interface (ex: na barra lateral ou topo)
    app.applyBranding();
    
    // Notifica o usuário do sucesso
    app.notify('Configurações salvas.');
  });
});
