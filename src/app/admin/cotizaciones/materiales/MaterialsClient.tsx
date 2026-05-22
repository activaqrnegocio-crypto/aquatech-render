'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MaterialsClient({ initialMaterials, categories }: any) {
  const router = useRouter()
  const [materials, setMaterials] = useState(initialMaterials)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: '', name: '', category: '', unit: 'unidad', unitPrice: '', stock: '0', description: ''
  })

  const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = materials.filter((m: any) => {
    if (searchTerms.length === 0) return true
    const targetText = `${m.name || ''} ${m.code || ''} ${m.category || ''}`.toLowerCase()
    return searchTerms.every(term => targetText.includes(term))
  })

  const handleOpenModal = (m: any = null) => {
    if (m) {
      setEditingMaterial(m)
      setFormData({
        code: m.code, name: m.name, category: m.category || '', 
        unit: m.unit || 'unidad', unitPrice: m.unitPrice.toString(), 
        stock: m.stock.toString(), description: m.description || ''
      })
    } else {
      setEditingMaterial(null)
      setFormData({ code: '', name: '', category: '', unit: 'unidad', unitPrice: '', stock: '0', description: '' })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingMaterial ? `/api/materials/${editingMaterial.id}` : '/api/materials'
    const method = editingMaterial ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsModalOpen(false)
        router.refresh()
        // Simple local update for responsiveness
        const updated = await res.json()
        if (editingMaterial) {
          setMaterials(materials.map((m: any) => m.id === updated.id ? { ...updated, unitPrice: Number(updated.unitPrice) } : m))
        } else {
          setMaterials([...materials, { ...updated, unitPrice: Number(updated.unitPrice) }])
        }
      }
    } catch (err) {
      alert("Error guardando material")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este material?")) return
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMaterials(materials.filter((m: any) => m.id !== id))
      }
    } catch (err) {
      alert("Error eliminando")
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <input 
          type="text" 
          placeholder="Buscar por nombre, código o categoría..." 
          className="form-input" 
          style={{ flex: 1 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Nuevo Material</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)' }}>
              <th style={{ padding: '15px' }}>Código</th>
              <th style={{ padding: '15px' }}>Nombre</th>
              <th style={{ padding: '15px' }}>Categoría</th>
              <th style={{ padding: '15px' }}>Unidad</th>
              <th style={{ padding: '15px' }}>Precio (L.)</th>
              <th style={{ padding: '15px' }}>Stock</th>
              <th style={{ padding: '15px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m: any) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{m.code}</td>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{m.name}</td>
                <td style={{ padding: '15px' }}><span className="status-badge status-lead" style={{ fontSize: '0.7rem' }}>{m.category || 'N/A'}</span></td>
                <td style={{ padding: '15px' }}>{m.unit}</td>
                <td style={{ padding: '15px', color: 'var(--primary)', fontWeight: 'bold' }}>{m.unitPrice.toFixed(2)}</td>
                <td style={{ padding: '15px' }}>{m.stock}</td>
                <td style={{ padding: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleOpenModal(m)} className="btn btn-ghost btn-sm" style={{ padding: '5px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="btn btn-ghost btn-sm" style={{ padding: '5px', color: 'var(--danger)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h2>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Código</label>
                  <input className="form-input" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required placeholder="BOM-001" />
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <input className="form-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Bombas, Riego..." />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre del Material</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Unidad</label>
                  <select className="form-input" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    <option value="unidad">Unidad</option>
                    <option value="metro">Metro</option>
                    <option value="kg">Kg</option>
                    <option value="global">Global</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Precio Unitario</label>
                  <input type="number" step="0.01" className="form-input" value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Stock</label>
                  <input type="number" className="form-input" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción (Opcional)</label>
                <textarea className="form-input" style={{ height: '80px' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
