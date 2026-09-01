import html2pdf from 'html2pdf.js';
import { cleanSecretariaForFilename } from '../App';

export interface PDFExportOptions {
  fileName?: string;
  onProgress?: (percent: number, message: string) => void;
}

export function generateDespachoFileName(data: any, extension: 'pdf' | 'docx' = 'pdf'): string {
  const credor = (data?.credor || 'Credor').trim();
  const secretaria = cleanSecretariaForFilename(data?.secretaria || '');
  const nf = (data?.num_nota_fiscal || '000').trim();
  const valor = (data?.valor || '0,00').toString().replace(/^R\$\s*/i, '').trim();
  const secPart = secretaria ? ` - ${secretaria}` : '';
  
  const rawName = `DESPACHO ${credor}${secPart} - R$ ${valor} - NF ${nf}.${extension}`;
  return rawName.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * Generates a high-definition PDF from a DOM element using html2pdf.js
 */
export async function exportToPDF(
  element: HTMLElement,
  data: any,
  options?: PDFExportOptions
): Promise<Blob> {
  const fileName = options?.fileName || generateDespachoFileName(data, 'pdf');
  
  if (options?.onProgress) options.onProgress(20, 'Renderizando documento em alta resolução...');

  // Ensure images are fully loaded inside the element
  const images = element.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

  if (options?.onProgress) options.onProgress(50, 'Configurando páginas A4 e timbrado...');

  const opt = {
    margin: 0,
    filename: fileName,
    image: { type: 'jpeg' as const, quality: 0.98 },
    enableLinks: false,
    html2canvas: {
      scale: 3, // 300 DPI equivalent for crystal-clear vector-like typography
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollY: 0,
      scrollX: 0,
      backgroundColor: '#ffffff',
      allowTaint: true,
    },
    jsPDF: {
      unit: 'mm' as const,
      format: 'a4' as const,
      orientation: 'portrait' as const,
      compress: true,
    },
  };

  if (options?.onProgress) options.onProgress(75, 'Gerando arquivo PDF...');

  const worker = html2pdf().set(opt).from(element);
  
  // Save directly to user
  await worker.save(fileName);

  if (options?.onProgress) options.onProgress(100, 'Download do PDF concluído!');

  // Also return blob in case caller needs it
  const pdfBlob = await worker.output('blob');
  return pdfBlob;
}

/**
 * Triggers direct browser printing with pristine A4 margin rules
 */
export function printDespachoDirect(elementToPrint?: HTMLElement): void {
  // If no element provided, trigger standard print which utilizes @media print
  if (!elementToPrint) {
    window.print();
    return;
  }

  // Create an invisible iframe for completely isolated and pristine printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    document.body.removeChild(iframe);
    return;
  }

  // Copy stylesheets
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Imprimir Despacho</title>
      ${styles}
      <style>
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-page {
          width: 210mm !important;
          height: 297mm !important;
          box-shadow: none !important;
          margin: 0 !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
          overflow: hidden !important;
        }
      </style>
    </head>
    <body>
      ${elementToPrint.outerHTML}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  // Cleanup iframe after printing
  setTimeout(() => {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    } catch {
      // Ignore
    }
  }, 60000);
}
