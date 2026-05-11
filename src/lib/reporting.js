function escapeCsvCell(v) {
  const s = String(v ?? '');
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sumBy(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0);
}

function formatNT(n) {
  const v = parseInt(n, 10) || 0;
  return `NT$${v}`;
}

export function calcTxKind(tx) {
  if (tx?.type === 'sale') return '現場';
  if (tx?.type === 'online_store') return '通販';
  if (tx?.type === 'preorder_pickup') {
    return (tx.subtotal ?? 0) === 0 ? '預購A' : '預購B';
  }
  return tx?.type ?? '未知';
}

function getTxPaymentLabel(tx) {
  const kind = calcTxKind(tx);
  if (kind === '預購A') return '（已付清）';
  const pm = Array.isArray(tx?.payments) ? tx.payments[0] : null;
  if (!pm) {
    if (kind === '通販') return '（通販）';
    return '';
  }
  return pm.methodName ?? '';
}

function getTxTime(tx) {
  return tx?.time ?? '';
}

function sanitizeEventNameForFile(name) {
  const raw = String(name ?? '').trim() || '活動';
  // Remove Windows-invalid filename characters
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, '');
  // Replace whitespace with underscore
  return cleaned.replace(/\s+/g, '_');
}

function dateKeyToYYYYMMDD(dateKey) {
  return String(dateKey ?? '').replace(/-/g, '');
}

export function buildTransactionsCsvText({ dateKey, transactions }) {
  const txs = (transactions ?? [])
    .filter((t) => t.date === dateKey)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const productNames = Array.from(
    new Set(
      txs
        .flatMap((t) => (Array.isArray(t.items) ? t.items : []))
        .map((i) => i.productName)
        .filter(Boolean),
    ),
  ).sort();

  const productColStart = 3; // header index: 編號(0), 時間(1), 類型(2)
  const subtotalCol = productColStart + productNames.length; // 小計
  const paymentMethodCol = subtotalCol + 1; // 收款方式
  const noteCol = subtotalCol + 2; // 買家/備註

  const header = ['編號', '時間', '類型', ...productNames, '小計', '收款方式', '買家/備註'];
  const totalCols = header.length;

  const lines = [];
  lines.push(header.join(','));

  txs.forEach((tx, idx) => {
    const kind = calcTxKind(tx);
    const qtyMap = {};
    for (const it of tx.items ?? []) {
      const name = it.productName;
      qtyMap[name] = (qtyMap[name] ?? 0) + (it.qty ?? 0);
    }

    const row = new Array(totalCols).fill('');
    row[0] = tx.receiptNo ?? idx + 1;
    row[1] = getTxTime(tx);
    row[2] = kind;
    for (let i = 0; i < productNames.length; i++) {
      row[productColStart + i] = qtyMap[productNames[i]] ?? 0;
    }
    row[subtotalCol] = tx.subtotal ?? 0;
    row[paymentMethodCol] = getTxPaymentLabel(tx);
    row[noteCol] = tx.note ?? '';

    lines.push(row.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

export function buildSummaryCsvText({ dateKey, transactions }) {
  const txs = (transactions ?? [])
    .filter((t) => t.date === dateKey)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const productNames = Array.from(
    new Set(
      txs
        .flatMap((t) => (Array.isArray(t.items) ? t.items : []))
        .map((i) => i.productName)
        .filter(Boolean),
    ),
  ).sort();

  const productColStart = 3; // header index: 編號(0), 時間(1), 類型(2)
  const subtotalCol = productColStart + productNames.length; // 小計
  const paymentMethodCol = subtotalCol + 1; // 收款方式
  const noteCol = subtotalCol + 2; // 買家/備註

  const header = ['編號', '時間', '類型', ...productNames, '小計', '收款方式', '買家/備註'];
  const totalCols = header.length;

  const fixedRow = (cells) => {
    const row = new Array(totalCols).fill('');
    for (let i = 0; i < cells.length; i++) row[i] = cells[i];
    return row.map(escapeCsvCell).join(',');
  };

  const lines = [];
  const saleTxs = txs.filter((t) => calcTxKind(t) === '現場');
  const preorderATxs = txs.filter((t) => calcTxKind(t) === '預購A');
  const preorderBTxs = txs.filter((t) => calcTxKind(t) === '預購B');
  const onlineStoreTxs = txs.filter((t) => calcTxKind(t) === '通販');

  const getItemAmount = (it) => (it?.qty ?? 0) * (it?.unitPrice ?? 0);

  // 區塊二：商品彙整
  const countsAll = {};
  const amountsAll = {};
  const countsSale = {};
  const countsPreorder = {};
  const countsOnline = {};

  for (const name of productNames) {
    countsAll[name] = 0;
    amountsAll[name] = 0;
    countsSale[name] = 0;
    countsPreorder[name] = 0;
    countsOnline[name] = 0;
  }

  const accumulate = (txList, mode) => {
    for (const tx of txList) {
      for (const it of tx.items ?? []) {
        const name = it.productName;
        if (!name) continue;
        const qty = it.qty ?? 0;
        const amt = getItemAmount(it);
        if (mode === 'all') {
          countsAll[name] = (countsAll[name] ?? 0) + qty;
          amountsAll[name] = (amountsAll[name] ?? 0) + amt;
        } else if (mode === 'sale') {
          countsSale[name] = (countsSale[name] ?? 0) + qty;
        } else if (mode === 'preorder') {
          countsPreorder[name] = (countsPreorder[name] ?? 0) + qty;
        } else if (mode === 'online') {
          countsOnline[name] = (countsOnline[name] ?? 0) + qty;
        }
      }
    }
  };

  accumulate([...saleTxs, ...preorderATxs, ...preorderBTxs, ...onlineStoreTxs], 'all');
  accumulate(saleTxs, 'sale');
  accumulate([...preorderATxs, ...preorderBTxs], 'preorder');
  accumulate(onlineStoreTxs, 'online');

  const totalCountAll = productNames.reduce((s, n) => s + (countsAll[n] ?? 0), 0);
  const totalAmountAll = productNames.reduce((s, n) => s + (amountsAll[n] ?? 0), 0);
  const totalCountSale = productNames.reduce((s, n) => s + (countsSale[n] ?? 0), 0);
  const totalCountPreorder = productNames.reduce((s, n) => s + (countsPreorder[n] ?? 0), 0);
  const totalCountOnline = productNames.reduce((s, n) => s + (countsOnline[n] ?? 0), 0);

  lines.push(fixedRow(['商品彙整', '區塊二']));
  lines.push(fixedRow(['', '', '', ...productNames.map((n) => n), '', '', '']));
  lines.push(fixedRow(['各商品銷售數量（含預購+通販）', '', '', ...productNames.map((n) => countsAll[n] ?? 0), totalCountAll, '', '']));
  lines.push(
    fixedRow([
      '各商品銷售金額（含預購+通販）',
      '',
      '',
      ...productNames.map((n) => formatNT(amountsAll[n] ?? 0)),
      formatNT(totalAmountAll),
      '',
      '',
    ]),
  );
  lines.push(fixedRow(['（參考）僅現場銷售數量', '', '', ...productNames.map((n) => countsSale[n] ?? 0), totalCountSale, '', '']));
  lines.push(fixedRow(['（參考）預購取件數量（A+B型）', '', '', ...productNames.map((n) => countsPreorder[n] ?? 0), totalCountPreorder, '', '']));
  lines.push(fixedRow(['（參考）通販數量', '', '', ...productNames.map((n) => countsOnline[n] ?? 0), totalCountOnline, '', '']));

  // 區塊三：收款摘要
  const paymentSummaryGroup = (txList, { includeCash }) => {
    const byMethod = {};
    for (const tx of txList) {
      const pm = Array.isArray(tx.payments) ? tx.payments[0] : null;
      if (!pm) continue;
      if (includeCash === true && !pm.isCash) continue;
      if (includeCash === false && pm.isCash) continue;
      const name = pm.methodName ?? '（未命名）';
      if (!byMethod[name]) byMethod[name] = { amount: 0, count: 0 };
      byMethod[name].amount += tx.subtotal ?? 0;
      byMethod[name].count += 1;
    }
    return byMethod;
  };

  const saleCash = paymentSummaryGroup(saleTxs, { includeCash: true });
  const saleElectronic = paymentSummaryGroup(saleTxs, { includeCash: false });
  const preorderBCash = paymentSummaryGroup(preorderBTxs, { includeCash: true });
  const preorderBElectronic = paymentSummaryGroup(preorderBTxs, { includeCash: false });

  const preorderARefTotal = sumBy(preorderATxs, (t) => t.depositAlreadyPaid ?? 0);
  const preorderARefCount = preorderATxs.length;

  const todayRealTotal = sumBy(saleTxs, (t) => t.subtotal ?? 0) + sumBy(preorderBTxs, (t) => t.subtotal ?? 0);
  const onlineStoreTotal = sumBy(onlineStoreTxs, (t) => t.subtotal ?? 0);
  const onlineStoreCount = onlineStoreTxs.length;

  const allTotal = todayRealTotal + preorderARefTotal + onlineStoreTotal;

  // 你指定的順序：先 B → 再 A → 再 A（等式）
  lines.push('');
  lines.push(fixedRow(['收款摘要', '區塊三']));
  lines.push(fixedRow(['▸ 今日現場收款（需對到錢包的數字）']));

  // 現場銷售・現金
  const saleCashName = Object.keys(saleCash)[0] ?? '現金';
  const saleCashAmount = saleCash[saleCashName]?.amount ?? 0;
  const saleCashCount = saleCash[saleCashName]?.count ?? 0;
  lines.push(
    fixedRow(['現場銷售・現金', '', '', ...new Array(productNames.length).fill(''), formatNT(saleCashAmount), '', `（筆數 ${saleCashCount}）`]),
  );

  // 現場銷售・電子支付（依方法名排序）
  const saleElectronicEntries = Object.entries(saleElectronic).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [methodName, info] of saleElectronicEntries) {
    lines.push(
      fixedRow([
        `現場銷售・${methodName}`,
        '',
        '',
        ...new Array(productNames.length).fill(''),
        formatNT(info.amount),
        '',
        `（筆數 ${info.count}）`,
      ]),
    );
  }

  // 預購B尾款收款（B型；先列出）
  lines.push('');
  lines.push(fixedRow(['預購尾款收款（B型）']));
  const preorderBEntries = [...Object.entries(preorderBCash), ...Object.entries(preorderBElectronic)].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [methodName, info] of preorderBEntries) {
    lines.push(
      fixedRow([
        `預購尾款收款（B型）・${methodName}`,
        '',
        '',
        ...new Array(productNames.length).fill(''),
        formatNT(info.amount),
        '',
        `（筆數 ${info.count}）`,
      ]),
    );
  }

  // 今日現場實收合計
  lines.push(fixedRow(['✦ 今日現場實收合計', '', '', ...new Array(productNames.length).fill(''), formatNT(todayRealTotal), '', '']));

  // 參考數字（A 型 + 通販）
  lines.push(fixedRow(['▸ 參考數字（非今日現場收款，不需對現金）']));
  lines.push(
    fixedRow([
      '預購場外已付（A型，活動前已收）',
      '',
      '',
      ...new Array(productNames.length).fill(''),
      formatNT(preorderARefTotal),
      '',
      `（筆數 ${preorderARefCount}）`,
    ]),
  );
  lines.push(
    fixedRow([
      '通販回填金額（賣貨便等平台，場外收款）',
      '',
      '',
      ...new Array(productNames.length).fill(''),
      formatNT(onlineStoreTotal),
      '',
      `（筆數 ${onlineStoreCount}）`,
    ]),
  );

  // 綜合統計（A 再一次出現在等式中）
  lines.push(fixedRow(['▸ 綜合統計']));
  lines.push(
    fixedRow([
      '所有管道總銷售金額（含場外）',
      '',
      '',
      ...new Array(productNames.length).fill(''),
      formatNT(allTotal),
      '',
      '',
    ]),
  );
  lines.push(fixedRow([`= 現場實收 NT$${todayRealTotal} + 預購場外已付 NT$${preorderARefTotal} + 通販 NT$${onlineStoreTotal}`]));

  return lines.join('\n');
}

export function buildRevenueCsvForEventDate({ eventName, dateKey, transactions }) {
  const cleanEvent = sanitizeEventNameForFile(eventName);
  const compactDate = dateKeyToYYYYMMDD(dateKey);
  return {
    files: [
      {
        filename: `${cleanEvent}_${compactDate}_transactions.csv`,
        csvText: '\uFEFF' + buildTransactionsCsvText({ dateKey, transactions }),
      },
      {
        filename: `${cleanEvent}_${compactDate}_summary.csv`,
        csvText: '\uFEFF' + buildSummaryCsvText({ dateKey, transactions }),
      },
    ],
  };
}

/**
 * Reports 頁面「本日營收摘要」用（完全統一計算邏輯）
 */
export function calcTodayRevenueSummaryForEventDate({ dateKey, transactions }) {
  const txs = (transactions ?? []).filter((t) => t.date === dateKey);

  const saleTxs = txs.filter((t) => calcTxKind(t) === '現場');
  const preorderATxs = txs.filter((t) => calcTxKind(t) === '預購A');
  const preorderBTxs = txs.filter((t) => calcTxKind(t) === '預購B');
  const onlineStoreTxs = txs.filter((t) => calcTxKind(t) === '通販');

  const saleTotal = sumBy(saleTxs, (t) => t.subtotal ?? 0);
  const preorderBTotal = sumBy(preorderBTxs, (t) => t.subtotal ?? 0);
  const todayRealTotal = saleTotal + preorderBTotal;
  const preorderARefTotal = sumBy(preorderATxs, (t) => t.depositAlreadyPaid ?? 0);
  const preorderARefCount = preorderATxs.length;
  const onlineStoreTotal = sumBy(onlineStoreTxs, (t) => t.subtotal ?? 0);
  const onlineStoreCount = onlineStoreTxs.length;
  const allTotal = todayRealTotal + preorderARefTotal + onlineStoreTotal;

  return {
    saleTotal,
    preorderBTotal,
    todayRealTotal,
    preorderARefTotal,
    preorderARefCount,
    onlineStoreTotal,
    onlineStoreCount,
    allTotal,
  };
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvFiles(files) {
  for (const { filename, csvText } of files) {
    downloadCsv(filename, csvText);
  }
}

