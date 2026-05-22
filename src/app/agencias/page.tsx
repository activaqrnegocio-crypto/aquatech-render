'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquare, Plus } from 'lucide-react'
import Footer from '@/components/marketing/Footer'
import AgencyLocator from '@/components/marketing/AgencyLocator'
import FAQSection from '@/components/marketing/FAQSection'
import WhatsAppButton from '@/components/marketing/WhatsAppButton'
import ScrollToTop from '@/components/marketing/ScrollToTop'

export default function AgenciasPage() {
  return (
    <main className="bg-white min-h-screen overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .aq-central-container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .aq-section-gap {
          padding-top: 60px;
          padding-bottom: 60px;
        }
        .aq-fino-title {
          font-family: var(--font-brand);
          font-weight: 300; /* Fino */
          color: #111827;
          letter-spacing: -0.02em;
        }
        @media (min-width: 1024px) {
          .aq-central-container {
            padding: 0 48px;
          }
          .aq-section-gap {
            padding-top: 100px;
            padding-bottom: 100px;
          }
        }
      `}} />

      {/* 
          PHYSICAL SPACER: This forces the content down regardless of fixed/absolute navbar positioning.
          We use a hardcoded height to ensure it is always applied correctly.
      */}
      <div style={{ height: '140px' }} className="block md:hidden" />
      <div style={{ height: '260px' }} className="hidden md:block" />

      {/* Header section with clean background */}
      <header className="pb-16 md:pb-32 bg-white">
        <div className="aq-central-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-[84px] font-black text-black leading-[0.9] tracking-tighter uppercase mb-8">
              Agencias de <span className="text-aquatech-blue">Aquatech.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 max-w-2xl font-medium leading-relaxed">
              Encuentra soporte técnico especializado, stock permanente y asesoría de ingeniería en nuestras sedes a nivel nacional.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Section 1: Agency Locator */}
      <section id="mapa" className="aq-section-gap bg-white overflow-hidden">
        <div className="aq-central-container">
          <AgencyLocator fullWidth={true} showHeading={false} />
        </div>
      </section>

      {/* Section 2: FAQ Section (Without internal support card) */}
      <section id="preguntas" className="aq-section-gap bg-gray-50/50 border-y border-gray-100">
        <div className="aq-central-container">
          <FAQSection showSupport={false} />
        </div>
      </section>

      {/* Section 3: "Fino" Support Ribbon (Full Width) */}
      <section className="bg-aquatech-dark text-white overflow-hidden relative">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-stretch">
          
          <div className="hidden lg:flex w-1/4 bg-aquatech-blue items-center justify-center p-20 relative overflow-hidden">
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               className="opacity-10"
             >
               <Plus size={300} strokeWidth={1} />
             </motion.div>
             <MessageSquare size={80} className="relative z-10 text-white opacity-90" strokeWidth={1.5} />
          </div>

          <div className="flex-1 py-20 px-8 md:p-32 relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl md:text-[56px] font-light leading-tight mb-8 aq-fino-title text-white">
                ¿Necesita <span className="font-black italic">soporte directo</span>?
              </h2>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl leading-relaxed font-medium">
                Nuestros ingenieros certificados están listos para brindarle la asesoría hidráulica que su proyecto merece. Garantía directa y respaldo internacional.
              </p>
              
              <div className="flex flex-wrap gap-6">
                <button className="bg-aquatech-blue text-white px-12 py-6 font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all duration-300 flex items-center gap-4">
                  Hablar con un Experto
                  <ArrowRight size={16} />
                </button>
                <div className="flex items-center gap-4 px-6 py-4 border border-white/10 bg-white/5">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Atención en línea</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-aquatech-blue/5 to-transparent pointer-events-none" />
      </section>

      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
    </main>
  )
}
