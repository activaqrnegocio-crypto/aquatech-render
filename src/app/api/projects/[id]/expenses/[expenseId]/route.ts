import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/rbac'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: projectIdStr, expenseId: expenseIdStr } = await params
    const projectId = Number(projectIdStr)
    const expenseId = Number(expenseIdStr)
    
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const userId = Number(session.user.id)
    const userRole = (session.user as any).role

    // Get the expense to verify ownership and check if it affects realCost
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    })

    if (!expense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

    // Security: Admin or Owner
    if (!isAdmin(userRole) && expense.userId !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar este gasto' }, { status: 403 })
    }

    // Delete the expense
    await prisma.expense.delete({
      where: { id: expenseId }
    })

    // If it was a real expense (not a note), decrement realCost
    if (!expense.isNote) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          realCost: {
            decrement: expense.amount
          }
        }
      })
    }

    // Add a log to the chat about the deletion
    await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        type: 'NOTE',
        content: `🚨 ${session.user.name} eliminó un gasto: ${expense.description} ($ ${Number(expense.amount).toFixed(2)})`
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Expense Deletion Error:', error)
    return NextResponse.json({ error: 'Error al eliminar el gasto' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: projectIdStr, expenseId: expenseIdStr } = await params
    const projectId = Number(projectIdStr)
    const expenseId = Number(expenseIdStr)
    
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const userId = Number(session.user.id)
    const userRole = (session.user as any).role

    const body = await req.json()
    const { amount, description, isNote } = body

    const oldExpense = await prisma.expense.findUnique({
      where: { id: expenseId }
    })

    if (!oldExpense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

    // Security: Admin or Owner
    if (!isAdmin(userRole) && oldExpense.userId !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para editar este gasto' }, { status: 403 })
    }

    // Update the expense
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: amount !== undefined ? Number(amount) : undefined,
        description: description !== undefined ? description : undefined,
        isNote: isNote !== undefined ? !!isNote : undefined
      }
    })

    // Handle realCost adjustment
    const oldAmount = Number(oldExpense.amount)
    const newAmount = amount !== undefined ? Number(amount) : oldAmount
    const oldIsNote = oldExpense.isNote
    const newIsNote = isNote !== undefined ? !!isNote : oldIsNote

    let costAdjustment = 0

    if (!oldIsNote && !newIsNote) {
      // Both were real expenses: adjust by difference
      costAdjustment = newAmount - oldAmount
    } else if (oldIsNote && !newIsNote) {
      // Was note, now real: add the full new amount
      costAdjustment = newAmount
    } else if (!oldIsNote && newIsNote) {
      // Was real, now note: subtract the full old amount
      costAdjustment = -oldAmount
    }
    // (If both were notes, no adjustment needed)

    if (costAdjustment !== 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          realCost: {
            increment: costAdjustment
          }
        }
      })
    }

    // Log the edit
    await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        type: 'NOTE',
        content: `✏️ ${session.user.name} editó un gasto: ${oldExpense.description} -> ${updatedExpense.description} ($ ${Number(updatedExpense.amount).toFixed(2)})`
      }
    })

    return NextResponse.json(updatedExpense)
  } catch (error: any) {
    console.error('Expense Update Error:', error)
    return NextResponse.json({ error: 'Error al actualizar el gasto' }, { status: 500 })
  }
}
