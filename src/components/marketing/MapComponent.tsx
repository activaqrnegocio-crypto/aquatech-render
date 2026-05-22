'use client'

import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom Marker Generator
const createIcon = (color: string) => L.icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -34],
  shadowSize: [36, 36]
})

const icons = {
  blue: createIcon('blue'),
  green: createIcon('green'),
  red: createIcon('red'),
  orange: createIcon('orange'),
}

const activeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  shadowSize: [41, 41]
})

interface MapComponentProps {
  locations: any[]
  selectedId: number | null
}

function ChangeView({ center, zoom, isInitial }: { center: [number, number], zoom: number, isInitial: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (isInitial) {
      map.setView(center, zoom)
    } else {
      map.flyTo(center, 14, {
        duration: 2,
        easeLinearity: 0.25
      })
    }
  }, [center, zoom, map, isInitial])
  return null
}

export default function MapComponent({ locations, selectedId }: MapComponentProps) {
  const [isInitial, setIsInitial] = useState(true)
  const [ecuadorZoom, setEcuadorZoom] = useState(6.5)

  useEffect(() => {
    if (selectedId !== null) {
      setIsInitial(false)
    }

    // Zoom level 6.5 as requested ("poquito mas alejado")
    const handleResize = () => {
      setEcuadorZoom(window.innerWidth < 1024 ? 5.5 : 6.5)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [selectedId])

  const ecuadorCenter: [number, number] = [-1.45, -78.4]

  const selectedLoc = locations.find(l => l.id === selectedId) || null
  const currentCenter: [number, number] = selectedLoc ? [selectedLoc.lat, selectedLoc.lng] : ecuadorCenter

  const getMarkerIcon = (id: number) => {
    if (selectedId === id) return activeIcon
    switch(id) {
      case 0: return icons.blue    
      case 1: return icons.green   
      case 2: return icons.red     
      case 3: return icons.orange  
      default: return icons.blue
    }
  }
  
  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }} className="green-map-filter">
      <style>{`
        /* CSS Trick to make ANY map greener and remove brown/reddish tones */
        .green-map-filter .leaflet-tile-pane {
          filter: hue-rotate(50deg) saturate(1.8) brightness(1.05) contrast(0.95);
        }
        /* Keep markers in their original colors */
        .green-map-filter .leaflet-marker-pane,
        .green-map-filter .leaflet-shadow-pane {
           filter: none !important;
         }
      `}</style>
      <MapContainer 
        center={ecuadorCenter} 
        zoom={ecuadorZoom} 
        style={{ height: '100%', width: '100%', backgroundColor: '#AAD3DF' }} 
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <ChangeView 
          center={currentCenter} 
          zoom={selectedLoc ? 14 : ecuadorZoom} 
          isInitial={selectedId === null} 
        />

        {locations.map((loc) => (
          <Marker 
            key={loc.id} 
            position={[loc.lat, loc.lng]}
            icon={getMarkerIcon(loc.id)}
            eventHandlers={{
              click: () => {
                window.open(loc.link, '_blank')
              },
            }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
