import { AccessToken } from 'livekit-server-sdk';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeUsername(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 64);
}

function sanitizeRoomName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 64);
}

export async function POST({ request }) {
  try {
    const { username, roomName } = await request.json();
    const cleanedUsername = sanitizeUsername(username);
    const cleanedRoomName = sanitizeRoomName(roomName);

    if (!cleanedUsername) {
      return jsonResponse(
        { error: 'username es obligatorio y debe ser un texto valido.' },
        400,
      );
    }

    if (!cleanedRoomName) {
      return jsonResponse(
        { error: 'roomName es obligatorio y debe ser un texto valido.' },
        400,
      );
    }

    const apiKey = import.meta.env.LIVEKIT_API_KEY;
    const apiSecret = import.meta.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return jsonResponse(
        {
          error:
            'Faltan LIVEKIT_API_KEY o LIVEKIT_API_SECRET en las variables de entorno.',
        },
        500,
      );
    }

    const identity = `${cleanedUsername}-${crypto.randomUUID().slice(0, 8)}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      name: cleanedUsername,
      ttl: '1h',
    });

    accessToken.addGrant({
      room: cleanedRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await accessToken.toJwt();

    return jsonResponse({
      token,
      roomName: cleanedRoomName,
      identity,
      name: cleanedUsername,
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return jsonResponse(
      { error: 'No se pudo generar el token de LiveKit.' },
      500,
    );
  }
}
