import { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, Header, ImageRun, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, TextWrappingSide, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import fs from 'fs';

async function createTemplate() {
  // Fetch generic or local "Timbrado" image
  let bgImage: Buffer | undefined;
  
  try {
    const localPath = 'public/timbrado.png';
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 0) {
        bgImage = fs.readFileSync(localPath);
        console.log('Using local timbrado.png, size:', stats.size);
      } else {
        console.warn('Local timbrado.png is empty, using fallback');
      }
    }
  } catch (err) {
    console.error('Failed to load local background image:', err);
  }

  if (!bgImage) {
    // Hardcoded lightweight transparent 1x1 PNG to avoid slow network fetches and potential sandbox timeouts
    bgImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    console.log('Using fast local fallback transparent PNG instead of remote fetch');
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 19, // 9.5pt (2 * 9.5 = 19 half-points)
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: {
              line: 360, // 1.5 line spacing (240 * 1.5)
              before: 0,
              after: 0,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: "DespachoPara",
          name: "Despacho Paragraph",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Times New Roman",
            size: 19, // 9.5pt
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 120 },
            indent: { firstLine: 652 }, // 1.15cm
          },
        },
        {
          id: "DespachoHeader",
          name: "Despacho Header No Indent",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Times New Roman",
            size: 19, // 9.5pt
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 60 },
            indent: { firstLine: 0 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 Width in twips
              height: 16838, // A4 Height in twips
            },
            margin: {
              top: 2551, // 4.5cm
              bottom: 1871, // 3.3cm
              left: 1440, // 2.54cm
              right: 1440, // 2.54cm
              header: 708,
              footer: 708,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              ...(bgImage ? [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: bgImage,
                      transformation: {
                        width: 794,
                        height: 1123,
                      },
                      floating: {
                        horizontalPosition: {
                          relative: HorizontalPositionRelativeFrom.PAGE,
                          offset: 0,
                        },
                        verticalPosition: {
                          relative: VerticalPositionRelativeFrom.PAGE,
                          offset: 0,
                        },
                        wrap: {
                          type: TextWrappingType.NONE,
                          side: TextWrappingSide.BOTH_SIDES,
                        },
                      },
                    } as any),
                  ],
                }),
              ] : []),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "DESPACHO",
                bold: true,
                font: "Times New Roman",
                size: 19, // 9.5pt
                color: "000000",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { line: 360, before: 0, after: 180 },
          }),

          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "Credor: ", bold: true }),
              new TextRun({ text: "{credor}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "CNPJ: ", bold: true }),
              new TextRun({ text: "{cnpj}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "Assunto: ", bold: true }),
              new TextRun({ text: "Análise do Processo Administrativo n.º ", bold: true }),
              new TextRun({ text: "{num_processo}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "Objeto: ", bold: true }),
              new TextRun({ text: "Pagamento da Nota Fiscal n.º ", bold: true }),
              new TextRun({ text: "{num_nota_fiscal}", bold: true }),
              new TextRun({ text: ", da Secretaria Municipal de ", bold: true }),
              new TextRun({ text: "{secretaria}", bold: true }),
              new TextRun({ text: " desta Municipalidade.", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "Contrato n.º ", bold: true }),
              new TextRun({ text: "{num_contrato}", bold: true }),
              new TextRun({ text: " – ", bold: true }),
              new TextRun({ text: "{tipo_pregao}", bold: true }),
              new TextRun({ text: " n.º ", bold: true }),
              new TextRun({ text: "{num_pregao}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "{#has_aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "{aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "{/has_aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "DespachoHeader",
            children: [
              new TextRun({ text: "Valor: ", bold: true }),
              new TextRun({ text: "R$ ", bold: true }),
              new TextRun({ text: "{valor}", bold: true }),
            ],
            spacing: { line: 360, after: 180 },
          }),

          new Paragraph({
            style: "DespachoHeader",
            children: [new TextRun({ text: "I - DA ANÁLISE DOS DOCUMENTOS ANEXADOS", bold: true })],
            spacing: { line: 360, before: 120, after: 120 },
          }),
          new Paragraph({
            style: "DespachoPara",
            text: "Verifica-se nos autos os documentos que embasaram o presente processo de pagamento, conforme segue:",
            spacing: { line: 360, after: 120 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ text: "01. Autorização de Pagamento;", spacing: { line: 360 } }),
                      new Paragraph({ text: "02. Solicitação de Pagamento;", spacing: { line: 360 } }),
                      new Paragraph({ text: "03. Cópia do Extrato do Contrato;", spacing: { line: 360 } }),
                      new Paragraph({ children: [new TextRun("04. Nota de Empenho n.º "), new TextRun({ text: "{num_empenho}", bold: true })], spacing: { line: 360 } }),
                      new Paragraph({ children: [new TextRun("05. Nota de Liquidação n.º "), new TextRun({ text: "{num_liquidacao}", bold: true })], spacing: { line: 360 } }),
                      new Paragraph({ children: [new TextRun("06. Nota Fiscal n.º "), new TextRun({ text: "{num_nota_fiscal}", bold: true }), new TextRun(", validada e atestada;")], spacing: { line: 360 } }),
                      new Paragraph({ text: "07. Ordem de Fornecimento;", spacing: { line: 360 } }),
                      new Paragraph({ text: "08. Certidão Positiva com Efeitos de Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União;", spacing: { line: 360 } }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ text: "09. Certidão Estadual Negativa de Débitos e da Dívida Ativa;", spacing: { line: 360 } }),
                      new Paragraph({ text: "10. Certidão Municipal Negativa de Débitos e da Dívida Ativa;", spacing: { line: 360 } }),
                      new Paragraph({ text: "11. Certidão de Regularidade do FGTS;", spacing: { line: 360 } }),
                      new Paragraph({ text: "12. Certidão Negativa de Débitos Trabalhistas;", spacing: { line: 360 } }),
                      new Paragraph({ text: "13. Comprovante Sinc;", spacing: { line: 360 } }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            style: "DespachoPara",
            text: "Após verificação de todos os documentos anexados ao presente processo de pagamento, conclui:",
            spacing: { line: 360, before: 140, after: 120 },
          }),

          new Paragraph({
            style: "DespachoHeader",
            children: [new TextRun({ text: "II– CONCLUSÃO", bold: true })],
            spacing: { line: 360, before: 120, after: 120 },
          }),
          new Paragraph({
            style: "DespachoPara",
            children: [
              new TextRun("Tendo em vista o exposto, levando em consideração a análise da fase de pagamento e considerando os dados extraídos dos autos em apreço, constata-se que os termos apresentados, cumprem parcialmente as exigências contidas legislação vigente, sobretudo a Lei n.º 4.320/64 e Lei n.º {lei_regencia}."),
            ],
          }),
          new Paragraph({
            style: "DespachoPara",
            children: [
              new TextRun("Ademais é imperioso destacarmos que será necessária a juntada de certidões atualizadas, quando estas na data do pagamento não estiverem vigentes, para que então posterior seja realizado o pagamento da presente despesa."),
            ],
          }),
          new Paragraph({
            style: "DespachoPara",
            children: [
              new TextRun("Encaminho os autos ao prosseguimento do feito. Assim devem cumprir as exigências da cláusula de pagamento do contrato e fiscalização."),
            ],
          }),

          new Paragraph({ 
            text: "Salvo o melhor Juízo.", 
            alignment: AlignmentType.LEFT,
            spacing: { line: 360, before: 0, after: 0 },
            indent: { firstLine: 652 },
            run: { font: "Times New Roman" }
          }),
          new Paragraph({ 
            text: "É o despacho.", 
            alignment: AlignmentType.LEFT, 
            spacing: { line: 360, before: 0, after: 0 },
            indent: { firstLine: 652 },
            run: { font: "Times New Roman", bold: true }
          }),

          new Paragraph({
            text: "Barra do Corda - MA, {dia} de {mes} de {ano}.",
            alignment: AlignmentType.RIGHT,
            spacing: { line: 360, before: 140, after: 280 },
            run: { font: "Times New Roman" }
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = 'public/template.docx';
  fs.writeFileSync(outputPath, buffer);
  console.log(`Template do Despacho criado com sucesso: ${outputPath}`);
}

createTemplate();

