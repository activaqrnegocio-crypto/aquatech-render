import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { formatDateEcuador } from '@/lib/date-utils';

export const metadata = {
  title: 'Blog - Admin | Aquatech CRM'
};

export default async function AdminBlogPage() {
  const session = await getServerSession() as any;
  if (!session?.user) {
    redirect('/admin/login');
  }

  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
      author: true,
    }
  });

  return (
    <div className="page-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Gestión de Blog</h1>
          <p className="page-subtitle">Crea y administra los artículos del blog público.</p>
        </div>
        <Link href="/admin/blog/create" className="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Escribir Artículo
        </Link>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Autor</th>
                <th>Categoría</th>
                <th>Fecha Pub.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No hay artículos registrados. ¡Empieza a escribir el primero!
                  </td>
                </tr>
              ) : (
                posts.map((post: any) => (
                  <tr key={post.id}>
                    <td style={{ fontWeight: '500', color: 'var(--text)' }}>
                      {post.title}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>/{post.slug}</div>
                    </td>
                    <td>
                      {post.isPublished ? (
                        <span className="badge badge-success">Publicado</span>
                      ) : (
                        <span className="badge badge-warning">Borrador</span>
                      )}
                    </td>
                    <td>{post.author?.name || 'Sistema'}</td>
                    <td>{post.category?.name || '-'}</td>
                    <td>{post.publishedAt ? formatDateEcuador(post.publishedAt) : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/admin/blog/edit/${post.id}`} className="btn btn-ghost btn-sm">
                          Editar
                        </Link>
                        {post.isPublished && (
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                            Ver
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
