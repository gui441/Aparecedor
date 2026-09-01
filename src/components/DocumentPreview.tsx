import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Printer, 
  FileDown, 
  FileText,
  Check,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DocumentPreviewProps {
  structuredData: any;
  onPrint: () => void;
  onDownloadPDF: () => void;
  onDownloadDOCX: () => void;
  isExportingPDF?: boolean;
  isExportingDOCX?: boolean;
}

export const OfficialDocumentContent: React.FC<{ structuredData: any; id?: string }> = ({ structuredData, id }) => {
  if (!structuredData) return null;

  const data = structuredData;
  const now = new Date();
  const dia = data.dia || now.getDate().toString();
  const mes = data.mes || now.toLocaleString('pt-BR', { month: 'long' });
  const ano = data.ano || now.getFullYear().toString();

  const secFormatted = data.secretaria 
    ? (data.secretaria.toLowerCase().startsWith('secretaria') ? data.secretaria : `Municipal de ${data.secretaria}`)
    : '';

  const valorFormatado = data.valor?.toString().startsWith('R$') ? data.valor : `R$ ${data.valor || '0,00'}`;
  const extenso = data.valor_extenso ? ` (${data.valor_extenso})` : '';

  // Instrumentos complementares
  const aditivos: string[] = [];
  if (data.num_aditivo) aditivos.push(`Termo Aditivo n.º ${data.num_aditivo}`);
  if (data.num_apostilamento) aditivos.push(`Termo de Apostilamento n.º ${data.num_apostilamento}`);
  if (data.num_registro_preco) aditivos.push(`Ata de Registro de Preços n.º ${data.num_registro_preco}`);

  return (
    <div 
      id={id}
      className="official-a4-page relative box-border mx-auto select-text"
      style={{
        width: '210mm',
        height: '297mm',
        maxHeight: '297mm',
        backgroundColor: '#ffffff',
        backgroundImage: "url('/timbrado.png')",
        backgroundSize: '210mm 297mm',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
        padding: '4.5cm 2.54cm 3.5cm 2.54cm',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '9.5pt',
        lineHeight: '1.48',
        color: '#000000',
        textAlign: 'justify',
        overflow: 'hidden',
      }}
    >
      {/* Título */}
      <div 
        className="text-center font-bold uppercase tracking-wider mb-3 text-[10.5pt]"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        DESPACHO
      </div>

      {/* Cabeçalho do Despacho */}
      <div className="space-y-[2px] font-bold text-[9.5pt] mb-3">
        <div>Credor: {data.credor || ''}</div>
        <div>CNPJ: {data.cnpj || ''}</div>
        <div>Assunto: Análise do Processo Administrativo n.º {data.num_processo || ''}</div>
        <div>
          Objeto: Pagamento da Nota Fiscal n.º {data.num_nota_fiscal || ''}, da Secretaria {secFormatted} desta Municipalidade.
        </div>
        <div>
          Contrato n.º {data.num_contrato || ''}
          {data.num_adesao ? ` – Adesão n.º ${data.num_adesao}` : ''}
          {data.num_pregao 
            ? ` – ${data.tipo_pregao || 'Pregão Eletrônico'} n.º ${data.num_pregao}` 
            : (!data.num_adesao ? ` – ${data.tipo_pregao || 'Dispensa'} n.º ${data.num_pregao || ''}` : '')
          }
        </div>
        {aditivos.length > 0 && (
          <div>{aditivos.join(' – ')}</div>
        )}
        <div>
          Valor: {valorFormatado}{extenso}
        </div>
      </div>

      {/* Seção I */}
      <div className="font-bold text-[9.5pt] my-2 uppercase">
        I - DA ANÁLISE DOS DOCUMENTOS ANEXADOS
      </div>

      <p className="text-justify mb-2 text-[9.5pt]" style={{ textIndent: '1.15cm' }}>
        Verifica-se nos autos os documentos que embasaram o presente processo de pagamento, conforme segue:
      </p>

      {/* Grade de 13 Documentos */}
      <div className="grid grid-cols-2 gap-x-4 text-[9pt] leading-[1.3] mb-2 pl-0.5">
        <div className="space-y-[1.5px]">
          <div>01. Autorização de Pagamento;</div>
          <div>02. Solicitação de Pagamento;</div>
          <div>03. Cópia do Extrato do Contrato;</div>
          <div>04. Nota de Empenho n.º <b>{data.num_empenho || ''}</b>;</div>
          <div>05. Nota de Liquidação n.º <b>{data.num_liquidacao || ''}</b>;</div>
          <div>06. Nota Fiscal n.º <b>{data.num_nota_fiscal || ''}</b>, validada e atestada;</div>
          <div>07. Ordem de Fornecimento;</div>
          <div>08. Certidão Positiva com Efeitos de Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União;</div>
        </div>
        <div className="space-y-[1.5px]">
          <div>09. Certidão Estadual Negativa de Débitos e da Dívida Ativa;</div>
          <div>10. Certidão Municipal Negativa de Débitos e da Dívida Ativa;</div>
          <div>11. Certidão de Regularidade do FGTS;</div>
          <div>12. Certidão Negativa de Débitos Trabalhistas;</div>
          <div>13. Comprovante Sinc;</div>
        </div>
      </div>

      <p className="text-justify mb-2 text-[9.5pt]" style={{ textIndent: '1.15cm' }}>
        Após verificação de todos os documentos anexados ao presente processo de pagamento, conclui:
      </p>

      {/* Seção II */}
      <div className="font-bold text-[9.5pt] my-2 uppercase">
        II– CONCLUSÃO
      </div>

      <div className="space-y-1.5 text-[9.5pt]">
        <p className="text-justify" style={{ textIndent: '1.15cm' }}>
          Tendo em vista o exposto, levando em consideração a análise da fase de pagamento e considerando os dados extraídos dos autos em apreço, constata-se que os termos apresentados, cumprem parcialmente as exigências contidas legislação vigente, sobretudo a Lei n.º 4.320/64 e Lei n.º {data.lei_regencia || '14.133/21'}.
        </p>

        <p className="text-justify" style={{ textIndent: '1.15cm' }}>
          Ademais é imperioso destacarmos que será necessária a juntada de certidões atualizadas, quando estas na data do pagamento não estiverem vigentes, para que então posterior seja realizado o pagamento da presente despesa.
        </p>

        <p className="text-justify" style={{ textIndent: '1.15cm' }}>
          Encaminho os autos ao prosseguimento do feito. Assim devem cumprir as exigências da cláusula de pagamento do contrato e fiscalização.
        </p>

        <div className="mt-2.5">
          <div>Salvo o melhor Juízo.</div>
          <div className="font-bold">É o despacho.</div>
        </div>

        <div className="text-right mt-3">
          Barra do Corda - MA, {dia} de {mes} de {ano}.
        </div>
      </div>
    </div>
  );
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  structuredData,
  onPrint,
  onDownloadPDF,
  onDownloadDOCX,
  isExportingPDF,
  isExportingDOCX,
}) => {
  const [scale, setScale] = useState<number>(0.65);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleZoomIn = () => setScale((prev) => Math.min(1.2, prev + 0.1));
  const handleZoomOut = () => setScale((prev) => Math.max(0.4, prev - 0.1));
  const handleResetZoom = () => setScale(0.65);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 rounded-[24px] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            Cópia Fiel do Documento A4 (Pronto para Impressão)
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={handleZoomOut}
            title="Reduzir Zoom"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Tamanho Padrão"
            className="px-2 py-1 text-[11px] font-mono font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            title="Aumentar Zoom"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button
            onClick={() => setShowFullscreen(true)}
            title="Visualização em Tela Cheia"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center custom-scrollbar bg-slate-950/40">
        <div 
          className="transition-transform duration-150 origin-top shadow-2xl rounded-sm"
          style={{ transform: `scale(${scale})` }}
        >
          <OfficialDocumentContent structuredData={structuredData} id="preview-despacho-element" />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          onClick={onPrint}
          className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Imprimir / Salvar PDF</span>
        </button>

        <button
          onClick={onDownloadPDF}
          disabled={isExportingPDF}
          className="h-11 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          <span>{isExportingPDF ? 'Gerando PDF...' : 'Baixar PDF (.pdf)'}</span>
        </button>

        <button
          onClick={onDownloadDOCX}
          disabled={isExportingDOCX}
          className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>{isExportingDOCX ? 'Gerando Word...' : 'Baixar Word (.docx)'}</span>
        </button>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {showFullscreen && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                  Visualização Completa do Despacho A4
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onPrint}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={onDownloadPDF}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => setShowFullscreen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8 flex items-start justify-center custom-scrollbar">
              <div className="shadow-2xl rounded-sm">
                <OfficialDocumentContent structuredData={structuredData} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
