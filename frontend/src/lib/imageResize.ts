// Resizes an uploaded image to fit within a max dimension and re-encodes
// as JPEG. Pure browser API — no deps. The server still validates byte
// length, magic bytes, and content type independently; client resize is
// convenience, not security.

const MAX_DIMENSION = 400;
const JPEG_QUALITY = 0.85;

export type ResizedImage = {
  dataUrl: string;
  approxBytes: number;
};

export async function resizeImage(file: File): Promise<ResizedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pick an image file (JPEG or PNG).');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scale(bitmap.width, bitmap.height, MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser cannot resize images right now.');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return { dataUrl, approxBytes: estimateBytes(dataUrl) };
  } finally {
    bitmap.close();
  }
}

function scale(
  srcWidth: number,
  srcHeight: number,
  maxDim: number,
): { width: number; height: number } {
  if (srcWidth <= maxDim && srcHeight <= maxDim) {
    return { width: srcWidth, height: srcHeight };
  }
  const ratio = Math.min(maxDim / srcWidth, maxDim / srcHeight);
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio),
  };
}

function estimateBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.floor(base64.length * 0.75);
}
