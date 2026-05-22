const fs = require('fs');
const path = require('path');
const https = require('https');

const BUNNY_STORAGE_API_KEY = "90197f22-eb2d-4e71-8d5b3893666a-3c2c-44b4";
const BUNNY_STORAGE_HOST = "br.storage.bunnycdn.com";
const BUNNY_STORAGE_ZONE = "cesarweb";

const filesToUpload = [
  "Accesorios.webp",
  "AguaPotable..webp",
  "Detalle_Ingenieria.webp",
  "Equipo_Trabajo.webp",
  "Hidromasajes..webp",
  "Matriz_Frente.webp",
  "Piletas.webp",
  "Riego.webp",
  "Saunas.webp",
  "Showroom_Interior.webp",
  "Tuberias.webp",
  "Turcos.webp",
];

async function uploadFile(fileName) {
  const filePath = path.join(__dirname, 'tmp-assets', fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File missing: ${fileName}`);
    return;
  }
  const fileStream = fs.createReadStream(filePath);
  
  // To keep URLs clean, let's fix double dots
  const cleanName = fileName.replace('..webp', '.webp').toLowerCase();
  
  const options = {
    hostname: BUNNY_STORAGE_HOST,
    path: `/${BUNNY_STORAGE_ZONE}/home/${cleanName}`,
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let output = '';
      res.on('data', d => { output += d; });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log(`Uploaded: https://cesarweb.b-cdn.net/home/${cleanName}`);
          resolve();
        } else {
          console.log(`Failed. Status: ${res.statusCode}, Resp: ${output}`);
          resolve();
        }
      });
    });

    req.on('error', e => reject(e));
    fileStream.pipe(req);
  });
}

async function run() {
  for (const file of filesToUpload) {
    await uploadFile(file);
  }
}

run();
