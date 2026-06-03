import { createWorker } from 'tesseract.js';
import PizZipCallback from 'pizzip';
import DocxtemplaterCallback from 'docxtemplater';

const PizZip = (typeof PizZipCallback === 'function' ? PizZipCallback : (PizZipCallback as any).default || PizZipCallback) as any;
const Docxtemplater = (typeof DocxtemplaterCallback === 'function' ? DocxtemplaterCallback : (DocxtemplaterCallback as any).default || DocxtemplaterCallback) as any;

export interface ExtractionResult {
  text: string;
  structured?: any;
}

export const apiService = {
  async extractText(file: File, onProgress?: (message: string) => void): Promise<ExtractionResult> {
    // 1. Try to use the high-precision server-side Gemini OCR first if online
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        console.log('Iniciando OCR de alta fidelidade pelo servidor para o arquivo:', file.name);
        if (onProgress) onProgress('Processando imagem com IA de alta fidelidade...');

        const formData = new FormData();
        formData.append('image', file);

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
      console.log('Dispositivo em modo offline. Ignorando chamadas ao servidor e iniciando OCR local imediatamente.');
      if (onProgress) onProgress('Modo offline detectado. Iniciando OCR local rápido...');
    }

    // 2. Client-side fallback compilation with Tesseract (offline or non-configured cases)
    try {
      console.log('Iniciando OCR local (Tesseract) de alta precisão com pré-processamento avançado...');
      if (onProgress) onProgress('Preparando imagem localmente (Otimizando contraste)...');

      // Create a canvas to preprocess the image
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('Erro ao carregar imagem: ' + e));
        img.src = URL.createObjectURL(file);
      });

      console.log('Imagem carregada no cliente:', image.width, 'x', image.height);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context could not be created');

      // Downscale if image is too large (max 1600px width/height)
      const MAX_DIM = 1600;
      let width = image.width;
      let height = image.height;
      
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
        console.log('Redimensionando localmente para:', Math.round(width), 'x', Math.round(height));
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original image scaled
      ctx.drawImage(image, 0, 0, width, height);

      // Preprocessing: High-contrast binarization and adaptive-like thresholding
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Compute average luminance to define base threshold
      let totalLuminance = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Human eye standard luminosity weights: Green is highest, blue is lowest
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = gray;
        totalLuminance += gray;
      }
      
      const avgLuminance = totalLuminance / (data.length / 4);

      // Binarize/Enhance Contrast: Map values to pure white (background) or pure black (text)
      // This eliminates yellow paper scanning tints, shadows and noise dynamically
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i];
        let newVal = 128;
        if (v < avgLuminance * 0.95) {
          newVal = 0;      // Pure black for letters
        } else if (v > avgLuminance * 1.05) {
          newVal = 255;    // Pure white for backgrounds
        } else {
          // Sharp threshold contrast scaling for high letter edge definition
          newVal = ((v - avgLuminance * 0.95) / (avgLuminance * 0.1)) * 255;
        }
        data[i] = data[i + 1] = data[i + 2] = newVal;
      }
      ctx.putImageData(imageData, 0, 0);

      // Convert canvas to blob for Tesseract
      const processedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
        }, 'image/jpeg', 0.9);
      });

      URL.revokeObjectURL(image.src);
      console.log('Pre-processamento avançado da imagem concluído');

      const worker = await createWorker('por', 1, {
        logger: m => {
          console.log('Tesseract:', m);
          if (onProgress && typeof m === 'object' && m !== null) {
            if (m.status === 'recognizing text') {
              onProgress(`Reconhecendo (Modo Local): ${Math.round(m.progress * 100)}%`);
            } else {
              onProgress(`${m.status}`);
            }
          }
        }
      });
      
      console.log('Worker local pronto');
      const { data: { text: rawText } } = await worker.recognize(processedBlob);
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

      doc.render({
        ...structured,
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
