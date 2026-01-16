import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

async function getParams(ctx) {
  return await Promise.resolve(ctx?.params);
}

function parseIdFromParams(params) {
  const raw = String(params?.id ?? '');
  const m = raw.match(/-?\d+/);
  const id = m ? Number(m[0]) : NaN;
  return Number.isFinite(id) ? id : null;
}

const ITEMS_TABLE = 'public."Items"';
const SUB_ITEMS_TABLE = 'public.sub_items';

function parseIntStrict(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(req, ctx) {
  const params = await getParams(ctx);
  const itemNo = parseIdFromParams(params);
  if (itemNo === null) return Response.json({ error: 'Invalid item no' }, { status: 400 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows ?? body?.items) ? (body.rows ?? body.items) : null;
    if (!rows || rows.length === 0) return Response.json({ error: 'At least one sub-item row is required' }, { status: 400 });

    const exists = await pool.query(`SELECT 1 FROM ${ITEMS_TABLE} WHERE item_no = $1`, [itemNo]);
    if ((exists.rows ?? []).length === 0) return Response.json({ error: 'Item not found' }, { status: 404 });

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

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const params = await getParams(ctx);
  const itemNo = parseIdFromParams(params);
  if (itemNo === null) return Response.json({ error: 'Invalid item no' }, { status: 400 });

  try {
    const pool = getPool();
    const res = await pool.query(`DELETE FROM ${ITEMS_TABLE} WHERE item_no = $1`, [itemNo]);
    if ((res.rowCount ?? 0) === 0) return Response.json({ error: 'Item not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

