'use client'

import Image from 'next/image'

export default function WhatsAppButton() {
  return (
    <div className="fixed bottom-10 right-10 z-[100]">
      <a 
        href="https://wa.me/593999999999" 
        target="_blank"
        rel="noopener noreferrer"
        className="block w-16 h-16 transition-all duration-300 relative group drop-shadow-xl hover:scale-110"
        aria-label="Contact on WhatsApp"
      >
        {/* Using the local WhatsApp asset from public/ */}
        <div className="relative w-full h-full">
            <Image 
                src="/WhatsApp.svg.png" 
                alt="WhatsApp" 
                fill 
                sizes="64px"
                className="object-contain"
            />
        </div>
        
        {/* Tooltip */}
        <span className="absolute right-full mr-4 bg-[#004A87] text-white text-[11px] font-[700] uppercase tracking-widest py-2 px-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap rounded-none">
            WhatsApp
        </span>
      </a>
    </div>
  )
}
