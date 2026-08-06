/**
 * Parseur PDF — extrait le texte d'un fichier PDF.
 *
 * Utilise la bibliothèque `pdf-parse` (v2, API basée sur la classe `PDFParse`)
 * pour extraire le texte et les métadonnées d'un PDF fourni sous forme de
 * `Buffer` Node.js.
 *
 * Ce module est destiné à un usage serveur (depuis une route API Next.js).
 */

import { PDFParse } from 'pdf-parse';

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
 * Extrait le texte d'un buffer PDF à l'aide de `pdf-parse` v2.
 *
 * Le flux :
 *  1. On instancie `PDFParse` avec le `Buffer` (la bibliothèque convertit
 *     automatiquement le `Buffer` Node.js en `Uint8Array`).
 *  2. On appelle `getText()` pour récupérer l'intégralité du texte concaténé.
 *  3. On tente (en best-effort) de récupérer les métadonnées via `getInfo()`.
 *  4. On détruit proprement le parser pour libérer la mémoire et le worker.
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

  let parser: PDFParse | null = null;

  try {
    // `pdf-parse` v2 accepte directement un `Buffer` Node.js (converti en
    // `Uint8Array` en interne par le constructeur).
    parser = new PDFParse({ data: buffer });

    // Extraction du texte — `textResult.text` contient toutes les pages
    // concaténées avec un séparateur par défaut.
    const textResult = await parser.getText();

    // Récupération best-effort des métadonnées (titre, auteur, dates, ...).
    // On ne fait pas échouer l'extraction si les métadonnées sont absentes.
    let info: Record<string, unknown> | undefined;
    try {
      const infoResult = await parser.getInfo();
      if (infoResult?.info != null) {
        info = infoResult.info as Record<string, unknown>;
      }
    } catch {
      // Métadonnées indisponibles : on ignore silencieusement.
    }

    const numPages =
      typeof textResult.total === 'number'
        ? textResult.total
        : textResult.pages?.length ?? 0;

    return {
      text: textResult.text ?? '',
      numPages,
      info,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Impossible d'extraire le texte du PDF : ${message}`
    );
  } finally {
    // Libération du worker et des ressources associées.
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Échec de nettoyage non bloquant : on ignore.
      }
    }
  }
}
