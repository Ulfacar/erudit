/* global React */
// Mock data for ERUDIT — Bishkek school context

const STUDENTS_8A = [
  { id: 1, last: "Абдыкадырова", first: "Айдана", av: "av-violet", init: "АА" },
  { id: 2, last: "Алиев", first: "Тимур", av: "av-blue", init: "АТ" },
  { id: 3, last: "Бекмуратова", first: "Айгерим", av: "av-pink", init: "БА" },
  { id: 4, last: "Бектурганов", first: "Эльдар", av: "av-teal", init: "БЭ" },
  { id: 5, last: "Воронцова", first: "Дарья", av: "av-orange", init: "ВД" },
  { id: 6, last: "Джумабаев", first: "Нурлан", av: "av-green", init: "ДН" },
  { id: 7, last: "Иванов", first: "Артём", av: "av-blue", init: "ИА" },
  { id: 8, last: "Касымова", first: "Бегимай", av: "av-violet", init: "КБ" },
  { id: 9, last: "Курманбекова", first: "Айсулуу", av: "av-pink", init: "КА" },
  { id: 10, last: "Маматов", first: "Бекзат", av: "av-yellow", init: "МБ" },
  { id: 11, last: "Нурбеков", first: "Адилет", av: "av-orange", init: "НА" },
  { id: 12, last: "Орозбаева", first: "Айназик", av: "av-teal", init: "ОА" },
  { id: 13, last: "Петров", first: "Илья", av: "av-blue", init: "ПИ" },
  { id: 14, last: "Сатыбалдиева", first: "Алина", av: "av-violet", init: "СА" },
  { id: 15, last: "Семёнов", first: "Михаил", av: "av-gray", init: "СМ" },
  { id: 16, last: "Темирова", first: "Жанара", av: "av-pink", init: "ТЖ" },
  { id: 17, last: "Тилекова", first: "Айдай", av: "av-green", init: "ТА" },
  { id: 18, last: "Усенов", first: "Канат", av: "av-orange", init: "УК" },
  { id: 19, last: "Хасанова", first: "Лейла", av: "av-violet", init: "ХЛ" },
  { id: 20, last: "Шакирова", first: "Алия", av: "av-pink", init: "ША" },
  { id: 21, last: "Эркинбеков", first: "Бакыт", av: "av-teal", init: "ЭБ" },
  { id: 22, last: "Юсупов", first: "Руслан", av: "av-yellow", init: "ЮР" },
];

// Dates in October — last 10 lessons
const LESSON_DATES = [
  { d: 1, m: 10, weekday: "вт", type: "урок" },
  { d: 3, m: 10, weekday: "чт", type: "урок" },
  { d: 8, m: 10, weekday: "вт", type: "урок" },
  { d: 10, m: 10, weekday: "чт", type: "к/р", important: true },
  { d: 15, m: 10, weekday: "вт", type: "урок" },
  { d: 17, m: 10, weekday: "чт", type: "урок" },
  { d: 22, m: 10, weekday: "вт", type: "с/р" },
  { d: 24, m: 10, weekday: "чт", type: "урок" },
  { d: 29, m: 10, weekday: "вт", type: "урок" },
  { d: 31, m: 10, weekday: "чт", type: "урок" },
];

// Deterministic grade matrix: rows = students, cols = lessons
// values: 2|3|4|5|"н" (absent) | null (none)
function buildGrades() {
  const seed = (i, j) => (i * 7 + j * 13 + 3) % 100;
  return STUDENTS_8A.map((s, i) =>
    LESSON_DATES.map((l, j) => {
      const r = seed(i, j);
      // Distribution: 35% 5, 30% 4, 15% 3, 5% 2, 5% absent, 10% empty
      if (r < 10) return null;
      if (r < 15) return "н";
      if (r < 20) return 2;
      if (r < 35) return 3;
      if (r < 65) return 4;
      return 5;
    })
  );
}

function avg(arr) {
  const nums = arr.filter((x) => typeof x === "number");
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const GRADES_8A_MATH = buildGrades();

const SUBJECTS = [
  "Математика", "Алгебра", "Геометрия", "Русский язык", "Литература",
  "Кыргыз тили", "Кыргыз адабияты", "Английский язык", "Физика", "Химия",
  "Биология", "История Кыргызстана", "Всемирная история", "География", "Информатика",
  "Физкультура", "ИЗО", "Музыка", "Технология", "ОБЖ",
];

const TEACHERS = [
  { name: "Айгуль Касымовна Орозова", subj: "Математика", av: "av-violet", init: "АО" },
  { name: "Нурлан Бекович Сатыбалдиев", subj: "Физика", av: "av-blue", init: "НС" },
  { name: "Гульнара Ишеновна Турдубаева", subj: "Русский язык", av: "av-pink", init: "ГТ" },
  { name: "Эльмира Жумабековна Калыева", subj: "Английский", av: "av-orange", init: "ЭК" },
  { name: "Айбек Аскарович Маматов", subj: "Информатика", av: "av-teal", init: "АМ" },
  { name: "Замира Турсуновна Бектурганова", subj: "Биология", av: "av-green", init: "ЗБ" },
  { name: "Тилек Мирбекович Усенов", subj: "История", av: "av-yellow", init: "ТУ" },
  { name: "Анара Кубанычевна Эркинбекова", subj: "Химия", av: "av-pink", init: "АЭ" },
];

// Schedule — class 8А, week
const SCHEDULE_8A = [
  // Monday
  [
    { n: 1, time: "08:00", subj: "Математика", room: "212", teacher: "Орозова А.К.", color: "blue" },
    { n: 2, time: "08:50", subj: "Русский язык", room: "104", teacher: "Турдубаева Г.И.", color: "pink" },
    { n: 3, time: "09:45", subj: "Английский", room: "301", teacher: "Калыева Э.Ж.", color: "orange" },
    { n: 4, time: "10:40", subj: "История Кыргызстана", room: "215", teacher: "Усенов Т.М.", color: "yellow" },
    { n: 5, time: "11:35", subj: "Физкультура", room: "Спортзал", teacher: "Юсупов К.", color: "teal" },
    { n: 6, time: "12:30", subj: "Биология", room: "108", teacher: "Бектурганова З.Т.", color: "green" },
  ],
  // Tuesday
  [
    { n: 1, time: "08:00", subj: "Кыргыз тили", room: "203", teacher: "Тилекова Б.", color: "red" },
    { n: 2, time: "08:50", subj: "Математика", room: "212", teacher: "Орозова А.К.", color: "blue", grade: 5 },
    { n: 3, time: "09:45", subj: "География", room: "117", teacher: "Бекмуратов А.", color: "teal" },
    { n: 4, time: "10:40", subj: "Литература", room: "104", teacher: "Турдубаева Г.И.", color: "pink" },
    { n: 5, time: "11:35", subj: "Физика", room: "220", teacher: "Сатыбалдиев Н.Б.", color: "violet" },
    { n: 6, time: "12:30", subj: "Информатика", room: "305", teacher: "Маматов А.А.", color: "blue" },
  ],
  // Wednesday
  [
    { n: 1, time: "08:00", subj: "Химия", room: "218", teacher: "Эркинбекова А.К.", color: "pink" },
    { n: 2, time: "08:50", subj: "Алгебра", room: "212", teacher: "Орозова А.К.", color: "blue" },
    { n: 3, time: "09:45", subj: "Английский", room: "301", teacher: "Калыева Э.Ж.", color: "orange" },
    { n: 4, time: "10:40", subj: "Русский язык", room: "104", teacher: "Турдубаева Г.И.", color: "pink" },
    { n: 5, time: "11:35", subj: "Всемирная история", room: "215", teacher: "Усенов Т.М.", color: "yellow" },
  ],
  // Thursday
  [
    { n: 1, time: "08:00", subj: "Геометрия", room: "212", teacher: "Орозова А.К.", color: "blue", important: true, badge: "к/р" },
    { n: 2, time: "08:50", subj: "Физика", room: "220", teacher: "Сатыбалдиев Н.Б.", color: "violet" },
    { n: 3, time: "09:45", subj: "Кыргыз адабияты", room: "203", teacher: "Тилекова Б.", color: "red" },
    { n: 4, time: "10:40", subj: "ИЗО", room: "106", teacher: "Алыкулова М.", color: "yellow" },
    { n: 5, time: "11:35", subj: "Физкультура", room: "Спортзал", teacher: "Юсупов К.", color: "teal" },
    { n: 6, time: "12:30", subj: "ОБЖ", room: "110", teacher: "Маматов Б.", color: "gray" },
  ],
  // Friday
  [
    { n: 1, time: "08:00", subj: "Математика", room: "212", teacher: "Орозова А.К.", color: "blue" },
    { n: 2, time: "08:50", subj: "Английский", room: "301", teacher: "Калыева Э.Ж.", color: "orange" },
    { n: 3, time: "09:45", subj: "Биология", room: "108", teacher: "Бектурганова З.Т.", color: "green" },
    { n: 4, time: "10:40", subj: "Литература", room: "104", teacher: "Турдубаева Г.И.", color: "pink" },
    { n: 5, time: "11:35", subj: "Информатика", room: "305", teacher: "Маматов А.А.", color: "blue" },
  ],
  // Saturday
  [
    { n: 1, time: "08:00", subj: "Русский язык", room: "104", teacher: "Турдубаева Г.И.", color: "pink" },
    { n: 2, time: "08:50", subj: "Кыргыз тили", room: "203", teacher: "Тилекова Б.", color: "red" },
    { n: 3, time: "09:45", subj: "Музыка", room: "Актовый зал", teacher: "Касенова А.", color: "violet" },
    { n: 4, time: "10:40", subj: "Технология", room: "Мастерская", teacher: "Шарипов М.", color: "gray" },
  ],
];

const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Student diary — last week, for Айдана Абдыкадырова (8А)
const DIARY_WEEK = [
  { day: "Понедельник, 28 окт", lessons: [
    { time: "08:00", subj: "Математика", topic: "Линейные уравнения", grade: 5, hw: "§14, № 215, 218, 220" },
    { time: "08:50", subj: "Русский язык", topic: "Сложноподчинённое предложение", grade: null, hw: "Упр. 142 (письм.), правило стр. 87" },
    { time: "09:45", subj: "Английский", topic: "Present Perfect Continuous", grade: 4, hw: "Workbook p. 32 ex. 1-4" },
    { time: "10:40", subj: "История Кыргызстана", topic: "Эпоха Манаса: исторический контекст", grade: null, hw: "Прочитать §12, конспект" },
    { time: "11:35", subj: "Физкультура", topic: "Волейбол: подача", grade: null, hw: "" },
    { time: "12:30", subj: "Биология", topic: "Клеточное строение", grade: 5, hw: "§9, рис. 24 зарисовать" },
  ]},
  { day: "Вторник, 29 окт", lessons: [
    { time: "08:00", subj: "Кыргыз тили", topic: "Сын атооч", grade: 4, hw: "Көнүгүү 87" },
    { time: "08:50", subj: "Математика", topic: "Контрольная работа", grade: 5, hw: "Подготовка к §15", important: true },
    { time: "09:45", subj: "География", topic: "Климат Центральной Азии", grade: null, hw: "Контурная карта" },
    { time: "10:40", subj: "Литература", topic: 'Анализ повести "Джамиля"', grade: 4, hw: "Прочитать гл. 3-4" },
    { time: "11:35", subj: "Физика", topic: "Сила трения", grade: null, hw: "§22, упр. 8" },
    { time: "12:30", subj: "Информатика", topic: "Алгоритмы: ветвление", grade: 5, hw: "Задача на платформе" },
  ]},
  { day: "Среда, 30 окт", lessons: [
    { time: "08:00", subj: "Химия", topic: "Периодическая система", grade: null, hw: "§7, выучить 1-20" },
    { time: "08:50", subj: "Алгебра", topic: "Свойства функций", grade: 4, hw: "№ 412, 415" },
    { time: "09:45", subj: "Английский", topic: "Reading: City Life", grade: null, hw: "Vocab list, retell" },
    { time: "10:40", subj: "Русский язык", topic: "Союзы в СПП", grade: 3, hw: "Упр. 156" },
    { time: "11:35", subj: "Всемирная история", topic: "Эпоха Возрождения", grade: null, hw: "§14, эссе 1 стр." },
  ]},
];

const HOMEWORK_PENDING = [
  { subj: "Математика", task: "§14, № 215, 218, 220", due: "Завтра", teacher: "Орозова А.К.", attached: 0, status: "todo" },
  { subj: "Русский язык", task: "Упр. 142, правило стр. 87", due: "Завтра", teacher: "Турдубаева Г.И.", attached: 0, status: "todo" },
  { subj: "История Кыргызстана", task: "Прочитать §12, написать конспект (1-2 стр.)", due: "Через 2 дня", teacher: "Усенов Т.М.", attached: 1, status: "in-progress" },
  { subj: "Физика", task: "§22, упражнение 8", due: "Через 3 дня", teacher: "Сатыбалдиев Н.Б.", attached: 0, status: "todo" },
  { subj: "Литература", task: 'Прочитать главы 3-4 повести "Джамиля"', due: "Через 3 дня", teacher: "Турдубаева Г.И.", attached: 0, status: "todo" },
  { subj: "Английский", task: "Workbook p. 32 ex. 1-4", due: "Сдано", teacher: "Калыева Э.Ж.", attached: 2, status: "done" },
  { subj: "Биология", task: "§9, зарисовать рис. 24", due: "Сдано", teacher: "Бектурганова З.Т.", attached: 1, status: "done" },
];

// School-wide KPIs (Director)
const SCHOOL_KPI = {
  totalStudents: 1247,
  attendance: 94.2,
  avgGrade: 4.21,
  teachers: 87,
};

// Attendance over last 14 days
const ATTENDANCE_14D = [96.1, 95.4, 94.8, 93.2, 95.1, 94.7, 96.0, 95.8, 93.5, 92.1, 94.6, 95.3, 94.9, 94.2];

// Average grade by class (12 classes shown)
const CLASS_AVG = [
  { cls: "5А", avg: 4.45, students: 28, trend: 0.12 },
  { cls: "5Б", avg: 4.31, students: 27, trend: 0.05 },
  { cls: "6А", avg: 4.22, students: 26, trend: -0.03 },
  { cls: "7А", avg: 4.18, students: 29, trend: 0.08 },
  { cls: "7Б", avg: 3.94, students: 28, trend: -0.11 },
  { cls: "8А", avg: 4.35, students: 22, trend: 0.15 },
  { cls: "8Б", avg: 4.02, students: 25, trend: 0.02 },
  { cls: "9А", avg: 4.27, students: 24, trend: 0.06 },
  { cls: "9Б", avg: 3.88, students: 26, trend: -0.14 },
  { cls: "10А", avg: 4.41, students: 21, trend: 0.09 },
  { cls: "11А", avg: 4.52, students: 19, trend: 0.04 },
  { cls: "11Б", avg: 4.18, students: 20, trend: 0.07 },
];

// Recent events feed
const FEED = [
  { type: "grade", who: "Орозова А.К.", what: "выставила оценки за к/р по геометрии", cls: "8А", when: "10 мин назад", icon: "ClipboardCheck", color: "blue" },
  { type: "absence", who: "Иванов А.", what: "отсутствует без уважительной причины", cls: "7Б", when: "32 мин назад", icon: "AlertCircle", color: "yellow" },
  { type: "homework", who: "Турдубаева Г.И.", what: "опубликовала ДЗ по литературе", cls: "8А, 8Б", when: "1 ч назад", icon: "Book", color: "violet" },
  { type: "event", who: "Завуч Бекова А.", what: "запланировала педсовет", cls: "Все", when: "2 ч назад", icon: "Calendar", color: "green" },
  { type: "message", who: "Родитель Алиев Т.М.", what: "написал классному руководителю", cls: "8А", when: "3 ч назад", icon: "MessageSquare", color: "teal" },
  { type: "report", who: "Система", what: "сформировала еженедельный отчёт", cls: "", when: "Сегодня, 06:00", icon: "FileText", color: "gray" },
];

const ANNOUNCEMENTS = [
  { title: "Педагогический совет", date: "12 ноября, 15:00", desc: "Итоги I четверти, обсуждение успеваемости 8-9 классов", priority: "high" },
  { title: "Олимпиада по математике", date: "18-20 ноября", desc: "Городской тур, участвуют 5 учеников от школы", priority: "med" },
  { title: "Родительское собрание 8А", date: "25 октября, 18:00", desc: "Кабинет 212, итоги четверти", priority: "low" },
];

window.MOCK = {
  STUDENTS_8A,
  LESSON_DATES,
  GRADES_8A_MATH,
  SUBJECTS,
  TEACHERS,
  SCHEDULE_8A,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  DIARY_WEEK,
  HOMEWORK_PENDING,
  SCHOOL_KPI,
  ATTENDANCE_14D,
  CLASS_AVG,
  FEED,
  ANNOUNCEMENTS,
  avg,
};
