const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/**
 * 把使用者選的圖片轉成可嵌入 PDF 的 JPEG data URL。
 * 統一轉 JPEG 是因為 react-pdf 只支援 JPG/PNG(webp/HEIC 會失敗),
 * 縮到最長邊 2000px 避免 payload 過大。
 */
export async function fileToCoverDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("請選擇圖片檔(JPG、PNG、WebP 都可以)");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("圖片讀取失敗，請換一張試試");
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("瀏覽器不支援 canvas，無法處理封面圖片");
    }

    // JPEG 沒有透明度,PNG 透明區域先鋪白底避免變黑
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
