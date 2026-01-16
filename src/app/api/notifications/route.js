import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const NOTIFS_TABLE = "public.notifications";

function asText(v) {
  return String(v ?? "").trim();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userId = asText(url.searchParams.get("userId"));
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });

    const pool = getPool();
    const res = await pool.query(
      `SELECT notification_id, type, title, message, entity_type, entity_id, is_read, created_at
       FROM ${NOTIFS_TABLE}
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId]
    );

    const out = (res.rows ?? []).map((r) => ({
      id: String(r.notification_id),
      type: asText(r.type),
      title: asText(r.title),
      message: asText(r.message),
      entityType: r.entity_type ? asText(r.entity_type) : null,
      entityId: r.entity_id ? asText(r.entity_id) : null,
      status: r.is_read ? "read" : "unread",
      date: r.created_at ? String(r.created_at).slice(0, 10) : "",
      createdAt: r.created_at,
    }));

    return Response.json(out, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

