const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'inventario.XLS');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Use row 0 to determine max column
const range = XLSX.utils.decode_range(worksheet['!ref']);

const targetName = "VALVULA TERMOFUSION 25MM";
const data = XLSX.utils.sheet_to_json(worksheet, { header: "A" });
const item = data.find(row => String(row.C || '').includes(targetName));

if (item) {
    console.log('--- FOUND ITEM ---');
    console.log(`Name (C): ${item.C}`);
    
    // Print A to Z, then AA to AZ, then BA to BP
    const cols = [];
    for(let i=0; i<=70; i++) {
        const colLetter = XLSX.utils.encode_col(i);
        cols.push(`${colLetter}: ${item[colLetter] || 'EMPTY'}`);
    }
    console.log(cols.join(' | '));
} else {
    console.log('Item not found');
}
