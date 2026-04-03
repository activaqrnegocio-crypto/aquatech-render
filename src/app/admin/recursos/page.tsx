import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import BlogSearch from '../../../components/blog/BlogSearch';
import { deepSerialize } from '@/lib/serializable';

interface RecursosPageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function RecursosPage({ searchParams }: RecursosPageProps) {
  // En Next.js 16, searchParams debe ser esperado (awaited)
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const categoryId = resolvedParams.cat || '';

  // Categorías para el buscador
  const categories = await prisma.blogCategory.findMany({
    orderBy: { name: 'asc' }
  });

  // ... (pagoRecurso and generalRecursos remain the same)
  const pagoRecurso = {
    id: "s1",
    title: 'Datos para Pagos',
    description: 'Cuentas bancarias y códigos QR para transferencias rápidas.',
    image: '/recursos/recurso-1.jpeg',
    type: 'Pagos'
  };

  const generalRecursos = [
    {
      id: "s2",
      title: 'Documentación General',
      description: 'Manuales corporativos y guías de usuario.',
      image: '/recursos/recurso-2.jpeg',
      type: 'Documentación'
    },
    {
      id: "s3",
      title: 'Catálogo de Materiales',
      description: 'Especificaciones técnicas actualizadas.',
      image: '/recursos/recurso-3.jpeg',
      type: 'Materiales'
    }
  ];

  // Recursos dinámicos (Blog) - Con filtrado
  const blogPosts = await prisma.blogPost.findMany({
    where: {
      ...(query && {
        OR: [
          { title: { contains: query } },
          { excerpt: { contains: query } },
          { content: { contains: query } },
        ],
      }),
      ...(categoryId && { categoryId: Number(categoryId) })
    },
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
    }
  });

  return (
    <div className="p-6">
      <div className="dashboard-header mb-xl" style={{ animation: 'fadeIn 0.5s ease-out' }}>
        <div>
          <h2 className="page-title">Centro de Recursos</h2>
          <p className="page-subtitle">
            Gestión interna de datos operativos y portafolio de trabajos realizados
          </p>
        </div>
      </div>

      {/* FILA SUPERIOR: PAGOS Y APOYO */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
        {/* SECCIÓN 1: COBROS Y PAGOS */}
        <section style={{ flex: '1 1 350px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '20px', height: '20px' }}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Cobros y Pagos
          </h3>
          <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--primary-glow)' }}>
            <div style={{ position: 'relative', height: '160px', overflow: 'hidden', background: 'var(--bg-deep)' }}>
              <img 
                src={pagoRecurso.image} 
                alt={pagoRecurso.title} 
                className="hover-scale"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--primary)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800', color: '#000', zIndex: 2 }}>
                {pagoRecurso.type}
              </div>
            </div>
            <div style={{ padding: '15px' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '4px', color: 'var(--text)', fontWeight: '700' }}>{pagoRecurso.title}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '15px' }}>{pagoRecurso.description}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={pagoRecurso.image} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: '0.75rem' }}>Ver Full</a>
                <a href={pagoRecurso.image} download="aquatech-pagos" className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: MATERIAL DE APOYO */}
        <section style={{ flex: '2 1 600px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '20px', height: '20px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Material de Apoyo
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
            {generalRecursos.map((item) => (
              <div key={item.id} className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', height: '120px', overflow: 'hidden', background: 'var(--bg-deep)' }}>
                  <img src={item.image} alt={item.title} className="hover-scale" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '700', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    {item.type}
                  </div>
                </div>
                <div style={{ padding: '15px' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', color: 'var(--text)', fontWeight: '700' }}>{item.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '15px' }}>{item.description}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={item.image} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.7rem' }}>Ver Imagen</a>
                    <a href={item.image} download={`aquatech-${item.type.toLowerCase()}`} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ marginTop: 'var(--space-2xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '28px', height: '28px', color: 'var(--primary)' }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Trabajos Realizados
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 1rem auto' }}>
            Explora el portafolio de proyectos ejecutados y artículos técnicos publicados.
          </p>
          <BlogSearch 
            categories={deepSerialize(categories)} 
            placeholder="Escriba para buscar trabajos específicos..." 
          />
        </div>
        
        {blogPosts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              {query || categoryId ? 'No se encontraron trabajos con los filtros aplicados.' : 'No hay artículos registrados aún.'}
            </p>
            {(query || categoryId) && (
              <Link href="/admin/recursos" className="btn btn-ghost btn-sm">Limpiar todos los filtros</Link>
            )}
          </div>
        ) : (
          <div className="grid-responsive">
            {blogPosts.map((post: any) => (
              <div key={post.id} className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', height: '200px', overflow: 'hidden', background: 'var(--bg-deep)' }}>
                  <img src={post.imageUrl || '/Logo.jpg'} alt={post.title} className="hover-scale" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(15, 29, 46, 0.8)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary)', border: '1px solid var(--border)', zIndex: 2 }}>
                    {post.category?.name || 'Artículo'}
                  </div>
                  {!post.isPublished && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--warning)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', color: '#000', zIndex: 2 }}>
                      Borrador
                    </div>
                  )}
                </div>
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text)', fontWeight: '700', lineHeight: '1.3' }}>{post.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', flex: 1 }}>
                    {post.excerpt && post.excerpt.length > 90 ? post.excerpt.substring(0, 90) + '...' : post.excerpt || "Lea este trabajo realizado."}
                  </p>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <Link href={`/blog/${post.slug}`} className="btn btn-primary btn-sm" style={{ flex: 1 }} target="_blank">Leer Mas</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="card" style={{ marginTop: 'var(--space-3xl)', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-deep))', border: '1px solid var(--primary-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '30px', height: '30px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.2rem' }}>¿Necesitas ayuda adicional?</h4>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Contacta directamente con administración para soporte técnico o administrativo.</p>
          </div>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>Contactar Soporte</button>
        </div>
      </div>
    </div>
  );
}
