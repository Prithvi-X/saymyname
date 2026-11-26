import { BadRequestException } from '@nestjs/common';
import { execFile } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import {
  ALLOWED_VOICE_NOTE_MIMES,
  VOICE_NOTE_DEFAULT_MAX_BYTES,
  VOICE_NOTE_MAX_DURATION_SEC,
} from '@saymyname/validation';

const execFileAsync = promisify(execFile);

export function getMaxVoiceNoteBytes(): number {
  const configured = Number(process.env.VOICE_NOTE_MAX_BYTES);
  if (Number.isFinite(configured) && configured >= 64 * 1024 && configured <= 15 * 1024 * 1024) {
    return Math.floor(configured);
  }
  return VOICE_NOTE_DEFAULT_MAX_BYTES;
}

export function getAllowedVoiceNoteMimes(): readonly string[] {
  return ALLOWED_VOICE_NOTE_MIMES;
}

export function normalizeVoiceNoteMime(raw?: string | null): string {
  const clean = (raw || '').split(';')[0].trim().toLowerCase();
  if (clean === 'audio/m4a' || clean === 'audio/x-m4a') return 'audio/mp4';
  if (clean === 'audio/mp3') return 'audio/mpeg';
  if (clean === 'audio/x-wav') return 'audio/wav';
  return clean;
}

export function extensionForVoiceNoteMime(mime: string): string {
  const normalized = normalizeVoiceNoteMime(mime);
  switch (normalized) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
    case 'audio/aac':
      return 'aac';
    default:
      return 'webm';
  }
}

export interface AudioMagicInspection {
  container: 'webm' | 'ogg' | 'mp4' | 'wav' | 'mpeg' | 'aac';
  canonicalMime: string;
}

/**
 * Inspects actual audio container header bytes (never trusts extensions or client MIME claims).
 * Rejects HTML, SVG, scripts, executables, PDFs, and image files.
 */
export function inspectMagicAudioSignature(buffer: Buffer): AudioMagicInspection {
  if (!Buffer.isBuffer(buffer) || buffer.length < 64) {
    throw new BadRequestException('Uploaded voice note is empty or truncated.');
  }

  const headAscii = buffer.subarray(0, 64).toString('utf8').trimStart().toLowerCase();
  if (
    headAscii.startsWith('<html') ||
    headAscii.startsWith('<!doctype') ||
    headAscii.startsWith('<svg') ||
    headAscii.startsWith('<?xml') ||
    headAscii.startsWith('<script')
  ) {
    throw new BadRequestException('Uploaded file is markup/script content, not valid audio.');
  }

  // Reject ELF, PE/EXE, PDF, JPEG, PNG, GIF masquerading as audio
  if (
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) ||
    (buffer[0] === 0x4d && buffer[1] === 0x5a) ||
    buffer.subarray(0, 5).toString('ascii') === '%PDF-' ||
    (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
    buffer.subarray(0, 4).toString('ascii') === 'GIF8'
  ) {
    throw new BadRequestException('Uploaded file signature is not a supported audio format.');
  }

  // WebM / EBML: 0x1A 0x45 0xDF 0xA3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { container: 'webm', canonicalMime: 'audio/webm' };
  }

  // Ogg container: "OggS"
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return { container: 'ogg', canonicalMime: 'audio/ogg' };
  }

  // MP4 / M4A ISO BMFF: "ftyp" at offset 4
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { container: 'mp4', canonicalMime: 'audio/mp4' };
  }

  // WAV RIFF: "RIFF" ... "WAVE"
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { container: 'wav', canonicalMime: 'audio/wav' };
  }

  // MP3 ID3 tag
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    return { container: 'mpeg', canonicalMime: 'audio/mpeg' };
  }

  // Raw ADTS AAC or MPEG frame sync (0xFF 0xF*)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    const isAdtsAac = (buffer[1] & 0xf6) === 0xf0;
    return isAdtsAac
      ? { container: 'aac', canonicalMime: 'audio/aac' }
      : { container: 'mpeg', canonicalMime: 'audio/mpeg' };
  }

  throw new BadRequestException(
    'Uploaded voice note does not match a recognized audio binary signature.',
  );
}

export interface VerifiedVoiceNoteResult {
  detectedMime: string;
  sizeBytes: number;
  durationSeconds: number;
  sha256: string;
}

export async function verifyVoiceNoteBinary(
  buffer: Buffer,
  claimedMime?: string | null,
  claimedDurationSeconds?: number | null,
): Promise<VerifiedVoiceNoteResult> {
  const maxBytes = getMaxVoiceNoteBytes();
  if (!Buffer.isBuffer(buffer) || buffer.length < 64) {
    throw new BadRequestException('Voice note binary is empty or corrupted.');
  }
  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      `Voice note exceeds maximum size limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    );
  }

  if (claimedMime) {
    const cleanClaim = (claimedMime || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_VOICE_NOTE_MIMES.includes(cleanClaim as any)) {
      throw new BadRequestException(`Unsupported voice note MIME type: ${claimedMime}`);
    }
  }

  const magic = inspectMagicAudioSignature(buffer);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-vn-'));
  const ext = extensionForVoiceNoteMime(magic.canonicalMime);
  const tmpFile = path.join(tmpDir, `clip.${ext}`);

  let probedDurationSec: number | null = null;

  try {
    fs.writeFileSync(tmpFile, buffer, { mode: 0o600 });
    const ffprobeBin = process.env.FFPROBE_PATH || 'ffprobe';

    const { stdout } = await execFileAsync(
      ffprobeBin,
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        tmpFile,
      ],
      { timeout: 5000, windowsHide: true, maxBuffer: 512 * 1024 },
    );

    const parsed = JSON.parse(stdout || '{}');
    const streams: any[] = Array.isArray(parsed.streams) ? parsed.streams : [];
    const audioStreams = streams.filter((s) => s?.codec_type === 'audio');
    const videoStreams = streams.filter((s) => s?.codec_type === 'video');

    if (audioStreams.length === 0) {
      throw new BadRequestException('Uploaded file does not contain a valid audio stream.');
    }
    if (videoStreams.length > 0) {
      throw new BadRequestException('Video tracks are not permitted inside voice notes.');
    }

    let rawDuration = Number(
      audioStreams[0]?.duration ?? parsed?.format?.duration ?? NaN,
    );

    // Chromium/Edge MediaRecorder writes live WebM/Ogg streams without container duration headers ("N/A").
    // Fall back to summing decoded audio packet timestamps directly via ffprobe (still 100% server-verified).
    if (!Number.isFinite(rawDuration) || rawDuration <= 0.05) {
      const { stdout: pktStdout } = await execFileAsync(
        ffprobeBin,
        [
          '-v',
          'quiet',
          '-select_streams',
          'a:0',
          '-show_entries',
          'packet=pts_time,dts_time,duration_time',
          '-of',
          'json',
          tmpFile,
        ],
        { timeout: 6000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      );
      const pktParsed = JSON.parse(pktStdout || '{}');
      const packets: any[] = Array.isArray(pktParsed.packets) ? pktParsed.packets : [];
      let maxEnd = 0;
      let totalDur = 0;
      for (const pkt of packets) {
        const dur = Number(pkt?.duration_time ?? 0);
        const ts = Number(pkt?.pts_time ?? pkt?.dts_time ?? NaN);
        if (Number.isFinite(dur) && dur > 0) {
          totalDur += dur;
        }
        if (Number.isFinite(ts) && ts >= 0) {
          maxEnd = Math.max(maxEnd, ts + (Number.isFinite(dur) && dur > 0 ? dur : 0));
        }
      }
      rawDuration = Math.max(maxEnd, totalDur);
    }

    if (!Number.isFinite(rawDuration) || rawDuration <= 0.05) {
      throw new BadRequestException('Uploaded voice note duration could not be verified.');
    }
    if (rawDuration > VOICE_NOTE_MAX_DURATION_SEC + 0.75) {
      throw new BadRequestException(
        `Voice note exceeds maximum ${VOICE_NOTE_MAX_DURATION_SEC}-second limit.`,
      );
    }

    probedDurationSec = Math.max(
      1,
      Math.min(VOICE_NOTE_MAX_DURATION_SEC, Math.round(rawDuration)),
    );
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      throw err;
    }
    if (
      err?.code === 'ENOENT' &&
      process.env.SKIP_FFPROBE_CHECK === 'true' &&
      process.env.NODE_ENV !== 'production'
    ) {
      probedDurationSec = Math.max(
        1,
        Math.min(VOICE_NOTE_MAX_DURATION_SEC, Number(claimedDurationSeconds) || 1),
      );
    } else {
      throw new BadRequestException(
        'Uploaded voice note failed audio container verification and was rejected.',
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return {
    detectedMime: magic.canonicalMime,
    sizeBytes: buffer.length,
    durationSeconds: probedDurationSec,
    sha256,
  };
}
