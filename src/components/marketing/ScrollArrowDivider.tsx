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
        paddingTop: '8px', 
        paddingBottom: '8px', 
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
          gridTemplateColumns: 'repeat(3, auto)', 
          columnGap: '24px', 
          rowGap: '0px',
          position: 'relative', 
          zIndex: 10 
        }}
        className="hover:scale-105 transition-transform"
      >
        <ChevronDown size={28} color="white" />
        <ChevronDown size={28} color="white" />
        <ChevronDown size={28} color="white" />
        <ChevronDown size={28} color="white" style={{ marginTop: '-16px' }} />
        <ChevronDown size={28} color="white" style={{ marginTop: '-16px' }} />
        <ChevronDown size={28} color="white" style={{ marginTop: '-16px' }} />
      </button>
    </div>
  )
}
