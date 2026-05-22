import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import WhatsAppClient from './WhatsAppClient'

export const dynamic = 'force-dynamic'

export default async function WhatsAppPage() {
  const session = await getServerSession(authOptions)
  
  // Strict role check: ONLY SUPERADMIN
  if (!session || (session.user as any).role !== 'SUPERADMIN') {
    redirect('/admin')
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">Conectar Telefono</h1>
        <p className="admin-description">
          Gestiona la vinculación de WhatsApp para el sistema de notificaciones y chat.
        </p>
      </div>
      
      <WhatsAppClient />
    </div>
  )
}
