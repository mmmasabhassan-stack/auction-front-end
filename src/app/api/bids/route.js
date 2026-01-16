import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

const BIDS_TABLE = 'public.bids';
const AUCTIONS_TABLE = 'public.auctions';
const LOTS_TABLE = 'public.lots';
const AUCTION_LOTS_TABLE = 'public.auction_lots';
const USERS_TABLE = 'public.users';
const NOTIFS_TABLE = 'public.notifications';
const AUCTION_STATE_TABLE = 'public.auction_state';

const MIN_INCREMENT = 100;

function asText(v) {
  return String(v ?? '').trim();
}

function asInt(v) {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function insertNotification(client, notif) {
  const userId = asText(notif?.userId);
  if (!userId) return;
  const type = asText(notif?.type) || 'system';
  const title = asText(notif?.title);
  const message = asText(notif?.message);
  const entityType = notif?.entityType ? asText(notif.entityType) : null;
  const entityId = notif?.entityId ? asText(notif.entityId) : null;
  await client.query(
    `INSERT INTO ${NOTIFS_TABLE} (user_id, type, title, message, entity_type, entity_id, is_read)
     VALUES ($1,$2,$3,$4,$5,$6,false)`,
    [userId, type, title, message, entityType, entityId]
  );
}

function isAuctionLiveNow(auctionRow, stateRow) {
  const state = asText(stateRow?.status);
  if (state === 'live') return true;
  if (state === 'ended') return false;
  // fallback to time window if state isn't explicitly live
  const d = asText(auctionRow?.auction_date);
  const s = asText(auctionRow?.start_time);
  const e = asText(auctionRow?.end_time);
  if (!d || !s) return false;
  const start = new Date(`${d}T${s}:00`);
  const end = e ? new Date(`${d}T${e}:00`) : null;
  const now = new Date();
  if (Number.isNaN(start.getTime())) return false;
  if (now < start) return false;
  if (end && !Number.isNaN(end.getTime()) && now > end) return false;
  return true;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userId = asText(url.searchParams.get('userId'));
    const auctionId = asText(url.searchParams.get('auctionId'));
    const lotId = asText(url.searchParams.get('lotId'));

    const pool = getPool();

    // My bids view: userId required
    if (userId) {
      const res = await pool.query(
        `WITH latest_user AS (
           SELECT DISTINCT ON (b.auction_id, b.lot_id)
             b.auction_id, b.lot_id, b.amount AS my_amount, b.created_at AS my_created_at
           FROM ${BIDS_TABLE} b
           WHERE b.user_id = $1
           ORDER BY b.auction_id, b.lot_id, b.created_at DESC
         ),
         highest AS (
           SELECT b.auction_id, b.lot_id, MAX(b.amount) AS highest_amount
           FROM ${BIDS_TABLE} b
           GROUP BY b.auction_id, b.lot_id
         )
         SELECT
           lu.auction_id,
           a.auction_name,
           lu.lot_id,
           l.lot_name,
           lu.my_amount,
           h.highest_amount,
           lu.my_created_at
         FROM latest_user lu
         JOIN ${AUCTIONS_TABLE} a ON a.auction_id = lu.auction_id
         JOIN ${LOTS_TABLE} l ON l.lot_id = lu.lot_id
         JOIN highest h ON h.auction_id = lu.auction_id AND h.lot_id = lu.lot_id
         ORDER BY lu.my_created_at DESC`,
        [userId]
      );

      const out = (res.rows ?? []).map((r) => ({
        auctionId: asText(r.auction_id),
        auctionName: asText(r.auction_name),
        lotId: asText(r.lot_id),
        lotName: asText(r.lot_name),
        myBid: Number(r.my_amount ?? 0) || 0,
        highest: Number(r.highest_amount ?? 0) || 0,
        status: Number(r.my_amount ?? 0) === Number(r.highest_amount ?? 0) ? 'winning' : 'outbid',
        createdAt: r.my_created_at,
      }));

      return Response.json(out, { status: 200 });
    }

    // Optional: bid history for a lot
    if (auctionId && lotId) {
      const res = await pool.query(
        `SELECT bid_id, user_id, amount, created_at
         FROM ${BIDS_TABLE}
         WHERE auction_id = $1 AND lot_id = $2
         ORDER BY created_at DESC
         LIMIT 100`,
        [auctionId, lotId]
      );
      return Response.json(res.rows ?? [], { status: 200 });
    }

    return Response.json({ error: 'userId or (auctionId & lotId) is required' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const userId = asText(body?.userId);
    const auctionId = asText(body?.auctionId);
    const lotId = asText(body?.lotId);
    const amount = asInt(body?.amount);

    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });
    if (!auctionId) return Response.json({ error: 'auctionId is required' }, { status: 400 });
    if (!lotId) return Response.json({ error: 'lotId is required' }, { status: 400 });
    if (amount === null || amount <= 0) return Response.json({ error: 'amount must be a positive integer' }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(`SELECT 1 FROM ${USERS_TABLE} WHERE user_id = $1`, [userId]);
      if ((userRes.rows ?? []).length === 0) {
        await client.query('ROLLBACK');
        return Response.json({ error: `User not found: ${userId}` }, { status: 404 });
      }

      const auctionRes = await client.query(
        `SELECT auction_id, auction_name, auction_date, start_time, end_time
         FROM ${AUCTIONS_TABLE}
         WHERE auction_id = $1`,
        [auctionId]
      );
      const auctionRow = auctionRes.rows?.[0];
      if (!auctionRow) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Auction not found' }, { status: 404 });
      }

      const stateRes = await client.query(`SELECT status, active_lot_id, bid_ends_at FROM ${AUCTION_STATE_TABLE} WHERE auction_id = $1`, [auctionId]);
      const stateRow = stateRes.rows?.[0] ?? null;
      if (!isAuctionLiveNow(auctionRow, stateRow)) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Auction is not live' }, { status: 400 });
      }

      const lotInAuctionRes = await client.query(
        `SELECT 1 FROM ${AUCTION_LOTS_TABLE} WHERE auction_id = $1 AND lot_id = $2`,
        [auctionId, lotId]
      );
      if ((lotInAuctionRes.rows ?? []).length === 0) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Lot is not assigned to this auction' }, { status: 400 });
      }

      const lotRes = await client.query(`SELECT lot_name, base_price FROM ${LOTS_TABLE} WHERE lot_id = $1`, [lotId]);
      const lotRow = lotRes.rows?.[0];
      if (!lotRow) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Lot not found' }, { status: 404 });
      }

      const basePrice = Number(lotRow?.base_price ?? 0) || 0;
      const highestRes = await client.query(
        `SELECT user_id, amount
         FROM ${BIDS_TABLE}
         WHERE auction_id = $1 AND lot_id = $2
         ORDER BY amount DESC, created_at DESC
         LIMIT 1`,
        [auctionId, lotId]
      );
      const highest = highestRes.rows?.[0] ?? null;
      const highestAmount = Number(highest?.amount ?? 0) || 0;
      const minAllowed = Math.max(basePrice, highestAmount + MIN_INCREMENT);
      if (amount < minAllowed) {
        await client.query('ROLLBACK');
        return Response.json({ error: `Bid too low. Minimum allowed is ${minAllowed}.` }, { status: 400 });
      }

      // Insert bid
      const insertRes = await client.query(
        `INSERT INTO ${BIDS_TABLE} (auction_id, lot_id, user_id, amount)
         VALUES ($1,$2,$3,$4)
         RETURNING bid_id, created_at`,
        [auctionId, lotId, userId, amount]
      );

      // Notify previous highest bidder (outbid)
      const prevUserId = asText(highest?.user_id);
      if (prevUserId && prevUserId !== userId) {
        await insertNotification(client, {
          userId: prevUserId,
          type: 'outbid',
          title: 'You have been outbid',
          message: `Your bid was outbid on lot "${asText(lotRow?.lot_name)}"`,
          entityType: 'lot',
          entityId: lotId,
        });
      }

      // Optional: notify bidder
      await insertNotification(client, {
        userId,
        type: 'bid',
        title: 'Bid placed',
        message: `You placed a bid of ${amount} on lot "${asText(lotRow?.lot_name)}"`,
        entityType: 'lot',
        entityId: lotId,
      });

      await client.query('COMMIT');
      return Response.json(
        {
          ok: true,
          bidId: Number(insertRes.rows?.[0]?.bid_id ?? 0) || 0,
          createdAt: insertRes.rows?.[0]?.created_at ?? null,
        },
        { status: 201 }
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

