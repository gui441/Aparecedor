import React, { useState, useEffect } from 'react';
import { Folder, FolderCheck, RefreshCw, Key, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveScannerHandle } from '../utils/scannerStorage';

interface ScannerFolderConfigProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  dirHandle: any | null;
  setDirHandle: (handle: any | null) => void;
  isMonitoring: boolean;
  setIsMonitoring: (val: boolean) => void;
  scannedFiles: any[];
  setScannedFiles: (files: any[]) => void;
  isReading: boolean;
  setIsReading: (val: boolean) => void;
  autoImport: boolean;
  setAutoImport: (val: boolean) => void;
  scannerPermission: 'granted' | 'prompt' | 'denied' | null;
  setScannerPermission: (val: 'granted' | 'prompt' | 'denied' | null) => void;
  readDirectoryFiles: (handle: any, silent?: boolean) => Promise<any[]>;
  handleImportFile: (info: any) => Promise<void>;
  toggleMonitoring: () => void;
  handleAuthorize: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
}

export const ScannerFolderConfig: React.FC<ScannerFolderConfigProps> = ({ 
  onFileSelect, 
  isLoading,
  dirHandle,
  setDirHandle,
  isMonitoring,
  setIsMonitoring,
  scannedFiles,
  setScannedFiles,
  isReading,
  setIsReading,
  autoImport,
  setAutoImport,
  scannerPermission,
  setScannerPermission,
  readDirectoryFiles,
  handleImportFile,
  toggleMonitoring,
  handleAuthorize,
  handleDisconnect
}) => {
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    setIsSupported(supported);
  }, []);

  const handleSelectFolderClick = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      await saveScannerHandle(handle);
      await readDirectoryFiles(handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Falha ao abrir diretório: ' + err.message);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-slate-50 rounded-[20px] p-5 border border-slate-200">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Pasta do Scanner Físico
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              O recurso de integração automática com pasta física do scanner necessita da API do Sistema de Arquivos (Chrome, Edge ou Opera executado no Desktop). Use um navegador compatível para acionar a conexão automática.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-[20px] p-5 border border-slate-200 shadow-inner flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖨️</span>
          <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Scanner Físico: Pasta Destino
          </h4>
        </div>
        {dirHandle && (
          <button
            onClick={handleDisconnect}
            className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
          >
            Desconectar
          </button>
        )}
      </div>

      {!dirHandle ? (
        <div className="text-center py-4 px-2">
          <p className="text-[11px] text-slate-500 mb-3 leading-snug">
            Configure a pasta local de destino do seu scanner em rede ou USB para carregar os documentos digitalizados de forma instantânea.
          </p>
          <button
            onClick={handleSelectFolderClick}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Folder className="w-4 h-4 text-slate-400" />
            Selecionar Pasta do Scanner
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Status connected */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <FolderCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <div className="truncate text-left">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Pasta Conectada</p>
                <p className="text-xs font-bold text-slate-700 truncate">{dirHandle.name}</p>
              </div>
            </div>
            <button
              onClick={() => readDirectoryFiles(dirHandle)}
              title="Recarregar pasta"
              disabled={isReading}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Browser Permission Request Block (if prompt or denied) */}
          {scannerPermission !== 'granted' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
              <div className="flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="text-[11px] font-bold text-amber-900 mb-0.5">Permissão Expirada</h5>
                  <p className="text-[10px] text-amber-800 leading-snug mb-2.5">
                    Os navegadores exigem que você autorize o acesso à pasta local a cada nova sessão.
                  </p>
                  <button
                    onClick={handleAuthorize}
                    className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Autorizar Pasta Conectada
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Autoload Controller */}
          <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Auto-Importador
              </span>
              <span className="text-[10px] text-slate-500 leading-snug">
                Detecta e inicia OCR ao salvar imagem no scanner
              </span>
            </div>
            <button
              onClick={toggleMonitoring}
              disabled={scannerPermission !== 'granted'}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isMonitoring
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              }`}
            >
              {isMonitoring ? (
                <>
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  Ativo
                </>
              ) : (
                'Iniciar'
              )}
            </button>
          </div>

          {/* Scanned files list */}
          <div className="flex flex-col gap-1.5 mt-1">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-left pl-1">
              Arquivos Encontrados ({scannedFiles.length})
            </p>

            <div className="max-h-36 overflow-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-sm">
              {scannedFiles.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-[10px]">
                  Nenhuma imagem encontrada nesta pasta.
                </div>
              ) : (
                scannedFiles.slice(0, 3).map((fileInfo) => {
                  return (
                    <div
                      key={`${fileInfo.name}-${fileInfo.lastModified}`}
                      className="p-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="overflow-hidden min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{fileInfo.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {new Date(fileInfo.lastModified).toLocaleTimeString()} · {(fileInfo.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => handleImportFile(fileInfo)}
                        disabled={isLoading}
                        className="px-2 py-1 rounded text-[10px] font-bold h-7 shrink-0 transition-all bg-blue-50 hover:bg-blue-100 text-[#2563eb] border border-blue-100 cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-2" />
                        ) : (
                          'Importar'
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {scannedFiles.length > 3 && (
              <p className="text-[9px] text-slate-400 italic text-right pr-1">
                mostrando os 3 arquivos mais recentes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
