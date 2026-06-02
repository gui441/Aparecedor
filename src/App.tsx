import { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ScannerFolderConfig } from './components/ScannerFolderConfig';
import { Editor } from './components/Editor';
import { apiService } from './services/api';
import { AlertCircle, Layout, Printer, Info, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import html2pdf from 'html2pdf.js';

export enum AppStep {
  CHOICE = 'CHOICE',
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  RESULT = 'RESULT'
}

export function cleanSecretaria(sec: string): string {
  if (!sec) return '';
  let cleaned = sec.trim();
  
  // Remove Prefeitura municipal prefixes if extracted
  cleaned = cleaned.replace(/^(prefeitura\s+municipal\s+de\s+barra\s+do\s+corda(?: - ma)?|prefeitura\s+municipal\s+de\s+|prefeitura\s+municipal\s+|prefeitura\s+de\s+barra\s+do\s+corda)/i, '');
  
  // Remove Secretaria prefixes
  cleaned = cleaned.replace(/^(secretaria\s+municipal\s+adjunta\s+de\s+|secretaria\s+municipal\s+de\s+|secretaria\s+adjunta\s+de\s+|secretaria\s+de\s+|secretaria\s+municipal\s+|secretaria\s+|sec\.\s+municipal\s+de\s+|sec\.\s+de\s+|sec\s+de\s+|secreteria\s+municipal\s+de\s+|secreteria\s+de\s+|secreteria\s+)/i, '');
  
  cleaned = cleaned.trim();
  
  // Format to standard capitalization if the input is mostly uppercase
  if (cleaned && cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    const pregs = [' De ', ' Do ', ' Da ', ' Dos ', ' Das ', ' E ', ' Ao ', ' Aos ', ' Em ', ' No ', ' Nos '];
    pregs.forEach(preg => {
      cleaned = cleaned.replace(new RegExp(preg, 'g'), preg.toLowerCase());
    });
  }
  
  return cleaned;
}

export function cleanObjeto(obj: string): string {
  if (!obj) return '';
  let cleaned = obj.trim();

  // Pattern matching variations like "para atender as necessidades da secretaria...", "destinado à secretaria...", "para a secretaria..."
  // Portuguese patterns: "para atender...", "destinado à...", "atender a...", "para a...", "da secretaria..."
  const patterns = [
    /\s*(?:para\s+)?atenders?\s+(?:as|às|a|o|os)?\s*(?:necessidades|demandas)?\s*(?:da|do)?\s*(?:secretaria|sec\.|subsecretaria|prefeitura|órgão|fundo|departamento|coordenação|setores|setor)[\s\S]*$/i,
    /\s*destinados?\s+(?:à|a|ao|aos)?\s*(?:secretaria|sec\.|prefeitura|departamento|setores|setor)[\s\S]*$/i,
    /\s*(?:para\s+)?uso\s+(?:na|no|da|do)?\s*(?:secretaria|sec\.|prefeitura|departamento|setores|setor)[\s\S]*$/i,
    /\s*(?:para|em\s+prol\s+de)\s+(?:a|o|as|os)?\s*(?:secretaria|sec\.|prefeitura|departamento|setores|setor)[\s\S]*$/i,
    /\s*vinculados?\s+(?:à|a|ao|aos)?\s*(?:secretaria|sec\.|prefeitura|departamento|setores|setor)[\s\S]*$/i,
    /\s+junto\s+à\s*(?:secretaria|sec\.|prefeitura|departamento)[\s\S]*$/i,
    /\s*(?:destinada|destinado)\s+a\s+atender[\s\S]*$/i,
    /\s+para\s+esta\s+secretaria[\s\S]*$/i,
    /\s+da\s+(?:secretaria|sec\.|prefeitura)[\s\S]*$/i,
  ];

  patterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove trailing prepositions/punctuation that might remain after splitting
  cleaned = cleaned.replace(/,\s*$/g, '')
                   .replace(/;\s*$/g, '')
                   .replace(/\s+para\s*$/gi, '')
                   .replace(/\s+de\s*$/gi, '')
                   .replace(/\s+da\s*$/gi, '')
                   .replace(/\s+do\s*$/gi, '')
                   .replace(/\s+com\s*$/gi, '')
                   .replace(/\s+em\s*$/gi, '')
                   .replace(/\s*-\s*$/g, '')
                   .trim();

  return cleaned;
}

const ReportPage1 = ({ structuredData }: { structuredData: any }) => (
  <>
    <h1>PARECER DO CONTROLE INTERNO MUNICIPAL</h1>
    
    <div className="header-field">Assunto: Análise do Processo Administrativo n.º {structuredData.num_processo}</div>
    <div className="header-field">Objeto: Pagamento da Nota Fiscal n.º {structuredData.num_nota_fiscal}, da Secretaria Municipal de {structuredData.secretaria} desta Municipalidade.</div>
    <div className="header-field">Contrato n.º {structuredData.num_contrato} – Pregão Eletrônico n.º {structuredData.num_pregao}</div>
    <div className="header-field mb-3">Valor: R$ {structuredData.valor}</div>

    <p>
      O Órgão de Controle Interno da Prefeitura Municipal de Barra do Corda – MA, atendendo o previsto nos Artigos 31 e 74 da Constituição Federal, Artigo 59 da Lei Complementar n.º 101, de 04 de maio de 2000, e demais normas que regulam as atribuições do Sistema de Controle Interno, referentes ao exercício de controle prévio e concomitante dos atos de gestão para análise quanto à legalidade e verificação das demais formalidades, no que tange ao Processo Administrativo, encaminhado pela Secretaria Municipal de {structuredData.secretaria}, referente à solicitação de pagamento das despesas constantes da Nota Fiscal n.º <b>{structuredData.num_nota_fiscal}</b>, em favor da empresa nacional <b>{structuredData.credor}</b>, portadora do CNPJ <b>{structuredData.cnpj}</b>.
    </p>

    <div className="section-title">I - RELATÓRIO</div>
    
    <p>
      Veio ao conhecimento desta Controladoria Geral do Município de Barra Do Corda/MA, o Processo de Pagamento referente a Nota Fiscal de n.º <b>{structuredData.num_nota_fiscal}</b>, que tem como credor a empresa <b>{structuredData.credor}</b>, portadora do CNPJ <b>{structuredData.cnpj}</b>, contrato que tem como objeto {structuredData.objeto}, para satisfazer as necessidades da Secretaria de {structuredData.secretaria} do município de Barra do Corda - MA, para análise quanto a legalidade e verificação das demais formalidades, a fim de executar o respectivo pagamento.
    </p>

    <div className="section-title">II - DA ANÁLISE DOS DOCUMENTOS ANEXADOS</div>
    
    <p className="mb-2 no-indent">
      Verifica-se nos autos os documentos que embasaram o presente processo de pagamento, conforme segue:
    </p>
    
    <div className="flex flex-col space-y-0.5 text-[9.5pt] mb-4">
      <div>01. Autorização de Pagamento;</div>
      <div>02. Solicitação de Pagamento;</div>
      <div>03. Cópia do Extrato do Contrato;</div>
      <div>04. Comprovante de Publicação;</div>
      <div>05. Nota de Empenho n.º {structuredData.num_empenho};</div>
      <div>06. Nota de Liquidação n.º {structuredData.num_liquidacao};</div>
      <div>07. Nota Fiscal n.º {structuredData.num_nota_fiscal}, validada e atestada;</div>
      <div>08. Ordem de Fornecimento;</div>
      <div>09. Certidão Conjunta Federal (Tributos/União);</div>
      <div>10. Certidão Negativa Trabalhista;</div>
      <div>11. Certidão Negativa Estadual;</div>
      <div>12. Certidão Negativa de Dívida Ativa Estadual;</div>
      <div>13. Certidão Negativa Municipal;</div>
      <div>14. Certidão Negativa de Dívida Ativa Municipal;</div>
      <div>15. Certidão de Regularidade do FGTS;</div>
      <div>16. Comprovante Sinc;</div>
    </div>
  </>
);

const ReportPage2 = ({ structuredData }: { structuredData: any }) => (
  <>
    <p className="no-indent">
      Após verificação de todos os documentos anexados ao presente processo de pagamento, esta Controladoria Geral do Município de Barra do Corda/MA, conclui:
    </p>

    <div className="section-title">III - CONCLUSÃO</div>
    
    <p>
      Tendo em vista o exposto, levando em consideração a análise da fase de pagamento e considerando os dados extraídos dos autos em apreço, constata-se que os termos apresentados, cumprem parcialmente as exigências contidas legislação vigente, sobretudo a Lei n.º 4.320/64 e Lei n.º 14.133/21.
    </p>
    
    <p>
      Nesse sentido, esta Controladoria emite parecer pela APROVAÇÃO CONDICIONADA do pagamento em apreço, baseada na comprovação da regularidade fiscal e ateste do fiscal de contrato.
    </p>

    <p>
      Ademais é imperioso destacarmos que será necessária a juntada de certidões atualizadas, quando estas na data do pagamento não estiverem vigentes, para que então posterior seja realizado o pagamento da presente despesa.
    </p>

    <p>
      Encaminho os autos ao prosseguimento do feito. Assim devem cumprir as exigências da cláusula de pagamento do contrato e fiscalização.
    </p>

    <p>Salvo o melhor Juízo.</p>
    <p>É o parecer.</p>

    <div className="text-right mt-8 mb-12 no-indent">
      Barra do Corda - MA, {structuredData.dia} de {structuredData.mes} de {structuredData.ano}.
    </div>

    <div className="signature-block no-indent">
      <div className="name uppercase">ANDERSON PEREIRA GOMES</div>
      <div className="text-[10pt] font-bold uppercase">CONTROLADOR GERAL INTERINO DO MUNICÍPIO</div>
      <div className="text-[10pt] font-bold">Portaria Nº203/2025</div>
    </div>
  </>
);

const ReportDocument = ({ structuredData }: { structuredData: any }) => (
  <div className="print-document flex flex-col gap-6 no-print-gap">
    <div className="print-page">
      <ReportPage1 structuredData={structuredData} />
    </div>
    <div className="print-page">
      <ReportPage2 structuredData={structuredData} />
    </div>
  </div>
);

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.CHOICE);
  const [selectedMode, setSelectedMode] = useState<'image' | 'form' | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem('autoPrint') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('autoPrint', autoPrint ? 'true' : 'false');
  }, [autoPrint]);

  useEffect(() => {
    if (currentStep === AppStep.RESULT && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000); // 1s buffer for layout stability before print dialogue
      return () => clearTimeout(timer);
    }
  }, [currentStep, autoPrint]);

  // Initialize data if null to prevent crashes in Setup
  if (!structuredData && currentStep === AppStep.SETUP) {
    const now = new Date();
    setStructuredData({
      num_processo: '',
      num_nota_fiscal: '',
      secretaria: '',
      num_contrato: '',
      num_pregao: '',
      valor: '',
      credor: '',
      cnpj: '',
      objeto: '',
      num_empenho: '',
      num_liquidacao: '',
      dia: now.getDate().toString(),
      mes: now.toLocaleString('pt-BR', { month: 'long' }),
      ano: now.getFullYear().toString()
    });
  }

  const handleExtraction = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Iniciando...');
    setCurrentStep(AppStep.LOADING);
    setError(null);
    try {
      // Step 1: Unified High-Precision OCR (Server-side Gemini or local Tesseract)
      const { text: rawText, structured: serverStructured } = await apiService.extractText(file, (msg) => {
        setLoadingMessage(msg);
      });
      setExtractedText(rawText);

      const now = new Date();

      if (serverStructured) {
        // We received perfect structured values directly from the server-side multimodal Gemini OCR!
        // No client-side regex or second refinement LLM call is required.
        setStructuredData({
          ...serverStructured,
          secretaria: cleanSecretaria(serverStructured.secretaria),
          dia: now.getDate().toString(),
          mes: now.toLocaleString('pt-BR', { month: 'long' }),
          ano: now.getFullYear().toString()
        });
        setCurrentStep(AppStep.SETUP);
        setIsLoading(false);
        return;
      }

      // --- FALLBACK PROCESS (when local Tesseract OCR was utilized) ---
      // Step 2: Improved Regex & Keyword Extraction (Deterministic/Offline)
      setLoadingMessage('Localizando padrões...');
      
      const text = rawText;
      
      // Helper to find text between keywords or after a keyword
      const findAfter = (keywords: string[], maxLength = 100) => {
        for (const kw of keywords) {
          // Escape especial chars and check for optional separators
          const kwPattern = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`${kwPattern}\\s*[:.-]*\\s*(.*)`, 'i');
          const match = text.match(reg);
          if (match && match[1]) {
            return match[1].substring(0, maxLength).trim();
          }
        }
        return '';
      };

      const textNoSpaces = text.replace(/\s+/g, '').toUpperCase();

      const regexData: any = {
        cnpj: text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0] || '',
        // Pega valor após "VALOR LIQUIDADO" ou "VALOR"
        valor: text.match(/(?:VALOR LIQUIDADO|VALOR TOTAL|VALOR)\s*[:.-]*\s*(?:R\$|R\s?\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1] || '',
        // Nota Fiscal no histórico ou campo específico
        num_nota_fiscal: text.match(/(?:Nota fiscal mercadoria|NF-[eE] n[ºo°]|NF n[ºo°]|NF|N[ºo°]|Nota)\s*[:.]*\s*(\d+)/i)?.[1] || 
                         textNoSpaces.match(/NOTAFISCALMERCADORIA(\d+)/)?.[1] || '',
        // Processo no histórico: "Processo Administrativo nº 1305/2025"
        num_processo: text.match(/(?:Processo Administrativo|Processo)\s*(?:n[ºo°]|n|#)?\s*(\d+[.\/]\d+)/i)?.[1] || 
                      text.match(/(?:Processo)\s?[:.]?\s?(\d+[.\/]\d+)/i)?.[0] || '',
        // Empenho no topo: "NOTA DE EMPENHO... 04030006"
        num_empenho: text.match(/(?:NOTA DE EMPENHO|Empenho|NE)\s*[:.]*\s*(\d+)/i)?.[1] || 
                     textNoSpaces.match(/EMPENHO[.\:]*(\d+)/)?.[1] || '',
        // Liquidação no topo: "NOTA DE LIQUIDAÇÃO 06040022" ou flexível para letras espaçadas "N O T A..."
        num_liquidacao: text.match(/(?:NOTA DE LIQUIDAÇÃO|NOTA DE LIQUIDACAO|Liquidação|Liquidacao|NL)\s*[:.]*\s*(\d+)/i)?.[1] || 
                        textNoSpaces.match(/LIQUIDA[CÇ][A-Z~^]*O[.\:]*(\d+)/)?.[1] || '',
        // Contrato no histórico: "Contrato nº 341/2025"
        num_contrato: text.match(/(?:Contrato)\s*(?:n[ºo°]|n|#)?\s*(\d+[.\/]\d+)/i)?.[1] || '',
        // Pregão no histórico: "PE nº 046/2025"
        num_pregao: text.match(/(?:PE|Pregão)\s*(?:n[ºo°]|n|#)?\s*(\d+[.\/]\d+)/i)?.[1] || '',
        
        // Complex fields handled by keywords
        credor: findAfter(['Credor', 'RAZÃO SOCIAL', 'NOME DO CREDOR', 'CONTRATADA', 'EMPRESA'], 60),
        // No histórico geralmente vem após "referente à"
        objeto: findAfter(['referente à', 'OBJETO', 'FINALIDADE', 'DESTINAÇÃO'], 180),
        secretaria: findAfter(['UNIDADE ORÇAMENTÁRIA', 'SECRETARIA', 'ÓRGÃO', 'UNIDADE'], 60)
      };

      // Limpeza de campos comuns
      if (regexData.valor && !regexData.valor.startsWith('R$')) {
        regexData.valor = `R$ ${regexData.valor}`;
      }

      // Especialização para Barra do Corda (Keywords comuns)
      if (!regexData.secretaria || regexData.secretaria.length < 5) {
        if (text.match(/SEMUS|SAÚDE/i)) regexData.secretaria = 'Saúde';
        else if (text.match(/SEMED|EDUCAÇÃO|FUNDEB/i)) regexData.secretaria = 'Educação';
        else if (text.match(/ASSISTÊNCIA SOCIAL|SEMAS/i)) regexData.secretaria = 'Assistência Social';
      }

      // Date pre-fill and clean
      const initialData = {
        ...regexData,
        secretaria: cleanSecretaria(regexData.secretaria),
        objeto: cleanObjeto(regexData.objeto),
        dia: now.getDate().toString(),
        mes: now.toLocaleString('pt-BR', { month: 'long' }),
        ano: now.getFullYear().toString()
      };

      setStructuredData(initialData);

      // Step 3: AI Structuring (The "Regardless of means" solution)
      setLoadingMessage('Refinando dados com IA...');
      
      try {
        // Fallback to the user's provided key if environment variable is not set
        const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyDzua6GSrfPoDNxKiEAFub2I2M5Ae3nyFU';
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Você é um assistente especializado em Controle Interno da Prefeitura de Barra do Corda - MA.
        Sua tarefa é extrair e corrigir ortograficamente os campos abaixo do texto OCR de um documento (Nota de Empenho, Nota de Liquidação, NF, etc).

        Durante a extração, você deve aplicar automaticamente uma camada silenciosa de correção ortográfica e aprimoramento linguístico nos campos estruturados:
        1. Grafia de Secretarias: Você deve extrair o NOME ESPECÍFICO do órgão municipal, IGNORANDO e OMITINDO totalmente prefixos redundantes como "Secretaria de", "Secretaria Municipal de", "SEC DE", "SEC MUNICIPAL DE" e semelhantes. Por exemplo, se for "Secretaria Municipal de Saúde", extraia e preencha APENAS "Saúde". Ajuste para Capitalização Adequada.
        2. Grafia de Credor: Corrija a grafia de nomes próprios, palavras como "LTDA", "S/A", "ME", garantindo que estejam formatadas profissionalmente em maiúsculas se cabível, sem abreviações estranhas geradas pelo OCR.
        3. Objeto do Parecer/Contrato: Corrija a concordância, acentuação, exclua lixo de digitalização ou caracteres avulsos. Complete termos truncados (ex: prestacao -> prestação, aquisicao -> aquisição, manutencao -> manutenção). ATENÇÃO CRÍTICA: Não cite de forma alguma a secretaria atendida ou destinatária no objeto. Ignore, omita ou retire trechos como "para atender as necessidades da Secretaria Municipal de Saúde", "destinado à Secretaria...", "para a secretaria...", etc. Deixe somente a ação/item em si (ex: se for "Aquisição de peças para a Secretaria de Educação", deixe apenas "Aquisição de peças").
        4. Números e Valores: Preserve integralmente quaisquer números reais de CPF, CNPJ, empenho, contratos e processos rasteados. Apenas remova ruídos de pontuação inadequados.
        5. Preservação Factual: Em hipótese alguma altere valores financeiros reais nem invente fatos novos.

        Campos Necessários:
        - num_processo: Geralmente no histórico ou próximo a "Processo Administrativo".
        - num_nota_fiscal: Número da NF ou NF-e.
        - secretaria: O nome específico da secretaria (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). Sem prefixos "Secretaria Municipal de".
        - num_contrato: Número do contrato no histórico.
        - num_pregao: Número do Pregão (PE) no histórico.
        - valor: Valor total/liquidado (Ex: R$ 34.923,00).
        - credor: Razão Social ou Nome do Credor.
        - cnpj: CNPJ do Credor.
        - objeto: Resumo do que está sendo pago/comprado (sem citar qual secretaria está sendo atendida, ex: "Prestação de serviços de limpeza").
        - num_empenho: Número da Nota de Empenho (geralmente no topo).
        - num_liquidacao: Número da Nota de Liquidação (geralmente no topo).

        Texto OCR:
        ${rawText}`;

        const aiResult = await ai.models.generateContent({ 
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                num_processo: { type: Type.STRING },
                num_nota_fiscal: { type: Type.STRING },
                secretaria: { type: Type.STRING },
                num_contrato: { type: Type.STRING },
                num_pregao: { type: Type.STRING },
                valor: { type: Type.STRING },
                credor: { type: Type.STRING },
                cnpj: { type: Type.STRING },
                objeto: { type: Type.STRING },
                num_empenho: { type: Type.STRING },
                num_liquidacao: { type: Type.STRING },
              }
            }
          }
        });

        const aiStructured = JSON.parse(aiResult.text || '{}');
        
        // Update with AI data, keeping date context
        setStructuredData((prev: any) => ({
          ...prev,
          ...aiStructured,
          secretaria: cleanSecretaria(aiStructured.secretaria || prev.secretaria || ''),
          objeto: cleanObjeto(aiStructured.objeto || prev.objeto || ''),
          dia: prev.dia,
          mes: prev.mes,
          ano: prev.ano
        }));
      } catch (aiErr) {
        console.warn('AI structuring failed, using regex results:', aiErr);
      }

      setCurrentStep(AppStep.SETUP);
    } catch (err) {
      console.error('Extraction Error:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao processar dados.';
      setError(msg);
      setCurrentStep(AppStep.SETUP);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!structuredData) return;
    setIsExporting(true);
    try {
      const blob = await apiService.exportToWord(structuredData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Nova lógica de nome: Credor - Nota Fiscal - Valor
      const credorText = (structuredData.credor || 'Final').trim();
      const nfText = (structuredData.num_nota_fiscal || '000').trim();
      const valorText = (structuredData.valor || '0,00').trim();
      
      const fileName = `PARECER ${credorText} - R$ ${valorText} - NF ${nfText}.docx`
        .replace(/[/\\?%*:|"<>]/g, '-'); // Sanitização básica
        
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export erro:', err);
      setError(`Falha ao exportar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!structuredData) return;
    setIsExportingPdf(true);
    setError(null);
    try {
      const element = document.querySelector('.preview-document-container');
      if (!element) {
        throw new Error('Elemento de visualização do parecer não encontrado.');
      }

      // Clone original element so web styles like boxShadow, scroll heights don't interfere
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.border = 'none';
      clone.style.margin = '0';
      
      // Remove gaps and shadow constraints on clone for a seamless 1:1 scale export
      const printDoc = clone.querySelector('.print-document') as HTMLElement;
      if (printDoc) {
        printDoc.style.gap = '0';
        printDoc.style.display = 'block';
      }
      
      const pages = clone.querySelectorAll('.print-page');
      pages.forEach((page) => {
        (page as HTMLElement).style.boxShadow = 'none';
        (page as HTMLElement).style.margin = '0';
      });
      
      const credorText = (structuredData.credor || 'Final').trim();
      const nfText = (structuredData.num_nota_fiscal || '000').trim();
      const valorText = (structuredData.valor || '0,00').trim();
      
      const fileName = `PARECER ${credorText} - R$ ${valorText} - NF ${nfText}.pdf`
        .replace(/[/\\?%*:|"<>]/g, '-');

      const opt = {
        margin:       0,
        filename:     fileName,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false
        },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak:    { mode: 'css' }
      };

      // Append clone to body off-screen to guarantee correct styling and font resolution
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.appendChild(clone);
      document.body.appendChild(container);

      // Run html2pdf and download
      await html2pdf().set(opt).from(clone).save();
      
      // Clean up DOM
      document.body.removeChild(container);
    } catch (err) {
      console.error('Pdf export error:', err);
      setError(`Falha ao exportar PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const goToResult = () => {
    setCurrentStep(AppStep.RESULT);
    handleExport(); // Iniciar download automático ao gerar
  };

  const goBackToSetup = () => {
    setCurrentStep(AppStep.SETUP);
  };

  const startWithMode = (mode: 'image' | 'form') => {
    setSelectedMode(mode);
    setCurrentStep(AppStep.SETUP);
  };

  return (
    <>
      <div className="no-print flex flex-col h-screen overflow-hidden bg-[#f1f5f9] text-[#0f172a] font-sans">
      <div className="no-print flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between z-10 shadow-sm relative">
          <div className="w-1/3 flex justify-start">
            {/* Left slot empty to allow true centering */}
          </div>
          
          <div className="absolute inset-x-0 mx-auto flex justify-center pointer-events-none">
            <h1 className="text-xl font-extrabold tracking-widest text-slate-800 select-none pointer-events-auto">
              APARECEDOR
            </h1>
          </div>
          
          <div className="w-1/3 flex justify-end items-center gap-5">
            {currentStep !== AppStep.CHOICE && (
              <>
                <div className="flex gap-1">
                  {[AppStep.SETUP, AppStep.LOADING, AppStep.RESULT].map((step, i) => (
                    <div 
                      key={step}
                      className={`w-10 h-1 rounded-full transition-colors ${
                        (currentStep === step || (currentStep === AppStep.RESULT && i < 2)) ? 'bg-[#2563eb]' : 'bg-[#e2e8f0]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">{currentStep}</span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {currentStep === AppStep.CHOICE && (
              <motion.div
                key="choice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  <button 
                    onClick={() => startWithMode('image')}
                    className="group bg-white p-10 rounded-[32px] border-2 border-transparent hover:border-[#2563eb] transition-all shadow-xl hover:shadow-2xl flex flex-col items-center text-center gap-6 active:scale-[0.98]"
                  >
                    <div className="w-24 h-24 bg-[#eff6ff] rounded-3xl flex items-center justify-center text-5xl group-hover:scale-110 transition-transform duration-500">
                      📸
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#1e293b]">Usar Imagem (OCR)</h3>
                    </div>
                    <div className="mt-4 px-8 py-3 bg-[#2563eb] text-white rounded-2xl font-bold group-hover:bg-[#1d4ed8] transition-colors">
                      Selecionar Imagem
                    </div>
                  </button>

                  <button 
                    onClick={() => startWithMode('form')}
                    className="group bg-white p-10 rounded-[32px] border-2 border-transparent hover:border-[#2563eb] transition-all shadow-xl hover:shadow-2xl flex flex-col items-center text-center gap-6 active:scale-[0.98]"
                  >
                    <div className="w-24 h-24 bg-[#f8fafc] rounded-3xl flex items-center justify-center text-5xl group-hover:scale-110 transition-transform duration-500">
                      ⌨️
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#1e293b]">Usar Formulário</h3>
                    </div>
                    <div className="mt-4 px-8 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold group-hover:bg-slate-200 transition-colors">
                      Preencher Formulário
                    </div>
                  </button>
                </div>

                <div className="mt-16 text-[#94a3b8] flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-xs font-bold uppercase tracking-widest">Sistema de Controle Interno Ativo</span>
                </div>
              </motion.div>
            )}

            {currentStep === AppStep.SETUP && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={
                  selectedMode === 'image'
                    ? extractedText
                      ? "h-full grid grid-cols-1 md:grid-cols-[400px_1fr] gap-6 p-6 overflow-hidden mx-auto w-full"
                      : "h-full flex flex-col justify-center items-center max-w-[550px] p-6 overflow-y-auto mx-auto w-full gap-6"
                    : "h-full grid grid-cols-1 max-w-[900px] gap-6 p-6 overflow-hidden mx-auto w-full"
                }
              >
                {/* Left: Upload (Only if image mode selected) */}
                {selectedMode === 'image' && (
                  <div className={`flex flex-col gap-6 overflow-auto ${!extractedText ? 'w-full' : ''}`}>
                    <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                          1. Capturar Imagem
                        </h2>
                        <button 
                          onClick={() => {
                            setExtractedText('');
                            setCurrentStep(AppStep.CHOICE);
                          }}
                          className="text-[10px] font-bold text-[#2563eb] hover:underline uppercase"
                        >
                          Alterar Modo
                        </button>
                      </div>
                      <FileUpload onFileSelect={handleExtraction} isLoading={isLoading} />
                      <p className="text-[10px] text-[#94a3b8] mt-4 leading-relaxed italic text-center">
                        * O upload da imagem preenche automaticamente o parecer usando Inteligência Artificial.
                      </p>
                    </div>

                    <ScannerFolderConfig onFileSelect={handleExtraction} isLoading={isLoading} />

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-xs font-semibold">{error}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Right: Form (Only shown if selectedMode is 'form' OR if selectedMode is 'image' and we have extracted text) */}
                {(selectedMode === 'form' || (selectedMode === 'image' && extractedText)) && (
                  <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-8 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-[#1e293b]">Dados do Parecer</h2>
                        {selectedMode === 'form' && (
                          <button 
                            onClick={() => {
                              setExtractedText('');
                              setCurrentStep(AppStep.CHOICE);
                            }}
                            className="text-[10px] font-bold text-[#2563eb] hover:underline uppercase text-left"
                          >
                            ← Voltar para seleção
                          </button>
                        )}
                        {selectedMode === 'image' && extractedText && (
                          <button 
                            onClick={() => {
                              setExtractedText('');
                              setStructuredData(null);
                            }}
                            className="text-[10px] font-bold text-red-600 hover:underline uppercase text-left"
                          >
                            ← Limpar e Escanear Outro
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={goToResult}
                        className="bg-[#2563eb] text-[#ffffff] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
                      >
                        Gerar Parecer →
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                      <Editor 
                        content={extractedText} 
                        structured={structuredData}
                        onStructuredChange={setStructuredData} 
                        onExport={() => {}} // Not used here
                        isExporting={false}
                        compactView={true}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === AppStep.LOADING && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center p-10 text-center"
              >
                <div className="relative w-24 h-24 mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-0 border-4 border-blue-100 border-t-blue-600 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">
                    📄
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-[#1e293b] mb-2">Processando Documento</h2>
                <p className="text-[#2563eb] font-bold text-sm mb-2 uppercase tracking-tight">
                  {loadingMessage}
                </p>
                <p className="text-[#64748b] max-w-[300px] leading-relaxed">
                  Lendo o conteúdo do documento para a sua tela de preenchimento...
                </p>
                <div className="mt-8 flex gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </motion.div>
            )}

            {currentStep === AppStep.RESULT && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 p-6 overflow-hidden max-w-[1400px] mx-auto w-full"
              >
                {/* Left: Document Preview */}
                <div className="bg-white rounded-[24px] border border-[#e2e8f0] shadow-2xl overflow-hidden flex flex-col">
                  <div className="h-14 bg-[#f8fafc] border-b border-[#e2e8f0] px-6 flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest flex items-center gap-2">
                      <Layout className="w-3.5 h-3.5" /> Pré-visualização do Documento
                    </span>
                    <button 
                      onClick={goBackToSetup}
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 uppercase"
                    >
                      ← Voltar para Edição
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-200/50 p-8 pt-12 custom-scrollbar">
                    <div className="mx-auto transition-transform duration-500">
                      <div className="preview-document-container">
                        {structuredData && <ReportDocument structuredData={structuredData} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-6">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-xs font-semibold">{error}</p>
                    </motion.div>
                  )}

                  <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-8 shadow-lg">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#64748b] mb-6">
                      Finalizar Documento
                    </h2>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="group w-full h-[80px] rounded-2xl bg-[#2563eb] text-white flex items-center px-6 gap-5 hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100 disabled:opacity-50 cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          💾
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">{isExporting ? 'Gerando Word...' : 'Baixar Parecer (.docx)'}</div>
                          <div className="text-[12px] opacity-70">Download automático iniciado</div>
                        </div>
                      </button>

                      <button
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                        className="group w-full h-[80px] rounded-2xl bg-[#ef4444] text-white flex items-center px-6 gap-5 hover:bg-red-600 transition-all active:scale-95 shadow-xl shadow-red-100 disabled:opacity-50 cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          📕
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">{isExportingPdf ? 'Gerando PDF...' : 'Baixar Parecer (PDF)'}</div>
                          <div className="text-[12px] opacity-70">Fiel à formatação oficial (DOCX)</div>
                        </div>
                      </button>

                      <button
                        onClick={() => window.print()}
                        className="group w-full h-[80px] rounded-2xl bg-emerald-600 text-white flex items-center px-6 gap-5 hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-100 cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          🖨️
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">Imprimir Parecer</div>
                          <div className="text-[12px] opacity-70">Nativo e em alta definição</div>
                        </div>
                      </button>
                    </div>

                    {/* Impressão Inteligente e Automática */}
                    <div className="mt-6 pt-6 border-t border-[#f1f5f9] text-left">
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider mb-0.5">
                            <Sparkles className="w-4.5 h-4.5 text-emerald-500 animate-pulse" /> Auto-Impressão
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Se ativado, abrirá a tela do sistema para impressão física assim que gerar o parecer.
                          </p>
                        </div>
                        <button
                          onClick={() => setAutoPrint(!autoPrint)}
                          role="switch"
                          aria-checked={autoPrint}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoPrint ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              autoPrint ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Collapse explicativo de Impressão Física Silenciosa (Zero Cliques) */}
                      <div className="mt-4 bg-blue-50/60 border border-blue-100/40 rounded-2xl p-4">
                        <div className="flex gap-2.5">
                          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-blue-900 mb-1">Como ter Impressão Silenciosa (Zero Cliques)?</h4>
                            <p className="text-[10px] text-blue-800 leading-relaxed">
                              Por limitações de segurança dos navegadores, a impressão direta requer confirmação preliminar. Porém, você pode ignorar essa etapa e fazer seu computador imprimir <strong>instantaneamente de forma física</strong>:
                            </p>
                            <ol className="list-decimal list-inside text-[9.5px] text-blue-800 mt-2 space-y-1 ml-1">
                              <li>Feche o navegador completamente;</li>
                              <li>Clique com o botão direito no atalho do seu Chrome (ou Edge) e vá em <strong>Propriedades</strong>;</li>
                              <li>No campo <strong>Destino</strong>, adicione <code className="bg-white/75 px-1 py-0.5 rounded text-red-700 font-mono text-[9px]">--kiosk-printing</code> no final do texto (ex: <code className="bg-white/75 px-1 py-0.5 rounded text-slate-600 font-mono text-[8px]">...chrome.exe" --kiosk-printing</code>);</li>
                              <li>Abra o navegador por esse atalho. Pronto! Ao clicar em gerar, o computador imprimirá fisicamente sem abrir nenhuma tela!</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-[#f1f5f9]">
                       <h3 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest mb-4">Outras Opções</h3>
                       <div className="grid grid-cols-2 gap-3">
                         <button 
                           onClick={goBackToSetup}
                           className="h-12 rounded-xl bg-slate-50 border border-border-base text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase cursor-pointer"
                         >
                           Editar Dados
                         </button>
                         <button 
                           onClick={() => window.location.reload()}
                           className="h-12 rounded-xl bg-slate-50 border border-border-base text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase cursor-pointer"
                         >
                           Novo Parecer
                         </button>
                       </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                       <Layout className="w-20 h-20" />
                    </div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Informação do Sistema</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      O documento gerado segue as normas vigentes do Controle Interno Municipal, com papel timbrado oficial embutido.
                    </p>
                    <div className="bg-slate-800 rounded-lg p-3 text-[10px] font-mono text-slate-500">
                      ID: {structuredData?.num_processo || 'N/A'}-PRC
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      </div>

      {/* Print View Wrapper (hidden in normal UI) */}
      <div className="print-only">
        {structuredData && <ReportDocument structuredData={structuredData} />}
      </div>
    </>
  );
}
