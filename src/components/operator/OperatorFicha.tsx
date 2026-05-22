'use client'

// v373: Ficha del Proyecto colapsable — Operador (con descarga PDF)
// Mismo diseño que el original, extraída como componente independiente.

import { useState } from 'react'
import { formatToEcuador } from '@/lib/date-utils'
import { translateType, translateCategory } from '@/lib/constants'

interface OperatorFichaProps {
  project: any
  localClientName: string
  localProjectAddress: string
  localProjectCity: string
  onEdit?: () => void
}

export default function OperatorFicha({ project, localClientName, localProjectAddress, localProjectCity, onEdit }: OperatorFichaProps) {
  const [isFichaOpen, setIsFichaOpen] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return formatToEcuador(d, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const fetchFullProjectData = async () => {
    try {
      const resp = await fetch(`/api/projects/${project.id}/export`)
      if (!resp.ok) throw new Error('Failed to fetch full data')
      return await resp.json()
    } catch (e) {
      console.error(e)
      alert('Error descargando datos para la ficha')
      return null
    }
  }

  const generateProjectPDF = async () => {
    setIsDownloadingPdf(true)
    try {
      const fullProject = await fetchFullProjectData()
      if (!fullProject) return

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // ====== PAGE 1: PORTADA + DATOS GENERALES ======
      doc.setFillColor(12, 26, 42)
      doc.rect(0, 0, 210, 55, 'F')
      doc.setDrawColor(56, 189, 248)
      doc.setLineWidth(0.5)
      doc.line(20, 50, 190, 50)

      doc.setTextColor(56, 189, 248)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('AQUATECH S.A.', 20, 18)
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.text('FICHA TÉCNICA DE PROYECTO', 20, 33)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`#${fullProject.id} — ${fullProject.title}`, 20, 43)
      doc.text(`Fecha: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 150, 43)

      let y = 70

      let categories: string[] = []
      let contracts: string[] = []
      try { categories = JSON.parse(fullProject.categoryList || '[]') } catch {}
      try { contracts = JSON.parse(fullProject.contractTypeList || '[]') } catch {}

      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('1. DATOS GENERALES', 20, y)
      y += 10

      doc.setTextColor(60, 60, 60)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      const findGpsLink = (text: any) => {
        if (!text) return null
        const str = typeof text !== 'string' ? JSON.stringify(text) : text
        const match = str.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
        return match ? match[0] : null
      }

      let clientLink = fullProject.locationLink && fullProject.locationLink !== 'N/A' ? fullProject.locationLink : null;
      if (!clientLink) {
        const techSpecs = fullProject.technicalSpecs;
        if (typeof techSpecs === 'object' && techSpecs !== null) {
          clientLink = techSpecs.locationLink;
        } else if (typeof techSpecs === 'string') {
          try {
            const parsed = JSON.parse(techSpecs);
            clientLink = parsed.locationLink;
          } catch {
            clientLink = findGpsLink(techSpecs);
          }
        }
      }

      const infoRows = [
        ['Título', fullProject.title],
        ['Tipo de Proyecto', translateType(fullProject.type)],
        ['Tipo de Contrato', contracts.map((c: string) => translateType(c)).join(', ') || 'N/A'],
        ['Categorías', categories.map((c: string) => translateCategory(c)).join(', ') || 'N/A'],
        ['Fecha Inicio', formatDate(fullProject.startDate)],
        ['Fecha Fin (Est.)', formatDate(fullProject.endDate)],
        ['Estado Actual', fullProject.status === 'ACTIVO' ? 'En Ejecución' : fullProject.status],
        ['Dirección Texto', `${fullProject.city || ''} ${fullProject.address || ''}`.trim() || 'N/A'],
        ['Ubicación Cliente', clientLink || 'No proporcionada'],
        ['Ubicación Obra (Operador)', (() => {
          let link = null;
          const techSpecs = fullProject.technicalSpecs;
          if (typeof techSpecs === 'object' && techSpecs !== null) {
            link = techSpecs.locationLink;
          } else if (typeof techSpecs === 'string') {
            try {
              const parsed = JSON.parse(techSpecs);
              link = parsed.locationLink;
            } catch {
              link = findGpsLink(techSpecs);
            }
          }
          
          link = link || findGpsLink(fullProject.specsTranscription) || findGpsLink(fullProject.address);
          return (link && link !== clientLink) ? link : 'Ver ubicación principal';
        })()],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Información Detallada']],
        body: infoRows,
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const cellText = data.cell.text[0];
            if (cellText && (cellText.startsWith('http') || cellText.includes('maps'))) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: cellText });
            }
          }
        }
      })
      y = (doc as any).lastAutoTable.finalY + 20

      // 2. Especificaciones Técnicas
      let specs: any = {}
      try { specs = JSON.parse(fullProject.technicalSpecs || '{}') } catch {}
      if (specs.description || fullProject.specsTranscription) {
        doc.setTextColor(56, 189, 248)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('2. ESPECIFICACIONES TÉCNICAS', 20, y)
        y += 8
        doc.setTextColor(60, 60, 60)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const specText = fullProject.specsTranscription || specs.description || ''
        const wrapped = doc.splitTextToSize(specText, 170)
        doc.text(wrapped, 20, y)
        y += wrapped.length * 5 + 20
      }

      // ====== PAGE 2: CLIENTE Y EQUIPO ======
      if (y > 220) { doc.addPage(); y = 20; }
      
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('3. INFORMACIÓN DEL CLIENTE', 20, y)
      y += 10

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Valor']],
        body: [
          ['Nombre / Razón Social', fullProject.client?.name || 'N/A'],
          ['Teléfono', fullProject.client?.phone || 'N/A'],
          ['Email', fullProject.client?.email || 'N/A'],
          ['Dirección', fullProject.client?.address || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      })
      y = (doc as any).lastAutoTable.finalY + 20

      // Equipo Asignado
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('4. EQUIPO ASIGNADO', 20, y)
      y += 10

      const teamData = fullProject.team.map((m: any, i: number) => [
        (i + 1).toString(), m.user.name, m.user.role || 'Operador', m.user.phone || 'N/A'
      ])

      autoTable(doc, {
        startY: y,
        head: [['#', 'Nombre', 'Rol', 'Teléfono']],
        body: teamData.length > 0 ? teamData : [['—', 'Sin equipo asignado', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9 }
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text(`Aquatech CRM — Ficha Técnica #${fullProject.id}`, 20, 287)
        doc.text(`Página ${i} de ${pageCount}`, 175, 287)
      }

      doc.save(`Ficha_Tecnica_${fullProject.id}_${fullProject.title.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Error generating project PDF:', err)
      alert('Error al generar el PDF del proyecto')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '0' }}>
      <div 
        style={{ 
          padding: '16px 20px', 
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05), rgba(12, 26, 42, 0.3))',
          borderBottom: isFichaOpen ? '1px solid var(--border-color)' : 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
          cursor: 'pointer'
        }}
        onClick={() => setIsFichaOpen(!isFichaOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Ficha del Proyecto
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isFichaOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s', opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
            </h3>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button 
              className="btn btn-ghost" 
              onClick={onEdit}
              style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={generateProjectPDF}
            disabled={isDownloadingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.75rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
            {isDownloadingPdf ? 'Generando...' : 'Descargar Ficha Técnica'}
          </button>
        </div>
      </div>

      <div style={{ 
        maxHeight: isFichaOpen ? '2000px' : '0', 
        overflow: 'hidden', 
        transition: 'max-height 0.4s ease-out, opacity 0.3s',
        opacity: isFichaOpen ? 1 : 0
      }}>
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            
            {/* Datos Generales */}
            <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Datos Generales</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  ['Tipo', translateType(project.type)],
                  ['Contrato', (() => {
                    try {
                      const parsed = typeof project.contractTypeList === 'string' ? JSON.parse(project.contractTypeList) : project.contractTypeList;
                      return Array.isArray(parsed) ? parsed.join(', ') : 'N/A';
                    } catch { return 'N/A'; }
                  })()],
                  ['Ciudad', localProjectCity || 'N/A'],
                  ['Inicio', formatDate(project.startDate)],
                  ['Fin Est.', formatDate(project.endDate)]
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: '500' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cliente */}
            <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nombre</span>
                  <span style={{ fontWeight: '500' }}>{localClientName || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Ubicación</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', maxWidth: '70%' }}>
                    {(() => {
                      const findGpsLink = (text: any) => {
                        if (!text || typeof text !== 'string') return null
                        const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
                        return match ? match[0] : null
                      }

                      let clientLoc = project.locationLink && project.locationLink !== 'N/A' ? project.locationLink : null;
                      
                      let techSpecs = project.technicalSpecs;
                      let locFromSpecs = null;
                      if (typeof techSpecs === 'string') {
                        try {
                          const parsed = JSON.parse(techSpecs);
                          locFromSpecs = parsed.locationLink;
                        } catch {
                          locFromSpecs = findGpsLink(techSpecs);
                        }
                      } else if (typeof techSpecs === 'object' && techSpecs !== null) {
                        locFromSpecs = techSpecs.locationLink;
                      }
                      
                      if (!clientLoc && locFromSpecs) {
                        clientLoc = locFromSpecs;
                      }

                      const operatorLoc = findGpsLink(project.specsTranscription) || findGpsLink(localProjectAddress);
                      
                      const hasClient = !!clientLoc;
                      const hasOperator = !!operatorLoc && operatorLoc !== clientLoc;

                      if (!hasClient && !hasOperator) {
                        return <span style={{ fontWeight: '500', textAlign: 'right' }}>{localProjectAddress || 'N/A'}</span>;
                      }

                      return (
                        <>
                          {hasClient && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación Cliente</span>
                              <a 
                                href={clientLoc} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Abrir Google Maps
                              </a>
                            </div>
                          )}
                          {hasOperator && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación Obra / Operador</span>
                              <a 
                                href={operatorLoc} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Ver Punto Marcado
                              </a>
                            </div>
                          )}
                          {!hasClient && hasOperator && localProjectAddress && (
                             <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>{localProjectAddress}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Especificaciones Técnicas */}
            <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Especificaciones Técnicas</h4>
              <div style={{ fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
                {project.specsTranscription || 'Sin especificaciones detalladas.'}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
