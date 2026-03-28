'use client'

import { SessionProvider } from 'next-auth/react'
import ServiceWorkerRegistration from './ServiceWorkerRegistration'

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegistration />
      {children}
    </SessionProvider>
  )
}
