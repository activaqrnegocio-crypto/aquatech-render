import React from 'react';
import BlogEditor from '@/components/blog/BlogEditor';

export const metadata = {
  title: 'Escribir Artículo - Admin | Aquatech CRM'
};

export default function CreateBlogPostPage() {
  return (
    <div className="page-header">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Nuevo Artículo</h1>
        <p className="page-subtitle">Redacta y configura el SEO de un nuevo post del blog.</p>
      </div>

      <BlogEditor />
    </div>
  );
}
