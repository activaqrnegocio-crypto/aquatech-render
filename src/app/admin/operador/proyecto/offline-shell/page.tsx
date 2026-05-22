'use client'

import { usePathname } from 'next/navigation'
import ProjectExecutionClient from '@/components/ProjectExecutionClient'
import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

function OperatorOfflineShellContent() {
  const [idFromUrl, setIdFromUrl] = useState(0)
  const { data: session } = useSession()
  const userId = session?.user?.id ? Number(session.user.id) : 0

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const extractId = (): number => {
      const path = window.location.pathname;
      
      // 1. Extrae directamente del pathname (caso normal: /admin/operador/proyecto/1051)
      const match = path.match(/\/proyectos?\/(\d+)/i);
      if (match) return Number(match[1]);
      
      // 2. Fallback: último segmento si es número
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && /^\d+$/.test(last)) return Number(last);
      
      // 3. Fallback de emergencia: sessionStorage (cuando URL sí cambió a offline-shell)
      const stored = sessionStorage.getItem('last_op_project_id');
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
    <div className="pt-0 pl-0 pr-0 sm:pt-6 sm:pl-6 sm:pr-6">
      <ProjectExecutionClient 
        project={dummyProject as any}
        initialChat={[]}
        activeRecord={null}
        expenses={[]}
        userId={userId}
        clientName="Cargando..."
        projectAddress=""
        projectCity=""
        panelBase="/admin/operador"
      />
    </div>
  )
}

export default function OperatorOfflineShell() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando Shell de Operador...</div>}>
      <OperatorOfflineShellContent />
    </Suspense>
  )
}
