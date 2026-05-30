import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import type { Role } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrudConfig {
  /** ключ модели в prisma-клиенте, напр. 'achievement' */
  model: string;
  /** роли для чтения (GET). По умолчанию — любой авторизованный */
  listRoles?: Role[];
  /** роли для записи (POST/DELETE) */
  writeRoles: Role[];
  /** whitelist полей тела, копируемых в create */
  createFields: string[];
  /** поля, которые нужно превратить в Date */
  dateFields?: string[];
  /** поля, которые нужно привести к Int */
  intFields?: string[];
  /** поле, в которое класть id текущего пользователя (authorId/specialistId/...) */
  injectUserId?: string;
  /** include для выборок */
  include?: Record<string, unknown>;
  /** orderBy для списка */
  orderBy?: Record<string, unknown>;
  /** query-параметры, по которым можно фильтровать список (точное совпадение) */
  filterableParams?: string[];
}

function buildData(body: Record<string, any>, cfg: CrudConfig, userId: string) {
  const data: Record<string, any> = {};
  for (const f of cfg.createFields) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (cfg.dateFields?.includes(f) && v) v = new Date(v);
    if (cfg.intFields?.includes(f) && v !== null && v !== '') v = parseInt(String(v), 10);
    data[f] = v;
  }
  if (cfg.injectUserId) data[cfg.injectUserId] = userId;
  return data;
}

export function createCrud(cfg: CrudConfig) {
  const model = () => (prisma as any)[cfg.model];

  async function GET(request: NextRequest) {
    try {
      const auth = await withAuth(request, cfg.listRoles ? { roles: cfg.listRoles } : undefined);
      if (auth.response) return auth.response;

      const { searchParams } = new URL(request.url);
      const where: Record<string, any> = {};
      for (const p of cfg.filterableParams ?? []) {
        const val = searchParams.get(p);
        if (val) where[p] = val;
      }

      const rows = await model().findMany({
        where,
        ...(cfg.include ? { include: cfg.include } : {}),
        orderBy: cfg.orderBy ?? { createdAt: 'desc' },
      });
      return successResponse(rows);
    } catch (error) {
      console.error(`GET ${cfg.model} error:`, error);
      return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить данные', 500);
    }
  }

  async function POST(request: NextRequest) {
    try {
      const auth = await withAuth(request, { roles: cfg.writeRoles });
      if (auth.response) return auth.response;

      const body = await request.json();
      const data = buildData(body, cfg, auth.session.user.id);
      const created = await model().create({ data });
      return successResponse(created, 201);
    } catch (error) {
      console.error(`POST ${cfg.model} error:`, error);
      return errorResponse('INTERNAL_ERROR', 'Не удалось создать запись', 500);
    }
  }

  async function DELETE(request: NextRequest) {
    try {
      const auth = await withAuth(request, { roles: cfg.writeRoles });
      if (auth.response) return auth.response;
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) return errorResponse('VALIDATION_ERROR', 'Параметр id обязателен');
      await model().delete({ where: { id } });
      return successResponse({ id });
    } catch (error) {
      console.error(`DELETE ${cfg.model} error:`, error);
      return errorResponse('INTERNAL_ERROR', 'Не удалось удалить запись', 500);
    }
  }

  return { GET, POST, DELETE };
}

export function createCrudId(cfg: Pick<CrudConfig, 'model' | 'writeRoles'> & { include?: Record<string, unknown> }) {
  const model = () => (prisma as any)[cfg.model];

  async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
      const auth = await withAuth(request);
      if (auth.response) return auth.response;
      const { id } = await ctx.params;
      const row = await model().findUnique({ where: { id }, ...(cfg.include ? { include: cfg.include } : {}) });
      if (!row) return errorResponse('NOT_FOUND', 'Запись не найдена', 404);
      return successResponse(row);
    } catch {
      return errorResponse('INTERNAL_ERROR', 'Ошибка', 500);
    }
  }

  async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
      const auth = await withAuth(request, { roles: cfg.writeRoles });
      if (auth.response) return auth.response;
      const { id } = await ctx.params;
      const body = await request.json();
      delete body.id;
      const updated = await model().update({ where: { id }, data: body });
      return successResponse(updated);
    } catch {
      return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
    }
  }

  async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
      const auth = await withAuth(request, { roles: cfg.writeRoles });
      if (auth.response) return auth.response;
      const { id } = await ctx.params;
      await model().delete({ where: { id } });
      return successResponse({ id });
    } catch {
      return errorResponse('INTERNAL_ERROR', 'Не удалось удалить', 500);
    }
  }

  return { GET, PUT, DELETE };
}
