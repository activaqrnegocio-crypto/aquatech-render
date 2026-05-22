'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ShoppingCart, ZoomIn, X, ChevronRight, SlidersHorizontal, Tag } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { catalogData, Product } from '@/data/catalog'

const categories = [
  'Hidromasajes', 'Turcos', 'Saunas', 'Piletas', 
  'Tuberías', 'Agua Potable', 'Riego', 'Accesorios'
]

const accessoriesSubFilters = [
  { label: 'TODOS', tag: null },
  { label: 'ACCESORIOS DE PISCINAS', tag: 'PISCINA' },
  { label: 'ACCESORIOS DE TURCOS', tag: 'TURCO' },
  { label: 'ACCESORIOS DE HIDROMASAJES', tag: 'HIDROMASAJE' },
]

export default function UniversalCatalog({ defaultCategory = 'Hidromasajes' }: { defaultCategory?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeCategory, setActiveCategory] = useState(defaultCategory)
  const [activeSubTag, setActiveSubTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState(15000)
  const [selectedImg, setSelectedImg] = useState<string | null>(null)

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const filteredProducts = useMemo(() => {
    return catalogData.filter(prod => 
      prod.category === activeCategory &&
      (!activeSubTag || prod.tags?.includes(activeSubTag)) &&
      prod.price <= maxPrice &&
      (prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       prod.code.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [activeCategory, activeSubTag, searchQuery, maxPrice])

  return (
    <div className="w-full bg-white section-gap pb-32">
      <style jsx>{`
        .aquatech-container {
          max-width: 1300px;
          margin: 0 auto;
          width: 100%;
          padding: 0 40px;
        }
        .catalog-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 60px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .catalog-grid {
            grid-template-columns: 1fr;
          }
        }
        .text-aquatech-blue { color: #004A87; }
        .bg-aquatech-blue { background-color: #004A87; }
        .square-border { border-radius: 0px !important; }
      `}</style>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImg && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setSelectedImg(null)}
          >
            <button className="absolute top-10 right-10 text-white"><X size={40} /></button>
            <motion.img 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              src={selectedImg} className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="aquatech-container">
        
        {/* Título Dinámico basado en Categoría */}
        <div className="mb-12 md:mb-20 border-b border-gray-100 pb-8 md:pb-12">
          <h2 className="text-4xl md:text-[80px] font-black text-[#004A87] tracking-tighter uppercase leading-none mb-4">
            {activeCategory}
          </h2>
          <p className="text-gray-400 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-bold">Catálogo Técnico Profesional</p>
        </div>

        <div className="catalog-grid px-0">
          
          {/* LADO IZQUIERDO: FILTROS (30% aprox) */}
          <aside className="w-full flex flex-col gap-14 text-left">
            
            {/* Buscador */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-black border-l-4 border-aquatech-blue pl-4">Buscar Equipo</h3>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                  type="text"
                  placeholder="CÓDIGO O MODELO..."
                  className="w-full pl-10 pr-4 py-4 bg-[#F9FAFB] border border-gray-200 text-[10px] font-black uppercase tracking-widest outline-none focus:border-aquatech-blue transition-all square-border text-black"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Categorías */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-black border-l-4 border-aquatech-blue pl-4">Categorías</h3>
              <div className="flex flex-col border border-gray-100">
                {categories.map((cat) => (
                  <div key={cat} className="flex flex-col">
                    <button
                      onClick={() => {
                        const routeMap: Record<string, string> = {
                          'Hidromasajes': 'hidromasajes',
                          'Turcos': 'turcos',
                          'Saunas': 'saunas',
                          'Piletas': 'piletas',
                          'Tuberías': 'tuberias',
                          'Agua Potable': 'agua-potable',
                          'Riego': 'riego',
                          'Accesorios': 'accesorios'
                        }
                        
                        const targetRoute = `/${routeMap[cat]}`
                        
                        // Si ya estamos en la ruta correcta, solo actualizamos el filtro localmente
                        // Esto hace que la navegación sea instantánea y no se sienta el cambio de página
                        if (pathname === targetRoute) {
                          setActiveCategory(cat as any)
                          setActiveSubTag(null)
                          return
                        }

                        // Si es una ruta diferente, navegamos
                        setActiveCategory(cat as any)
                        setActiveSubTag(null)
                        router.push(`${targetRoute}#catalogo`, { scroll: false })
                      }}
                      className={`text-left px-5 py-4 text-[11px] font-bold uppercase tracking-widest transition-all border-b border-gray-100 flex justify-between items-center ${
                        activeCategory === cat 
                        ? 'text-white bg-[#004A87]' 
                        : 'text-gray-700 hover:text-black hover:bg-gray-50'
                      }`}
                    >
                      {cat}
                      {activeCategory === cat ? <X size={14} /> : <ChevronRight size={14} className="opacity-30" />}
                    </button>

                    {/* Sub-Categorías para Accesorios */}
                    <AnimatePresence>
                      {cat === 'Accesorios' && activeCategory === 'Accesorios' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-gray-50 border-b border-gray-100"
                        >
                          {accessoriesSubFilters.map((sub) => (
                            <button
                              key={sub.label}
                              onClick={() => setActiveSubTag(sub.tag)}
                              className={`w-full text-left px-8 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
                                activeSubTag === sub.tag 
                                ? 'text-[#004A87]' 
                                : 'text-gray-400 hover:text-black'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${activeSubTag === sub.tag ? 'bg-[#004A87]' : 'bg-gray-200'}`} />
                              {sub.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Precio */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-black border-l-4 border-aquatech-blue pl-4">Inversión Máxima</h3>
              <div className="pt-4 px-2">
                <input 
                  type="range" min="500" max="15000" step="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-300 appearance-none cursor-pointer accent-[#004A87]"
                />
                <div className="flex justify-between mt-4">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Min. $500</span>
                  <span className="text-[12px] font-black text-aquatech-blue tracking-tighter underline">Max. ${isMounted ? maxPrice.toLocaleString() : maxPrice}</span>
                </div>
              </div>
            </div>

          </aside>

          {/* LADO DERECHO: GALERÍA DE PRODUCTOS (Color y Limpieza) */}
          <div className="flex flex-col gap-10">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-6 text-gray-400">
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">{filteredProducts.length} Modelos Listados</span>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                 <SlidersHorizontal size={12} /> Filtros Dinámicos
               </div>
            </div>

            {filteredProducts.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
              >
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      key={product.id}
                      className="group bg-white border border-gray-100 p-3 flex flex-col hover:border-aquatech-blue transition-all"
                    >
                      <div 
                        className="aspect-square bg-[#F9FAFB] relative overflow-hidden cursor-zoom-in"
                        onClick={() => setSelectedImg(product.img)}
                      >
                         <img src={product.img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={product.name} />
                         
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn className="text-aquatech-blue" size={32} strokeWidth={1.5} />
                         </div>
                      </div>

                      <div className="p-6 flex flex-col flex-1">
                         <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-2">{product.code}</span>
                         <h4 className="text-[13px] font-black text-black uppercase tracking-tight leading-tight mb-8 group-hover:text-aquatech-blue transition-colors">
                           {product.name}
                         </h4>
                         
                         <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between">
                            <div className="flex flex-col text-left">
                              {product.promoPrice && (
                                <span className="text-[9px] text-gray-300 line-through font-bold">USD {isMounted ? product.promoPrice.toLocaleString() : product.promoPrice}</span>
                              )}
                              <span className="text-[16px] font-black text-aquatech-blue tracking-tighter">USD {isMounted ? product.price.toLocaleString() : product.price}</span>
                            </div>
                            <Link href="/contacto" className="w-10 h-10 border border-aquatech-blue/20 flex items-center justify-center hover:bg-aquatech-blue hover:text-white transition-all square-border">
                              <ShoppingCart size={14} />
                            </Link>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="py-32 text-center bg-[#F9FAFB] border-2 border-dashed border-gray-100">
                 <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.5em]">No hay resultados específicos.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
