'use client'

// v373: Tabs de navegación compartidos — Admin y Operador usan los mismos tabs
// Ambos roles ahora tienen acceso a: Chat, Galería, Archivos Finales

interface ProjectTabsProps {
  activeTab: string
  isSmallScreen: boolean
  galleryLabel: string
  onTabClick: (tab: string) => void
}

const TABS = [
  { id: 'CHAT', label: 'Chat', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  ), activeColor: 'var(--primary)', bgColor: 'rgba(0, 112, 192, 0.1)', gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)' },
  
  { id: 'GALLERY', label: 'Planos', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
  ), activeColor: 'var(--warning)', bgColor: 'rgba(245, 158, 11, 0.1)', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  
  { id: 'EVIDENCE', label: 'Archivos Finales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
  ), activeColor: '#d946ef', bgColor: 'rgba(217, 70, 239, 0.1)', gradient: 'linear-gradient(135deg, #a855f7, #d946ef)' },
]

export default function ProjectTabs({ activeTab, isSmallScreen, galleryLabel, onTabClick }: ProjectTabsProps) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: isSmallScreen ? '6px' : '10px', 
      marginBottom: '15px', 
      paddingBottom: '10px', 
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingLeft: isSmallScreen ? '4px' : '0',
      paddingRight: isSmallScreen ? '4px' : '0'
    }} className="hide-scrollbar">
      {TABS.map(tab => {
        const displayLabel = tab.id === 'GALLERY' ? (isSmallScreen ? 'Planos' : galleryLabel) : (isSmallScreen ? tab.label.substring(0, 8) + '...' : tab.label)
        return (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isSmallScreen ? '6px' : '10px',
              padding: isSmallScreen ? '10px 14px' : '12px 24px',
              borderRadius: '16px',
              background: activeTab === tab.id ? tab.gradient : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.id ? '#fff' : tab.activeColor,
              border: `1px solid ${activeTab === tab.id ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: isSmallScreen ? '0.75rem' : '0.95rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: activeTab === tab.id ? `0 8px 20px ${tab.bgColor}` : 'none',
              transform: activeTab === tab.id ? 'scale(1.03)' : 'scale(1)',
              whiteSpace: 'nowrap',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {activeTab === tab.id && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(255,255,255,0.2), transparent)', pointerEvents: 'none' }} />
            )}
            {tab.icon}
            {displayLabel}
          </button>
        )
      })}
    </div>
  )
}
