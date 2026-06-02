/* === VALIDADORES ERP (validators.js) === 
   - Centraliza todas as regras de validação do sistema
   - Validações de CPF, CNPJ, Email e regras de negócio de produtos, vendedores, etc.
*/

(() => {
  // Constante para CPF padrão de Consumidor Final
  const CONSUMIDOR_FINAL_DOC = '00000000000';

  /**
   * Remove todos os caracteres não numéricos de uma string de forma segura.
   * Utilizado antes de qualquer operação matemática ou validação de documentos.
   * 
   * @param {string} value - A string a ser limpa (ex: "123.456.789-00")
   * @returns {string} Retorna apenas os dígitos (ex: "12345678900"). Retorna string vazia se o valor for nulo/indefinido.
   */
  function onlyDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  /**
   * Valida se um CPF é matematicamente correto calculando seus dígitos verificadores.
   * Utiliza a regra do Módulo 11 da Receita Federal.
   * 
   * @param {string} cpf - O CPF com ou sem formatação de pontuação.
   * @returns {boolean} `true` se o CPF for válido, caso contrário `false`.
   */
  function isValidCPF(cpf) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais (ex: 111.111.111-11 é inválido matematicamente, mas passaria no cálculo)
    if (/^(\d)\1{10}$/.test(digits)) return false;
    
    // Abre exceção para o CPF padrão do PDV (Consumidor Final)
    if (digits === CONSUMIDOR_FINAL_DOC) return true;

    // Cálculo do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== Number(digits[9])) return false;

    // Cálculo do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    
    return rest === Number(digits[10]);
  }

  /**
   * Valida se um CNPJ é matematicamente correto calculando seus dígitos verificadores.
   * Utiliza a regra do Módulo 11 da Receita Federal com pesos variáveis.
   * 
   * @param {string} cnpj - O CNPJ com ou sem formatação de pontuação.
   * @returns {boolean} `true` se o CNPJ for válido, caso contrário `false`.
   */
  function isValidCNPJ(cnpj) {
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) return false;
    // Bloqueia sequência de números idênticos
    if (/^(\d)\1{13}$/.test(digits)) return false;

    /**
     * Função interna para calcular o dígito verificador baseado no Módulo 11.
     * @param {number} length - 12 para o primeiro dígito, 13 para o segundo.
     * @returns {number} O dígito calculado (0 a 9).
     */
    const calc = (length) => {
      // Os pesos multiplicadores mudam dependendo de qual dígito verificador estamos calculando
      const weights = length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      
      let sum = 0;
      for (let i = 0; i < weights.length; i += 1) {
        sum += Number(digits[i]) * weights[i];
      }
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };

    // Compara os dois dígitos calculados com os dois últimos dígitos literais do CNPJ digitado
    return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
  }

  /**
   * Verifica se o documento fornecido é um CPF válido ou um CNPJ válido, baseado na quantidade de dígitos.
   * 
   * @param {string} doc - O documento (CPF ou CNPJ) com ou sem formatação.
   * @returns {boolean} `true` se for um documento válido, `false` se for inválido ou não tiver tamanho adequado.
   */
  function isValidDocument(doc) {
    const digits = onlyDigits(doc);
    if (digits.length === 11) return isValidCPF(digits);
    if (digits.length === 14) return isValidCNPJ(digits);
    return false;
  }

  /**
   * Validação simples de formato de email usando expressão regular.
   * Não valida a existência real do email, apenas a sintaxe (ex: user@domain.com).
   * 
   * @param {string} value - O email a ser validado.
   * @returns {boolean} `true` se a sintaxe for válida. Retorna `true` também se estiver vazio (campo opcional).
   */
  function isValidEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * Validação simples de telefone.
   * Aceita valores entre 10 e 11 dígitos, presumindo a inclusão de DDD (ex: 11 99999-9999).
   * 
   * @param {string} value - O telefone com ou sem formatação.
   * @returns {boolean} `true` se tiver entre 10 e 11 dígitos. Retorna `true` se estiver vazio (opcional).
   */
  function isValidPhone(value) {
    if (!value) return true;
    const digits = onlyDigits(value);
    return digits.length >= 10 && digits.length <= 11;
  }

  /**
   * Checa se um valor já existe em um array de objetos, evitando registros duplicados no banco (localStorage).
   * Útil para barrar cadastro de CPFs, CNPJs ou SKUs repetidos.
   * 
   * @param {Array<Object>} items - O array de objetos que representam a "tabela" (ex: todos os clientes).
   * @param {string} field - O nome da chave do objeto a checar (ex: 'documento', 'sku').
   * @param {string} value - O valor digitado pelo usuário que precisa ser validado.
   * @param {string|null} [excludeId=null] - (Opcional) O ID do registro atual. Utilizado durante edições para não comparar o registro consigo mesmo.
   * @returns {boolean} `true` se encontrou uma duplicata, `false` se o valor estiver livre para uso.
   */
  function hasDuplicate(items, field, value, excludeId = null) {
    // Normalização: se for documento retira a pontuação, senão vira minúsculo.
    const normalized = onlyDigits(value) || String(value).trim().toLowerCase();
    
    return items.some((item) => {
      // Ignora o item caso seja ele mesmo sendo editado
      if (excludeId && item.id === excludeId) return false;
      
      const current = field === 'documento'
        ? onlyDigits(item.documento)
        : String(item[field] ?? '').trim().toLowerCase();
        
      return current === normalized;
    });
  }

  /**
   * Função utilitária interna para padronizar o retorno dos validadores de negócio.
   * Retorna um objeto indicando sucesso e lista de mensagens de erro amigáveis ao usuário.
   * 
   * @param {boolean} ok - Indica se a validação passou.
   * @param {Array<string>} [errors=[]] - Lista de strings contendo as descrições dos erros.
   * @returns {Object} Objeto no formato `{ ok: boolean, errors: string[] }`.
   */
  function result(ok, errors = []) {
    return { ok, errors };
  }

  /* =========================================================
     VALIDADORES DE REGRA DE NEGÓCIO (ENTIDADES)
     Essas funções avaliam todos os campos de um formulário de uma vez só.
  ========================================================= */

  /**
   * Valida os dados para criação ou edição de um Cliente.
   * 
   * @param {Object} data - Dados preenchidos no formulário (`nome`, `documento`, `contato`).
   * @param {Object} [options={}] - Configurações extras de validação.
   * @param {Array<Object>} [options.existing=[]] - Lista atual de clientes (para checar duplicatas).
   * @param {string} [options.excludeId=null] - ID do cliente atual (se for edição).
   * @returns {Object} Objeto de resultado da validação (ver função `result`).
   */
  function validateClient(data, options = {}) {
    const errors = [];
    const nome = String(data.nome ?? '').trim();
    const documento = String(data.documento ?? '').trim();
    const contato = String(data.contato ?? '').trim();
    const { existing = [], excludeId = null } = options;

    if (nome.length < 3) errors.push('Nome deve ter pelo menos 3 caracteres.');
    
    if (!documento) errors.push('Informe o CPF ou CNPJ.');
    else if (!isValidDocument(documento)) errors.push('CPF ou CNPJ inválido.');
    else if (hasDuplicate(existing, 'documento', documento, excludeId)) {
      errors.push('Já existe um cliente com este documento.');
    }

    // Contato não é obrigatório, mas se preenchido precisa ser um e-mail ou telefone plausível
    if (contato && !isValidEmail(contato) && !isValidPhone(contato)) {
      errors.push('Contato deve ser um e-mail válido ou telefone com DDD.');
    }

    return result(errors.length === 0, errors);
  }

  /**
   * Valida os dados para criação ou edição de um Vendedor.
   * 
   * @param {Object} data - Dados preenchidos (`nome`, `documento`, `contato`, `comissao`).
   * @param {Object} [options={}] - Configurações extras.
   * @returns {Object} Objeto de resultado da validação.
   */
  function validateSeller(data, options = {}) {
    const errors = [];
    const nome = String(data.nome ?? '').trim();
    const documento = String(data.documento ?? '').trim();
    const contato = String(data.contato ?? '').trim();
    const comissao = Number(data.comissao ?? 0);
    const { existing = [], excludeId = null } = options;

    if (nome.length < 3) errors.push('Nome do vendedor deve ter pelo menos 3 caracteres.');
    
    // Vendedores do Zyon ERP exigem CPF (não suportam CNPJ)
    if (!documento) errors.push('Informe o CPF do vendedor.');
    else if (!isValidCPF(documento)) errors.push('CPF do vendedor inválido.');
    else if (hasDuplicate(existing, 'documento', documento, excludeId)) {
      errors.push('Já existe um vendedor com este CPF.');
    }

    if (Number.isNaN(comissao) || comissao < 0 || comissao > 100) {
      errors.push('Comissão deve estar entre 0% e 100%.');
    }

    if (contato && !isValidEmail(contato) && !isValidPhone(contato)) {
      errors.push('Contato deve ser um e-mail válido ou telefone com DDD.');
    }

    return result(errors.length === 0, errors);
  }

  /**
   * Valida os dados para criação ou edição de um Fornecedor.
   * 
   * @param {Object} data - Dados preenchidos (`nome`, `documento`, `contato`, `endereco`).
   * @param {Object} [options={}] - Configurações extras.
   * @returns {Object} Objeto de resultado da validação.
   */
  function validateSupplier(data, options = {}) {
    const errors = [];
    const nome = String(data.nome ?? '').trim();
    const documento = String(data.documento ?? '').trim();
    const contato = String(data.contato ?? '').trim();
    const endereco = String(data.endereco ?? '').trim();
    const { existing = [], excludeId = null } = options;

    if (nome.length < 3) errors.push('Razão social deve ter pelo menos 3 caracteres.');
    
    // Fornecedores exigem CNPJ
    if (!documento) errors.push('Informe o CNPJ do fornecedor.');
    else if (!isValidCNPJ(documento)) errors.push('CNPJ do fornecedor inválido.');
    else if (hasDuplicate(existing, 'documento', documento, excludeId)) {
      errors.push('Já existe um fornecedor com este CNPJ.');
    }

    if (contato && !isValidEmail(contato) && !isValidPhone(contato)) {
      errors.push('Contato deve ser um e-mail válido ou telefone com DDD.');
    }

    if (endereco && endereco.length < 5) {
      errors.push('Endereço deve ser mais descritivo (mín. 5 caracteres).');
    }

    return result(errors.length === 0, errors);
  }

  /**
   * Valida os dados para o cadastro de um Produto no estoque.
   * 
   * @param {Object} data - Dados preenchidos (`sku`, `nome`, `preco`, `quantidade`).
   * @param {Object} [options={}] - Configurações extras.
   * @returns {Object} Objeto de resultado da validação.
   */
  function validateProduct(data, options = {}) {
    const errors = [];
    const sku = String(data.sku ?? '').trim().toUpperCase();
    const nome = String(data.nome ?? '').trim();
    const preco = Number(data.preco);
    const quantidade = Number(data.quantidade);
    const { existing = [], excludeId = null } = options;

    // Regra de formatação do SKU (Código identificador do produto)
    // Exige iniciar com letra/número e conter até 30 caracteres válidos
    if (!/^[A-Z0-9][A-Z0-9._-]{1,29}$/i.test(sku)) {
      errors.push('SKU deve ter 2–30 caracteres (letras, números, . _ -).');
    } else if (hasDuplicate(existing, 'sku', sku, excludeId)) {
      errors.push('Já existe um produto com este SKU.');
    }

    if (nome.length < 3) errors.push('Nome do produto deve ter pelo menos 3 caracteres.');
    if (Number.isNaN(preco) || preco <= 0) errors.push('Preço deve ser maior que zero.');
    
    // Quantidade física de estoque precisa ser número inteiro positivo
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      errors.push('Quantidade deve ser um número inteiro igual ou maior que zero.');
    }

    return result(errors.length === 0, errors);
  }

  /* =========================================================
     VALIDADORES FISCAIS (MÓDULO NF-E)
  ========================================================= */

  /**
   * Valida um Código Fiscal de Operações e Prestações (CFOP) digitado pelo usuário.
   * 
   * @param {string} cfop - O código a ser validado.
   * @returns {boolean} `true` se for um CFOP de 4 dígitos iniciado entre 1 e 7, sem ser 0000.
   */
  function isValidCfop(cfop) {
    const code = String(cfop ?? '').trim();
    // Exige 4 dígitos começando com 1 a 7 (ex: 5102, 6102)
    if (!/^[1-7]\d{3}$/.test(code)) return false;
    if (code === '0000') return false;
    return true;
  }

  /**
   * Valida o texto descritivo da Natureza da Operação (informação obrigatória na NF-e).
   * 
   * @param {string} value - A descrição da operação.
   * @returns {Object} Objeto de resultado da validação com as mensagens de erro (se houver).
   */
  function validateNaturezaOperacao(value) {
    const text = String(value ?? '').trim();
    const errors = [];
    if (text.length < 10) errors.push('Natureza da operação deve ter pelo menos 10 caracteres.');
    if (text.length > 60) errors.push('Natureza da operação: máximo 60 caracteres.');
    return result(errors.length === 0, errors);
  }

  /**
   * Valida as configurações básicas do emitente antes de salvar (Tela de Configurações Fiscais).
   * 
   * @param {Object} emitter - Dados do emissor da Nota (Empresa do dono do ERP).
   * @returns {Object} Objeto de resultado da validação.
   */
  function validateFiscalEmitter(emitter) {
    const errors = [];
    const razao = String(emitter?.razaoSocial ?? '').trim();
    const cnpj = String(emitter?.cnpj ?? '').trim();
    const ie = String(emitter?.ie ?? '').trim();
    const endereco = String(emitter?.endereco ?? '').trim();
    const serie = String(emitter?.serie ?? '').trim();

    if (razao.length < 3) errors.push('Informe a razão social do emitente.');
    if (!isValidCNPJ(cnpj)) errors.push('CNPJ do emitente inválido.');
    if (ie.length < 3) errors.push('Informe a inscrição estadual do emitente.');
    if (endereco.length < 5) errors.push('Informe o endereço completo do emitente.');
    if (!serie || !/^\d{1,3}$/.test(serie)) errors.push('Série da NF-e deve ser numérica (1 a 3 dígitos).');

    return result(errors.length === 0, errors);
  }

  /**
   * Valida se uma justificativa de cancelamento de Nota Fiscal atende aos requisitos mínimos da SEFAZ.
   * 
   * @param {string} value - Texto justificando o cancelamento.
   * @returns {Object} Objeto de resultado da validação.
   */
  function validateCancelJustification(value) {
    const text = String(value ?? '').trim();
    const errors = [];
    // SEFAZ exige um mínimo de caracteres para a justificativa para inibir textos como "erro"
    if (text.length < 15) {
      errors.push('Justificativa do cancelamento deve ter pelo menos 15 caracteres.');
    }
    if (text.length > 255) {
      errors.push('Justificativa do cancelamento: máximo 255 caracteres.');
    }
    return result(errors.length === 0, errors);
  }

  /**
   * Executa uma validação ampla antes de permitir a emissão/simulação de uma NF-e.
   * Checa se todos os produtos possuem um CFOP válido vinculado.
   * 
   * @param {Object} noteData - Dados da nota, incluindo a Natureza e a lista de CFOPs escolhidos.
   * @param {Object} sale - O objeto da Venda contendo os itens comercializados.
   * @returns {Object} Objeto de resultado da validação apontando o que falta preencher.
   */
  function validateNoteEmission(noteData, sale) {
    const errors = [];
    
    // 1. Checa a natureza da operação (Mín 10 e Max 60 chars)
    const naturezaCheck = validateNaturezaOperacao(noteData?.naturezaOperacao);
    if (!naturezaCheck.ok) errors.push(...naturezaCheck.errors);

    // 2. Checa se a venda vinculada possui itens reais (não dá pra emitir NF-e vazia)
    const items = sale?.items || [];
    if (!items.length) errors.push('A venda não possui itens para emissão.');

    // 3. Verifica correspondência entre a quantidade de produtos e a quantidade de CFOPs informados
    const cfops = noteData?.itemCfops || [];
    if (cfops.length !== items.length) {
      errors.push('Informe o CFOP de todos os itens da nota.');
    }

    // 4. Valida a estrutura individual de cada CFOP informado
    items.forEach((item, index) => {
      const cfop = cfops[index];
      if (!isValidCfop(cfop)) {
        errors.push(`CFOP inválido no item "${item.name}". Use 4 dígitos (ex.: 5102, 6102).`);
      }
    });

    return result(errors.length === 0, errors);
  }

  // ============================================================================
  // EXPORTAÇÃO GLOBAL
  // Disponibiliza as funções na janela do navegador para serem usadas em outras telas
  // ============================================================================
  window.ZyonValidators = {
    onlyDigits,
    isValidCPF,
    isValidCNPJ,
    isValidDocument,
    isValidCfop,
    validateClient,
    validateSeller,
    validateSupplier,
    validateProduct,
    validateNaturezaOperacao,
    validateFiscalEmitter,
    validateNoteEmission,
    validateCancelJustification
  };
})();
