'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ChevronRight } from 'lucide-react'
import { dropdownItems, simpleItems } from './nav-data'

export default function NavbarMobile() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeMobileCategory, setActiveMobileCategory] = useState<string | null>(null)

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = !isOpen
    setIsOpen(nextState)
    if (nextState) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }

  const closeMenu = () => {
    setIsOpen(false)
    document.body.style.overflow = 'unset'
  }

  return (
    <div id="header-mobile" className="h-full w-full flex items-center justify-center relative bg-white">
      {/* Menu Button (32PX LEFT) */}
      <button 
        className="absolute left-0 z-[200] flex items-center h-full"
        style={{ 
          background: 'transparent', 
          border: 'none', 
          outline: 'none',
          paddingLeft: '32px'
        }}
        onClick={toggleMenu}
      >
        {isOpen ? (
          <X size={24} strokeWidth={1.5} style={{ color: '#1d1d1f' }} />
        ) : (
          <Menu size={24} strokeWidth={1.5} style={{ color: '#1d1d1f' }} />
        )}
      </button>

      {/* Brand (Centered) */}
      <Link 
        href="/" 
        onClick={closeMenu} 
        className="flex items-center relative z-0"
      >
        <div className="relative w-[22px] h-[22px] overflow-hidden bg-[#0070C0] p-0.5" style={{ marginRight: '10px' }}>
          <Image src="/logo.jpg" alt="Aquatech" fill className="object-contain" sizes="22px" />
        </div>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#000', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
          Aquatech
        </span>
      </Link>

      {/* Mobile Menu Drawer (Apple Grid Style) */}
      <div 
        className={`fixed inset-0 top-[44px] h-[calc(100vh-44px)] bg-white z-[150] transition-all duration-300 ease-out overflow-y-auto ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full bg-white border-t border-gray-100">
          <div className="flex flex-col w-full mobile-menu-grid">
            {dropdownItems.map((item) => (
              <div key={item.name} className="flex flex-col w-full border-b border-gray-100">
                <div className="flex items-center w-full min-h-[56px]">
                  {/* Category Title Area - NOW CLICKABLE AS LINK */}
                  <Link 
                    href={item.href}
                    onClick={closeMenu}
                    className="flex-1 flex items-center text-left transition-colors active:bg-gray-50 h-[56px]"
                    style={{ 
                      fontSize: '17px', 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      paddingLeft: '32px'
                    }}
                  >
                    {item.name}
                  </Link>

                  {/* Separated Arrow Area (Apple Style) - TOGGLES DROPDOWN */}
                  <button 
                    onClick={() => setActiveMobileCategory(activeMobileCategory === item.name ? null : item.name)}
                    className="w-[56px] h-[56px] border-l border-gray-100 flex items-center justify-center transition-colors active:bg-gray-50"
                  >
                    <ChevronRight 
                      size={18} 
                      strokeWidth={2}
                      className={`transition-all duration-300 ${
                        activeMobileCategory === item.name 
                          ? 'rotate-90 text-[#0070C0]' 
                          : 'opacity-40 text-black'
                      }`} 
                    />
                  </button>
                </div>
                
                {/* Accordion List */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out bg-[#fbfbfd] ${
                    activeMobileCategory === item.name ? 'max-h-[800px]' : 'max-h-0'
                  }`}
                >
                  <div className="flex flex-col w-full border-t border-gray-100">
                    {item.sub.map((sub) => (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        onClick={closeMenu}
                        className="flex items-center w-full h-[52px] border-b border-gray-100 last:border-0 active:bg-gray-100 transition-colors"
                        style={{ 
                          fontSize: '15px', 
                          fontWeight: 400, 
                          color: '#424245',
                          paddingLeft: '48px'
                        }}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Simple Items - Matching the Professional Grid */}
            {simpleItems.map((item) => (
              <Link 
                key={item.name} 
                href={item.href} 
                onClick={closeMenu} 
                className="flex items-center w-full h-[56px] border-b border-gray-100 active:bg-gray-50 transition-colors"
                style={{ 
                  fontSize: '17px', 
                  fontWeight: 600, 
                  color: '#1d1d1f',
                  paddingLeft: '32px'
                }}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Footer of Menu */}
          <div className="mt-auto py-12 opacity-20 text-[10px] font-bold tracking-widest text-center uppercase border-t border-gray-50">
            Aquatech Digital Ecosystem
          </div>
        </div>
      </div>
    </div>
  )
}
