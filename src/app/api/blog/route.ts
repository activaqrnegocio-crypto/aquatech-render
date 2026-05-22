import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      slug,
      excerpt,
      content,
      categoryId,
      metaDescription,
      focusKeyword,
      imageUrl,
      isPublished,
      tags
    } = body;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Process Tags
    const tagsArray = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        metaDescription,
        focusKeyword,
        imageUrl,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        authorId: Number(session.user.id),
        categoryId: categoryId ? Number(categoryId) : null,
      }
    });

    if (tagsArray.length > 0) {
      for (const tagName of tagsArray) {
        let tag = await prisma.blogTag.findUnique({ where: { slug: tagName.toLowerCase() } });
        if (!tag) {
          tag = await prisma.blogTag.create({ data: { name: tagName, slug: tagName.toLowerCase() } });
        }
        await prisma.blogPostTag.create({
          data: { postId: post.id, tagId: tag.id }
        });
      }
    }

    return NextResponse.json(post);
  } catch (error: any) {
    console.error('Error creando el artículo:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const categories = await prisma.blogCategory.findMany();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Error obteniendo categorías' }, { status: 500 });
  }
}
