import type { APIRoute } from 'astro';
import { AccessToken } from 'livekit-server-sdk';

export const prerender = false;

// Allowlist estricto (igual que el getToken anterior)
const ROOM_RE = /^[A-Za-z0-9_\-]+$/;
const NAME_RE = /^[A-Za-z0-9_\-\. ]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }

    const room = String(body?.room ?? '').trim().slice(0, 64);
    const name = String(body?.name ?? '').trim().slice(0, 64);

    if (!room || !ROOM_RE.test(room)) {
      return json({ error: 'Sala inválida (solo A-Z, a-z, 0-9, guion, guion_bajo).' }, 400);
    }
    if (!name || !NAME_RE.test(name)) {
      return json({ error: 'Nombre inválido.' }, 400);
    }

    const env = import.meta.env as Record<string, string | undefined>;
    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;
    const url = env.PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !url) {
      return json({ error: 'Configuración de LiveKit incompleta.' }, 500);
    }

    const identity = `op-${crypto.randomUUID().slice(0, 8)}`;
    const at = new AccessToken(apiKey, apiSecret, { identity, name, ttl: '2h' });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });

    const token = await at.toJwt();
    return json({ token, url, identity });
  } catch (error) {
    console.error('livekit token error:', error);
    return json({ error: 'No se pudo generar el token.' }, 500);
  }
};
