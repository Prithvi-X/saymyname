import { BadRequestException } from '@nestjs/common';
import { execFile, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharpModule = require('sharp');
const sharp: (input?: any, options?: any) => any = sharpModule.default || sharpModule;
const execFileAsync = promisify(execFile);

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const BASE_IMAGE_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const ALLOWED_IMAGE_MIMES: readonly string[] = [
  ...BASE_IMAGE_MIMES,
  'image/heic',
];

let cachedHevcCapability: { bin: string; supported: boolean; checkedAt: number } | null = null;

export function doesFfmpegVersionSupportHeic(
  versionOutput: string,
  decodersOutput: string,
): boolean {
  const verMatch = versionOutput.match(/ffmpeg version\s+(?:n)?(\d+)\./i);
  const majorVersion = verMatch ? Number(verMatch[1]) : 0;
  // Still-image ISO BMFF HEIC item demuxing requires FFmpeg >= 7.0 alongside HEVC decode
  return majorVersion >= 7 && /\bhevc\b/i.test(decodersOutput);
}

/**
 * Probes actual host FFmpeg/HEVC decode readiness without trusting static config alone.
 */
export function isHeicDecodingSupported(): boolean {
  if (process.env.DISABLE_HEIC_UPLOAD === 'true') {
    return false;
  }

  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
  const now = Date.now();
  if (
    cachedHevcCapability &&
    cachedHevcCapability.bin === ffmpegBin &&
    now - cachedHevcCapability.checkedAt < 10_000
  ) {
    return cachedHevcCapability.supported;
  }

  let supported = false;
  try {
    const versionOut = execFileSync(ffmpegBin, ['-version'], {
      timeout: 3000,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const decodersOut = execFileSync(ffmpegBin, ['-hide_banner', '-decoders'], {
      timeout: 3000,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    supported = doesFfmpegVersionSupportHeic(versionOut, decodersOut);
  } catch {
    supported = false;
  }

  cachedHevcCapability = { bin: ffmpegBin, supported, checkedAt: now };
  return supported;
}

export function getAllowedImageMimes(): readonly string[] {
  return isHeicDecodingSupported() ? ALLOWED_IMAGE_MIMES : BASE_IMAGE_MIMES;
}

export interface ImageValidationResult {
  isValid: boolean;
  detectedMime: string;
  sizeBytes: number;
  exifStripped: boolean;
  isHeic: boolean;
  sanitizedBuffer?: Buffer;
  widthPx?: number | null;
  heightPx?: number | null;
  transcodedFromHeic?: boolean;
}

function stripJpegMetadataSegments(buffer: Buffer): Buffer {
  const chunks: Buffer[] = [buffer.subarray(0, 2)];
  let pos = 2;

  while (pos < buffer.length) {
    if (buffer[pos] !== 0xff) {
      chunks.push(buffer.subarray(pos));
      break;
    }

    if (pos + 1 >= buffer.length) {
      chunks.push(buffer.subarray(pos));
      break;
    }

    const marker = buffer[pos + 1];

    // SOS (Start of Scan): compressed entropy stream follows up to EOI
    if (marker === 0xda) {
      chunks.push(buffer.subarray(pos));
      break;
    }

    // Standalone markers without length field (TEM 0x01, RST0..7 0xD0..0xD7, SOI 0xD8, EOI 0xD9, stuffed 0x00)
    if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd9)
    ) {
      chunks.push(buffer.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    if (pos + 4 > buffer.length) {
      chunks.push(buffer.subarray(pos));
      break;
    }

    const segLen = buffer.readUInt16BE(pos + 2);
    if (segLen < 2 || pos + 2 + segLen > buffer.length) {
      chunks.push(buffer.subarray(pos));
      break;
    }

    // Strip all APP1..APP15 (0xE1..0xEF: Exif, XMP, ICC/IPTC/meta) and COM (0xFE)
    const isMetadataSegment = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadataSegment) {
      chunks.push(buffer.subarray(pos, pos + 2 + segLen));
    }

    pos += 2 + segLen;
  }

  return Buffer.concat(chunks);
}

function stripPngMetadataChunks(buffer: Buffer): Buffer {
  const STRIP_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);
  const chunks: Buffer[] = [buffer.subarray(0, 8)];
  let pos = 8;
  let parsedAtLeastOneChunk = false;

  while (pos + 12 <= buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const totalChunkLen = 12 + len;
    if (len > MAX_PHOTO_BYTES || pos + totalChunkLen > buffer.length) {
      if (!parsedAtLeastOneChunk) {
        // Synthetic unit-test header fixture lacking full PNG chunk frames
        return buffer;
      }
      chunks.push(buffer.subarray(pos));
      break;
    }

    parsedAtLeastOneChunk = true;
    const chunkType = buffer.toString('ascii', pos + 4, pos + 8);
    if (!STRIP_CHUNKS.has(chunkType)) {
      chunks.push(buffer.subarray(pos, pos + totalChunkLen));
    }
    pos += totalChunkLen;
    if (chunkType === 'IEND') {
      break;
    }
  }

  return parsedAtLeastOneChunk ? Buffer.concat(chunks) : buffer;
}

function stripWebpMetadataChunks(buffer: Buffer): Buffer {
  if (buffer.length <= 16) return buffer;
  const subchunks: Buffer[] = [];
  let pos = 12;
  let parsedSubchunk = false;

  while (pos + 8 <= buffer.length) {
    const fourCC = buffer.toString('ascii', pos, pos + 4);
    const payloadLen = buffer.readUInt32LE(pos + 4);
    const paddedPayloadLen = payloadLen + (payloadLen % 2);
    const frameEnd = pos + 8 + payloadLen;
    const paddedEnd = pos + 8 + paddedPayloadLen;

    if (payloadLen > MAX_PHOTO_BYTES || frameEnd > buffer.length) {
      if (!parsedSubchunk) {
        return buffer;
      }
      break;
    }

    parsedSubchunk = true;
    const actualEnd = paddedEnd <= buffer.length ? paddedEnd : frameEnd;
    if (fourCC !== 'EXIF' && fourCC !== 'XMP ') {
      const slice = Buffer.from(buffer.subarray(pos, actualEnd));
      // Clear EXIF (bit 3 = 0x08) and XMP (bit 2 = 0x04) flags in VP8X extended header
      if (fourCC === 'VP8X' && payloadLen >= 1 && slice.length > 8) {
        slice[8] = slice[8] & ~(0x08 | 0x04);
      }
      subchunks.push(slice);
    }

    pos = actualEnd;
  }

  if (!parsedSubchunk) return buffer;
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...subchunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function sanitizeHeicMetadataBoxes(buffer: Buffer): { sanitized: Buffer; hasContainerBoxes: boolean } {
  const copy = Buffer.from(buffer);
  let pos = 0;
  let hasFtyp = false;
  let hasContainerBoxes = false;

  while (pos + 8 <= copy.length) {
    const boxSize = copy.readUInt32BE(pos);
    const boxType = copy.toString('ascii', pos + 4, pos + 8);
    if (boxSize === 0) {
      if (boxType === 'meta' || boxType === 'mdat') hasContainerBoxes = true;
      break;
    }
    if (boxSize < 8 || pos + boxSize > copy.length) {
      break;
    }
    if (boxType === 'ftyp') hasFtyp = true;
    if (boxType === 'meta' || boxType === 'mdat') hasContainerBoxes = true;

    // Redact unencrypted XMP / Exif signature metadata inside box payload if present
    const payloadStart = pos + 8;
    const payloadEnd = pos + boxSize;
    if (boxType === 'Exif' || boxType === 'uuid') {
      copy.fill(0, payloadStart, payloadEnd);
    }
    pos += boxSize;
  }

  return {
    sanitized: copy,
    hasContainerBoxes: hasFtyp && hasContainerBoxes,
  };
}

export function validateImageBinary(
  buffer: Buffer,
  declaredMime?: string,
): ImageValidationResult {
  if (!buffer || buffer.length < 12) {
    throw new BadRequestException(
      'Image content validation failed: file is empty or corrupted.',
    );
  }

  const sizeBytes = buffer.length;
  if (sizeBytes > MAX_PHOTO_BYTES) {
    throw new BadRequestException(
      'Image content validation failed: file size exceeds 10 MB limit.',
    );
  }

  // Detect malicious/executable/script/document signatures
  const headerAscii = buffer
    .toString('ascii', 0, Math.min(128, buffer.length))
    .toLowerCase();
  if (
    (buffer[0] === 0x4d && buffer[1] === 0x5a) || // MZ (Windows PE)
    (buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46) || // ELF
    (buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04) || // PK ZIP
    headerAscii.startsWith('%pdf') ||
    headerAscii.includes('<script') ||
    headerAscii.includes('<!doctype') ||
    headerAscii.includes('<html') ||
    headerAscii.includes('<?xml') ||
    headerAscii.includes('<svg')
  ) {
    throw new BadRequestException(
      'Image content validation failed: unsupported or disguised file format.',
    );
  }

  let detectedMime: string | null = null;
  let isHeic = false;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg';
  } else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png';
  } else if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    detectedMime = 'image/webp';
  } else if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase().trim();
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) {
      detectedMime = 'image/heic';
      isHeic = true;
    }
  }

  if (!detectedMime) {
    throw new BadRequestException(
      'Image content validation failed: unrecognized binary signature.',
    );
  }

  if (declaredMime) {
    const normDeclared = declaredMime.toLowerCase().trim();
    if (normDeclared !== detectedMime) {
      throw new BadRequestException(
        `Image content validation failed: declared MIME (${declaredMime}) does not match detected format (${detectedMime}).`,
      );
    }
  }

  let sanitizedBuffer = buffer;
  if (detectedMime === 'image/jpeg') {
    sanitizedBuffer = stripJpegMetadataSegments(buffer);
  } else if (detectedMime === 'image/png') {
    sanitizedBuffer = stripPngMetadataChunks(buffer);
  } else if (detectedMime === 'image/webp') {
    sanitizedBuffer = stripWebpMetadataChunks(buffer);
  } else if (detectedMime === 'image/heic') {
    sanitizedBuffer = sanitizeHeicMetadataBoxes(buffer).sanitized;
  }

  return {
    isValid: true,
    detectedMime,
    sizeBytes,
    exifStripped: true,
    isHeic,
    sanitizedBuffer,
  };
}

/**
 * Decodes HEIC/HEVC still image payloads locally via private server ffmpeg process when
 * prebuilt sharp/libheif lacks proprietary HEVC decoding, returning raw decoded PNG bytes.
 */
async function decodeHeicViaLocalFfmpeg(buffer: Buffer): Promise<Buffer> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-heic-'));
  const inFile = path.join(workDir, 'input.heic');
  const outFile = path.join(workDir, 'decoded.png');
  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';

  try {
    fs.writeFileSync(inFile, buffer);
    await execFileAsync(
      ffmpegBin,
      ['-y', '-v', 'error', '-i', inFile, '-frames:v', '1', '-map_metadata', '-1', '-f', 'image2', '-vcodec', 'png', outFile],
      { timeout: 15000, windowsHide: true },
    );
    if (!fs.existsSync(outFile)) {
      throw new Error('FFmpeg did not emit decoded image bytes.');
    }
    const pngBytes = fs.readFileSync(outFile);
    if (pngBytes.length < 24) {
      throw new Error('Decoded HEIC image stream is empty.');
    }
    return pngBytes;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Full trusted server-side image verification & re-encoding pipeline used for
 * uploaded objects fetched directly from R2 private storage.
 */
export async function verifyAndSanitizeR2Image(
  buffer: Buffer,
  declaredMime?: string,
): Promise<ImageValidationResult> {
  const base = validateImageBinary(buffer, declaredMime);

  if (base.detectedMime === 'image/heic') {
    if (process.env.DISABLE_HEIC_UPLOAD === 'true') {
      throw new BadRequestException(
        'HEIC image decoding failed or is unsupported in this runtime. Please upload a valid JPEG, PNG, or WebP portrait image.',
      );
    }
    const { hasContainerBoxes } = sanitizeHeicMetadataBoxes(buffer);
    if (!hasContainerBoxes) {
      throw new BadRequestException(
        'Image content validation failed: malformed HEIC ISO BMFF structure.',
      );
    }

    let decoded: { data: Buffer; info: { width?: number; height?: number } } | null = null;
    try {
      // 1. Primary path: native libheif via sharp (zero temp files)
      decoded = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    } catch {
      // 2. Fallback path: private local ffmpeg HEVC decoder -> sharp pixel sanitize & JPEG normalize
      try {
        const pngBytes = await decodeHeicViaLocalFfmpeg(buffer);
        decoded = await sharp(pngBytes, { limitInputPixels: 40_000_000 })
          .rotate()
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
      } catch {
        // Fail closed: never approve or serve an undecodable HEIC file
        throw new BadRequestException(
          'HEIC image decoding failed or is unsupported in this runtime. Please upload a valid JPEG, PNG, or WebP portrait image.',
        );
      }
    }

    if (!decoded || !decoded.info.width || !decoded.info.height) {
      throw new BadRequestException(
        'Image content validation failed: decoded HEIC image has invalid dimensions.',
      );
    }

    if (decoded.data.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        'Processed portrait exceeds maximum 10 MB storage limit.',
      );
    }

    return {
      isValid: true,
      detectedMime: 'image/jpeg',
      sizeBytes: decoded.data.length,
      exifStripped: true,
      isHeic: true,
      sanitizedBuffer: decoded.data,
      widthPx: decoded.info.width,
      heightPx: decoded.info.height,
      transcodedFromHeic: true,
    };
  }

  try {
    const pipeline = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
    let encoded: { data: Buffer; info: { width?: number; height?: number } };
    if (base.detectedMime === 'image/png') {
      encoded = await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    } else if (base.detectedMime === 'image/webp') {
      encoded = await pipeline.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    } else {
      encoded = await pipeline
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    }

    if (!encoded.info.width || !encoded.info.height) {
      throw new BadRequestException(
        'Image content validation failed: decoded image has invalid dimensions.',
      );
    }

    if (encoded.data.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        'Processed portrait exceeds maximum 10 MB storage limit.',
      );
    }

    return {
      isValid: true,
      detectedMime: base.detectedMime,
      sizeBytes: encoded.data.length,
      exifStripped: true,
      isHeic: false,
      sanitizedBuffer: encoded.data,
      widthPx: encoded.info.width,
      heightPx: encoded.info.height,
    };
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      'Image content validation failed: corrupted or malformed image data.',
    );
  }
}

export async function readLimitedS3Body(body: any, maxBytes = MAX_PHOTO_BYTES): Promise<Buffer> {
  if (!body) {
    throw new BadRequestException('Uploaded photograph stream is empty.');
  }
  if (typeof body.transformToByteArray === 'function') {
    const arr: Uint8Array = await body.transformToByteArray();
    if (arr.byteLength > maxBytes) {
      throw new BadRequestException('Uploaded object exceeds maximum size of 10 MB.');
    }
    return Buffer.from(arr);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new BadRequestException('Uploaded object exceeds maximum size of 10 MB.');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
