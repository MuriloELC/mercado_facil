import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { extname } from 'path';
import jsQR from 'jsqr';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { parseNfceReference, NfceReference } from './nfce-reference.util';

@Injectable()
export class NfceExtractionService {
  async extractReferenceFromImage(
    imagePath: string,
    ocrHintText?: string,
  ): Promise<{ reference: NfceReference | null; diagnostics: Record<string, unknown> }> {
    const diagnostics: Record<string, unknown> = {
      imagePath,
      qrAttempted: true,
      ocrFallbackAttempted: true,
    };

    const qr = this.tryDecodeQr(imagePath);
    if (qr) {
      const parsed = parseNfceReference(qr.data);
      if (parsed) {
        return {
          reference: {
            ...parsed,
            method: 'qr',
            raw: qr.data,
          },
          diagnostics: {
            ...diagnostics,
            qrDecoded: true,
          },
        };
      }

      // QR decoded but not in known pattern.
      return {
        reference: {
          type: 'qrcode',
          value: qr.data,
          method: 'qr',
          raw: qr.data,
        },
        diagnostics: {
          ...diagnostics,
          qrDecoded: true,
          qrPatternRecognized: false,
        },
      };
    }

    const rawBuffer = readFileSync(imagePath);
    const rawTextCandidate = rawBuffer.toString('latin1');

    const candidates = [ocrHintText ?? '', rawTextCandidate].filter(Boolean);
    for (const candidate of candidates) {
      const parsed = parseNfceReference(candidate);
      if (parsed) {
        return {
          reference: {
            ...parsed,
            method: 'ocr',
          },
          diagnostics: {
            ...diagnostics,
            qrDecoded: false,
            ocrFallbackMatched: true,
          },
        };
      }
    }

    return {
      reference: null,
      diagnostics: {
        ...diagnostics,
        qrDecoded: false,
        ocrFallbackMatched: false,
      },
    };
  }

  private tryDecodeQr(imagePath: string): { data: string } | null {
    try {
      const extension = extname(imagePath).toLowerCase();
      const imageBuffer = readFileSync(imagePath);

      if (extension === '.png') {
        const png = PNG.sync.read(imageBuffer);
        const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        if (code?.data) {
          return { data: code.data };
        }
      }

      if (['.jpg', '.jpeg'].includes(extension)) {
        const decoded = jpeg.decode(imageBuffer, {
          useTArray: true,
          formatAsRGBA: true,
        });
        const code = jsQR(
          new Uint8ClampedArray(decoded.data),
          decoded.width,
          decoded.height,
        );
        if (code?.data) {
          return { data: code.data };
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}
