import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

const LOTS_TABLE = 'public.lots';
const LOT_ITEMS_TABLE = 'public.lot_items';

function parseIntStrict(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseLotId(params) {
  return String(params?.id ?? '').trim();
}

export async function PUT(req, { params }) {
  const lotId = parseLotId(params);
  if (!lotId) return Response.json({ error: 'Invalid lot id' }, { status: 400 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const lotName = String(body?.lotName ?? '').trim();
    const lotType = String(body?.lotType ?? 'general').trim() || 'general';
    const basePrice = parseIntStrict(body?.basePrice) ?? 0;
    const assignedAuction = body?.assignedAuction ? String(body.assignedAuction).trim() : null;

    const keys = Array.isArray(body?.selectedSubItems)
      ? body.selectedSubItems
      : Array.isArray(body?.items)
        ? body.items
        : [];

    if (!lotName) return Response.json({ error: 'lotName is required' }, { status: 400 });

    const pairs = keys
      .map((k) => {
        const itemNo = parseIntStrict(k?.itemNo ?? k?.item_no ?? k?.parentId);
        const srNo = parseIntStrict(k?.srNo ?? k?.sr_no ?? k?.row?.srNo);
        return itemNo !== null && srNo !== null ? { itemNo, srNo } : null;
      })
      .filter(Boolean);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const upd = await client.query(
        `UPDATE ${LOTS_TABLE}
         SET lot_name = $2,
             lot_type = $3,
             base_price = $4,
             assigned_auction = $5
         WHERE lot_id = $1`,
        [lotId, lotName, lotType, basePrice, assignedAuction]
      );
      if ((upd.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Lot not found' }, { status: 404 });
      }

      await client.query(`DELETE FROM ${LOT_ITEMS_TABLE} WHERE lot_id = $1`, [lotId]);
      for (const p of pairs) {
        await client.query(
          `INSERT INTO ${LOT_ITEMS_TABLE} (lot_id, item_no, sr_no) VALUES ($1, $2, $3)`,
          [lotId, p.itemNo, p.srNo]
        );
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

export async function DELETE(_req, { params }) {
  const lotId = parseLotId(params);
  if (!lotId) return Response.json({ error: 'Invalid lot id' }, { status: 400 });

  try {
    const pool = getPool();
    const res = await pool.query(`DELETE FROM ${LOTS_TABLE} WHERE lot_id = $1`, [lotId]);
    if ((res.rowCount ?? 0) === 0) return Response.json({ error: 'Lot not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

