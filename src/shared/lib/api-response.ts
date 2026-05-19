import { NextResponse } from 'next/server';

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export function paginatedResponse<T>(data: T[], meta: PaginationMeta, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        page: meta.page,
        perPage: meta.perPage,
        total: meta.total,
        totalPages: meta.totalPages,
      },
    },
    { status }
  );
}
