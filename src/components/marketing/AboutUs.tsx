'use client'

import { motion } from 'framer-motion'
import { MapPin, ShieldCheck, Zap, Heart, ArrowRight } from 'lucide-react'

export default function AboutUs() {
  const cards = [
    {
      title: "Presencia Regional",
      icon: <MapPin size={24} />,
      items: ["Matriz Loja", "Agencia Malacatos", "Boutique Vilcabamba", "Soporte Yantzaza"],
      accent: "#004A87"
    },
    {
      title: "Modelo Llave en Mano",
      icon: <Zap size={24} />,
      items: ["Diseño Arquitectónico", "Construcción Civil", "Montaje Técnico", "Mantenimiento"],
      accent: "#000000"
    },
    {
      title: "Ingeniería de Agua",
      icon: <ShieldCheck size={24} />,
      items: ["Piscinas de Lujo", "Riego Automático", "Potabilización", "Bombeo Industrial"],
      accent: "#004A87"
    },
    {
      title: "Misión Aquatech",
      icon: <Heart size={24} />,
      items: ["Bienestar Hogar", "Sustentabilidad", "Calidad Alemana", "Garantía Real"],
      accent: "#000000"
    }
  ]

  return (
    <section 
      id="nosotros"
      style={{ 
        backgroundColor: '#FAFAFB', 
        paddingTop: '160px', 
        paddingBottom: '160px',
        borderTop: '1px solid #EEEEEE'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '100px', maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '32px' }}>
             <div style={{ width: '60px', height: '4px', backgroundColor: '#004A87' }} />
             <span style={{ fontSize: '14px', fontWeight: '900', color: '#004A87', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
                Conoce Nuestra Esencia
             </span>
             <div style={{ width: '60px', height: '4px', backgroundColor: '#004A87' }} />
          </div>
          <h2 style={{ fontSize: 'clamp(44px, 6vw, 76px)', fontWeight: '900', color: 'black', lineHeight: '1.1', letterSpacing: '-0.04em', marginBottom: '40px' }}>
            Líderes en el ciclo <br />
            <span style={{ color: '#004A87' }}>integral del agua.</span>
          </h2>
          <p style={{ fontSize: '21px', color: '#666666', lineHeight: '1.7', maxWidth: '960px', margin: '40px auto 0' }}>
            Aquatech consolida una década de trayectoria en ingeniería hidráulica, transformando hogares con soluciones de alta gama respaldadas por soporte técnico certificado.
          </p>
        </div>

        {/* The Grid - Card-Based */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '32px' 
        }}>
          {cards.map((card, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'white',
                padding: '48px',
                border: '1px solid #EEEEEE',
                borderTop: `6px solid ${card.accent}`,
                boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
                transition: 'all 0.4s ease'
              }}
              className="group hover:shadow-2xl translate-y-0 hover:-translate-y-2 transition-all duration-500"
            >
              <div style={{ marginBottom: '40px', color: '#004A87' }}>
                {card.icon}
              </div>
              
              <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'black', marginBottom: '32px', letterSpacing: '-0.02em' }}>
                {card.title}
              </h3>

              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {card.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', color: '#444444', fontWeight: '600', marginBottom: '16px' }}>
                    <div style={{ width: '6px', height: '6px', backgroundColor: '#004A87' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer of the section */}
        <div style={{ marginTop: '120px', textAlign: 'center' }}>
           <h3 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '900', fontStyle: 'italic', color: '#004A87', marginBottom: '60px', letterSpacing: '-0.02em' }}>
              "El Paraíso en Tu Hogar"
           </h3>
           <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <button 
                style={{
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '24px 50px',
                  fontSize: '12px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4em',
                  border: 'none',
                  cursor: 'pointer'
                }}
                className="hover:bg-[#004A87] transition-all"
              >
                Nuestra Historia
              </button>
              <button 
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  padding: '24px 50px',
                  fontSize: '12px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4em',
                  border: '2px solid black',
                  cursor: 'pointer'
                }}
                className="hover:bg-black hover:text-white transition-all"
              >
                Contactar Experto
              </button>
           </div>
        </div>

      </div>
    </section>
  )
}
