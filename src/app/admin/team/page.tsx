'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'

export default function TeamPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'ALL' | 'MANAGEMENT' | 'OPERATORS' | 'SUBCONTRACTORS'>('ALL')
  const [error, setError] = useState('')
  
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
    const adminModules = ['dashboard', 'marketing', 'blog', 'calendario', 'proyectos', 'equipo', 'reportes', 'cotizaciones', 'inventario', 'recursos']
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

  if (loading) return <div className="p-10 text-center">Cargando equipo...</div>

  const currentUserId = (session?.user as any)?.id ? Number((session?.user as any).id) : null

  // Filter groups
  // Only SuperAdmin sees other SuperAdmins (API also filters this, but safeguard here)
  const management = users.filter(u => {
    if (!isSuperAdmin) return false;
    return u.role === 'SUPERADMIN' || u.role === 'ADMIN' || u.role === 'ADMINISTRADORA' || u.role === 'ADMINISTRADOR'
  }).sort((a, b) => {
    if (a.role === 'SUPERADMIN' && b.role !== 'SUPERADMIN') return -1
    if (a.role !== 'SUPERADMIN' && b.role === 'SUPERADMIN') return 1
    return 0
  })

  const operators = users.filter(u => {
    return u.role === 'OPERATOR'
  })

  const subcontratistas = users.filter(u => {
    return u.role === 'SUBCONTRATISTA'
  })

  const formatDate = (date: any) => {
    if (!date) return 'Sin fecha'
    return new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(date))
  }

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
      
      <div className="tabs" style={{ marginBottom: '30px' }}>
        <button 
          className={`tab ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          Todos
        </button>
        <button 
          className={`tab ${activeTab === 'MANAGEMENT' ? 'active' : ''}`}
          onClick={() => setActiveTab('MANAGEMENT')}
        >
          Administración
        </button>
        <button 
          className={`tab ${activeTab === 'OPERATORS' ? 'active' : ''}`}
          onClick={() => setActiveTab('OPERATORS')}
        >
          Operadores
        </button>
        <button 
          className={`tab ${activeTab === 'SUBCONTRACTORS' ? 'active' : ''}`}
          onClick={() => setActiveTab('SUBCONTRACTORS')}
        >
          Subcontratistas
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {/* Management (Admins & Superadmin) */}
        {(activeTab === 'ALL' || activeTab === 'MANAGEMENT') && management.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700', opacity: 0.9 }}>
              <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--success)', borderRadius: '2px' }} />
              Administración
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
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700' }}>
              <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
              Operadores de Campo
            </h3>
            <div className="grid-responsive">
              {operators.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} currentUserId={currentUserId} />
              ))}
              {operators.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-deep)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                  No hay operadores registrados actualmente.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subcontratistas */}
        {(activeTab === 'ALL' || activeTab === 'SUBCONTRACTORS') && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700' }}>
              <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--warning)', borderRadius: '2px' }} />
              Subcontratistas
            </h3>
            <div className="grid-responsive">
              {subcontratistas.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} currentUserId={currentUserId} />
              ))}
              {subcontratistas.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-deep)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                  No hay subcontratistas registrados actualmente.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper for Image Upload */}
      <input 
        type="file" 
        id="user-image-upload" 
        style={{ display: 'none' }} 
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
              setFormData({ ...formData, image: reader.result as string })
            }
            reader.readAsDataURL(file)
          }
        }}
      />

      {/* Add Member Modal */}
      {showModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(5, 10, 20, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(16px) saturate(180%)',
          padding: '20px'
        }}>
          <div className="card animate-scale-in" style={{ 
            width: '850px', 
            maxWidth: '100%', 
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '0', 
            borderRadius: '32px', 
            border: '1px solid rgba(56, 189, 248, 0.25)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.95) 100%)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: '32px 40px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(10px)',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Añadir Miembro
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Configura los datos personales y permisos de acceso.</p>
              </div>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', cursor: 'pointer', padding: '10px', borderRadius: '14px', display: 'flex', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 68, 68, 0.15)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '40px' }}>
              {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '16px', borderRadius: '16px', marginBottom: '30px', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '40px', marginBottom: '40px' }}>
                {/* Left side: Avatar */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div 
                    onClick={() => document.getElementById('user-image-upload')?.click()}
                    style={{ 
                      width: '180px', height: '180px', 
                      borderRadius: '40px', 
                      backgroundColor: 'rgba(255,255,255,0.02)', 
                      border: '2px dashed rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden',
                      position: 'relative',
                      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                      e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.05)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
                    }}
                  >
                    {formData.image ? (
                      <img src={formData.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '10px', opacity: 0.5 }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sube tu foto</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    id="user-image-upload" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    style={{ display: 'none' }} 
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>Recomendado: Cuadrado<br/>formato JPG o PNG</p>
                </div>

                {/* Right side: Basic fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre Completo *</label>
                    <input type="text" className="form-input" style={{ padding: '14px 18px', borderRadius: '14px', fontSize: '1rem' }} required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Abel Aquatech" />
                  </div>
                  
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario @ *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="form-input" style={{ padding: '14px 18px', borderRadius: '14px', flex: 1 }} required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="abel_aq" />
                      <button type="button" onClick={generateUsername} className="btn btn-secondary" style={{ padding: '0 12px', borderRadius: '14px' }} title="Generar sugerencia">
                        ✨
                      </button>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sucursal *</label>
                    <select className="form-input" style={{ padding: '14px 18px', borderRadius: '14px' }} required value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      <option value="Loja">Loja</option>
                      <option value="Yantzaza">Yantzaza</option>
                      <option value="Malacatos-Loja">Malacatos-Loja</option>
                      <option value="Vilcabamba-Loja">Vilcabamba-Loja</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol de Acceso *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      {[
                        { val: 'OPERATOR', label: 'Operador', icon: '👷' },
                        { val: 'ADMIN', label: 'Administrador/a', icon: '💼' }
                      ].map(role => (
                        <div 
                          key={role.val}
                          onClick={() => setFormData({ ...formData, role: role.val })}
                          style={{ 
                            padding: '12px 10px', 
                            borderRadius: '16px', 
                            border: `1px solid ${formData.role === role.val ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                            backgroundColor: formData.role === role.val ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{role.icon}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: formData.role === role.val ? 'var(--primary)' : 'var(--text-muted)' }}>{role.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: '24px', marginBottom: '40px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico *</label>
                  <input type="email" className="form-input" style={{ padding: '14px 18px', borderRadius: '14px' }} required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ejemplo@aquatech.com" />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</label>
                  <input type="text" className="form-input" style={{ padding: '14px 18px', borderRadius: '14px' }} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} placeholder="593..." />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña de Seguridad *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" className="form-input" style={{ padding: '14px 18px', borderRadius: '14px', letterSpacing: '2px', flex: 1 }} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Ingresa o genera..." />
                    <button type="button" className="btn btn-secondary" onClick={generatePassword} style={{ padding: '14px 20px', borderRadius: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                      Generar
                    </button>
                  </div>
                </div>
              </div>

              {/* PERMISSIONS SELECTOR */}
              <div style={{ 
                marginBottom: '40px', 
                padding: '32px', 
                backgroundColor: 'rgba(255,255,255,0.02)', 
                borderRadius: '24px', 
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                  <label style={{ fontSize: '1rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.01em' }}>
                    Pestañas Permitidas (Módulos)
                  </label>
                  <div style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', fontWeight: '700' }}>
                    {formData.permissions.length} Seleccionados
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {[
                    { slug: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { slug: 'marketing', label: 'Marketing', icon: '🚀' },
                    { slug: 'blog', label: 'Blog', icon: '📝' },
                    { slug: 'calendario', label: 'Calendario', icon: '📅' },
                    { slug: 'proyectos', label: 'Proyectos', icon: '🏗️' },
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
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', 
                          padding: '12px 16px', borderRadius: '16px', 
                          backgroundColor: active ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.03)', 
                          border: `1px solid ${active ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: active ? 'translateY(-2px)' : 'none',
                          boxShadow: active ? '0 10px 20px rgba(56, 189, 248, 0.1)' : 'none'
                        }}
                      >
                         <div style={{ 
                           width: '24px', height: '24px', borderRadius: '6px', 
                           backgroundColor: active ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           transition: 'all 0.2s'
                         }}>
                           {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                         </div>
                         <span style={{ fontSize: '0.85rem', fontWeight: '700', color: active ? '#fff' : 'var(--text-muted)' }}>{module.label}</span>
                         <span style={{ marginLeft: 'auto', opacity: active ? 1 : 0.3 }}>{module.icon}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '18px', borderRadius: '18px', fontWeight: 'bold' }} onClick={() => { setShowModal(false); resetForm(); }}>Descartar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '18px', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 15px 30px rgba(56, 189, 248, 0.3)' }}>
                  Registrar Miembro del Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ user, onDelete, formatDate, currentUserRole, currentUserId }: { user: any, onDelete: (id: number) => void, formatDate: (d: any) => string, currentUserRole: string, currentUserId: number | null }) {
  const isSuperAdminUser = user.role === 'SUPERADMIN'
  const isCurrentUserSuperAdmin = currentUserRole === 'SUPERADMIN'

  const statusColor = 
    isSuperAdminUser ? '#F59E0B' : 
    user.role === 'ADMIN' ? '#10B981' : 
    user.role === 'ADMINISTRADORA' ? '#3B82F6' : 
    user.role === 'SUBCONTRATISTA' ? '#F59E0B' : 
    '#6366f1'
  
  const canDelete = isCurrentUserSuperAdmin || (
    (currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA' || currentUserRole === 'ADMINISTRADOR') && 
    user.role !== 'OPERATOR' && 
    user.role !== 'SUPERADMIN' &&
    user.id !== currentUserId
  )

  return (
    <Link 
      href={`/admin/team/${user.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div className="card h-full p-0 overflow-hidden user-card-premium" style={{ 
        display: 'flex', flexDirection: 'column', 
        borderRadius: '32px', 
        border: '1px solid rgba(255, 255, 255, 0.03)',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
        backdropFilter: 'blur(12px)',
        minHeight: '300px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        boxShadow: isSuperAdminUser ? `0 20px 50px ${statusColor}10` : '0 15px 35px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '32px' }}>
          {/* Header Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ 
              padding: '6px 14px', 
              borderRadius: '12px', 
              backgroundColor: `${statusColor}15`, 
              color: statusColor, 
              fontSize: '0.7rem', 
              fontWeight: '800', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              border: `1px solid ${statusColor}25`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {isSuperAdminUser && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>}
              {user.role}
            </div>
            {user.branch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: '700' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {user.branch}
              </div>
            )}
          </div>

          {/* User Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
            <div style={{ 
              width: '74px', height: '74px', 
              borderRadius: '24px', 
              padding: '3px',
              background: `linear-gradient(135deg, ${statusColor}50, transparent)`,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '21px', overflow: 'hidden', backgroundColor: 'var(--bg-deep)' }}>
                {user.image ? (
                  <img src={user.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={user.name} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '1.5rem', fontWeight: '900' }}>
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 4px 0', color: '#fff', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>@{user.username}</p>
            </div>
          </div>

          {/* Quick Stats / Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              {user.phone || 'Sin teléfono'}
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div style={{ 
          marginTop: 'auto', 
          padding: '24px 32px', 
          backgroundColor: 'rgba(255,255,255,0.015)',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>Antigüedad</span>
             <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: '700' }}>{formatDate(user.createdAt)}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
             {canDelete && (
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(user.id); }}
                  style={{ 
                    width: '42px', height: '42px', 
                    borderRadius: '14px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                    color: '#ef4444', 
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
             )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .user-card-premium:hover {
          transform: translateY(-8px) scale(1.01);
          border-color: rgba(56, 189, 248, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
        }
      `}</style>
    </Link>
  )
}
