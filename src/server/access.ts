import { createHash, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';

export function checkAccess(remoteAddress: string | undefined, authorization: string | undefined, password = process.env.ZION_ACCESS_PASSWORD): boolean {
  const ip = remoteAddress?.replace(/^::ffff:/, '');
  if (!password) return ip === '127.0.0.1' || ip === '::1';
  if (!authorization?.startsWith('Basic ')) return false;
  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const expected = `zion:${password}`;
  return timingSafeEqual(createHash('sha256').update(credentials).digest(), createHash('sha256').update(expected).digest());
}

export function checkRequestOrigin(req: Pick<http.IncomingMessage, 'headers' | 'method'>): boolean {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
  } catch { return false; }
}
