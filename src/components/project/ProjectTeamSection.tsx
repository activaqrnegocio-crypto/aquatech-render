'use client'

// v373: Sección de Equipo Asignado — compartido entre Admin y Operador (ambos pueden editar)
interface ProjectTeamSectionProps {
  project: any
  operators: any[]
  selectedTeam: number[]
  isEditingTeam: boolean
  isSavingTeam: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onToggleMember: (id: number) => void
}

export default function ProjectTeamSection({
  project,
  operators,
  selectedTeam,
  isEditingTeam,
  isSavingTeam,
  onEdit,
  onCancel,
  onSave,
  onToggleMember,
}: ProjectTeamSectionProps) {
  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Equipo Asignado
          {project?._pendingTeamSync && (
            <span style={{ fontSize: '0.65rem', padding: '1px 6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', animation: 'pulse 2s infinite' }}>
              Sincronizando...
            </span>
          )}
        </h3>
        {!isEditingTeam ? (
          <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={onCancel} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--text-muted)' }} disabled={isSavingTeam}>Cancelar</button>
            <button onClick={onSave} className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} disabled={isSavingTeam}>{isSavingTeam ? '...' : 'Guardar'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {!isEditingTeam ? (
          <>
            {(project?.team || []).map((member: any) => {
              const name = member.user?.name || member.name || 'Operador';
              const phone = member.user?.phone || member.phone || 'Sin número';
              const initials = name.substring(0,2).toUpperCase();
              
              return (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{phone}</div>
                  </div>
                </div>
              );
            })}
            {(!project?.team || project.team.length === 0) && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '10px' }}>No hay operadores asignados.</div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {operators.map((op: any) => (
              <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedTeam.includes(op.id)}
                  onChange={() => onToggleMember(op.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontSize: '0.95rem' }}>{op.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{op.phone || 'Sin WhatsApp'}</div>
                </div>
              </label>
            ))}
            {operators.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay operadores registrados en el sistema.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
