import fs from 'node:fs/promises';
import path from 'node:path';

function readUInt16BE(buffer, offset) {
  return (buffer[offset] << 8) | buffer[offset + 1];
}

function parsePng(buffer) {
  return {
    format: 'png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpeg(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    const size = readUInt16BE(buffer, offset);
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      const height = readUInt16BE(buffer, offset + 3);
      const width = readUInt16BE(buffer, offset + 5);
      return {
        format: 'jpeg',
        width,
        height,
      };
    }

    offset += size;
  }

  throw new Error('Nao foi possivel ler dimensoes do JPEG.');
}

function parseWebp(buffer) {
  const signature = buffer.toString('ascii', 12, 16);
  if (signature === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { format: 'webp', width, height };
  }
  if (signature === 'VP8 ') {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { format: 'webp', width, height };
  }
  if (signature === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { format: 'webp', width, height };
  }
  throw new Error('Formato WEBP nao suportado nesta variante.');
}

export async function getImageMetadata(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  let parsed;
  if (extension === '.png') {
    parsed = parsePng(buffer);
  } else if (extension === '.jpg' || extension === '.jpeg') {
    parsed = parseJpeg(buffer);
  } else if (extension === '.webp') {
    parsed = parseWebp(buffer);
  } else {
    throw new Error(`Formato de imagem nao suportado na Etapa 2: ${extension || 'desconhecido'}`);
  }

  return {
    ...parsed,
    bytes: buffer.length,
    aspectRatio: Number((parsed.width / parsed.height).toFixed(4)),
  };
}
