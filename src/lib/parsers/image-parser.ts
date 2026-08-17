/**
 * Utilitaires pour la prise en charge des fichiers image.
 *
 * Ce module fournit :
 *  - la détection du type MIME à partir du magic number (signature binaire),
 *  - la validation qu'un type MIME est supporté par l'agent,
 *  - des helpers de conversion (base64, data URL) pour l'envoi au modèle omni.
 *
 * Les signatures binaires détectées couvrent les formats PNG, JPEG, WebP et GIF,
 * qui sont les formats acceptés par l'API NVIDIA compatible OpenAI Vision.
 */

/**
 * Liste des types MIME d'image supportés par l'agent.
 *
 * `image/jpg` est accepté en plus de `image/jpeg` car il est fréquemment
 * renvoyé par les navigateurs et certains helpers de téléversement.
 */
export const SUPPORTED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
] as const;

/**
 * Détecte le type MIME d'une image à partir de son magic number (signature
 * binaire en début de fichier).
 *
 * Signatures reconnues :
 *  - PNG  : `\x89PNG\r\n\x1a\n` (on vérifie les 4 premiers octets `\x89PNG`).
 *  - JPEG : `\xFF\xD8\xFF`.
 *  - WebP : `RIFF....WEBP` (octets 0-3 = `RIFF`, octets 8-11 = `WEBP`).
 *  - GIF  : `GIF8` (octets 0-3).
 *
 * @param buffer - Le buffer binaire de l'image à identifier.
 * @returns Le type MIME canonical (`image/png`, `image/jpeg`, `image/webp`,
 *          `image/gif`) ou `null` si la signature n'est pas reconnue ou si
 *          le buffer est trop court.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // PNG : \x89 P N G
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 && // P
    buffer[2] === 0x4e && // N
    buffer[3] === 0x47 // G
  ) {
    return 'image/png';
  }

  // JPEG : \xFF \xD8 \xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // GIF : G I F 8
  if (
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 // 8
  ) {
    return 'image/gif';
  }

  // WebP : R I F F . . . . W E B P
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Vérifie qu'un type MIME est supporté par l'agent.
 *
 * La comparaison est insensible à la casse pour des raisons de robustesse
 * (certains clients envoient `IMAGE/PNG`).
 *
 * @param mime - Le type MIME à tester (ex: `image/png`).
 * @returns `true` si le type MIME est dans la liste `SUPPORTED_IMAGE_MIMES`.
 */
export function isSupportedImage(mime: string): boolean {
  if (!mime || typeof mime !== 'string') {
    return false;
  }
  const normalized = mime.toLowerCase().trim();
  return (SUPPORTED_IMAGE_MIMES as readonly string[]).includes(normalized);
}

/**
 * Encode un buffer binaire en chaîne base64.
 *
 * @param buffer - Le buffer à encoder.
 * @returns La représentation base64 (sans préfixe `data:...`).
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Construit une data URL à partir d'un buffer et d'un type MIME.
 *
 * Format produit : `data:<mime>;base64,<base64>`.
 *
 * Cette chaîne est consommée telle quelle par l'API NVIDIA compatible OpenAI
 * Vision (champ `image_url.url`).
 *
 * @param buffer - Le buffer binaire de l'image.
 * @param mime   - Le type MIME de l'image (ex: `image/png`).
 * @returns La data URL complète.
 */
export function buildDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${bufferToBase64(buffer)}`;
}

/**
 * Convertit n'importe quelle page d'un PDF scanné en une image PNG nette
 * grâce à PDF.js + @napi-rs/canvas / Sharp.
 */
export async function convertScannedPdfToPng(
  buffer: Buffer
): Promise<{ buffer: Buffer; mime: string } | null> {
  // 1. Tenter le rendu haute résolution complet de toutes les pages PDF en PNG assemblé
  const canvasRender = await renderPdfPageToPng(buffer);
  if (canvasRender) return canvasRender;

  // 2. Si le canvas échoue, tenter l'extraction binaire directe
  const directScan = extractEmbeddedImageFromPdf(buffer);
  if (directScan) return directScan;

  // 3. Sinon, décoder les objets images du PDF avec PDF.js + Sharp
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;

    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    for (let pageNum = 1; pageNum <= Math.min(doc.numPages, 3); pageNum++) {
      const page = await doc.getPage(pageNum);
      const ops = await page.getOperatorList();
      const objs = page.objs;

      for (let j = 0; j < ops.fnArray.length; j++) {
        const fn = ops.fnArray[j];
        if (
          fn === pdfjs.OPS.paintImageXObject ||
          fn === pdfjs.OPS.paintInlineImageXObject ||
          fn === pdfjs.OPS.paintImageMaskXObject
        ) {
          const imgName = ops.argsArray[j][0];
          const img = objs.get(imgName);
          if (img && img.width > 100 && img.height > 100) {
            let channels: 1 | 3 | 4 = 4;
            if (img.kind === pdfjs.ImageKind.RGB_24BPP) channels = 3;
            else if (img.kind === pdfjs.ImageKind.GRAYSCALE_1BPP) channels = 1;

            if (img.data && img.data.length === img.width * img.height * channels) {
              const pngBuffer = await sharp(Buffer.from(img.data), {
                raw: {
                  width: img.width,
                  height: img.height,
                  channels,
                },
              })
                .png()
                .toBuffer();

              return { buffer: pngBuffer, mime: 'image/png' };
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('convertScannedPdfToPng :', err);
  }

  return null;
}

/**
 * Rendu haute résolution de TOUTES les pages d'un PDF sous forme d'image PNG assemblée
 * via PDF.js + @napi-rs/canvas + Sharp.
 */
export async function renderPdfPageToPng(
  buffer: Buffer
): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;

    let createCanvas: any;
    try {
      const napi = await import('@napi-rs/canvas');
      createCanvas = napi.createCanvas;
    } catch {
      const napi = eval('require')('@napi-rs/canvas');
      createCanvas = napi.createCanvas;
    }

    if (!createCanvas) {
      console.error('renderPdfPageToPng: createCanvas function could not be loaded.');
      return null;
    }

    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    if (!doc.numPages || doc.numPages === 0) return null;

    const maxPages = Math.min(doc.numPages, 6);
    const pageBuffers: Array<{ buffer: Buffer; width: number; height: number }> = [];

    let totalHeight = 0;
    let maxWidth = 0;

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const w = Math.floor(viewport.width);
      const h = Math.floor(viewport.height);

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx as any, viewport }).promise;

      const pagePng = canvas.toBuffer('image/png');
      pageBuffers.push({ buffer: pagePng, width: w, height: h });

      totalHeight += h;
      if (w > maxWidth) maxWidth = w;
    }

    if (pageBuffers.length === 1) {
      return { buffer: pageBuffers[0].buffer, mime: 'image/png' };
    }

    // Stitching vertical de toutes les pages avec Sharp
    const compositeList = [];
    let currentTop = 0;

    for (const pageItem of pageBuffers) {
      compositeList.push({
        input: pageItem.buffer,
        top: currentTop,
        left: 0,
      });
      currentTop += pageItem.height;
    }

    const combinedBuffer = await sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(compositeList)
      .png()
      .toBuffer();

    return { buffer: combinedBuffer, mime: 'image/png' };
  } catch (err) {
    console.error('renderPdfPageToPng error :', err);
    return null;
  }
}

/**

 * Extrait la plus grande image intégrée (JPEG ou PNG) depuis un buffer PDF.
 */
export function extractEmbeddedImageFromPdf(
  buffer: Buffer
): { buffer: Buffer; mime: string } | null {
  if (!buffer || buffer.length < 100) return null;

  let bestJpeg: Buffer | null = null;
  let maxJpegSize = 0;

  let i = 0;
  while (i < buffer.length - 3) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      const start = i;
      let j = start + 3;
      while (j < buffer.length - 1) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          const end = j + 2;
          const len = end - start;
          if (len > maxJpegSize && len > 3000) {
            maxJpegSize = len;
            bestJpeg = buffer.subarray(start, end);
          }
          i = end;
          break;
        }
        j++;
      }
      if (j >= buffer.length - 1) break;
    } else {
      i++;
    }
  }

  if (bestJpeg) {
    return { buffer: bestJpeg, mime: 'image/jpeg' };
  }

  let bestPng: Buffer | null = null;
  let maxPngSize = 0;

  i = 0;
  while (i < buffer.length - 8) {
    if (
      buffer[i] === 0x89 &&
      buffer[i + 1] === 0x50 &&
      buffer[i + 2] === 0x4e &&
      buffer[i + 3] === 0x47
    ) {
      const start = i;
      const iendIndex = buffer.indexOf(Buffer.from([0x49, 0x45, 0x4e, 0x44]), start);
      if (iendIndex !== -1 && iendIndex + 8 <= buffer.length) {
        const end = iendIndex + 8;
        const len = end - start;
        if (len > maxPngSize && len > 3000) {
          maxPngSize = len;
          bestPng = buffer.subarray(start, end);
        }
        i = end;
        continue;
      }
    }
    i++;
  }

  if (bestPng) {
    return { buffer: bestPng, mime: 'image/png' };
  }

  return null;
}
