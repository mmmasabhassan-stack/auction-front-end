import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const AUCTIONS_TABLE = "public.auctions";
const AUCTION_LOTS_TABLE = "public.auction_lots";
const LOTS_TABLE = "public.lots";
const USERS_TABLE = "public.users";
const NOTIFS_TABLE = "public.notifications";

function parseIntStrict(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function validateLotIdsExist(client, lotIds) {
  if (!lotIds || lotIds.length === 0) return { ok: true, missing: [] };
  const existsRes = await client.query(
    `SELECT lot_id FROM ${LOTS_TABLE} WHERE lot_id = ANY($1::text[])`,
    [lotIds]
  );
  const existing = new Set((existsRes.rows ?? []).map((r) => String(r.lot_id)));
  const missing = lotIds.filter((id) => !existing.has(id));
  return { ok: missing.length === 0, missing };
}

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
        a.auction_id,
        a.auction_name,
        a.auction_type,
        a.auction_date,
        a.start_time,
        a.end_time,
        a.default_bid_timer,
        a.status,
        a.event_description,
        al.lot_id
      FROM ${AUCTIONS_TABLE} a
      LEFT JOIN ${AUCTION_LOTS_TABLE} al
        ON al.auction_id = a.auction_id
      ORDER BY a.auction_id ASC, al.lot_id ASC`
    );

    const byAuction = new Map();
    for (const r of result.rows ?? []) {
      const id = String(r?.auction_id ?? "").trim();
      if (!id) continue;

      const existing =
        byAuction.get(id) ??
        ({
          id,
          auctionName: String(r?.auction_name ?? ""),
          auctionType: String(r?.auction_type ?? "general"),
          auctionDate: String(r?.auction_date ?? ""),
          startTime: String(r?.start_time ?? ""),
          endTime: String(r?.end_time ?? ""),
          defaultBidTimer: Number(r?.default_bid_timer ?? 15) || 15,
          status: String(r?.status ?? "Draft"),
          eventDescription: r?.event_description ? String(r.event_description) : "",
          lotsCount: 0,
          lotIds: [],
        });

      if (r?.lot_id) existing.lotIds.push(String(r.lot_id));
      existing.lotsCount = existing.lotIds.length;
      byAuction.set(id, existing);
    }

    return Response.json(Array.from(byAuction.values()), { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const auctionId = String(body?.auctionId ?? body?.id ?? "").trim();
    const auctionName = String(body?.auctionName ?? "").trim();
    const auctionType = String(body?.auctionType ?? "general").trim() || "general";
    const auctionDate = String(body?.auctionDate ?? "").trim();
    const startTime = String(body?.startTime ?? "").trim();
    const endTime = String(body?.endTime ?? "").trim();
    const defaultBidTimer = parseIntStrict(body?.defaultBidTimer) ?? 15;
    const status = String(body?.status ?? "Draft").trim() || "Draft";
    const eventDescription = String(body?.eventDescription ?? "").trim();
    const lotIds = Array.isArray(body?.lotIds)
      ? body.lotIds.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!auctionId) return Response.json({ error: "auctionId is required" }, { status: 400 });
    if (!auctionName) return Response.json({ error: "auctionName is required" }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Detect "new auction" to emit notifications only once.
      const existedRes = await client.query(`SELECT 1 FROM ${AUCTIONS_TABLE} WHERE auction_id = $1`, [auctionId]);
      const existed = (existedRes.rows ?? []).length > 0;

      const valid = await validateLotIdsExist(client, lotIds);
      if (!valid.ok) {
        await client.query("ROLLBACK");
        return Response.json(
          {
            error:
              `Some selected lots do not exist in the database: ${valid.missing.join(", ")}. ` +
              `Please create/save those lots first, then assign them to the auction.`,
            missingLots: valid.missing,
          },
          { status: 400 }
        );
      }

      await client.query(
        `INSERT INTO ${AUCTIONS_TABLE}
          (auction_id, auction_name, auction_type, auction_date, start_time, end_time, default_bid_timer, status, event_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (auction_id)
         DO UPDATE SET auction_name = EXCLUDED.auction_name,
                       auction_type = EXCLUDED.auction_type,
                       auction_date = EXCLUDED.auction_date,
                       start_time = EXCLUDED.start_time,
                       end_time = EXCLUDED.end_time,
                       default_bid_timer = EXCLUDED.default_bid_timer,
                       status = EXCLUDED.status,
                       event_description = EXCLUDED.event_description`,
        [
          auctionId,
          auctionName,
          auctionType,
          auctionDate,
          startTime,
          endTime,
          defaultBidTimer,
          status,
          eventDescription,
        ]
      );

      await client.query(`DELETE FROM ${AUCTION_LOTS_TABLE} WHERE auction_id = $1`, [auctionId]);
      await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = NULL WHERE assigned_auction = $1`, [auctionId]);

      for (const lotId of lotIds) {
        await client.query(`INSERT INTO ${AUCTION_LOTS_TABLE} (auction_id, lot_id) VALUES ($1,$2)`, [
          auctionId,
          lotId,
        ]);
        await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = $1 WHERE lot_id = $2`, [auctionId, lotId]);
      }

      // New auction notifications (best-effort; don't fail save if notifications fail)
      if (!existed) {
        try {
          const usersRes = await client.query(`SELECT user_id FROM ${USERS_TABLE}`);
          const userIds = (usersRes.rows ?? []).map((r) => String(r.user_id ?? "").trim()).filter(Boolean);
          for (const uid of userIds) {
            await client.query(
              `INSERT INTO ${NOTIFS_TABLE} (user_id, type, title, message, entity_type, entity_id, is_read)
               VALUES ($1,'new_auction',$2,$3,'auction',$4,false)`,
              [uid, `New Auction: ${auctionName}`, `A new auction was created: ${auctionName}`, auctionId]
            );
          }
        } catch {
          // ignore
        }
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Robust delete: DELETE /api/auctions?id=AUCTION_ID
// This avoids issues with special characters in path segments (e.g. "#").
export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const auctionId = String(url.searchParams.get("id") ?? "").trim();
    if (!auctionId) return Response.json({ error: "Invalid auction id" }, { status: 400 });

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = NULL WHERE assigned_auction = $1`, [auctionId]);
      const res = await client.query(`DELETE FROM ${AUCTIONS_TABLE} WHERE auction_id = $1`, [auctionId]);
      if ((res.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Auction not found" }, { status: 404 });
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

