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
    // Convert Sunday=0 to Monday-based: Mon=0, Tue=1, ..., Sun=6
    let startDay = (firstDay.getDay() + 6) % 7
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
    // Monday-based: if Sunday (0), go back 6 days; otherwise go back (day-1)
    const diff = startOfWeek.getDate() - ((day + 6) % 7)
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

  const getEventColor = (event: any) => {
    // Priority: Manual status colors as requested
    if (event.status === 'COMPLETADA') return 'var(--success)'; // VERDE
    if (event.status === 'ATRASADA') return 'var(--danger)';    // ROJO
    if (event.status === 'PENDIENTE') return 'var(--warning)';  // AMARILLO

    // Fallback logic for legacy events or other statuses
    const today = getLocalNow();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.startTime);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today && event.status !== 'COMPLETADA') {
        return 'var(--danger)'; // ATRASADA (ROJO)
    }
    return 'var(--warning)'; // PENDIENTE (AMARILLO)
  }

  return (
    <div className="calendar-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <h2 className="cal-title">
            {viewMode === 'MONTH' ? monthName : `Semana de ${formatToEcuador(weekDays[0], { day: 'numeric', month: 'short' })}`}
          </h2>
          <div className="cal-nav">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('PREV')}><ChevronLeft size={18}/></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(getLocalNow())}>Hoy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('NEXT')}><ChevronRight size={18}/></button>
          </div>
        </div>

        <div className="cal-toolbar-right">
          <div className="cal-view-toggle">
            <button 
              className={`btn btn-sm ${viewMode === 'MONTH' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('MONTH')}
            >
              Mes
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'WEEK' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('WEEK')}
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

      <div className="calendar-grid-wrapper">
        <div className={`calendar-grid ${viewMode === 'WEEK' ? 'is-week-view' : ''}`}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="calendar-header-cell">
              <span className="full-day">{d}</span>
              <span className="short-day">{d[0]}</span>
            </div>
          ))}

          {(viewMode === 'MONTH' ? daysInMonth : weekDays).map((day, idx) => {
            const dayEvents = getEventsForDay(day as Date)
            const isToday = day && day.toDateString() === getLocalNow().toDateString()
            const isDifferentMonth = day && day.getMonth() !== currentDate.getMonth()

            return (
              <div 
                key={idx} 
                className={`calendar-day-cell ${day ? 'calendar-cell' : 'calendar-empty'} ${isToday ? 'is-today' : ''} ${isDifferentMonth ? 'is-diff-month' : ''} ${viewMode === 'WEEK' ? 'week-cell' : 'month-cell'}`}
                onClick={() => day && isAdmin && onAddEvent(day)}
              >
                {day && (
                  <div className="day-header">
                    <span className="mobile-week-day-name">
                      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day.getDay()]}
                    </span>
                    <span className={`day-number ${isToday ? 'today' : ''}`}>
                      {day.getDate()}
                    </span>
                  </div>
                )}

                <div className="day-events-container">
                  {dayEvents.map(event => (
                    <button 
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                      className="event-pill"
                      style={{ borderLeft: `3px solid ${getEventColor(event)}` }}
                    >
                      <div className="event-title">{event.title}</div>
                      <div className="event-time">
                          {formatTimeEcuador(event.startTime)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        /* ========== TOOLBAR ========== */
        .cal-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .cal-toolbar-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .cal-title {
          margin: 0;
          text-transform: capitalize;
          font-size: 1.25rem;
          color: var(--text);
        }
        .cal-nav {
          display: flex;
          gap: 4px;
        }
        .cal-toolbar-right {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cal-view-toggle {
          display: flex;
          background: var(--bg-deep);
          border-radius: var(--radius-md);
          padding: 4px;
        }
        .calendar-grid-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 1px;
          background: var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border);
          min-width: 0;
        }
        .calendar-header-cell {
          background: var(--bg-deep);
          padding: 10px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .short-day { display: none; }

        /* ========== DAY CELLS ========== */
        .calendar-day-cell {
          background: var(--bg-card);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: default;
          transition: background var(--transition-fast);
        }
        .calendar-cell {
          cursor: pointer;
        }
        .calendar-cell:hover {
          background: var(--bg-card-hover) !important;
        }
        .calendar-empty {
          background: transparent;
        }
        .is-diff-month {
          opacity: 0.4;
        }
        .month-cell {
          min-height: 120px;
        }
        .week-cell {
          min-height: 300px;
        }

        /* ========== DAY HEADER ========== */
        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .mobile-week-day-name {
          display: none;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
        }
        .day-number {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .day-number.today {
          font-weight: 800;
          color: var(--primary);
          background: var(--primary-glow);
        }

        /* ========== EVENT PILLS ========== */
        .day-events-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          flex: 1;
        }
        .event-pill {
          display: flex;
          flex-direction: column;
          text-align: left;
          padding: 6px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          background: var(--bg-surface);
          color: var(--text);
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease;
          box-shadow: var(--shadow-sm);
        }
        .event-title {
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-time {
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        /* ========== MOBILE ========== */
        @media (max-width: 768px) {
          .calendar-container {
            gap: var(--space-xs) !important;
            width: 100%;
            overflow-x: hidden;
            box-sizing: border-box;
          }
          .cal-toolbar {
            gap: 0.5rem;
            padding: 0 4px;
          }
          .cal-toolbar-left {
            gap: 0.4rem;
            width: 100%;
            justify-content: space-between;
          }
          .cal-title {
            font-size: 0.9rem;
          }
          .cal-toolbar-right {
            width: 100%;
            justify-content: space-between;
            gap: 5px;
          }
          .calendar-grid-wrapper {
            overflow-x: hidden; /* Evitar scroll horizontal forzado */
            width: 100%;
            box-sizing: border-box;
          }
          .calendar-grid {
            border-radius: var(--radius-md);
            width: 100%;
            grid-template-columns: repeat(7, 1fr); /* Por defecto 7, pero la semana lo pisa */
          }
          .full-day { display: none; }
          .short-day { display: inline; }
          .calendar-header-cell {
            padding: 5px 2px;
            font-size: 0.6rem;
          }
          .calendar-day-cell {
            padding: 3px;
            box-sizing: border-box;
            min-width: 0;
          }
          .month-cell {
            min-height: 60px;
          }
          .week-cell {
            min-height: 130px;
          }
          .day-header {
            margin-bottom: 4px;
          }
          .day-number {
            width: 20px;
            height: 20px;
            font-size: 0.7rem;
          }
          .event-pill {
            padding: 3px 4px;
            font-size: 0.6rem;
            width: 100%;
            box-sizing: border-box;
          }
          .event-time {
            display: block;
            font-size: 0.5rem;
            margin-top: 1px;
          }
          .event-title {
            font-size: 0.6rem;
          }
          .day-events-container {
            gap: 3px;
            width: 100%;
          }
          
          /* Week View Mobile Overrides (4 top, 3 bottom) */
          .is-week-view.calendar-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          .is-week-view .calendar-header-cell {
            display: none !important;
          }
          .is-week-view .mobile-week-day-name {
            display: block;
            text-transform: uppercase;
            margin-bottom: 2px;
            font-size: 0.7rem;
          }
          .is-week-view .day-header {
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
