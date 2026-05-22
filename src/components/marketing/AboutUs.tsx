'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Heart, MapPin } from 'lucide-react'

export default function AboutUs() {
  return (
    <section 
      id="nosotros"
      style={{ 
        backgroundColor: '#FFFFFF', 
        paddingTop: '80px', 
        paddingBottom: '80px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '60px',
          alignItems: 'center'
        }}>
          
          {/* Left Column: Image Collage (Square Style) */}
          <div style={{ 
            position: 'relative', 
            height: '600px', 
            width: '100%',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            
            {/* Image 4: Sucursal 3 (Top Right - Background) */}
            <motion.div
              initial={{ opacity: 0, x: 40, y: -40, rotate: 8 }}
              whileInView={{ opacity: 1, x: 0, y: 0, rotate: 8 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              style={{
                position: 'absolute',
                top: '5%',
                right: '5%',
                width: '45%',
                height: '180px',
                borderRadius: '0px', // Square
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                zIndex: 1,
                border: '4px solid white',
                filter: 'brightness(0.95)',
                backgroundColor: '#F9FAFB'
              }}
            >
              <img src="https://cesarweb.b-cdn.net/home/showroom_interior.webp" alt="Showroom Interior" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            </motion.div>

            {/* Image 1: Matriz (Top Left) */}
            <motion.div
              initial={{ opacity: 0, x: -60, y: -30, rotate: -6 }}
              whileInView={{ opacity: 1, x: 0, y: 0, rotate: -6 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{
                position: 'absolute',
                top: '10%',
                left: '2%',
                width: '55%',
                height: '240px',
                borderRadius: '0px', // Square
                overflow: 'hidden',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                zIndex: 2,
                border: '4px solid white',
                backgroundColor: '#F3F4F6'
              }}
            >
              <img src="https://cesarweb.b-cdn.net/home/matriz_frente.webp" alt="Matriz Loja" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            </motion.div>

            {/* Image 2: Sucursal 1 (Bottom Left) */}
            <motion.div
              initial={{ opacity: 0, x: -40, y: 60, rotate: 4 }}
              whileInView={{ opacity: 1, x: 0, y: 0, rotate: 4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{
                position: 'absolute',
                bottom: '8%',
                left: '5%',
                width: '50%',
                height: '200px',
                borderRadius: '0px', // Square
                overflow: 'hidden',
                boxShadow: '0 20px 45px rgba(0,0,0,0.12)',
                zIndex: 3,
                border: '4px solid white',
                backgroundColor: '#E5E7EB'
              }}
            >
              <img src="https://cesarweb.b-cdn.net/home/equipo_trabajo.webp" alt="Equipo de Trabajo" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            </motion.div>

            {/* Image 3: Sucursal 2 (Center Right - Foreground) */}
            <motion.div
              initial={{ opacity: 0, x: 70, y: 40, rotate: -4 }}
              whileInView={{ opacity: 1, x: 0, y: 0, rotate: -4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                position: 'absolute',
                bottom: '15%',
                right: '2%',
                width: '58%',
                height: '260px',
                borderRadius: '0px', // Square
                overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.2)',
                zIndex: 4,
                border: '4px solid white',
                backgroundColor: '#D1D5DB'
              }}
            >
              <img src="https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp" alt="Detalle Ingeniería" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              
              {/* Review Badge (Square) */}
              <div style={{
                position: 'absolute',
                bottom: '24px',
                right: '24px',
                backgroundColor: '#004A87',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '0px', // Square
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,74,135,0.4)',
                zIndex: 10,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '900', lineHeight: 1 }}>5/5</div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.08em', marginTop: '4px' }}>Valoración Real</div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Text Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
               <div style={{ width: '32px', height: '2px', backgroundColor: '#004A87' }} />
               <span className="font-brand" style={{ fontSize: '12px', fontWeight: '900', color: '#004A87', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
                  Nuestra Trayectoria
               </span>
            </div>
            
            <h2 className="font-brand" style={{ 
              fontSize: 'clamp(32px, 4vw, 56px)', 
              fontWeight: '900', 
              color: '#0B1623', 
              lineHeight: '1.1', 
              letterSpacing: '-0.03em', 
              marginBottom: '32px' 
            }}>
              Líderes en el ciclo <br />
              <span style={{ color: '#004A87' }}>integral del agua.</span>
            </h2>
            
            <p style={{ 
              fontSize: '18px', 
              color: '#4B5563', 
              lineHeight: '1.7', 
              marginBottom: '40px',
              maxWidth: '540px'
            }}>
              Con más de una década de experiencia, en Aquatech hemos perfeccionado el arte de llevar el paraíso a tu hogar. Nuestra infraestructura robusta con matriz y sucursales estratégicas nos permite ofrecer un respaldo único en el país.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: '#004A87' }}><ShieldCheck size={24} /></div>
                <div>
                  <h4 style={{ fontWeight: '800', color: '#111827', fontSize: '15px' }}>Garantía Real</h4>
                  <p style={{ fontSize: '13px', color: '#6B7280' }}>Soporte técnico directo sin intermediarios.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: '#004A87' }}><Zap size={24} /></div>
                <div>
                  <h4 style={{ fontWeight: '800', color: '#111827', fontSize: '15px' }}>Eficiencia Alemana</h4>
                  <p style={{ fontSize: '13px', color: '#6B7280' }}>Equipos de alta gama con máxima durabilidad.</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button 
                style={{
                  backgroundColor: '#000000',
                  color: 'white',
                  padding: '18px 36px',
                  borderRadius: '0px', // Square
                  fontSize: '13px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                className="hover:scale-105 hover:bg-[#004A87] shadow-lg"
              >
                Conocer Historia
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#004A87', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
                Ver ubicaciones <MapPin size={18} />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
