import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  Trash2, 
  FileText, 
  ExternalLink, 
  Download, 
  Calendar, 
  Building2, 
  DollarSign, 
  FileCheck, 
  X, 
  AlertTriangle,
  Clock,
  ArrowRight,
  Copy
} from 'lucide-react';
import { RecentProcess } from '../types';
import { apiService } from '../services/api';
import { cleanSecretariaForFilename } from '../App';

interface RecentProcessesModalProps {
  isOpen: boolean;
  onClose: () => void;
  processes: RecentProcess[];
  onSelectProcess: (process: RecentProcess) => void;
  onDeleteProcess: (id: string) => void;
  onClearAll: () => void;
}

export const RecentProcessesModal: React.FC<RecentProcessesModalProps> = ({
  isOpen,
  onClose,
  processes,
  onSelectProcess,
  onDeleteProcess,
  onClearAll
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Filtragem dos processos por múltiplos campos
  const filteredProcesses = useMemo(() => {
    if (!searchTerm.trim()) return processes;
    const term = searchTerm.toLowerCase().trim();
    return processes.filter((item) => {
      const data = item.structuredData || {};
      const credor = (data.credor || '').toLowerCase();
      const numProcesso = (data.num_processo || '').toLowerCase();
      const numNf = (data.num_nota_fiscal || '').toLowerCase();
      const secretaria = (data.secretaria || '').toLowerCase();
      const cnpj = (data.cnpj || '').toLowerCase();
      const valor = (data.valor || '').toLowerCase();
      const contrato = (data.num_contrato || '').toLowerCase();
      const adesao = (data.num_adesao || '').toLowerCase();
      const objeto = (data.objeto || '').toLowerCase();

      return (
        credor.includes(term) ||
        numProcesso.includes(term) ||
        numNf.includes(term) ||
        secretaria.includes(term) ||
        cnpj.includes(term) ||
        valor.includes(term) ||
        contrato.includes(term) ||
        adesao.includes(term) ||
        objeto.includes(term)
      );
    });
  }, [processes, searchTerm]);

  const handleDownloadDirect = async (e: React.MouseEvent, process: RecentProcess) => {
    e.stopPropagation();
    try {
      setDownloadingId(process.id);
      const blob = await apiService.exportToWord(process.structuredData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const credorText = (process.structuredData.credor || 'Final').trim();
      const secretariaText = cleanSecretariaForFilename(process.structuredData.secretaria || '');
      const nfText = (process.structuredData.num_nota_fiscal || '000').trim();
      const valorText = (process.structuredData.valor || '0,00').trim();
      const secPart = secretariaText ? ` - ${secretariaText}` : '';
      const fileName = `DESPACHO ${credorText}${secPart} - R$ ${valorText} - NF ${nfText}.docx`.replace(/[/\\?%*:|"<>]/g, '-');

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao baixar documento do histórico:', err);
      alert('Erro ao gerar arquivo Word.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden z-10 font-sans"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center shadow-inner">
                <History className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">Processos Recentes</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                    {processes.length} {processes.length === 1 ? 'salvo' : 'salvos'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Memória de despachos para rápida consulta, correções e alterações
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {processes.length > 0 && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Limpar todos os registros"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar Histórico</span>
                </button>
              )}

              {confirmClear && (
                <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-xl border border-red-200">
                  <span className="text-[11px] font-bold text-red-700 px-2">Confirmar?</span>
                  <button
                    onClick={() => {
                      onClearAll();
                      setConfirmClear(false);
                    }}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    Sim, apagar
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 bg-white text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por credor, processo, nota fiscal, secretaria, CNPJ ou valor..."
                className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Process List Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5 custom-scrollbar bg-[#f8fafc]">
            {filteredProcesses.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
                  <Clock className="w-7 h-7" />
                </div>
                {searchTerm ? (
                  <>
                    <p className="text-sm font-bold text-slate-700">Nenhum processo encontrado</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Nenhum resultado correspondente a "{searchTerm}". Tente outros termos.
                    </p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-3 text-xs font-bold text-blue-600 hover:underline"
                    >
                      Limpar filtro de pesquisa
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-700">Nenhum processo recente salvo ainda</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Ao criar ou escanear um documento e gerar o despacho, ele ficará automaticamente arquivado nesta memória para você editar ou corrigir a qualquer momento.
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredProcesses.map((proc) => {
                const data = proc.structuredData || {};
                const isDownloading = downloadingId === proc.id;

                return (
                  <motion.div
                    key={proc.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => onSelectProcess(proc)}
                    className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-4.5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Process details */}
                      <div className="flex-1 space-y-2">
                        {/* Title & Numbers */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                            {data.credor || 'Credor não informado'}
                          </h3>
                          {data.num_processo && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Proc: {data.num_processo}
                            </span>
                          )}
                          {data.num_nota_fiscal && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              NF: {data.num_nota_fiscal}
                            </span>
                          )}
                        </div>

                        {/* Metadata Tags */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                          {data.secretaria && (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium">
                                {data.secretaria.toLowerCase().startsWith('secretaria')
                                  ? data.secretaria
                                  : `Secretaria de ${data.secretaria}`}
                              </span>
                            </div>
                          )}

                          {data.valor && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-bold text-emerald-700">
                                {data.valor.toString().startsWith('R$') ? data.valor : `R$ ${data.valor}`}
                              </span>
                            </div>
                          )}

                          {data.num_contrato && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <span>Contrato: {data.num_contrato}</span>
                              {data.num_adesao && (
                                <span className="text-blue-600 font-semibold">• Adesão: {data.num_adesao}</span>
                              )}
                              {data.num_registro_preco && (
                                <span className="text-amber-700 font-semibold">• Ata: {data.num_registro_preco}</span>
                              )}
                              {data.num_pregao && (
                                <span>• {data.tipo_pregao || 'Pregão'} {data.num_pregao}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Objeto Snippet */}
                        {data.objeto && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 italic bg-slate-50/80 p-1.5 rounded-lg border border-slate-100">
                            Objeto: {data.objeto}
                          </p>
                        )}
                      </div>

                      {/* Right: Actions & Timestamp */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span>{proc.dateFormatted}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleDownloadDirect(e, proc)}
                            disabled={isDownloading}
                            className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-100 flex items-center gap-1 text-xs font-semibold"
                            title="Baixar diretamente em Word (.docx)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">
                              {isDownloading ? 'Gerando...' : '.docx'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProcess(proc);
                            }}
                            className="px-3 py-2 rounded-xl bg-[#2563eb] text-white hover:bg-blue-700 transition-all font-bold text-xs flex items-center gap-1 shadow-sm shadow-blue-200"
                            title="Abrir para edição e correções"
                          >
                            <span>Abrir / Editar</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProcess(proc.id);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Remover deste histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-white border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
              Os dados ficam armazenados localmente com segurança no seu navegador.
            </span>
            <span className="font-semibold text-slate-500">
              Clique em qualquer processo para carregá-lo no formulário.
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
