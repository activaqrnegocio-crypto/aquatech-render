'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import MediaCapture from '@/components/MediaCapture'

export interface BudgetItem {
  materialId?: number | null
  name: string
  quantity: number | 'GLOBAL'
  unit?: string
  estimatedCost: number
  isTaxed: boolean
  discountPct?: number
  code?: string
}

interface BudgetBuilderProps {
  initialItems?: BudgetItem[]
  materials: any[]
  onItemsChange: (items: BudgetItem[], calculations: any) => void
  showPreviewActions?: boolean
  onGeneratePDF?: (preview: boolean) => void
}

export default function BudgetBuilder({ 
  initialItems = [], 
  materials = [], 
  onItemsChange,
  showPreviewActions = false,
  onGeneratePDF
}: BudgetBuilderProps) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems)
  const [searchMaterial, setSearchMaterial] = useState('')
  
  // Configuration Box State
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null)
  const [customDescription, setCustomDescription] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState(1)
  const [customIsTaxed, setCustomIsTaxed] = useState(true)
  const [customDiscount, setCustomDiscount] = useState(0)

  // Global Items State
  const [globalDescription, setGlobalDescription] = useState('')
  const [globalPrice, setGlobalPrice] = useState('')

  // Dropdown visibility and ref
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync internal items with parent if provided initially
  useEffect(() => {
    if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems)
    }
  }, [initialItems])

  // Calculations
  const calculations = useMemo(() => {
    let subtotal0 = 0
    let subtotal15 = 0
    let totalBudget = 0
    let discountTotal = 0

    const processed = items.map(item => {
      const q = item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)
      const cost = Number(item.estimatedCost || 0)
      const basePrice = cost * q
      const discount = basePrice * (Number(item.discountPct || 0) / 100)
      const lineTotal = basePrice - discount

      if (item.isTaxed === false) {
        subtotal0 += lineTotal
      } else {
        subtotal15 += lineTotal
      }
      
      discountTotal += discount
      totalBudget += lineTotal
      
      return { ...item, lineTotal }
    })

    const ivaAmount = subtotal15 * 0.15
    const grandTotal = subtotal0 + subtotal15 + ivaAmount

    return { subtotal0, subtotal15, totalBudget, discountTotal, ivaAmount, grandTotal, processed }
  }, [items])

  // Notify parent on change
  useEffect(() => {
    onItemsChange(items, calculations)
  }, [items, calculations, onItemsChange])

  const filteredMaterials = useMemo(() => {
    if (!searchMaterial.trim()) return []
    const terms = searchMaterial.toLowerCase().split(/\s+/).filter(Boolean)
    return materials.filter(m => {
      const targetText = `${m.name || ''} ${m.code || ''} ${m.category || ''}`.toLowerCase()
      return terms.every(term => targetText.includes(term))
    })
  }, [searchMaterial, materials])

  const selectFromCatalog = (m: any) => {
    setSelectedInventoryId(m.id)
    setCustomDescription(m.name)
    setCustomPrice(m.unitPrice.toString())
    setCustomQty(1)
    setCustomDiscount(0)
    setSearchMaterial('')
    // Scroll to the edit box for better mobile experience
    const box = document.getElementById('budget-edit-box')
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const addItemToList = (isGlobal = false) => {
    const newItem: BudgetItem = {
      materialId: isGlobal ? null : selectedInventoryId,
      name: isGlobal ? globalDescription.toUpperCase() : customDescription,
      quantity: isGlobal ? 'GLOBAL' : Number(customQty),
      unit: isGlobal ? 'GLOBAL' : 'UND',
      estimatedCost: Number(isGlobal ? globalPrice : customPrice),
      isTaxed: isGlobal ? true : customIsTaxed,
      discountPct: isGlobal ? 0 : Number(customDiscount),
      code: isGlobal ? 'GLOBAL' : (materials.find(m => m.id === selectedInventoryId)?.code || 'ESP')
    }

    setItems([...items, newItem])
    
    // Reset states
    if (isGlobal) {
      setGlobalDescription('')
      setGlobalPrice('')
    } else {
      setSelectedInventoryId(null)
      setCustomDescription('')
      setCustomPrice('')
      setCustomQty(1)
      setCustomDiscount(0)
    }
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }
  const inputGroupStyle = { marginBottom: '20px' }

  return (
    <div className="budget-builder-container animate-fade-in">
      <div className="budget-builder-grid">
        {/* Left Column: Controls */}
        <div className="budget-controls">
          <h4 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--text-secondary)' }}>Añadir Materiales o Servicios</h4>
          
          {/* Search bar */}
          <div style={{ ...inputGroupStyle, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Buscar en catálogo o inventario..." 
                value={searchMaterial} 
                onChange={e => {
                  setSearchMaterial(e.target.value)
                  setShowDropdown(true)
                }} 
                onFocus={() => setShowDropdown(true)}
                style={{ paddingLeft: '35px' }}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            {showDropdown && filteredMaterials.length > 0 && (
              <div className="catalog-dropdown" ref={dropdownRef}>
                {filteredMaterials.map(m => (
                  <div key={m.id} onClick={() => { selectFromCatalog(m); setShowDropdown(false); }} className="catalog-item">
                    <div style={{ fontWeight: '600', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{m.name}</span>
                      <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Seleccionar &rarr;</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>$ {Number(m.unitPrice).toFixed(2)} - {m.category || 'Sin Categoría'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config Box */}
          <div id="budget-edit-box" className={`edit-box ${selectedInventoryId ? 'active' : ''}`}>
            {selectedInventoryId && (
              <div className="inventory-badge">CONFIGURANDO MATERIAL DEL CATÁLOGO</div>
            )}
            
            <label style={{ ...labelStyle, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: '5px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Detalles del Ítem</span>
              {selectedInventoryId && (
                 <button type="button" onClick={() => { setSelectedInventoryId(null); setCustomDescription(''); setCustomPrice(''); }} style={{ color: 'var(--danger)', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>✕ Cancelar</button>
              )}
            </label>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Descripción</label>
              <input type="text" className="form-input" value={customDescription} onChange={e => setCustomDescription(e.target.value)} placeholder="Ej: Válvula de bola 2 pulgadas" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Precio Unitario ($)</label>
                <input type="number" step="0.01" className="form-input" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Cantidad (UND)</label>
                <input type="number" className="form-input" value={customQty} onChange={e => setCustomQty(Number(e.target.value))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={customIsTaxed} onChange={e => setCustomIsTaxed(e.target.checked)} />
                  <span className="text-sm">Aplica IVA 15%</span>
                </label>
                <div>
                   <label style={{ ...labelStyle, marginBottom: '5px', fontSize: '0.75rem' }}>Descuento %</label>
                   <input type="number" className="form-input-sm" value={customDiscount} onChange={e => setCustomDiscount(Number(e.target.value))} placeholder="0" />
                </div>
            </div>

            <button type="button" className={`btn ${selectedInventoryId ? 'btn-primary' : 'btn-secondary'} btn-full`} onClick={() => addItemToList(false)} disabled={!customDescription || !customPrice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px', display: 'inline-block'}}><path d="M12 5v14M5 12h14"/></svg>
              {selectedInventoryId ? 'Confirmar e Incluir al Listado' : 'Añadir Ítem Personalizado'}
            </button>
          </div>

          {/* Global items (Servicios) */}
          <div className="global-box">
            <label style={{ ...labelStyle, color: 'var(--primary)', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '5px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Añadir Servicio / Ítem GLOBAL
            </label>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Descripción del Concepto GLOBAL *</label>
              <input type="text" className="form-input" value={globalDescription} onChange={e => setGlobalDescription(e.target.value)} placeholder="Ej: Instalación Integral de Sistema de Bombeo" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Precio Total ($) *</label>
                <input type="number" step="0.01" className="form-input" value={globalPrice} onChange={e => setGlobalPrice(e.target.value)} placeholder="0.00" />
            </div>
            <button type="button" className="btn btn-primary btn-full" onClick={() => addItemToList(true)} disabled={!globalDescription || !globalPrice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px', display: 'inline-block'}}><path d="M12 5v14M5 12h14"/></svg>
              Añadir a Presupuesto
            </button>
          </div>
        </div>

        {/* Right Column: Table and Totals */}
        <div className="budget-summary">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Resumen Seleccionado</h4>
          </div>
          
          <div className="table-container card-shadow">
            <div style={{ overflowX: 'auto' }}>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>DESCRIPCIÓN</th>
                    <th style={{ textAlign: 'center' }}>CANT.</th>
                    <th style={{ textAlign: 'right' }}>UNIT. ($)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No hay ítems seleccionados. Usa el buscador o añade servicios para comenzar.
                    </td></tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '0.7rem', textAlign: 'center', opacity: 0.6 }}>{idx + 1}</td>
                        <td className="item-desc">
                            <div style={{ fontWeight: '600' }}>{item.name}</div>
                            {item.discountPct ? (
                                <div style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>Dcto: {item.discountPct}%</div>
                            ) : null}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{item.unit || 'UND'}</span>
                          <span style={{ fontWeight: item.quantity === 'GLOBAL' ? 'bold' : 'normal' }}>{item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity).toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>$ {Number(item.estimatedCost).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>$ {calculations.processed[idx].lineTotal.toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" onClick={() => removeItem(idx)} className="delete-btn">&times;</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="tfoot-label">SUBTOTAL TARIFA 0%</td>
                      <td className="tfoot-value">$ {calculations.subtotal0.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="tfoot-label">SUBTOTAL TARIFA 15%</td>
                      <td className="tfoot-value">$ {calculations.subtotal15.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="tfoot-label">IVA 15%</td>
                      <td className="tfoot-value">$ {calculations.ivaAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    <tr className="grand-total-row">
                      <td colSpan={4} className="tfoot-label-total">VALOR TOTAL ESTIMADO</td>
                      <td className="tfoot-value-total">$ {calculations.grandTotal.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {(showPreviewActions && items.length > 0) && (
            <div className="builder-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onGeneratePDF?.(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Vista Previa PDF
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onGeneratePDF?.(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Generar PDF Oficial
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .budget-builder-container {
          width: 100%;
        }
        .budget-builder-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
          gap: 30px;
        }
        .catalog-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-top: 5px;
          box-shadow: var(--shadow-lg);
          max-height: 250px;
          overflow-y: auto;
          padding: 8px;
        }
        .catalog-item {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 6px;
        }
        .catalog-item:hover {
          background-color: var(--primary-glow);
          transform: translateX(5px);
        }
        .edit-box {
          padding: 20px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background-color: var(--bg-card);
          margin-bottom: 15px;
          position: relative;
          transition: border-color 0.3s;
        }
        .edit-box.active {
          border: 2px solid var(--primary);
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
        }
        .inventory-badge {
          position: absolute;
          top: -12px;
          left: 20px;
          background-color: var(--primary);
          color: var(--bg-deep);
          padding: 2px 10px;
          borderRadius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
        }
        .global-box {
          padding: 20px;
          border: 1px solid var(--primary);
          border-radius: 12px;
          background-color: var(--primary-glow);
        }
        .table-container {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow-x: auto;
          background-color: var(--bg-card);
        }
        .budget-table {
          width: 100%;
          min-width: 340px;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .budget-table th {
          background-color: var(--bg-deep);
          padding: 12px;
          text-align: left;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .budget-table td {
          padding: 15px 12px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
        }
        .item-desc {
          max-width: 300px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .delete-btn {
          color: var(--danger);
          border: none;
          background: rgba(239, 68, 68, 0.1);
          cursor: pointer;
          font-size: 1.4rem;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .delete-btn:hover {
          background: var(--danger);
          color: white;
          transform: scale(1.1);
        }
        .tfoot-label {
          text-align: right;
          font-weight: bold;
          font-size: 0.75rem;
          padding: 10px 15px;
          background-color: var(--bg-deep);
        }
        .tfoot-value {
          text-align: right;
          font-weight: bold;
          background-color: var(--bg-deep);
          color: var(--text-main);
        }
        .grand-total-row {
          background-color: var(--primary-glow) !important;
        }
        .tfoot-label-total {
          text-align: right;
          font-weight: 800;
          font-size: 0.85rem;
          padding: 15px;
          color: var(--primary);
        }
        .tfoot-value-total {
          text-align: right;
          font-weight: 800;
          font-size: 1.2rem;
          color: var(--primary);
        }
        .builder-actions {
          padding: 20px 0;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .builder-actions .btn {
          flex: 1;
          min-width: 140px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }
        .form-input-sm {
          width: 100%;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-main);
          font-size: 0.8rem;
          outline: none;
        }
        .form-input-sm:focus {
          border-color: var(--primary);
        }

        @media (max-width: 992px) {
          .budget-builder-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .budget-table th, .budget-table td {
            padding: 10px 6px !important;
            font-size: 0.8rem !important;
          }
          .tfoot-label {
            font-size: 0.75rem !important;
            padding: 10px !important;
          }
          .tfoot-value {
            font-size: 0.85rem !important;
          }
          .tfoot-label-total {
            font-size: 0.85rem !important;
            padding: 15px !important;
          }
          .tfoot-value-total {
            font-size: 1.1rem !important;
          }
          .edit-box, .global-box {
            padding: 20px !important;
          }
          .builder-actions {
            padding: 15px 0 !important;
            gap: 10px !important;
          }
          .builder-actions .btn {
            padding: 12px !important;
            font-size: 0.85rem !important;
            min-width: 130px !important;
          }
        }

        @media (max-width: 600px) {
          .budget-table th:nth-child(1), .budget-table td:nth-child(1) {
            display: none;
          }
          /* Hide Unit Price on mobile to save space, show only total */
          .budget-table th:nth-child(4), .budget-table td:nth-child(4) {
            display: none; 
          }
          .budget-table th:nth-child(2), .budget-table td:nth-child(2) {
            padding-left: 10px !important;
          }
          .budget-table th:nth-child(6), .budget-table td:nth-child(6) {
            width: 35px !important;
          }
          .item-desc {
            max-width: 140px !important;
            font-size: 0.75rem !important;
          }
          .tfoot-label, .tfoot-label-total {
            padding: 10px 8px !important;
            font-size: 0.7rem !important;
            word-break: break-word;
          }
          .tfoot-value-total {
            font-size: 1rem !important;
          }
          .delete-btn {
            width: 32px !important;
            height: 32px !important;
            font-size: 1.2rem !important;
          }
          .catalog-dropdown {
            position: fixed;
            top: 20%;
            left: 10px;
            right: 10px;
            bottom: 20%;
            height: auto;
            max-height: none;
            width: auto;
            border: 2px solid var(--primary);
          }
        }

        @media (max-width: 400px) {
           .item-desc {
             max-width: 100px !important;
           }
           .tfoot-value-total {
             font-size: 0.9rem !important;
           }
           .tfoot-label-total {
             width: 60% !important;
           }
        }
      `}</style>
    </div>
  )
}
