import exifr from 'exifr';
import * as piexif from 'piexifjs';
import { ExifInfo } from '../types/mediamind';

/**
 * Format decimal latitude & longitude to human-readable DMS/directional string
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

/**
 * Format date/time string or Date object to a clean friendly string
 */
export function formatExifDate(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) {
      // If it's "YYYY:MM:DD HH:MM:SS" format
      if (typeof dateVal === 'string' && dateVal.includes(':')) {
        const parts = dateVal.trim().split(/[\s:]+/);
        if (parts.length >= 6) {
          const parsedDate = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
            parseInt(parts[3], 10),
            parseInt(parts[4], 10),
            parseInt(parts[5], 10)
          );
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
          }
        }
      }
      return String(dateVal);
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(dateVal);
  }
}

/**
 * Format shutter speed / exposure time (e.g. 0.002 -> "1/500s", 2 -> "2s")
 */
export function formatExposureTime(exposureTime?: number | string): string {
  if (!exposureTime) return '';
  const num = typeof exposureTime === 'string' ? parseFloat(exposureTime) : exposureTime;
  if (isNaN(num)) return String(exposureTime);
  if (num >= 1) return `${num}s`;
  const denom = Math.round(1 / num);
  return `1/${denom}s`;
}

/**
 * Extracts and parses rich EXIF, GPS, camera device, and timestamp metadata from an image file/blob.
 */
export async function parseExifFromFile(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<ExifInfo | undefined> {
  try {
    const buffer =
      fileOrBuffer instanceof ArrayBuffer
        ? fileOrBuffer
        : await (fileOrBuffer as Blob).arrayBuffer();

    const rawData = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: false,
    });

    let gpsData: { latitude?: number; longitude?: number } | undefined;
    try {
      gpsData = await exifr.gps(buffer);
    } catch {
      // ignore gps parse error
    }

    if (!rawData && !gpsData) {
      return undefined;
    }

    const data = rawData || {};
    const lat = gpsData?.latitude ?? data.latitude ?? data.GPSLatitude;
    const lon = gpsData?.longitude ?? data.longitude ?? data.GPSLongitude;
    const alt = data.altitude ?? data.GPSAltitude;

    let formattedCoords: string | undefined;
    let mapsUrl: string | undefined;

    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      formattedCoords = formatCoordinates(lat, lon);
      mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    }

    const dateRaw = data.DateTimeOriginal || data.CreateDate || data.DateTime || data.ModifyDate;
    const formattedDate = dateRaw ? formatExifDate(dateRaw) : undefined;

    const make = data.Make ? String(data.Make).trim() : undefined;
    let model = data.Model ? String(data.Model).trim() : undefined;

    // Clean up make prefix if model already contains it (e.g. Make: "Apple", Model: "Apple iPhone 15")
    if (make && model && model.toLowerCase().startsWith(make.toLowerCase())) {
      model = model.slice(make.length).trim();
    }

    const info: ExifInfo = {
      make,
      model,
      lensModel: data.LensModel ? String(data.LensModel).trim() : undefined,
      software: data.Software ? String(data.Software).trim() : undefined,
      dateTimeOriginal: data.DateTimeOriginal ? String(data.DateTimeOriginal) : undefined,
      createDate: data.CreateDate ? String(data.CreateDate) : undefined,
      modifyDate: data.ModifyDate ? String(data.ModifyDate) : undefined,
      formattedDate,
      latitude: lat,
      longitude: lon,
      altitude: alt,
      formattedCoordinates: formattedCoords,
      googleMapsUrl: mapsUrl,
      iso: data.ISO || data.ISOSpeedRatings,
      fNumber: data.FNumber,
      exposureTime: data.ExposureTime ? formatExposureTime(data.ExposureTime) : undefined,
      focalLength: data.FocalLength ? Math.round(data.FocalLength) : undefined,
      flash: data.Flash,
      whiteBalance: data.WhiteBalance,
      imageWidth: data.ImageWidth || data.ExifImageWidth,
      imageHeight: data.ImageHeight || data.ExifImageHeight,
    };

    // Return info if at least one meaningful property is present
    const hasData =
      info.make ||
      info.model ||
      info.formattedDate ||
      info.formattedCoordinates ||
      info.iso ||
      info.fNumber ||
      info.exposureTime;

    return hasData ? info : undefined;
  } catch (err) {
    console.warn('Failed to parse EXIF from image:', err);
    return undefined;
  }
}

/**
 * Extracts metadata segments (APP1..APP15, COM) from a JPEG ArrayBuffer.
 */
export function extractJpegAppSegments(buffer: ArrayBuffer): Uint8Array[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return [];
  }

  const segments: Uint8Array[] = [];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      break;
    }

    // Skip consecutive 0xFF fill bytes
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset++;

    // SOS (Start of Scan) or EOI (End of Image) indicates header section has ended
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    // Standalone markers with no length payload (e.g. RST0..RST7, SOI, TEM)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }

    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2) break;

    const segmentStart = offset - 2; // includes 0xFF and marker
    const segmentEnd = offset + length; // length field includes its own 2 bytes
    if (segmentEnd > bytes.length) break;

    // Collect APP1 (0xE1: Exif, XMP), APP2 (0xE2: ICC Profile), APP13 (0xED: IPTC/Photoshop),
    // and other APPn segments (0xE1..0xEF) or COM (0xFE)
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
      segments.push(bytes.slice(segmentStart, segmentEnd));
    }

    offset = segmentEnd;
  }

  return segments;
}

/**
 * Updates EXIF orientation tag in an APP1 segment to 1 (Normal).
 * This prevents double-rotation since HTML5 Canvas already draws images oriented upright.
 */
export function resetExifOrientation(segment: Uint8Array): Uint8Array {
  if (segment.length < 14 || segment[0] !== 0xff || segment[1] !== 0xe1) {
    return segment;
  }

  // Check 'Exif\0\0' magic string (0x45, 0x78, 0x69, 0x66, 0x00, 0x00)
  if (
    segment[4] !== 0x45 ||
    segment[5] !== 0x78 ||
    segment[6] !== 0x69 ||
    segment[7] !== 0x66 ||
    segment[8] !== 0x00 ||
    segment[9] !== 0x00
  ) {
    return segment;
  }

  const tiffStart = 10;
  if (tiffStart + 8 > segment.length) return segment;

  const isLittleEndian = segment[tiffStart] === 0x49 && segment[tiffStart + 1] === 0x49; // "II"
  const isBigEndian = segment[tiffStart] === 0x4d && segment[tiffStart + 1] === 0x4d; // "MM"

  if (!isLittleEndian && !isBigEndian) {
    return segment;
  }

  const readUint16 = (off: number): number | null => {
    if (off + 2 > segment.length) return null;
    return isLittleEndian
      ? segment[off] | (segment[off + 1] << 8)
      : (segment[off] << 8) | segment[off + 1];
  };

  const readUint32 = (off: number): number | null => {
    if (off + 4 > segment.length) return null;
    return isLittleEndian
      ? (segment[off] |
          (segment[off + 1] << 8) |
          (segment[off + 2] << 16) |
          (segment[off + 3] << 24)) >>>
          0
      : ((segment[off] << 24) |
          (segment[off + 1] << 16) |
          (segment[off + 2] << 8) |
          segment[off + 3]) >>>
          0;
  };

  const writeUint16 = (off: number, val: number): void => {
    if (off + 2 > segment.length) return;
    if (isLittleEndian) {
      segment[off] = val & 0xff;
      segment[off + 1] = (val >> 8) & 0xff;
    } else {
      segment[off] = (val >> 8) & 0xff;
      segment[off + 1] = val & 0xff;
    }
  };

  const ifd0Offset = readUint32(tiffStart + 4);
  if (ifd0Offset === null || tiffStart + ifd0Offset >= segment.length) {
    return segment;
  }

  const numEntries = readUint16(tiffStart + ifd0Offset);
  if (numEntries === null) return segment;

  let entryOffset = tiffStart + ifd0Offset + 2;
  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > segment.length) break;
    const tagId = readUint16(entryOffset);
    if (tagId === 0x0112) {
      // Orientation tag: 0x0112. Set value to 1.
      writeUint16(entryOffset + 8, 1);
      break;
    }
    entryOffset += 12;
  }

  return segment;
}

/**
 * Inserts metadata segments into a target JPEG ArrayBuffer.
 */
export function insertJpegAppSegments(
  targetBuffer: ArrayBuffer,
  segments: Uint8Array[]
): ArrayBuffer {
  if (!segments || segments.length === 0) {
    return targetBuffer;
  }

  const targetBytes = new Uint8Array(targetBuffer);
  if (targetBytes.length < 4 || targetBytes[0] !== 0xff || targetBytes[1] !== 0xd8) {
    return targetBuffer;
  }

  let insertPos = 2;
  if (targetBytes[2] === 0xff && targetBytes[3] === 0xe0) {
    const app0Len = (targetBytes[4] << 8) | targetBytes[5];
    insertPos = 4 + app0Len;
  }

  const totalSegmentLen = segments.reduce((sum, seg) => sum + seg.length, 0);
  const result = new Uint8Array(targetBytes.length + totalSegmentLen);

  result.set(targetBytes.subarray(0, insertPos), 0);
  let curPos = insertPos;
  for (const seg of segments) {
    result.set(seg, curPos);
    curPos += seg.length;
  }
  result.set(targetBytes.subarray(insertPos), curPos);

  return result.buffer;
}

/**
 * Builds an EXIF binary blob from parsed ExifInfo using piexifjs
 */
export function buildExifBytesFromParsed(info: ExifInfo): string | null {
  try {
    const zeroth: Record<number, any> = {};
    const exif: Record<number, any> = {};
    const gps: Record<number, any> = {};

    zeroth[piexif.ImageIFD.Orientation] = 1;

    if (info.make) zeroth[piexif.ImageIFD.Make] = info.make;
    if (info.model) zeroth[piexif.ImageIFD.Model] = info.model;
    if (info.software) zeroth[piexif.ImageIFD.Software] = info.software;

    if (info.dateTimeOriginal) {
      const dt = new Date(info.dateTimeOriginal);
      if (!isNaN(dt.getTime())) {
        const dateStr =
          dt.getUTCFullYear() +
          ':' +
          String(dt.getUTCMonth() + 1).padStart(2, '0') +
          ':' +
          String(dt.getUTCDate()).padStart(2, '0') +
          ' ' +
          String(dt.getUTCHours()).padStart(2, '0') +
          ':' +
          String(dt.getUTCMinutes()).padStart(2, '0') +
          ':' +
          String(dt.getUTCSeconds()).padStart(2, '0');
        zeroth[piexif.ImageIFD.DateTime] = dateStr;
        exif[piexif.ExifIFD.DateTimeOriginal] = dateStr;
        exif[piexif.ExifIFD.DateTimeDigitized] = dateStr;
      }
    }

    if (info.latitude !== undefined && info.longitude !== undefined) {
      const lat = info.latitude;
      const lon = info.longitude;
      gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
      gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat));
      gps[piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? 'E' : 'W';
      gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lon));

      if (info.altitude !== undefined) {
        gps[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(info.altitude) * 100), 100];
        gps[piexif.GPSIFD.GPSAltitudeRef] = info.altitude >= 0 ? 0 : 1;
      }
    }

    if (info.iso) exif[piexif.ExifIFD.ISOSpeedRatings] = info.iso;
    if (info.fNumber) exif[piexif.ExifIFD.FNumber] = [Math.round(info.fNumber * 10), 10];
    if (info.focalLength) exif[piexif.ExifIFD.FocalLength] = [Math.round(info.focalLength * 10), 10];

    const exifObj = { '0th': zeroth, Exif: exif, GPS: gps };
    return piexif.dump(exifObj);
  } catch (err) {
    console.warn('Failed to build EXIF bytes from parsed metadata:', err);
    return null;
  }
}

/**
 * Transfers EXIF, GPS, XMP, and ICC segments from source image into compressed JPEG blob.
 */
export async function preserveExifInJpeg(
  sourceBlobOrBuffer: Blob | File | ArrayBuffer,
  compressedBlob: Blob
): Promise<Blob> {
  try {
    const sourceBuffer =
      sourceBlobOrBuffer instanceof ArrayBuffer
        ? sourceBlobOrBuffer
        : await sourceBlobOrBuffer.arrayBuffer();

    // 1. Try extracting raw JPEG segments directly
    const rawSegments = extractJpegAppSegments(sourceBuffer);
    if (rawSegments.length > 0) {
      const processedSegments = rawSegments.map((seg) => resetExifOrientation(seg));
      const targetBuffer = await compressedBlob.arrayBuffer();
      const mergedBuffer = insertJpegAppSegments(targetBuffer, processedSegments);
      return new Blob([mergedBuffer], { type: 'image/jpeg' });
    }

    // 2. If source was HEIC, PNG, or WebP with EXIF parsed via exifr, synthesize EXIF bytes using piexif
    const parsedInfo = await parseExifFromFile(sourceBuffer);
    if (parsedInfo) {
      const exifBytes = buildExifBytesFromParsed(parsedInfo);
      if (exifBytes) {
        const compressedBuffer = await compressedBlob.arrayBuffer();
        const compressedBytes = new Uint8Array(compressedBuffer);
        let binaryStr = '';
        const chunkSize = 8192;
        for (let i = 0; i < compressedBytes.length; i += chunkSize) {
          const chunk = compressedBytes.subarray(i, i + chunkSize);
          binaryStr += String.fromCharCode.apply(null, chunk as any);
        }
        const updatedBinaryStr = piexif.insert(exifBytes, binaryStr);
        const finalBytes = new Uint8Array(updatedBinaryStr.length);
        for (let i = 0; i < updatedBinaryStr.length; i++) {
          finalBytes[i] = updatedBinaryStr.charCodeAt(i);
        }
        return new Blob([finalBytes], { type: 'image/jpeg' });
      }
    }

    return compressedBlob;
  } catch (err) {
    console.warn('Failed to preserve EXIF metadata in compressed JPEG:', err);
    return compressedBlob;
  }
}
