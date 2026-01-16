import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

const AUCTIONS_TABLE = 'public.auctions';
const AUCTION_LOTS_TABLE = 'public.auction_lots';
const LOTS_TABLE = 'public.lots';

function parseIntStrict(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function getParams(ctx) {
  // Next may provide `params` as a Promise in newer versions.
  return await Promise.resolve(ctx?.params);
}

export async function PUT(req, ctx) {
  const params = await getParams(ctx);
  const auctionId = String(params?.id ?? '').trim();
  if (!auctionId) return Response.json({ error: 'Invalid auction id' }, { status: 400 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const auctionName = String(body?.auctionName ?? '').trim();
    const auctionType = String(body?.auctionType ?? 'general').trim() || 'general';
    const auctionDate = String(body?.auctionDate ?? '').trim();
    const startTime = String(body?.startTime ?? '').trim();
    const endTime = String(body?.endTime ?? '').trim();
    const defaultBidTimer = parseIntStrict(body?.defaultBidTimer) ?? 15;
    const status = String(body?.status ?? 'Draft').trim() || 'Draft';
    const eventDescription = String(body?.eventDescription ?? '').trim();

    const lotIds = Array.isArray(body?.lotIds) ? body.lotIds.map((x) => String(x).trim()).filter(Boolean) : [];
    if (!auctionName) return Response.json({ error: 'auctionName is required' }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (lotIds.length > 0) {
        const existsRes = await client.query(
          `SELECT lot_id FROM ${LOTS_TABLE} WHERE lot_id = ANY($1::text[])`,
          [lotIds]
        );
        const existing = new Set((existsRes.rows ?? []).map((r) => String(r.lot_id)));
        const missing = lotIds.filter((id) => !existing.has(id));
        if (missing.length > 0) {
          await client.query('ROLLBACK');
          return Response.json(
            {
              error:
                `Some selected lots do not exist in the database: ${missing.join(', ')}. ` +
                `Please create/save those lots first, then assign them to the auction.`,
              missingLots: missing,
            },
            { status: 400 }
          );
        }
      }

      const upd = await client.query(
        `UPDATE ${AUCTIONS_TABLE}
         SET auction_name = $2,
             auction_type = $3,
             auction_date = $4,
             start_time = $5,
             end_time = $6,
             default_bid_timer = $7,
             status = $8,
             event_description = $9
         WHERE auction_id = $1`,
        [auctionId, auctionName, auctionType, auctionDate, startTime, endTime, defaultBidTimer, status, eventDescription]
      );
      if ((upd.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Auction not found' }, { status: 404 });
      }

      await client.query(`DELETE FROM ${AUCTION_LOTS_TABLE} WHERE auction_id = $1`, [auctionId]);
      await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = NULL WHERE assigned_auction = $1`, [auctionId]);

      for (const lotId of lotIds) {
        await client.query(`INSERT INTO ${AUCTION_LOTS_TABLE} (auction_id, lot_id) VALUES ($1,$2)`, [auctionId, lotId]);
        await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = $1 WHERE lot_id = $2`, [auctionId, lotId]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const params = await getParams(ctx);
  const auctionId = String(params?.id ?? '').trim();
  if (!auctionId) return Response.json({ error: 'Invalid auction id' }, { status: 400 });

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE ${LOTS_TABLE} SET assigned_auction = NULL WHERE assigned_auction = $1`, [auctionId]);
      const res = await client.query(`DELETE FROM ${AUCTIONS_TABLE} WHERE auction_id = $1`, [auctionId]);
      if ((res.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Auction not found' }, { status: 404 });
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

