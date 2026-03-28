'use client'

import { generateProfessionalPDF, numberToSpanishWords } from '@/lib/pdf-generator'
import Link from 'next/link'

export default function QuoteDetailClient({ quote }: any) {
  
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
      notes: quote.notes
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px', alignItems: 'start' }}>
        <div className="card shadow-md" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ backgroundColor: 'var(--bg-deep)', padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa de Documento</h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(quote.createdAt).toLocaleString()}</div>
          </div>
          
          <div style={{ padding: '40px', backgroundColor: 'white', color: '#333', fontSize: '13px', lineHeight: '1.5' }}>
            {/* Header Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div style={{ color: 'var(--primary)', fontSize: '2rem', fontWeight: 'bold' }}>AQUATECH</div>
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
                <div><strong>Fecha:</strong> {new Date(quote.createdAt).toLocaleDateString()}</div>
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
                {quote.items.map((item: any, idx: number) => (
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '60%', fontSize: '0.8rem' }}>
                <strong>OBSERVACIONES:</strong>
                <p>{quote.notes || 'Ninguna'}</p>
                <div style={{ marginTop: '20px' }}><strong>SON:</strong> {numberToSpanishWords(Number(quote.totalAmount))}</div>
              </div>
              
              <div style={{ width: '35%' }}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-semibold text-gray-900">$ {Number(quote.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Descuentos:</span>
                    <span className="font-semibold text-red-600">-$ {Number(quote.discountTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-1">
                    <span className="text-gray-500">Subtotal TARIFA 0%:</span>
                    <span className="font-semibold text-gray-900">$ {Number(quote.subtotal0 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Subtotal TARIFA 15%:</span>
                    <span className="font-semibold text-gray-900">$ {Number(quote.subtotal15 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">15% IVA:</span>
                    <span className="font-semibold text-gray-900">$ {Number(quote.ivaAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t-2 border-primary pt-2 mt-2">
                    <span className="font-bold text-primary">TOTAL A PAGAR $:</span>
                    <span className="font-bold text-primary">$ {Number(quote.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
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
              <Link href={`/admin/cotizaciones/nuevo?from=${quote.id}`} className="btn btn-ghost" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Duplicar Cotización
              </Link>
              <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir Copia</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
