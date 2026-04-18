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

    const handleRefresh = () => fetchAppointments(true)
    window.addEventListener('calendar-refresh', handleRefresh)
    return () => window.removeEventListener('calendar-refresh', handleRefresh)
  }, [selectedOperatorId])

  const handleSaveAppointment = async (data: any) => {
    const isNew = !data.id
    const url = isNew ? '/api/appointments' : `/api/appointments/${data.id}`
    const method = isNew ? 'POST' : 'PATCH'

    // Build payload — include userIds for multi-assignment on create
    const payload: any = { ...data }
    if (isNew && data.userIds && Array.isArray(data.userIds)) {
      payload.userIds = data.userIds
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
      <div className="page-header calendar-header-mobile">
        <div>
          <h1 className="page-title">Calendario Maestro</h1>
          <p className="page-subtitle">Gestión centralizada de tareas y agenda del equipo</p>
        </div>
        <button className="btn btn-primary add-task-btn" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}>
          + Agendar
        </button>
      </div>

      <div className="card mb-lg calendar-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="filter-container">
           <label className="filter-label">Filtrar por Operador:</label>
           <select 
             className="form-select operator-select" 
             value={selectedOperatorId}
             onChange={(e) => setSelectedOperatorId(e.target.value)}
           >
             <option value="all">Todos los operadores</option>
             {operators.map(op => (
               <option key={op.id} value={op.id}>{op.name}</option>
             ))}
           </select>
           {loading && <span className="loading-text">Cargando agenda...</span>}
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
        .calendar-header-mobile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }
        .filter-container {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          margin-bottom: var(--space-md);
          padding: var(--space-sm);
        }
        .filter-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .operator-select {
          width: auto;
          min-width: 200px;
        }
        .loading-text {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .admin-calendar-page {
            overflow-x: hidden;
            width: 100%;
            max-width: 100vw;
          }
          .calendar-header-mobile {
            flex-direction: column;
            align-items: flex-start;
            padding: 0 10px;
          }
          .add-task-btn {
            width: 100%;
          }
          .filter-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            width: 100%;
          }
          .operator-select {
            width: 100%;
          }
          .calendar-card {
            padding: 12px !important;
            margin: 10px 0 !important;
            border-radius: 0;
            border-left: none;
            border-right: none;
            width: 100%;
            box-sizing: border-box;
          }
          .calendar-wrapper {
            min-height: 400px;
            width: 100%;
            overflow-x: hidden;
          }
        }
      `}</style>
    </div>
  )
}
