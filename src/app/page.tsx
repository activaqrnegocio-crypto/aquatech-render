import type { Metadata } from 'next'
import Hero from '@/components/marketing/Hero'
import { FeaturedProduct } from '@/components/marketing/FeaturedProduct'
import CategoryGrid from '@/components/marketing/CategoryGrid'
import Footer from '@/components/marketing/Footer'

// metadataBase is required in Next.js 14+ to resolve relative URLs for social sharing
export const metadata: Metadata = {
  metadataBase: new URL('https://aquatech.com.ec'),
  title: 'Aquatech | Piscinas, Hidromasajes y Riego en Loja',
  description: 'Ingeniería hidráulica de vanguardia. Diseñamos y construimos piscinas, saunas y sistemas de riego premium en el sur del Ecuador.',
  keywords: ['piscinas loja', 'hidromasajes ecuador', 'riego automatico loja', 'aquatech', 'saunas ecuador', 'construccion de piscinas'],
  openGraph: {
    title: 'Aquatech | El Paraíso en tu Hogar',
    description: 'Tecnología hidráulica para transformar tu espacio.',
    images: ['/images/jacuzzi-spotlight.png'],
    type: 'website',
  }
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white selection:bg-[#0070C0] selection:text-white">
      {/* Hero Section: Banner Principal (Estilo Apple) */}
      <Hero />

      {/* Featured Focus: Producto Estrella Gigante (Tipo iPhone impact) */}
      <FeaturedProduct />

      {/* Service Grid: 2x2 side-by-side (Tipo iMac/Watch cards) */}
      <CategoryGrid />

      {/* Espaciador de Seguridad para garantizar separación del footer */}
      <div className="h-32 md:h-48 bg-white" />

      {/* Footer: Rediseño Institucional Totalmente Espaciado */}
      <Footer />
    </main>
  )
}
