'use client'

import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop
      if (scrolled > 300) {
        setVisible(true)
      } else if (scrolled <= 300) {
        setVisible(false)
      }
    }
    window.addEventListener('scroll', toggleVisible)
    return () => window.removeEventListener('scroll', toggleVisible)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-10 left-10 z-[100]">
      <button 
        onClick={scrollToTop}
        className="w-12 h-12 md:w-16 md:h-16 bg-[#004A87] text-white flex items-center justify-center shadow-2xl hover:bg-[#003A6A] transition-all duration-300 rounded-none group"
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-y-1 transition-transform" />
      </button>
    </div>
  )
}
