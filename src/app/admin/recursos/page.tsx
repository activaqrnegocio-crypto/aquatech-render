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
