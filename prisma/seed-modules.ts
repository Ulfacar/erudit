// @ts-nocheck — сид-скрипт с кортежами демо-данных; рантайм-корректен, строгую типизацию пропускаем
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function daysFromNow(d: number): Date {
  const dt = new Date('2026-05-30T00:00:00Z');
  dt.setDate(dt.getDate() + d);
  return dt;
}

async function main() {
  console.log('Seeding new modules…');

  const [students, classes, subjects, admin] = await Promise.all([
    prisma.student.findMany({ select: { id: true, classId: true }, take: 40 }),
    prisma.class.findMany({ select: { id: true } }),
    prisma.subject.findMany({ select: { id: true, name: true } }),
    prisma.user.findFirst({ where: { role: 'super_admin' }, select: { id: true } }),
  ]);
  const specialist = await prisma.user.findFirst({ where: { role: 'specialist' }, select: { id: true } });
  const authorId = admin?.id ?? students[0]?.id ?? 'seed';
  const specialistId = specialist?.id ?? authorId;

  if (students.length === 0) {
    console.log('Нет учеников — сначала прогоните основной seed.');
    return;
  }

  // ── Очистка (идемпотентность) ──
  await prisma.$transaction([
    prisma.calendarEvent.deleteMany(),
    prisma.achievement.deleteMany(),
    prisma.portfolioEntry.deleteMany(),
    prisma.libraryLoan.deleteMany(),
    prisma.libraryItem.deleteMany(),
    prisma.olympiadParticipation.deleteMany(),
    prisma.olympiad.deleteMany(),
    prisma.schoolEvent.deleteMany(),
    prisma.studioEnrollment.deleteMany(),
    prisma.studio.deleteMany(),
    prisma.tripParticipant.deleteMany(),
    prisma.trip.deleteMany(),
    prisma.documentRecord.deleteMany(),
    prisma.maintenanceRequest.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.feeInvoice.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.mealMenu.deleteMany(),
    prisma.specialistSession.deleteMany(),
    prisma.specialistRecommendation.deleteMany(),
    prisma.specialistProgress.deleteMany(),
    prisma.leaveRecord.deleteMany(),
    prisma.salaryRecord.deleteMany(),
    prisma.staffContract.deleteMany(),
    prisma.candidate.deleteMany(),
    prisma.vacancy.deleteMany(),
    prisma.staffMember.deleteMany(),
  ]);

  // ── Calendar ──
  const calData = [
    ['Осенние каникулы', 'holiday', 5], ['Родительское собрание', 'meeting', 8],
    ['Контрольная по математике', 'exam', 3], ['День учителя', 'event', -10],
    ['Зимняя сессия', 'exam', 30], ['Новогодний утренник', 'event', 40],
    ['Сдача отчётов за триместр', 'deadline', 12], ['Весенний субботник', 'event', 20],
  ];
  await prisma.calendarEvent.createMany({
    data: calData.map(([title, type, d], i) => ({
      title: title as string, type: type as string, date: daysFromNow(d as number),
      classId: i % 3 === 0 ? null : pick(classes, i).id, authorId,
    })),
  });

  // ── Achievements ──
  const achTitles = ['Олимпиада по математике', 'Конкурс чтецов', 'Городская спартакиада', 'Выставка рисунков', 'Турнир по шахматам', 'Научная конференция', 'Конкурс «Юный программист»', 'Фестиваль робототехники'];
  const cats = ['academic', 'sport', 'art', 'social', 'academic'];
  const levels = ['school', 'district', 'city', 'republic'];
  const places = ['1 место', '2 место', '3 место', 'призёр', 'участник'];
  await prisma.achievement.createMany({
    data: Array.from({ length: 16 }, (_, i) => ({
      studentId: pick(students, i * 3).id, title: pick(achTitles, i),
      category: pick(cats, i), level: pick(levels, i), place: pick(places, i),
      date: daysFromNow(-i * 7 - 2), authorId,
    })),
  });

  // ── Portfolio ──
  const pTypes = ['work', 'certificate', 'project', 'reflection'];
  await prisma.portfolioEntry.createMany({
    data: Array.from({ length: 14 }, (_, i) => ({
      studentId: pick(students, i * 2).id, type: pick(pTypes, i),
      title: pick(['Эссе «Моя школа»', 'Сертификат English B1', 'Проект «Экология города»', 'Доклад по истории', 'Грамота за активность'], i),
      fileName: `portfolio_${i + 1}.pdf`, date: daysFromNow(-i * 5 - 1), authorId,
    })),
  });

  // ── Library ──
  const books = [
    ['Математика 5 класс', 'Виленкин Н.Я.', 'textbook'], ['Русский язык 6 класс', 'Ладыженская Т.А.', 'textbook'],
    ['Война и мир', 'Толстой Л.Н.', 'fiction'], ['Кыргыз тили', 'Иманов А.', 'textbook'],
    ['Физика 9 класс', 'Пёрышкин А.В.', 'textbook'], ['Манас', 'Эпос', 'fiction'],
    ['Химия 8 класс', 'Габриелян О.С.', 'textbook'], ['Методика преподавания', 'Сборник', 'method'],
    ['География Кыргызстана', 'Бакиров А.', 'reference'], ['Биология 7 класс', 'Пасечник В.В.', 'textbook'],
    ['Гарри Поттер', 'Роулинг Дж.', 'fiction'], ['Английский Spotlight 5', 'Ваулина Ю.Е.', 'textbook'],
  ];
  await prisma.libraryItem.createMany({
    data: books.map(([title, author, category], i) => {
      const total = 5 + (i % 20);
      return { title, author, category, total, available: Math.max(0, total - (i % 4)) };
    }),
  });

  // ── Olympiads ──
  await prisma.olympiad.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      name: pick(['Республиканская олимпиада по математике', 'Олимпиада «Алтын тамга»', 'Городская олимпиада по физике', 'Конкурс «Русский медвежонок»', 'Олимпиада по биологии', 'Турнир по информатике'], i),
      subjectId: subjects.length ? pick(subjects, i).id : null,
      level: pick(['school', 'city', 'republic', 'district'], i), stage: i % 2 ? 'финал' : 'отборочный',
      date: daysFromNow(-i * 10 + 15), authorId,
    })),
  });

  // ── School events ──
  await prisma.schoolEvent.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      title: pick(['Последний звонок', 'День знаний', 'Ярмарка профессий', 'Спортивный праздник', 'Концерт ко Дню матери', 'Выпускной вечер'], i),
      location: pick(['Актовый зал', 'Школьный двор', 'Спортзал', 'Кабинет 101'], i),
      date: daysFromNow(i * 9 + 4), description: 'Общешкольное мероприятие.',
    })),
  });

  // ── Studios ──
  await prisma.studio.createMany({
    data: [
      ['Робототехника', 'Калыков Б.', 'Пн/Ср 15:00', 12], ['Вокал', 'Егорова М.', 'Вт/Чт 16:00', 15],
      ['Шахматы', 'Иманов С.', 'Пт 14:00', 20], ['Футбол', 'Сатаркулов Т.', 'Сб 10:00', 22],
      ['Рисование', 'Фоминых О.', 'Ср 15:30', 14], ['Английский разговорный', 'Хайдарова Л.', 'Пн 17:00', 10],
    ].map(([name, leaderName, schedule, capacity]) => ({ name, leaderName, schedule, capacity: capacity as number, description: 'Дополнительное образование.' })),
  });

  // ── Trips ──
  await prisma.trip.createMany({
    data: [
      ['Поездка в Ала-Арчу', 'Национальный парк Ала-Арча', 18, 500],
      ['Экскурсия в музей', 'Исторический музей', -5, 200],
      ['Выезд в Иссык-Куль', 'Чолпон-Ата', 45, 3500],
      ['Театр оперы и балета', 'Бишкек', 10, 300],
    ].map(([title, destination, d, cost], i) => ({
      title: title as string, destination: destination as string, date: daysFromNow(d as number),
      classId: pick(classes, i).id, cost: cost as number, responsibleId: authorId, description: 'Выездное мероприятие.',
    })),
  });

  // ── Documents ──
  await prisma.documentRecord.createMany({
    data: [
      ['school', 'Лицензия', 'Лицензия на образовательную деятельность', 'LZ-2024-115'],
      ['school', 'Устав', 'Устав школы', 'U-2023-01'],
      ['school', 'Приказ', 'Приказ об утверждении расписания', 'PR-2025-204'],
      ['student', 'Свидетельство', 'Свидетельство о рождении', 'СВ-882213'],
      ['teacher', 'Диплом', 'Диплом о высшем образовании', 'ВД-114420'],
      ['staff', 'Договор', 'Трудовой договор', 'TD-2025-77'],
    ].map(([ownerType, kind, title, number], i) => ({
      ownerType: ownerType as any, kind: kind as string, title: title as string, number: number as string,
      ownerId: ownerType === 'student' ? pick(students, i).id : null,
      issuedAt: daysFromNow(-i * 30 - 100), authorId,
    })),
  });

  // ── Assets + Maintenance ──
  await prisma.asset.createMany({
    data: [
      ['Проектор Epson', 'INV-001', 'Кабинет 204', 'техника', 1, 'рабочее'],
      ['Парта ученическая', 'INV-014', 'Кабинет 101', 'мебель', 30, 'рабочее'],
      ['Интерактивная доска', 'INV-022', 'Кабинет 305', 'техника', 1, 'требует ремонта'],
      ['Компьютер ученический', 'INV-031', 'Компьютерный класс', 'техника', 15, 'рабочее'],
      ['Мяч футбольный', 'INV-040', 'Спортзал', 'инвентарь', 8, 'рабочее'],
      ['Стул офисный', 'INV-051', 'Учительская', 'мебель', 12, 'новое'],
    ].map(([name, inventoryNo, location, category, quantity, condition]) => ({
      name, inventoryNo, location, category, quantity: quantity as number, condition,
    })),
  });
  await prisma.maintenanceRequest.createMany({
    data: [
      ['Не работает проектор', 'Кабинет 204', 'high', 'in_progress', 'Завхоз Асанов'],
      ['Протекает кран', 'Туалет 2 этаж', 'medium', 'open', null],
      ['Заменить лампы', 'Коридор 3 этаж', 'low', 'open', null],
      ['Сломан стул', 'Кабинет 101', 'low', 'done', 'Завхоз Асанов'],
      ['Покраска стен', 'Спортзал', 'medium', 'open', null],
    ].map(([title, location, priority, status, assigneeName]) => ({
      title: title as string, location, priority: priority as any, status: status as any,
      assigneeName: assigneeName as string | null, authorId,
    })),
  });

  // ── Accounting: invoices + payments + expenses ──
  const invStatuses = ['pending', 'paid', 'partial', 'paid', 'pending'];
  for (let i = 0; i < 15; i++) {
    const status = pick(invStatuses, i);
    const amount = 8000 + (i % 5) * 1000;
    const inv = await prisma.feeInvoice.create({
      data: {
        studentId: pick(students, i).id, title: 'Обучение', period: pick(['Сентябрь', 'Октябрь', 'Ноябрь'], i),
        amount, status: status as any, dueDate: daysFromNow(i + 5),
      },
    });
    if (status === 'paid') await prisma.payment.create({ data: { invoiceId: inv.id, amount, method: 'банк' } });
    if (status === 'partial') await prisma.payment.create({ data: { invoiceId: inv.id, amount: Math.round(amount / 2), method: 'нал' } });
  }
  await prisma.expense.createMany({
    data: [
      ['salary', 'Зарплата педагогов, май', 850000], ['utilities', 'Электроэнергия', 42000],
      ['utilities', 'Отопление', 65000], ['supplies', 'Канцтовары', 18000],
      ['repair', 'Ремонт сантехники', 12000], ['supplies', 'Учебники', 95000],
      ['other', 'Хознужды', 23000], ['salary', 'Зарплата АХЧ', 120000],
    ].map(([category, title, amount], i) => ({ category, title, amount: amount as number, date: daysFromNow(-i * 6), authorId })),
  });

  // ── Kitchen menu (3 дня × 3 приёма) ──
  const meals: any[] = [];
  const dishes: Record<string, string[]> = {
    breakfast: ['Каша рисовая', 'Омлет', 'Сырники'],
    lunch: ['Борщ, плов', 'Суп-лапша, котлета с пюре', 'Шорпо, бешбармак'],
    snack: ['Булочка, чай', 'Печенье, кефир', 'Фрукты'],
  };
  for (let d = 0; d < 3; d++) for (const meal of ['breakfast', 'lunch', 'snack']) {
    meals.push({ date: daysFromNow(d), meal: meal as any, dish: pick(dishes[meal], d), calories: 300 + d * 50, cost: 40 + d * 10 });
  }
  await prisma.mealMenu.createMany({ data: meals });

  // ── Specialist cabinets ──
  const kinds = ['speech', 'psych', 'medical'] as const;
  await prisma.specialistSession.createMany({
    data: Array.from({ length: 15 }, (_, i) => ({
      kind: pick(kinds as any, i), studentId: pick(students, i).id, specialistId,
      date: daysFromNow(-i - 1), startTime: `${9 + (i % 6)}:00`, endTime: `${9 + (i % 6)}:30`,
      note: pick(['Индивидуальное занятие', 'Групповая работа', 'Диагностика', 'Осмотр'], i),
    })),
  });
  await prisma.specialistRecommendation.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      kind: pick(['psych', 'speech'] as any, i), studentId: pick(students, i * 2).id, specialistId,
      text: pick(['Рекомендованы занятия 2 раза в неделю.', 'Снизить учебную нагрузку, наблюдение.', 'Артикуляционная гимнастика ежедневно.', 'Консультация родителей.'], i),
      date: daysFromNow(-i * 4),
    })),
  });
  await prisma.specialistProgress.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      kind: pick(['speech', 'psych'] as any, i), studentId: pick(students, i).id, specialistId,
      metric: pick(['Звук «Р»', 'Звук «Л»', 'Тревожность', 'Связная речь', 'Концентрация'], i),
      value: 40 + (i * 6) % 60, date: daysFromNow(-i * 3),
    })),
  });

  // ── HR / Кадры ──
  // Сотрудники АХЧ/сервиса (StaffMember), на них вешаем договоры/зарплаты/отпуска.
  const staffSeed: Array<[string, string, string, string, string]> = [
    ['Асанов', 'Бакыт', 'Бакытович', 'Завхоз', 'АХЧ'],
    ['Иманова', 'Гульнара', 'Сапаровна', 'Бухгалтер', 'Бухгалтерия'],
    ['Койчуманов', 'Эрлан', 'Тологонович', 'Системный администратор', 'IT'],
    ['Садыкова', 'Айгуль', 'Маратовна', 'Методист', 'Учебная часть'],
    ['Токтосунов', 'Нурлан', 'Жанышевич', 'Охранник', 'Охрана'],
    ['Эргешова', 'Жылдыз', 'Аскаровна', 'Повар', 'Кухня'],
  ];
  const staff = [];
  for (let i = 0; i < staffSeed.length; i++) {
    const [lastName, firstName, middleName, position, department] = staffSeed[i];
    staff.push(
      await prisma.staffMember.create({
        data: {
          lastName, firstName, middleName, position, department,
          phone: `+99670${(100000 + i * 1111).toString().slice(0, 6)}`,
          hireDate: daysFromNow(-300 - i * 40), isActive: true,
        },
      }),
    );
  }

  // Вакансии (главная задача HR — копить резерв под открытые позиции).
  await prisma.vacancy.createMany({
    data: ([
      ['Учитель английского языка', 'Учебная часть', 2, 'open'],
      ['Учитель начальных классов', 'Учебная часть', 1, 'open'],
      ['Психолог', 'Психологическая служба', 1, 'open'],
      ['Лаборант химии', 'Учебная часть', 1, 'closed'],
      ['Дворник', 'АХЧ', 1, 'open'],
    ] as Array<[string, string, number, string]>).map(([title, department, count, status]) => ({
      title, department, count, status,
    })),
  });

  // Резерв кандидатов (воркфлоу статусов резерв→собес→оффер→принят/отказ).
  await prisma.candidate.createMany({
    data: ([
      ['Жакшылыков Тимур', 'Учитель английского языка', 'interview', 'Опыт 3 года, уровень B2'],
      ['Маматова Асель', 'Учитель начальных классов', 'reserve', 'Резюме на будущее'],
      ['Орозбеков Канат', 'Психолог', 'offer', 'Прошёл собеседование, ждёт решения'],
      ['Бейшеналиева Нургуль', 'Учитель английского языка', 'reserve', null],
      ['Дуйшенов Азамат', 'Лаборант химии', 'hired', 'Принят с 1 сентября'],
      ['Сыдыкова Чолпон', 'Учитель начальных классов', 'rejected', 'Недостаточно опыта'],
    ] as Array<[string, string, string, string | null]>).map(([fullName, position, status, note]) => ({
      fullName, position, status: status as any, note,
    })),
  });

  // Трудовые договоры — по одному на сотрудника.
  for (let i = 0; i < staff.length; i++) {
    const s = staff[i];
    await prisma.staffContract.create({
      data: {
        staffId: s.id, number: `ТД-2025-${100 + i}`, position: s.position,
        salary: 25000 + i * 4000, startDate: s.hireDate, status: 'active',
      },
    });
  }

  // Журнал зарплат — 3 месяца × сотрудник (последний месяц — ещё не выплачен).
  const periods = ['Март', 'Апрель', 'Май'];
  const salRows: any[] = [];
  for (let i = 0; i < staff.length; i++) {
    for (let p = 0; p < periods.length; p++) {
      salRows.push({
        staffId: staff[i].id, period: periods[p], amount: 25000 + i * 4000,
        bonus: p === 2 ? 3000 : 0, paid: p < 2,
        paidAt: p < 2 ? daysFromNow(-30 * (2 - p)) : null,
      });
    }
  }
  await prisma.salaryRecord.createMany({ data: salRows });

  // Отпуска / больничные.
  await prisma.leaveRecord.createMany({
    data: ([
      [0, 'vacation', -20, -6, 'Очередной отпуск'],
      [2, 'sick', -10, -7, 'Больничный лист'],
      [4, 'vacation', 10, 24, 'Плановый отпуск летом'],
      [1, 'unpaid', -3, -2, 'За свой счёт'],
    ] as Array<[number, string, number, number, string]>).map(([idx, type, sd, ed, note]) => ({
      staffId: staff[idx].id, type, startDate: daysFromNow(sd), endDate: daysFromNow(ed), note,
    })),
  });

  console.log('Готово: новые модули засеяны.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
