'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function TeamPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'ALL' | 'MANAGEMENT' | 'OPERATORS' | 'SUBCONTRACTORS'>('ALL')
  const [error, setError] = useState('')
  const [isClient, setIsClient] = useState(false)
  
  // Hydration fix
  useEffect(() => {
    setIsClient(true)
  }, [])

  const currentUserRole = (session?.user as any)?.role
  const isSuperAdmin = currentUserRole === 'SUPERADMIN'
  const isAuthorized = currentUserRole && (isSuperAdmin || currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'OPERATOR',
    email: '',
    phone: '',
    image: null as string | null,
    branch: '',
    permissions: [] as string[]
  })

  // Security check - Use router for cleaner redirect
  useEffect(() => {
    if (status === 'authenticated' && !isAuthorized) {
      window.location.href = '/admin'
    }
  }, [status, isAuthorized])

  useEffect(() => {
    if (isAuthorized) {
      fetchUsers()
    }
  }, [isAuthorized])

  // Handle Role Selection Presets
  useEffect(() => {
    const adminModules = ['dashboard', 'marketing', 'blog', 'calendario', 'proyectos', 'proyectos_admin', 'equipo', 'reportes', 'cotizaciones', 'inventario', 'recursos']
    const operatorModules = ['proyectos', 'cotizaciones', 'inventario', 'recursos']
    const subModules = ['proyectos']

    if (formData.role.includes('ADMIN') || formData.role === 'SUPERADMIN') {
      setFormData(prev => ({ ...prev, permissions: adminModules }))
    } else if (formData.role === 'OPERATOR') {
      setFormData(prev => ({ ...prev, permissions: operatorModules }))
    } else if (formData.role === 'SUBCONTRATISTA') {
      setFormData(prev => ({ ...prev, permissions: subModules }))
    }
  }, [formData.role])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pass = ''
    for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData({ ...formData, password: pass })
  }

  const generateUsername = () => {
    if (!formData.name) return
    const cleanName = formData.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9 ]/g, "") // Remove symbols
      .trim()
      .replace(/\s+/g, "_") // Spaces to underscores
    
    setFormData({ ...formData, username: cleanName })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const resetForm = () => {
    setFormData({ 
      name: '', 
      username: '', 
      password: '', 
      role: 'OPERATOR', 
      email: '', 
      phone: '', 
      image: null, 
      branch: '', 
      permissions: ['proyectos', 'cotizaciones', 'inventario', 'recursos'] 
    })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          permissions: JSON.stringify(formData.permissions)
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || 'Error al crear usuario')
      
      setShowModal(false)
      resetForm()
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar a este miembro del equipo?')) return
    
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchUsers()
      else {
          const data = await res.json()
          alert(data.error || 'Error al eliminar')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const currentUserId = (session?.user as any)?.id ? Number((session?.user as any).id) : null

  // Group and Sort
  const management = users.filter(u => {
    if (!isSuperAdmin) return false;
    return u.role === 'SUPERADMIN' || u.role === 'ADMIN' || u.role === 'ADMINISTRADORA'
  }).sort((a, b) => {
    if (a.role === 'SUPERADMIN' && b.role !== 'SUPERADMIN') return -1
    if (a.role !== 'SUPERADMIN' && b.role === 'SUPERADMIN') return 1
    return 0
  })

  const operators = users.filter(u => u.role === 'OPERATOR')
  const subcontratistas = users.filter(u => u.role === 'SUBCONTRATISTA')

  const formatDate = (date: any) => {
    if (!date) return 'Sin fecha'
    try {
      return new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(date))
    } catch {
      return 'Fecha inválida'
    }
  }

  if (!isClient || loading) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--primary)' }}>
      <strong>Iniciando Gestión de Equipo...</strong>
    </div>
  )

  return (
    <div className="operator-dashboard">
      <div className="operator-header" style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <h2 className="page-title">Gestión de Equipo</h2>
          <p className="page-subtitle">Administra los accesos y funciones de tu personal.</p>
        </div>
        {isSuperAdmin && (
          <button 
            className="btn btn-primary" 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px', width: '100%', maxWidth: '280px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>
            </svg>
            Añadir Miembro
          </button>
        )}
      </div>
      
      <div className="tab-navigation-container">
        <div className="tabs">
          <button className={`tab ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => setActiveTab('ALL')}>Todos</button>
          <button className={`tab ${activeTab === 'MANAGEMENT' ? 'active' : ''}`} onClick={() => setActiveTab('MANAGEMENT')}>Administración</button>
          <button className={`tab ${activeTab === 'OPERATORS' ? 'active' : ''}`} onClick={() => setActiveTab('OPERATORS')}>Operadores</button>
          <button className={`tab ${activeTab === 'SUBCONTRACTORS' ? 'active' : ''}`} onClick={() => setActiveTab('SUBCONTRACTORS')}>Subcontratistas</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {/* Management */}
        {(activeTab === 'ALL' || activeTab === 'MANAGEMENT') && management.length > 0 && (
          <div>
            <h3 className="section-title-premium" style={{ color: 'var(--success)' }}>
               <span style={{ backgroundColor: 'var(--success)' }} /> Administración
            </h3>
            <div className="grid-responsive">
              {management.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} currentUserId={currentUserId} />
              ))}
            </div>
          </div>
        )}

        {/* Operators */}
        {(activeTab === 'ALL' || activeTab === 'OPERATORS') && (
          <div>
            <h3 className="section-title-premium" style={{ color: 'var(--primary)' }}>
               <span style={{ backgroundColor: 'var(--primary)' }} /> Operadores de Campo
            </h3>
            <div className="grid-responsive">
              {operators.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} currentUserId={currentUserId} />
              ))}
              {operators.length === 0 && (
                <div className="empty-state-box">No hay operadores registrados actualmente.</div>
              )}
            </div>
          </div>
        )}

        {/* Subcontratistas */}
        {(activeTab === 'ALL' || activeTab === 'SUBCONTRACTORS') && (
          <div>
            <h3 className="section-title-premium" style={{ color: 'var(--warning)' }}>
               <span style={{ backgroundColor: 'var(--warning)' }} /> Subcontratistas
            </h3>
            <div className="grid-responsive">
              {subcontratistas.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} currentUserId={currentUserId} />
              ))}
              {subcontratistas.length === 0 && (
                <div className="empty-state-box">No hay subcontratistas registrados actualmente.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div className="modal-overlay-premium">
          <div className="card animate-scale-in modal-content-premium">
            <div className="modal-header-premium">
              <div>
                <h2 className="modal-title-gradient">Añadir Miembro</h2>
                <p className="modal-subtitle">Configura los datos personales y permisos de acceso.</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="modal-close-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '40px' }}>
              {error && (
                <div className="error-alert-premium">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <div className="modal-form-grid">
                <div className="avatar-upload-container">
                  <div 
                    onClick={() => document.getElementById('user-image-upload')?.click()}
                    className="avatar-drop-zone"
                  >
                    {formData.image ? (
                      <img src={formData.image} className="avatar-preview" alt="Preview" />
                    ) : (
                      <div className="avatar-placeholder">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span>Sube tu foto</span>
                      </div>
                    )}
                    <div className="avatar-add-icon">
                      <PlusIcon />
                    </div>
                  </div>
                  <input type="file" id="user-image-upload" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  <p className="avatar-hint">Recomendado: Cuadrado<br/>JPG o PNG</p>
                </div>

                <div className="modal-basic-fields">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="input-label-premium">Nombre Completo *</label>
                    <input type="text" className="form-input-premium" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Abel Aquatech" />
                  </div>
                  
                  <div className="form-group">
                    <label className="input-label-premium">Usuario @ *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="form-input-premium" style={{ flex: 1 }} required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="abel_aq" />
                      <button type="button" onClick={generateUsername} className="btn-icon-premium">✨</button>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="input-label-premium">Sucursal *</label>
                    <select className="form-input-premium" required value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      <option value="Loja">Loja</option>
                      <option value="Yantzaza">Yantzaza</option>
                      <option value="Malacatos-Loja">Malacatos-Loja</option>
                      <option value="Vilcabamba-Loja">Vilcabamba-Loja</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="input-label-premium">Rol de Acceso *</label>
                    <div className="role-selector-grid">
                      {[
                        { val: 'OPERATOR', label: 'Operador', icon: '👷' },
                        { val: 'ADMIN', label: 'Administrador/a', icon: '💼' }
                      ].map(role => (
                        <div 
                          key={role.val}
                          onClick={() => setFormData({ ...formData, role: role.val })}
                          className={`role-card-premium ${formData.role === role.val ? 'active' : ''}`}
                        >
                          <div className="role-icon-large">{role.icon}</div>
                          <div className="role-label-small">{role.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-contact-fields">
                <div className="form-group">
                  <label className="input-label-premium">Correo Electrónico *</label>
                  <input type="email" className="form-input-premium" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ejemplo@aquatech.com" />
                </div>
                <div className="form-group">
                  <label className="input-label-premium">Teléfono</label>
                  <input type="text" className="form-input-premium" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} placeholder="593..." />
                </div>
                <div className="form-group">
                  <label className="input-label-premium">Contraseña de Seguridad *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" className="form-input-premium" style={{ letterSpacing: '2px', flex: 1 }} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Ingresa o genera..." />
                    <button type="button" className="btn btn-secondary" onClick={generatePassword} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshIcon /> Generar
                    </button>
                  </div>
                </div>
              </div>

              {/* PERMISSIONS SELECTOR */}
              <div className="permissions-container-premium">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                  <label className="permissions-title-premium">Módulos Permitidos</label>
                  <div className="permissions-counter">{formData.permissions.length} Seleccionados</div>
                </div>
                
                <div className="permissions-grid-premium">
                  {[
                    { slug: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { slug: 'marketing', label: 'Marketing', icon: '🚀' },
                    { slug: 'blog', label: 'Blog', icon: '📝' },
                    { slug: 'calendario', label: 'Calendario', icon: '📅' },
                    { slug: 'proyectos', label: 'Proyectos Operador', icon: '🏗️' },
                    { slug: 'proyectos_admin', label: 'Proyectos Admin', icon: '🏢' },
                    { slug: 'equipo', label: 'Equipo', icon: '👥' },
                    { slug: 'reportes', label: 'Reportes', icon: '📁' },
                    { slug: 'cotizaciones', label: 'Cotizaciones', icon: '💰' },
                    { slug: 'inventario', label: 'Inventario', icon: '📦' },
                    { slug: 'recursos', label: 'Recursos', icon: '📚' }
                  ].map(module => {
                    const active = formData.permissions.includes(module.slug)
                    return (
                      <div 
                        key={module.slug}
                        onClick={() => {
                          const newPerms = active 
                            ? formData.permissions.filter(p => p !== module.slug)
                            : [...formData.permissions, module.slug]
                          setFormData({ ...formData, permissions: newPerms })
                        }}
                        className={`permission-chip-premium ${active ? 'active' : ''}`}
                      >
                         <div className="checkbox-mini">
                           {active && <CheckIcon />}
                         </div>
                         <span className="chip-label">{module.label}</span>
                         <span className="chip-icon">{module.icon}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '20px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); resetForm(); }}>Descartar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '18px', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 15px 30px rgba(56, 189, 248, 0.3)' }}>
                  Registrar Miembro del Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style>{`
        .operator-dashboard {
          padding: 20px;
          padding-bottom: 120px;
          min-height: 100vh;
          max-width: 1400px;
          margin: 0 auto;
        }
        .grid-responsive {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 25px;
        }
        .section-title-premium {
          font-size: 1.1rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
        }
        .section-title-premium span {
          width: 4px;
          height: 16px;
          border-radius: 2px;
        }
        .empty-state-box {
          grid-column: 1 / -1;
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 24px;
          border: 2px dashed rgba(255, 255, 255, 0.05);
        }
        .modal-overlay-premium {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
          backgroundColor: rgba(5, 10, 20, 0.75); display: flex; alignItems: center; justifyContent: center; z-index: 1000;
          backdrop-filter: blur(16px);
          padding: 20px;
        }
        .modal-content-premium {
          width: 850px; maxWidth: 100%; maxHeight: 90vh; overflow-y: auto;
          background: linear-gradient(135deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 32px;
        }
        .modal-header-premium {
          padding: 32px 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex; justify-content: space-between; align-items: center;
          position: sticky; top: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); z-index: 10;
        }
        .modal-title-gradient {
          font-size: 1.75rem; font-weight: 800; 
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .modal-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }
        .modal-close-btn { 
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
          color: var(--text); padding: 10px; border-radius: 14px; cursor: pointer;
        }
        .error-alert-premium {
          background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 16px; 
          border-radius: 16px; margin-bottom: 30px; font-size: 0.9rem; 
          border: 1px solid rgba(239, 68, 68, 0.2); display: flex; align-items: center; gap: 12px;
        }
        .modal-form-grid { display: grid; grid-template-columns: 220px 1fr; gap: 40px; margin-bottom: 40px; }
        .avatar-drop-zone {
          width: 180px; height: 180px; border-radius: 40px; 
          background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          position: relative; transition: all 0.3s;
        }
        .avatar-preview { width: 100%; height: 100%; object-fit: cover; border-radius: 38px; }
        .avatar-placeholder { text-align: center; color: var(--text-muted); display: flex; flexDirection: column; align-items: center; gap: 10px; }
        .avatar-placeholder span { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .avatar-add-icon {
          position: absolute; bottom: 12px; right: 12px; width: 32px; height: 32px; 
          border-radius: 10px; background: var(--primary); color: white;
          display: flex; items-center: center; justify-content: center;
        }
        .avatar-hint { font-size: 0.7rem; color: var(--text-muted); text-align: center; margin-top: 10px; }
        .modal-basic-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .input-label-premium { display: block; margin-bottom: 8px; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .form-input-premium { 
          width: 100%; padding: 14px 18px; border-radius: 14px; font-size: 0.95rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff;
        }
        .btn-icon-premium { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 0 12px; cursor: pointer; }
        .role-selector-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .role-card-premium {
          padding: 12px; border-radius: 16px; cursor: pointer; text-align: center; transition: all 0.2s;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
        }
        .role-card-premium.active { background: rgba(56, 189, 248, 0.1); border-color: var(--primary); }
        .role-icon-large { font-size: 1.25rem; margin-bottom: 4px; }
        .role-label-small { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); }
        .role-card-premium.active .role-label-small { color: var(--primary); }
        
        .modal-contact-fields { display: grid; grid-template-columns: 1.2fr 1fr 1.5fr; gap: 24px; margin-bottom: 40px; }
        .permissions-container-premium {
          background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03);
          border-radius: 24px; padding: 32px; margin-bottom: 40px;
        }
        .permissions-title-premium { font-size: 1rem; font-weight: 800; color: #fff; }
        .permissions-counter { font-size: 0.75rem; color: var(--primary); font-weight: 700; background: rgba(56, 189, 248, 0.1); padding: 4px 12px; border-radius: 8px; }
        .permissions-grid-premium { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .permission-chip-premium {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 16px;
          background: rgba(24, 33, 50, 0.4); border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer; transition: all 0.2s;
        }
        .permission-chip-premium.active { background: rgba(56, 189, 248, 0.1); border-color: var(--primary); }
        .checkbox-mini { width: 22px; height: 22px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); display: flex; items-center: center; justify-content: center; }
        .permission-chip-premium.active .checkbox-mini { background: var(--primary); border-color: var(--primary); }
        .chip-label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }
        .permission-chip-premium.active .chip-label { color: #fff; }
        .chip-icon { margin-left: auto; opacity: 0.4; font-size: 0.9rem; }
        
        @media (max-width: 768px) {
          .modal-form-grid { grid-template-columns: 1fr; gap: 30px; }
          .modal-contact-fields { grid-template-columns: 1fr; }
          .grid-responsive { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

function UserCard({ user, onDelete, formatDate, currentUserRole, currentUserId }: any) {
  const isSelf = String(user.id) === String(currentUserId)
  const isSuperAdminUser = user.role === 'SUPERADMIN'
  const isCurrentUserSuperAdmin = currentUserRole === 'SUPERADMIN'
  
  const statusColor = 
    isSuperAdminUser ? '#F59E0B' : 
    user.role === 'ADMIN' ? '#10B981' : 
    user.role === 'ADMINISTRADORA' ? '#3B82F6' : 
    user.role === 'SUBCONTRATISTA' ? '#F59E0B' : 
    '#6366f1'

  const canDelete = isCurrentUserSuperAdmin && !isSelf

  return (
    <Link 
      href={`/admin/team/${user.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div className="card-premium-user" style={{ borderColor: isSelf ? 'var(--primary)' : 'rgba(255,255,255,0.03)' }}>
        {isSelf && <div className="user-badge-self">TÚ</div>}
        
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ 
              fontSize: '0.65rem', fontWeight: '900', color: statusColor, 
              backgroundColor: `${statusColor}10`, padding: '4px 10px', 
              borderRadius: '8px', border: `1px solid ${statusColor}30`,
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {user.role}
            </span>
            {user.branch && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>📍 {user.branch}</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="user-avatar-circle" style={{ border: `2px solid ${statusColor}20` }}>
              {user.image ? (
                <img src={user.image} alt={user.name} />
              ) : (
                <div className="avatar-initials">{user.name.charAt(0)}</div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: '800', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.username}</p>
            </div>
          </div>
        </div>

        <div className="user-card-bottom">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontWeight: '800' }}>Desde</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#cbd5e1' }}>{formatDate(user.createdAt)}</span>
          </div>

          {canDelete && (
            <button 
              className="delete-user-btn"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(user.id); }}
            >
              <TrashIcon />
            </button>
          )}
        </div>

        <style>{`
          .card-premium-user {
            height: 100%; display: flex; flex-direction: column; overflow: hidden;
            border-radius: 28px; border: 1px solid rgba(255,255,255,0.03);
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%);
            backdrop-filter: blur(10px); transition: all 0.3s ease; position: relative;
          }
          .card-premium-user:hover {
            transform: translateY(-5px);
            border-color: rgba(56, 189, 248, 0.3);
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          }
          .user-badge-self {
            position: absolute; top: -10px; right: 20px; 
            background: var(--primary); color: white; padding: 3px 10px; 
            border-radius: 10px; font-size: 0.6rem; font-weight: 900; z-index: 5;
            box-shadow: 0 5px 15px rgba(56, 189, 248, 0.4);
          }
          .user-avatar-circle {
            width: 56px; height: 56px; border-radius: 18px; overflow: hidden;
            background: rgba(255,255,255,0.03); flex-shrink: 0;
          }
          .user-avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
          .avatar-initials { 
            width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; fontWeight: 900; color: rgba(255,255,255,0.1); background: var(--bg-deep);
          }
          .user-card-bottom {
            margin-top: auto; padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.03);
            background: rgba(255,255,255,0.01); display: flex; justify-content: space-between; align-items: center;
          }
          .delete-user-btn {
            background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15);
            color: #ef4444; width: 36px; height: 36px; border-radius: 12px;
            display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
          }
          .delete-user-btn:hover { background: rgba(239, 68, 68, 0.2); transform: scale(1.05); }
        `}</style>
      </div>
    </Link>
  )
}

// Minimal Icons
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
