import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const WINS_TABLE = "public.lot_winners";
const AUCTIONS_TABLE = "public.auctions";
const LOTS_TABLE = "public.lots";
const AUCTION_LOTS_TABLE = "public.auction_lots";
const BIDS_TABLE = "public.bids";
const NOTIFS_TABLE = "public.notifications";

function asText(v) {
  return String(v ?? "").trim();
}

async function insertNotification(client, notif) {
  const userId = asText(notif?.userId);
  if (!userId) return;
  await client.query(
    `INSERT INTO ${NOTIFS_TABLE} (user_id, type, title, message, entity_type, entity_id, is_read)
     VALUES ($1,$2,$3,$4,$5,$6,false)`,
    [
      userId,
      asText(notif?.type) || "system",
      asText(notif?.title),
      asText(notif?.message),
      notif?.entityType ? asText(notif.entityType) : null,
      notif?.entityId ? asText(notif.entityId) : null,
    ]
  );
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userId = asText(url.searchParams.get("userId"));
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });

    const pool = getPool();
    const res = await pool.query(
      `SELECT
         w.auction_id,
         a.auction_name,
         w.lot_id,
         l.lot_name,
         w.winning_amount,
         w.decided_at
       FROM ${WINS_TABLE} w
       JOIN ${AUCTIONS_TABLE} a ON a.auction_id = w.auction_id
       JOIN ${LOTS_TABLE} l ON l.lot_id = w.lot_id
       WHERE w.user_id = $1
       ORDER BY w.decided_at DESC`,
      [userId]
    );

    const out = (res.rows ?? []).map((r) => ({
      id: `${asText(r.auction_id)}::${asText(r.lot_id)}`,
      auction: asText(r.auction_name),
      lot: asText(r.lot_name) || asText(r.lot_id),
      winningBid: Number(r.winning_amount ?? 0) || 0,
      status: "payment",
      decidedAt: r.decided_at,
    }));

    return Response.json(out, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Admin: finalize winners for an auction (picks highest bid per lot)
export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const auctionId = asText(body?.auctionId);
    if (!auctionId) return Response.json({ error: "auctionId is required" }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const lotsRes = await client.query(`SELECT lot_id FROM ${AUCTION_LOTS_TABLE} WHERE auction_id = $1`, [auctionId]);
      const lotIds = (lotsRes.rows ?? []).map((r) => asText(r.lot_id)).filter(Boolean);

      const winners = [];
      for (const lotId of lotIds) {
        const top = await client.query(
          `SELECT user_id, amount
           FROM ${BIDS_TABLE}
           WHERE auction_id = $1 AND lot_id = $2
           ORDER BY amount DESC, created_at DESC
           LIMIT 1`,
          [auctionId, lotId]
        );
        const row = top.rows?.[0];
        if (!row) continue;
        const userId = asText(row.user_id);
        const winningAmount = Number(row.amount ?? 0) || 0;
        if (!userId || winningAmount <= 0) continue;

        await client.query(
          `INSERT INTO ${WINS_TABLE} (auction_id, lot_id, user_id, winning_amount)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (auction_id, lot_id)
           DO UPDATE SET user_id = EXCLUDED.user_id,
                         winning_amount = EXCLUDED.winning_amount,
                         decided_at = now()`,
          [auctionId, lotId, userId, winningAmount]
        );

        await insertNotification(client, {
          userId,
          type: "won",
          title: "You won a lot",
          message: `Congratulations! You won lot ${lotId} with bid ${winningAmount}.`,
          entityType: "lot",
          entityId: lotId,
        });

        winners.push({ auctionId, lotId, userId, winningAmount });
      }

      await client.query("COMMIT");
      return Response.json({ ok: true, winners }, { status: 200 });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

