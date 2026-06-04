/**
 * Проверка зон доступа AI-ассистента без LLM: резолвим scope для ролей
 * и дёргаем тулы напрямую. Запуск: npx tsx scripts/test-assistant-tools.ts
 */
import { PrismaClient } from '@prisma/client';
import { resolveScope } from '../src/shared/lib/ai/scope';
import { executeTool, toolDefinitionsForScope } from '../src/shared/lib/ai/tools';

const prisma = new PrismaClient();

async function scopeFor(login: string) {
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) throw new Error(`нет пользователя ${login}`);
  return resolveScope({ id: user.id, login: user.login, role: user.role, starLevel: user.starLevel });
}

function short(s: string, n = 220) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function main() {
  // ── Директор: всё открыто ──
  const admin = await scopeFor('admin');
  console.log('\n=== ДИРЕКТОР (admin) ===');
  console.log('тулов доступно:', toolDefinitionsForScope(admin).length);
  console.log('обзор школы:', short(await executeTool('school_overview', {}, admin)));
  console.log('5-е классы:', short(await executeTool('class_occupancy', { grade: 5 }, admin)));
  console.log('финансы школы:', short(await executeTool('finance_summary', {}, admin)));
  console.log('воронка приёмной:', short(await executeTool('admission_funnel', {}, admin)));

  // ── Родитель: только свой ребёнок ──
  const parent = await scopeFor('parent1');
  console.log('\n=== РОДИТЕЛЬ (parent1) ===');
  console.log('тулов доступно:', toolDefinitionsForScope(parent).length, '(не должно быть school_overview/finance_summary)');
  console.log('детей в зоне:', parent.allowedStudentIds);
  const childId = Array.isArray(parent.allowedStudentIds) ? parent.allowedStudentIds[0] : null;
  if (childId) {
    console.log('профиль своего ребёнка:', short(await executeTool('student_profile', { studentId: childId }, parent)));
    console.log('финансы своего ребёнка:', short(await executeTool('student_finance', { studentId: childId }, parent)));
  }
  // чужой ученик → отказ
  const foreign = await prisma.student.findFirst({
    where: childId ? { id: { not: childId } } : {},
    select: { id: true },
  });
  if (foreign) {
    console.log('ЧУЖОЙ ученик (ждём отказ):', await executeTool('student_profile', { studentId: foreign.id }, parent));
    console.log('школьная сводка (ждём отказ):', await executeTool('school_overview', {}, parent));
    console.log('психолог (ждём отказ):', await executeTool('student_psych', { studentId: childId ?? foreign.id }, parent));
  }

  // ── Учитель: только свои классы ──
  const teacher = await scopeFor('matematik');
  console.log('\n=== УЧИТЕЛЬ (matematik) ===');
  console.log('классов в зоне:', Array.isArray(teacher.allowedClassIds) ? teacher.allowedClassIds.length : 'all');
  console.log('наполняемость (только свои):', short(await executeTool('class_occupancy', {}, teacher)));
  console.log('финансы школы (ждём отказ):', await executeTool('finance_summary', {}, teacher));

  // ── Специалист: психолог да, финансы нет ──
  const spec = await scopeFor('specialist1');
  console.log('\n=== СПЕЦИАЛИСТ (specialist1) ===');
  const psyStudent = await prisma.specialistSession.findFirst({ select: { studentId: true } });
  if (psyStudent) {
    console.log('данные психолога:', short(await executeTool('student_psych', { studentId: psyStudent.studentId }, spec), 300));
  }
  console.log('финансы (ждём отказ):', await executeTool('finance_summary', {}, spec));

  // ── Завуч: финансы да (бухгалтерия ADMIN_AND_VICE) ──
  const zavuch = await scopeFor('kozlova');
  console.log('\n=== ЗАВУЧ (kozlova) ===');
  console.log('финансы школы:', short(await executeTool('finance_summary', {}, zavuch)));

  // ── Секретарь: финансовая сводка нет, воронка да ──
  const secretary = await scopeFor('secretary1');
  console.log('\n=== СЕКРЕТАРЬ (secretary1) ===');
  console.log('финансы (ждём отказ):', await executeTool('finance_summary', {}, secretary));
  console.log('воронка приёмной:', short(await executeTool('admission_funnel', {}, secretary)));

  // ── Ученик: только сам ──
  const student = await scopeFor('student1');
  console.log('\n=== УЧЕНИК (student1) ===');
  const selfId = Array.isArray(student.allowedStudentIds) ? student.allowedStudentIds[0] : null;
  if (selfId) console.log('свой профиль:', short(await executeTool('student_profile', { studentId: selfId }, student)));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
