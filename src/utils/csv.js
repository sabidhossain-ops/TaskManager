const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function toCsv(headers, rows) {
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n');
}

export function downloadCsv(filename, csv) {
  // BOM so Excel opens UTF-8 (e.g. Bangla names) correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
