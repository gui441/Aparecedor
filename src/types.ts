export interface DespachoData {
  num_processo: string;
  num_nota_fiscal: string;
  secretaria: string;
  num_contrato: string;
  tipo_pregao?: string;
  num_pregao?: string;
  num_aditivo?: string;
  num_apostilamento?: string;
  num_adesao?: string;
  num_registro_preco?: string;
  valor: string;
  valor_extenso?: string;
  credor: string;
  cnpj: string;
  objeto: string;
  num_empenho: string;
  num_liquidacao: string;
  lei_regencia?: string;
  is_lei_8666?: boolean;
  dia: string;
  mes: string;
  ano: string;
  [key: string]: any;
}

export interface RecentProcess {
  id: string;
  timestamp: number;
  dateFormatted: string;
  structuredData: DespachoData;
  extractedText?: string;
  fileName?: string;
}
