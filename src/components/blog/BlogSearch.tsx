'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Category {
  id: number;
  name: string;
}

interface BlogSearchProps {
  categories?: Category[];
  placeholder?: string;
  className?: string;
}

/**
 * COMPONENTE INTERNO: Maneja la lógica de búsqueda y parámetros de URL.
 * Debe estar envuelto en <Suspense> en Next.js App Router si se usa useSearchParams.
 */
function SearchContent({ categories = [], placeholder = 'Buscar artículos...', className = '' }: BlogSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('cat') || '');

  // Sincronizar con la URL mediante un debounce manual
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (query) {
        params.set('q', query);
      } else {
        params.delete('q');
      }

      if (categoryId) {
        params.set('cat', categoryId);
      } else {
        params.delete('cat');
      }

      // Evitamos scroll innecesario al filtrar
      router.push(`?${params.toString()}`, { scroll: false });
    }, 400);

    return () => clearTimeout(timer);
  }, [query, categoryId, router, searchParams]);

  return (
    <div className={`flex flex-col gap-4 ${className}`} style={{ width: '100%' }}>
      {/* BARRA DE BÚSQUEDA */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-deep)',
        borderRadius: '16px',
        padding: '0 20px',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          style={{ width: '20px', height: '20px', color: 'var(--primary)', marginRight: '12px' }}
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '16px 0',
            width: '100%',
            color: 'var(--text)',
            fontSize: '1rem',
            fontFamily: 'inherit'
          }}
        />
        {query && (
          <button 
            type="button"
            onClick={() => setQuery('')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '10px'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '12px', height: '12px' }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* PESTAÑAS DE CATEGORÍAS */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: '10px',
        padding: '5px 0'
      }}>
        <button
          type="button"
          onClick={() => setCategoryId('')}
          style={{
            padding: '8px 20px',
            borderRadius: '30px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '1px solid var(--border)',
            background: categoryId === '' ? 'var(--primary)' : 'var(--bg-card)',
            color: categoryId === '' ? '#000' : 'var(--text-secondary)',
            boxShadow: categoryId === '' ? '0 4px 12px var(--primary-glow)' : 'none'
          }}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryId(cat.id.toString())}
            style={{
              padding: '8px 20px',
              borderRadius: '30px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '1px solid var(--border)',
              background: categoryId === cat.id.toString() ? 'var(--primary)' : 'var(--bg-card)',
              color: categoryId === cat.id.toString() ? '#000' : 'var(--text-secondary)',
              boxShadow: categoryId === cat.id.toString() ? '0 4px 12px var(--primary-glow)' : 'none'
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * EXPORTACIÓN NOMBRADA: Más segura para la resolución de módulos en Next.js.
 */
export function BlogSearch(props: BlogSearchProps) {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Cargando filtros...</div>}>
      <SearchContent {...props} />
    </Suspense>
  );
}

export default BlogSearch;
