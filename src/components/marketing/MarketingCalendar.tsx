'use client'

import React, { useState, useEffect } from 'react'
import { getMonthlySocialPosts } from '@/actions/marketing-calendar'
import PostDetailsModal from './PostDetailsModal'

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function MarketingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDayPosts, setSelectedDayPosts] = useState<any[] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  useEffect(() => {
    fetchPosts()
  }, [month, year])

  const fetchPosts = async () => {
    setLoading(true)
    const res = await getMonthlySocialPosts(month, year)
    if (res.success && res.posts) {
      setPosts(res.posts)
    }
    setLoading(false)
  }

  const getDaysInMonth = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    const days = []
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
        days.push(null)
    }
    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i))
    }
    return days
  }

  const days = getDaysInMonth(month, year)

  const changeMonth = (offset: number) => {
    const newDate = new Date(year, month + offset, 1)
    setCurrentDate(newDate)
  }

  const handleDayClick = (day: Date) => {
    const dayPosts = posts.filter(p => {
        const pDate = new Date(p.scheduledAt)
        return pDate.getDate() === day.getDate() &&
               pDate.getMonth() === day.getMonth() &&
               pDate.getFullYear() === day.getFullYear()
    })
    if (dayPosts.length > 0) {
        setSelectedDayPosts(dayPosts)
        setIsModalOpen(true)
    }
  }

  return (
    <div className="marketing-calendar-container mt-5">
      <div className="card shadow-sm p-4" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div className="calendar-header d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0 }}>
            📅 Calendario Editorial de Contenidos
          </h2>
          <div className="calendar-nav d-flex gap-2">
            <button 
              className="btn btn-outline-secondary" 
              onClick={() => changeMonth(-1)}
              style={{ padding: '0.4rem 0.8rem', borderRadius: '8px' }}
            >
              &lt; Anterior
            </button>
            <div style={{ minWidth: '150px', textAlign: 'center', fontWeight: 'bold', alignSelf: 'center', color: 'var(--text-color)' }}>
              {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
            <button 
              className="btn btn-outline-secondary" 
              onClick={() => changeMonth(1)}
              style={{ padding: '0.4rem 0.8rem', borderRadius: '8px' }}
            >
              Siguiente &gt;
            </button>
          </div>
        </div>

        <div className="calendar-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '1px', 
          background: 'var(--border-color)', 
          borderRadius: '8px', 
          overflow: 'hidden',
          border: '1px solid var(--border-color)'
        }}>
          {DAYS_OF_WEEK.map(day => (
            <div key={day} style={{ background: 'var(--app-bg)', padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            if (!day) return <div key={i} style={{ background: 'var(--card-bg)', minHeight: '100px' }}></div>

            const dayPosts = posts.filter(p => {
              const pDate = new Date(p.scheduledAt)
              return pDate.getDate() === day.getDate() &&
                     pDate.getMonth() === day.getMonth() &&
                     pDate.getFullYear() === day.getFullYear()
            })

            const isToday = new Date().toDateString() === day.toDateString()

            return (
              <div 
                key={i} 
                onClick={() => handleDayClick(day)}
                style={{ 
                  background: 'var(--card-bg)', 
                  minHeight: '110px', 
                  padding: '0.5rem',
                  cursor: dayPosts.length > 0 ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                  position: 'relative'
                }}
                className={dayPosts.length > 0 ? 'hover-day' : ''}
              >
                <div style={{ 
                  fontSize: '0.9rem', 
                  fontWeight: isToday ? 'bold' : 'normal',
                  color: isToday ? 'var(--primary-color)' : 'var(--text-muted)',
                  background: isToday ? 'rgba(8, 145, 178, 0.1)' : 'transparent',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  marginBottom: '4px'
                }}>
                  {day.getDate()}
                </div>
                
                <div className="day-posts d-flex flex-wrap gap-1">
                  {dayPosts.map((post, pi) => (
                    <div key={pi} style={{ width: '100%' }}>
                      {post.variants?.map((v: any, vi: number) => (
                        <div key={vi} style={{ 
                          fontSize: '0.65rem', 
                          padding: '2px 4px', 
                          borderRadius: '3px',
                          background: v.platform === 'INSTAGRAM' ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' : '#1877F2',
                          color: 'white',
                          marginBottom: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {v.platform === 'INSTAGRAM' ? 'IG' : 'FB'}: {v.caption?.substring(0, 15)}...
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isModalOpen && selectedDayPosts && (
        <PostDetailsModal 
          posts={selectedDayPosts} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}

      <style jsx>{`
        .calendar-grid :global(.hover-day:hover) {
          background: rgba(var(--primary-rgb), 0.05) !important;
        }
      `}</style>
    </div>
  )
}
