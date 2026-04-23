import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API route that serves /custom-sw.js with correct headers.
 * The Next.js standalone server sometimes serves public/ files
 * with incorrect Content-Type, which breaks Service Worker registration.
 * This route guarantees correct MIME type and cache headers.
 */
export async function GET() {
  try {
    // In standalone mode, public files are at ./public/ relative to server.js
    const swPath = path.join(process.cwd(), 'public', 'custom-sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    
    return new NextResponse(swContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch (error) {
    console.error('[API/SW] Failed to read custom-sw.js:', error);
    return new NextResponse('// SW file not found', {
      status: 500,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}
