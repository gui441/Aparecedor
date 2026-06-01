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
Sua tarefa é analisar a imagem fornecida (que pode ser uma Nota de Empenho, Nota de Liquidação, Nota Fiscal ou Recibo) e realizar duas tarefas fundamentais com precisão máxima:

1. Transcrever todo o texto visível na imagem de forma contínua e fiel, sem omissões (esta será a base do OCR).
2. Localizar, interpretar, extrair e CORRIGIR ortograficamente as seguintes informações cruciais sob um formato JSON estruturado:
- num_processo: Número do Processo Administrativo (ex: "1305/2025" ou "123/2026"). Geralmente no histórico ou próximo a termos como "Processo Administrativo", "Proc. Adm.".
- num_nota_fiscal: Número da Nota Fiscal (NF, NF-e, etc).
- secretaria: O NOME ESPECÍFICO da Secretaria, Órgão ou Unidade Orçamentária/Destinatária (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). ATENÇÃO CRÍTICA: Você deve IGNORAR e OMITIR inteiramente os prefixos "Secretaria Municipal de", "Secretaria de", "SEC DE", "SEC MUNICIPAL DE" e variantes semelhantes. Extraia apenas o nome próprio do órgão, corrigindo a ortografia/acentuação se houver falhas e aplicando padrão de Capitalização Adequada.
- num_contrato: Número do Contrato.
- num_pregao: Número do Pregão Eletrônico (PE).
- valor: O valor total ou valor liquidado do documento (formatado como "R$ X.XXX,XX").
- credor: Razão Social ou Nome do Credor (a empresa contratada). Corrija erros de grafia, padronizando palavras como "LTDA", "S/A", "ME" em maiúsculas profissionais, sem aspas ruidosas do OCR.
- cnpj: CNPJ do Credor.
- objeto: Descrição resumida do objeto, finalidade ou histórico da despesa (ex: aquisição de mantimentos, prestação de serviços, etc). ATENÇÃO CRÍTICA: Você deve IGNORAR, OMITIR ou REMOVER inteiramente do texto do objeto qualquer menção à Secretaria atendida/destinatária. Por exemplo, se o texto original for "Aquisição de combustíveis para atender as necessidades da Secretaria Municipal de Saúde", extraia e preencha APENAS "Aquisição de combustíveis", removendo o trecho residual de vinculação à secretaria. Corrija também a pontuação, exclua lixo de digitalização e corrija acentos (ex: prestacao -> prestação, aquisicao -> aquisição).
- num_empenho: Número da Nota de Empenho.
- num_liquidacao: Número da Nota de Liquidação.

Durante a extração, aplique automaticamente essa camada de correção e polimento ortográfico aos campos estruturados de forma silenciosa e limpa, garantindo preservação absoluta de valores reais e números de auditoria legalmente vinculantes.

Retorne obrigatoriamente um objeto JSON com as propriedades 'text' (a transcrição completa e limpa do OCR) e 'structured' (um objeto contendo exatamente as chaves listadas acima). Se um campo não estiver presente de forma alguma no documento, retorne "".`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
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
                      num_pregao: { type: Type.STRING },
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
            return res.json({
              text: parsed.text || '',
              structured: parsed.structured || {}
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
          doc.render({
            ...structured,
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
1. Grafia de Secretarias: Remova inteiramente os prefixos "Secretaria de", "Secretaria Municipal de", "SEC DE", "SEC MUNICIPAL DE" e semelhantes. Mantenha e preencha APENAS o nome próprio (ex: "Saúde", "Educação", "Planejamento, Orçamento e Gestão", "Assistência Social"). Ajuste para Capitalização Adequada.
2. Grafia de Credor (Empresa): Corrija a grafia de nomes próprios, palavras como "LTDA", "S/A", "ME", garantindo que estejam formatadas profissionalmente em maiúsculas se cabível, sem abreviações estranhas geradas pelo OCR.
3. Objeto do Parecer/Contrato: Corrija a concordância, pontuação, exclua lixo de digitalização ou caracteres avulsos. Complete termos truncados (ex: prestacao -> prestação, aquisicao -> aquisição). ATENÇÃO CRÍTICA: Você deve IGNORAR, OMITIR ou REMOVER inteiramente do texto do objeto qualquer menção à Secretaria atendida/destinatária (ex: de "Aquisição de combustíveis para atender as necessidades da Secretaria Municipal de Saúde", deixe APENAS "Aquisição de combustíveis").
4. Unidades e Números: Preserve integralmente quaisquer dígitos referentes a CPF, CNPJ, números de contratos, processos e empenhos. Conserte somente pontuações inadequadas neles, mantendo os dígitos exatos intactos.
5. Preservação Factual: Em hipótese alguma invente informações novas ou altere valores financeiros, pois são dados de auditoria legalmente vinculantes.

Abaixo estão os dados rascunhados em formato JSON:
${JSON.stringify(structured, null, 2)}

Retorne obrigatoriamente um objeto JSON com as mesmas propriedades revisadas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
              num_pregao: { type: Type.STRING },
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
            required: ["num_processo", "num_nota_fiscal", "secretaria", "num_contrato", "num_pregao", "valor", "credor", "cnpj", "objeto", "num_empenho", "num_liquidacao", "dia", "mes", "ano"]
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        const corrected = JSON.parse(responseText);
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
