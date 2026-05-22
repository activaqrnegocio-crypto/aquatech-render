'use client'

import React, { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Navigation, Info, Search } from 'lucide-react'
import { agencyLocations } from '@/data/agencies'

// Dynamic import for Leaflet (No SSR)
const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando Ecuador...</div>
})

export default function AgencyLocator({ 
  fullWidth = false,
  showHeading = true 
}: { 
  fullWidth?: boolean,
  showHeading?: boolean 
}) {
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLocations = useMemo(() => {
    return agencyLocations.filter(loc => 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  return (
    <div className="aq-locator-component">
      <style dangerouslySetInnerHTML={{ __html: `
        .aq-locator-grid { display: flex; flex-direction: column; position: relative; width: 100%; }
        .aq-locator-map-area { order: 1; position: relative; overflow: hidden; background-color: #F9FAFB; height: 400px; border: 1px solid #E5E7EB; margin-bottom: 1px; }
        .aq-locator-info-overlay { background-color: white; padding: 16px 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); border: 1px solid #EEEEEE; width: 100%; order: 1.5; margin-bottom: 8px; }
        .aq-locator-search-bar { background-color: #111827; padding: 16px; display: flex; flex-direction: column; align-items: stretch; gap: 12px; border: 1px solid #000; margin-bottom: -1px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); order: 3; }
        .aq-locator-sidebar { order: 4; overflow-y: auto; background-color: #FFFFFF; border: 1px solid #E5E7EB; max-height: 450px; }
        
        .aq-locator-input { width: 100%; flex: 1; }
        .aq-locator-btn { width: 100%; }

        @media (min-width: 1024px) {
          .aq-locator-grid { 
            display: grid; 
            grid-template-columns: ${fullWidth ? '420px 1fr' : '1fr 2.5fr'}; 
            grid-template-areas: 
              "aq-search aq-search"
              "aq-sidebar aq-map";
          }
          .aq-locator-search-bar { grid-area: aq-search; flex-direction: row; align-items: center; padding: 24px; gap: 16px; order: unset; }
          .aq-locator-input { width: auto; }
          .aq-locator-btn { width: auto; }
          .aq-locator-sidebar { grid-area: aq-sidebar; border-top: none; border-right: none; max-height: ${fullWidth ? '850px' : '680px'}; order: unset; }
          .aq-locator-map-area { grid-area: aq-map; height: 100%; min-height: ${fullWidth ? '850px' : '680px'}; border-top: none; order: unset; margin-bottom: 0; }
          .aq-locator-info-overlay { position: absolute; top: 20px; right: 20px; width: auto; max-width: 240px; z-index: 1000; margin-bottom: 0; order: unset; }
        }
      `}} />

      {showHeading && (
        <div className="aq-locator-heading mb-12">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '3px', backgroundColor: '#004A87' }} />
            <span className="font-brand" style={{ fontSize: '12px', fontWeight: '900', color: '#004A87', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
              Nuestras Agencias
            </span>
          </div>
          <h2 className="font-brand text-[42px] md:text-[60px] font-black leading-[1.1] tracking-tighter uppercase text-black">
            Encuéntranos
          </h2>
        </div>
      )}

      <div className="aq-locator-grid">
        {/* Search Bar */}
        <div className="aq-locator-search-bar">
          <Search size={22} color="#9CA3AF" />
          <input 
            type="text" 
            placeholder="Busca por ciudad o nombre de sede..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="aq-locator-input"
            style={{
              padding: '16px 20px',
              border: '1px solid #374151',
              borderRadius: '0px',
              fontSize: '16px',
              outline: 'none',
              backgroundColor: '#1F2937',
              color: 'white',
              fontWeight: '500'
            }}
          />
          <button className="aq-locator-btn hover:bg-[#0070C0] transition-colors" style={{
            backgroundColor: '#004A87',
            color: 'white',
            padding: '16px 40px',
            border: 'none',
            borderRadius: '0px',
            fontWeight: '900',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'pointer'
          }}>
            Buscar
          </button>
        </div>
        
        {/* Sidebar List */}
        <div className="aq-locator-sidebar">
          {filteredLocations.map((loc) => (
            <div 
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id)}
              style={{
                padding: '36px 30px',
                borderBottom: '1px solid #F3F4F6',
                cursor: 'pointer',
                backgroundColor: selectedLocation === loc.id ? '#F9FAFB' : 'transparent',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
            >
              {selectedLocation === loc.id && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: '#004A87' }} />
              )}
              <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#111827', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: '1.2' }}>{loc.name}</h4>
              <p style={{ fontSize: '14px', color: '#4B5563', margin: '0 0 20px 0', lineHeight: '1.5', fontWeight: '500' }}>{loc.address}</p>
              
              <a 
                href={loc.link} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: '12px', fontWeight: '900', color: '#004A87', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                className="hover:underline"
              >
                Ver en Google Maps 
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Navigation size={10} strokeWidth={3} />
                </motion.div>
              </a>
            </div>
          ))}
          {filteredLocations.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>
              No se encontraron sedes.
            </div>
          )}
        </div>

        {/* Map Holder */}
        <div className="aq-locator-map-area">
          <MapComponent locations={agencyLocations} selectedId={selectedLocation} />
        </div>

        {/* Info Label */}
        <div className="aq-locator-info-overlay">
           <div style={{ fontSize: '11px', fontWeight: '900', color: '#004A87', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sede Activa</div>
           <div style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
             {selectedLocation !== null ? agencyLocations.find(l => l.id === selectedLocation)?.name : "Nacional - Ecuador"}
           </div>
           <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <Info size={12} /> {selectedLocation !== null ? "Haz clic en el pin del mapa" : "Selecciona una sede"}
           </div>
        </div>
      </div>
    </div>
  )
}
