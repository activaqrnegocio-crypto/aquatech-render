const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'inventario.XLS');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- Row 0 (Headers) ---');
console.log(data[0].map((h, i) => `${String.fromCharCode(65 + i)}: ${h}`).join(' | '));

console.log('\n--- Row 1 (Sample Data) ---');
console.log(data[1].map((v, i) => `${String.fromCharCode(65 + i)}: ${v}`).join(' | '));
