'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InventarioClient({ initialMaterials }: { initialMaterials: any[] }) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [isSyncing, setIsSyncing] = useState(false)

  // Modal de Creación
  const [showModal, setShowModal] = useState(false)
  const [newItem, setNewItem] = useState({ code: '', name: '', description: '', unitPrice: 0, stock: 1, category: '' })
  
  const router = useRouter()

  // Cache materials in IndexedDB for offline access
  useEffect(() => {
    if (initialMaterials && initialMaterials.length > 0) {
      try {
        const request = indexedDB.open('AquatechOfflineDB')
        request.onsuccess = () => {
          const db = request.result
          // Check if 'materialsCache' store exists
          if (db.objectStoreNames.contains('materialsCache')) {
            const tx = db.transaction('materialsCache', 'readwrite')
            const store = tx.objectStore('materialsCache')
            store.clear()
            initialMaterials.forEach(m => store.put(m))
          }
          db.close()
        }
      } catch (e) {
        // Silently fail — IndexedDB not critical for online use
      }
    }
  }, [initialMaterials])

  // If initialMaterials is empty (offline page load), try loading from IndexedDB
  useEffect(() => {
    if (initialMaterials.length === 0) {
      loadFromIndexedDB()
    }
  }, [])

  const loadFromIndexedDB = async () => {
    try {
      const request = indexedDB.open('AquatechOfflineDB')
      request.onsuccess = () => {
        const db = request.result
        if (db.objectStoreNames.contains('materialsCache')) {
          const tx = db.transaction('materialsCache', 'readonly')
          const store = tx.objectStore('materialsCache')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            if (getAll.result && getAll.result.length > 0) {
              setMaterials(getAll.result)
            }
          }
        }
        db.close()
      }
    } catch (e) {
      console.error('Failed to load materials from IndexedDB', e)
    }
  }

  const categories = Array.from(new Set(materials.map(m => m.category))).filter(Boolean)

  const filtered = materials.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'ALL' || m.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { label: 'Sin Stock', class: 'status-cancelado' }
    if (stock < 10) return { label: 'Bajo Stock', class: 'status-pendiente' }
    return { label: 'Disponible', class: 'status-activo' }
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.code || !newItem.name) return alert('Código y nombre son obligatorios')
    
    const payload = { ...newItem, unitPrice: Number(newItem.unitPrice), stock: Number(newItem.stock) }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
            const { db } = await import('@/lib/db')
            await db.outbox.add({
               type: 'MATERIAL',
               projectId: 0,
               payload,
               timestamp: Date.now(),
               status: 'pending'
            })
            const tempMaterial = { 
               ...payload, 
               id: Date.now(), 
               isActive: true, 
               createdAt: new Date(), 
               updatedAt: new Date()
            }
            setMaterials([tempMaterial, ...materials])
            setShowModal(false)
            setNewItem({ code: '', name: '', description: '', unitPrice: 0, stock: 1, category: '' })
            alert('Material encolado sin conexión. Se sincronizará pronto.')
            return
        } catch (e) {
            alert('Error en IndexedDB local.')
            return
        }
    }

    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const result = await res.json()
        setMaterials([result, ...materials])
        setShowModal(false)
        setNewItem({ code: '', name: '', description: '', unitPrice: 0, stock: 1, category: '' })
        router.refresh()
      } else {
        alert("Error al cargar en el servidor")
      }
    } catch(err) {
      alert("Error de conexión. Falló al guardar")
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header mb-lg">
        <div>
          <h2 className="page-title">Inventario</h2>
          <p className="page-subtitle">Gestión centralizada de materiales, equipos y suministros.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
           <div className="kpi-card" style={{ padding: '10px 20px', marginBottom: 0, '--kpi-color': 'var(--primary)' } as any}>
              <div className="kpi-label">Items Totales</div>
              <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{materials.length}</div>
           </div>
           <div className="kpi-card" style={{ padding: '10px 20px', marginBottom: 0, '--kpi-color': 'var(--danger)' } as any}>
              <div className="kpi-label">Sin Stock</div>
              <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{materials.filter(m => m.stock <= 0).length}</div>
           </div>
        </div>
      </div>

      {/* ── Search & Filters — MOBILE RESPONSIVE ── */}
      <div className="card mb-lg" style={{ padding: '15px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 250px', minWidth: '0' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre o código..." 
              className="form-input"
              style={{ width: '100%', fontSize: '0.95rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 1 180px', minWidth: '120px' }}>
            <select 
              className="form-select"
              style={{ width: '100%' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Todas</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" style={{ height: '42px', whiteSpace: 'nowrap', flex: '0 0 auto' }} onClick={() => setShowModal(true)}>
            + Nuevo Item
          </button>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: '15px' }}>
          <div className="card shadow-lg" style={{ width: '100%', maxWidth: '500px', padding: '25px' }}>
             <h3>Crear Nuevo Material</h3>
             <form onSubmit={handleSaveItem}>
                <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                     <div>
                       <label>Código Interno</label>
                       <input autoFocus required className="form-input" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} placeholder="Ej: MAT-001" />
                     </div>
                     <div>
                       <label>Categoría</label>
                       <input className="form-input" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="Ej: Herramientas" />
                     </div>
                   </div>
                   <div>
                     <label>Nombre del Producto</label>
                     <input required className="form-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                   </div>
                   <div>
                     <label>Descripción</label>
                     <textarea className="form-input" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})}></textarea>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                     <div>
                        <label>Stock Inicial</label>
                        <input type="number" required className="form-input" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})} min="0" />
                     </div>
                     <div>
                        <label>Precio Unitario ($)</label>
                        <input type="number" required step="0.01" className="form-input" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} min="0" />
                     </div>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
                   <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                   <button type="submit" className="btn btn-primary">Registrar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* ── Mobile-optimized card view for small screens ── */}
      <div className="card" style={{ padding: 0 }}>
        {/* Desktop table */}
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '500px' }}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Código</th>
                <th>Nombre</th>
                <th style={{ display: 'var(--hide-on-mobile, table-cell)' }}>Categoría</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Stock</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((material) => {
                return (
                  <tr key={material.id}>
                    <td style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '0.8rem' }}>{material.code}</td>
                    <td>
                      <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{material.name}</div>
                      {material.description && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{material.description.substring(0, 40)}...</div>}
                    </td>
                    <td style={{ display: 'var(--hide-on-mobile, table-cell)' }}>
                      <span className="badge badge-neutral" style={{ textTransform: 'none', fontSize: '0.75rem' }}>{material.category}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: Number(material.stock) < 10 ? 'var(--danger)' : 'inherit' }}>
                        {material.stock}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary)' }}>$ {Number(material.unitPrice).toFixed(2)}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    <div className="empty-state-title">No se encontraron materiales</div>
                    <div className="empty-state-text">Intenta ajustar tu búsqueda o filtros.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mostrando los primeros 100 de {filtered.length} items.
          </div>
        )}
      </div>
    </div>
  )
}
