'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const slides = [
  {
    image: 'https://cesarweb.b-cdn.net/home/hero-slider-1.webp',
    mobileImage: 'https://cesarweb.b-cdn.net/home/hero-mobile-1.webp',
    link: '/cotizar'
  },
  {
    image: 'https://cesarweb.b-cdn.net/home/hero-slider-2.webp',
    mobileImage: 'https://cesarweb.b-cdn.net/home/hero-mobile-2.webp',
    link: '/servicios/piletas'
  },
  {
    image: 'https://cesarweb.b-cdn.net/home/hero-slider-3.webp',
    mobileImage: 'https://cesarweb.b-cdn.net/home/hero-mobile-3.webp',
    link: '/productos/jacuzzis'
  }
]

export default function Hero() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => setIndex((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length)

  return (
    <section className="relative w-full h-[95vh] bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <picture>
            <source media="(max-width: 768px)" srcSet={slides[index].mobileImage} />
            <Image 
              src={slides[index].image} 
              alt="Aquatech Slide" 
              fill 
              unoptimized
              className="object-cover object-center"
              priority
            />
          </picture>
        </motion.div>
      </AnimatePresence>

      {/* Manual Controls */}
      <div className="absolute inset-y-0 left-4 md:left-10 flex items-center z-20">
        <button 
          onClick={prevSlide}
          className="w-12 h-12 rounded-none bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all border border-white/10"
        >
          <ChevronLeft size={32} />
        </button>
      </div>
      <div className="absolute inset-y-0 right-4 md:right-10 flex items-center z-20">
        <button 
          onClick={nextSlide}
          className="w-12 h-12 rounded-none bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all border border-white/10"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {/* Progress Bars */}
      <div className="absolute bottom-10 right-10 flex gap-2 z-20">
        {slides.map((_, i) => (
          <div key={i} className="h-[2px] w-8 bg-white/20 overflow-hidden">
            <div 
              className={`h-full bg-white transition-all duration-[7000ms] ease-linear ${index === i ? 'w-full' : 'w-0'}`} 
            />
          </div>
        ))}
      </div>
    </section>
  )
}
