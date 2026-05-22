'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const spots = [
  {
    title: 'Hidromasajes Pro',
    subtitle: 'Relajación de élite con tecnología de hidrosucción avanzada.',
    image: '/images/jacuzzi-spotlight.png',
    link: '/hidromasajes',
    dark: true,
  },
  {
    title: 'Sistemas de Riego',
    subtitle: 'Eficiencia hídrica absoluta para proyectos residenciales y agrícolas.',
    image: '/images/riego-spotlight.png',
    link: '/riego',
    dark: false,
  }
]

export default function ServiceSpotlight() {
  return (
    <section className="bg-white">
      <div className="flex flex-col md:flex-row w-full min-h-[600px] border-b border-black/5">
        {spots.map((spot, index) => (
          <div 
            key={spot.title}
            className={`relative flex-1 group overflow-hidden flex flex-col items-center justify-start pt-20 px-10 text-center ${
              spot.dark ? 'bg-black text-white' : 'bg-[#f5f5f7] text-black'
            } ${index === 0 ? 'border-r border-black/5' : ''}`}
          >
            <div className="relative z-10 max-w-sm mb-12">
              <h2 className="font-brand font-black text-4xl md:text-5xl tracking-tighter mb-4">
                {spot.title}
              </h2>
              <p className={`text-lg opacity-80 mb-6 ${spot.dark ? 'text-white' : 'text-black'}`}>
                {spot.subtitle}
              </p>
              <div className="flex items-center justify-center gap-6">
                <Link 
                  href={spot.link} 
                  className="text-[#0070C0] font-bold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  Más información
                  <ChevronRight size={18} />
                </Link>
                <Link 
                  href="/cotizador" 
                  className="text-[#0070C0] font-bold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  Comprar
                  <ChevronRight size={18} />
                </Link>
              </div>
            </div>

            <div className="relative w-full h-[400px] mt-auto transition-transform duration-700 group-hover:scale-105">
              <Image 
                src={spot.image} 
                alt={spot.title} 
                fill 
                className="object-contain object-bottom"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
