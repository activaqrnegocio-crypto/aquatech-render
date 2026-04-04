'use client'

import { useState, useEffect, useMemo } from 'react'
import CalendarView from '@/components/Calendar/CalendarView'
import AppointmentModal from '@/components/Calendar/AppointmentModal'
import CalendarAssistant from '@/components/Calendar/CalendarAssistant'

interface AdminCalendarClientProps {
  operators: any[]
  projects: any[]
}

export default function AdminCalendarClient({ operators, projects }: AdminCalendarClientProps) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const url = `/api/appointments?userId=${selectedOperatorId}`
      const res = await fetch(url)
      if (res.ok) {
        setAppointments(await res.json())
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [selectedOperatorId])

  const handleSaveAppointment = async (data: any) => {
    const isNew = !data.id
    const url = isNew ? '/api/appointments' : `/api/appointments/${data.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      setIsModalOpen(false)
      fetchAppointments()
    }
  }

  const handleDeleteAppointment = async (id: number) => {
    // Optimistic UI update
    const previousAppointments = [...appointments]
    setAppointments(prev => prev.filter(a => a.id !== id))
    setIsModalOpen(false)

    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('Failed to delete')
      }
      // Silently refresh in background to ensure sync
      fetchAppointments(true)
    } catch (error) {
      console.error('Error deleting appointment:', error)
      alert('No se pudo eliminar la tarea. Se restaurará en el calendario.')
      setAppointments(previousAppointments)
    }
  }

  return (
    <div className="admin-calendar-page animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">Calendario Maestro</h1>
          <p className="page-subtitle">Gestión centralizada de tareas y agenda del equipo</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}>
          + Nueva Tarea
        </button>
      </div>

      <div className="card mb-lg" style={{ marginTop: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', padding: 'var(--space-sm)' }}>
           <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filtrar por Operador:</label>
           <select 
             className="form-select" 
             style={{ width: 'auto', minWidth: '200px' }}
             value={selectedOperatorId}
             onChange={(e) => setSelectedOperatorId(e.target.value)}
           >
             <option value="all">Todos los operadores</option>
             {operators.map(op => (
               <option key={op.id} value={op.id}>{op.name}</option>
             ))}
           </select>
           {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando agenda...</span>}
        </div>

        <div className="calendar-wrapper">
          <CalendarView 
            events={appointments}
            isAdmin={true}
            viewMode="WEEK"
            onAddEvent={(date) => { 
                setEditingEvent({ startTime: date }); 
                setIsModalOpen(true); 
            }}
            onEditEvent={(event) => { 
                setEditingEvent(event); 
                setIsModalOpen(true); 
            }}
          />
        </div>
      </div>

      {isModalOpen && (
        <AppointmentModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          initialData={editingEvent}
          userId={selectedOperatorId === 'all' ? 0 : Number(selectedOperatorId)} // This will be handled by the specialized modal
          projects={projects}
          operators={operators} // New prop for admin selection
          isAdminView={true}
        />
      )}

      <CalendarAssistant />

      <style jsx>{`
        .calendar-wrapper {
          min-height: 600px;
        }
      `}</style>
    </div>
  )
}
