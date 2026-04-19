'use client'

import { generateProfessionalPDF, numberToSpanishWords } from '@/lib/pdf-generator'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatDateEcuador } from '@/lib/date-utils'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function QuoteDetailClient({ quote, projects = [] }: any) {
  const { data: session } = useSession()
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  
  // Project Search State
  const [projectSearch, setProjectSearch] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>(quote.projectId || '')
  const projectDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects.slice(0, 10)
    const terms = projectSearch.toLowerCase().split(/\s+/).filter(Boolean)
    return projects.filter((p: any) => {
      const targetText = `${p.title || ''} ${p.client?.name || ''} ${p.id}`.toLowerCase()
      return terms.every(term => targetText.includes(term))
    }).slice(0, 50)
  }, [projectSearch, projects])

  const selectedProjectTitle = useMemo(() => {
    if (!selectedProjectId) return ''
    const p = projects.find((proj: any) => proj.id === Number(selectedProjectId))
    return p ? p.title : ''
  }, [selectedProjectId, projects])

  const handleSendToProject = async () => {
    if (!selectedProjectId) return alert("Selecciona un proyecto primero")
    
    setSending(true)
    try {
      // 1. Generate PDF data
      const clientInfo = {
        name: quote.clientName || quote.client?.name || '',
        ruc: quote.clientRuc || quote.client?.ruc,
        address: quote.clientAddress || quote.client?.address,
        phone: quote.clientPhone || quote.client?.phone,
        date: new Date(quote.createdAt)
      }

      const items = quote.items.map((item: any) => ({
        quantity: item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity),
        code: item.material?.code || item.code || '',
        description: item.description,
        unitPrice: Number(item.unitPrice),
        discountPct: Number(item.discountPct || 0),
        total: Number(item.total)
      }))

      const totals = {
        subtotal: Number(quote.subtotal || 0),
        subtotal0: Number(quote.subtotal0 || 0),
        subtotal15: Number(quote.subtotal15 || 0),
        discountTotal: Number(quote.discountTotal || 0),
        ivaAmount: Number(quote.ivaAmount || 0),
        totalAmount: Number(quote.totalAmount)
      }

      // Get the jsPDF instance
      const doc = generateProfessionalPDF(clientInfo, items, totals, {
        docType: 'COTIZACIÓN',
        docId: quote.id,
        notes: quote.notes,
        sellerName: session?.user?.name || quote.creator?.name || 'Aquatech',
        action: 'instance',
        optionalSection: {
          title: quote.optionalTitle || '',
          description: quote.optionalDescription || '',
          imageBase64: quote.optionalImage || '',
          image2Base64: quote.optionalImage2 || ''
        }
      });

      // Convert to base64
      const pdfBase64 = (doc as any).output('datauristring').split(',')[1];
      const filename = `Cotizacion_${quote.id}_${(quote.clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;

      const res = await fetch(`/api/quotes/${quote.id}/send-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: selectedProjectId,
          message: customMessage,
          pdfBase64,
          filename
        })
      })

      if (res.ok) {
        alert("¡Cotización y mensaje enviados a la bitácora correctamente!")
        setCustomMessage('')
        router.refresh()
      } else {
        alert("Error al enviar al proyecto")
      }
    } catch (err) {
      console.error(err)
      alert("Error de red o generación de PDF")
    } finally {
      setSending(false)
    }
  }
  
  const handleDownloadPDF = () => {
    const clientInfo = {
      name: quote.clientName || quote.client?.name || '',
      ruc: quote.clientRuc || quote.client?.ruc,
      address: quote.clientAddress || quote.client?.address,
      phone: quote.clientPhone || quote.client?.phone,
      date: new Date(quote.createdAt)
    }

    const items = quote.items.map((item: any) => ({
      quantity: item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity),
      code: item.material?.code || item.code || '',
      description: item.description,
      unitPrice: Number(item.unitPrice),
      discountPct: Number(item.discountPct || 0),
      total: Number(item.total)
    }))

    const totals = {
      subtotal: Number(quote.subtotal || 0),
      subtotal0: Number(quote.subtotal0 || 0),
      subtotal15: Number(quote.subtotal15 || 0),
      discountTotal: Number(quote.discountTotal || 0),
      ivaAmount: Number(quote.ivaAmount || 0),
      totalAmount: Number(quote.totalAmount)
    }

    generateProfessionalPDF(clientInfo, items, totals, {
      docType: 'COTIZACIÓN',
      docId: quote.id,
      notes: quote.notes,
      sellerName: session?.user?.name || quote.creator?.name || 'Aquatech',
      optionalSection: {
        title: quote.optionalTitle || '',
        description: quote.optionalDescription || '',
        imageBase64: quote.optionalImage || '',
        image2Base64: quote.optionalImage2 || ''
      }
    })
  }

  return (
    <>
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <Link href="/admin/cotizaciones" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver a Cotizaciones
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ margin: 0 }}>Cotización #{quote.id.toString().padStart(5, '0')}</h2>
            <span className={`badge badge-${quote.status === 'BORRADOR' ? 'info' : quote.status === 'ACEPTADA' ? 'success' : 'warning'}`}>
              {quote.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Descargar PDF Oficial
          </button>
        </div>
      </div>

      <div className="quote-detail-layout">
        <div className="card shadow-md" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ backgroundColor: 'var(--bg-deep)', padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa de Documento</h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(quote.createdAt).toLocaleString()}</div>
          </div>
          
          <div className="preview-container">
            {/* Header Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <img src="/logo.jpg" alt="AQUA TECH" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
              <div style={{ textAlign: 'right', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>R.U.C.: 1105048852001</div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>COTIZACIÓN # {quote.id.toString().padStart(5, '0')}</div>
                <div style={{ fontSize: '0.8rem' }}>CASTILLO CASTILLO PABLO JOSE</div>
              </div>
            </div>

            {/* Client Box Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', padding: '15px', backgroundColor: '#f9fafb', border: '1px solid #eee', borderRadius: '4px', marginBottom: '30px' }}>
              <div>
                <div><strong>Cliente:</strong> {quote.clientName || quote.client?.name}</div>
                <div><strong>Dirección:</strong> {quote.clientAddress || quote.client?.address}</div>
                <div><strong>Proyecto:</strong> {quote.project?.title || 'General'}</div>
              </div>
              <div>
                <div><strong>RUC/CI:</strong> {quote.clientRuc || quote.client?.ruc}</div>
                <div><strong>Telef:</strong> {quote.clientPhone || quote.client?.phone}</div>
                <div><strong>Fecha:</strong> {formatDateEcuador(quote.createdAt)}</div>
              </div>
            </div>

            {/* Table Preview */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ backgroundColor: '#111', color: 'white' }}>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Cant.</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>P.Unit</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item: any, idx: number) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#888' }}>{item.material?.code || item.code}</div>
                      {item.description}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>$ {Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>$ {Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Totals Table */}
              <div style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: '0.8rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>$ {Number(quote.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: '0.8rem', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Descuentos:</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>-$ {Number(quote.discountTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: '0.8rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal TARIFA 0%:</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>$ {Number(quote.subtotal0 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: '0.8rem', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal TARIFA 15%:</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>$ {Number(quote.subtotal15 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: '0.8rem', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>15% IVA:</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>$ {Number(quote.ivaAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', fontSize: '0.95rem', backgroundColor: 'var(--bg-deep)', borderTop: '2px solid var(--primary)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>TOTAL A PAGAR:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>$ {Number(quote.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Observations */}
              <div style={{ fontSize: '0.8rem', padding: '14px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: '#374151' }}>OBSERVACIONES:</strong>
                <p style={{ margin: '0 0 12px 0', color: '#4b5563', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{quote.notes || 'Ninguna'}</p>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', color: '#374151' }}>
                  <strong>SON:</strong> {numberToSpanishWords(Number(quote.totalAmount))}
                </div>
              </div>
            </div>

            {/* Optional Section Preview */}
            {(quote.optionalTitle || quote.optionalDescription || quote.optionalImage || quote.optionalImage2) && (
              <div style={{ marginTop: '30px', borderTop: '2px solid var(--border)', paddingTop: '20px' }}>
                {quote.optionalTitle && <h3 style={{ fontSize: '1rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '10px' }}>{quote.optionalTitle}</h3>}
                {quote.optionalDescription && <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '15px', wordBreak: 'break-word' }}>{quote.optionalDescription}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: quote.optionalImage && quote.optionalImage2 ? '1fr 1fr' : '1fr', gap: '16px' }}>
                  {quote.optionalImage && <img src={quote.optionalImage} alt="Referencia 1" style={{ width: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} />}
                  {quote.optionalImage2 && <img src={quote.optionalImage2} alt="Referencia 2" style={{ width: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} />}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--secondary)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Enviar a Bitácora
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '10px 0' }}>
              Selecciona un proyecto para compartir formalmente esta cotización en su reporte diario.
            </p>
            
            <div style={{ position: 'relative' }} ref={projectDropdownRef} className="mb-md">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="🔍 Buscar proyecto..." 
                  value={selectedProjectId ? selectedProjectTitle : projectSearch}
                  onChange={e => {
                    setProjectSearch(e.target.value)
                    setShowProjectDropdown(true)
                    if (selectedProjectId) setSelectedProjectId('')
                  }}
                  onFocus={() => setShowProjectDropdown(true)}
                  style={{ borderColor: selectedProjectId ? 'var(--secondary)' : '' }}
                />
                
                {showProjectDropdown && !selectedProjectId && (
                  <div className="catalog-dropdown" style={{ zIndex: 100, position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    {filteredProjects.length > 0 ? (
                      filteredProjects.map((p: any) => (
                        <div 
                          key={p.id} 
                          onClick={() => {
                            setSelectedProjectId(p.id)
                            setShowProjectDropdown(false)
                          }} 
                          style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                        >
                          <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{p.title}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.client?.name}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No hay resultados</div>
                    )}
                  </div>
                )}
            </div>

            <div className="mb-md">
              <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                Mensaje personalizado (Opcional):
              </label>
              <textarea 
                className="form-input" 
                style={{ height: '80px', fontSize: '0.85rem' }}
                placeholder="Ej: Adjunto cotización solicitada para la fase 2..."
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
              />
            </div>

            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', justifyContent: 'center' }} 
              disabled={!selectedProjectId || sending}
              onClick={handleSendToProject}
            >
              {sending ? 'Enviando...' : 'COMPARTIR EN PROYECTO'}
            </button>
          </div>

          <div className="card">
            <h3>Gestión de Cotización</h3>
            <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>Marcar como Enviada</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'var(--success)' }}>Marcar como Aceptada</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)' }}>Rechazar Propuesta</button>
            </div>
          </div>

          <div className="card">
            <h3>Acciones Rápidas</h3>
            <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
              <Link href={`/admin/cotizaciones/nuevo?from=${quote.id}`} className="btn btn-ghost" style={{ textDecoration: 'none', textAlign: 'center', width: '100%', justifyContent: 'center', padding: '10px' }}>
                Duplicar Cotización
              </Link>
              <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir Copia</button>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .quote-detail-layout {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 30px;
          align-items: start;
        }
        .preview-container {
          padding: 40px;
          background-color: white;
          color: #333;
          font-size: 13px;
          line-height: 1.5;
          overflow-x: auto;
        }
        @media (max-width: 1024px) {
          .quote-detail-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .preview-container {
            padding: 15px;
            font-size: 11px;
          }
        }
      `}</style>
    </>
  )
}
