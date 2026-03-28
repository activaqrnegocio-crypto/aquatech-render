const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'inventario.XLS');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- Headers ---');
console.log(JSON.stringify(data[0]));
console.log('\n--- Sample Data (Row 1) ---');
if (data[1]) console.log(JSON.stringify(data[1]));
console.log('\n--- Sample Data (Row 2) ---');
if (data[2]) console.log(JSON.stringify(data[2]));
console.log('\n--- Total Rows ---');
console.log(data.length);
