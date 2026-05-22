const fs = require('fs');
const path = require('path');
const https = require('https');

// Bunny.net Credentials (matching your .env)
const BUNNY_STORAGE_API_KEY = "90197f22-eb2d-4e71-8d5b3893666a-3c2c-44b4";
const BUNNY_STORAGE_HOST = "br.storage.bunnycdn.com";
const BUNNY_STORAGE_ZONE = "cesarweb";
const BUNNY_CDN_DOMAIN = "cesarweb.b-cdn.net";

// Target Folder with your required suffix
const TARGET_FOLDER = "Hidromasaje-Aquatech";

const sourceDir = path.join(__dirname, '..', 'tmp-assets');

async function uploadFile(fileName) {
  const filePath = path.join(sourceDir, fileName);
  if (!fs.existsSync(filePath)) return;

  const fileStream = fs.createReadStream(filePath);
  const cleanName = fileName.replace(/\.\.+/g, '.'); // Fixes cases like Hidromasajes..webp
  
  const options = {
    hostname: BUNNY_STORAGE_HOST,
    path: `/${BUNNY_STORAGE_ZONE}/${TARGET_FOLDER}/${cleanName}`,
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      if (res.statusCode === 201 || res.statusCode === 200) {
        console.log(`✅ Success: https://${BUNNY_CDN_DOMAIN}/${TARGET_FOLDER}/${cleanName}`);
        resolve();
      } else {
        console.log(`❌ Failed: ${fileName} (Status: ${res.statusCode})`);
        resolve();
      }
    });

    req.on('error', e => {
      console.error(`🚨 Error uploading ${fileName}:`, e);
      reject(e);
    });
    
    fileStream.pipe(req);
  });
}

async function run() {
  console.log(`🚀 Starting batch upload to Bunny.net [Folder: ${TARGET_FOLDER}]...`);
  
  if (!fs.existsSync(sourceDir)) {
    console.error("❌ Error: tmp-assets directory not found in root.");
    return;
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.webp'));
  
  for (const file of files) {
    await uploadFile(file);
  }
  
  console.log("\n✨ All assets processed!");
}

run();
