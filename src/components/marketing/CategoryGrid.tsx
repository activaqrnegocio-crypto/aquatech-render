'use client'

import Image from 'next/image'
import Link from 'next/link'

const categories = [
  {
    title: 'Hidromasajes',
    image: 'https://cesarweb.b-cdn.net/home/hidromasaje-card.webp',
    link: '/servicios/hidromasajes',
  },
  {
    title: 'Turcos',
    image: 'https://cesarweb.b-cdn.net/home/turcos.webp',
    link: '/servicios/turcos',
  },
  {
    title: 'Saunas',
    image: 'https://cesarweb.b-cdn.net/home/saunas.webp',
    link: '/servicios/saunas',
  },
  {
    title: 'Piletas',
    image: 'https://cesarweb.b-cdn.net/home/piletas-card.webp',
    link: '/servicios/piletas',
  },
  {
    title: 'Tuberías',
    image: 'https://cesarweb.b-cdn.net/home/tuberias.webp',
    link: '/servicios/tuberias',
  },
  {
    title: 'Agua Potable',
    image: 'https://cesarweb.b-cdn.net/home/aguapotable.webp',
    link: '/servicios/agua-potable',
  },
  {
    title: 'Riego',
    image: 'https://cesarweb.b-cdn.net/home/riego.webp',
    link: '/servicios/riego',
  },
  {
    title: 'Accesorios',
    image: 'https://cesarweb.b-cdn.net/home/accesorios-card.webp',
    link: '/servicios/accesorios',
  }
]

export default function CategoryGrid() {
  return (
    <section className="bg-[#004A87] py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-0 gap-y-12 w-full">
        {categories.map((cat, i) => (
          <div 
            key={i}
            className="flex flex-col items-center w-full group"
          >
            {/* Rectangular Image Container - 50/50 - STRAIGHT EDGES */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/20">
                <Image 
                    src={cat.image} 
                    alt={cat.title} 
                    fill
                    unoptimized
                    className="object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                />
                
                {/* Central Overlay Button - STRAIGHT EDGES */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <Link href={cat.link} className="bg-white text-[#004A87] px-6 py-4 text-[13px] font-[700] uppercase tracking-widest shadow-2xl hover:bg-[#004A87] hover:text-white transition-all duration-300 rounded-none text-center leading-relaxed">
                        Más información<br/>{cat.title}
                    </Link>
                </div>
            </div>
            
            {/* Action Button Below- White Rectangular (BORDES RECTOS) */}
            <div className="mt-8 mb-4 flex justify-center w-full">
                <Link 
                    href={cat.link} 
                    className="w-[280px] py-4 bg-white text-[#004A87] text-[12px] font-[800] uppercase tracking-[0.4em] text-center rounded-none hover:bg-white/90 hover:scale-105 transition-all duration-500 shadow-xl"
                >
                    Explorar
                </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
