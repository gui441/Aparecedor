import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { GoogleGenAI, Type } from "@google/genai";

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

async function callGeminiWithFallback(ai: any, params: any) {
  const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;
  
  for (const model of models) {
    try {
      console.log(`[Gemini Fallback] Tentando modelo: ${model}`);
      const response = await ai.models.generateContent({
        ...params,
        model: model
      });
      return response;
    } catch (err) {
      console.warn(`[Gemini Fallback] Falha com modelo ${model}:`, err ? (err as any).message || err : err);
      lastError = err;
    }
  }
  throw lastError;
}

function cleanOptionalField(val: any): string {
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Multer setup for image uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });

  // API Endpoint: High-Precision OCR & Structured Extraction (Gemini Multimodal with Tesseract Fallback)
  app.post('/api/extract', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      }

      const activeApiKey = process.env.GEMINI_API_KEY || 'AIzaSyDzua6GSrfPoDNxKiEAFub2I2M5Ae3nyFU';

      if (activeApiKey) {
        console.log('Utilizando Gemini para OCR multimodal de alta precisão e estruturação direta...');
        try {
          const ai = new GoogleGenAI({
            apiKey: activeApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          const base64Data = req.file.buffer.toString('base64');
          const mimeType = req.file.mimetype || 'image/jpeg';

          const prompt = `Você é um especialista em Controle Interno Municipal da Prefeitura de Barra do Corda - MA.
Sua tarefa é analisar a imagem fornecida (que é tipicamente uma "Nota de Liquidação", "Nota de Empenho", "Nota Fiscal" ou semelhantes) e realizar duas tarefas fundamentais com precisão máxima:

1. Transcrever todo o texto visível na imagem de forma contínua e fiel, sem omissões (esta será a base do OCR).
2. Localizar, interpretar, extrair e CORRIGIR ortograficamente as seguintes informações cruciais sob um formato JSON estruturado:
- num_processo: Número do Processo Administrativo (ex: "1.225/2025" ou "1305/2025" ou "2488/2024"). Verifique cuidadosamente a seção "HISTÓRICO" do documento, onde frequentemente consta no formato "Processo Administrativo nº 1.225/2025" ou "Processo administrativo nº 2488/2024". Extraia o número completo com pontos e barras.
- num_nota_fiscal: Número da Nota Fiscal (NF, NF-e, NFS-e). Na Nota de Liquidação, costuma constar na linha "Nota fiscal mercadoria/servico 2012 série A" ou no histórico "Liquidação de NFS-e nº 2012" ou "NFS-e n° 2012". Extraia apenas o número principal de identificação da NF (ex: "2012").
- secretaria: O NOME ESPECÍFICO da Secretaria, Órgão ou Unidade Orçamentária/Destinatária (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). ATENÇÃO CRÍTICA: Você deve IGNORAR e OMITIR inteiramente os prefixos "Secretaria Municipal de", "Secretaria de", "SEC DE", "SEC MUNICIPAL DE", "Fundo Municipal de" e variantes semelhantes. Além disso, CORRIJA IMEDIATAMENTE quaisquer erros ou grafias de digitação/OCR como "Assistêcia", "Assistecia", "Secreteria" ou "Fundo Municipal de Assistência Social" para "Assistência Social". Extraia apenas o nome próprio do órgão com Capitalização Adequada.
- num_contrato: Número do Contrato. Verifique no "HISTÓRICO" onde frequentemente consta como "Contrato nº 02/2025" ou similar.
- tipo_pregao: O tipo ou modalidade de contratação ou licitação (ex: 'Pregão Eletrônico', 'Inexigibilidade', 'Pregão Presencial', 'Concorrência Pública', 'Dispensa', 'Concorrência Eletrônica'). Se for um pregão eletrônico ou houver menção a PE nº, use 'Pregão Eletrônico'.
- num_pregao: Número do Pregão Eletrônico (PE) ou similar, associado à modalidade acima. Verifique no "HISTÓRICO" onde frequentemente consta como "Pregão Eletrônico nº 70/2024" ou "Dispensa nº X" ou "Pregão Presencial nº X". Extraia apenas o número (ex: "70/2024").
- num_aditivo: Número do Termo Aditivo. Verifique se consta como "Termo Aditivo n° 01/2025" ou similar. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
- num_apostilamento: Número do Termo de Apostilamento, se houver mencionado no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
- num_adesao: Número da Adesão (ex: Adesão de SRP nº X / Adesão nº X), se houver mencionada no documento. ATENÇÃO EXTREMA: Se não encontrar nenhuma menção a este campo na imagem, retorne obrigatoriamente uma string vazia ("").
- valor: O valor total ou valor liquidado do documento (formatado como "R$ X.XXX,XX"). ATENÇÃO CRÍTICA: Se houver campo "VALOR" no topo do empenho (ex: R$ 15.411,51) e campo "VALOR LIQUIDADO" no corpo/rodapé (ex: 8.785,35), você DEVE dar preferência absoluta e extrair o "VALOR LIQUIDADO" (ex: "R$ 8.785,35"), pois é este o valor efetivo de liquidação em auditoria para o parecer de pagamento.
- credor: Razão Social ou Nome do Credor (a empresa contratada, ex: "NACIONAL PAX SERVIÇOS PÓSTUMOS LTDA"). Corrija erros de grafia, acentue palavras como "PÓSTUMOS" de forma correta se vier "POSTUMOS" e padronize "LTDA", "S/A", "ME" em maiúsculas profissionais.
- cnpj: CNPJ do Credor (ex: "30.368.334/0001-83").
- objeto: Descrição resumida do objeto, finalidade ou histórico da despesa (ex: "fornecimento de bens e serviços fúnebres", "prestação de serviços de limpeza", etc). ATENÇÃO CRÍTICA: Você deve IGNORAR, OMITIR ou REMOVER inteiramente do texto do objeto qualquer menção à Secretaria atendida/destinatária, referências a instrumentos (como contratos/pregões) ou atos subsequentes. Por exemplo, de "referente ao forncimento de bens e serviços fúnebres, para atender as necessidades da Secretaria de Assistêcia Social, conforme contrato...", extraia APENAS "fornecimento de bens e serviços fúnebres". Corrija também a pontuação, exclua ruídos e corrija erros como "forncimento" -> "fornecimento", "aditio" -> "aditivo".
- num_empenho: Número da Nota de Empenho (ex: "02030003"). Atente para a linha "NOTA DE EMPENHO... 02030003" ou semelhante no documento.
- num_liquidacao: Número da Nota de Liquidação (ex: "02030027"). Atente para o título principal "NOTA DE LIQUIDAÇÃO 02030027" ou semelhante.

Durante a extração, aplique automaticamente essa camada de correção e polimento ortográfico aos campos estruturados de forma silenciosa e limpa, garantindo preservação absoluta de valores reais e números de auditoria legalmente vinculantes.

Retorne obrigatoriamente um objeto JSON com as propriedades 'text' (a transcrição completa e limpa do OCR) e 'structured' (um objeto contendo exatamente as chaves listadas acima). Se um campo não estiver presente de forma alguma no documento, retorne "".`;

          const response = await callGeminiWithFallback(ai, {
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: prompt
              }
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  text: { 
                    type: Type.STRING, 
                    description: "Transcrição contínua, fiel e completa de todo o texto contido na imagem." 
                  },
                  structured: {
                    type: Type.OBJECT,
                    description: "Os campos administrativos específicos estruturados.",
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
                      valor: { type: Type.STRING },
                      credor: { type: Type.STRING },
                      cnpj: { type: Type.STRING },
                      objeto: { type: Type.STRING },
                      num_empenho: { type: Type.STRING },
                      num_liquidacao: { type: Type.STRING }
                    }
                  }
                },
                required: ["text", "structured"]
              }
            }
          });

          const resultText = response.text;
          if (resultText) {
            const parsed = JSON.parse(resultText);
            console.log('Extração Gemini concluída com sucesso!');
            const structured = parsed.structured || {};
            // Limpa os campos opcionais
            if (structured.num_aditivo !== undefined) structured.num_aditivo = cleanOptionalField(structured.num_aditivo);
            if (structured.num_apostilamento !== undefined) structured.num_apostilamento = cleanOptionalField(structured.num_apostilamento);
            if (structured.num_adesao !== undefined) structured.num_adesao = cleanOptionalField(structured.num_adesao);

            return res.json({
              text: parsed.text || '',
              structured: structured
            });
          }
        } catch (geminiError) {
          console.warn('Erro ao processar extração com Gemini, usando fallback Tesseract:', geminiError);
        }
      }

      // Fallback: Local Tesseract OCR
      console.log('Iniciando Tesseract como fallback...');
      const worker = await createWorker('por');
      const { data: { text: rawText } } = await worker.recognize(req.file.buffer);
      await worker.terminate();

      if (!rawText || rawText.trim().length === 0) {
        return res.status(422).json({ error: 'Não foi possível extrair texto da imagem.' });
      }

      res.json({ text: rawText, structured: null });
    } catch (error) {
      console.error('OCR Extraction Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Falha ao processar o OCR da imagem.' 
      });
    }
  });

  // API Endpoint: Export to Word (with Template Injection)
  app.post('/api/export', async (req, res) => {
    try {
      const { structured, title } = req.body;

      if (!structured) {
        return res.status(400).json({ error: 'Dados estruturados não enviados.' });
      }

      // Robust template resolution checking multiple fallback paths
      const pathsToTry = [
        path.join(process.cwd(), 'public', 'template.docx'),
        path.join(process.cwd(), 'dist', 'template.docx'),
        path.join(process.cwd(), 'template.docx')
      ];

      let templatePath = '';
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          templatePath = p;
          console.log(`Sucesso: Modelo template.docx encontrado em ${p}`);
          break;
        }
      }
      
      if (templatePath) {
        // Read file as binary string to ensure compatibility with PizZip/Docxtemplater
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        try {
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
        } catch (error) {
          console.error('Docxtemplater Render Error:', error);
          throw error;
        }

        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename=parecer-final.docx');
        return res.send(buffer);
      }

      // Fallback
      return res.status(500).json({ error: 'Modelo template.docx não encontrado.' });
    } catch (error) {
      console.error('Export Error:', error);
      res.status(500).json({ error: 'Falha ao gerar o arquivo Word.' });
    }
  });

  // API Endpoint: AI-Powered Spell Check & Orthography Correction layer
  app.post('/api/correct', async (req, res) => {
    try {
      const { structured } = req.body;
      if (!structured) {
        return res.status(400).json({ error: 'Dados não fornecidos para correção.' });
      }

      const activeApiKey = process.env.GEMINI_API_KEY || 'AIzaSyDzua6GSrfPoDNxKiEAFub2I2M5Ae3nyFU';
      const ai = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Você é um assessor e revisor linguístico sênior do Controle Interno da Prefeitura Municipal de Barra do Corda - MA.
Sua missão é corrigir e aprimorar de forma impecável toda a ortografia, pontuação, acentuação, concordância e as maiúsculas/minúsculas dos campos estruturados contidos em um rascunho de parecer administrativo municipal.

Instruções específicas para correção:
1. Grafia de Secretarias: Remova inteiramente os prefixos "Secretaria de", "Secretaria Municipal de", "SEC DE", "SEC MUNICIPAL DE" e semelhantes. Mantenha e preencha APENAS o nome próprio (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). Além disso, CORRIJA IMEDIATAMENTE quaisquer erros ou grafias de digitação/OCR como "Assistêcia", "Assistecia", "Secreteria" ou "Fundo Municipal de Assistência Social" para "Assistência Social". Ajuste para Capitalização Adequada.
2. Grafia de Credor (Empresa): Corrija a grafia de nomes próprios, palavras como "LTDA", "S/A", "ME", garantindo que estejam formatadas profissionalmente em maiúsculas se cabível, sem abreviações estranhas geradas pelo OCR (ex: de "POSTUMOS" ou "POSTOMUS", corrija para "PÓSTUMOS").
3. Objeto do Parecer/Contrato: Corrija a concordância, pontuação, exclua lixo de digitalização ou caracteres avulsos. Complete termos truncados e corrija erros como "forncimento" -> "fornecimento", "aditio" -> "aditivo", "prestacao" -> "prestação", "aquisicao" -> "aquisição", "manutencao" -> "manutenção". ATENÇÃO CRÍTICA: Você deve IGNORAR, OMITIR ou REMOVER inteiramente do texto do objeto qualquer menção à Secretaria atendida/destinatária (ex: de "fornecimento de bens e serviços fúnebres, para atender as necessidades da Secretaria de Assistência Social", deixe APENAS "fornecimento de bens e serviços fúnebres").
4. Unidades e Números: Preserve integralmente quaisquer dígitos referentes a CPF, CNPJ, números de contratos, processos e empenhos. Conserte somente pontuações inadequadas neles, mantendo os dígitos exatos intactos.
5. Preservação Factual: Em hipótese alguma invente informações novas ou altere valores financeiros, pois são dados de auditoria legalmente vinculantes.
6. Campos opcionais (termo aditivo, termo de apostilamento e de adesão): Se estes campos vierem preenchidos no rascunho com expressões de ausência (como "N/A", "Não consta", "Não se aplica", "Não aplicável", "Sem", "NULL", etc.) ou sem números válidos, ou se não existirem no documento de origem, você DEVE limpá-los obrigatoriamente e deixá-los como string vazia ("").

Abaixo estão os dados rascunhados em formato JSON:
${JSON.stringify(structured, null, 2)}

Retorne obrigatoriamente um objeto JSON com as mesmas propriedades revisadas.`;

      const response = await callGeminiWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
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
              valor: { type: Type.STRING },
              credor: { type: Type.STRING },
              cnpj: { type: Type.STRING },
              objeto: { type: Type.STRING },
              num_empenho: { type: Type.STRING },
              num_liquidacao: { type: Type.STRING },
              dia: { type: Type.STRING },
              mes: { type: Type.STRING },
              ano: { type: Type.STRING }
            },
            required: ["num_processo", "num_nota_fiscal", "secretaria", "num_contrato", "tipo_pregao", "num_pregao", "num_aditivo", "num_apostilamento", "num_adesao", "valor", "credor", "cnpj", "objeto", "num_empenho", "num_liquidacao", "dia", "mes", "ano"]
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        const corrected = JSON.parse(responseText);
        if (corrected) {
          if (corrected.num_aditivo !== undefined) corrected.num_aditivo = cleanOptionalField(corrected.num_aditivo);
          if (corrected.num_apostilamento !== undefined) corrected.num_apostilamento = cleanOptionalField(corrected.num_apostilamento);
          if (corrected.num_adesao !== undefined) corrected.num_adesao = cleanOptionalField(corrected.num_adesao);
        }
        return res.json({ corrected });
      }
      return res.status(500).json({ error: 'Nenhuma resposta retornada do corretor.' });
    } catch (err) {
      console.error('Spellcheck backend error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Falha ao corrigir ortografia.' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
