import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

import { GoogleGenAI, Type } from "@google/genai";

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

  // API Endpoint: OCR Extraction (Raw text only)
  app.post('/api/extract', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      }

      const worker = await createWorker('por');
      const { data: { text: rawText } } = await worker.recognize(req.file.buffer);
      await worker.terminate();

      if (!rawText || rawText.trim().length === 0) {
        return res.status(422).json({ error: 'Não foi possível extrair texto da imagem.' });
      }

      res.json({ text: rawText });
    } catch (error) {
      console.error('OCR Error:', error);
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

      const templatePath = path.join(process.cwd(), 'public', 'template.docx');
      
      if (fs.existsSync(templatePath)) {
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
