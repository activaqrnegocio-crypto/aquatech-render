'use client'

import { useState, useMemo } from 'react'
import { getLocalNow, formatToEcuador, formatTimeEcuador, formatDateEcuador, toEcuadorISODate } from '@/lib/date-utils'

// Inline SVG icons to match project pattern and avoid lucide-react issues
const svgProps = (size: number, style?: React.CSSProperties, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', ...style }, className
})

const ChevronLeft = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="m15 18-6-6 6-6"/></svg>
const ChevronRight = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="m9 18 6-6-9-6"/></svg>
const Plus = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M12 5v14M5 12h14"/></svg>

interface CalendarViewProps {
  events: any[]
  onAddEvent: (date: Date) => void
  onEditEvent: (event: any) => void
  viewMode?: 'MONTH' | 'WEEK'
  isAdmin?: boolean
}

export default function CalendarView({
  events,
  onAddEvent,
  onEditEvent,
  viewMode: initialViewMode = 'MONTH',
  isAdmin = false
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(getLocalNow())
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>(initialViewMode)

  const monthName = formatToEcuador(currentDate, { month: 'long', year: 'numeric' })
  
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days = []
    let startDay = firstDay.getDay()
    for (let i = 0; i < startDay; i++) {
        days.push(null)
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push(new Date(year, month, i))
    }
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day // Start on Sunday
    startOfWeek.setDate(diff)
    
    const days = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek)
        d.setDate(startOfWeek.getDate() + i)
        days.push(d)
    }
    return days
  }, [currentDate])

  const navigate = (dir: 'PREV' | 'NEXT') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'MONTH') {
      newDate.setMonth(currentDate.getMonth() + (dir === 'NEXT' ? 1 : -1))
    } else {
      newDate.setDate(currentDate.getDate() + (dir === 'NEXT' ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const getEventsForDay = (day: Date) => {
    if (!day) return []
    // Compare using Ecuador timezone to avoid UTC day mismatch
    const dayStr = toEcuadorISODate(day)
    return events.filter(e => {
        const eventDayStr = toEcuadorISODate(e.startTime)
        return eventDayStr === dayStr
    })
  }

  const statusColors: any = {
    PENDIENTE: 'var(--warning)',
    EN_PROGRESO: 'var(--primary)',
    COMPLETADA: 'var(--success)',
    CANCELADA: 'var(--danger)'
  }

  return (
    <div className="calendar-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.25rem', color: 'var(--text)' }}>
            {viewMode === 'MONTH' ? monthName : `Semana de ${formatToEcuador(weekDays[0], { day: 'numeric', month: 'short' })}`}
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('PREV')}><ChevronLeft size={18}/></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(getLocalNow())}>Hoy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('NEXT')}><ChevronRight size={18}/></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-deep)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'MONTH' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('MONTH')}
              style={{ padding: '6px 12px' }}
            >
              Mes
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'WEEK' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('WEEK')}
              style={{ padding: '6px 12px' }}
            >
              Semana
            </button>
          </div>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => onAddEvent(currentDate)}>
                <Plus size={16}/> Agendar
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '1px', 
        backgroundColor: 'var(--border)', 
        borderRadius: 'var(--radius-lg)', 
        overflow: 'hidden',
        border: '1px solid var(--border)' 
      }}>
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d} style={{ backgroundColor: 'var(--bg-deep)', padding: '10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}

        {(viewMode === 'MONTH' ? daysInMonth : weekDays).map((day, idx) => {
          const dayEvents = getEventsForDay(day as Date)
          const isToday = day && day.toDateString() === getLocalNow().toDateString()
          const isDifferentMonth = day && day.getMonth() !== currentDate.getMonth()

          return (
            <div 
              key={idx} 
              style={{ 
                backgroundColor: day ? 'var(--bg-card)' : 'transparent', 
                minHeight: viewMode === 'MONTH' ? '120px' : '300px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                opacity: isDifferentMonth ? 0.4 : 1,
                cursor: day && isAdmin ? 'pointer' : 'default',
                transition: 'background var(--transition-fast)'
              }}
              onClick={() => day && isAdmin && onAddEvent(day)}
              className={day ? 'calendar-cell' : ''}
            >
              {day && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: isToday ? 800 : 500, 
                    color: isToday ? 'var(--primary)' : 'var(--text)',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: isToday ? 'var(--primary-glow)' : 'transparent'
                  }}>
                    {day.getDate()}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
                {dayEvents.map(event => (
                  <button 
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        textAlign: 'left',
                        padding: '6px 8px', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.75rem', 
                        backgroundColor: 'var(--bg-surface)', 
                        borderLeft: `3px solid ${statusColors[event.status]}`,
                        color: 'var(--text)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {formatTimeEcuador(event.startTime)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .calendar-cell:hover {
            background-color: var(--bg-card-hover) !important;
        }
        @media (max-width: 768px) {
            .calendar-container {
                overflow-x: auto;
            }
            .calendar-cell {
                min-height: 80px !important;
            }
        }
      `}</style>
    </div>
  )
}
