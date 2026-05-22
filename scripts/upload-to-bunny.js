const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration from credentials provided
const BUNNY_STORAGE_ZONE = 'cesarweb';
const BUNNY_STORAGE_API_KEY = '90197f22-eb2d-4e71-8d5b3893666a-3c2c-44b4';
const BUNNY_STORAGE_HOST = 'br.storage.bunnycdn.com';
const ASSETS_DIR = path.join(__dirname, '..', 'tmp-assets');

async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);

  const options = {
    method: 'PUT',
    hostname: BUNNY_STORAGE_HOST,
    path: `/${BUNNY_STORAGE_ZONE}/home/${fileName}`,
    headers: {
      'AccessKey': BUNNY_STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileContent.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Uploaded: ${fileName}`);
          resolve(data);
        } else {
          console.error(`❌ Failed ${fileName}: ${res.statusCode} - ${data}`);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(fileContent);
    req.end();
  });
}

async function run() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.log('Error: tmp-assets directory not found.');
    return;
  }

  const files = fs.readdirSync(ASSETS_DIR).filter(f => !f.startsWith('.'));
  console.log(`Starting upload of ${files.length} files...`);

  for (const file of files) {
    try {
      await uploadFile(path.join(ASSETS_DIR, file));
    } catch (err) {
      // Continue with next file
    }
  }

  console.log('\n--- UPLOAD COMPLETE ---');
  console.log('Now you can use these links: https://cesarweb.b-cdn.net/FILENAME');
}

run();
