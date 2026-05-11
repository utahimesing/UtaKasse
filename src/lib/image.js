function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image.'));
    };
    img.src = url;
  });
}

/**
 * 把圖片轉成 Base64 前先做等比例縮圖（最大寬高 1024px）
 * - 縮圖以維持長寬比例為主
 * - 若原圖已小於限制，仍會重新繪製一次（降低體積的 resize 壓縮行為最穩定）
 */
export async function fileToDataUrl(
  file,
  { maxDimension = 1024, quality = 0.85, outputMime = 'image/jpeg' } = {},
) {
  if (!file) throw new Error('No file.');
  if (!file.type.startsWith('image/')) throw new Error('Unsupported file type.');

  const img = await loadImageFromFile(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const maxSide = Math.max(1, maxDimension);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported.');

  ctx.drawImage(img, 0, 0, outW, outH);

  // PNG 不支援 quality；我們統一輸出 jpeg（仍保留 resize 的體積優勢）
  return canvas.toDataURL(outputMime, quality);
}

export function validateImageFile(file, { maxBytes = 5 * 1024 * 1024 } = {}) {
  if (!file) return { ok: false, reason: 'No file.' };
  if (file.size > maxBytes) return { ok: false, reason: 'Image too large (<5MB).'};
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'Unsupported file type.' };
  return { ok: true };
}

