import React from 'react';
import { FileDown, Edit3, Clipboard, Check, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface EditorProps {
  content: string;
  structured: any;
  onStructuredChange: (newStructured: any) => void;
  onExport: () => void;
  isExporting: boolean;
  compactView?: boolean;
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
  isTextArea?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, fullWidth = false, isTextArea = false }) => (
  <div className={`${fullWidth ? 'col-span-2' : ''} space-y-1.5`}>
    <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block ml-1">{label}</label>
    {isTextArea ? (
      <textarea 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full p-3 border border-[#e2e8f0] rounded-xl text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-blue-50 outline-none h-24 resize-none transition-all placeholder:text-slate-300"
        placeholder="..."
      />
    ) : (
      <input 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full p-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-300"
        placeholder="..."
      />
    )}
  </div>
);

export const Editor: React.FC<EditorProps> = ({ 
  content, 
  structured, 
  onStructuredChange, 
  onExport, 
  isExporting,
  compactView = false
}) => {
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'form' | 'text' | 'json'>('form');

  const updateField = (field: string, value: string) => {
    onStructuredChange({ ...structured, [field]: value });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex-1 flex flex-col min-h-0 ${compactView ? '' : 'gap-5'}`}
    >
      {!compactView && (
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#64748b] flex items-center gap-2">
            Editor de Parecer
          </h2>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-100 p-1 rounded-lg scale-90">
          <button
            onClick={() => setViewMode('form')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
              viewMode === 'form' ? 'bg-white shadow text-[#2563eb]' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            FORMULÁRIO
          </button>
          {content && (
            <button
              onClick={() => setViewMode('text')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                viewMode === 'text' ? 'bg-white shadow text-[#2563eb]' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              TEXTO EXTRAÍDO
            </button>
          )}
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
              viewMode === 'json' ? 'bg-white shadow text-[#2563eb]' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            DADOS (JSON)
          </button>
        </div>
        {viewMode === 'text' && content && (
          <button
            onClick={copyToClipboard}
            className="text-[10px] font-bold text-[#2563eb] hover:underline flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
            {copied ? 'COPIADO' : 'COPIAR TUDO'}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {viewMode === 'form' ? (
          <div className={`w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 ${compactView ? '' : 'p-6 border border-border-base rounded-lg bg-white shadow-inner overflow-auto'}`}>
            <InputField label="Nº do Processo" value={structured?.num_processo || ''} onChange={(val) => updateField('num_processo', val)} fullWidth />
            <InputField label="Nº da Nota Fiscal" value={structured?.num_nota_fiscal || ''} onChange={(val) => updateField('num_nota_fiscal', val)} />
            <InputField label="Secretaria" value={structured?.secretaria || ''} onChange={(val) => updateField('secretaria', val)} />
            <InputField label="Contrato n.º" value={structured?.num_contrato || ''} onChange={(val) => updateField('num_contrato', val)} />
            <InputField label="Pregão Eletrônico" value={structured?.num_pregao || ''} onChange={(val) => updateField('num_pregao', val)} />
            <InputField label="Valor (R$)" value={structured?.valor || ''} onChange={(val) => updateField('valor', val)} />
            <InputField label="Credor" value={structured?.credor || ''} onChange={(val) => updateField('credor', val)} />
            <InputField label="CNPJ" value={structured?.cnpj || ''} onChange={(val) => updateField('cnpj', val)} />
            <InputField label="Objeto do Contrato" value={structured?.objeto || ''} onChange={(val) => updateField('objeto', val)} fullWidth isTextArea />
            <InputField label="Nota de Empenho" value={structured?.num_empenho || ''} onChange={(val) => updateField('num_empenho', val)} />
            <InputField label="Nota de Liquidação" value={structured?.num_liquidacao || ''} onChange={(val) => updateField('num_liquidacao', val)} />
            
            <div className="col-span-2 border-t border-slate-100 pt-6 mt-2 grid grid-cols-3 gap-4">
              <InputField label="Dia" value={structured?.dia || ''} onChange={(val) => updateField('dia', val)} />
              <InputField label="Mês" value={structured?.mes || ''} onChange={(val) => updateField('mes', val)} />
              <InputField label="Ano" value={structured?.ano || ''} onChange={(val) => updateField('ano', val)} />
            </div>
          </div>
        ) : viewMode === 'text' ? (
          <textarea
            value={content}
            readOnly
            spellCheck="false"
            placeholder="O texto extraído aparecerá aqui..."
            className="w-full h-full p-4 border border-border-base rounded-lg font-mono text-sm leading-relaxed resize-none bg-[#fafafa] focus:outline-none transition-all text-[#334155]"
          />
        ) : (
          <div className="w-full h-full bg-[#1e293b] rounded-lg p-4 font-mono text-xs overflow-auto shadow-inner text-[#94a3b8] leading-relaxed">
            <pre>{JSON.stringify(structured, null, 2)}</pre>
          </div>
        )}
      </div>

      {!compactView && (
        <div className="action-bar flex items-center gap-3 pt-5 border-t border-border-base shrink-0">
          <button
            onClick={onExport}
            disabled={isExporting}
            className="btn h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold flex flex-col items-center justify-center gap-0 hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span>💾</span>
              <span>{isExporting ? 'Exportando...' : 'Exportar Word'}</span>
            </div>
            <span className="text-[9px] opacity-80 -mt-0.5 font-normal">Usando Template (.docx)</span>
          </button>
          
          <button
            onClick={copyToClipboard}
            className="btn h-10 px-5 rounded-lg bg-bg-base border border-border-base text-text-base text-sm font-semibold flex items-center gap-2 hover:bg-slate-200 active:scale-95 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copiar {viewMode === 'text' ? 'Texto' : 'JSON'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              window.focus();
              window.print();
            }}
            className="btn h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="btn h-10 px-5 rounded-lg bg-bg-base border border-border-base text-text-base text-sm font-semibold flex items-center gap-2 hover:bg-slate-200 active:scale-95 transition-all ml-auto"
          >
            <span>🔄</span>
            <span>Novo</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
