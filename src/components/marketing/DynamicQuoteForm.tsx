'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Send, UploadCloud, CheckCircle2, Loader2, Info, Plus } from 'lucide-react'

export interface DynamicFormProps {
  categoryName: string;
  whatsappNumber?: string;
  showDimensions?: boolean;
  showReferences?: boolean;
}

export default function DynamicQuoteForm({ 
  categoryName, 
  whatsappNumber = '59300000000', // Default fallback si no se pasa uno
  showDimensions = true, 
  showReferences = true 
}: DynamicFormProps) {
  const [loading, setLoading] = useState(false)
  const [filesData, setFilesData] = useState<{ url?: string; preview: string; name: string; loading: boolean }[]>([])
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    dimensions: '',
    details: ''
  })

  // Manejo de carga de archivos (Sube al API que conecta con Bunny.net)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Limitar a 10 archivos totales
    const totalPossible = filesData.length + selectedFiles.length
    if (totalPossible > 10) {
      alert("Puedes subir un máximo de 10 imágenes.")
      return
    }

    // Preparar nuevos archivos en el estado
    const newFiles = selectedFiles.map(file => ({
      preview: URL.createObjectURL(file),
      name: file.name,
      loading: true
    }))

    setFilesData(prev => [...prev, ...newFiles])
    setLoading(true)

    // Subir cada archivo individualmente
    for (const [index, file] of selectedFiles.entries()) {
      const currentIdx = filesData.length + index
      
      try {
        const data = new FormData()
        data.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: data
        })

        const json = await res.json()
        if (res.ok) {
          setFilesData(prev => {
            const updated = [...prev]
            updated[currentIdx] = { ...updated[currentIdx], url: json.url, loading: false }
            return updated
          })
        } else {
          const errMsg = json.error || "Error desconocido"
          alert(`Error al subir ${file.name}: ${errMsg}`)
          console.error("Error subiendo:", errMsg)
          setFilesData(prev => {
            const updated = [...prev]
            updated[currentIdx].loading = false
            return updated
          })
        }
      } catch (error) {
        console.error("Error de red:", error)
        setFilesData(prev => {
            const updated = [...prev]
            updated[currentIdx].loading = false
            return updated
          })
      }
    }
    
    setLoading(false)
  }

  const removeFile = (idx: number) => {
    setFilesData(prev => prev.filter((_, i) => i !== idx))
  }

  // Generador del Mensaje de WhatsApp
  const handleWhatsAppSend = () => {
    if(!formData.name || !formData.location) {
        alert("Por favor ingresa al menos tu nombre y ciudad.");
        return;
    }

    const uploadedUrls = filesData.filter(f => f.url).map(f => f.url)
    const isStillLoading = filesData.some(f => f.loading)

    if (isStillLoading) {
        alert("Espera a que todas las imágenes terminen de subir.");
        return;
    }

    let message = `🌊 *SOLICITUD DE COTIZACIÓN TÉCNICA* 🌊\n`
    message += `*Categoría:* ${categoryName}\n`
    message += `───────────────────────────\n\n`
    message += `💎 *CLIENTE:* ${formData.name}\n`
    message += `📍 *UBICACIÓN:* ${formData.location}\n`
    
    if (showDimensions && formData.dimensions) {
      message += `📐 *MEDIDAS:* ${formData.dimensions}\n`
    }
    
    if (formData.details) {
      message += `📝 *DETALLES:* ${formData.details}\n`
    }
    
    if (uploadedUrls.length > 0) {
      message += `\n🖼️ *REFERENCIAS VISUALES (${uploadedUrls.length}):*\n`
      uploadedUrls.forEach((url, i) => {
        message += `🔗 ${i+1}. ${url}\n`
      })
    }
    
    message += `\n───────────────────────────\n`
    message += `🏗️ *AQUATECH - INGENIERÍA PURA*`

    const wpUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    window.open(wpUrl, '_blank')
  }

  return (
    <div className="w-full bg-white p-0 text-left">
      <style jsx>{`
        .square-input {
          border-radius: 0px !important;
          border: 1px solid #E5E7EB;
          background-color: white;
          color: black;
          font-size: 13px; /* Slightly larger for mobile readability */
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 18px 20px; /* Increased padding for better touch height */
          outline: none;
          transition: all 0.3s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .square-input:focus { border-color: #004A87; }
        .square-input::placeholder { color: #9CA3AF; font-size: 10px; }
        .btn-aquatech {
          border-radius: 0px !important;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 900;
          font-size: 12px;
          padding: 22px;
          width: 100%;
          transition: all 0.3s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-family: var(--font-brand) !important;
        }
        h3 { font-size: 1.5rem; }
        @media (min-width: 768px) {
           h3 { font-size: 1.875rem; }
        }
        h3, span { font-family: var(--font-brand); }
        label, input, textarea, p { font-family: var(--font-body); }
        
        .preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr); /* 3 items per row on mobile */
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 640px) {
          .preview-grid {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
            gap: 12px;
          }
        }
        .prefix-thumb {
          aspect-ratio: 1;
          position: relative;
          border: 1px solid #004A87;
          overflow: hidden;
          background: #f9fafb;
        }
        .remove-btn {
          position: absolute;
          top: 0;
          right: 0;
          background: #004A87;
          color: white;
          width: 24px; /* Larger touch target */
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          z-index: 30;
        }
      `}</style>

      <div className="mb-10 text-center md:text-left">
         <span className="text-[#004A87] font-black uppercase tracking-[0.4em] text-[9px] mb-2 block">Cotización Dinámica</span>
         <h3 className="text-xl md:text-3xl font-black text-black tracking-tighter uppercase leading-tight mb-3">
           Ingeniería<br />para {categoryName}
         </h3>
         <p className="text-gray-400 text-[10px] md:text-[11px] font-medium leading-relaxed">Configura los parámetros técnicos de tu proyecto.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
           <label className="block text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-black mb-2 flex items-center gap-2">Nombre del Cliente <span className="text-[#004A87]">*</span></label>
           <input type="text" className="square-input" placeholder="INGRESA TU NOMBRE" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div>
           <label className="block text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-black mb-2 flex items-center gap-2">Ciudad / Ubicación <span className="text-[#004A87]">*</span></label>
           <input type="text" className="square-input" placeholder="EJ: QUITO, VALLE DE CUMBAYÁ" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
      </div>

      {showDimensions && (
        <div className="mb-6">
           <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-black mb-2 flex items-center justify-between">
              <span>Medidas o Área Estimada</span>
              <span className="text-gray-400 font-normal tracking-normal lowercase">(opcional)</span>
           </label>
           <input type="text" className="square-input" placeholder="EJ: 2M X 2M O 15 METROS CUADRADOS" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
        </div>
      )}

      {showReferences && (
        <div className="mb-6">
           <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-black mb-2">Imágenes de Referencia (Máx 10)</label>
           
           <div className={`border-2 border-dashed ${filesData.length > 0 ? 'border-[#004A87] bg-[#004A87]/5' : 'border-gray-200 bg-white'} p-4 flex flex-col items-center justify-center relative transition-all min-h-[100px]`}>
              
              {filesData.length > 0 ? (
                <div className="w-full">
                  <div className="preview-grid mb-4">
                    {filesData.map((file, i) => (
                      <div key={i} className="prefix-thumb">
                        <img src={file.preview} className="w-full h-full object-cover" alt="Preview" />
                        {file.loading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="animate-spin text-white" size={16} />
                          </div>
                        )}
                        {!file.loading && file.url && (
                          <div className="absolute bottom-0 right-0 bg-[#004A87] text-white p-0.5">
                            <CheckCircle2 size={10} />
                          </div>
                        )}
                        <button className="remove-btn" onClick={() => removeFile(i)}>×</button>
                      </div>
                    ))}
                    {filesData.length < 10 && (
                       <div className="prefix-thumb border-dashed bg-white border-gray-300 flex items-center justify-center cursor-pointer relative">
                          <Plus size={20} className="text-gray-300" />
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={handleFileUpload}
                          />
                       </div>
                    )}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#004A87] block text-center">
                    {filesData.length} de 10 imágenes cargadas
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-400 py-6">
                  <UploadCloud size={32} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-black">Seleccionar Referencias</span>
                  <span className="text-[8px] font-medium tracking-widest uppercase mt-2">Formatos: JPG, PNG, WEBP (Máx 5MB)</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                    onChange={handleFileUpload}
                  />
                </div>
              )}
           </div>
        </div>
      )}

      <div className="mb-8">
         <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-black mb-2 text-left">Detalles adicionales del Proyecto</label>
         <textarea className="square-input min-h-[100px] resize-none" placeholder="CUÉNTANOS MÁS SOBRE MATERIALES, ESTÉTICA O PLAZOS..." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})}></textarea>
      </div>

      <button 
        onClick={handleWhatsAppSend}
        className="btn-aquatech bg-black text-white hover:bg-[#004A87] disabled:opacity-50"
        disabled={loading || filesData.some(f => f.loading)}
      >
        {loading ? 'Subiendo Referencias...' : 'Enviar Solicitud al Experto'} <Send size={16} />
      </button>

      <div className="mt-4 flex items-start gap-2 justify-center text-gray-400">
        <Info size={12} className="shrink-0 mt-0.5" />
        <p className="text-[8px] uppercase tracking-widest leading-relaxed text-center">La información y archivos serán canalizados directamente a nuestra terminal de ingeniería vía WhatsApp de forma segura.</p>
      </div>
    </div>
  )
}
