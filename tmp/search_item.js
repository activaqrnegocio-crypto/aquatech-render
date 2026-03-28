const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'inventario.XLS');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: "A" });

const targetName = "VALVULA TERMOFUSION 25MM M/ROJA LARGA BLUE OCEAN";
const item = data.find(row => String(row.C || '').includes("VALVULA TERMOFUSION 25MM"));

if (item) {
    console.log('Item found:');
    Object.keys(item).forEach(col => {
        console.log(`${col}: ${item[col]}`);
    });
} else {
    console.log('Item not found');
    console.log('First 5 items names:');
    data.slice(0, 6).forEach((row, i) => console.log(`${i}: ${row.C}`));
}
