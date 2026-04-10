'use client'

import { useState, useEffect } from 'react'
import NavbarDesktop from './NavbarDesktop'
import NavbarMobile from './NavbarMobile'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-[100] h-[44px] w-full transition-all duration-300 border-b ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border-black/10' 
          : 'bg-white border-transparent'
      }`}
      style={{ padding: 0, margin: 0 }}
    >
      {/* Desktop always renders on server for SEO */}
      <NavbarDesktop />
      
      {/* Mobile only renders on client to avoid hydration mismatch and version conflicts */}
      {mounted && <NavbarMobile />}
    </nav>
  )
}
