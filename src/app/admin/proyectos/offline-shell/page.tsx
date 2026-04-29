'use client'

import { usePathname } from 'next/navigation'
import ProjectDetailClient from '../[id]/ProjectDetailClient'
import { Suspense, useEffect, useState } from 'react'

function AdminOfflineShellContent() {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ProjectDetailClient 
        project={dummyProject as any}
        users={[]}
        initialChat={[]}
        activeRecord={null}
      />
    </div>
  )
}

export default function AdminOfflineShell() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando Shell...</div>}>
      <AdminOfflineShellContent />
    </Suspense>
  )
}
