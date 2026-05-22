'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Plus, Minus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Footer from '@/components/marketing/Footer'
import UniversalCatalog from '@/components/marketing/UniversalCatalog'
import WhatsAppButton from '@/components/marketing/WhatsAppButton'
import ScrollToTop from '@/components/marketing/ScrollToTop'

const marcas = [
  { name: "Emaux", img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp" },
  { name: "Hunter", img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp" },
  { name: "Hayward", img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp" },
  { name: "Pentair", img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp" },
  { name: "Balboa", img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp" },
  { name: "Pedrollo", img: "https://cesarweb.b-cdn.net/home/locales-lifestyle.webp" },
  { name: "Evans", img: "https://cesarweb.b-cdn.net/home/hero-slider-2.webp" },
  { name: "Netafim", img: "https://cesarweb.b-cdn.net/home/hero-slider-1.webp" }
]

const subCategories = [
  { id: 'piscina', title: 'Accesorios de Piscinas', tag: 'PISCINA' },
  { id: 'turco', title: 'Accesorios de Turcos', tag: 'TURCO' },
  { id: 'hidromasaje', title: 'Accesorios de Hidromasajes', tag: 'HIDROMASAJE' }
]

const faqs = [
  { q: "¿LOS REPUESTOS DE MARCAS COMO BALBOA O HAYWARD QUE OFRECEN SON ORIGINALES?", a: "Sí. Aquatech actúa como un integrador tecnológico que selecciona marcas de prestigio internacional. En nuestro inventario contamos con componentes originales de Hayward y Balboa para garantizar la total compatibilidad y durabilidad de sus sistemas." },
  { q: "¿REALIZAN ENVÍOS DE REPUESTOS Y ACCESORIOS A NIVEL NACIONAL?", a: "Contamos con una red logística desarrollada para atender todo el país, incluyendo zonas fronterizas como Macará. Gracias a nuestras cuatro agencias en el sur, gestionamos la entrega eficiente de kits y equipos pesados superando limitaciones geográficas." },
  { q: "¿OFRECEN ASESORÍA TÉCNICA SI DECIDO INSTALAR EL REPUESTO YO MISMO?", a: "Nuestra propuesta de valor es integral. Aunque contamos con instaladores especializados, brindamos atención personalizada vía WhatsApp para guiarle en la selección y uso correcto de los componentes, asegurando el éxito de su instalación." },
  { q: "¿QUÉ DIFERENCIA HAY EN LA GARANTÍA DE PIEZAS ELECTRÓNICAS Y MECÁNICAS?", a: "Protegemos su inversión seleccionando equipos con alta disponibilidad de repuestos en Ecuador. Las piezas mecánicas se benefician de nuestros protocolos de mantenimiento preventivo, mientras que la electrónica está diseñada para resistir las condiciones hidráulicas específicas de la región." },
  { q: "¿TIENEN DISPONIBILIDAD INMEDIATA PARA EMERGENCIAS?", a: "Mantenemos un inventario masivo de más de 1,000 ítems en nuestra matriz en Loja. Esto nos permite coordinar despachos ágiles a nuestras sucursales en Malacatos, Vilcabamba y Yantzaza, asegurando una respuesta logística rápida a sus requerimientos." },
]

export default function AccesoriosPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0)

  return (
    <main className="bg-white min-h-screen overflow-x-hidden pt-[80px]">
      <style jsx global>{`
        .central-container {
          max-width: 1200px !important;
          width: 100% !important;
          margin-left: auto !important;
          margin-right: auto !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
        }
        .section-gap {
          padding-top: 100px !important;
          padding-bottom: 100px !important;
        }
        
        /* Infinite Slider Animation */
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-250px * 8)); }
        }
        .slider-track {
          display: flex;
          width: calc(250px * 16);
          animation: scroll 40s linear infinite;
        }
        .slider-track:hover {
          animation-play-state: paused;
        }
        .slide-card {
          width: 250px;
          height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          border-right: 1px solid #f3f4f6;
        }
        
        .brand-logo-frame {
          width: 100%;
          height: 80px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }
        .brand-logo-frame:hover {
          border-color: #004A87;
          background: white;
        }
        
        .font-brand { font-family: var(--font-brand) !important; }
        .font-body { font-family: var(--font-body) !important; }
        
        h1, h2, h3, h4 { font-family: var(--font-brand) !important; }
        
        .btn-aquatech {
          border-radius: 0px !important;
          border: 1px solid rgba(0,0,0,0.1);
          text-transform: uppercase;
          letter-spacing: 0.3em;
          font-weight: 900;
          font-size: 10px;
          padding: 18px 40px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-aquatech:hover {
          background: #004A87;
          color: white;
          border-color: #004A87;
          transform: translateY(-2px);
        }

        .accordion-header {
           padding: 30px;
           background: white;
           border-bottom: 1px solid #f3f4f6;
           display: flex;
           justify-content: space-between;
           align-items: center;
           cursor: pointer;
           transition: all 0.3s ease;
        }
        .accordion-header:hover {
          background: #fafafa;
        }
        .accordion-header.active {
          border-left: 8px solid #004A87;
        }
      `}</style>

      {/* Hero Section - RESTORED TO 95VH IMPACT */}
      <section className="relative h-[95vh] flex flex-col items-center justify-center overflow-hidden bg-black mb-20">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 3 }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://cesarweb.b-cdn.net/home/hero-slider-3.webp')" }}
        />
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        
        <div className="relative z-10 text-center px-5 sm:px-10 w-full max-w-[1000px] mx-auto flex flex-col items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-[110px] font-black text-white mb-10 tracking-tighter leading-[0.9] md:leading-[0.8] text-center"
          >
            Accesorios.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#004A87] to-[#0070C0]">Repuestos & Control.</span>
          </motion.h1>
 
          <Link 
            href="#catalogo" 
            className="btn-aquatech bg-white text-black"
          >
            Ver Catálogo 2026
          </Link>
        </div>
      </section>

      {/* Marcas Slider Section */}
      <section className="py-20 bg-white border-b border-gray-100 overflow-hidden">
        <div className="text-center mb-12">
           <span className="text-[#004A87] font-black uppercase tracking-[0.5em] text-[9px] mb-4 block">Certified Partners</span>
           <h2 className="text-3xl font-black text-black tracking-tighter uppercase whitespace-nowrap">Marcas con las que trabajamos</h2>
        </div>
        
        <div className="slider">
          <div className="slider-track">
            {/* Double the list for seamless loop */}
            {[...marcas, ...marcas].map((marca, i) => (
              <div key={i} className="slide-card">
                <div className="brand-logo-frame">
                   <img src={marca.img} className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all" alt={marca.name} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{marca.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Catalog - Accesorios Generales */}
      <section id="catalogo" className="pt-20">
         <div className="central-container">
            <div className="mb-10">
               <h3 className="text-2xl font-black uppercase tracking-tight">Accesorios Generales</h3>
               <div className="w-12 h-1 bg-[#004A87] mt-2"></div>
            </div>
         </div>
         <UniversalCatalog defaultCategory="Accesorios" />
      </section>

      {/* 50/50 CTA y FAQ */}
      <section style={{ backgroundColor: '#ffffff', borderTop: '1px solid #f3f4f6', padding: '0', width: '100%', overflow: 'hidden' }}>
        <div style={{ width: '100%', margin: '0' }}>
          
          <div className="cta-faq-section" style={{ display: 'flex', flexWrap: 'wrap', width: '100%', backgroundColor: '#050505' }}>
            
            {/* CTA */}
            <div className="cta-side" style={{ 
              backgroundColor: '#050505', 
              backgroundImage: 'url("https://cesarweb.b-cdn.net/home/hero-slider-2.webp")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              padding: '80px 60px', 
              flex: '1 1 50%', 
              maxWidth: '100%',
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}>
               <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5, 5, 5, 0.85)', zIndex: 1 }}></div>
               
               <div style={{ zIndex: 10, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ border: '1px solid #004A87', color: '#004A87', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '9px', padding: '8px 16px', marginBottom: '40px', backgroundColor: 'rgba(0, 74, 135, 0.1)' }}>
                    Suministro Mayorista & Minorista
                  </div>
                  
                  <h2 className="text-3xl md:text-[42px] mb-8" style={{ fontWeight: 900, color: 'white', textTransform: 'uppercase', lineHeight: '1.2', letterSpacing: '0' }}>
                    Repuestos Originales<br />
                    <span style={{ color: '#004A87' }}>Disponibilidad Inmediata</span>
                  </h2>
                  
                  <Link 
                    href="/contacto"
                    style={{ backgroundColor: '#004A87', color: 'white', padding: '20px 40px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', width: '100%', textDecoration: 'none', boxSizing: 'border-box' }}
                  >
                    Consultar Pieza Específica
                    <ArrowUpRight size={20} />
                  </Link>
               </div>
            </div>

            {/* FAQ */}
            <div className="faq-side" style={{ backgroundColor: '#F9FAFB', padding: '80px 60px', flex: '1 1 50%', maxWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
               
               <div style={{ marginBottom: '50px' }}>
                 <h3 className="text-3xl md:text-[32px]" style={{ fontWeight: 900, textTransform: 'uppercase', color: 'black', lineHeight: '1.2', letterSpacing: '0' }}>Garantía y<br/>Despacho</h3>
                 <div style={{ width: '60px', height: '6px', backgroundColor: '#004A87', marginTop: '24px' }}></div>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                 {faqs.map((faq, idx) => (
                   <div 
                     key={idx} 
                     style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                     onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                   >
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', gap: '15px' }}>
                       <h4 style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: '1.6', color: activeFaq === idx ? '#004A87' : '#111827', margin: 0, flex: 1 }}>
                         {faq.q}
                       </h4>
                       <div style={{ flexShrink: 0 }}>
                         {activeFaq === idx ? <Minus size={18} color="#004A87" /> : <Plus size={18} color="#9ca3af" />}
                       </div>
                     </div>
                     <AnimatePresence>
                       {activeFaq === idx && (
                         <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: "auto", opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           style={{ overflow: 'hidden', backgroundColor: '#F9FAFB', borderTop: '1px solid #f3f4f6' }}
                         >
                           <div style={{ padding: '24px', fontSize: '10px', color: '#6b7280', fontWeight: 700, lineHeight: '2', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                             {faq.a}
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                 ))}
               </div>

            </div>

          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
    </main>
  )
}
