import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_NAME = 'MoneyTrack AI';
const BRAND_PRIMARY = [16, 185, 129]; // Emerald Green
const BRAND_DARK = [15, 23, 42];    // Slate 900
const TEXT_MUTED = [100, 116, 139]; // Slate 500
const CARD_BG = [241, 245, 249];    // Slate 100
const BORDER_COLOR = [226, 232, 240]; // Slate 200
const INCOME_TEXT = [5, 150, 105];
const EXPENSE_TEXT = [225, 29, 72];

const CHART_COLORS = [
  [16, 185, 129],  // emerald
  [59, 130, 246],  // blue
  [245, 158, 11],  // amber
  [244, 63, 94],   // rose
  [139, 92, 246],  // violet
  [6, 182, 212],   // cyan
  [148, 163, 184], // slate (used for "Others")
];

const money = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Compact version for charts (no paise)
const moneyShort = (n) => `Rs. ${Math.round(Number(n)).toLocaleString('en-IN')}`;

// Short labels for the chart's side axis: 1500 -> 1.5k, 250000 -> 2.5L
const axisLabel = (v) => {
  if (v >= 100000) return `${+(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
};

// Rounds a number up to a "nice" axis maximum (e.g. 4300 -> 5000)
const niceCeil = (v) => {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

export const monthKeyOf = (tx) =>
  new Date(tx.transactionDate).toLocaleString('default', { month: 'long', year: 'numeric' });

export function summarizeMonth(monthKey, transactions) {
  const rows = transactions.filter((tx) => monthKeyOf(tx) === monthKey);
  const income = rows.filter((tx) => tx.type === 'INCOME').reduce((s, tx) => s + Number(tx.amount), 0);
  const expenses = rows.filter((tx) => tx.type === 'EXPENSE').reduce((s, tx) => s + Number(tx.amount), 0);
  const net = income - expenses;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  return { rows, income, expenses, net, savingsRate };
}

// Draws a donut chart using many thin triangles (jsPDF has no pie primitive)
function drawDonut(doc, cx, cy, r, slices, total) {
  let angle = -Math.PI / 2; // start at 12 o'clock
  const starts = [];

  slices.forEach((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 90))); // roughly 2 degree steps
    doc.setFillColor(...s.color);
    doc.setDrawColor(...s.color);
    doc.setLineWidth(0.4);
    for (let i = 0; i < steps; i++) {
      const a1 = angle + (sweep * i) / steps;
      const a2 = angle + (sweep * (i + 1)) / steps;
      doc.triangle(
        cx, cy,
        cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        cx + r * Math.cos(a2), cy + r * Math.sin(a2),
        'FD'
      );
    }
    starts.push(angle);
    angle += sweep;
  });

  // thin white lines between slices
  if (slices.length > 1) {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.2);
    starts.forEach((a) => {
      doc.line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a));
    });
  }

  // hole in the middle
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.6, 'F');
}

export function generateMonthlyReport({ monthKey, transactions, effectiveTransactions, username }) {
  const { rows, income, expenses, net, savingsRate } = summarizeMonth(monthKey, transactions);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const finalY = () => doc.lastAutoTable?.finalY ?? 200;

  /* ---------- Header Band (Styled with subtle gradient/depth line) ---------- */
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 85, 'F');

  // Accent primary bar on top edge
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, pageW, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(BRAND_NAME, margin, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Monthly Executive Financial Report — ${monthKey}`, margin, 58);

  doc.setFontSize(9);
  if (username) {
    doc.text(`Account: ${username}`, pageW - margin, 36, { align: 'right' });
  }
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    pageW - margin,
    54,
    { align: 'right' }
  );

  /* ---------- Summary Cards Grid ---------- */
  const cards = [
    { label: 'TOTAL INCOME', value: money(income), color: BRAND_DARK },
    { label: 'TOTAL EXPENSES', value: money(expenses), color: BRAND_DARK },
    { label: 'NET SAVINGS', value: `${net < 0 ? '-' : ''}${money(Math.abs(net))}`, color: net >= 0 ? INCOME_TEXT : EXPENSE_TEXT },
    { label: 'SAVINGS RATE', value: `${savingsRate.toFixed(1)}%`, color: BRAND_DARK },
  ];

  const gap = 10;
  const cardW = (contentW - gap * 3) / 4;
  const cardY = 105;
  const cardH = 58;

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap);

    // Card Background & Border
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(1);
    doc.roundedRect(x, cardY, cardW, cardH, 5, 5, 'FD');

    // Left Accent Strip on card
    doc.setFillColor(...BRAND_PRIMARY);
    doc.roundedRect(x, cardY, 3, cardH, 2, 2, 'F');

    // Label
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(card.label, x + 12, cardY + 20);

    // Value
    doc.setTextColor(...card.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(card.value, x + 12, cardY + 41);
  });

  /* ---------- Work out the category numbers once (used by charts + table) ---------- */
  let currentY = cardY + cardH + 28;

  const monthEffective = effectiveTransactions.filter(
    (tx) => monthKeyOf(tx) === monthKey && tx.type === 'EXPENSE'
  );
  const byCategory = {};
  monthEffective.forEach((tx) => {
    const key = tx.category || 'Uncategorized';
    byCategory[key] = (byCategory[key] || 0) + Number(tx.amount);
  });
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const catTotal = sortedCategories.reduce((s, [, v]) => s + v, 0);

  // Starts a new page if the next block would run off the bottom
  const ensureSpace = (needed) => {
    if (currentY + needed > pageH - 60) {
      doc.addPage();
      currentY = 50;
    }
  };

  /* ---------- Chart 1: Spending Breakdown (donut + legend) ---------- */
  if (sortedCategories.length > 0 && catTotal > 0) {
    const radius = 58;
    ensureSpace(16 + radius * 2 + 24);

    doc.setTextColor(...BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Spending Breakdown', margin, currentY);

    // Top 6 categories get a slice, everything else is grouped into "Others"
    const top = sortedCategories.slice(0, 6);
    const rest = sortedCategories.slice(6);
    const slices = top.map(([name, value], i) => ({ name, value, color: CHART_COLORS[i] }));
    if (rest.length > 0) {
      slices.push({
        name: `Others (${rest.length})`,
        value: rest.reduce((s, [, v]) => s + v, 0),
        color: CHART_COLORS[6],
      });
    }

    const cx = margin + radius + 10;
    const cy = currentY + 16 + radius;
    drawDonut(doc, cx, cy, radius, slices, catTotal);

    // Total in the middle of the donut
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('TOTAL SPENT', cx, cy - 3, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_DARK);
    doc.text(moneyShort(catTotal), cx, cy + 9, { align: 'center' });

    // Legend on the right
    const legendX = cx + radius + 40;
    const legendRight = pageW - margin;
    const rowH = 17;
    let ly = cy - (slices.length * rowH) / 2 + 11;

    slices.forEach((s) => {
      doc.setFillColor(...s.color);
      doc.roundedRect(legendX, ly - 8, 9, 9, 2, 2, 'F');

      const label = s.name.length > 24 ? `${s.name.slice(0, 23)}…` : s.name;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_DARK);
      doc.text(label, legendX + 16, ly);

      doc.setTextColor(...TEXT_MUTED);
      doc.text(moneyShort(s.value), legendRight - 55, ly, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND_DARK);
      doc.text(`${((s.value / catTotal) * 100).toFixed(1)}%`, legendRight, ly, { align: 'right' });

      ly += rowH;
    });

    currentY += 16 + radius * 2 + 24;
  }

  /* ---------- Chart 2: Daily Spending (bar chart) ---------- */
  if (monthEffective.length > 0) {
    const plotH = 90;
    ensureSpace(26 + plotH + 34);

    const [yy, mm] = String(monthEffective[0].transactionDate).split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();

    const daily = new Array(daysInMonth + 1).fill(0);
    monthEffective.forEach((tx) => {
      const d = Number(String(tx.transactionDate).slice(8, 10));
      if (d >= 1 && d <= daysInMonth) daily[d] += Number(tx.amount);
    });

    let peakDay = 1;
    for (let d = 1; d <= daysInMonth; d++) {
      if (daily[d] > daily[peakDay]) peakDay = d;
    }
    const peak = daily[peakDay];
    const maxV = niceCeil(peak);

    doc.setTextColor(...BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Daily Spending', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Peak day: ${peakDay} (${moneyShort(peak)})   |   Daily average: ${moneyShort(catTotal / daysInMonth)}`,
      margin,
      currentY + 14
    );

    const labelW = 34;
    const plotX = margin + labelW;
    const plotW = contentW - labelW;
    const plotTop = currentY + 28;
    const baseline = plotTop + plotH;

    // Grid lines + side axis labels (0, half, max)
    doc.setFontSize(7);
    for (let k = 0; k <= 2; k++) {
      const gy = baseline - plotH * (k / 2);
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.5);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(axisLabel((maxV * k) / 2), plotX - 6, gy + 2.5, { align: 'right' });
    }

    // Bars
    const slot = plotW / daysInMonth;
    const barW = Math.max(2, slot * 0.62);
    for (let d = 1; d <= daysInMonth; d++) {
      const v = daily[d];
      if (v <= 0) continue;
      const h = Math.max(1, plotH * (v / maxV));
      const x = plotX + (d - 1) * slot + (slot - barW) / 2;
      doc.setFillColor(...(d === peakDay ? EXPENSE_TEXT : BRAND_PRIMARY));
      doc.rect(x, baseline - h, barW, h, 'F');
    }

    // Day numbers under the bars (1, 5, 10, ... and the last day)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    for (let d = 1; d <= daysInMonth; d++) {
      const show = d === 1 || (d % 5 === 0 && daysInMonth - d >= 2) || d === daysInMonth;
      if (show) {
        doc.text(String(d), plotX + (d - 1) * slot + slot / 2, baseline + 11, { align: 'center' });
      }
    }

    currentY = baseline + 34;
  }

  /* ---------- Spending by Category Section (table) ---------- */
  ensureSpace(80);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Spending by Category', margin, currentY);

  const categoryRows = sortedCategories.map(([category, amount]) => [
    category,
    money(amount),
    expenses > 0 ? `${((amount / expenses) * 100).toFixed(1)}%` : '-',
  ]);

  if (categoryRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No expenses recorded for this month.', margin, currentY + 16);
    doc.lastAutoTable = { finalY: currentY + 24 };
  } else {
    autoTable(doc, {
      startY: currentY + 8,
      margin: { left: margin, right: margin },
      head: [['Category', 'Amount', 'Share']],
      body: categoryRows,
      theme: 'grid',
      headStyles: {
        fillColor: BRAND_DARK,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 6
      },
      bodyStyles: {
        textColor: BRAND_DARK,
        fontSize: 9,
        cellPadding: 6
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: BORDER_COLOR,
      tableLineWidth: 0.5,
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 110 },
        2: { halign: 'right', cellWidth: 80 }
      },
    });
  }

  if (monthEffective.some((tx) => tx.source === 'CASH_SPLIT')) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      '* Split cash withdrawals are mapped to respective categories. Overall ledger totals remain unchanged.',
      margin,
      finalY() + 12
    );
    doc.lastAutoTable = { finalY: finalY() + 12 };
  }

  /* ---------- Transaction List Section ---------- */
  currentY = finalY() + 28;
  if (currentY > pageH - 130) {
    doc.addPage();
    currentY = 50;
  }

  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Transaction Ledger (${rows.length})`, margin, currentY);

  const sortedRows = [...rows].sort((a, b) =>
    a.transactionDate === b.transactionDate ? a.id - b.id : a.transactionDate < b.transactionDate ? -1 : 1
  );

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: margin, right: margin, bottom: 45 },
    head: [['Date', 'Transaction Details', 'Category', 'Type', 'Amount']],
    body: sortedRows.map((tx) => {
      const merchant = tx.merchant && tx.merchant !== 'Unknown' ? `${tx.merchant}\n` : '';
      return [
        tx.transactionDate,
        `${merchant}${tx.description || ''}`,
        tx.category || 'Uncategorized',
        tx.type === 'INCOME' ? 'Income' : 'Expense',
        `${tx.type === 'INCOME' ? '+' : '-'}${money(tx.amount)}`,
      ];
    }),
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 6
    },
    bodyStyles: {
      textColor: BRAND_DARK,
      fontSize: 8.5,
      cellPadding: 5.5,
      overflow: 'linebreak'
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableLineColor: BORDER_COLOR,
    tableLineWidth: 0.5,
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90 },
      3: { cellWidth: 55 },
      4: { cellWidth: 90, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.textColor = data.row.raw[3] === 'Income' ? INCOME_TEXT : EXPENSE_TEXT;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  /* ---------- Professional Footer on Every Page ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Subtle top footer rule
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${BRAND_NAME} Secure Financial Analytics — UPI IDs and account details are masked.`, margin, pageH - 18);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 18, { align: 'right' });
  }

  doc.save(`${BRAND_NAME.replace(/\s+/g, '-')}-${monthKey.replace(/\s+/g, '-')}.pdf`);
}