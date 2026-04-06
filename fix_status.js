const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function test() {
    const p = await prisma.contentPipeline.findUnique({ where: { id: 2 } })
    console.log('STATUS IN DB IS:', p.status)
    if (p.status === 'WRITING') {
        const updated = await prisma.contentPipeline.update({ 
            where: { id: 2 }, 
            data: { status: 'REVIEWING_ARTICLES' } 
        })
        console.log('UPDATED TO:', updated.status)
    }
    process.exit(0)
}

test()
