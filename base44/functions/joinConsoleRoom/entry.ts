import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { room_id } = await req.json().catch(() => ({}));
    if (!room_id || typeof room_id !== 'string') {
      return Response.json({ error: 'room_id is required' }, { status: 400 });
    }

    const room = await base44.asServiceRole.entities.ConsoleRoom.get(room_id).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!room) return Response.json({ error: 'That room no longer exists' }, { status: 404 });
    if (room.host_id === user.id) return Response.json({ error: 'You opened this room' }, { status: 400 });
    if (room.status !== 'open' || room.guest_id) {
      return Response.json({ error: 'Somebody already took that seat' }, { status: 409 });
    }

    const handle =
      user.full_name || (user.email ? String(user.email).split('@')[0] : '') || 'Challenger';

    const updated = await base44.asServiceRole.entities.ConsoleRoom.update(room_id, {
      guest_id: user.id,
      guest_handle: handle,
      status: 'matched',
    });

    return Response.json({ room: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}