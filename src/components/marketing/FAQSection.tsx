'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, MessageSquare } from 'lucide-react'
import { generalFaqs } from '@/data/agencies'

export default function FAQSection({ 
  faqs = generalFaqs, 
  title = "Preguntas Frecuentes", 
  subtitle = "FAQ",
  fullWidthSupport = false,
  showSupport = true
}: { 
  faqs?: any[], 
  title?: string, 
  subtitle?: string,
  fullWidthSupport?: boolean,
  showSupport?: boolean
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="aq-faq-component" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
         <div style={{ width: '40px', height: '3px', backgroundColor: '#004A87' }} />
         <span className="font-brand" style={{ fontSize: '12px', fontWeight: '900', color: '#004A87', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
            {subtitle}
         </span>
      </div>
      
      <h2 className="font-brand text-[42px] md:text-[60px] font-black leading-[1.1] tracking-tighter uppercase text-black mb-12">
        {title}
      </h2>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #EEEEEE',
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                style={{
                  width: '100%',
                  padding: '28px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: '900', color: '#111827' }}>
                  {faq.question}
                </span>
                {openIndex === idx ? <Minus size={20} color="#004A87" strokeWidth={3} /> : <Plus size={20} color="#000" strokeWidth={3} />}
              </button>
              
              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div style={{ padding: '0 24px 32px 24px', fontSize: '15px', color: '#4B5563', lineHeight: '1.7', maxWidth: '800px' }}>
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {showSupport && (
          <div className="aq-faq-support-card" style={{ 
            marginTop: '60px', 
            padding: fullWidthSupport ? '60px' : '40px', 
            backgroundColor: '#111827',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
          }}>
            <div style={{ 
              position: 'relative', 
              zIndex: 1,
              display: fullWidthSupport ? 'flex' : 'block',
              flexDirection: 'column',
              alignItems: fullWidthSupport ? 'center' : 'flex-start',
              textAlign: fullWidthSupport ? 'center' : 'left'
            }}>
              <div style={{ 
                marginBottom: '20px', 
                color: '#004A87', 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                padding: '12px', 
                display: 'inline-flex' 
              }}>
                <MessageSquare size={32} />
              </div>
              
              <h4 className="font-brand" style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase' }}>
                ¿Necesita soporte directo?
              </h4>
              <p style={{ 
                fontSize: '16px', 
                color: 'rgba(255,255,255,0.7)', 
                marginBottom: '32px', 
                lineHeight: '1.6', 
                maxWidth: fullWidthSupport ? '600px' : '400px' 
              }}>
                Nuestros ingenieros hidráulicos están disponibles para asesorarle en su proyecto técnico con stock permanente y garantía directa de fábrica.
              </p>
              <button style={{
                backgroundColor: 'white',
                color: 'black',
                padding: '18px 48px',
                border: 'none',
                borderRadius: '0px',
                fontWeight: '900',
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                cursor: 'pointer'
              }}
              className="hover:bg-aquatech-blue hover:text-white transition-all"
              >
                Hablar con un Experto
              </button>
            </div>
            
            <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', opacity: 0.05 }}>
               <Plus size={240} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
