import Papa from 'papaparse';

const BOM = '\uFEFF';

function normalizeSpaces(value) {
  return String(value ?? '')
    .replace(/\u3000/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase();
}

function decodeWithEncoding(bytes, encoding) {
  return new TextDecoder(encoding, { fatal: false }).decode(bytes);
}

function scoreDecodedText(text) {
  const badMarkers = (text.match(/[�]/g) ?? []).length;
  const mojibakeMarkers = (text.match(/[ÃÂ�]/g) ?? []).length;
  return badMarkers * 8 + mojibakeMarkers * 2;
}

function canDecodeUtf8(bytes) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export async function readCsvFileWithEncoding(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return { text: '', encoding: 'utf-8' };
  }

  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (hasBom) {
    return { text: decodeWithEncoding(bytes, 'utf-8').replace(/^\uFEFF/, ''), encoding: 'utf-8-bom' };
  }

  if (canDecodeUtf8(bytes)) {
    return { text: decodeWithEncoding(bytes, 'utf-8').replace(/^\uFEFF/, ''), encoding: 'utf-8' };
  }

  const candidates = ['big5', 'gbk'];
  const decodedCandidates = candidates.map((encoding) => {
    const text = decodeWithEncoding(bytes, encoding).replace(/^\uFEFF/, '');
    return { encoding, text, score: scoreDecodedText(text) };
  });

  decodedCandidates.sort((a, b) => a.score - b.score);
  const best = decodedCandidates[0];
  return { text: best.text, encoding: best.encoding };
}

export function parseCleanCsv(text) {
  const parsed = Papa.parse(String(text ?? '').replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeSpaces(h),
    transform: (v) => normalizeSpaces(v),
  });

  const fields = Array.isArray(parsed.meta?.fields) ? parsed.meta.fields.map((x) => normalizeSpaces(x)) : [];
  const rows = (Array.isArray(parsed.data) ? parsed.data : [])
    .map((raw) => {
      const row = {};
      for (const [k, v] of Object.entries(raw ?? {})) {
        const key = normalizeSpaces(k);
        if (!key) continue;
        row[key] = normalizeSpaces(v);
      }
      return row;
    })
    .filter((row) => Object.values(row).some((v) => normalizeSpaces(v) !== ''));

  return {
    fields,
    rows,
    errors: parsed.errors ?? [],
  };
}

export function pickField(row, aliases) {
  const aliasMap = new Map(aliases.map((a) => [normalizeKey(a), a]));
  for (const [k, v] of Object.entries(row ?? {})) {
    if (!aliasMap.has(normalizeKey(k))) continue;
    const cleaned = normalizeSpaces(v);
    if (cleaned !== '') return cleaned;
  }
  return '';
}

export function hasRequiredFields(fields, requiredAliasesList) {
  const normalizedFields = new Set((fields ?? []).map((f) => normalizeKey(f)));
  const missing = [];
  for (const aliases of requiredAliasesList) {
    const ok = aliases.some((alias) => normalizedFields.has(normalizeKey(alias)));
    if (!ok) missing.push(aliases[0]);
  }
  return missing;
}

export function buildCsvParseError(label, details = []) {
  const joined = details.filter(Boolean).join('；');
  return joined ? `${label}：${joined}` : label;
}

export function withBom(text) {
  return `${BOM}${String(text ?? '')}`;
}
