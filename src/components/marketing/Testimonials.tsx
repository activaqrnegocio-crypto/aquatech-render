'use client'

import { motion } from 'framer-motion'
import { Star, User } from 'lucide-react'

export default function Testimonials() {
  const reviews = [
    {
      name: "Luis Antonio Alvarez Castillo",
      meta: "2 opiniones",
      time: "Hace 8 meses",
      content: "Son confiables, tienen buenas bombas y tuberías, me gusta su trabajo",
      rating: 5,
      image: "https://lh3.googleusercontent.com/a-/ALV-UjVAxPvT6tkGQNCvk_BAsvUaTWbWkcaEIAKQH5cxMyjee4FnzqCd=w36-h36-p-rp-mo-br100"
    },
    {
      name: "Lucia Rey",
      meta: "2 opiniones",
      time: "Hace 10 meses",
      content: "Los mejores en piscinas! Los recomiendo, te asesoran y ayudan excelente",
      rating: 5,
      image: "https://lh3.googleusercontent.com/a-/ALV-UjWdTCkK4Y_YHPSLHIk4hmiuv6qYHmX8wOvQ1H-Kw8l008Qz-9w=w36-h36-p-rp-mo-br100"
    },
    {
      name: "Francys Saca",
      meta: "1 opinión",
      time: "Hace un año",
      content: "Excelentes productos y servicio, muy profesionales",
      rating: 5
    },
    {
      name: "Rafael Medina",
      meta: "Local Guide · 2 opiniones · 9 fotos",
      time: "Hace 5 meses",
      content: "Excelente servicio y asesoría técnica en cada etapa del proyecto",
      rating: 5
    }
  ]

  return (
    <section 
      id="testimonios" 
      style={{ 
        backgroundColor: 'white', 
        paddingTop: '120px', 
        paddingBottom: '120px',
        borderTop: '1px solid #F0F0F0'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <span style={{ fontSize: '14px', fontWeight: '900', color: '#004A87', textTransform: 'uppercase', letterSpacing: '0.4em', display: 'block', marginBottom: '24px' }}>
            La confianza de nuestros clientes
          </span>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '900', color: 'black', letterSpacing: '-0.02em' }}>
            Voces de quienes ya <br /> disfrutan del paraíso.
          </h2>
        </div>

        {/* Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '24px' 
        }}>
          {reviews.map((review, idx) => (
            <div 
              key={idx}
              style={{
                backgroundColor: '#F9F9FB',
                padding: '40px',
                border: '1px solid #EEEEEE',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.4s ease'
              }}
              className="hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
            >
              <div>
                {/* Animated Rating - 5 Stars */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
                  {[...Array(review.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 15, 
                        delay: 0.4 + (i * 0.1) 
                      }}
                    >
                      <Star size={22} fill="#FFD700" color="#FFD700" style={{ filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.3))' }} />
                    </motion.div>
                  ))}
                </div>

                <p style={{ fontSize: '18px', color: '#1D1D1F', lineHeight: '1.6', fontWeight: '500', marginBottom: '32px', fontStyle: 'italic' }}>
                  "{review.content}"
                </p>
              </div>

              {/* User Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #E5E5E5', paddingTop: '24px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  backgroundColor: '#004A87', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'white',
                  overflow: 'hidden'
                }}>
                   {review.image ? (
                     <img 
                       src={review.image} 
                       alt={review.name} 
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                     />
                   ) : (
                     <User size={24} />
                   )}
                </div>
                <div>
                   <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'black', margin: 0 }}>{review.name}</h4>
                   <p style={{ fontSize: '12px', color: '#86868B', margin: '4px 0 0' }}>{review.meta} • {review.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
