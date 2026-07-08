export function validateDeadline(value: string | Date): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Некорректная дата';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (startOfDay(date) < startOfDay(new Date())) return 'Нельзя ставить прошедший дедлайн';
  return null;
}
