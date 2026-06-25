/**
 * Генерация партии QR-этикеток для учебников и печать через браузер.
 * Работает офлайн / он-прем: QR рисуется локально (qrcode), без обращений наружу.
 * PDF не нужен — открываем окно с сеткой и зовём window.print() («Сохранить как PDF»).
 */

export interface QrLabel {
  /** строка, закодированная в QR (она же инвентарный код учебника) */
  code: string;
  /** подпись под QR (название учебника) */
  caption: string;
}

/** Уникальные инвентарные коды для партии: PREFIX-001..NNN. */
export function buildTextbookCodes(itemId: string, count: number): string[] {
  const prefix = itemId.slice(-6).toUpperCase();
  const n = Math.max(1, Math.min(count || 1, 500)); // разумный предел на одну печать
  return Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);
}

/** Сгенерировать QR-этикетки и открыть окно печати. */
export async function printQrLabels(labels: QrLabel[], docTitle = 'QR-этикетки'): Promise<void> {
  if (labels.length === 0) return;
  const QRCode = (await import('qrcode')).default;

  const cells = await Promise.all(
    labels.map(async (l) => {
      const dataUrl = await QRCode.toDataURL(l.code, { margin: 1, width: 220 });
      return `<div class="cell">
        <img src="${dataUrl}" alt="${l.code}" />
        <div class="code">${l.code}</div>
        <div class="caption">${escapeHtml(l.caption)}</div>
      </div>`;
    }),
  );

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8" />
    <title>${escapeHtml(docTitle)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 8mm; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; }
      .cell { border: 1px dashed #bbb; border-radius: 6px; padding: 4mm; text-align: center;
        page-break-inside: avoid; }
      .cell img { width: 100%; height: auto; max-width: 38mm; }
      .code { font-family: monospace; font-size: 11px; font-weight: 700; margin-top: 2mm; }
      .caption { font-size: 10px; color: #555; margin-top: 1mm; line-height: 1.2; }
      @media print { .cell { border-color: #ddd; } }
    </style></head>
    <body>
      <div class="grid">${cells.join('')}</div>
      <script>window.onload = function () { window.print(); };</script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна, чтобы открыть лист QR-кодов для печати.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}
