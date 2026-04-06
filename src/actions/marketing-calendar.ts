'use server'

import { prisma as db } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getMonthlySocialPosts(month: number, year: number) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session?.user) throw new Error('No autorizado')

    // Definir el rango del mes
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const posts = await db.socialPost.findMany({
      where: {
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['APPROVED', 'SCHEDULED', 'PUBLISHED']
        }
      },
      include: {
        variants: {
          include: {
            images: true,
          }
        },
        pipeline: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      }
    })

    return { success: true, posts }
  } catch (error: any) {
    console.error('Error fetching monthly posts:', error)
    return { success: false, error: error.message }
  }
}
