'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ArrowUpRight, ShieldCheck, Cpu, Users, Award, Settings, Plus, Minus } from 'lucide-react'
import Link from 'next/link'
import Footer from '@/components/marketing/Footer'
import UniversalCatalog from '@/components/marketing/UniversalCatalog'
import DynamicQuoteForm from '@/components/marketing/DynamicQuoteForm'
import WhatsAppButton from '@/components/marketing/WhatsAppButton'
import ScrollToTop from '@/components/marketing/ScrollToTop'

const workProcess = [
  { number: "01", title: "Análisis Hídrico", desc: "Evaluación de sedimentos y niveles de dureza mineral en el agua de entrada.", icon: <Users size={20} />, img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp" },
  { number: "02", title: "Ingeniería RO/UV", desc: "Diseño de sistemas de Ósmosis Inversa o Lámparas UV según el caudal requerido.", icon: <Cpu size={20} />, img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp" },
  { number: "03", title: "Integración Dual", desc: "Instalación de sistemas antisarro y desinfectantes para depósitos y cisternas.", icon: <Settings size={20} />, img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp" },
  { number: "04", title: "Desinfección Ozono", desc: "Implementación de generadores de ozono para eliminación total de olores y bacterias.", icon: <ShieldCheck size={20} />, img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp" },
  { number: "05", title: "Entrega Certificada", desc: "Agua estabilizada, libre de químicos residuales y segura para consumo humano.", icon: <Award size={20} />, img: "https://cesarweb.b-cdn.net/home/locales-lifestyle.webp" }
]

const iconicModels = [
  { name: "Ósmosis Inversa Evans", line: "Purificación 99%", href: "#", img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp" },
  { name: "Sistema Dual Antisarro", line: "Protección Hogar", href: "#", img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp" },
  { name: "Generador de Ozono", line: "Desinfección Gas", href: "#", img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp" },
  { name: "Lámpara UV-C", line: "Inactivación ADN", href: "#", img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp" },
]

const faqs = [
  { q: "¿QUÉ TAN SEGURA ES EL AGUA DESPUÉS DEL TRATAMIENTO?", a: "Nuestros sistemas eliminan hasta el 99% de contaminantes, metales pesados y microorganismos dañinos. El agua se vuelve segura para el consumo humano directamente desde el grifo, eliminando la necesidad de compra constante de envases plásticos." },
  { q: "¿EL TRATAMIENTO CAMBIA EL SABOR U OLOR?", a: "Sí, lo mejora significativamente. El sistema de ósmosis y los filtros de zeolita eliminan olores desagradables y neutralizan el sabor, proporcionando agua con una calidad sensorial de nivel premium desde la primera semana de uso." },
  { q: "¿EL SISTEMA ANTISARRO ELIMINA EL SARRO VIEJO?", a: "Técnicamente, el sistema está diseñado para prevenir la formación de sarro nuevo y detener la corrosión. Si tus tuberías tienen acumulaciones de años, recomendamos una limpieza previa de los depósitos antes de la instalación para maximizar la eficiencia." },
  { q: "¿QUÉ MANTENIMIENTO REQUIEREN LOS FILTROS?", a: "Es fundamental realizar el proceso de 'backwash' (lavado y enjuague) periódicamente para evitar la saturación de los medios filtrantes (como la zeolita). Los cartuchos de polipropileno se reemplazan según el nivel de sedimentos en la zona." },
  { q: "¿EL AGUA TIENE OLOR A CLORO AL PRINCIPIO?", a: "Durante la primera semana es normal percibir un ligero olor debido a la desinfección profunda del depósito. Una vez purificada la carga acumulada, el agua se estabiliza y el olor desaparece por completo." },
]

export default function AguaPotablePage() {
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
          padding-top: 130px !important;
          padding-bottom: 130px !important;
        }
        .font-brand { font-family: var(--font-brand) !important; }
        .font-body { font-family: var(--font-body) !important; }
        
        h1, h2, h3, h4, h5 { font-family: var(--font-brand) !important; }
        p, span, label, input, textarea { font-family: var(--font-body); }
        
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
        
        /* Full Responsiveness Overrides */
        @media (max-width: 1024px) {
          .aquatech-full-section {
            flex-direction: column !important;
          }
          .aquatech-work-left, .aquatech-work-right {
             flex: 0 0 100% !important;
             width: 100% !important;
             min-width: 100% !important;
             padding: 60px 20px !important;
             border: none !important;
          }
          .cta-faq-section {
            flex-direction: column !important;
          }
          .cta-side, .faq-side {
            flex: 0 0 100% !important;
            width: 100% !important;
            padding: 60px 24px !important;
          }
          .work-items-container {
             flex-direction: row !important;
             overflow-x: auto !important;
             scroll-snap-type: x mandatory !important;
             gap: 20px !important;
             padding-bottom: 20px !important;
             -ms-overflow-style: none;
             scrollbar-width: none;
          }
          .work-items-container::-webkit-scrollbar { display: none; }
          
          .work-step-item {
             flex: 0 0 85% !important;
             flex-direction: column !important;
             align-items: flex-start !important;
             gap: 24px !important;
             scroll-snap-align: center !important;
             background: #f9fafb;
             padding: 40px 30px !important;
             border: 1px solid #f3f4f6 !important;
          }
          .step-dot {
             width: 60px !important;
             height: 60px !important;
          }
          .step-dot span {
             font-size: 18px !important;
          }
          .step-img-container {
             width: 100% !important;
             height: auto !important;
             aspect-ratio: 16/9 !important;
          }
          .step-content {
             max-width: 100% !important;
          }
          .work-line {
             display: none !important;
          }
          .quote-form-card {
             padding: 30px 20px !important;
             box-shadow: 20px 20px 0px rgba(0,0,0,0.1) !important;
          }
          .mobile-pagination {
             display: flex !important;
             justify-content: center;
             gap: 10px;
             margin-top: 30px;
          }
          .pagination-dot {
             width: 8px;
             height: 8px;
             background: #e5e7eb;
             border-radius: 50%;
          }
          .pagination-dot:first-child {
             background: #004A87;
             width: 24px;
             border-radius: 4px;
          }
        }
        
        .mobile-pagination { display: none; }
      `}</style>

      {/* Hero Section */}
      <section className="relative h-[95vh] flex flex-col items-center justify-center overflow-hidden bg-black">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 3 }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://cesarweb.b-cdn.net/home/hero-slider-2.webp')" }}
        />
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        
        <div className="relative z-10 text-center px-5 sm:px-10 w-full max-w-[1000px] mx-auto flex flex-col items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-[110px] font-black text-white mb-10 tracking-tighter leading-[0.9] md:leading-[0.8] text-center"
          >
            Agua Potable.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#004A87] to-[#0070C0]">Pureza Certificada.</span>
          </motion.h1>

          <Link 
            href="#catalogo"
            className="btn-aquatech bg-white text-black"
          >
            Sistemas de Purificación
          </Link>
        </div>
      </section>

      {/* Modelos/Líneas Icónicas */}
      <section className="section-gap bg-white">
        <div className="central-container flex flex-col items-center">
          <div className="text-center mb-16 md:mb-28 px-4">
            <span className="text-[#004A87] font-black uppercase tracking-[0.6em] md:tracking-[0.8em] text-[8px] md:text-[10px] mb-6 md:mb-8 block font-brand">Tecnología Evans & Aquatech</span>
            <h2 className="text-4xl md:text-[80px] font-black text-black mb-6 md:mb-8 tracking-tighter uppercase whitespace-normal md:whitespace-nowrap leading-none">Salud y Protección</h2>
            <div className="w-16 md:w-24 h-1.5 md:h-2 bg-[#004A87] mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full">
            {iconicModels.map((model, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -15, transition: { duration: 0.8, ease: "easeInOut" } }}
                className="flex flex-col gap-6 group"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b-4 border-[#004A87]">
                   <img src={model.img} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000" alt={model.name} />
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all"></div>
                </div>
                <div className="flex justify-between items-center px-2">
                  <div className="max-w-[70%]">
                    <span className="text-[#004A87] font-black text-[9px] uppercase tracking-[0.4em] font-brand">{model.line}</span>
                    <h4 className="text-xl font-black text-black mt-2 tracking-tighter uppercase leading-none">{model.name}</h4>
                  </div>
                  <Link href={model.href} className="w-10 h-10 border border-black flex items-center justify-center hover:bg-[#004A87] hover:text-white transition-all transform hover:rotate-12">
                     <ArrowUpRight size={20} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Línea de Trabajo + Formulario */}
      <section className="aquatech-full-section" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', backgroundColor: '#ffffff', overflow: 'hidden' }}>
        
        {/* Lado Izquierdo: Línea de Trabajo (65%) */}
        <div className="aquatech-work-left" style={{ 
          flex: '0 0 60%', 
          backgroundColor: '#ffffff', 
          padding: '80px 60px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          position: 'relative',
          minWidth: 0,
          borderRight: '1px solid #f3f4f6'
        }}>
          <div className="blueprint-bg" style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(#004A87 1px, transparent 1px), linear-gradient(90deg, #004A87 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div style={{ position: 'relative', zIndex: 10, width: '100%' }}>
            <div style={{ marginBottom: '50px' }}>
              <span style={{ color: '#004A87', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.6em', fontSize: '10px' }}>Water Quality Control</span>
              <h2 style={{ fontSize: '60px', fontWeight: 900, color: 'black', textTransform: 'uppercase', lineHeight: '1', margin: '20px 0', letterSpacing: '-0.02em' }}>Plan de<br/><span style={{ color: '#004A87' }}>Purificación</span></h2>
              <div style={{ width: '100px', height: '8px', backgroundColor: '#004A87', marginTop: '30px' }}></div>
              <div className="md:hidden mt-6 text-[#004A87] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 animate-pulse">
                Deslizar lateralmente para ver más <ChevronRight size={14} />
              </div>
            </div>

            <div className="work-slider-wrapper" style={{ position: 'relative' }}>
              <div className="work-items-container" style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                <div className="work-line" style={{ position: 'absolute', left: '40px', top: '0', bottom: '0', width: '1px', backgroundColor: '#e5e7eb', zIndex: 0 }}></div>

                {workProcess.map((step, idx) => (
                  <div key={idx} className="work-step-item" style={{ 
                    display: 'flex', 
                    gap: '40px', 
                    padding: '25px 0', 
                    borderBottom: '1px solid #f3f4f6',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    <div className="step-dot" style={{ 
                      width: '80px', 
                      height: '80px', 
                      flexShrink: 0, 
                      backgroundColor: '#004A87',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      position: 'relative',
                      border: '4px solid #ffffff'
                    }}>
                      <span style={{ color: 'white', fontWeight: 900, fontSize: '24px' }}>{step.number}</span>
                    </div>

                    <div className="step-img-container" style={{ width: '150px', height: '100px', flexShrink: 0, overflow: 'hidden', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <img src={step.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={step.title} />
                    </div>

                    <div className="step-content" style={{ maxWidth: '400px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 900, color: 'black', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px' }}>{step.title}</h4>
                      <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 500, lineHeight: '1.6', letterSpacing: '0.1em' }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mobile-pagination">
                {workProcess.map((_, i) => (
                  <div key={i} className="pagination-dot"></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="aquatech-work-right" style={{ 
          flex: '0 0 40%', 
          backgroundColor: '#004A87', 
          padding: '80px 40px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          borderLeft: '1px solid #004A87',
          minWidth: 0
        }}>
           <div className="quote-form-card" style={{ width: '100%', backgroundColor: 'white', padding: '50px', boxShadow: '50px 50px 0px rgba(0,0,0,0.2)' }}>
              <DynamicQuoteForm categoryName="Agua Potable" />
           </div>
        </div>
      </section>

      {/* Catálogo Universal */}
      <section id="catalogo">
        <UniversalCatalog defaultCategory="Agua Potable" />
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
                    Garantía de Pureza Aquatech
                  </div>
                  
                  <h2 className="text-3xl md:text-[42px] mb-8" style={{ fontWeight: 900, color: 'white', textTransform: 'uppercase', lineHeight: '1.2', letterSpacing: '0' }}>
                    Agua más limpia<br />
                    <span style={{ color: '#004A87' }}>y sin sarro</span>
                  </h2>
                  
                  <Link 
                    href="/contacto"
                    style={{ backgroundColor: '#004A87', color: 'white', padding: '20px 40px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', width: '100%', textDecoration: 'none', boxSizing: 'border-box' }}
                  >
                    Hablar con un Especialista
                    <ArrowUpRight size={20} />
                  </Link>
               </div>
            </div>

            {/* FAQ */}
            <div className="faq-side" style={{ backgroundColor: '#F9FAFB', padding: '80px 60px', flex: '1 1 50%', maxWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
               
               <div style={{ marginBottom: '50px' }}>
                 <h3 className="text-3xl md:text-[32px]" style={{ fontWeight: 900, textTransform: 'uppercase', color: 'black', lineHeight: '1.2', letterSpacing: '0' }}>Salud e<br/>Higiene</h3>
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
