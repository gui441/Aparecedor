import React from 'react';
import { FileDown, Edit3, Clipboard, Check, AlertCircle, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { valorPorExtenso, formatarReal, formatarCNPJ, validarCNPJ } from '../utils/currency';

export const PROCUREMENT_MODALITIES = [
  'Pregão Eletrônico',
  'Inexigibilidade',
  'Pregão Presencial',
  'Concorrência Pública',
  'Dispensa',
  'Concorrência Eletrônica',
  'Credenciamento',
  'Chamamento Público'
];

export const SECRETARIES = [
  'Saúde',
  'Educação',
  'Assistência Social',
  'Planejamento, Orçamento e Gestão',
  'Infraestrutura',
  'Cultura',
  'Esportes',
  'Juventude e Tecnologia',
  'da Mulher',
  'Indústria, Comércio e Turismo',
  'Gabinete do Prefeito',
  'Meio Ambiente e Urbanismo',
  'Agricultura, Aquicultura e Pesca'
];

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
  onBlur?: () => void;
  fullWidth?: boolean;
  isTextArea?: boolean;
  helperText?: string;
  status?: 'success' | 'warning' | 'error' | null;
}

const InputField: React.FC<InputFieldProps> = ({ 
  label, 
  value, 
  onChange, 
  onBlur,
  fullWidth = false, 
  isTextArea = false,
  helperText,
  status = null
}) => (
  <div className={`${fullWidth ? 'col-span-2' : ''} space-y-1`}>
    <div className="flex justify-between items-center ml-1">
      <label className="text-[10.5px] font-extrabold text-[#64748b] uppercase tracking-wider block">{label}</label>
      {status === 'success' && <span className="text-[9.5px] text-emerald-600 font-bold flex items-center gap-0.5">✓ VÁLIDO</span>}
      {status === 'warning' && <span className="text-[9.5px] text-amber-600 font-semibold flex items-center gap-0.5">⚠ VERIFICAR</span>}
      {status === 'error' && <span className="text-[9.5px] text-rose-600 font-extrabold flex items-center gap-0.5">✗ IRREGULAR</span>}
    </div>
    {isTextArea ? (
      <textarea 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        onBlur={onBlur}
        className="w-full p-3 border border-[#e2e8f0] rounded-xl text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-blue-50 outline-none h-24 resize-none transition-all placeholder:text-slate-300"
        placeholder="..."
      />
    ) : (
      <input 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        onBlur={onBlur}
        className={`w-full p-2.5 border rounded-xl text-sm focus:ring-2 outline-none transition-all placeholder:text-slate-300 ${
          status === 'error' ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-50' : 
          status === 'success' ? 'border-emerald-300 bg-emerald-50/10 focus:border-emerald-500 focus:ring-emerald-50' :
          'border-[#e2e8f0] focus:border-[#2563eb] focus:ring-blue-50'
        }`}
        placeholder="..."
      />
    )}
    {helperText && (
      <p className={`text-[10px] leading-tight ml-1.5 italic ${status === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
        {helperText}
      </p>
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
    let newStructured = { ...structured, [field]: value };
    
    // Auto-compute extenso when valor changes
    if (field === 'valor') {
      newStructured.valor_extenso = valorPorExtenso(value);
    }
    
    // Auto-format CNPJ on typing (simple numeric limits to avoid cursor jumping)
    if (field === 'cnpj') {
      newStructured.cnpj = formatarCNPJ(value);
    }
    
    onStructuredChange(newStructured);
  };

  const forceFormatValor = () => {
    if (structured?.valor) {
      const formatted = formatarReal(structured.valor);
      onStructuredChange({
        ...structured,
        valor: formatted,
        valor_extenso: valorPorExtenso(formatted)
      });
    }
  };

  const forceFormatCredor = () => {
    if (structured?.credor) {
      const formatted = structured.credor
        .toUpperCase()
        .trim();
      onStructuredChange({
        ...structured,
        credor: formatted
      });
    }
  };

  const forceFormatObjeto = () => {
    if (structured?.objeto) {
      let formatted = structured.objeto.trim();
      if (formatted.length > 0) {
        formatted = formatted.charAt(0).toLowerCase() + formatted.slice(1);
      }
      onStructuredChange({
        ...structured,
        objeto: formatted
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // CNPJ status
  const getCnpjStatus = (): 'success' | 'warning' | 'error' | null => {
    if (!structured?.cnpj) return null;
    return validarCNPJ(structured.cnpj) ? 'success' : 'error';
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
            Editor de Despacho
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
            
            {/* Group 1: Nº do Contrato, Nº do Processo, Tipo de Contratação e Número */}
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <InputField label="Contrato" value={structured?.num_contrato || ''} onChange={(val) => updateField('num_contrato', val)} />
              <InputField label="Processo" value={structured?.num_processo || ''} onChange={(val) => updateField('num_processo', val)} />
              
              <div className="space-y-1">
                <label className="text-[10.5px] font-extrabold text-[#64748b] uppercase tracking-wider block">Tipo de Contratação</label>
                <select
                  value={PROCUREMENT_MODALITIES.includes(structured?.tipo_pregao || 'Pregão Eletrônico') ? (structured?.tipo_pregao || 'Pregão Eletrônico') : 'Outro'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Outro') {
                      updateField('tipo_pregao', 'Outro Procedimento');
                    } else {
                      updateField('tipo_pregao', val);
                    }
                  }}
                  className="w-full h-11 px-3 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-blue-50 outline-none transition-all cursor-pointer font-sans"
                >
                  {PROCUREMENT_MODALITIES.map((mod) => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                  <option value="Outro">Outro (Especificar...)</option>
                </select>
              </div>

              <InputField 
                label={`N.º do/da ${structured?.tipo_pregao || 'Pregão Eletrônico'}`} 
                value={structured?.num_pregao || ''} 
                onChange={(val) => updateField('num_pregao', val)} 
              />
            </div>

            {/* Custom Procurement Type Field if "Outro" is specified */}
            {!PROCUREMENT_MODALITIES.includes(structured?.tipo_pregao || 'Pregão Eletrônico') && (
              <div className="col-span-2 md:col-start-3 md:col-span-2">
                <InputField 
                  label="Especifique o Tipo/Modalidade de Contratação" 
                  value={structured?.tipo_pregao || ''} 
                  onChange={(val) => updateField('tipo_pregao', val)} 
                  fullWidth
                />
              </div>
            )}

            {/* Optional fields: Termo Aditivo, Termo de Apostilamento, Adesão, Registro de Preço */}
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
              <InputField label="Termo Aditivo" value={structured?.num_aditivo || ''} onChange={(val) => updateField('num_aditivo', val)} />
              <InputField label="Termo de Apostilamento" value={structured?.num_apostilamento || ''} onChange={(val) => updateField('num_apostilamento', val)} />
              <InputField label="Adesão" value={structured?.num_adesao || ''} onChange={(val) => updateField('num_adesao', val)} />
              <InputField label="Registro de Preço" value={structured?.num_registro_preco || ''} onChange={(val) => updateField('num_registro_preco', val)} />
            </div>

            {/* Legislation Selector Toggles */}
            <div className="col-span-2 bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-0.5">
                  Lei de Regência (Parecer de Licitações)
                </label>
                <p className="text-[10px] text-slate-500 italic">
                  Defina a lei de licitações aplicável a este parecer de despesa.
                </p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 select-none shrink-0 border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => {
                    onStructuredChange({
                      ...structured,
                      lei_regencia: '14.133/21',
                      is_lei_8666: false
                    });
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                    (structured?.lei_regencia || '14.133/21') === '14.133/21'
                      ? 'bg-white shadow text-[#2563eb] border border-slate-200/50'
                      : 'text-slate-500 hover:text-[#0f172a]'
                  }`}
                >
                  Lei n.º 14.133/21
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStructuredChange({
                      ...structured,
                      lei_regencia: '8.666/93',
                      is_lei_8666: true
                    });
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                    structured?.lei_regencia === '8.666/93'
                      ? 'bg-white shadow text-[#2563eb] border border-slate-200/50'
                      : 'text-slate-500 hover:text-[#0f172a]'
                  }`}
                >
                  Lei n.º 8.666/93
                </button>
              </div>
            </div>
            
            {/* Dropdown for Secretaria */}
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-[10.5px] font-extrabold text-[#64748b] uppercase tracking-wider block">Secretaria</label>
                <select
                  value={SECRETARIES.includes(structured?.secretaria || '') ? (structured?.secretaria || '') : (structured?.secretaria ? 'Outro' : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Outro') {
                      if (SECRETARIES.includes(structured?.secretaria || '')) {
                        updateField('secretaria', '');
                      }
                    } else {
                      updateField('secretaria', val);
                    }
                  }}
                  className="w-full h-11 px-3 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-blue-50 outline-none transition-all cursor-pointer font-sans"
                >
                  <option value="" disabled>Selecione uma Secretaria...</option>
                  {SECRETARIES.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                  <option value="Outro">Outro (Especificar...)</option>
                </select>
              </div>

              {(!SECRETARIES.includes(structured?.secretaria || '') || !structured?.secretaria) && (
                <InputField 
                  label="Especifique a Secretaria" 
                  value={structured?.secretaria || ''} 
                  onChange={(val) => updateField('secretaria', val)} 
                />
              )}
            </div>
            
            {/* Group 2: Valor e NF */}
            <InputField 
              label="Valor (R$)" 
              value={structured?.valor || ''} 
              onChange={(val) => updateField('valor', val)} 
              onBlur={forceFormatValor}
              helperText={structured?.valor_extenso ? `Extenso: ${structured.valor_extenso}` : undefined}
            />
            <InputField label="Nota Fiscal" value={structured?.num_nota_fiscal || ''} onChange={(val) => updateField('num_nota_fiscal', val)} />
            
            {/* Group 3: Credor e CNPJ */}
            <InputField 
              label="Empresa" 
              value={structured?.credor || ''} 
              onChange={(val) => updateField('credor', val)} 
              onBlur={forceFormatCredor}
            />
            <InputField 
              label="CNPJ" 
              value={structured?.cnpj || ''} 
              onChange={(val) => updateField('cnpj', val)} 
              status={getCnpjStatus()}
              helperText={structured?.cnpj && !validarCNPJ(structured.cnpj) ? 'Dígito verificador inválido ou incompleto' : undefined}
            />
            
            {/* Group 4: Objeto */}
            <InputField 
              label="Objeto do Contrato" 
              value={structured?.objeto || ''} 
              onChange={(val) => updateField('objeto', val)} 
              onBlur={forceFormatObjeto} 
              fullWidth 
              isTextArea 
            />
            
            {/* Group 5: Empenho e Liquidação */}
            <InputField label="Nota de Empenho" value={structured?.num_empenho || ''} onChange={(val) => updateField('num_empenho', val)} />
            <InputField label="Nota de Liquidação" value={structured?.num_liquidacao || ''} onChange={(val) => updateField('num_liquidacao', val)} />
            
            <div className="col-span-2 border-t border-slate-100 pt-6 mt-2 grid grid-cols-3 gap-4">
              <InputField label="Dia" value={structured?.dia || ''} onChange={(val) => updateField('dia', val)} />
              <InputField label="Mês" value={structured?.mes || ''} onChange={(val) => updateField('mes', val)} />
              <InputField label="Ano" value={structured?.ano || ''} onChange={(val) => updateField('ano', val)} />
            </div>

            {/* Compliance Audit Feedback Panel for Municipal Auditing */}
            <div className="col-span-2 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
              <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-dashed border-slate-200 pb-2">
                🔎 Verificação Prévia de Auditoria do Controle Interno
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10.5px] text-slate-600">
                <div className="flex items-center gap-2">
                  {structured?.num_processo ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[9px]">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[9px]">!</span>
                  )}
                  <span>Processo Administrativo: <strong className="text-slate-700">{structured?.num_processo || 'Nenhum'}</strong></span>
                </div>
                
                <div className="flex items-center gap-2">
                  {structured?.cnpj && validarCNPJ(structured.cnpj) ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[9px]">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[9px]">✗</span>
                  )}
                  <span>Situação do CNPJ: <strong className="text-slate-700">{structured?.cnpj ? (validarCNPJ(structured.cnpj) ? 'Análise Consistente' : 'Erro de Dígitos') : 'Não Escaneado'}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  {structured?.valor && structured?.valor_extenso ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[9px]">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[9px]">!</span>
                  )}
                  <span>Valor por Extenso: <strong className="text-slate-700">{structured?.valor_extenso ? 'Sincronizado' : 'Aguardando Valor'}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  {structured?.num_nota_fiscal ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[9px]">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[9px]">✗</span>
                  )}
                  <span>Comprovação Fiscal: <strong className="text-slate-700">{structured?.num_nota_fiscal ? `NF n.º ${structured.num_nota_fiscal}` : 'Impossibilita Liquidação'}</strong></span>
                </div>
              </div>
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
