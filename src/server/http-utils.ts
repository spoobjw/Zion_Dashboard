import http from 'node:http';
import os from 'node:os';

export function sendJson(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

export function sendError(res: http.ServerResponse, message: string, status = 400) {
  sendJson(res, { error: message }, status);
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: http.IncomingMessage,
  maxBytes = 15 * 1024 * 1024
): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > maxBytes) {
      throw new Error('Request payload exceeds maximum allowed size.');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

export function isAllowedTailscaleOrLanIp(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const ip = remoteAddress.replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  // Tailscale CGNAT 100.64.0.0/10 (100.64.x.x - 100.127.x.x)
  const m = /^100\.(\d+)\./.exec(ip);
  if (m) {
    const second = Number(m[1]);
    if (second >= 64 && second <= 127) return true;
  }
  // Tailscale IPv6 fd7a:115c:a1e0::/48
  if (ip.toLowerCase().startsWith('fd7a:115c:a1e0:')) return true;
  return false;
}

export function getNetworkAddresses(port: number): { lan: string[]; tailscale: string[] } {
  const interfaces = os.networkInterfaces();
  const lan: string[] = [];
  const tailscale: string[] = [];
  for (const list of Object.values(interfaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.internal || iface.family !== 'IPv4') continue;
      if (iface.address.startsWith('100.')) {
        tailscale.push(`http://${iface.address}:${port}`);
      } else {
        lan.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return { lan, tailscale };
}
