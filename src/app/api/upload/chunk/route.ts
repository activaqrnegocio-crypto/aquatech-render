import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// CRÍTICO: Desactivar el body parser de Next.js para permitir archivos grandes
// Nota: En Next.js App Router, config exportada no funciona igual que en Pages Router para bodyParser.
// Sin embargo, mantenemos la intención y usamos la configuración compatible.
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos máximo por request en VPS

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'chunks');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const filename = formData.get('filename') as string;

    if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Guardar chunk en disco temporal
    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(path.join(uploadDir, `chunk_${chunkIndex}`), chunkBuffer);

    // Si no es el último chunk, confirmar recepción
    if (chunkIndex < totalChunks - 1) {
      return NextResponse.json({ received: true, chunk: chunkIndex });
    }

    // Último chunk — ensamblar el archivo completo
    const allChunkFiles = [];
    for (let i = 0; i < totalChunks; i++) {
      allChunkFiles.push(path.join(uploadDir, `chunk_${i}`));
    }

    const buffers = await Promise.all(allChunkFiles.map(f => readFile(f)));
    const completeBuffer = Buffer.concat(buffers);

    // Subir el archivo completo a BunnyNet
    const storageZone = process.env.BUNNY_STORAGE_ZONE!;
    const accessKey = process.env.BUNNY_STORAGE_API_KEY!;
    const storageHost = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULLZONE_URL || process.env.BUNNY_PULL_ZONE_URL;

    const subfolder = formData.get('subfolder') as string || 'uploads';
    const mimeType = formData.get('mimeType') as string || 'application/octet-stream';
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const remotePath = `${subfolder}/${timestamp}-${safeName}`;

    const bunnyRes = await fetch(
      `https://${storageHost}/${storageZone}/${remotePath}`,
      {
        method: 'PUT',
        headers: {
          'AccessKey': accessKey,
          'Content-Type': mimeType,
        },
        body: completeBuffer,
      }
    );

    // Limpiar chunks temporales
    await Promise.all(allChunkFiles.map(f => unlink(f).catch(() => {})));
    await import('fs/promises').then(fs => fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {}));

    if (!bunnyRes.ok) {
      throw new Error(`BunnyNet upload failed: ${bunnyRes.status}`);
    }

    const publicUrl = `${pullZoneUrl}/${remotePath}`;
    return NextResponse.json({ url: publicUrl, success: true });

  } catch (error: any) {
    console.error('[API/upload/chunk] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
