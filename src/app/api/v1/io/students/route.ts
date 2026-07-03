import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;
const HEADERS = ['Фамилия', 'Имя', 'Отчество', 'Класс', 'Буква', 'Статус'];

/** GET /api/v1/io/students — экспорт учеников в CSV (по текущему филиалу). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);

  const students = await prisma.student.findMany({
    where: { status: { notIn: ['graduated', 'withdrawn'] }, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    include: { class: { select: { grade: true, letter: true } } },
    orderBy: [{ class: { grade: 'asc' } }, { lastName: 'asc' }],
  });
  const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const lines = [HEADERS.join(',')];
  for (const s of students) {
    lines.push([s.lastName, s.firstName, s.middleName ?? '', s.class?.grade ?? '', s.class?.letter ?? '', s.status].map((x) => esc(String(x))).join(','));
  }
  const csv = '﻿' + lines.join('\r\n'); // BOM для Excel
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="students.csv"' },
  });
}

/** POST /api/v1/io/students — импорт учеников из CSV (массовая загрузка). */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const { csv } = (await request.json().catch(() => ({}))) as { csv?: string };
  if (!csv?.trim()) return errorResponse('VALIDATION_ERROR', 'Пустой CSV');

  const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
  const branchId = scope.branchId;
  const levels = await prisma.schoolLevel.findMany({ select: { id: true, fromGrade: true, toGrade: true } });

  const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // пропускаем строку-заголовок, если она есть
  const start = /фамилия/i.test(rows[0] ?? '') ? 1 : 0;
  let created = 0; const errors: string[] = [];

  const classCache = new Map<string, string>();
  async function classId(grade: number, letter: string): Promise<string | null> {
    const key = `${grade}|${letter}|${branchId ?? ''}`;
    if (classCache.has(key)) return classCache.get(key)!;
    let cls = await prisma.class.findFirst({ where: { grade, letter, ...(branchId ? { branchId } : {}) }, select: { id: true } });
    if (!cls) {
      const lvl = levels.find((l) => l.fromGrade <= grade && l.toGrade >= grade);
      if (!lvl) return null;
      cls = await prisma.class.create({ data: { grade, letter, levelId: lvl.id, branchId }, select: { id: true } });
    }
    classCache.set(key, cls.id);
    return cls.id;
  }

  for (let i = start; i < rows.length; i++) {
    const cells = rows[i].split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const [lastName, firstName, middleName, gradeS, letter] = cells;
    if (!lastName || !firstName || !gradeS || !letter) { errors.push(`Строка ${i + 1}: не хватает данных`); continue; }
    const grade = parseInt(gradeS, 10);
    if (!Number.isFinite(grade)) { errors.push(`Строка ${i + 1}: неверный класс`); continue; }
    const cid = await classId(grade, letter.toUpperCase());
    if (!cid) { errors.push(`Строка ${i + 1}: нет уровня для класса ${grade}`); continue; }
    try {
      await prisma.student.create({ data: { lastName, firstName, middleName: middleName || null, classId: cid, branchId, status: 'permanent' } });
      created++;
    } catch { errors.push(`Строка ${i + 1}: ошибка создания`); }
  }
  return successResponse({ created, errors: errors.slice(0, 20), total: rows.length - start });
}
