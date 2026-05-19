import { NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'

const startTime = Date.now()

export async function GET() {
  let dbStatus: 'connected' | 'error' = 'error'

  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'connected'
  } catch {
    // database unreachable
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded'
  const statusCode = dbStatus === 'connected' ? 200 : 503

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: dbStatus,
    },
    { status: statusCode },
  )
}
