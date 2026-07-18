/**
 * Pemrosesan foto profil di sisi client sebelum diunggah:
 * crop tengah 1:1 → resize maks 512×512 → WebP (fallback JPEG) →
 * turunkan kualitas bertahap hingga di bawah target ukuran.
 */

const MAX_DIM = 512;
/** Target ideal ukuran akhir. */
export const AVATAR_TARGET_BYTES = 150 * 1024;
/** Batas keras — di atas ini upload ditolak. */
export const AVATAR_MAX_BYTES = 300 * 1024;
/** Batas ukuran berkas sumber yang masih masuk akal untuk diproses. */
export const AVATAR_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

export class ImageProcessError extends Error {}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageProcessError('Berkas bukan gambar yang valid.'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Proses berkas gambar menjadi foto profil siap unggah.
 * Mengembalikan Blob (image/webp bila didukung browser, selain itu JPEG).
 */
export async function processAvatarImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new ImageProcessError('Pilih berkas gambar (JPG, PNG, atau WebP).');
  }
  if (file.size > AVATAR_SOURCE_MAX_BYTES) {
    throw new ImageProcessError('Berkas gambar terlalu besar (maksimal 20 MB).');
  }
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (side < 32) throw new ImageProcessError('Resolusi gambar terlalu kecil (min. 32×32 px).');
  const size = Math.min(side, MAX_DIM);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageProcessError('Perangkat tidak mendukung pemrosesan gambar.');
  ctx.imageSmoothingQuality = 'high';
  // Crop tengah 1:1
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  // WebP bila didukung; deteksi lewat hasil aktual (Safari lama menghasilkan PNG).
  const webpProbe = await toBlob(canvas, 'image/webp', 0.9);
  const useWebp = webpProbe !== null && webpProbe.type === 'image/webp';
  const mime = useWebp ? 'image/webp' : 'image/jpeg';

  let best: Blob | null = null;
  for (const quality of [0.86, 0.78, 0.68, 0.58, 0.48, 0.38]) {
    const blob = await toBlob(canvas, mime, quality);
    if (!blob) continue;
    best = blob;
    if (blob.size <= AVATAR_TARGET_BYTES) break;
  }
  if (!best) throw new ImageProcessError('Gagal memproses gambar.');
  if (best.size > AVATAR_MAX_BYTES) {
    throw new ImageProcessError('Foto masih melebihi 300 KB setelah kompresi — gunakan gambar lain.');
  }
  return best;
}
