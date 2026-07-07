export function currentAcademicYearBounds() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(startYear, 7, 1),
    end: new Date(startYear + 1, 6, 31, 23, 59, 59),
  };
}

export function validateDeadline(value: string | Date): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Некорректная дата';
  const { start, end } = currentAcademicYearBounds();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (startOfDay(date) < startOfDay(new Date())) return 'Нельзя ставить прошедший дедлайн';
  if (date < start || date > end) return 'Дедлайн должен быть в текущем учебном году';
  return null;
}
