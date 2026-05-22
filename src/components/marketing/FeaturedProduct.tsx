'use client'

import Image from 'next/image'

export default function FeaturedProduct() {
  return (
    <section id="featured-section" className="bg-black w-full pb-20">
      <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden">
        <Image 
          src="https://cesarweb.b-cdn.net/home/pro-product.webp" 
          alt="Aquatech Pro Banner" 
          fill
          unoptimized
          className="object-cover object-center"
          priority
        />
      </div>
    </section>
  )
}
