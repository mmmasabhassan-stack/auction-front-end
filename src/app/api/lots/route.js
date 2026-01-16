import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

const LOTS_TABLE = 'public.lots';
const LOT_ITEMS_TABLE = 'public.lot_items';
const SUB_ITEMS_TABLE = 'public.sub_items';

function parseIntStrict(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
        l.lot_id,
        l.lot_name,
        l.lot_type,
        l.base_price,
        l.assigned_auction,
        li.item_no,
        li.sr_no,
        s.description,
        s.qty,
        s.condition,
        s.make,
        s.make_no
      FROM ${LOTS_TABLE} l
      LEFT JOIN ${LOT_ITEMS_TABLE} li
        ON li.lot_id = l.lot_id
      LEFT JOIN ${SUB_ITEMS_TABLE} s
        ON s.item_no = li.item_no AND s.sr_no = li.sr_no
      ORDER BY l.lot_id ASC, li.item_no ASC, li.sr_no ASC`
    );

    const byLot = new Map();
    for (const r of result.rows ?? []) {
      const lotId = String(r?.lot_id ?? '').trim();
      if (!lotId) continue;

      const existing =
        byLot.get(lotId) ??
        ({
          id: lotId,
          lotName: String(r?.lot_name ?? ''),
          lotType: String(r?.lot_type ?? 'general'),
          basePrice: Number(r?.base_price ?? 0) || 0,
          assignedAuction: r?.assigned_auction ? String(r.assigned_auction) : undefined,
          selectedSubItems: [],
          itemCount: 0,
        });

      if (r?.item_no !== null && r?.sr_no !== null && r?.item_no !== undefined && r?.sr_no !== undefined) {
        const itemNo = Number(r.item_no);
        const srNo = Number(r.sr_no);
        if (Number.isFinite(itemNo) && Number.isFinite(srNo)) {
          existing.selectedSubItems.push({
            parentId: String(itemNo),
            parentName: `Item No. ${itemNo}`,
            rowIndex: Math.max(0, srNo - 1),
            row: {
              itemNo: String(itemNo),
              srNo: String(srNo),
              description: String(r?.description ?? ''),
              qty: Number(r?.qty ?? 0) || 0,
              condition: String(r?.condition ?? ''),
              make: String(r?.make ?? ''),
              makeNo: String(r?.make_no ?? ''),
            },
          });
        }
      }

      existing.itemCount = existing.selectedSubItems.length;
      byLot.set(lotId, existing);
    }

    return Response.json(Array.from(byLot.values()), { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const lotId = String(body?.lotId ?? body?.id ?? '').trim();
    const lotName = String(body?.lotName ?? '').trim();
    const lotType = String(body?.lotType ?? 'general').trim() || 'general';
    const basePrice = parseIntStrict(body?.basePrice) ?? 0;
    const assignedAuction = body?.assignedAuction ? String(body.assignedAuction).trim() : null;

    const keys = Array.isArray(body?.selectedSubItems)
      ? body.selectedSubItems
      : Array.isArray(body?.items)
        ? body.items
        : [];

    if (!lotId) return Response.json({ error: 'lotId is required' }, { status: 400 });
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

      await client.query(
        `INSERT INTO ${LOTS_TABLE} (lot_id, lot_name, lot_type, base_price, assigned_auction)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lot_id)
         DO UPDATE SET lot_name = EXCLUDED.lot_name,
                       lot_type = EXCLUDED.lot_type,
                       base_price = EXCLUDED.base_price,
                       assigned_auction = EXCLUDED.assigned_auction`,
        [lotId, lotName, lotType, basePrice, assignedAuction]
      );

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

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

