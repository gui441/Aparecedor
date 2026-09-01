import { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ScannerFolderConfig } from './components/ScannerFolderConfig';
import { getScannerHandle, saveScannerHandle, clearScannerHandle } from './utils/scannerStorage';
import { Editor } from './components/Editor';
import { RecentProcessesModal } from './components/RecentProcessesModal';
import { getRecentProcesses, saveRecentProcess, deleteRecentProcess, clearRecentProcesses } from './utils/recentProcesses';
import { RecentProcess, DespachoData } from './types';
import { apiService } from './services/api';
import { exportToPDF, printDespachoDirect } from './services/pdfService';
import { DocumentPreview, OfficialDocumentContent } from './components/DocumentPreview';
import { AlertCircle, Layout, Printer, Info, Sparkles, Check, Settings, Key, X, AlertTriangle, History, Clock, FileText, Download, FileDown, ArrowRight, Trash2, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { valorPorExtenso } from './utils/currency';

export enum AppStep {
  CHOICE = 'CHOICE',
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  RESULT = 'RESULT'
}

export function cleanSecretaria(sec: string): string {
  if (!sec) return '';
  let cleaned = sec.trim();
  
  // Specific spelling corrections
  cleaned = cleaned.replace(/assist[êe]cia/i, 'Assistência')
                   .replace(/assistecia/i, 'Assistência')
                   .replace(/secreteria/i, 'Secretaria')
                   .replace(/saude/i, 'Saúde');
  
  // Remove Prefeitura municipal prefixes if extracted
  cleaned = cleaned.replace(/^(prefeitura\s+municipal\s+de\s+barra\s+do\s+corda(?: - ma)?|prefeitura\s+municipal\s+de\s+|prefeitura\s+municipal\s+|prefeitura\s+de\s+barra\s+do\s+corda)/i, '');
  
  // Remove Secretaria prefixes
  cleaned = cleaned.replace(/^(secretaria\s+municipal\s+adjunta\s+de\s+|secretaria\s+municipal\s+de\s+|secretaria\s+adjunta\s+de\s+|secretaria\s+de\s+|secretaria\s+municipal\s+|secretaria\s+|sec\.\s+municipal\s+de\s+|sec\.\s+de\s+|sec\s+de\s+|secreteria\s+municipal\s+de\s+|secreteria\s+de\s+|secreteria\s+)/i, '');
  
  cleaned = cleaned.trim();
  
  // Remove FMAS, FMS or similar suffixes
  cleaned = cleaned.replace(/\s*-\s*FMAS\s*$/i, '')
                   .replace(/\s*-\s*FMS\s*$/i, '')
                   .replace(/\s*-\s*FUMAS\s*$/i, '')
                   .replace(/^(?:Fundo\s+Municipal\s+de\s+)/i, '');
  
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

  // Specific common transcription spelling fixes
  cleaned = cleaned.replace(/forncimento/i, 'fornecimento')
                   .replace(/forneciment\s/i, 'fornecimento ')
                   .replace(/aditio/i, 'aditivo')
                   .replace(/prestaca\s/i, 'prestação ')
                   .replace(/prestacao/i, 'prestação')
                   .replace(/aquisicao/i, 'aquisição')
                   .replace(/aquisiçao/i, 'aquisição');

  // Remove common document history prefixes to keep only the pure action/object
  cleaned = cleaned.replace(/^(?:liquidação\s+de\s+nf-e\s+n.*?,\s*(?:referente\s+ao\s+|referente\s+a\s+|referente\s+à\s+)?|liquidação\s+de\s+nota\s+fiscal\s+n.*?,\s*(?:referente\s+ao\s+|referente\s+a\s+|referente\s+à\s+)?|referente\s+ao\s+|referente\s+a\s+|referente\s+à\s+|valor\s+que\s+se\s+empenha\s+referente\s+ao\s+|valor\s+que\s+se\s+empenha\s+referente\s+a\s+|pagamento\s+referente\s+ao\s+|pagamento\s+referente\s+a\s+|despesa\s+referente\s+ao\s+|despesa\s+referente\s+a\s+)/i, '');

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
    /\s*(?:conforme|conforme\s+a|conforme\s+o)\s+(?:necessidade|solicitação|necessidades|demandas)?\s*(?:da|do|de)?\s*(?:secretaria|sec\.|fundo|unidade|prefeitura|órgão)[\s\S]*$/i,
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

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  return cleaned;
}

// Limpa campos opcionais de ausência (termo aditivo, apostilamento e adesão)
export function cleanOptionalField(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  const lower = str.toLowerCase();
  
  if (!str || 
      lower === 'n/a' || 
      lower === 'na' ||
      lower === 'não' ||
      lower === 'nao' ||
      lower === 'não consta' || 
      lower === 'nao consta' || 
      lower === 'não aplicável' || 
      lower === 'nao aplicavel' || 
      lower === 'não se aplica' || 
      lower === 'nao se aplica' || 
      lower === 'sem' || 
      lower === 'null' || 
      lower === 'undefined' ||
      lower.includes('não consta') ||
      lower.includes('não se aplica') ||
      lower.includes('não aplicável') ||
      lower.includes('não mencionado') ||
      lower.includes('nao mencionado')
  ) {
    return '';
  }
  
  if (!/\d/.test(str)) {
    return '';
  }
  
  return str;
}

export function cleanCredor(credor: string): string {
  if (!credor) return '';
  return credor
    .toUpperCase()
    .trim();
}

export function cleanSecretariaForFilename(name: string): string {
  if (!name) return '';
  
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  
  if (
    normalized === "PLANEJAMENTO, ORCAMENTO E GESTAO" || 
    normalized === "PLANEJAMENTO ORCAMENTO E GESTAO" || 
    normalized.includes("PLANEJAMENTO, ORCAMENTO") || 
    normalized.includes("PLANEJAMENTO ORCAMENTO") ||
    normalized === "SEPLAN"
  ) {
    return "SEPLAN";
  }

  if (
    normalized.includes("ASSISTENCIA SOCIAL") ||
    normalized === "ASSISTENCIA"
  ) {
    return "ASSISTÊNCIA";
  }

  return name
    .replace(/^(?:secretaria\s+municipal\s+de\s+|secretaria\s+municipal\s+da\s+|secretaria\s+adjunta\s+de\s+|secretaria\s+de\s+|secretaria\s+da\s+|secretaria\s+|sec\.\s+de\s+|sec\.\s+|sec\s+de\s+|sec\s+)/gi, '')
    .trim()
    .toUpperCase();
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.CHOICE);
  const [selectedMode, setSelectedMode] = useState<'image' | 'form' | null>(null);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key_custom') || '';
  });
  const [showApiModal, setShowApiModal] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [recentProcesses, setRecentProcesses] = useState<RecentProcess[]>(() => getRecentProcesses());
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // --- INTEGRATED PERSISTENT SCANNER FOLDER STATES ---
  const [scannerDirHandle, setScannerDirHandle] = useState<any | null>(null);
  const [isScannerMonitoring, setIsScannerMonitoring] = useState(false);
  const [isScannerReading, setIsScannerReading] = useState(false);
  const [scannerFiles, setScannerFiles] = useState<any[]>([]);
  const [autoImportScanner, setAutoImportScanner] = useState(true);
  const [scannerPermission, setScannerPermission] = useState<'granted' | 'prompt' | 'denied' | null>(null);

  const scannerStartTimeRef = useRef<number>(0);
  const scannerImportedFilesRef = useRef<Set<string>>(new Set<string>());
  const scannerIntervalRef = useRef<any>(null);

  // Audio Beep Feedback
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

  // Read files helper
  const readScannerDirectory = async (handle: any, silent = false) => {
    if (!handle) return [];
    if (!silent) setIsScannerReading(true);

    try {
      const options = { mode: 'read' as const };
      const currentPerm = await handle.queryPermission(options);
      setScannerPermission(currentPerm);
      
      if (currentPerm !== 'granted') {
        if (!silent) {
          const reqPerm = await handle.requestPermission(options);
          setScannerPermission(reqPerm);
          if (reqPerm !== 'granted') {
            throw new Error('Permissão negada.');
          }
        } else {
          return []; // Skip if silent and no permission
        }
      }

      const files: any[] = [];
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

      files.sort((a, b) => b.lastModified - a.lastModified);
      setScannerFiles(files);
      return files;
    } catch (err) {
      console.error('Erro ao ler diretório do scanner:', err);
      return [];
    } finally {
      if (!silent) setIsScannerReading(false);
    }
  };

  // Convert and Import single scanned file
  const handleImportScannerFile = async (info: any) => {
    try {
      const file = await info.handle.getFile();
      handleExtraction(file);
      scannerImportedFilesRef.current.add(`${info.name}-${info.lastModified}`);
    } catch (err) {
      console.error('Erro ao importar arquivo do scanner:', err);
    }
  };

  // Poll Check function
  const runScannerPollCheck = async (handle: any) => {
    if (!handle) return;
    try {
      const currentFiles = await readScannerDirectory(handle, true);
      if (currentFiles.length === 0) return;

      const latestFile = currentFiles[0];
      const uniqueKey = `${latestFile.name}-${latestFile.lastModified}`;

      const isNew = !scannerImportedFilesRef.current.has(uniqueKey);
      const isAfterMonitoringStart = latestFile.lastModified > scannerStartTimeRef.current - 5000;

      if (autoImportScanner && isNew && isAfterMonitoringStart && !isLoading) {
        playSuccessBeep();
        await handleImportScannerFile(latestFile);
      }
    } catch (e) {
      console.warn('Silent poll failed:', e);
    }
  };

  // Toggle monitor callback
  const handleToggleScannerMonitoring = () => {
    if (isScannerMonitoring) {
      setIsScannerMonitoring(false);
      localStorage.setItem('keep_scanner_monitoring', 'false');
    } else {
      scannerStartTimeRef.current = Date.now();
      setIsScannerMonitoring(true);
      localStorage.setItem('keep_scanner_monitoring', 'true');
      runScannerPollCheck(scannerDirHandle);
    }
  };

  // Authorize callback
  const handleAuthorizeScannerDir = async () => {
    if (!scannerDirHandle) return;
    try {
      const options = { mode: 'read' as const };
      const reqPerm = await scannerDirHandle.requestPermission(options);
      setScannerPermission(reqPerm);
      if (reqPerm === 'granted') {
        const keepMonitoring = localStorage.getItem('keep_scanner_monitoring') === 'true';
        if (keepMonitoring) {
          scannerStartTimeRef.current = Date.now();
          setIsScannerMonitoring(true);
        }
        await readScannerDirectory(scannerDirHandle);
      }
    } catch (err) {
      console.error('Erro ao reautorizar pasta:', err);
    }
  };

  // Disconnect callback
  const handleDisconnectScanner = async () => {
    setScannerDirHandle(null);
    setIsScannerMonitoring(false);
    setScannerPermission(null);
    setScannerFiles([]);
    localStorage.removeItem('keep_scanner_monitoring');
    await clearScannerHandle();
  };

  // Initialize from storage on mount
  useEffect(() => {
    const initScanner = async () => {
      const savedHandle = await getScannerHandle();
      if (savedHandle) {
        setScannerDirHandle(savedHandle);
        try {
          const perm = await savedHandle.queryPermission({ mode: 'read' });
          setScannerPermission(perm);
          
          if (perm === 'granted') {
            const files = await readScannerDirectory(savedHandle, true);
            const preExisting = new Set<string>();
            files.forEach(f => preExisting.add(`${f.name}-${f.lastModified}`));
            scannerImportedFilesRef.current = preExisting;

            const keepMonitoring = localStorage.getItem('keep_scanner_monitoring') === 'true';
            if (keepMonitoring) {
              scannerStartTimeRef.current = Date.now();
              setIsScannerMonitoring(true);
            }
          }
        } catch (e) {
          console.error('Failed to query initial permission for stored scanner:', e);
        }
      }
    };
    initScanner();
  }, []);

  // Set up continuous background polling interval
  useEffect(() => {
    if (isScannerMonitoring && scannerDirHandle) {
      scannerIntervalRef.current = setInterval(() => {
        runScannerPollCheck(scannerDirHandle);
      }, 3000);
    } else {
      if (scannerIntervalRef.current) clearInterval(scannerIntervalRef.current);
    }
    return () => {
      if (scannerIntervalRef.current) clearInterval(scannerIntervalRef.current);
    };
  }, [isScannerMonitoring, scannerDirHandle, autoImportScanner, isLoading]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize data if null to prevent crashes in Setup
  if (!structuredData && currentStep === AppStep.SETUP) {
    const now = new Date();
    setStructuredData({
      num_processo: '',
      num_nota_fiscal: '',
      secretaria: '',
      num_contrato: '',
      tipo_pregao: 'Pregão Eletrônico',
      num_pregao: '',
      num_aditivo: '',
      num_apostilamento: '',
      num_adesao: '',
      num_registro_preco: '',
      valor: '',
      valor_extenso: '',
      credor: '',
      cnpj: '',
      objeto: '',
      num_empenho: '',
      num_liquidacao: '',
      lei_regencia: '14.133/21',
      is_lei_8666: false,
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
        if (serverStructured.valor) {
          serverStructured.valor = serverStructured.valor.replace(/R\$\s*/gi, '').trim();
        }
        // We received perfect structured values directly from the server-side multimodal Gemini OCR!
        // No client-side regex or second refinement LLM call is required.
        const newStructured = {
          ...serverStructured,
          num_aditivo: cleanOptionalField(serverStructured.num_aditivo),
          num_apostilamento: cleanOptionalField(serverStructured.num_apostilamento),
          num_adesao: cleanOptionalField(serverStructured.num_adesao),
          num_registro_preco: cleanOptionalField(serverStructured.num_registro_preco),
          credor: cleanCredor(serverStructured.credor || ''),
          valor_extenso: valorPorExtenso(serverStructured.valor || ''),
          secretaria: cleanSecretaria(serverStructured.secretaria),
          lei_regencia: '14.133/21',
          is_lei_8666: false,
          dia: now.getDate().toString(),
          mes: now.toLocaleString('pt-BR', { month: 'long' }),
          ano: now.getFullYear().toString()
        };
        setStructuredData(newStructured);
        const saved = saveRecentProcess(newStructured, rawText);
        setActiveProcessId(saved.id);
        setRecentProcesses(getRecentProcesses());
        setCurrentStep(AppStep.SETUP);
        setIsLoading(false);
        return;
      }

      // --- FALLBACK PROCESS (when local Tesseract OCR was utilized) ---
      // Step 2: Improved Regex & Keyword Extraction (Deterministic/Offline)
      setLoadingMessage('Localizando padrões...');
      
      const text = rawText;
      
      // Helper to find text between keywords or after a keyword with dynamic separators
      const findAfter = (keywords: string[], maxLength = 100) => {
        for (const kw of keywords) {
          // Escape especial chars and check for optional separators
          const kwPattern = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`${kwPattern}[\\s.:\\-_=]*\\s*(.*)`, 'i');
          const match = text.match(reg);
          if (match && match[1]) {
            return match[1].substring(0, maxLength).trim();
          }
        }
        return '';
      };

      const textNoSpaces = text.replace(/\s+/g, '').toUpperCase();

      // Flexible CNPJ extraction that supports space/characters noise from OCR
      const cnpjRawMatch = text.match(/\d{2}\s*\.?\s*\d{3}\s*\.?\s*\d{3}\s*[\/\s]?\s*\d{4}\s*[\-\s]?\s*\d{2}/)?.[0] || '';
      const cnpjOnlyDigits = cnpjRawMatch.replace(/\D/g, '');
      const cleanedCnpj = cnpjOnlyDigits.length === 14 ? 
        `${cnpjOnlyDigits.substring(0, 2)}.${cnpjOnlyDigits.substring(2, 5)}.${cnpjOnlyDigits.substring(5, 8)}/${cnpjOnlyDigits.substring(8, 12)}-${cnpjOnlyDigits.substring(12, 14)}` : 
        '';

      // Get valor liquidado first as it represents the actual payment being analyzed, fallback to general value
      const valorLiquidadoMatch = text.match(/(?:VALOR LIQUIDADO|LIQUIDADO)\s*[\s.:\-_]*\s*(?:R\$\s*|R\s?\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1];
      const valorTotalMatch = text.match(/(?:VALOR TOTAL|VALOR)\s*[\s.:\-_]*\s*(?:R\$\s*|R\s?\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1];
      const finalValor = valorLiquidadoMatch || valorTotalMatch || '';

      const regexData: any = {
        cnpj: cleanedCnpj,
        
        // Pega valor prioritário (liquidado) ou totalizador
        valor: finalValor,
        
        // Nota Fiscal no histórico ou campo específico com suporte a pontos ruidosos (ex: 2.323) e tipos de NF (mercadoria ou serviço)
        num_nota_fiscal: text.match(/(?:Nota fiscal mercadoria|Nota fiscal servico|NFS-[eE]|NF-[eE]\s*n[ºo°.]|NF\s*n[ºo°.]|NFS-e|NF-e|NF|N[ºo°.]|Nota)\s*[\s.:\-_]*\s*(\d+(?:\.\d+)*)/i)?.[1]?.replace(/\./g, '') || 
                         textNoSpaces.match(/NOTAFISCAL(?:MERCADORIA|SERVICO)?(\d+)/)?.[1] || '',
        
        // Processo no histórico: suportando espaços, pontos ruidosos (ex: 1.225 / 2025) e tipos de processo
        num_processo: (() => {
          const m1 = text.match(/(?:Processo Administrativo|Processo de Pagamento|Processo|Proc\.?\s*Adm\.?)\s*(?:n[ºo°.]|n|#|:)?\s*(\d+(?:\.\d+)*\s*[\/\-]\s*\d+)/i);
          if (m1) return m1[1].replace(/\s+/g, '');

          const m2 = text.match(/(?:Processo Administrativo|Processo de Pagamento|Processo|Proc\.?\s*Adm\.?)\s*(?:n[ºo°.]|n|#|:)\s*(\d+(?:\.\d+)*)/i);
          if (m2) return m2[1];

          const m3 = textNoSpaces.match(/(?:PROCESSOADMINISTRATIVO|PROCESSO|PROCADM)(?:N[ºO°.]|N|#|:)?(\d+(?:[\/\-]\d+)?)/i);
          if (m3) return m3[1];

          return '';
        })(),
        
        // Empenho: "NOTA DE EMPENHO... 09030010"
        num_empenho: text.match(/(?:NOTA\s*DE\s*EMPENHO|Empenho|NE)\s*[\s.:\-_]*\s*(\d+)/i)?.[1] || 
                     textNoSpaces.match(/EMPENHO[.\:]*(\d+)/)?.[1] || '',
        
        // Liquidação no topo: "NOTA DE LIQUIDAÇÃO 09030042" ou flexível para letras espaçadas "N O T A..."
        num_liquidacao: text.match(/(?:NOTA\s*DE\s*LIQUIDA[CÇ]ÃO|NOTA\s*DE\s*LIQUIDACAO|Liquidação|Liquidacao|NL)\s*[\s.:\-_]*\s*(\d+)/i)?.[1] || 
                        textNoSpaces.match(/LIQUIDA[CÇ][A-Z~^]*O[.\:]*(\d+)/)?.[1] || '',
        
        // Contrato no histórico com suporte a palavras intermediárias (Ex: Contrato de Prestação de Serviços nº 446/2025) e sem ano
        num_contrato: (() => {
          const isLaw = (val: string) => {
            const clean = val.replace(/\D/g, '');
            return clean === '866693' || clean === '1413321' || clean === '141332021';
          };

          const m1 = text.match(/(?:Contrato|CONTRATO)\s*(?:n[ºo°.]|n|#|:|º|°)?\s*(\d+(?:\.\d+)*\s*[\/\-]\s*\d+)/i);
          if (m1 && !isLaw(m1[1])) return m1[1].replace(/\s+/g, '');

          const m2 = text.match(/(?:Contrato|CONTRATO)(?:\s+[a-zA-ZÀ-ÿ]+){1,5}\s*(?:n[ºo°.]|n|#|:|º|°)?\s*(\d+(?:\.\d+)*\s*[\/\-]\s*\d+)/i);
          if (m2 && !isLaw(m2[1])) return m2[1].replace(/\s+/g, '');

          const m3 = text.match(/(?:Contrato|CONTRATO)\s*(?:n[ºo°.]|n|#|:|º|°)\s*(\d+)/i);
          if (m3 && !isLaw(m3[1])) return m3[1];

          const m4 = text.match(/(?:Contrato|CONTRATO)(?:\s+[a-zA-ZÀ-ÿ]+){1,5}\s*(?:n[ºo°.]|n|#|:|º|°)\s*(\d+)/i);
          if (m4 && !isLaw(m4[1])) return m4[1];

          const m5 = textNoSpaces.match(/CONTRATO(?:N[ºO°.]|N|#|:)?(\d+[\/\-]\d+)/i);
          if (m5 && !isLaw(m5[1])) return m5[1];

          const m6 = textNoSpaces.match(/CONTRATO(?:N[ºO°.]|N|#|:)?(\d+)/i);
          if (m6 && !isLaw(m6[1])) return m6[1];

          return '';
        })(),
        
        // Pregão / PE / Dispensa / Inexigibilidade no histórico com suporte a variações
        num_pregao: (() => {
          const m1 = text.match(/(?:P\.?\s*E\.?|Pregão|Pregao|Dispensa|Inexigibilidade|Concorrência|Concorrencia)(?:\s+[a-zA-ZÀ-ÿ]+){0,3}\s*(?:n[ºo°.]|n|#|:|º|°)?\s*(\d+(?:\.\d+)*\s*[\/\-]\s*\d+)/i);
          if (m1) return m1[1].replace(/\s+/g, '');

          const m2 = text.match(/(?:P\.?\s*E\.?|Pregão|Pregao|Dispensa|Inexigibilidade|Concorrência|Concorrencia)(?:\s+[a-zA-ZÀ-ÿ]+){0,3}\s*(?:n[ºo°.]|n|#|:|º|°)\s*(\d+)/i);
          if (m2) return m2[1];

          const m3 = textNoSpaces.match(/(?:PE|PREGAO|DISPENSA|INEXIGIBILIDADE|CONCORRENCIA)(?:N[ºO°.]|N|#|:)?(\d+(?:[\/\-]\d+)?)/i);
          if (m3) return m3[1];

          return '';
        })(),

        // Detect modality/tipo_pregao
        tipo_pregao: (() => {
          if (text.match(/Inexigibilidade/i)) return 'Inexigibilidade';
          if (text.match(/Dispensa/i)) return 'Dispensa';
          if (text.match(/Pregão\s+Presencial/i)) return 'Pregão Presencial';
          if (text.match(/Concorrência\s+Pública/i)) return 'Concorrência Pública';
          if (text.match(/Concorrência\s+Eletrônica/i)) return 'Concorrência Eletrônica';
          if (text.match(/Credenciamento/i)) return 'Credenciamento';
          if (text.match(/Chamamento/i)) return 'Chamamento Público';
          return 'Pregão Eletrônico';
        })(),

        // Termo Aditivo no histórico: "Termo Aditivo nº 01/2025" ou similar
        num_aditivo: text.match(/(?:Termo\s+Aditivo|Aditivo|TA)\s*(?:n[ºo°.]|n|#)?\s*(\d+(?:\.\d+)*[\/\-]\d+)/i)?.[1] || '',
        
        // Termo de Apostilamento no histórico
        num_apostilamento: text.match(/(?:Termo\s+de\s+Apostilamento|Apostilamento)\s*(?:n[ºo°.]|n|#)?\s*(\d+(?:\.\d+)*[\/\-]\d+)/i)?.[1] || '',
        
        // Adesão no histórico
        num_adesao: text.match(/(?:Termo\s+de\s+Ades[ãa]o|Ades[ãa]o|Adesao)\s*(?:n[ºo°.]|n|#)?\s*(\d+(?:\.\d+)*[\/\-]\d+)/i)?.[1] || '',
        
        // Registro de Preço no histórico
        num_registro_preco: text.match(/(?:Ata\s+de\s+Registro\s+de\s+Pre[çc]o|Registro\s+de\s+Pre[çc]o|RP|SRP)\s*(?:n[ºo°.]|n|#)?\s*(\d+(?:\.\d+)*[\/\-]\d+)/i)?.[1] || '',
        
        // Complex fields handled by keywords
        credor: findAfter(['Credor', 'RAZÃO SOCIAL', 'NOME DO CREDOR', 'CONTRATADA', 'EMPRESA'], 60),
        
        // No histórico geralmente vem após "referente à", "referente ao", "referente a" ou "HISTÓRICO"
        objeto: findAfter(['referente ao', 'referente à', 'referente a', 'OBJETO', 'HISTÓRICO', 'HISTORICO', 'HISTÓRIC0', 'FINALIDADE', 'DESTINAÇÃO'], 180),
        
        secretaria: findAfter(['UNIDADE ORÇAMENTÁRIA', 'SECRETARIA', 'ÓRGÃO', 'UNIDADE'], 60)
      };

      // Limpeza de campos comuns: remove prefixo "R$" caso o regex tenha capturado
      if (regexData.valor) {
        regexData.valor = regexData.valor.replace(/R\$\s*/gi, '').trim();
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
        num_aditivo: cleanOptionalField(regexData.num_aditivo),
        num_apostilamento: cleanOptionalField(regexData.num_apostilamento),
        num_adesao: cleanOptionalField(regexData.num_adesao),
        num_registro_preco: cleanOptionalField(regexData.num_registro_preco),
        credor: cleanCredor(regexData.credor || ''),
        valor_extenso: valorPorExtenso(regexData.valor || ''),
        secretaria: cleanSecretaria(regexData.secretaria),
        objeto: cleanObjeto(regexData.objeto),
        lei_regencia: '14.133/21',
        is_lei_8666: false,
        dia: now.getDate().toString(),
        mes: now.toLocaleString('pt-BR', { month: 'long' }),
        ano: now.getFullYear().toString()
      };

      setStructuredData(initialData);

      // Step 3: AI Structuring (The "Regardless of means" solution if online)
      // Para testar PURAMENTE com Tesseract.js (leitura/refinamento com IA desativada temporariamente)
      const enableAIStructuring = true;
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      if (!isOnline || !enableAIStructuring) {
        console.log('IA desativada para testes ou offline: pulando refinamento estrutural com IA.');
        setCurrentStep(AppStep.SETUP);
        setIsLoading(false);
        return;
      }

      setLoadingMessage('Refinando dados com IA...');
      
      try {
        // Priority: 1. User custom typed key, 2. Compiled process.env.GEMINI_API_KEY, 3. Blocked public fallback
        const apiKeyToUse = customApiKey?.trim() || process.env.GEMINI_API_KEY || 'AIzaSyDzua6GSrfPoDNxKiEAFub2I2M5Ae3nyFU';
        const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
        
        const prompt = `Você é um assistente especializado em Controle Interno da Prefeitura de Barra do Corda - MA.
        Sua tarefa é extrair e corrigir ortograficamente os campos abaixo do texto OCR de um documento (Nota de Empenho, Nota de Liquidação, NF, etc).

        Durante a extração, você deve aplicar automaticamente uma camada silenciosa de correção ortográfica e aprimoramento linguístico nos campos estruturados:
        1. Grafia de Secretarias: Você deve extrair o NOME ESPECÍFICO do órgão municipal, IGNORANDO e OMITINDO totalmente prefixos redundantes como "Secretaria de", "Secretaria Municipal de", "SEC DE", "SEC MUNICIPAL DE" e semelhantes. Por exemplo, se for "Secretaria Municipal de Saúde", extraia e preencha APENAS "Saúde". Ajuste para Capitalização Adequada.
        2. Grafia de Credor: Corrija a grafia de nomes próprios, palavras como "LTDA", "S/A", "ME", garantindo que estejam formatadas profissionalmente em maiúsculas se cabível, sem abreviações estranhas geradas pelo OCR.
        3. Objeto do Parecer/Contrato: Corrija a concordância, acentuação, exclua lixo de digitalização ou caracteres avulsos. Complete termos truncados (ex: prestacao -> prestação, aquisicao -> aquisição, manutencao -> manutenção). ATENÇÃO CRÍTICA: Não cite de forma alguma a secretaria atendida ou destinatária no objeto. Ignore, omita ou retire trechos como "para atender as necessidades da Secretaria Municipal de Saúde", "destinado à Secretaria...", "para a secretaria...", etc. Deixe somente a ação/item em si (ex: se for "Aquisição de peças para a Secretaria de Educação", deixe apenas "Aquisição de peças").
        4. Números e Valores: Preserve integralmente quaisquer números reais de CPF, CNPJ, empenho, contratos e processos rasteados. Apenas remova ruídos de pontuação inadequados.
        5. Preservação Factual: Em hipótese alguma altere valores financeiros reais nem invente fatos novos.

        Campos Necessários:
        - num_processo: Número do Processo Administrativo ou de Pagamento (ex: "1.225/2025" ou "1305/2025"). Procure em todo o documento, especialmente na seção "HISTÓRICO", onde consta frequentemente como "Processo Administrativo nº X", "Processo de Pagamento n° X" ou "Processo n° X". Extraia o número completo, com barras ou pontos se presentes.
        - num_nota_fiscal: Número da NF ou NF-e.
        - secretaria: O nome específico da secretaria (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). Sem prefixos "Secretaria Municipal de".
        - num_contrato: Número do contrato. Procure exaustivamente em todo o documento, especialmente no "HISTÓRICO" ou cabeçalhos. Pode constar como "Contrato nº X/X", "Contrato Administrativo nº X", "Contrato de Rateio nº X", "Contrato de Prestação de Serviços nº X", ou "CONTRATO: X". Extraia o número completo com barras ou hífens.
        - tipo_pregao: O tipo/modalidade do procedimento ou licitação (ex: 'Pregão Eletrônico', 'Inexigibilidade', 'Pregão Presencial', 'Concorrência Pública', 'Dispensa', 'Concorrência Eletrônica'). Caso seja mencionado 'Pregão Eletrônico' ou se refira a um pregão eletrônico, defina como 'Pregão Eletrônico'.
        - num_pregao: Número do Pregão (PE) ou similar (PE, Dispensa, Inexigibilidade, etc.). Procure exaustivamente no "HISTÓRICO" ou cabeçalhos. Extraia o número completo correspondente (ex: "70/2024" ou "53/2025").
        - num_aditivo: Número do Termo Aditivo, caso esteja mencionado no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
        - num_apostilamento: Número do Termo de Apostilamento, caso esteja mencionado no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
        - num_adesao: Número da Adesão (ex: Adesão de SRP nº X), caso esteja mencionada no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
        - num_registro_preco: Número da Ata de Registro de Preços (ex: Ata de Registro de Preços nº 05/2025, SRP nº 05/2025), caso esteja mencionado no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
        - valor: Valor total/liquidado (Ex: R$ 34.923,00).
        - credor: Razão Social ou Nome do Credor.
        - cnpj: CNPJ do Credor.
        - objeto: Resumo do que está sendo pago/comprado (sem citar qual secretaria está sendo atendida, ex: "Prestação de serviços de limpeza").
        - num_empenho: Número da Nota de Empenho (geralmente no topo).
        - num_liquidacao: Número da Nota de Liquidação (geralmente no topo).

        Texto OCR:
        ${rawText}`;

        const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        let aiResult = null;
        let lastError = null;
        
        for (const modelName of models) {
          try {
            console.log(`[Client Gemini Fallback] Tentando modelo: ${modelName}`);
            const result = await ai.models.generateContent({ 
              model: modelName,
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
                    tipo_pregao: { type: Type.STRING },
                    num_pregao: { type: Type.STRING },
                    num_aditivo: { type: Type.STRING },
                    num_apostilamento: { type: Type.STRING },
                    num_adesao: { type: Type.STRING },
                    num_registro_preco: { type: Type.STRING },
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
            aiResult = result;
            break; // Succeeded! Exit retry loop
          } catch (err) {
            console.warn(`[Client Gemini Fallback] Falha com modelo ${modelName}:`, err);
            lastError = err;
          }
        }

        if (!aiResult) {
          throw lastError || new Error('Não foi possível obter resposta do servidor de IA do Gemini.');
        }

        const aiStructured = JSON.parse(aiResult.text || '{}');
        if (aiStructured.valor) {
          aiStructured.valor = aiStructured.valor.replace(/R\$\s*/gi, '').trim();
        }
        
        // Update with AI data, keeping date context
        setStructuredData((prev: any) => {
          const rawVal = aiStructured.valor || prev.valor || '';
          const updated = {
            ...prev,
            ...aiStructured,
            num_aditivo: cleanOptionalField(aiStructured.num_aditivo !== undefined ? aiStructured.num_aditivo : prev.num_aditivo),
            num_apostilamento: cleanOptionalField(aiStructured.num_apostilamento !== undefined ? aiStructured.num_apostilamento : prev.num_apostilamento),
            num_adesao: cleanOptionalField(aiStructured.num_adesao !== undefined ? aiStructured.num_adesao : prev.num_adesao),
            num_registro_preco: cleanOptionalField(aiStructured.num_registro_preco !== undefined ? aiStructured.num_registro_preco : prev.num_registro_preco),
            credor: cleanCredor(aiStructured.credor || prev.credor || ''),
            valor_extenso: valorPorExtenso(rawVal),
            secretaria: cleanSecretaria(aiStructured.secretaria || prev.secretaria || ''),
            objeto: cleanObjeto(aiStructured.objeto || prev.objeto || ''),
            dia: prev.dia,
            mes: prev.mes,
            ano: prev.ano
          };
          const saved = saveRecentProcess(updated, rawText, activeProcessId || undefined);
          setActiveProcessId(saved.id);
          setRecentProcesses(getRecentProcesses());
          return updated;
        });
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

  const handleExportPDF = async () => {
    if (!structuredData) return;
    setIsExportingPDF(true);
    try {
      const saved = saveRecentProcess(structuredData, extractedText, activeProcessId || undefined);
      setActiveProcessId(saved.id);
      setRecentProcesses(getRecentProcesses());

      const element = document.getElementById('preview-despacho-element') || document.getElementById('hidden-despacho-element');
      if (!element) {
        throw new Error('Elemento do documento não encontrado para exportação.');
      }
      await exportToPDF(element, structuredData);
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      setError(`Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDirectPrint = () => {
    if (!structuredData) return;
    const saved = saveRecentProcess(structuredData, extractedText, activeProcessId || undefined);
    setActiveProcessId(saved.id);
    setRecentProcesses(getRecentProcesses());

    const element = document.getElementById('preview-despacho-element') || document.getElementById('hidden-despacho-element');
    printDespachoDirect(element || undefined);
  };

  const handleExport = async () => {
    if (!structuredData) return;
    setIsExporting(true);
    try {
      // Auto-salvar no histórico ao exportar
      const saved = saveRecentProcess(structuredData, extractedText, activeProcessId || undefined);
      setActiveProcessId(saved.id);
      setRecentProcesses(getRecentProcesses());

      const blob = await apiService.exportToWord(structuredData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Nova lógica de nome: Credor - Secretaria - Nota Fiscal - Valor
      const credorText = (structuredData.credor || 'Final').trim();
      const secretariaText = cleanSecretariaForFilename(structuredData.secretaria || '');
      const nfText = (structuredData.num_nota_fiscal || '000').trim();
      const valorText = (structuredData.valor || '0,00').trim();
      
      const secPart = secretariaText ? ` - ${secretariaText}` : '';
      const fileName = `DESPACHO ${credorText}${secPart} - R$ ${valorText} - NF ${nfText}.docx`
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

  const goToResult = () => {
    if (structuredData) {
      const saved = saveRecentProcess(structuredData, extractedText, activeProcessId || undefined);
      setActiveProcessId(saved.id);
      setRecentProcesses(getRecentProcesses());
    }
    setCurrentStep(AppStep.RESULT);
  };

  const goBackToSetup = () => {
    setCurrentStep(AppStep.SETUP);
  };

  const handleNewParecer = () => {
    setExtractedText('');
    setStructuredData(null);
    setActiveProcessId(null);
    setCurrentStep(AppStep.CHOICE);
    setError(null);
  };

  const handleSelectRecentProcess = (process: RecentProcess) => {
    setStructuredData({ ...process.structuredData });
    setExtractedText(process.extractedText || '');
    setActiveProcessId(process.id);
    setSelectedMode('form');
    setCurrentStep(AppStep.SETUP);
    setShowRecentModal(false);
    setError(null);
  };

  const handleDeleteRecentProcess = (id: string) => {
    const updated = deleteRecentProcess(id);
    setRecentProcesses(updated);
    if (activeProcessId === id) {
      setActiveProcessId(null);
    }
  };

  const handleClearAllRecentProcesses = () => {
    clearRecentProcesses();
    setRecentProcesses([]);
    setActiveProcessId(null);
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
          <div className="w-1/3 flex justify-start items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider hidden sm:inline">
              {isOnline ? 'Online via IA' : 'Modo Local Ativo'}
            </span>
          </div>
          
          <div className="absolute inset-x-0 mx-auto flex justify-center pointer-events-none">
            <h1 className="text-xl font-extrabold tracking-widest text-slate-800 select-none pointer-events-auto">
              DESPACHADOR
            </h1>
          </div>
          
          <div className="w-1/3 flex justify-end items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowRecentModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all cursor-pointer shadow-sm pointer-events-auto"
              title="Acessar histórico de processos recentes salvos"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Recentes</span>
              {recentProcesses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                  {recentProcesses.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowApiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer shadow-sm pointer-events-auto"
              title="Configurar Chave API do Gemini"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Chave API</span>
              {customApiKey ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

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
                className="h-full flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar"
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

                {/* Seção de Processos Recentes para Acesso Rápido */}
                {recentProcesses.length > 0 && (
                  <div className="mt-8 w-full bg-white rounded-3xl p-5 border border-slate-200/90 shadow-lg shadow-slate-100">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Processos Recentes ({recentProcesses.length})
                        </span>
                      </div>
                      <button
                        onClick={() => setShowRecentModal(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>Ver todos ({recentProcesses.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {recentProcesses.slice(0, 3).map((item) => {
                        const d = item.structuredData || {};
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectRecentProcess(item)}
                            className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer text-left group flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 line-clamp-1">
                                  {d.credor || 'Credor não informado'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {item.dateFormatted?.split(' ')[0]}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 space-y-0.5">
                                {d.num_processo && <p className="font-semibold text-slate-700">Proc: {d.num_processo}</p>}
                                {d.num_nota_fiscal && <p>NF: {d.num_nota_fiscal}</p>}
                                {d.valor && <p className="text-emerald-700 font-bold">R$ {d.valor.toString().replace(/^R\$\s*/, '')}</p>}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold text-blue-600">
                              <span>Continuar / Editar</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-8 text-[#94a3b8] flex items-center gap-2">
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
                        * O upload da imagem preenche automaticamente o despacho usando Inteligência Artificial.
                      </p>
                    </div>

                    <ScannerFolderConfig 
                      onFileSelect={handleExtraction} 
                      isLoading={isLoading}
                      dirHandle={scannerDirHandle}
                      setDirHandle={setScannerDirHandle}
                      isMonitoring={isScannerMonitoring}
                      setIsMonitoring={setIsScannerMonitoring}
                      scannedFiles={scannerFiles}
                      setScannedFiles={setScannerFiles}
                      isReading={isScannerReading}
                      setIsReading={setIsScannerReading}
                      autoImport={autoImportScanner}
                      setAutoImport={setAutoImportScanner}
                      scannerPermission={scannerPermission}
                      setScannerPermission={setScannerPermission}
                      readDirectoryFiles={readScannerDirectory}
                      handleImportFile={handleImportScannerFile}
                      toggleMonitoring={handleToggleScannerMonitoring}
                      handleAuthorize={handleAuthorizeScannerDir}
                      handleDisconnect={handleDisconnectScanner}
                    />

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
                        <h2 className="text-lg font-bold text-[#1e293b]">Dados do Despacho</h2>
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
                        Gerar Despacho →
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

            {currentStep === AppStep.RESULT && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 overflow-hidden"
              >
                {/* Left: Actions Panel & Details */}
                <div className="flex flex-col gap-5 overflow-y-auto pr-1 custom-scrollbar">
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

                  <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 shadow-sm flex flex-col gap-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0">
                        ✓
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">
                          Despacho Pronto para Impressão
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Documento oficial formatado com papel timbrado da Prefeitura.
                        </p>
                      </div>
                    </div>

                    {/* Primary Export Actions */}
                    <div className="flex flex-col gap-3">
                      {/* Botão de Impressão Direta */}
                      <button
                        onClick={handleDirectPrint}
                        className="group w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-emerald-100 hover:shadow-emerald-200 cursor-pointer text-left"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                          <Printer className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">Imprimir / Salvar PDF (Ctrl+P)</div>
                          <div className="text-[11px] text-emerald-100 truncate">Impressão direta A4 sem margens extras</div>
                        </div>
                      </button>

                      {/* Botão de Download PDF */}
                      <button
                        onClick={handleExportPDF}
                        disabled={isExportingPDF}
                        className="group w-full p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-red-100 hover:shadow-red-200 disabled:opacity-50 cursor-pointer text-left"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                          <FileDown className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">
                            {isExportingPDF ? 'Gerando PDF Oficial...' : 'Baixar PDF Oficial (.pdf)'}
                          </div>
                          <div className="text-[11px] text-red-100 truncate">Cópia perfeita em alta definição com timbrado</div>
                        </div>
                      </button>

                      {/* Botão de Download DOCX */}
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="group w-full p-4 rounded-2xl bg-[#2563eb] hover:bg-blue-700 text-white flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-blue-100 hover:shadow-blue-200 disabled:opacity-50 cursor-pointer text-left"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">
                            {isExporting ? 'Gerando Word...' : 'Baixar Despacho Word (.docx)'}
                          </div>
                          <div className="text-[11px] text-blue-100 truncate">Documento editável para o Word</div>
                        </div>
                      </button>
                    </div>

                    {/* Informações do Processo */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Resumo do Despacho
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Credor:</span>
                        <span className="font-bold text-slate-800 max-w-[220px] truncate text-right">{structuredData?.credor || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Processo / NF:</span>
                        <span className="font-bold text-slate-800">{structuredData?.num_processo || 'S/N'} / NF {structuredData?.num_nota_fiscal || 'S/N'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Secretaria:</span>
                        <span className="font-bold text-slate-800 max-w-[200px] truncate text-right">{structuredData?.secretaria || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-500">Valor Total:</span>
                        <span className="font-bold text-emerald-600">
                          {structuredData?.valor?.toString().startsWith('R$') ? structuredData?.valor : `R$ ${structuredData?.valor || '0,00'}`}
                        </span>
                      </div>
                    </div>

                    {/* Ações Secundárias */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                      <button 
                        onClick={goBackToSetup}
                        className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors uppercase cursor-pointer"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => setShowRecentModal(true)}
                        className="h-11 rounded-xl bg-blue-50 hover:bg-blue-100 text-[11px] font-bold text-blue-700 transition-colors uppercase cursor-pointer flex items-center justify-center gap-1"
                      >
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        <span>Recentes</span>
                      </button>
                      <button 
                        onClick={handleNewParecer}
                        className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors uppercase cursor-pointer"
                      >
                        Novo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Live Interactive A4 Preview */}
                <div className="h-full overflow-hidden min-h-[500px]">
                  <DocumentPreview 
                    structuredData={structuredData}
                    onPrint={handleDirectPrint}
                    onDownloadPDF={handleExportPDF}
                    onDownloadDOCX={handleExport}
                    isExportingPDF={isExportingPDF}
                    isExportingDOCX={isExporting}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Render loading state as a clean, stable overlay on top of everything, completely bypassing Framer Motion exit/entry collisions */}
          {currentStep === AppStep.LOADING && (
            <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-10 text-center animate-fade-in">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
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
            </div>
          )}
        </main>
      </div>
      </div>

      {/* Print View Wrapper (hidden in normal UI) */}
      <div className="print-only" id="hidden-despacho-element">
        {structuredData && <OfficialDocumentContent structuredData={structuredData} />}
      </div>

      {/* API Key Modal */}
      <AnimatePresence>
        {showApiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 font-sans">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Configurar Chave API</h3>
                    <p className="text-[10px] text-slate-400 italic">Serviços de IA (Gemini)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 font-sans">
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 leading-relaxed space-y-1">
                    <p className="font-bold">Por que configurar uma chave pessoal?</p>
                    <p>
                      O servidor inteligente funciona 100% no ambiente local ou Cloud Run. Ao publicar no <b>Vercel</b> (hospedagem estática de frontend), as buscas e o refino de IA executam diretamente no navegador.
                    </p>
                    <p className="font-semibold text-[10px] text-amber-800 mt-1">
                      A chave pública padrão foi desativada pelo Google por limites e avisos de segurança regulamentares. Para usar as funções automáticas de OCR com IA e a correção gramatical inteligente no Vercel, insira sua própria chave Gemini.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Sua Chave API do Gemini (Google AI Studio)
                  </label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomApiKey(val);
                      localStorage.setItem('gemini_api_key_custom', val);
                    }}
                    placeholder="Cole sua chave AIzaSy..."
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/30 focus:bg-white transition-all font-mono placeholder:font-sans"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-450 pt-1">
                    <span>Salva localmente no seu navegador.</span>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Obter Chave Grátis ↗
                    </a>
                  </div>
                </div>

                {customApiKey && (
                  <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-xl p-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-[10px] text-emerald-850 font-semibold">
                      Chave personalizada configurada ativa!
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="px-4 py-2 bg-[#2563eb] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  Confirmar e Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Processos Recentes / Memória */}
      <RecentProcessesModal
        isOpen={showRecentModal}
        onClose={() => setShowRecentModal(false)}
        processes={recentProcesses}
        onSelectProcess={handleSelectRecentProcess}
        onDeleteProcess={handleDeleteRecentProcess}
        onClearAll={handleClearAllRecentProcesses}
      />
    </>
  );
}
