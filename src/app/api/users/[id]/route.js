import { getPool } from "../../../../../lib/db";

export const runtime = "nodejs";

const USERS_TABLE = "public.users";

function asText(v) {
  return String(v ?? "").trim();
}

async function getParams(ctx) {
  // Next may provide `params` as a Promise in newer versions.
  return await Promise.resolve(ctx?.params);
}

export async function PUT(req, ctx) {
  const params = await getParams(ctx);
  const userId = asText(params?.id);
  if (!userId) return Response.json({ error: "Invalid user id" }, { status: 400 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const name = asText(body?.name);
    const cnic = asText(body?.cnic);
    const paa = asText(body?.paa);
    const status = asText(body?.status) || "Enabled";
    const role = asText(body?.role) || "Bidder";

    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    if (!cnic) return Response.json({ error: "cnic is required" }, { status: 400 });

    const res = await pool.query(
      `UPDATE ${USERS_TABLE}
       SET name = $2, cnic = $3, paa = $4, status = $5, role = $6
       WHERE user_id = $1`,
      [userId, name, cnic, paa, status, role]
    );

    if ((res.rowCount ?? 0) === 0) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const params = await getParams(ctx);
  const userId = asText(params?.id);
  if (!userId) return Response.json({ error: "Invalid user id" }, { status: 400 });

  try {
    const pool = getPool();
    const res = await pool.query(`DELETE FROM ${USERS_TABLE} WHERE user_id = $1`, [userId]);
    if ((res.rowCount ?? 0) === 0) return Response.json({ error: "User not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

