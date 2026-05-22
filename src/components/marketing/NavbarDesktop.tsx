'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { dropdownItems, simpleItems } from './nav-data'

export default function NavbarDesktop() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (name: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveDropdown(name)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 200)
  }

  return (
    <div id="header-desktop" className="h-full w-full items-center justify-center px-8">
      {/* Brand */}
      <Link href="/" className="flex items-center shrink-0" style={{ marginRight: '32px' }}>
        <div className="relative w-[22px] h-[22px] overflow-hidden bg-[#0070C0] p-0.5" style={{ marginRight: '10px' }}>
          <Image src="/logo.jpg" alt="Aquatech" fill className="object-contain" sizes="22px" />
        </div>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#000', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
          Aquatech
        </span>
      </Link>

      {/* Nav Items — RESTORED TO PERFECT VERSION */}
      {dropdownItems.map((item) => (
        <div 
          key={item.name} 
          className="relative h-[44px] flex items-center"
          onMouseEnter={() => handleMouseEnter(item.name)}
          onMouseLeave={handleMouseLeave}
        >
          <Link
            href={item.href}
            className="flex items-center h-full hover:text-[#0070C0] transition-colors whitespace-nowrap"
            style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#1d1d1f', 
              paddingLeft: '16px', 
              paddingRight: '16px' 
            }}
          >
            {item.name}
            <ChevronDown size={11} style={{ 
              marginLeft: '4px', 
              opacity: activeDropdown === item.name ? 1 : 0.4, 
              transform: activeDropdown === item.name ? 'rotate(180deg)' : 'none', 
              transition: 'all 0.2s' 
            }} />
          </Link>

          {/* Dropdown: White, Square, Border */}
          {activeDropdown === item.name && (
            <div 
              className="absolute top-[44px] left-0 z-50"
              style={{ minWidth: '220px', backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseEnter={() => handleMouseEnter(item.name)}
              onMouseLeave={handleMouseLeave}
            >
              {item.sub.map((sub) => (
                <Link
                  key={sub.name}
                  href={sub.href}
                  className="block hover:text-[#0070C0] hover:bg-[#f5f5f7] transition-all"
                  style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 400, color: '#424245' }}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Simple Items */}
      {simpleItems.map((item) => (
        <Link 
          key={item.name}
          href={item.href}
          className="flex items-center h-[44px] hover:text-[#0070C0] transition-colors whitespace-nowrap"
          style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: '#1d1d1f', 
            paddingLeft: '16px', 
            paddingRight: '16px' 
          }}
        >
          {item.name}
        </Link>
      ))}
    </div>
  )
}
