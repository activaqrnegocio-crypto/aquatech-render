'use client'

import { usePathname } from 'next/navigation'
import ProjectDetailClient from '../[id]/ProjectDetailClient'
import { Suspense, useEffect, useState } from 'react'

function AdminOfflineShellContent() {
  const [idFromUrl, setIdFromUrl] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const extractId = (): number => {
      const path = window.location.pathname;
      
      // 1. Extrae directamente del pathname (caso normal: /admin/proyectos/1051)
      const match = path.match(/\/proyectos?\/(\d+)/i);
      if (match) return Number(match[1]);
      
      // 2. Fallback: último segmento si es número
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && /^\d+$/.test(last)) return Number(last);
      
      // 3. Fallback de emergencia: sessionStorage (cuando URL sí cambió a offline-shell)
      const stored = sessionStorage.getItem('last_admin_project_id');
      if (stored && /^\d+$/.test(stored)) return Number(stored);
      
      return 0;
    };

    setIdFromUrl(extractId());
  }, []);

  const dummyProject = {
    id: idFromUrl,
    isSkeleton: true,
    title: 'Cargando Proyecto Offline...',
    status: '',
    type: '',
    subtype: '',
    phases: [],
    team: [],
    budgetItems: [],
    gallery: []
  }

  return (
    <ProjectDetailClient 
      project={dummyProject as any}
      availableOperators={[]}
    />
  )
}

export default function AdminOfflineShell() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando Shell...</div>}>
      <AdminOfflineShellContent />
    </Suspense>
  )
}
