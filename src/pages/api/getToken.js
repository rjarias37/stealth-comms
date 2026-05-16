import { AccessToken } from 'livekit-server-sdk';

export const prerender = false;

// ─── Constantes de validación ────────────────────────────────────────────────
const USERNAME_MAX = 64;
const ROOM_MAX     = 64;
// Allowlist estricto: alfanumérico, guion, guion-bajo, espacio, punto
const USERNAME_RE  = /^[A-Za-z0-9_\-\. ]+$/;
// Room codes: alfanumérico, guion y guion-bajo únicamente (sin espacios)
const ROOM_RE      = /^[A-Za-z0-9_\-]+$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Evitar cacheo de tokens sensibles
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Sanitiza y valida un username.
 * Retorna { value, error } — error es null si es válido.
 */
function sanitizeUsername(raw) {
  if (typeof raw !== 'string') return { value: '', error: 'username debe ser texto.' };
  const value = raw.trim().slice(0, USERNAME_MAX);
  if (!value) return { value: '', error: 'username no puede estar vacío.' };
  if (!USERNAME_RE.test(value)) {
    return { value: '', error: 'username contiene caracteres no permitidos.' };
  }
  return { value, error: null };
}

/**
 * Sanitiza y valida un room code.
 * Convierte a mayúsculas y aplica allowlist estricto.
 * Retorna { value, error }.
 */
function sanitizeRoomName(raw) {
  if (typeof raw !== 'string') return { value: '', error: 'roomName debe ser texto.' };
  const value = raw.trim().toUpperCase().slice(0, ROOM_MAX);
  if (!value) return { value: '', error: 'roomName no puede estar vacío.' };
  if (!ROOM_RE.test(value)) {
    return { value: '', error: 'roomName contiene caracteres no permitidos (solo A-Z, 0-9, guion, guion-bajo).' };
  }
  return { value, error: null };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST({ request }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, 400);
    }

    const { username, roomName } = body;

    // Sanitización y validación estricta
    const userResult = sanitizeUsername(username);
    if (userResult.error) {
      return jsonResponse({ error: userResult.error }, 400);
    }

    const roomResult = sanitizeRoomName(roomName);
    if (roomResult.error) {
      return jsonResponse({ error: roomResult.error }, 400);
    }

    const cleanedUsername = userResult.value;
    const cleanedRoomName = roomResult.value;

    // Verificar credenciales del servidor
    const apiKey    = import.meta.env.LIVEKIT_API_KEY;
    const apiSecret = import.meta.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return jsonResponse(
        { error: 'Configuración de servidor incompleta. Contacta al administrador.' },
        500,
      );
    }

    // Identidad única (no expone el nombre en bruto como identity)
    const identity    = `op-${crypto.randomUUID().slice(0, 8)}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      name: cleanedUsername,
      ttl: '1h',
    });

    accessToken.addGrant({
      room:         cleanedRoomName,
      roomJoin:     true,
      canPublish:   true,
      canSubscribe: true,
      // Deshabilitar publicación de datos (no necesario para voz)
      canPublishData: false,
    });

    const token = await accessToken.toJwt();

    return jsonResponse({
      token,
      roomName: cleanedRoomName,
      // La identity no incluye el nombre real del usuario — seguridad reforzada
      identity,
    });
  } catch (error) {
    console.error('getToken error:', error);
    return jsonResponse(
      { error: 'No se pudo generar el token de acceso.' },
      500,
    );
  }
}
