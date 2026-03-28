'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function QuoteFormClient({ clients, materials, prefetchedProject }: any) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(prefetchedProject?.clientId || '')
  
  // Client Snapshot Fields
  const [clientData, setClientData] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    attention: ''
  })

  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<any[]>(prefetchedProject?.items || [])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllInventory, setShowAllInventory] = useState(false)
  const [isNewClient, setIsNewClient] = useState(false)
  
  // Global Item States
  const [globalDescription, setGlobalDescription] = useState('')
  const [globalPrice, setGlobalPrice] = useState('')
  const [globalIsTaxed, setGlobalIsTaxed] = useState(true)

  // Auto-fill client data when selection changes
  useEffect(() => {
    if (selectedClientId && !isNewClient) {
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
    } else if (isNewClient) {
      // Clear data for new client
      setSelectedClientId('')
      setClientData({
        name: '',
        ruc: '',
        address: '',
        phone: '',
        attention: ''
      })
    }
  }, [selectedClientId, clients, isNewClient])

  // Financial Calculations
  const calculations = useMemo(() => {
    let subtotal = 0
    let discountTotal = 0
    let subtotal0 = 0
    let subtotal15 = 0

    const processedItems = items.map(item => {
      const q = item.quantity === 'GLOBAL' ? 1 : Number(item.quantity)
      const basePrice = Number(item.unitPrice) * q
      const discount = basePrice * (Number(item.discountPct || 0) / 100)
      const itemTotal = basePrice - discount
      
      subtotal += basePrice
      discountTotal += discount
      
      if (item.isTaxed === false) {
        subtotal0 += itemTotal
      } else {
        subtotal15 += itemTotal
      }

      return { ...item, total: itemTotal }
    })

    const ivaAmount = subtotal15 * 0.15
    const totalAmount = subtotal0 + subtotal15 + ivaAmount

    return {
      subtotal,
      discountTotal,
      subtotal0,
      subtotal15,
      ivaAmount,
      totalAmount,
      processedItems
    }
  }, [items])

  const addItem = (materialId: number) => {
    const mat = materials.find((m: any) => m.id === materialId)
    if (!mat) return
    
    setItems([...items, {
      materialId: mat.id,
      description: mat.name,
      code: mat.code,
      quantity: 1,
      unitPrice: Number(mat.unitPrice),
      discountPct: 0,
      isTaxed: true
    }])
    setSearchTerm('')
    setShowAllInventory(false)
  }

  const addCustomItem = () => {
    setItems([...items, {
      materialId: null,
      description: 'Nuevo Ítem Personalizado',
      code: 'ESP',
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      isTaxed: true,
      total: 0
    }])
    setShowAllInventory(false)
  }

  const addGlobalItem = () => {
    if (!globalDescription || !globalPrice) return;
    setItems([...items, {
      materialId: null,
      description: globalDescription.toUpperCase(),
      code: 'GLOBAL',
      quantity: 'GLOBAL',
      unitPrice: Number(globalPrice),
      discountPct: 0,
      isTaxed: globalIsTaxed
    }])
    setGlobalDescription('')
    setGlobalPrice('')
    setShowAllInventory(false)
  }

  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim() && !showAllInventory) return []
    const term = searchTerm.toLowerCase()
    
    if (showAllInventory && !searchTerm) {
      return materials.slice(0, 50)
    }

    return (materials || []).filter((m: any) => 
      m.name.toLowerCase().includes(term) || 
      (m.code && m.code.toLowerCase().includes(term))
    ).slice(0, 15)
  }, [searchTerm, materials, showAllInventory])

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isNewClient && !selectedClientId) return alert("Selecciona un cliente o elija 'Cliente Nuevo'")
    if (isNewClient && !clientData.name) return alert("Ingrese el nombre del nuevo cliente")
    if (items.length === 0) return alert("Agrega al menos un item")

    const payload = {
      clientId: selectedClientId,
      projectId: prefetchedProject?.id,
      ...clientData,
      clientName: clientData.name,
      clientRuc: clientData.ruc,
      clientAddress: clientData.address,
      clientPhone: clientData.phone,
      clientAttention: clientData.attention,
      ...calculations,
      notes,
      validUntil,
      items: calculations.processedItems
    }

    setLoading(true)

    // Offline interceptor
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
       try {
          const { db } = await import('@/lib/db')
          const tempId = Date.now()
          await db.outbox.add({
             type: 'QUOTE',
             projectId: prefetchedProject?.id || 0,
             payload,
             timestamp: tempId,
             status: 'pending'
          })
          // Register Background Sync if supported (Chrome/Android mostly)
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
              const swReg = await navigator.serviceWorker.ready
              // @ts-ignore
              await swReg.sync.register('sync-outbox')
              console.log('[SW] Background Sync registered for outbox')
            } catch (ignored) { }
          }

          alert("Cotización guardada sin conexión. Se sincronizará en segundo plano cuando regreses a un área con cobertura.")
          // Redirect to the offline preview
          router.push(`/admin/cotizaciones/offline?id=${tempId}`)
       } catch (error) {
          alert("Error crítico accediendo a la base de datos local.")
       } finally { setLoading(false) }
       return
    }

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/admin/cotizaciones/compuesto/${data.id}`)
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
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Información del Cliente
            </h3>
            
            {/* Toggle Nuevo/Existente */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-deep)', borderRadius: '30px', padding: '4px', border: '1px solid var(--border-color)' }}>
              <button 
                type="button" 
                onClick={() => setIsNewClient(false)}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '25px', 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: !isNewClient ? 'var(--primary)' : 'transparent',
                  color: !isNewClient ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Existente
              </button>
              <button 
                type="button" 
                onClick={() => setIsNewClient(true)}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '25px', 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isNewClient ? 'var(--primary)' : 'transparent',
                  color: isNewClient ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Nuevo
              </button>
            </div>
          </div>

          <div className="quote-client-fields">
            {!isNewClient ? (
              <div className="form-group">
                <label>Seleccionar Cliente Existente</label>
                <select 
                  className="form-input" 
                  value={selectedClientId} 
                  onChange={e => setSelectedClientId(e.target.value)} 
                  required={!isNewClient}
                >
                  <option value="">-- Selecciona --</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Nombre del Cliente Nuevo</label>
                <input 
                  className="form-input" 
                  value={clientData.name} 
                  onChange={e => setClientData({...clientData, name: e.target.value})}
                  placeholder="Ej: Juan Pérez o Empresa S.A."
                  required={isNewClient}
                />
              </div>
            )}
           <div className="form-group">
              <label>Atención (Contacto)</label>
              <input 
                className="form-input" 
                value={clientData.attention} 
                onChange={e => setClientData({...clientData, attention: e.target.value})}
                placeholder="Nombre de la persona de contacto"
              />
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

        {/* Items Box */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h3 style={{ margin: 0 }}>Conceptos y Materiales</h3>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="🔍 Buscar material o código..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '35px' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setShowAllInventory(!showAllInventory)}
                  style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  {showAllInventory ? '✕ Cerrar Inventario' : '📂 Ver Todo el Inventario'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm" 
                  onClick={addCustomItem}
                  style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  + Ítem Personalizado
                </button>
              </div>

              {/* Global Item UI */}
              <div style={{ marginTop: '15px', padding: '15px', border: '1px solid var(--primary)', borderRadius: '12px', backgroundColor: 'var(--primary-glow)' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Añadir Concepto GLOBAL (Servicios)
                </h4>
                <div className="quote-global-fields">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Descripción</label>
                    <input className="form-input-sm" value={globalDescription} onChange={e => setGlobalDescription(e.target.value)} placeholder="Ej: Construcción de Piscina" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Precio ($)</label>
                    <input type="number" className="form-input-sm" value={globalPrice} onChange={e => setGlobalPrice(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={addGlobalItem} disabled={!globalDescription || !globalPrice}>
                    Añadir
                  </button>
                </div>
              </div>

              {(searchTerm || showAllInventory) && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  zIndex: 2000, 
                  backgroundColor: 'var(--bg-card)', 
                  border: '2px solid var(--primary)', 
                  borderRadius: '12px', 
                  marginTop: '8px', 
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '8px'
                }}>
                  {filteredMaterials.map((m: any) => (
                    <div 
                      key={m.id} 
                      onClick={() => addItem(m.id)} 
                      style={{ 
                        padding: '12px', 
                        borderRadius: '8px',
                        cursor: 'pointer', 
                        transition: 'all 0.2s',
                        borderBottom: '1px solid var(--border-color)',
                        marginBottom: '4px'
                      }} 
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--primary-glow)'
                        e.currentTarget.style.transform = 'translateX(5px)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.transform = 'translateX(0)'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{m.name}</span>
                        <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>+ AÑADIR</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>Código: {m.code || 'N/A'}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>$ {Number(m.unitPrice).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {items.map((item, index) => (
              <div key={index} className="quote-item-row" style={{ 
                alignItems: 'center', 
                padding: '16px', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                backgroundColor: 'var(--bg-deep)',
                transition: 'all 0.3s ease'
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '4px', opacity: 0.8 }}>{item.code || 'S/N'}</div>
                  <input 
                    className="form-input-sm" 
                    value={item.description} 
                    onChange={(e) => updateItem(index, 'description', e.target.value)} 
                    style={{ padding: '8px 12px', width: '100%', fontSize: '0.9rem', border: '1px solid var(--border-color)' }} 
                  />
                </div>
                <div style={{ minWidth: '70px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>CANT.</label>
                  <input 
                    type={item.quantity === 'GLOBAL' ? 'text' : 'number'} 
                    className="form-input-sm" 
                    value={item.quantity} 
                    onChange={(e) => updateItem(index, 'quantity', item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(e.target.value))} 
                    readOnly={item.quantity === 'GLOBAL'}
                    style={{ padding: '8px', width: '100%', backgroundColor: item.quantity === 'GLOBAL' ? 'rgba(56, 189, 248, 0.1)' : 'inherit' }} 
                  />
                </div>
                <div style={{ minWidth: '90px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>P. UNIT ($)</label>
                  <input type="number" step="0.01" className="form-input-sm" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} style={{ padding: '8px', width: '100%' }} />
                </div>
                <div style={{ minWidth: '70px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>DESC %</label>
                  <input type="number" className="form-input-sm" value={item.discountPct} onChange={(e) => updateItem(index, 'discountPct', Number(e.target.value))} style={{ padding: '8px', width: '100%' }} />
                </div>
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>IVA 15%</label>
                  <input 
                    type="checkbox" 
                    checked={item.isTaxed} 
                    onChange={(e) => updateItem(index, 'isTaxed', e.target.checked)} 
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                </div>
                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>TOTAL</label>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary)' }}>
                    $ {( (Number(item.unitPrice) * (item.quantity === 'GLOBAL' ? 1 : Number(item.quantity))) * (1 - (Number(item.discountPct || 0)/100)) ).toFixed(2)}
                  </div>
                </div>
                <div className="quote-item-delete">
                  <button 
                    type="button" 
                    onClick={() => removeItem(index)} 
                    className="btn-ghost" 
                    style={{ color: 'var(--danger)', padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    title="Eliminar ítem"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                Usa el selector superior para añadir materiales al presupuesto.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <label>Notas / Términos de Referencia</label>
          <textarea 
            className="form-input" 
            style={{ height: '80px', marginTop: '10px' }} 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej: Entrega inmediata, validez de oferta 15 días..."
          ></textarea>
        </div>
      </div>

      {/* Summary Box */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div className="card shadow-lg" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="mb-md">Resumen Final</h3>
          
          <div className="form-group mb-lg">
            <label>Válida hasta</label>
            <input type="date" className="form-input" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gap: '10px', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal Bruto</span>
              <span>$ {calculations.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
              <span>Total Descuentos</span>
              <span>-$ {calculations.discountTotal.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', margin: '5px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal Tarifa 0%</span>
              <span>$ {calculations.subtotal0.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal Tarifa 15%</span>
              <span>$ {calculations.subtotal15.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>IVA 15%</span>
              <span>$ {calculations.ivaAmount.toFixed(2)}</span>
            </div>
            
            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid var(--primary-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                <span>TOTAL</span>
                <span>$ {calculations.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '25px', padding: '15px', fontWeight: 'bold' }}
            disabled={loading}
          >
            {loading ? 'Generando...' : 'CREAR COTIZACIÓN'}
          </button>
          
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '15px' }}>
            Se guardará una copia en el historial y se generará el PDF profesional.
          </p>
        </div>
      </div>

      <style jsx>{`
        .form-input-sm {
          background-color: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-main);
          outline: none;
          width: 100%;
          padding: 6px 8px;
        }
        .form-input-sm:focus {
          border-color: var(--primary);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
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
        .quote-global-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 10px;
          align-items: end;
        }
        .quote-item-row {
          display: grid;
          grid-template-columns: minmax(200px, 3.5fr) repeat(auto-fit, minmax(80px, 1fr)) 40px;
          gap: 15px;
        }
        @media (max-width: 768px) {
          .quote-form-layout {
            grid-template-columns: 1fr;
          }
          .quote-client-fields {
            grid-template-columns: 1fr;
          }
          .quote-full-width {
            grid-column: span 1;
          }
          .quote-global-fields {
            grid-template-columns: 1fr;
          }
          .quote-item-row {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .quote-item-row > div:first-child {
            grid-column: span 2;
          }
          .quote-item-delete {
            grid-column: span 2;
            text-align: right;
            border-top: 1px solid var(--border-color);
            padding-top: 10px;
            margin-top: 5px;
          }
        }
     `}</style>
    </form>
  )
}
