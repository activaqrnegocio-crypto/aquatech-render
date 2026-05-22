import React from 'react';
import { prisma } from '@/lib/prisma';
import MarkdownRenderer from '@/components/blog/MarkdownRenderer';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { formatDateLongEcuador } from '@/lib/date-utils';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug },
  });

  if (!post) {
    return {
      title: 'Artículo no encontrado | Aquatech'
    };
  }

  return {
    title: `${post.title} | Aquatech Blog`,
    description: post.metaDescription || post.excerpt || 'Lee más en nuestro blog.',
    keywords: post.focusKeyword || 'aquatech, tratamiento y mantenimiento de agua',
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.metaDescription || post.excerpt || '',
      images: post.imageUrl ? [{ url: post.imageUrl }] : undefined,
    }
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      category: true,
      author: true,
      tags: { include: { tag: true } }
    }
  });

  if (!post || (!post.isPublished)) {
    notFound();
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-body)', minHeight: '100vh', color: 'var(--text)' }}>
      <header style={{ padding: '1rem 5%', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-deep)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
          <img src="/logo.jpg" alt="Aquatech" style={{ height: '40px', borderRadius: '4px' }} />
          <span style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-brand)', fontSize: '1.2rem' }}>AQUATECH</span>
        </Link>
        <nav style={{ marginLeft: 'auto' }}>
          <Link href="/blog" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Volver al Blog
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1rem' }}>
        <article>
          <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
            {post.category && (
              <span style={{ display: 'inline-block', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                {post.category.name}
              </span>
            )}
            
            <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '3rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.5rem' }}>
              {post.title}
            </h1>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {post.author?.name ? post.author.name.substring(0, 2).toUpperCase() : 'AQ'}
                </div>
                <span>{post.author?.name || 'Comunicaciones Aquatech'}</span>
              </div>
              <span>•</span>
              <time dateTime={post.publishedAt?.toISOString() || ''}>
                {post.publishedAt ? formatDateLongEcuador(post.publishedAt) : 'Reciente'}
              </time>
            </div>
          </header>

          {post.imageUrl && (
            <figure style={{ margin: '0 0 4rem 0', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block' }} />
            </figure>
          )}

          <div className="card" style={{ padding: 'var(--space-2xl)' }}>
            <MarkdownRenderer content={post.content} />
            
            {post.tags.length > 0 && (
              <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Etiquetas Relacionadas</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {post.tags.map((pt: any) => (
                    <span key={pt.tagId} className="badge badge-neutral" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      #{pt.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        <section style={{ marginTop: '4rem', padding: '3rem', backgroundColor: 'var(--primary-glow)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--primary-glow-strong)' }}>
          <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
            ¿Necesitas una consulta experta?
          </h3>
          <p style={{ color: 'var(--text)', opacity: 0.9, marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Nuestro equipo de técnicos especializados en tratamiento de aguas y bombeo está listo para ayudarte con tu próximo proyecto.
          </p>
          <Link href="/cotizaciones" className="btn btn-primary btn-lg">
            Solicitar Cotización Ahora
          </Link>
        </section>
      </main>
    </div>
  );
}
