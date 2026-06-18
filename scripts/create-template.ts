import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Footer, Header, ImageRun, HorizontalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionRelativeFrom, VerticalPositionAlign, TextWrappingType, TextWrappingSide } from 'docx';
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
            size: 20, // 10pt (2 * size = half-points)
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: {
              line: 360, // 1.5 spacing
              before: 0,
              after: 0,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: "ParecerPara",
          name: "Parecer Paragraph",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Times New Roman",
            size: 20, // 10pt
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360 },
            indent: { firstLine: 708 }, // 1.25cm
          },
        },
        {
          id: "ParecerHeader",
          name: "Parecer Header No Indent",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Times New Roman",
            size: 20,
            color: "000000",
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360 },
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
              bottom: 1984, // 3.5cm
              left: 1440, // 2.54cm
              right: 1440, // 2.54cm
              header: 708, // 1.25cm from edge
              footer: 708, // 1.25cm from edge
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
                        width: 794, // Standard A4 width at 96 DPI (integer)
                        height: 1123, // Standard A4 height at 96 DPI (integer)
                      },
                      floating: {
                        horizontalPosition: {
                          relative: HorizontalPositionRelativeFrom.PAGE,
                          offset: 0, // Absolute top-left corner
                        },
                        verticalPosition: {
                          relative: VerticalPositionRelativeFrom.PAGE,
                          offset: 0, // Absolute top-left corner
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
            children: [], // Empty since the timbrado image already has a footer
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "PARECER DO CONTROLE INTERNO MUNICIPAL",
                bold: true,
                font: "Times New Roman",
                size: 20,
                color: "000000",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { line: 360, before: 0, after: 240 },
          }),

          new Paragraph({
            style: "ParecerHeader",
            children: [
              new TextRun({ text: "Assunto: ", bold: true }),
              new TextRun({ text: "Análise do Processo Administrativo n.º ", bold: true }),
              new TextRun({ text: "{num_processo}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "ParecerHeader",
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
            style: "ParecerHeader",
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
            style: "ParecerHeader",
            children: [
              new TextRun({ text: "{#has_aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "ParecerHeader",
            children: [
              new TextRun({ text: "{aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "ParecerHeader",
            children: [
              new TextRun({ text: "{/has_aditivos_line}", bold: true }),
            ],
          }),
          new Paragraph({
            style: "ParecerHeader",
            children: [
              new TextRun({ text: "Valor: ", bold: true }),
              new TextRun({ text: "R$ ", bold: true }),
              new TextRun({ text: "{valor}", bold: true }),
            ],
            spacing: { line: 360, after: 360 },
          }),

          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("O Órgão de Controle Interno da Prefeitura Municipal de Barra do Corda – MA, atendendo o previsto nos Artigos 31 e 74 da Constituição Federal, Artigo 59 da Lei Complementar n.º 101, de 04 de maio de 2000, e demais normas que regulam as atribuições do Sistema de Controle Interno, referentes ao exercício de controle prévio e concomitante dos atos de gestão para análise quanto à legalidade e verificação das demais formalidades, no que tange ao Processo Administrativo, encaminhado pela Secretaria Municipal de "),
              new TextRun("{secretaria}"),
              new TextRun(", referente à solicitação de pagamento das despesas constantes da Nota Fiscal n.º "),
              new TextRun({ text: "{num_nota_fiscal}", bold: true }),
              new TextRun(", em favor da empresa nacional "),
              new TextRun({ text: "{credor}", bold: true }),
              new TextRun({ text: ", portadora do CNPJ ", bold: true }),
              new TextRun({ text: "{cnpj}", bold: true }),
              new TextRun("."),
            ],
          }),

          new Paragraph({
            style: "ParecerPara",
            children: [new TextRun({ text: "I - RELATÓRIO", bold: true })],
            spacing: { line: 360, before: 360, after: 360 },
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("Veio ao conhecimento desta Controladoria Geral do Município de Barra Do Corda/MA, o Processo de Pagamento referente a Nota Fiscal de n.º "),
              new TextRun({ text: "{num_nota_fiscal}", bold: true }),
              new TextRun(", que tem como credor a empresa "),
              new TextRun({ text: "{credor}", bold: true }),
              new TextRun({ text: ", portadora do CNPJ ", bold: true }),
              new TextRun({ text: "{cnpj}", bold: true }),
              new TextRun(", contrato que tem como objeto contratação de empresa para "),
              new TextRun("{objeto}"),
              new TextRun(", para satisfazer as necessidades da Secretaria de "),
              new TextRun("{secretaria}"),
              new TextRun(" do município de Barra do Corda - MA, para análise quanto a legalidade e verificação das demais formalidades, a fim de executar o respectivo pagamento."),
            ],
          }),

          new Paragraph({
            style: "ParecerPara",
            children: [new TextRun({ text: "II - DA ANÁLISE DOS DOCUMENTOS ANEXADOS", bold: true })],
            spacing: { line: 360, before: 360, after: 360 },
          }),
          new Paragraph({
            style: "ParecerPara",
            text: "Verifica-se nos autos os documentos que embasaram o presente processo de pagamento, conforme segue:",
            spacing: { line: 360, after: 360 },
          }),
          ...[
            "01. Autorização de Pagamento;",
            "02. Solicitação de Pagamento;",
            "03. Cópia do Extrato do Contrato;",
            "04. Comprovante de Publicação;",
            "05. Nota de Empenho n.º {num_empenho}",
            "06. Nota de Liquidação n.º {num_liquidacao};",
            "07. Nota Fiscal n.º {num_nota_fiscal}, validada e atestada;",
            "08. Ordem de Fornecimento;",
            "09. Certidão Positiva com Efeitos de Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União;",
            "10. Certidão Negativa de Débitos Trabalhistas;",
            "11. Certidão Negativa de Débitos Estadual;",
            "12. Certidão Negativa de Dívida Ativa Estadual;",
            "13. Certidão Negativa de Débitos Municipais;",
            "14. Certidão Negativa de Dívida Ativa Municipal;",
            "15. Certidão de Regularidade do FGTS;",
            "16. Comprovante Sinc;",
          ].map(text => new Paragraph({ 
            text, 
            indent: { left: 0 },
            run: { font: "Times New Roman", size: 20, color: "000000" },
            spacing: { line: 360 }
          })),

          new Paragraph({
            style: "ParecerPara",
            text: "Após verificação de todos os documentos anexados ao presente processo de pagamento, esta Controladoria Geral do Município de Barra do Corda/MA, conclui:",
            spacing: { line: 360, before: 360, after: 360 },
          }),

          new Paragraph({
            style: "ParecerPara",
            children: [new TextRun({ text: "III - CONCLUSÃO", bold: true })],
            spacing: { line: 360, after: 360 },
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("Tendo em vista o exposto, levando em consideração a análise da fase de pagamento e considerando os dados extraídos dos autos em apreço, constata-se que os termos apresentados, cumprem parcialmente as exigências contidas legislação vigente, sobretudo a Lei n.º 4.320/64 e Lei n.º {lei_regencia}."),
            ],
          }),

          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("{#is_lei_8666}"),
            ],
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("É importante ressaltarmos que o contrato deste processo é regido pela Lei n.º 8.666/93, tendo em vista que o contrato do presente foi assinado anterior a vigência da Lei n.º 14.133/21, estando assim em conformidade com o artigo 190 da presente lei vigente."),
            ],
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("{/is_lei_8666}"),
            ],
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("Nesse sentido, esta Controladoria emite parecer pela APROVAÇÃO CONDICIONADA do pagamento em apreço, baseada na comprovação da regularidade fiscal e ateste do fiscal de contrato."),
            ],
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("Ademais é imperioso destacarmos que será necessária a juntada de certidões atualizadas, quando estas na data do pagamento não estiverem vigentes, para que então posterior seja realizado o pagamento da presente despesa."),
            ],
          }),
          new Paragraph({
            style: "ParecerPara",
            children: [
              new TextRun("Encaminho os autos ao prosseguimento do feito. Assim devem cumprir as exigências da cláusula de pagamento do contrato e fiscalização."),
            ],
          }),

          new Paragraph({ 
            text: "Salvo o melhor Juízo.", 
            alignment: AlignmentType.LEFT,
            spacing: { line: 360, before: 0, after: 0 },
            indent: { firstLine: 708 },
            run: { font: "Times New Roman" }
          }),
          new Paragraph({ 
            text: "É o parecer.", 
            alignment: AlignmentType.LEFT, 
            spacing: { line: 360, before: 0, after: 0 },
            indent: { firstLine: 708 },
            run: { font: "Times New Roman" }
          }),

          new Paragraph({
            text: "Barra do Corda - MA, {dia} de {mes} de {ano}.",
            alignment: AlignmentType.RIGHT,
            spacing: { line: 360, before: 360, after: 360 },
            run: { font: "Times New Roman" }
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 360 },
            children: [
              new TextRun({ text: "ANDERSON PEREIRA GOMES", bold: true, font: "Times New Roman" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 360 },
            children: [
              new TextRun({ text: "CONTROLADOR GERAL INTERINO DO MUNICÍPIO", bold: true, font: "Times New Roman" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 360 },
            children: [
              new TextRun({ text: "Portaria N.º 203/2025", bold: true, font: "Times New Roman" }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = 'public/template.docx';
  fs.writeFileSync(outputPath, buffer);
  console.log(`Template do Parecer criado com sucesso: ${outputPath}`);
}

createTemplate();
