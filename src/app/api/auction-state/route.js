import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const STATE_TABLE = "public.auction_state";

function asText(v) {
  return String(v ?? "").trim();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const auctionId = asText(url.searchParams.get("auctionId"));

    const pool = getPool();
    if (auctionId) {
      const res = await pool.query(
        `SELECT auction_id, status, active_lot_id, bid_ends_at, updated_at
         FROM ${STATE_TABLE}
         WHERE auction_id = $1`,
        [auctionId]
      );
      return Response.json(res.rows?.[0] ?? null, { status: 200 });
    }

    const res = await pool.query(
      `SELECT auction_id, status, active_lot_id, bid_ends_at, updated_at
       FROM ${STATE_TABLE}
       ORDER BY updated_at DESC`
    );
    return Response.json(res.rows ?? [], { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const auctionId = asText(body?.auctionId);
    if (!auctionId) return Response.json({ error: "auctionId is required" }, { status: 400 });

    const status = asText(body?.status) || "scheduled";
    const activeLotId = body?.activeLotId ? asText(body.activeLotId) : null;
    const bidEndsAt = body?.bidEndsAt ? new Date(String(body.bidEndsAt)) : null;
    const bidEndsAtValue = bidEndsAt && !Number.isNaN(bidEndsAt.getTime()) ? bidEndsAt.toISOString() : null;

    await pool.query(
      `INSERT INTO ${STATE_TABLE} (auction_id, status, active_lot_id, bid_ends_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (auction_id)
       DO UPDATE SET status = EXCLUDED.status,
                     active_lot_id = EXCLUDED.active_lot_id,
                     bid_ends_at = EXCLUDED.bid_ends_at`,
      [auctionId, status, activeLotId, bidEndsAtValue]
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

