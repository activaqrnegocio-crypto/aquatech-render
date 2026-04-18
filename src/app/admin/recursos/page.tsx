import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ResourceGrid from '@/components/resources/ResourceGrid';
import { deepSerialize } from '@/lib/serializable';
import BlogSearch from '@/components/blog/BlogSearch';

interface RecursosPageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function RecursosPage({ searchParams }: RecursosPageProps) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const isSuperAdmin = userRole === 'SUPERADMIN';

  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const categoryId = resolvedParams.cat || '';

  // 1. Fetch Dynamic Resources from DB
  const resources = await prisma.resource.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // 2. Fetch Blog Posts (Trabajos Realizados)
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

  const categories = await prisma.blogCategory.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="recursos-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="dashboard-header mb-xl" style={{ animation: 'fadeIn 0.5s ease-out', marginBottom: '40px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>
            Centro de Recursos
          </h2>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            Acceso centralizado a documentación técnica, manuales y activos operativos de Aquatech.
          </p>
        </div>
      </div>

      {/* SECCIÓN DINÁMICA DE RECURSOS */}
      <section style={{ marginBottom: '60px' }}>
        <ResourceGrid 
          initialResources={deepSerialize(resources)} 
          isSuperAdmin={isSuperAdmin} 
        />
      </section>

      {/* SECCIÓN DE TRABAJOS REALIZADOS (BLOG) */}
      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '60px 0' }} />
      
      <section style={{ marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '0.8rem' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '28px', height: '28px', color: 'var(--primary)' }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Trabajos Realizados
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            Historial de proyectos ejecutados, artículos técnicos y casos de éxito.
          </p>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <BlogSearch 
              categories={deepSerialize(categories)} 
              placeholder="Buscar trabajos o artículos..." 
            />
          </div>
        </div>
        
        {blogPosts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              {query || categoryId ? 'No se encontraron resultados para su búsqueda.' : 'No hay artículos registrados.'}
            </p>
            {(query || categoryId) && (
              <Link href="/admin/recursos" className="btn btn-ghost btn-sm">Limpiar búsqueda</Link>
            )}
          </div>
        ) : (
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {blogPosts.map((post: any) => (
              <div key={post.id} className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ position: 'relative', height: '200px', overflow: 'hidden', background: 'var(--bg-deep)' }}>
                  <img src={post.imageUrl || '/Logo.jpg'} alt={post.title} className="hover-scale" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800', color: '#000', zIndex: 2 }}>
                    {post.category?.name || 'Artículo'}
                  </div>
                </div>
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text)', fontWeight: '700', lineHeight: '1.4' }}>{post.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post.excerpt || "Consulte los detalles de este trabajo realizado."}
                  </p>
                  <Link href={`/blog/${post.slug}`} className="btn btn-secondary btn-sm" style={{ width: '100%', fontWeight: 'bold' }} target="_blank">
                    Leer Detalles
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="card help-card" style={{ marginTop: '80px', background: 'linear-gradient(135deg, rgba(54, 162, 235, 0.05), rgba(0,0,0,0.2))', border: '1px solid var(--primary-glow)', padding: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px', flexWrap: 'wrap' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '30px', height: '30px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </div>
          <div style={{ flex: '1 1 250px' }}>
            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>¿Necesitas asistencia técnica?</h4>
            <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '0.95rem' }}>Si no encuentras un recurso o necesitas información adicional, contacta con administración.</p>
          </div>
          <button className="btn btn-primary" style={{ minWidth: '180px', height: '48px', fontWeight: 'bold' }}>Contactar Soporte</button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      ` }} />
    </div>
  );
}
