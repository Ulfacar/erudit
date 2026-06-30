import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const vacancies = await prisma.vacancy.findMany({
      where: { status: { in: ['open', 'active'] } },
      select: { id: true, title: true, department: true },
      orderBy: { createdAt: 'desc' },
    });

    return withCors(successResponse(vacancies));
  } catch (error) {
    console.error('GET /api/v1/public/vacancies error:', error);
    return withCors(errorResponse('INTERNAL_ERROR', 'Не удалось загрузить вакансии', 500));
  }
}
