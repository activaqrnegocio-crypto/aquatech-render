'use client'

import { motion } from 'framer-motion'
import { Star, User, ExternalLink, MessageCircle } from 'lucide-react'

export default function Testimonials() {
  const reviews = [
    {
      name: "Luis Antonio Alvarez Castillo",
      meta: "2 opiniones",
      time: "Hace 8 meses",
      content: "Son confiables, tienen buenas bombas y tuberías, me gusta su trabajo.",
      rating: 5,
      image: "https://lh3.googleusercontent.com/a-/ALV-UjVAxPvT6tkGQNCvk_BAsvUaTWbWkcaEIAKQH5cxMyjee4FnzqCd=w36-h36-p-rp-mo-br100"
    },
    {
      name: "Lucia Rey",
      meta: "2 opiniones",
      time: "Hace 10 meses",
      content: "¡Los mejores en piscinas! Los recomiendo, te asesoran y ayudan excelente.",
      rating: 5,
      image: "https://lh3.googleusercontent.com/a-/ALV-UjWdTCkK4Y_YHPSLHIk4hmiuv6qYHmX8wOvQ1H-Kw8l008Qz-9w=w36-h36-p-rp-mo-br100"
    },
    {
      name: "Francys Saca",
      meta: "1 opinión",
      time: "Hace un año",
      content: "Excelentes productos y servicio, muy profesionales.",
      rating: 5
    },
    {
      name: "Rafael Medina",
      meta: "Local Guide · 2 opiniones · 9 fotos",
      time: "Hace 5 meses",
      content: "Excelente servicio y asesoría técnica en cada etapa del proyecto.",
      rating: 5
    }
  ]

  // Duplicate reviews for infinite scroll effect
  const duplicatedReviews = [...reviews, ...reviews, ...reviews]

  return (
    <section 
      id="testimonios" 
      style={{
        backgroundColor: '#FFFFFF',
        paddingTop: '60px',
        paddingBottom: '100px',
        borderTop: '1px solid #F0F0F0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '800px',
        height: '800px',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        borderRadius: '0px', // Square
        filter: 'blur(120px)',
        zIndex: 0,
        transform: 'translate(30%, -30%)',
        pointerEvents: 'none'
      }}></div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Review Summary Above Header */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ textAlign: 'center', marginBottom: '32px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
             {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 15, 
                    delay: i * 0.1 
                  }}
                >
                  <Star size={24} fill="#FFB800" color="#FFB800" style={{ filter: 'drop-shadow(0 0 8px rgba(255,184,0,0.4))' }} />
                </motion.div>
             ))}
          </div>
          <span className="font-brand" style={{ fontSize: '18px', fontWeight: '800', color: '#0B1623' }}>
            5.0 / 5 <span style={{ color: '#004A87', fontWeight: '600', marginLeft: '8px' }}>4 Reseñas Reales</span>
          </span>
        </motion.div>

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '60px', maxWidth: '800px', margin: '0 auto 60px auto', padding: '0 24px' }}
        >
          <span className="font-brand" style={{ 
            fontSize: '14px', 
            fontWeight: '900', 
            color: '#004A87', 
            textTransform: 'uppercase', 
            letterSpacing: '0.3em', 
            display: 'block', 
            marginBottom: '16px' 
          }}>
            La confianza de nuestros clientes
          </span>
          <h2 className="font-brand" style={{ 
            fontSize: 'clamp(32px, 5vw, 48px)', 
            fontWeight: '900', 
            color: '#0B1623', 
            letterSpacing: '-0.02em', 
            lineHeight: '1.1',
            marginBottom: '24px'
          }}>
            Voces de quienes ya <br /> disfrutan del paraíso.
          </h2>
        </motion.div>

        {/* Infinite Carousel Container */}
        <div style={{ 
          width: '100%', 
          overflow: 'hidden', 
          padding: '20px 0 40px',
          position: 'relative'
        }}>
          {/* Gradient Overlays for smooth edges */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0, width: '100px',
            background: 'linear-gradient(to right, white, transparent)',
            zIndex: 2, pointerEvents: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, width: '100px',
            background: 'linear-gradient(to left, white, transparent)',
            zIndex: 2, pointerEvents: 'none'
          }}></div>

          <motion.div 
            animate={{ x: [0, -1200] }}
            transition={{ 
              duration: 30, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{ 
              display: 'flex', 
              gap: '24px', 
              paddingLeft: '24px',
              width: 'max-content'
            }}
          >
            {duplicatedReviews.map((review, idx) => (
              <div 
                key={idx}
                style={{
                  width: '320px',
                  backgroundColor: 'rgba(249, 250, 251, 0.7)',
                  backdropFilter: 'blur(8px)',
                  padding: '32px',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  borderRadius: '0px', // Square
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.4s ease',
                  flexShrink: 0
                }}
                className="hover:bg-white hover:shadow-2xl hover:-translate-y-2 group"
              >
                <div>
                  {/* Rating Stars */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
                    {[...Array(review.rating)].map((_, i) => (
                       <Star 
                         key={i}
                         size={20} 
                         fill="#FFB800" 
                         color="#FFB800" 
                         style={{ filter: 'drop-shadow(0 2px 8px rgba(255,184,0,0.4))' }}
                       />
                    ))}
                  </div>

                  <p style={{ 
                    fontSize: '15px', 
                    color: '#1e293b', 
                    lineHeight: '1.6', 
                    fontWeight: '500', 
                    marginBottom: '32px',
                    fontStyle: 'italic'
                  }}>
                    "{review.content}"
                  </p>
                </div>

                {/* User Info */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  borderTop: '1px solid rgba(226, 232, 240, 0.8)', 
                  paddingTop: '20px' 
                }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    backgroundColor: '#004A87', 
                    borderRadius: '0px', // Square
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                     {review.image ? (
                       <img 
                         src={review.image} 
                         alt={review.name} 
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                       />
                     ) : (
                       <User size={18} />
                     )}
                  </div>
                  <div>
                     <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 2px 0', lineHeight: '1.2' }}>{review.name}</h4>
                     <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1' }}>{review.meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Call to Action Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}
        >
          <a 
            href="https://www.google.com/search?q=Aquatech+Loja+rese%C3%B1as&rlz=1C1CHBF_esEC1095EC1095&oq=Aquatech+Loja+rese%C3%B1as&gs_lcrp=EgZjaHJvbWUyBggAEEUYOTIHCAEQIRigAdIBCDcwNTVqMGo3qAIAsAIA&sourceid=chrome&ie=UTF-8"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              padding: '16px 32px',
              borderRadius: '0px', // Square
              fontWeight: '700',
              fontSize: '18px',
              textDecoration: 'none',
              boxShadow: '0 10px 25px -5px rgba(0, 74, 135, 0.4)',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            className="hover:scale-105 active:scale-95"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
              <MessageCircle size={22} />
              <span>Déjanos tu reseña</span>
              <ExternalLink size={18} style={{ opacity: 0.8 }} />
            </div>
            
            <div style={{ 
              position: 'absolute', 
              top: 0, left: 0, right: 0, bottom: 0, 
              borderRadius: '0px', // Square
              border: '1px solid rgba(255,255,255,0.2)', 
              pointerEvents: 'none' 
            }}></div>
          </a>
        </motion.div>

      </div>
    </section>
  )
}
