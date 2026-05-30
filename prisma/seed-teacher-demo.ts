// @ts-nocheck — демо-сид: учитель математики + уроки на сегодня + выкл. модерации
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = hashSync('erudit2025', 10);
const LOGIN = 'matematik';

async function main() {
  console.log('Demo: учитель математики + модерация off…');

  // 1) Выключаем модерацию у всех категорий → учитель ставит сразу финально (published)
  const off = await prisma.gradeCategory.updateMany({ data: { requiresModeration: false } });
  // и разрешаем учителям пользоваться категориями
  await prisma.gradeCategory.updateMany({ data: { enabledForTeachers: true } });
  console.log(`  категорий переведено в requiresModeration=false: ${off.count}`);

  // 2) Опорные данные
  let subject = await prisma.subject.findFirst({ where: { name: { contains: 'атем' } } });
  if (!subject) subject = await prisma.subject.create({ data: { name: 'Математика', color: '#4263eb' } });

  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } })
    ?? await prisma.academicPeriod.findFirst({ orderBy: { startDate: 'desc' } });
  if (!period) throw new Error('Нет учебного периода — прогоните основной seed');

  const allSlots = await prisma.bellSchedule.findMany({
    where: { type: 'lesson' }, orderBy: { slotNumber: 'asc' },
  });
  // дедупликация: в БД слоты звонков задвоены — берём по одному на slotNumber
  const seenSlot = new Set<number>();
  const lessonSlots = allSlots.filter((s) => (seenSlot.has(s.slotNumber) ? false : (seenSlot.add(s.slotNumber), true)));
  if (lessonSlots.length === 0) throw new Error('Нет уроков-слотов в расписании звонков');

  // берём 4 класса средней/старшей школы (где математика логична)
  const classes = await prisma.class.findMany({
    where: { grade: { gte: 5 } }, orderBy: [{ grade: 'asc' }, { letter: 'asc' }], take: 4,
  });
  if (classes.length === 0) throw new Error('Нет классов — прогоните основной seed');

  // 3) Идемпотентно пересоздаём демо-учителя
  const existing = await prisma.user.findUnique({ where: { login: LOGIN }, include: { teacher: true } });
  if (existing?.teacher) {
    await prisma.scheduleEntry.deleteMany({ where: { teacherId: existing.teacher.id } });
    await prisma.teacherSubject.deleteMany({ where: { teacherId: existing.teacher.id } });
    await prisma.gradeAuditLog.deleteMany({ where: { grade: { teacherId: existing.teacher.id } } });
    await prisma.grade.deleteMany({ where: { teacherId: existing.teacher.id } });
    await prisma.teacher.delete({ where: { id: existing.teacher.id } });
  }
  if (existing) await prisma.user.delete({ where: { id: existing.id } });

  const user = await prisma.user.create({
    data: { login: LOGIN, email: `${LOGIN}@bilimos.kg`, password: PASSWORD, role: 'teacher', starLevel: 2 },
  });
  const teacher = await prisma.teacher.create({
    data: { userId: user.id, firstName: 'Айгуль', lastName: 'Асанова', middleName: 'Бакытовна', position: 'Учитель математики', hireDate: new Date('2022-09-01') },
  });

  // 4) Нагрузка: математика в каждом из выбранных классов
  for (const cls of classes) {
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subjectId: subject.id, classId: cls.id, hoursPerWeek: 4 },
    });
  }

  // 5) Уроки на СЕГОДНЯ (важно: dayOfWeek = сегодняшний, иначе «Сегодня» пустое)
  // Диапазон дат расписания берём широкий (весь учебный год), чтобы покрыть сегодня
  // независимо от того, какой триместр сейчас активен.
  const periodStart = new Date('2025-09-01');
  const periodEnd = new Date('2026-12-31');
  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay(); // 1=Пн..7=Вс
  // расставляем по одному уроку в первые слоты, разные классы
  const todaysLessons = Math.min(classes.length, lessonSlots.length);
  for (let i = 0; i < todaysLessons; i++) {
    await prisma.scheduleEntry.create({
      data: {
        classId: classes[i].id,
        teacherId: teacher.id,
        subjectId: subject.id,
        slotId: lessonSlots[i].id,
        dayOfWeek: todayDow,
        periodStart,
        periodEnd,
      },
    });
  }

  // также немного уроков на будни (чтобы расписание учителя не было пустым в другие дни)
  for (let day = 1; day <= 5; day++) {
    if (day === todayDow) continue;
    const cls = classes[day % classes.length];
    const slot = lessonSlots[(day + 1) % lessonSlots.length];
    await prisma.scheduleEntry.create({
      data: {
        classId: cls.id, teacherId: teacher.id, subjectId: subject.id, slotId: slot.id,
        dayOfWeek: day, periodStart, periodEnd,
      },
    }).catch(() => {});
  }

  // 6) Демо-тест с автопроверкой (для класса первого урока)
  await prisma.test.deleteMany({ where: { authorId: user.id } });
  await prisma.test.create({
    data: {
      title: 'Математика: проверочная',
      description: 'Короткий тест по теме «Квадратные уравнения».',
      subjectId: subject.id,
      classId: classes[0].id,
      authorId: user.id,
      status: 'published',
      questions: {
        create: [
          { order: 0, text: 'Сколько корней у уравнения x² = 9?', type: 'single', options: ['1', '2', '0'], correctAnswers: ['1'], points: 1 },
          { order: 1, text: 'Какие из чисел — корни x² − 5x + 6 = 0?', type: 'multiple', options: ['2', '3', '5', '6'], correctAnswers: ['0', '1'], points: 2 },
          { order: 2, text: 'Чему равен дискриминант x² − 4x + 4?', type: 'number', options: [], correctAnswers: ['0'], points: 1 },
        ],
      },
    },
  });

  console.log(`  учитель: ${LOGIN} / erudit2025 (роль teacher)`);
  console.log('  + демо-тест с автопроверкой создан');
  console.log(`  предмет: ${subject.name}; классов: ${classes.length}; уроков сегодня (день ${todayDow}): ${todaysLessons}`);
  console.log('Готово.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
