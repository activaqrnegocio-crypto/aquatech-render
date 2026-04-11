'use client'

import { ChevronDown } from 'lucide-react'

export function ScrollArrowDivider() {
  const handleScroll = () => {
    const featured = document.getElementById('featured-section')
    if (featured) {
      featured.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div 
      style={{ 
        backgroundColor: '#004A87', 
        paddingTop: '60px', 
        paddingBottom: '60px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'hidden' 
      }}
    >
      <button 
        onClick={handleScroll}
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '32px', 
          position: 'relative', 
          zIndex: 10 
        }}
      >
        <ChevronDown size={32} color="white" />
        <ChevronDown size={32} color="white" />
        <ChevronDown size={32} color="white" />
      </button>
    </div>
  )
}
