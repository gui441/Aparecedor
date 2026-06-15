export function valorPorExtenso(valorStr: string): string {
  if (!valorStr) return '';
  
  // Clean string to extract monetary value
  // Remove currency symbols, excess spaces
  let cleaned = valorStr.replace(/R\$\s*/gi, '').trim();
  
  // If formatted like "1.234,56", strip dots and replace comma with dot
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // If formatted like "1234,56"
    cleaned = cleaned.replace(',', '.');
  }
  
  const valor = parseFloat(cleaned);
  if (isNaN(valor)) return '';

  return escreverPorExtenso(valor);
}

function escreverPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenasEspeciais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const converterGrupo = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    
    let resultado = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      resultado += centenas[c];
    }

    if (d > 0 || u > 0) {
      if (resultado !== '') resultado += ' e ';
      if (d === 1) {
        resultado += dezenasEspeciais[u];
      } else {
        if (d > 1) {
          resultado += dezenas[d];
          if (u > 0) resultado += ' e ' + unidades[u];
        } else if (u > 0) {
          resultado += unidades[u];
        }
      }
    }
    return resultado;
  };

  const parteInteira = Math.floor(Math.abs(valor));
  const parteDecimal = Math.round((Math.abs(valor) - parteInteira) * 100);

  let resultadoFinal = '';

  if (parteInteira > 0) {
    const grupos: number[] = [];
    let temp = parteInteira;
    while (temp > 0) {
      grupos.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }

    const singularPlural = [
      { singular: 'real', plural: 'reais' },
      { singular: 'mil', plural: 'mil' },
      { singular: 'milhão', plural: 'milhões' },
      { singular: 'bilhão', plural: 'bilhões' }
    ];

    const partesEscritas: string[] = [];
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      if (g === 0) continue;

      let gS = converterGrupo(g);
      let sufixo = '';
      if (i === 0) {
        sufixo = g === 1 ? 'real' : 'reais';
      } else if (i === 1) {
        sufixo = 'mil';
      } else {
        sufixo = g === 1 ? singularPlural[i].singular : singularPlural[i].plural;
      }
      
      if (i === 1 && g === 1) {
        partesEscritas.unshift('mil');
      } else {
        partesEscritas.unshift(gS + (sufixo ? ' ' + sufixo : ''));
      }
    }

    // Join sections correctly with commas and "e"
    resultadoFinal = partesEscritas.join(', ').replace(/,\s([^,]+)$/, ' e $1');
    resultadoFinal = resultadoFinal.replace('mil e real', 'mil reais').replace('mil e reais', 'mil reais');
    if (!resultadoFinal.includes('real') && !resultadoFinal.includes('reais')) {
      resultadoFinal += ' de reais';
    }
  }

  if (parteDecimal > 0) {
    const centavosEscritos = parteDecimal === 1 ? 'um centavo' : converterGrupo(parteDecimal) + ' centavos';
    if (resultadoFinal !== '') {
      resultadoFinal += ' e ' + centavosEscritos;
    } else {
      resultadoFinal = centavosEscritos;
    }
  }

  return resultadoFinal;
}

/**
 * Normalizes and formats currency inputs to standard R$ XX.XXX,XX
 */
export function formatarReal(valorStr: string): string {
  if (!valorStr) return '';
  let v = valorStr.replace(/R\$\s*/gi, '').replace(/\D/g, '');
  if (v === '') return '';
  
  v = (parseFloat(v) / 100).toFixed(2).toString();
  v = v.replace('.', ',');
  v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return v;
}

/**
 * Normalizes CNPJ inputs to XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(cnpjStr: string): string {
  if (!cnpjStr) return '';
  const digits = cnpjStr.replace(/\D/g, '').substring(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.substring(0, 2)}.${digits.substring(2)}`;
  if (digits.length <= 8) return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5)}`;
  if (digits.length <= 12) return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8)}`;
  return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12, 14)}`;
}

/**
 * Validates CNPJ using official digit check algorithm (offline)
 */
export function validarCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  
  // Exclude known invalid patterns
  if (/^(\d)\1{13}$/.test(clean)) return false;
  
  let tamanho = clean.length - 2;
  let numeros = clean.substring(0, tamanho);
  const digitos = clean.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  tamanho = tamanho + 1;
  numeros = clean.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
}
