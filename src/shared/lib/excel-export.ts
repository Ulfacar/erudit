import * as XLSX from 'xlsx';

export function exportToExcel(
  data: any[],
  columns: { key: string; header: string }[],
  filename: string,
): void {
  // Build rows from data using column config
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = col.key.split('.').reduce((obj, key) => obj?.[key], row);
      return value ?? '';
    }),
  );

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map((r) => String(r[i] ?? '').length),
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  // Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');

  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}
