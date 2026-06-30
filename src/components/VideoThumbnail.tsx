'use client'

import { useRef, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface Props {
  url: string
  mime: string
  filename: string
}

export default function VideoThumbnail({ url, mime, filename, file }: { url: string; mime: string; filename: string; file?: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    let observer: IntersectionObserver | null = null;
    let video: HTMLVideoElement | null = null;
    let objectUrl = '';

    const startGeneration = () => {
      const rawFile = file?.file || file;
      let srcToUse = url;

      if (rawFile instanceof File || rawFile instanceof Blob) {
        objectUrl = URL.createObjectURL(rawFile);
        srcToUse = objectUrl;
      } else if (Capacitor.isNativePlatform() && srcToUse && srcToUse.startsWith('file://')) {
        srcToUse = Capacitor.convertFileSrc(srcToUse);
      }
      setSrc(srcToUse);

      video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = srcToUse;

      video.onloadedmetadata = () => {
        if (video) {
          video.currentTime = Math.min(1, video.duration / 2);
        }
      };

      video.onseeked = () => {
        try {
          if (canvasRef.current && video && isMounted) {
            canvasRef.current.width = video.videoWidth || 160;
            canvasRef.current.height = video.videoHeight || 120;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
              setLoaded(true);
            }
          }
        } catch (e) {}
        if (video) {
          video.remove();
          video = null;
        }
      };

      video.onerror = () => {
        if (video) {
          video.remove();
          video = null;
        }
      };
    };

    // IntersectionObserver para retrasar la creación del decodificador de video
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && containerRef.current) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startGeneration();
            if (observer) {
              observer.disconnect();
              observer = null;
            }
          }
        });
      }, { rootMargin: '100px' }); // Cargar un poco antes de que aparezca en pantalla
      observer.observe(containerRef.current);
    } else {
      // Fallback si no hay soporte para IntersectionObserver
      startGeneration();
    }

    return () => {
      isMounted = false;
      if (observer) {
        observer.disconnect();
      }
      if (video) {
        video.remove();
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url, file]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
      {loaded ? (
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        src && <video src={`${src}#t=0.5`} preload="metadata" muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', display: 'flex', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>{filename}</div>
    </div>
  );
}
