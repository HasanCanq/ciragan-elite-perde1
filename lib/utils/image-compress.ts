// =====================================================
// CLIENT-SIDE GÖRSEL SIKIŞTIRICISI
// Canvas API kullanır — yalnızca tarayıcıda çalışır.
//
// Dönüştürme: herhangi format → WebP
// Max boyut: 1200 × 900 px (en-boy oranı korunur)
// Kalite: %80
// Hardcoded limit: 10 MB üzeri dosyalar reject edilir
// =====================================================

const MAX_WIDTH  = 1200;
const MAX_HEIGHT = 900;
const QUALITY    = 0.8;
const MAX_BYTES  = 10 * 1024 * 1024; // 10 MB

/**
 * Yüklenmeden önce dosyayı 1200×900, WebP %80 kalitede sıkıştırır.
 *
 * @throws Dosya 10 MB'dan büyükse veya görsel okunamazsa Error fırlatır.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Dosya çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum 10 MB yüklenebilir.`);
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Aspect-ratio korunarak ölçekle
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context alınamadı.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Görsel sıkıştırılamadı.'));
            return;
          }

          // Orijinal dosya adını koru, uzantıyı .webp yap
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressed = new File([blob], `${baseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          resolve(compressed);
        },
        'image/webp',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel dosyası okunamadı.'));
    };

    img.src = objectUrl;
  });
}
