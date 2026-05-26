/* === VALIDADORES ERP (validators.js) === */

(() => {
  const CONSUMIDOR_FINAL_DOC = '00000000000';

  function onlyDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function isValidCPF(cpf) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    if (digits === CONSUMIDOR_FINAL_DOC) return true;

    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== Number(digits[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === Number(digits[10]);
  }

  function isValidCNPJ(cnpj) {
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(digits)) return false;

    const calc = (length) => {
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

    return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
  }

  function isValidDocument(doc) {
    const digits = onlyDigits(doc);
    if (digits.length === 11) return isValidCPF(digits);
    if (digits.length === 14) return isValidCNPJ(digits);
    return false;
  }

  function isValidEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    if (!value) return true;
    const digits = onlyDigits(value);
    return digits.length >= 10 && digits.length <= 11;
  }

  function hasDuplicate(items, field, value, excludeId = null) {
    const normalized = onlyDigits(value) || String(value).trim().toLowerCase();
    return items.some((item) => {
      if (excludeId && item.id === excludeId) return false;
      const current = field === 'documento'
        ? onlyDigits(item.documento)
        : String(item[field] ?? '').trim().toLowerCase();
      return current === normalized;
    });
  }

  function result(ok, errors = []) {
    return { ok, errors };
  }

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

    if (contato && !isValidEmail(contato) && !isValidPhone(contato)) {
      errors.push('Contato deve ser um e-mail válido ou telefone com DDD.');
    }

    return result(errors.length === 0, errors);
  }

  function validateSeller(data, options = {}) {
    const errors = [];
    const nome = String(data.nome ?? '').trim();
    const documento = String(data.documento ?? '').trim();
    const contato = String(data.contato ?? '').trim();
    const comissao = Number(data.comissao ?? 0);
    const { existing = [], excludeId = null } = options;

    if (nome.length < 3) errors.push('Nome do vendedor deve ter pelo menos 3 caracteres.');
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

  function validateSupplier(data, options = {}) {
    const errors = [];
    const nome = String(data.nome ?? '').trim();
    const documento = String(data.documento ?? '').trim();
    const contato = String(data.contato ?? '').trim();
    const endereco = String(data.endereco ?? '').trim();
    const { existing = [], excludeId = null } = options;

    if (nome.length < 3) errors.push('Razão social deve ter pelo menos 3 caracteres.');
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

  function validateProduct(data, options = {}) {
    const errors = [];
    const sku = String(data.sku ?? '').trim().toUpperCase();
    const nome = String(data.nome ?? '').trim();
    const preco = Number(data.preco);
    const quantidade = Number(data.quantidade);
    const { existing = [], excludeId = null } = options;

    if (!/^[A-Z0-9][A-Z0-9._-]{1,29}$/i.test(sku)) {
      errors.push('SKU deve ter 2–30 caracteres (letras, números, . _ -).');
    } else if (hasDuplicate(existing, 'sku', sku, excludeId)) {
      errors.push('Já existe um produto com este SKU.');
    }

    if (nome.length < 3) errors.push('Nome do produto deve ter pelo menos 3 caracteres.');
    if (Number.isNaN(preco) || preco <= 0) errors.push('Preço deve ser maior que zero.');
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      errors.push('Quantidade deve ser um número inteiro igual ou maior que zero.');
    }

    return result(errors.length === 0, errors);
  }

  window.ZyonValidators = {
    onlyDigits,
    isValidCPF,
    isValidCNPJ,
    isValidDocument,
    validateClient,
    validateSeller,
    validateSupplier,
    validateProduct
  };
})();
