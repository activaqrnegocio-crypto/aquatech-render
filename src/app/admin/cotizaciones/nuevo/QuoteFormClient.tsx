'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MediaCapture from '@/components/MediaCapture'
import BudgetBuilder, { BudgetItem } from '@/components/BudgetBuilder'
import { generateProfessionalPDF } from '@/lib/pdf-generator'
import { useSession } from 'next-auth/react'

interface QuoteFormProps {
  clients: any[]
  materials: any[]
  projects?: any[]
  prefetchedProject?: any
  initialQuote?: any
}

import { useLocalStorage } from '@/hooks/useLocalStorage'

export default function QuoteFormClient({ clients, materials, projects = [], prefetchedProject, initialQuote }: QuoteFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [clientData, setClientData] = useLocalStorage('quote_draft_client', {
    name: initialQuote?.clientName || '',
    ruc: initialQuote?.clientRuc || '',
    address: initialQuote?.clientAddress || '',
    phone: initialQuote?.clientPhone || '',
    attention: initialQuote?.clientAttention || ''
  })

  const [notes, setNotes] = useLocalStorage('quote_draft_notes', initialQuote?.notes || '')
  
  // Format target date for <input type="date">
  const initialDate = initialQuote?.validUntil ? new Date(initialQuote.validUntil).toISOString().split('T')[0] : '';
  const [validUntil, setValidUntil] = useLocalStorage('quote_draft_date', initialDate)
  
  const initialItems = useMemo(() => {
    if (initialQuote?.items) {
      return initialQuote.items.map((item: any) => ({
        materialId: item.materialId,
        name: item.description || '',
        quantity: Number(item.quantity || 1),
        estimatedCost: Number(item.unitPrice || 0),
        isTaxed: item.isTaxed ?? true,
        discountPct: Number(item.discountPct || 0),
        unit: item.material?.unit || 'UND',
        code: item.material?.code || 'ESP'
      }))
    }
    if (prefetchedProject?.budgetItems) {
      return prefetchedProject.budgetItems.map((item: any) => ({
        materialId: item.materialId,
        name: item.name || '',
        quantity: Number(item.quantity || 1),
        estimatedCost: Number(item.estimatedCost || 0),
        isTaxed: true,
        discountPct: 0,
        unit: item.unit || 'UND',
        code: item.material?.code || 'ESP'
      }))
    }
    return []
  }, [initialQuote, prefetchedProject])

  const [items, setItems, removeItems] = useLocalStorage<BudgetItem[]>('quote_draft_items', initialItems)

  // CRITICAL FIX: If we have an initialQuote (EDIT MODE), we MUST override the localStorage drafts 
  // with the database values to ensure the user is editing the correct data.
  useEffect(() => {
    if (initialQuote) {
      setClientData({
        name: initialQuote.clientName || '',
        ruc: initialQuote.clientRuc || '',
        address: initialQuote.clientAddress || '',
        phone: initialQuote.clientPhone || '',
        attention: initialQuote.clientAttention || ''
      });
      setNotes(initialQuote.notes || '');
      setValidUntil(initialQuote.validUntil ? new Date(initialQuote.validUntil).toISOString().split('T')[0] : '');
      
      // Load optional fields in edit mode
      setOptionalTitle(initialQuote.optionalTitle || '');
      setOptionalDescription(initialQuote.optionalDescription || '');
      setOptionalImageBase64(initialQuote.optionalImage || '');
      setOptionalImage2Base64(initialQuote.optionalImage2 || '');

      if (initialQuote.items) {
        setItems(initialQuote.items.map((item: any) => ({
          materialId: item.materialId,
          name: item.description || '',
          quantity: Number(item.quantity || 1),
          estimatedCost: Number(item.unitPrice || 0),
          isTaxed: item.isTaxed ?? true,
          discountPct: Number(item.discountPct || 0),
          unit: item.material?.unit || 'UND',
          code: item.material?.code || 'ESP'
        })));
      }
    }
  }, [initialQuote]); 

  const [_, __, removeClientData] = useLocalStorage('quote_draft_client', { name: '', ruc: '', address: '', phone: '', attention: '' }) 
  const [___, ____, removeNotes] = useLocalStorage('quote_draft_notes', '')
  const [_____, ______, removeDate] = useLocalStorage('quote_draft_date', '')

  const [calculations, setCalculations] = useState({
    subtotal0: 0,
    subtotal15: 0,
    totalBudget: 0,
    discountTotal: 0,
    ivaAmount: 0,
    grandTotal: 0,
    processed: [] as any[]
  })

  // Restore client states
  const getInitialMode = () => {
    if (initialQuote?.clientName === 'CONSUMIDOR FINAL') return 'CF';
    if (initialQuote?.clientId) return 'EXISTING';
    if (initialQuote) return 'NEW';
    return 'NEW';
  }

  const [clientMode, setClientMode] = useState<'EXISTING' | 'NEW' | 'CF'>(
    initialQuote ? getInitialMode() : (prefetchedProject?.clientId ? 'EXISTING' : 'NEW')
  )
  const [selectedClientId, setSelectedClientId] = useState(initialQuote?.clientId || prefetchedProject?.clientId || '')
  
  // Project selection state
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>(initialQuote?.projectId || prefetchedProject?.id || '')
  const [bitacoraMessage, setBitacoraMessage] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)

  const [isFirstRender, setIsFirstRender] = useState(true)

  // Optional Section State
  const [optionalTitle, setOptionalTitle] = useState('')
  const [optionalDescription, setOptionalDescription] = useState('')
  const [optionalImageBase64, setOptionalImageBase64] = useState('')
  const [optionalImage2Base64, setOptionalImage2Base64] = useState('')

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, imageNum: 1 | 2) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (imageNum === 1) setOptionalImageBase64(reader.result as string)
        else setOptionalImage2Base64(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Auto-close project dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter projects with intelligent search
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects.slice(0, 10)
    const terms = projectSearch.toLowerCase().split(/\s+/).filter(Boolean)
    return projects.filter(p => {
      const targetText = `${p.title || ''} ${p.client?.name || ''} ${p.id}`.toLowerCase()
      return terms.every(term => targetText.includes(term))
    }).slice(0, 50)
  }, [projectSearch, projects])

  const selectedProjectTitle = useMemo(() => {
    if (!selectedProjectId) return ''
    const p = projects.find(proj => proj.id === Number(selectedProjectId))
    return p ? p.title : ''
  }, [selectedProjectId, projects])

  // Auto-fill client data when selection changes
  useEffect(() => {
    if (isFirstRender && initialQuote) {
      setIsFirstRender(false)
      return
    }

    if (clientMode === 'CF') {
      setSelectedClientId('')
      setClientData({
        name: 'CONSUMIDOR FINAL',
        ruc: '0000000000000',
        address: '000',
        phone: '000',
        attention: '000'
      })
    } else if (clientMode === 'NEW') {
      setSelectedClientId('')
      setClientData({
        name: '',
        ruc: '',
        address: '',
        phone: '',
        attention: ''
      })
    } else if (selectedClientId && clientMode === 'EXISTING') {
      const client = clients.find((c: any) => c.id === Number(selectedClientId))
      if (client) {
        setClientData({
          name: client.name || '',
          ruc: client.ruc || '',
          address: client.address || '',
          phone: client.phone || '',
          attention: ''
        })
      }
    }
    
    if (isFirstRender) setIsFirstRender(false)
  }, [clientMode, selectedClientId, clients, initialQuote, isFirstRender])

  const handleBudgetChange = useCallback((newItems: BudgetItem[], newCalculations: typeof calculations) => {
    setItems(newItems)
    setCalculations(newCalculations)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (clientMode === 'EXISTING' && !selectedClientId) return alert("Selecciona un cliente existente")
    if ((clientMode === 'NEW' || clientMode === 'CF') && !clientData.name) return alert("Ingrese el nombre del cliente")
    if (items.length === 0) return alert("Agrega al menos un item")

    const payload = {
      clientId: selectedClientId ? Number(selectedClientId) : null,
      sendToBitacoraId: selectedProjectId ? Number(selectedProjectId) : null,
      ...calculations,
      totalAmount: calculations.grandTotal,
      ...clientData,
      clientName: clientMode === 'CF' ? 'CONSUMIDOR FINAL' : clientData.name,
      clientRuc: clientMode === 'CF' ? '9999999999999' : clientData.ruc,
      clientAddress: clientData.address,
      clientPhone: clientData.phone,
      clientAttention: clientData.attention,
      notes,
      validUntil,
      items: calculations.processed.map((p: any) => ({
         ...p,
         unitPrice: p.estimatedCost, 
         description: p.name,
         total: p.lineTotal,
         discountPct: p.discountPct || 0
      })),
      optionalTitle,
      optionalDescription,
      optionalImage: optionalImageBase64,
      optionalImage2: optionalImage2Base64
    }

    setLoading(true)

    // Prepare PDF for Chat if project selected
    let bitacoraData = {}
    if (selectedProjectId && navigator.onLine) {
      try {
        const clientInfo = {
          name: payload.clientName,
          ruc: payload.clientRuc,
          address: payload.clientAddress,
          phone: payload.clientPhone,
          date: new Date()
        }
        
        const pdfTotals = {
          subtotal: Number(calculations.totalBudget || 0),
          subtotal0: Number(calculations.subtotal0 || 0),
          subtotal15: Number(calculations.subtotal15 || 0),
          discountTotal: Number(calculations.discountTotal || 0),
          ivaAmount: Number(calculations.ivaAmount || 0),
          totalAmount: Number(calculations.grandTotal || 0)
        }

        const doc = generateProfessionalPDF(clientInfo, payload.items, pdfTotals, {
          docType: 'COTIZACIÓN',
          docId: initialQuote?.id || 'TEMP',
          notes: payload.notes,
          sellerName: session?.user?.name || 'Aquatech',
          action: 'instance',
          optionalSection: {
            title: optionalTitle,
            description: optionalDescription,
            imageBase64: optionalImageBase64,
            image2Base64: optionalImage2Base64
          }
        })
        
        bitacoraData = {
          bitacoraMessage,
          pdfBase64: (doc as any).output('datauristring').split(',')[1],
          filename: `Cotizacion_Nueva_${payload.clientName.replace(/\s+/g, '_')}.pdf`
        }
      } catch (e) {
        console.error("Error generating PDF for chat:", e)
      }
    }

    const finalPayload = { ...payload, ...bitacoraData }

    // Offline interceptor
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
       try {
          const { db } = await import('@/lib/db')
          const tempId = Date.now()
          const actualId = await db.outbox.add({
             type: 'QUOTE',
             projectId: Number(selectedProjectId) || 0,
             payload,
             timestamp: tempId,
             status: 'pending'
          })
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
              const swReg = await navigator.serviceWorker.ready
              // @ts-ignore
              await swReg.sync.register('sync-outbox')
            } catch (ignored) { }
          }

          alert("Cotización guardada sin conexión. Se sincronizará en segundo plano cuando regreses a un área con cobertura.")
          removeItems()
          removeClientData()
          removeNotes()
          removeDate()
          router.push(`/admin/cotizaciones/offline?id=${actualId}`)
       } catch (error) {
          alert("Error crítico accediendo a la base de datos local.")
       } finally { setLoading(false) }
       return
    }

    try {
      const isEditing = !!initialQuote?.id;
      const url = isEditing ? `/api/quotes/${initialQuote.id}` : '/api/quotes';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      })

      if (res.ok) {
        removeItems()
        removeClientData()
        removeNotes()
        removeDate()
        const data = await res.json()
        router.push(`/admin/cotizaciones/compuesto/${isEditing ? initialQuote.id : data.id}`)
        router.refresh()
      } else {
        alert("Error al guardar en el servidor.")
      }
    } catch (err) {
      alert("Error de red al guardar. Intenta revisar tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="quote-form-layout">
      
      <div style={{ display: 'grid', gap: '20px', minWidth: 0 }}>
        
        {/* Project Link Box */}
        <div className="card shadow-sm" style={{ padding: '25px', borderLeft: '4px solid var(--secondary)', borderRadius: '16px' }}>
            <h3 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 20px 0', fontSize: '1.1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Notificar al Chat del Proyecto (Opcional)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
              Selecciona un proyecto solo si deseas enviar una copia informativa de esta cotización a su chat de mensajes. No se creará un vínculo permanente.
            </p>
           <div style={{ position: 'relative' }} ref={projectDropdownRef}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="🔍 Buscar proyecto por nombre o cliente..." 
                  value={selectedProjectId ? selectedProjectTitle : projectSearch}
                  onChange={e => {
                    setProjectSearch(e.target.value)
                    setShowProjectDropdown(true)
                    if (selectedProjectId) setSelectedProjectId('')
                  }}
                  onFocus={() => setShowProjectDropdown(true)}
                  style={{ paddingLeft: '35px', borderColor: selectedProjectId ? 'var(--secondary)' : '' }}
                />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                {selectedProjectId && (
                  <button 
                    type="button" 
                    onClick={() => { setSelectedProjectId(''); setProjectSearch(''); }}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {showProjectDropdown && !selectedProjectId && (
                <div className="catalog-dropdown" style={{ zIndex: 100, maxHeight: '250px', overflowY: 'auto' }}>
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => {
                          setSelectedProjectId(p.id)
                          setShowProjectDropdown(false)
                          // Also set client if existing
                          if (p.clientId) {
                            setSelectedClientId(p.clientId.toString())
                            setClientMode('EXISTING')
                          }
                        }} 
                        className="catalog-item"
                        style={{ padding: '12px' }}
                      >
                        <div style={{ fontWeight: '600', color: 'var(--text)' }}>{p.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Cliente: {p.client?.name || 'Varios'} • ID: {p.id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No se encontraron proyectos.
                    </div>
                  )}
                </div>
              )}
           </div>

           {selectedProjectId && (
             <div style={{ marginTop: '15px' }}>
               <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                 Mensaje personalizado para el chat:
               </label>
               <textarea 
                 className="form-input" 
                 style={{ height: '70px', fontSize: '0.85rem' }}
                 placeholder="Escribe un mensaje para el equipo (ej: Adjunto cotización de materiales fase 1...)"
                 value={bitacoraMessage}
                 onChange={e => setBitacoraMessage(e.target.value)}
               />
             </div>
           )}
        </div>

        {/* Client Box */}
        <div className="card shadow-sm" style={{ padding: '25px', borderRadius: '16px' }}>
          <div className="quote-client-header">
            <h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Datos del Cliente
            </h3>
            
            <div className="client-mode-pills">
              <button type="button" onClick={() => setClientMode('EXISTING')} className={`btn-pill ${clientMode === 'EXISTING' ? 'active' : ''}`}>Existente</button>
              <button type="button" onClick={() => setClientMode('NEW')} className={`btn-pill ${clientMode === 'NEW' ? 'active' : ''}`}>Nuevo</button>
              <button type="button" onClick={() => setClientMode('CF')} className={`btn-pill-alt ${clientMode === 'CF' ? 'active' : ''}`}>C.F.</button>
            </div>
          </div>

          <div className="quote-client-fields">
            {clientMode === 'EXISTING' ? (
              <div className="form-group">
                <label>Seleccionar Cliente Existente</label>
                <select className="form-input" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required={clientMode === 'EXISTING'}>
                  <option value="">-- Selecciona --</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Nombre del Cliente {clientMode === 'CF' ? '(CF)' : 'Nuevo'}</label>
                <input className="form-input" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} placeholder={clientMode === 'CF' ? 'CONSUMIDOR FINAL' : 'Ej: Juan Pérez'} required />
              </div>
            )}
           <div className="form-group">
              <label>Atención (Contacto)</label>
              <input className="form-input" value={clientData.attention} onChange={e => setClientData({...clientData, attention: e.target.value})} placeholder="Persona de contacto" />
            </div>
            <div className="form-group">
              <label>R.U.C / C.I.</label>
              <input className="form-input" value={clientData.ruc} onChange={e => setClientData({...clientData, ruc: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="form-input" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} />
            </div>
            <div className="form-group quote-full-width">
              <label>Dirección</label>
              <input className="form-input" value={clientData.address} onChange={e => setClientData({...clientData, address: e.target.value})} />
            </div>
          </div>
        </div>

        {/* BudgetBuilder Unified Section */}
        <div className="card shadow-sm" style={{ padding: '25px', borderRadius: '16px' }}>
          <BudgetBuilder 
             initialItems={items}
             materials={materials}
             onItemsChange={handleBudgetChange}
          />
        </div>

        {/* Notes Area */}
        <div className="card shadow-sm" style={{ padding: '25px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ margin: 0, fontWeight: 'bold' }}>Notas / Términos de Referencia</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <MediaCapture mode="audio" onCapture={(b: Blob, t: string, text: string) => setNotes((prev: string) => (prev ? prev + ' ' + text : text))} />
            </div>
          </div>
          <textarea className="form-input" style={{ height: '100px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Términos comerciales, validez, tiempos de entrega..."></textarea>
        </div>
        {/* Optional Extra Section */}
        <div className="card shadow-sm" style={{ padding: '25px', borderRadius: '16px', borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 20px 0', fontSize: '1.1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Sección Final Adicional (Opcional en PDF)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
            Esta información se agregará al final de la cotización, debajo de las firmas. Ideal para incluir especificaciones técnicas extra o una imagen de referencia.
          </p>
          <div style={{ display: 'grid', gap: '15px' }}>
            <div className="form-group">
              <label>Título de la Sección</label>
              <input type="text" className="form-input" value={optionalTitle} onChange={e => setOptionalTitle(e.target.value)} placeholder="Ej: Especificaciones del Filtro..." />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea className="form-input" style={{ height: '80px' }} value={optionalDescription} onChange={e => setOptionalDescription(e.target.value)} placeholder="Detalles extra..."></textarea>
            </div>
            <div className="form-group">
              <label>Imágenes Adjuntas (Máx 2)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <input type="file" accept="image/*" className="form-input" onChange={e => handleImageUpload(e, 1)} />
                  {optionalImageBase64 && (
                    <div style={{ marginTop: '10px', position: 'relative' }}>
                      <img src={optionalImageBase64} alt="Preview 1" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button type="button" onClick={() => setOptionalImageBase64('')} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <input type="file" accept="image/*" className="form-input" onChange={e => handleImageUpload(e, 2)} />
                  {optionalImage2Base64 && (
                    <div style={{ marginTop: '10px', position: 'relative' }}>
                      <img src={optionalImage2Base64} alt="Preview 2" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button type="button" onClick={() => setOptionalImage2Base64('')} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="quote-summary-container">
        <div className="card shadow-lg" style={{ borderTop: '4px solid var(--primary)', borderRadius: '16px', padding: '25px' }}>
          <h3 className="mb-md">Resumen de Cotización</h3>
          
          <div className="form-group mb-lg">
            <label>Validez de Oferta (Fecha)</label>
            <input type="date" className="form-input" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gap: '12px', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal Tarifa 0%</span>
              <span style={{ fontWeight: '600' }}>$ {calculations.subtotal0.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal Tarifa 15%</span>
              <span style={{ fontWeight: '600' }}>$ {calculations.subtotal15.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>IVA 15%</span>
              <span style={{ fontWeight: '600' }}>$ {calculations.ivaAmount.toFixed(2)}</span>
            </div>
            
            <div style={{ marginTop: '15px', padding: '20px', backgroundColor: 'var(--bg-deep)', borderRadius: '12px', border: '1px solid var(--primary-light)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                <span>TOTAL</span>
                <span>$ {calculations.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '25px', padding: '15px', fontWeight: 'bold' }} disabled={loading}>
            {loading ? 'Guardando...' : (initialQuote ? 'ACTUALIZAR COTIZACIÓN' : 'CREAR COTIZACIÓN')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .quote-form-layout {
          display: grid;
          grid-template-columns: 2.5fr 1fr;
          gap: 20px;
          align-items: start;
          min-width: 0;
          width: 100%;
          margin-bottom: 40px;
        }
        .quote-client-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          flex-wrap: wrap;
          gap: 15px;
        }
        .client-mode-pills {
          display: flex;
          background-color: var(--bg-deep);
          border-radius: 30px;
          padding: 4px;
          border: 1px solid var(--border-color);
          gap: 4px;
        }
        .quote-client-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .quote-full-width {
          grid-column: span 2;
        }
        .btn-pill, .btn-pill-alt {
          padding: 8px 16px;
          border-radius: 25px;
          font-size: 0.8rem;
          font-weight: bold;
          border: none;
          cursor: pointer;
          background: transparent;
          color: var(--text-muted);
          transition: all 0.2s;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-pill.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(56, 189, 248, 0.3); }
        .btn-pill-alt.active { background: var(--secondary); color: white; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); }
        
        .quote-summary-container {
          position: -webkit-sticky;
          position: sticky;
          top: 100px;
          align-self: flex-start;
          height: max-content;
          z-index: 10;
        }

        @media (max-width: 1100px) {
          .quote-form-layout { grid-template-columns: 1fr; }
          .quote-summary-container { position: relative; top: 0; }
        }

        @media (max-width: 600px) {
          .quote-client-header { flex-direction: column; align-items: flex-start; }
          .client-mode-pills { width: 100%; }
          .btn-pill, .btn-pill-alt { flex: 1; }
          .quote-client-fields { grid-template-columns: 1fr; }
          .quote-full-width { grid-column: span 1; }
          .card { padding: 20px !important; }
        }
      `}</style>
    </form>
  )
}
