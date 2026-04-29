'use client'

import { usePathname } from 'next/navigation'
import ProjectDetailClient from '../[id]/ProjectDetailClient'
import { Suspense, useEffect, useState } from 'react'

function AdminOfflineShellContent() {
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
