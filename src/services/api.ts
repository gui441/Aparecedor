import { createWorker } from 'tesseract.js';
import PizZipCallback from 'pizzip';
import DocxtemplaterCallback from 'docxtemplater';

const PizZip = (typeof PizZipCallback === 'function' ? PizZipCallback : (PizZipCallback as any).default || PizZipCallback) as any;
const Docxtemplater = (typeof DocxtemplaterCallback === 'function' ? DocxtemplaterCallback : (DocxtemplaterCallback as any).default || DocxtemplaterCallback) as any;

export interface ExtractionResult {
  text: string;
  structured?: any;
}

function preprocessImageForOcr(file: File, maxDimension = 1800, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Se for menor que a dimensão máxima e já for leve, redimensiona apenas se necessário para manter DPI alto e boa velocidade
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 1. Converter para escala de cinza de alta fidelidade usando a fórmula de luminância BT.601
        const grayscale = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          grayscale[i >> 2] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        // 2. Aplicar filtro de nitidez por convolução (Unsharp Mask) para destacar as arestas das letras
        const sharpened = new Uint8Array(width * height);
        const kernel = [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0
        ];

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
              sharpened[y * width + x] = grayscale[y * width + x];
              continue;
            }
            
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const val = grayscale[(y + ky) * width + (x + kx)];
                const kVal = kernel[(ky + 1) * 3 + (kx + 1)];
                sum += val * kVal;
              }
            }
            sharpened[y * width + x] = Math.max(0, Math.min(255, sum));
          }
        }

        // 3. Gerar Imagens Integrais (Summed Area Tables) em O(N) para média e média quadrática local
        // Isso permite calcular o desvio padrão de janelas em tempo constante O(1) por pixel
        const integral = new Float64Array((width + 1) * (height + 1));
        const integralSq = new Float64Array((width + 1) * (height + 1));

        for (let y = 0; y < height; y++) {
          let rowSum = 0;
          let rowSumSq = 0;
          for (let x = 0; x < width; x++) {
            const val = sharpened[y * width + x];
            rowSum += val;
            rowSumSq += val * val;

            const idx = (y + 1) * (width + 1) + (x + 1);
            const prevRowIdx = y * (width + 1) + (x + 1);

            integral[idx] = integral[prevRowIdx] + rowSum;
            integralSq[idx] = integralSq[prevRowIdx] + rowSumSq;
          }
        }

        // 4. Binarização Adaptativa Local usando o algoritmo Sauvola
        // Perfeito para remover sombras, dobras de papel, brilhos de câmera e vinhetas
        const windowSize = Math.max(15, Math.floor(width / 45) | 1); // Janela dinâmica dependendo da resolução
        const halfWin = Math.floor(windowSize / 2);
        const k = 0.15; // Sensibilidade de limiar (0.15 é excelente para texto preto sobre papel claro/cinza)
        const R = 128;  // Faixa dinâmica do desvio padrão

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const y1 = Math.max(0, y - halfWin);
            const y2 = Math.min(height - 1, y + halfWin);
            const x1 = Math.max(0, x - halfWin);
            const x2 = Math.min(width - 1, x + halfWin);

            const count = (y2 - y1 + 1) * (x2 - x1 + 1);

            const idx00 = y1 * (width + 1) + x1;
            const idx01 = y1 * (width + 1) + (x2 + 1);
            const idx10 = (y2 + 1) * (width + 1) + x1;
            const idx11 = (y2 + 1) * (width + 1) + (x2 + 1);

            const sum = integral[idx11] - integral[idx01] - integral[idx10] + integral[idx00];
            const sumSq = integralSq[idx11] - integralSq[idx01] - integralSq[idx10] + integralSq[idx00];

            const mean = sum / count;
            const variance = (sumSq / count) - (mean * mean);
            const stdDev = Math.sqrt(Math.max(0, variance));

            const threshold = mean * (1 + k * (stdDev / R - 1));
            const currentVal = sharpened[y * width + x];

            // Saída binária perfeita: preto (0) ou branco (255)
            const binarized = currentVal > threshold ? 255 : 0;

            const pixelIdx = (y * width + x) * 4;
            data[pixelIdx] = binarized;
            data[pixelIdx + 1] = binarized;
            data[pixelIdx + 2] = binarized;
            data[pixelIdx + 3] = 255; // Opaco
          }
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const preprocessedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          const end = performance.now();
          console.log(`[Tesseract Ápice] Processamento Sauvola integral completo em ${(end - start).toFixed(1)}ms. Imagem original de ${(file.size / 1024 / 1024).toFixed(2)}MB reduzida para binarizada de ${(preprocessedFile.size / 1024).toFixed(0)}KB.`);
          resolve(preprocessedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export const apiService = {
  async extractText(file: File, onProgress?: (message: string) => void): Promise<ExtractionResult> {
    if (onProgress) onProgress('Preparando imagem com algoritmo de binarização adaptativa Sauvola...');
    const optimizedFile = await preprocessImageForOcr(file);
    
    // Para testar PURAMENTE com Tesseract.js (leitura/OCR com IA desativada temporariamente)
    const enableServerIA = true;
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    if (enableServerIA && isOnline) {
      try {
        console.log('Iniciando OCR de alta fidelidade pelo servidor para o arquivo:', optimizedFile.name);
        if (onProgress) onProgress('Processando imagem com IA de alta fidelidade...');

        const formData = new FormData();
        formData.append('image', optimizedFile);

        const response = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.text) {
            console.log('Extração e estruturação da IA concluída com sucesso via servidor.');
            return {
              text: result.text,
              structured: result.structured || null
            };
          }
        }
        console.warn('O servidor não respondeu com dados válidos de OCR. Iniciando fallback no cliente...');
      } catch (serverErr) {
        console.warn('Erro na requisição de OCR ao servidor, iniciando fallback local:', serverErr);
      }
    } else {
      console.log('Utilizando OCR local imediato com Tesseract.js (IA desativada).');
    }

    // 2. Client-side compilation with clean, pristine Tesseract directly on the original high-quality file
    try {
      console.log('Iniciando OCR local com Tesseract.js diretamente no arquivo otimizado...');
      if (onProgress) onProgress('Preparando motor de OCR local de alta precisão...');

      const worker = await createWorker('por', 1, {
        logger: m => {
          if (onProgress && typeof m === 'object' && m !== null) {
            if (m.status === 'recognizing text') {
              onProgress(`Reconhecendo (Modo Local): ${Math.round(m.progress * 100)}%`);
            } else {
              onProgress(`${m.status}`);
            }
          }
        }
      });
      
      console.log('Worker local pronto. Configurando parâmetros...');
      
      // Set parameters for high precision document analysis:
      // - Page Segmentation Mode (PSM) 3 is automatic page layout parsing
      // - Declare a higher DPI (300) to optimize internal word segmentation and prevent console logs/warnings
      // - Blacklist common garbage character noise to optimize the output
      // - preserve_interword_spaces keeps crucial spacing for tabular data match
      await worker.setParameters({
        tessedit_pageseg_mode: '3' as any,
        user_defined_dpi: '300',
        tessedit_char_blacklist: '`#%^*~|{}[]<>\\', // Blacklist annoying OCR artifact symbols
        tessedit_enable_dict_correction: '1' as any,
        preserve_interword_spaces: '1' as any, // Mantém espaçamento fidedigno do layout
      });

      if (onProgress) onProgress('Extraindo texto do documento binarizado...');
      const { data: { text: rawText } } = await worker.recognize(optimizedFile);
      console.log('Reconhecimento local concluído, tamanho do texto:', rawText?.length);
      
      await worker.terminate();

      if (!rawText || rawText.trim().length === 0) {
        throw new Error('Não foi possível extrair texto da imagem localmente.');
      }

      return { text: rawText };
    } catch (error) {
      console.error('Client-side OCR Fallback Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Falha ao processar o OCR da imagem localmente.');
    }
  },

  async exportToWord(structured: any, title: string = 'PARECER DO CONTROLE INTERNO MUNICIPAL'): Promise<Blob> {
    // 1. Try server-side generation first if online
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        console.log('Tentando gerar o documento Word pelo servidor (/api/export)...');
        const apiResponse = await fetch('/api/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ structured, title }),
        });

        if (apiResponse.ok) {
          const contentType = apiResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
            const blob = await apiResponse.blob();
            if (blob && blob.size > 0) {
              console.log('Documento Word gerado com sucesso pelo servidor. Tamanho:', blob.size);
              return blob;
            }
          }
        }
        console.warn('O servidor não retornou um DOCX válido. Iniciando fallback no cliente...');
      } catch (apiErr) {
        console.warn('Erro ao conectar ou gerar via servidor, tentando fallback local no cliente:', apiErr);
      }
    } else {
      console.log('Dispositivo em modo offline. Ignorando exportação de Word pelo servidor e utilizando template local.');
    }

    // 2. Client-side fallback compilation
    try {
      console.log('Iniciando geração local do arquivo Word...');
      
      // Try to fetch `/template.docx` without query parameter first to match PWA precached asset exactly
      let response = await fetch('/template.docx');
      let contentType = response.headers.get('content-type');

      // If we got HTML (which is a routing fallback) or a bad status, try fetching with cache-busting as next fallback
      if (!response.ok || (contentType && contentType.includes('text/html'))) {
        console.log('Busca por /template.docx retornou HTML ou erro. Testando com parâmetro t=...');
        response = await fetch('/template.docx?t=' + Date.now());
        contentType = response.headers.get('content-type');
      }

      if (!response.ok) {
        throw new Error(`Servidor retornou erro ${response.status} ao carregar o modelo.`);
      }
      
      if (contentType && contentType.includes('text/html')) {
        throw new Error('O modelo template.docx retornou uma página HTML em vez de um arquivo DOCX. Verifique os caminhos e o service worker.');
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('O arquivo de modelo baixado está vazio.');
      }

      // Use PizZip to handle the binary content
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const aditivosParts = [];
      if (structured.num_aditivo) aditivosParts.push(`Termo Aditivo n.º ${structured.num_aditivo}`);
      if (structured.num_apostilamento) aditivosParts.push(`Termo de Apostilamento n.º ${structured.num_apostilamento}`);
      if (structured.num_adesao) aditivosParts.push(`Adesão n.º ${structured.num_adesao}`);
      
      const aditivosLine = aditivosParts.join(' – ');
      const hasAditivosLine = aditivosParts.length > 0;

      doc.render({
        tipo_pregao: 'Pregão Eletrônico',
        ...structured,
        aditivos_line: aditivosLine,
        has_aditivos_line: hasAditivosLine,
        title: title || 'PARECER DO CONTROLE INTERNO MUNICIPAL',
      });

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      return out;
    } catch (error) {
      console.error('Client-side Export Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Falha ao gerar o arquivo Word localmente.');
    }
  },

  async correctSpelling(structured: any): Promise<any> {
    try {
      console.log('Solicitando correção ortográfica de IA pelo servidor...');
      const response = await fetch('/api/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ structured }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor de correção (' + response.status + ')');
      }

      const result = await response.json();
      if (result && result.corrected) {
        console.log('Correção ortográfica concluída com sucesso.');
        return result.corrected;
      }
      throw new Error('Resposta inválida do servidor.');
    } catch (err) {
      console.error('Erro na correção de ortografia:', err);
      throw err;
    }
  },
};
