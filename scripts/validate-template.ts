
import fs from 'fs';
import PizZip from 'pizzip';

try {
  const content = fs.readFileSync('template.docx');
  const zip = new PizZip(content);
  console.log('Template.docx is a valid zip file. Central directory records found:', Object.keys(zip.files).length);
} catch (err) {
  console.error('Validation failed:', err);
  process.exit(1);
}
