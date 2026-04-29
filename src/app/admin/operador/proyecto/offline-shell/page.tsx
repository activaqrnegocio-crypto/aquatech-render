'use client'

import { usePathname } from 'next/navigation'
import ProjectExecutionClient from '@/components/ProjectExecutionClient'
import { Suspense, useEffect, useState } from 'react'

function OperatorOfflineShellContent() {
  const [idFromUrl, setIdFromUrl] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      const parsedId = Number(path.split('/').pop())
      if (parsedId && !isNaN(parsedId)) {
        setIdFromUrl(parsedId)
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
