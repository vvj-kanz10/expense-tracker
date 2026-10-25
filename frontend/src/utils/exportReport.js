import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_NAME = 'MoneyTrack AI';
const BRAND_PRIMARY = [16, 185, 129]; // Emerald Green
const BRAND_DARK = [15, 23, 42];      // Slate 900
const TEXT_MUTED = [100, 116, 139];   // Slate 500
const CARD_BG = [241, 245, 249];      // Slate 100
const BORDER_COLOR = [226, 232, 240]; // Slate 200
const ROW_ALT = [248, 250, 252];
const INCOME_TEXT = [5, 150, 105];
const EXPENSE_TEXT = [225, 29, 72];

// Same category colours as the dashboard pills.
// solid = charts and bars, bg/text = the pill itself
const CATEGORY_COLORS = {
  'Food & Dining':    { solid: [249, 115, 22],  bg: [255, 237, 213], text: [194, 65, 12] },
  'Groceries':        { solid: [132, 204, 22],  bg: [236, 252, 203], text: [77, 124, 15] },
  'Transport':        { solid: [14, 165, 233],  bg: [224, 242, 254], text: [3, 105, 161] },
  'Shopping':         { solid: [236, 72, 153],  bg: [252, 231, 243], text: [190, 24, 93] },
  'Bills & Utilities':{ solid: [99, 102, 241],  bg: [224, 231, 255], text: [67, 56, 202] },
  'Entertainment':    { solid: [168, 85, 247],  bg: [243, 232, 255], text: [126, 34, 206] },
  'Health & Fitness': { solid: [244, 63, 94],   bg: [255, 228, 230], text: [190, 18, 60] },
  'Rent/Housing':     { solid: [245, 158, 11],  bg: [254, 243, 199], text: [180, 83, 9] },
  'Income':           { solid: [16, 185, 129],  bg: [209, 250, 229], text: [4, 120, 87] },
  'Withdrawal':       { solid: [20, 184, 166],  bg: [204, 251, 241], text: [15, 118, 110] },
  'Other/People':     { solid: [100, 116, 139], bg: [241, 245, 249], text: [71, 85, 105] },
};
const DEFAULT_CATEGORY = { solid: [148, 163, 184], bg: [241, 245, 249], text: [71, 85, 105] };
const catStyle = (name) => CATEGORY_COLORS[name] || DEFAULT_CATEGORY;

const TYPE_PILL = {
  Income:  { bg: [209, 250, 229], text: [4, 120, 87] },
  Expense: { bg: [255, 228, 230], text: [190, 18, 60] },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Compact version for charts (no paise)
const moneyShort = (n) => `Rs. ${Math.round(Number(n)).toLocaleString('en-IN')}`;

// 2026-07-12 -> 12 Jul 2026
const formatDate = (iso) => {
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

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

// Loads /logo.svg from the public folder and turns it into a PNG the PDF can use.
// If anything goes wrong it returns null and the report simply goes without a logo.
function loadLogo(src = '/logo.svg', size = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Cuts text with "..." so it fits in maxW. Set the font BEFORE calling this.
function fit(doc, text, maxW) {
  const value = String(text ?? '');
  if (doc.getTextWidth(value) <= maxW) return value;
  let t = value;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxW) t = t.slice(0, -1);
  return `${t}...`;
}

// Rounded "pill" label, same look as the dashboard. Returns its width.
function drawPill(doc, label, x, centerY, colors, { fontSize = 7.5, height = 14 } = {}) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const w = doc.getTextWidth(label) + 14;
  doc.setFillColor(...colors.bg);
  doc.roundedRect(x, centerY - height / 2, w, height, height / 2, height / 2, 'F');
  doc.setTextColor(...colors.text);
  doc.text(label, x + w / 2, centerY + fontSize * 0.35, { align: 'center' });
  return w;
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

export async function generateMonthlyReport({ monthKey, transactions, effectiveTransactions, username }) {
  const { rows, income, expenses, net, savingsRate } = summarizeMonth(monthKey, transactions);
  const logo = await loadLogo();

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const finalY = () => doc.lastAutoTable?.finalY ?? 200;

  /* ---------- Header Band with logo ---------- */
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 85, 'F');

  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, pageW, 4, 'F');

  let titleX = margin;
  if (logo) {
    doc.addImage(logo, 'PNG', margin, 21, 46, 46);
    titleX = margin + 58;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(BRAND_NAME, titleX, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Monthly Financial Report — ${monthKey}`, titleX, 61);

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

  /* ---------- Category numbers (used by highlights, charts and table) ---------- */
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

  /* ---------- Summary Cards ---------- */
  const cards = [
    { label: 'TOTAL INCOME', value: money(income), color: BRAND_DARK, accent: BRAND_PRIMARY },
    { label: 'TOTAL EXPENSES', value: money(expenses), color: BRAND_DARK, accent: EXPENSE_TEXT },
    {
      label: 'NET SAVINGS',
      value: `${net < 0 ? '-' : ''}${money(Math.abs(net))}`,
      color: net >= 0 ? INCOME_TEXT : EXPENSE_TEXT,
      accent: net >= 0 ? INCOME_TEXT : EXPENSE_TEXT,
    },
    { label: 'SAVINGS RATE', value: `${savingsRate.toFixed(1)}%`, color: BRAND_DARK, accent: [59, 130, 246] },
  ];

  const gap = 10;
  const cardW = (contentW - gap * 3) / 4;
  const cardY = 105;
  const cardH = 58;

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap);

    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(1);
    doc.roundedRect(x, cardY, cardW, cardH, 5, 5, 'FD');

    doc.setFillColor(...card.accent);
    doc.roundedRect(x, cardY, 3, cardH, 2, 2, 'F');

    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(card.label, x + 12, cardY + 20);

    doc.setTextColor(...card.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(card.value, x + 12, cardY + 41);
  });

  /* ---------- Highlights strip ---------- */
  const expenseRows = rows.filter((tx) => tx.type === 'EXPENSE');
  const biggest = expenseRows.reduce(
    (max, tx) => (!max || Number(tx.amount) > Number(max.amount) ? tx : max),
    null
  );
  const topCat = sortedCategories[0];
  const highlights = [
    {
      label: 'TOP CATEGORY',
      value: topCat ? `${topCat[0]} (${((topCat[1] / catTotal) * 100).toFixed(0)}%)` : '-',
    },
    {
      label: 'LARGEST EXPENSE',
      value: biggest
        ? `${moneyShort(biggest.amount)}${biggest.merchant && biggest.merchant !== 'Unknown' ? ` at ${biggest.merchant}` : ''}`
        : '-',
    },
    { label: 'TRANSACTIONS', value: `${rows.length}` },
  ];

  const hY = cardY + cardH + 10;
  const hH = 38;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(1);
  doc.roundedRect(margin, hY, contentW, hH, 5, 5, 'FD');

  const hColW = contentW / 3;
  highlights.forEach((h, i) => {
    const x = margin + i * hColW + 14;
    if (i > 0) {
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.8);
      doc.line(margin + i * hColW, hY + 8, margin + i * hColW, hY + hH - 8);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(h.label, x, hY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_DARK);
    doc.text(fit(doc, h.value, hColW - 28), x, hY + 28);
  });

  let currentY = hY + hH + 26;

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
    const slices = top.map(([name, value]) => ({ name, value, color: catStyle(name).solid }));
    if (rest.length > 0) {
      slices.push({
        name: `Others (${rest.length})`,
        value: rest.reduce((s, [, v]) => s + v, 0),
        color: DEFAULT_CATEGORY.solid,
      });
    }

    const cx = margin + radius + 10;
    const cy = currentY + 16 + radius;
    drawDonut(doc, cx, cy, radius, slices, catTotal);

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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_DARK);
      doc.text(fit(doc, s.name, 170), legendX + 16, ly);

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

    doc.setFontSize(7);
    for (let k = 0; k <= 2; k++) {
      const gy = baseline - plotH * (k / 2);
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.5);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(axisLabel((maxV * k) / 2), plotX - 6, gy + 2.5, { align: 'right' });
    }

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

  /* ---------- Spending by Category (table with dots and share bars) ---------- */
  ensureSpace(90);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Spending by Category', margin, currentY);

  if (sortedCategories.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No expenses recorded for this month.', margin, currentY + 16);
    doc.lastAutoTable = { finalY: currentY + 24 };
  } else {
    autoTable(doc, {
      startY: currentY + 8,
      margin: { left: margin, right: margin, top: 50, bottom: 45 },
      head: [['Category', 'Amount', 'Share', '']],
      body: sortedCategories.map(([category, amount]) => [
        category,
        money(amount),
        `${((amount / catTotal) * 100).toFixed(1)}%`,
        '',
      ]),
      foot: [['Total', money(catTotal), '100.0%', '']],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { lineColor: BORDER_COLOR, lineWidth: 0.4, valign: 'middle' },
      headStyles: { fillColor: BRAND_DARK, textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 6 },
      bodyStyles: { textColor: BRAND_DARK, fontSize: 9, cellPadding: 6 },
      footStyles: { fillColor: CARD_BG, textColor: BRAND_DARK, fontStyle: 'bold', fontSize: 9, cellPadding: 6 },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 'auto', cellPadding: { top: 6, bottom: 6, left: 24, right: 6 } },
        1: { halign: 'right', cellWidth: 105 },
        2: { halign: 'right', cellWidth: 60 },
        3: { cellWidth: 130 },
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const entry = sortedCategories[data.row.index];
        if (!entry) return;
        const { x, y, width, height } = data.cell;
        const midY = y + height / 2;
        const color = catStyle(entry[0]).solid;

        if (data.column.index === 0) {
          doc.setFillColor(...color);
          doc.circle(x + 12, midY, 3.5, 'F');
        }
        if (data.column.index === 3) {
          const barX = x + 8;
          const barMaxW = width - 16;
          doc.setFillColor(...BORDER_COLOR);
          doc.roundedRect(barX, midY - 3, barMaxW, 6, 3, 3, 'F');
          const fillW = Math.max(4, barMaxW * (entry[1] / catTotal));
          doc.setFillColor(...color);
          doc.roundedRect(barX, midY - 3, fillW, 6, 3, 3, 'F');
        }
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

  /* ---------- Transaction Ledger (with category and type pills) ---------- */
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
    margin: { left: margin, right: margin, top: 50, bottom: 45 },
    head: [['Date', 'Transaction Details', 'Category', 'Type', 'Amount']],
    // Details, category and type are drawn by hand below, so those cells stay empty here
    body: sortedRows.map((tx) => [
      formatDate(tx.transactionDate),
      '',
      '',
      '',
      `${tx.type === 'INCOME' ? '+' : '-'}${money(tx.amount)}`,
    ]),
    theme: 'grid',
    styles: { lineColor: BORDER_COLOR, lineWidth: 0.4, valign: 'middle' },
    headStyles: { fillColor: BRAND_DARK, textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 6 },
    bodyStyles: { textColor: BRAND_DARK, fontSize: 8, cellPadding: 5.5, minCellHeight: 30 },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 100 },
      3: { cellWidth: 56 },
      4: { cellWidth: 88, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const tx = sortedRows[data.row.index];
        data.cell.styles.textColor = tx.type === 'INCOME' ? INCOME_TEXT : EXPENSE_TEXT;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const tx = sortedRows[data.row.index];
      if (!tx) return;
      const { x, y, width, height } = data.cell;
      const midY = y + height / 2;

      // Merchant (bold) with the description under it
      if (data.column.index === 1) {
        const maxW = width - 12;
        const hasMerchant = tx.merchant && tx.merchant !== 'Unknown';
        if (hasMerchant) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...BRAND_DARK);
          doc.text(fit(doc, tx.merchant, maxW), x + 6, midY - 2);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...TEXT_MUTED);
          doc.text(fit(doc, tx.description || '', maxW), x + 6, midY + 9);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...BRAND_DARK);
          doc.text(fit(doc, tx.description || '', maxW), x + 6, midY + 3);
        }
      }

      // Category pill
      if (data.column.index === 2) {
        const label = tx.category || 'Uncategorized';
        drawPill(doc, label, x + 6, midY, catStyle(label));
      }

      // Income / Expense pill
      if (data.column.index === 3) {
        const label = tx.type === 'INCOME' ? 'Income' : 'Expense';
        drawPill(doc, label, x + 6, midY, TYPE_PILL[label], { fontSize: 7 });
      }
    },
  });

  /* ---------- Footer on every page, small header from page 2 ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    if (i > 1) {
      let nameX = margin;
      if (logo) {
        doc.addImage(logo, 'PNG', margin, 12, 18, 18);
        nameX = margin + 24;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_DARK);
      doc.text(BRAND_NAME, nameX, 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`${monthKey} Report`, pageW - margin, 24, { align: 'right' });

      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.5);
      doc.line(margin, 36, pageW - margin, 36);
    }

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