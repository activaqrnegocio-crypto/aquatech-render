// src/lib/sync-processor.ts
// Procesa cada item del outbox y lo envía al endpoint API correspondiente

export interface OutboxItem {
  id: string;
  type: string;
  payload: any;
  syncId: string;
  createdAt: string;
}

export async function processOutboxItem(item: OutboxItem, token: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = typeof window !== 'undefined' 
    ? (window as any).__NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    return { success: false, error: 'NEXT_PUBLIC_API_URL not configured' };
  }

  const headers: any = {
    'Content-Type': 'application/json',
    'x-sync-id': item.syncId,
  };

  // Only set Cookie header manually if token is a valid NextAuth session token (long string).
  // Otherwise, omit it so standard WebView credentials/cookies are sent automatically.
  if (token && token.length > 20) {
    headers['Cookie'] = `next-auth.session-token=${token}`;
  }

  try {
    switch (item.type) {
      case 'MESSAGE':
        return handleMessage(item, baseUrl, headers);
      
      case 'EXPENSE':
        return handleExpense(item, baseUrl, headers);
      
      case 'EXPENSE_DELETE':
        return handleExpenseDelete(item, baseUrl, headers);
      
      case 'DAY_START':
      case 'DAY_END':
        return handleDayRecord(item, baseUrl, headers);
      
      case 'PHASE_COMPLETE':
        return handlePhaseComplete(item, baseUrl, headers);
      
      case 'PHASE_UPDATE':
        return handlePhaseUpdate(item, baseUrl, headers);
      
      case 'PHASE_CREATE':
        return handlePhaseCreate(item, baseUrl, headers);
      
      case 'TEAM_UPDATE':
        return handleTeamUpdate(item, baseUrl, headers);
      
      case 'MEDIA_UPLOAD':
        return handleMediaUpload(item, baseUrl, headers);
      
      case 'GALLERY_UPLOAD':
        return handleGalleryUpload(item, baseUrl, headers);
      
      case 'GALLERY_DELETE':
        return handleGalleryDelete(item, baseUrl, headers);
      
      case 'QUOTE':
        return handleQuote(item, baseUrl, headers);
      
      case 'MATERIAL':
        return handleMaterial(item, baseUrl, headers);
      
      case 'PROJECT':
        return handleProject(item, baseUrl, headers);
      
      case 'PROJECT_UPDATE':
        return handleProjectUpdate(item, baseUrl, headers);
      
      default:
        return { success: false, error: `Tipo de outbox desconocido: ${item.type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

// ============================================
// HANDLERS POR TIPO
// ============================================

async function handleMessage(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, ...msgPayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(msgPayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MESSAGE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleExpense(item: OutboxItem, baseUrl: string, headers: any) {
  const res = await fetch(`${baseUrl}/api/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item.payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EXPENSE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleExpenseDelete(item: OutboxItem, baseUrl: string, headers: any) {
  const { id } = item.payload;
  const res = await fetch(`${baseUrl}/api/expenses/${id}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`EXPENSE_DELETE failed: ${res.status} - ${text}`);
  }
  return { success: true }; // 404 is OK (already deleted)
}

async function handleDayRecord(item: OutboxItem, baseUrl: string, headers: any) {
  const method = item.type === 'DAY_START' ? 'POST' : 'PUT';
  const res = await fetch(`${baseUrl}/api/day-records`, {
    method,
    headers,
    body: JSON.stringify(item.payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${item.type} failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handlePhaseComplete(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, phaseId, ...phasePayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/phases/${phaseId}/complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(phasePayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PHASE_COMPLETE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handlePhaseUpdate(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, phaseId, ...phasePayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/phases/${phaseId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(phasePayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PHASE_UPDATE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handlePhaseCreate(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, ...phasePayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/phases`, {
    method: 'POST',
    headers,
    body: JSON.stringify(phasePayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PHASE_CREATE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleTeamUpdate(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, ...teamPayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/team`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(teamPayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TEAM_UPDATE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleMediaUpload(item: OutboxItem, baseUrl: string, headers: any) {
  // MEDIA_UPLOAD es un caso especial: puede ser multipart/form-data
  // Por ahora rechazamos - requiere lógica diferente
  return { success: false, error: 'MEDIA_UPLOAD: Subida de archivos no soportada en background sync' };
}

async function handleGalleryUpload(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, ...galleryPayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/gallery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(galleryPayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GALLERY_UPLOAD failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleGalleryDelete(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, galleryId } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/gallery/${galleryId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`GALLERY_DELETE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleQuote(item: OutboxItem, baseUrl: string, headers: any) {
  const res = await fetch(`${baseUrl}/api/quotes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item.payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QUOTE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleMaterial(item: OutboxItem, baseUrl: string, headers: any) {
  const res = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item.payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MATERIAL failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleProject(item: OutboxItem, baseUrl: string, headers: any) {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item.payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PROJECT failed: ${res.status} - ${text}`);
  }
  return { success: true };
}

async function handleProjectUpdate(item: OutboxItem, baseUrl: string, headers: any) {
  const { projectId, ...projectPayload } = item.payload;
  const res = await fetch(`${baseUrl}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(projectPayload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PROJECT_UPDATE failed: ${res.status} - ${text}`);
  }
  return { success: true };
}
