import { getPool } from "../../../../../lib/db";

export const runtime = "nodejs";

const NOTIFS_TABLE = "public.notifications";

async function getParams(ctx) {
  return await Promise.resolve(ctx?.params);
}

function asText(v) {
  return String(v ?? "").trim();
}

export async function PUT(req, ctx) {
  const params = await getParams(ctx);
  const id = Number(asText(params?.id));
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid id" }, { status: 400 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const status = asText(body?.status);
    const isRead = status === "read" ? true : status === "unread" ? false : null;
    if (isRead === null) return Response.json({ error: "status must be 'read' or 'unread'" }, { status: 400 });

    const res = await pool.query(
      `UPDATE ${NOTIFS_TABLE} SET is_read = $2 WHERE notification_id = $1 RETURNING notification_id`,
      [id, isRead]
    );
    if ((res.rowCount ?? 0) === 0) return Response.json({ error: "Notification not found" }, { status: 404 });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

