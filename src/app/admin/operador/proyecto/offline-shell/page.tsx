'use client'

import { usePathname } from 'next/navigation'
import ProjectExecutionClient from '@/components/ProjectExecutionClient'
import { Suspense, useEffect, useState } from 'react'

function OperatorOfflineShellContent() {
  const [idFromUrl, setIdFromUrl] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/\/proyecto[s]?\/(\d+)/i);
      if (match) {
        setIdFromUrl(Number(match[1]))
      } else {
        // Fallback: check if the last segment is a number
        const segments = path.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        if (last && /^\d+$/.test(last)) setIdFromUrl(Number(last));
      }
    }
  }, [])

  const dummyProject = {
    id: idFromUrl,
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
        userId={0}
        clientName="Cargando..."
        projectAddress=""
        projectCity=""
        panelBase="/admin/operador"
        isOfflineShell={true} 
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
