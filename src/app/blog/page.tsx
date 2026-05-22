import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import { BlogSearch } from '@/components/blog/BlogSearch';
import { formatDateEcuador } from '@/lib/date-utils';

export const metadata: Metadata = {
  title: 'Blog | Aquatech',
  description: 'Aprende más sobre mantenimiento, innovación y tratamiento del agua.',
};

interface BlogPageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function BlogIndexPage({ searchParams }: BlogPageProps) {
  // En Next.js 16 (y 15), searchParams debe ser esperado (awaited)
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const categoryId = resolvedParams.cat || '';

  // Obtener categorías para el buscador
  const categories = await prisma.blogCategory.findMany({
    orderBy: { name: 'asc' }
  });

  const posts = await prisma.blogPost.findMany({
    where: { 
      isPublished: true,
      ...(query && {
        OR: [
          { title: { contains: query } },
          { excerpt: { contains: query } },
          { content: { contains: query } },
        ],
      }),
      ...(categoryId && { categoryId: Number(categoryId) })
    },
    orderBy: { publishedAt: 'desc' },
    include: {
      category: true,
      author: true,
    }
  });

  return (
    <div style={{ backgroundColor: 'var(--bg-body)', minHeight: '100vh' }}>
      {/* Navbar simplificado */}
      <header style={{ padding: '1rem 5%', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src="/logo.jpg" alt="Aquatech" style={{ height: '40px', borderRadius: '4px' }} />
        <Link href="/" style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-brand)' }}>AQUATECH</Link>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/blog" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem' }}>Artículos</Link>
          <Link href="/admin/login" className="btn btn-primary btn-sm">Portal CRM</Link>
        </nav>
      </header>

      <main style={{ padding: '4rem 5%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '1rem' }}>
            Nuestro <span style={{ color: 'var(--primary)' }}>Blog</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            Descubre las últimas novedades y consejos sobre el tratamiento, filtración y mantenimiento del agua en el sector.
          </p>
        </div>

        {/* BUSCADOR CON CATEGORÍAS */}
        <div style={{ margin: '0 auto 4rem auto', display: 'flex', justifyContent: 'center' }}>
          <BlogSearch 
            categories={categories} 
            placeholder="Escriba para buscar artículos de interés..." 
          />
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
              {query ? `No se encontraron resultados para "${query}"` : 'No hay artículos publicados en este momento.'}
            </p>
            {query && (
              <Link href="/blog" className="btn btn-ghost">Limpiar búsqueda</Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>
            {posts.map((post: any) => (
              <Link href={`/blog/${post.slug}`} key={post.id} style={{ display: 'block', textDecoration: 'none' }}>
                <article className="card hover-scale" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                  {post.imageUrl ? (
                    <img 
                      src={post.imageUrl} 
                      alt={post.title} 
                      style={{ width: '100%', height: '220px', objectFit: 'cover', borderBottom: '1px solid var(--border)' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '220px', background: 'var(--bg-deep)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="badge badge-neutral">Sin imagen principal</span>
                    </div>
                  )}
                  
                  <div style={{ padding: 'var(--space-lg)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {post.category && (
                      <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                        {post.category.name}
                      </span>
                    )}
                    <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
                      {post.title}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
                      {post.excerpt || (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content)}
                    </p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: 'auto' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {post.author?.name || 'Administrador'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {post.publishedAt ? formatDateEcuador(post.publishedAt) : ''}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
