import { DespachoData, RecentProcess } from '../types';

const STORAGE_KEY = 'despachador_recent_processes_v1';
const MAX_PROCESSES = 50;

/**
 * Retorna a lista de processos recentes salvos localmente, ordenados do mais recente para o mais antigo.
 */
export function getRecentProcesses(): RecentProcess[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    return [];
  } catch (error) {
    console.error('Erro ao carregar processos recentes do localStorage:', error);
    return [];
  }
}

/**
 * Salva ou atualiza um processo recente na memória do navegador.
 */
export function saveRecentProcess(
  structuredData: DespachoData,
  extractedText: string = '',
  existingId?: string
): RecentProcess {
  try {
    const processes = getRecentProcesses();
    const now = Date.now();
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(now));

    // Se temos um ID existente, procuramos por ele
    let targetIndex = existingId ? processes.findIndex((p) => p.id === existingId) : -1;

    // Se não encontrou por ID, mas tem número de processo e nota fiscal válidos, tenta atualizar o mesmo processo
    if (targetIndex === -1 && structuredData.num_processo && structuredData.num_nota_fiscal) {
      targetIndex = processes.findIndex(
        (p) =>
          p.structuredData.num_processo?.trim() === structuredData.num_processo?.trim() &&
          p.structuredData.num_nota_fiscal?.trim() === structuredData.num_nota_fiscal?.trim()
      );
    }

    let savedItem: RecentProcess;

    if (targetIndex >= 0) {
      // Atualizar existente
      savedItem = {
        ...processes[targetIndex],
        timestamp: now,
        dateFormatted,
        structuredData: { ...structuredData },
        extractedText: extractedText || processes[targetIndex].extractedText || ''
      };
      processes[targetIndex] = savedItem;
    } else {
      // Criar novo
      const id = existingId || `proc_${now}_${Math.random().toString(36).substring(2, 8)}`;
      savedItem = {
        id,
        timestamp: now,
        dateFormatted,
        structuredData: { ...structuredData },
        extractedText: extractedText || ''
      };
      processes.unshift(savedItem);
    }

    // Ordenar e limitar aos últimos N processos
    const trimmed = processes
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, MAX_PROCESSES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return savedItem;
  } catch (error) {
    console.error('Erro ao salvar processo recente:', error);
    const fallbackId = existingId || `proc_${Date.now()}`;
    return {
      id: fallbackId,
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleDateString('pt-BR'),
      structuredData: { ...structuredData },
      extractedText
    };
  }
}

/**
 * Remove um processo recente pelo ID.
 */
export function deleteRecentProcess(id: string): RecentProcess[] {
  try {
    const processes = getRecentProcesses();
    const filtered = processes.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (error) {
    console.error('Erro ao excluir processo recente:', error);
    return getRecentProcesses();
  }
}

/**
 * Limpa todo o histórico de processos recentes.
 */
export function clearRecentProcesses(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Erro ao limpar processos recentes:', error);
  }
}
