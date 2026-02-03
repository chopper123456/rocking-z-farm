/**
 * Export content to PDF using jsPDF. Use dynamically to keep bundle smaller.
 */
export async function exportToPdf({ title, rows, filename = 'report.pdf' }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  autoTable(doc, {
    startY: 28,
    head: [rows.length ? Object.keys(rows[0]) : []],
    body: rows.map((r) => Object.values(r))
  });
  doc.save(filename);
}
