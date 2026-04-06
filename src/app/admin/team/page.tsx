'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'

export default function TeamPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  
  const currentUserRole = (session?.user as any)?.role
  const isSuperAdmin = currentUserRole === 'SUPERADMIN'

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'OPERATOR',
    email: '',
    phone: '',
    image: null as string | null
  })

  useEffect(() => {
    fetchUsers()
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || 'Error al crear usuario')
      
      setShowModal(false)
      setFormData({ name: '', username: '', password: '', role: 'OPERATOR', email: '', phone: '', image: null })
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
    if (u.id === currentUserId && !isSuperAdmin) return false
    return u.role === 'SUPERADMIN' || u.role === 'ADMIN' || u.role === 'ADMINISTRADORA'
  }).sort((a, b) => {
    if (a.role === 'SUPERADMIN' && b.role !== 'SUPERADMIN') return -1
    if (a.role !== 'SUPERADMIN' && b.role === 'SUPERADMIN') return 1
    return 0
  })

  const operators = users.filter(u => {
    if (u.id === currentUserId && !isSuperAdmin) return false
    return u.role === 'OPERATOR'
  })

  const subcontratistas = users.filter(u => {
    if (u.id === currentUserId && !isSuperAdmin) return false
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {/* Management (Admins & Superadmin) */}
        {management.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700', opacity: 0.9 }}>
              <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--success)', borderRadius: '2px' }} />
              Administración
            </h3>
            <div className="grid-responsive">
              {management.map(u => (
                <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} />
              ))}
            </div>
          </div>
        )}

        {/* Operators */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700' }}>
            <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
            Operadores de Campo
          </h3>
          <div className="grid-responsive">
            {operators.map(u => (
              <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} />
            ))}
            {operators.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-deep)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                No hay operadore registrados actualmente.
              </div>
            )}
          </div>
        </div>

        {/* Subcontratistas */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', fontWeight: '700' }}>
            <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--warning)', borderRadius: '2px' }} />
            Subcontratistas
          </h3>
          <div className="grid-responsive">
            {subcontratistas.map(u => (
              <UserCard key={u.id} user={u} onDelete={handleDelete} formatDate={formatDate} currentUserRole={currentUserRole} />
            ))}
            {subcontratistas.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-deep)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                No hay subcontratistas registrados actualmente.
              </div>
            )}
          </div>
        </div>
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
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(10px)'
        }}>
          <div className="card animate-scale-in" style={{ width: '500px', maxWidth: '95%', padding: '32px', borderRadius: '24px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Añadir Miembro</h2>
              <button 
                onClick={() => setShowModal(false)} 
                style={{ background: 'var(--bg-surface)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
                <div 
                  onClick={() => document.getElementById('user-image-upload')?.click()}
                  style={{ 
                    width: '110px', height: '110px', 
                    borderRadius: '24px', 
                    backgroundColor: 'var(--bg-deep)', 
                    border: '2px dashed var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  {formData.image ? (
                    <img src={formData.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <div style={{ fontSize: '0.7rem', marginTop: '6px', fontWeight: 'bold' }}>FOTO PERFIL</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Nombre Completo *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Usuario *</label>
                  <input type="text" className="form-input" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="juan.perez" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Rol del Sistema *</label>
                <select className="form-input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="OPERATOR">Operador (Campo)</option>
                  <option value="SUBCONTRATISTA">Subcontratista</option>
                  {isSuperAdmin && (
                    <>
                      <option value="ADMINISTRADORA">Administradora (Oficina)</option>
                      <option value="ADMIN">Administrador (Gestión)</option>
                      <option value="SUPERADMIN">Super Administrador</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Contraseña *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" className="form-input" style={{ letterSpacing: '2px' }} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="********" />
                  <button type="button" className="btn btn-secondary" onClick={generatePassword} style={{ whiteSpace: 'nowrap' }}>Auto-Generar</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Teléfono</label>
                  <input type="text" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+593..." />
                </div>
                <div className="form-group" style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Email</label>
                  <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="juan@aquatech.com" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ user, onDelete, formatDate, currentUserRole }: { user: any, onDelete: (id: number) => void, formatDate: (d: any) => string, currentUserRole: string }) {
  const isSuperAdminUser = user.role === 'SUPERADMIN'
  const isCurrentUserSuperAdmin = currentUserRole === 'SUPERADMIN'

  // Colors based on role
  const statusColor = 
    isSuperAdminUser ? '#F59E0B' : // Gold for SuperAdmin
    user.role === 'ADMIN' ? 'var(--success)' : 
    user.role === 'ADMINISTRADORA' ? 'var(--info)' : 
    user.role === 'SUBCONTRATISTA' ? 'var(--warning)' : 
    'var(--primary)'
  
  // Can delete if: 
  // 1. Current user is SuperAdmin
  // 2. OR user to delete is NOT a SuperAdmin
  const canDelete = isCurrentUserSuperAdmin || (!isSuperAdminUser)

  return (
    <Link 
      href={`/admin/team/${user.id}`}
      className="card h-full p-0 overflow-hidden user-card-mobile" style={{ 
      display: 'block', textDecoration: 'none',
      borderRadius: '24px', 
      border: isSuperAdminUser ? `2px solid ${statusColor}40` : '1px solid var(--border-color)',
      minHeight: '280px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      boxShadow: isSuperAdminUser ? `0 20px 40px ${statusColor}10` : 'none'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
        {/* Background Accent Gradient */}
        <div style={{ 
            position: 'absolute', top: 0, right: 0, 
            width: '120px', height: '120px', 
            background: `linear-gradient(135deg, transparent 60%, ${statusColor}10 60%)`,
            zIndex: 0
        }}></div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
              {/* Role Badge and Avatar Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ 
                    width: '60px', height: '60px', 
                    borderRadius: '16px', 
                    backgroundColor: 'var(--bg-surface)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '1.5rem', 
                    color: statusColor, 
                    fontWeight: '800', 
                    border: `2px solid ${statusColor}25`,
                    boxShadow: `0 8px 16px ${statusColor}10`,
                    overflow: 'hidden',
                    flexShrink: 0
                }}>
                  {user.image ? (
                      <img src={user.image} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      user.name.substring(0, 2).toUpperCase()
                    )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '0.62rem', 
                      fontWeight: '800',
                      backgroundColor: `${statusColor}15`,
                      color: statusColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '6px'
                  }}>
                    {isSuperAdminUser && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                    )}
                    {user.role === 'SUPERADMIN' ? 'Super Admin' : 
                     user.role === 'ADMIN' ? 'Admin' : 
                     user.role === 'ADMINISTRADORA' ? 'Oficina' : 
                     user.role === 'SUBCONTRATISTA' ? 'Sub' : 'Operador'}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text)', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500' }}>@{user.username}</div>
                </div>
              </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {user.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {user.phone}
                </div>
              )}
              {user.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', wordBreak: 'break-all' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {user.activeProjectsCount || 0}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proyectos</div>
              </div>
            </div>
            
            {canDelete && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(user.id); }}
                className="btn-icon"
                style={{ 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    border: 'none', 
                    color: 'var(--danger)', 
                    cursor: 'pointer',
                    padding: '10px', 
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    zIndex: 10
                }}
                title="Eliminar Miembro"
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 600px) {
          .user-card-mobile {
            min-height: 220px !important;
            padding: 20px !important;
          }
          .user-card-mobile h3 {
            font-size: 1.1rem !important;
          }
          .operator-header {
            margin-bottom: 20px !important;
          }
          .operator-header h2 {
            font-size: 1.4rem !important;
          }
        }
      `}</style>
    </Link>
  )
}
