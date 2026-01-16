import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const USERS_TABLE = "public.users";

function asText(v) {
  return String(v ?? "").trim();
}

export async function GET() {
  try {
    const pool = getPool();
    const res = await pool.query(
      `SELECT user_id, name, cnic, paa, status, role
       FROM ${USERS_TABLE}
       ORDER BY user_id ASC`
    );

    const users = (res.rows ?? []).map((r) => ({
      id: asText(r.user_id),
      name: asText(r.name),
      cnic: asText(r.cnic),
      paa: asText(r.paa),
      status: asText(r.status) || "Enabled",
      role: asText(r.role) || "Bidder",
    }));

    return Response.json(users, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const id = asText(body?.id ?? body?.userId ?? body?.user_id);
    const name = asText(body?.name);
    const cnic = asText(body?.cnic);
    const paa = asText(body?.paa);
    const status = asText(body?.status) || "Enabled";
    const role = asText(body?.role) || "Bidder";

    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    if (!cnic) return Response.json({ error: "cnic is required" }, { status: 400 });

    await pool.query(
      `INSERT INTO ${USERS_TABLE} (user_id, name, cnic, paa, status, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id)
       DO UPDATE SET name = EXCLUDED.name,
                     cnic = EXCLUDED.cnic,
                     paa = EXCLUDED.paa,
                     status = EXCLUDED.status,
                     role = EXCLUDED.role`,
      [id, name, cnic, paa, status, role]
    );

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

