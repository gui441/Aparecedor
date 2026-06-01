import React, { useState, useEffect, useRef } from 'react';
import { Folder, FolderCheck, RefreshCw, Play, Square, Eye, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerFolderConfigProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

interface ScannedFileInfo {
  name: string;
  size: number;
  lastModified: number;
  handle: any; // FileSystemFileHandle
}

export const ScannerFolderConfig: React.FC<ScannerFolderConfigProps> = ({ onFileSelect, isLoading }) => {
  const [isSupported, setIsSupported] = useState(true);
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  const [scannedFiles, setScannedFiles] = useState<ScannedFileInfo[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [autoImport, setAutoImport] = useState(true);
  
  // To avoid immediately auto-importing pre-existing files, we record the time monitoring started
  const monitoringStartTimeRef = useRef<number>(0);
  const importedFilesRef = useRef<Set<string>>(new Set<string>());
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    setIsSupported(supported);
  }, []);

  // Beep synthesis on auto-import (high-fidelity feedback!)
  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // Function to scan files in the directory handle
  const readDirectoryFiles = async (handle: any, silent = false) => {
    if (!handle) return [];
    if (!silent) setIsReading(true);

    try {
      // Check if we already have read permission
      const options = { mode: 'read' as const };
      if ((await handle.queryPermission(options)) !== 'granted') {
        const permission = await handle.requestPermission(options);
        if (permission !== 'granted') {
          throw new Error('Permissão negada para ler o diretório.');
        }
      }

      const files: ScannedFileInfo[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (file.type.startsWith('image/')) {
            files.push({
              name: entry.name,
              size: file.size,
              lastModified: file.lastModified,
              handle: entry
            });
          }
        }
      }

      // Sort files by last modified descending
      files.sort((a, b) => b.lastModified - a.lastModified);
      
      setScannedFiles(files);
      return files;
    } catch (err) {
      console.error('Erro ao ler pasta:', err);
      return [];
    } finally {
      if (!silent) setIsReading(false);
    }
  };

  // Request directory picker
  const handleSelectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      const files = await readDirectoryFiles(handle);
      
      // Initialize importedFiles with existing files so we don't grab them on start
      const preExisting = new Set<string>();
      files.forEach(f => preExisting.add(`${f.name}-${f.lastModified}`));
      importedFilesRef.current = preExisting;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Falha ao abrir diretório: ' + err.message);
      }
    }
  };

  // Convert FileSystemFileHandle to File object & select it
  const handleImportFile = async (info: ScannedFileInfo) => {
    try {
      const file = await info.handle.getFile();
      onFileSelect(file);
      importedFilesRef.current.add(`${info.name}-${info.lastModified}`);
    } catch (err) {
      console.error('Erro ao importar arquivo do diretório:', err);
    }
  };

  // Poll directories for changes
  const runPollCheck = async () => {
    if (!dirHandle) return;
    const currentFiles = await readDirectoryFiles(dirHandle, true);
    if (currentFiles.length === 0) return;

    // Find the latest file
    const latestFile = currentFiles[0];
    const uniqueKey = `${latestFile.name}-${latestFile.lastModified}`;

    // Auto import trigger condition:
    // 1. AutoImport is checked
    // 2. We have never processed this file in this monitoring session
    // 3. The file was modified AFTER we turned on monitoring (or is very recent)
    const isNew = !importedFilesRef.current.has(uniqueKey);
    const isAfterMonitoringStart = latestFile.lastModified > monitoringStartTimeRef.current - 5000; // 5s buffer

    if (autoImport && isNew && isAfterMonitoringStart && !isLoading) {
      playSuccessBeep();
      await handleImportFile(latestFile);
    }
  };

  // Monitor toggle
  const toggleMonitoring = () => {
    if (isMonitoring) {
      // Turn off
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsMonitoring(false);
    } else {
      // Turn on
      monitoringStartTimeRef.current = Date.now();
      setIsMonitoring(true);
      // Run immediately
      runPollCheck();
    }
  };

  useEffect(() => {
    if (isMonitoring && dirHandle) {
      intervalRef.current = setInterval(() => {
        runPollCheck();
      }, 3000); // Check every 3 seconds for physical scanner drop-offs
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring, dirHandle, autoImport, isLoading]);

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
            onClick={() => {
              setDirHandle(null);
              setIsMonitoring(false);
            }}
            className="text-[10px] text-red-600 font-bold hover:underline"
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
            onClick={handleSelectFolder}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
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
              <FolderCheck className="w-4 h-4 shrink-0 text-emerald-500 animate-pulse" />
              <div className="truncate text-left">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Pasta Conectada</p>
                <p className="text-xs font-bold text-slate-700 truncate">{dirHandle.name}</p>
              </div>
            </div>
            <button
              onClick={() => readDirectoryFiles(dirHandle)}
              title="Recarregar pasta"
              disabled={isReading}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReading ? 'animate-spin' : ''}`} />
            </button>
          </div>

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
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shrink-0 transition-all ${
                isMonitoring
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
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
                  const alreadyImported = importedFilesRef.current.has(`${fileInfo.name}-${fileInfo.lastModified}`);
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
                        className={`px-2 py-1 rounded text-[10px] font-bold h-7 shrink-0 transition-all ${
                          alreadyImported 
                            ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                            : 'bg-blue-50 hover:bg-blue-100 text-[#2563eb] border border-blue-100'
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-2" />
                        ) : alreadyImported ? (
                          'Reimportar'
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
