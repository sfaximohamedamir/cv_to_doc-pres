/**
 * Parseur PDF — extrait le texte d'un fichier PDF.
 *
 * Utilise la bibliothèque `pdf-parse` (v1.1.1) pour extraire le texte et les
 * métadonnées d'un PDF fourni sous forme de `Buffer` Node.js.
 *
 * Ce module est destiné à un usage serveur (depuis une route API Next.js).
 */

import pdfParse from 'pdf-parse';

/**
 * Résultat de l'extraction PDF.
 */
export interface PdfParseResult {
  /** Texte intégral extrait du PDF (toutes pages concaténées). */
  text: string;
  /** Nombre total de pages du PDF. */
  numPages: number;
  /** Métadonnées du PDF (titre, auteur, dates, ...) telles que renvoyées par PDF.js. */
  info?: Record<string, unknown>;
}

/**
 * Seuil minimal de longueur de texte pour considérer qu'un PDF contient du
 * texte sélectionnable (et non pas uniquement une image scannée).
 *
 * En dessous de ce seuil, on considère que le PDF est probablement scanné
 * et qu'il faudra passer par le modèle omni sur une image rendue.
 */
export const MIN_SUBSTANTIAL_TEXT_LENGTH = 200;

/**
 * Extrait le texte d'un buffer PDF à l'aide de `pdf-parse`.
 *
 * @param buffer - Le contenu binaire du fichier PDF.
 * @returns Un objet `PdfParseResult` contenant le texte, le nombre de pages
 *          et (optionnellement) les métadonnées.
 * @throws {Error} Si l'extraction échoue (PDF corrompu, illisible, etc.),
 *                 avec un message d'erreur en français.
 */
export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error(
      "Impossible d'analyser un PDF vide ou non défini (buffer vide)."
    );
  }

  // Vérification rapide du magic number PDF ("%PDF-").
  if (
    buffer.length >= 5 &&
    !(
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2d // -
    )
  ) {
    throw new Error(
      "Le fichier fourni n'est pas un PDF valide (en-tête « %PDF- » manquant)."
    );
  }

  try {
    const data = await pdfParse(buffer);

    return {
      text: data.text ?? '',
      numPages: data.numpages ?? 0,
      info: (data.info as Record<string, unknown>) ?? undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Impossible d'extraire le texte du PDF : ${message}`
    );
  }
}
