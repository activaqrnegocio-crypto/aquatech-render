const fs = require('fs');
const path = 'src/app/admin/proyectos/[id]/ProjectDetailClient.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
let hasImport = content.includes("ProjectChatUnified");
if (!hasImport) {
  content = content.replace(
    "import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'",
    "import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'\nimport ProjectChatUnified from '@/components/chat/ProjectChatUnified'"
  );
}

// 2. Add handleChatUnifiedSend (only if not present)
if (!content.includes("handleChatUnifiedSend")) {
  const handleChatUnifiedSendCode = `  // Handler for ProjectChatUnified component
  const handleChatUnifiedSend = async (content: string, type: string, extraData?: any) => {
    setIsSending(true)
    try {
      let payload: any = {
        content,
        phaseId: activePhase,
        type: type === 'EXPENSE_LOG' ? 'EXPENSE_LOG' : type === 'NOTE' ? 'NOTE' : 'TEXT',
        extraData: extraData
      }

      if (type === 'FILE' && extraData?.file) {
        const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
        const file = extraData.file as File
        const uploadResult = await uploadToBunnyClientSide(file, file.name, \`projects/\${project.id}/chat\`)
        payload.media = {
          url: uploadResult.url,
          filename: uploadResult.filename,
          mimeType: file.type
        }
        payload.type = file.type.startsWith('image') ? 'IMAGE' : file.type.startsWith('video') ? 'VIDEO' : file.type.startsWith('audio') ? 'AUDIO' : 'DOCUMENT'
      }

      const res = await fetch(\`/api/projects/\${project.id}/messages\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const newMessage = await res.json()
        setChatMessages((prev: any) => {
          const exists = prev.some((m: any) => m.id === newMessage.id)
          if (exists) return prev
          return [...prev, {
            ...newMessage,
            isMe: true,
            userName: session?.user?.name || 'Administrador'
          }]
        })
        router.refresh()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  // --- EXPENSE HANDLERS ---`;

  content = content.replace("  // --- EXPENSE HANDLERS ---", handleChatUnifiedSendCode);
}

// 3. Replace the entire BITACORA tab layout, including the padding on the parent "card"
// But this time we only replace the target section.
const bitacoraStart = content.indexOf("{/* Tab Content - Optimized with visibility display to avoid slow mounting */}");
const bitacoraEnd = content.indexOf("{/* 2. GALERÍA UNIFICADA */}");

if (bitacoraStart !== -1 && bitacoraEnd !== -1) {
  const replacement = `{/* Tab Content - Optimized with visibility display to avoid slow mounting */}
        <div className="card tab-content-card" style={{ 
          padding: activeTab === 'BITACORA' ? '0px' : '25px', 
          minHeight: '400px', 
          display: 'flex', 
          flexDirection: 'column',
          border: activeTab === 'BITACORA' ? 'none' : undefined,
          borderRadius: activeTab === 'BITACORA' ? '0px' : undefined,
          backgroundColor: activeTab === 'BITACORA' ? 'transparent' : undefined
        }}>
          
          {/* 1. BITÁCORA - CHAT UNIFICADO WHATSAPP */}
          <div 
            className="bitacora-tab-content"
            style={{ display: activeTab === 'BITACORA' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: '600px', overflow: 'hidden' }}>
            <ProjectChatUnified
              project={project}
              messages={chatMessages.map((m: any) => ({
                ...m,
                userName: m.user?.name || m.userName || 'Usuario',
                userId: m.user?.id || m.userId
              }))}
              userId={Number(session?.user?.id)}
              isOperatorView={false}
              activeRecord={null}
              backUrl="/admin/proyectos"
              onSendMessage={handleChatUnifiedSend}
            />
          </div>
          
          `;
  
  content = content.substring(0, bitacoraStart) + replacement + content.substring(bitacoraEnd);
}

// 4. Update the tab text
content = content.replace(
  "{ id: 'BITACORA', label: 'Bitácora', icon:",
  "{ id: 'BITACORA', label: 'Chat', icon:"
);

fs.writeFileSync(path, content, 'utf8');
