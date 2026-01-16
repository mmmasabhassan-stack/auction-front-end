import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

const ITEMS_TABLE = 'public."Items"';
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
        i.item_no,
        s.sr_no,
        s.description,
        s.qty,
        s.condition,
        s.make,
        s.make_no
      FROM ${ITEMS_TABLE} i
      LEFT JOIN ${SUB_ITEMS_TABLE} s
        ON s.item_no = i.item_no
      ORDER BY i.item_no ASC, s.sr_no ASC`
    );

    const byItemNo = new Map();
    for (const r of result.rows ?? []) {
      const itemNo = Number(r?.item_no);
      if (!Number.isFinite(itemNo)) continue;
      const key = String(itemNo);
      const existing =
        byItemNo.get(key) ??
        ({
          id: key,
          parentName: `Item No. ${key}`,
          subItemsCount: 0,
          items: [],
        });

      if (r?.sr_no !== null && r?.sr_no !== undefined) {
        existing.items.push({
          itemNo: key,
          srNo: String(r.sr_no ?? ''),
          description: String(r?.description ?? ''),
          qty: Number(r?.qty ?? 0) || 0,
          condition: String(r?.condition ?? ''),
          make: String(r?.make ?? ''),
          makeNo: String(r?.make_no ?? ''),
        });
      }

      existing.subItemsCount = existing.items.length;
      byItemNo.set(key, existing);
    }

    return Response.json(Array.from(byItemNo.values()), { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const itemNo = parseIntStrict(body?.itemNo ?? body?.item_no);
    const rows = Array.isArray(body?.rows ?? body?.items) ? (body.rows ?? body.items) : null;

    if (itemNo === null) return Response.json({ error: 'itemNo (integer) is required' }, { status: 400 });
    if (!rows || rows.length === 0) return Response.json({ error: 'At least one sub-item row is required' }, { status: 400 });

    const cleanedRows = rows.map((r, idx) => {
      const srNo = parseIntStrict(r?.srNo ?? r?.sr_no) ?? idx + 1;
      return {
        srNo,
        description: String(r?.description ?? '').trim(),
        qty: Number.parseInt(String(r?.qty ?? 0), 10) || 0,
        condition: String(r?.condition ?? '').trim(),
        make: String(r?.make ?? '').trim(),
        makeNo: String(r?.makeNo ?? r?.make_no ?? '').trim(),
      };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO ${ITEMS_TABLE} (item_no) VALUES ($1) ON CONFLICT (item_no) DO NOTHING`, [itemNo]);
      await client.query(`DELETE FROM ${SUB_ITEMS_TABLE} WHERE item_no = $1`, [itemNo]);

      for (const r of cleanedRows) {
        await client.query(
          `INSERT INTO ${SUB_ITEMS_TABLE}
            (item_no, sr_no, description, qty, condition, make, make_no)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [itemNo, r.srNo, r.description, r.qty, r.condition, r.make, r.makeNo]
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

