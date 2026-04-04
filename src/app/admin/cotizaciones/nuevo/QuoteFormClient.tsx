'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MediaCapture from '@/components/MediaCapture'
import BudgetBuilder, { BudgetItem } from '@/components/BudgetBuilder'

interface QuoteFormProps {
  clients: any[]
  materials: any[]
  prefetchedProject?: any
  initialQuote?: any
}

import { useLocalStorage } from '@/hooks/useLocalStorage'

export default function QuoteFormClient({ clients, materials, prefetchedProject, initialQuote }: QuoteFormProps) {
  const router = useRouter()
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
  const [isFirstRender, setIsFirstRender] = useState(true)

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
      projectId: prefetchedProject?.id,
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
      }))
    }

    setLoading(true)

    // Offline interceptor
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
       try {
          const { db } = await import('@/lib/db')
          const tempId = Date.now()
          const actualId = await db.outbox.add({
             type: 'QUOTE',
             projectId: prefetchedProject?.id || 0,
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
        body: JSON.stringify(payload)
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
      
      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Client Box */}
        <div className="card shadow-sm" style={{ padding: '25px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Información del Cliente
            </h3>
            
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-deep)', borderRadius: '30px', padding: '4px', border: '1px solid var(--border-color)', gap: '4px' }}>
              <button type="button" onClick={() => setClientMode('EXISTING')} className={`btn-pill ${clientMode === 'EXISTING' ? 'active' : ''}`}>Existente</button>
              <button type="button" onClick={() => setClientMode('NEW')} className={`btn-pill ${clientMode === 'NEW' ? 'active' : ''}`}>Nuevo</button>
              <button type="button" onClick={() => setClientMode('CF')} className={`btn-pill-alt ${clientMode === 'CF' ? 'active' : ''}`}>CF</button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <label style={{ margin: 0, fontWeight: 'bold' }}>Notas / Términos de Referencia</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <MediaCapture mode="audio" onCapture={(b: Blob, t: string, text: string) => setNotes((prev: string) => (prev ? prev + ' ' + text : text))} />
              <MediaCapture mode="video" onCapture={(b: Blob, t: string, text: string) => setNotes((prev: string) => (prev ? prev + ' ' + text : text))} />
            </div>
          </div>
          <textarea className="form-input" style={{ height: '100px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Términos comerciales, validez, tiempos de entrega..."></textarea>
        </div>
      </div>

      {/* Summary Box */}
      <div style={{ position: 'sticky', top: '20px' }}>
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
        }
        .quote-client-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .quote-full-width {
          grid-column: span 2;
        }
        .btn-pill, .btn-pill-alt {
          padding: 6px 14px;
          border-radius: 25px;
          font-size: 0.75rem;
          font-weight: bold;
          border: none;
          cursor: pointer;
          background: transparent;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .btn-pill.active { background: var(--primary); color: white; }
        .btn-pill-alt.active { background: var(--secondary); color: white; }
        
        @media (max-width: 992px) {
          .quote-form-layout { grid-template-columns: 1fr; }
          .quote-client-fields { grid-template-columns: 1fr; }
          .quote-full-width { grid-column: span 1; }
        }
      `}</style>
    </form>
  )
}
