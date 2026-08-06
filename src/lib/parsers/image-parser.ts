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
