import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function resolveItemsMeta(pool) {
  const reg = await pool.query(
    `SELECT
      to_regclass('public.items') as items_reg,
      to_regclass('public."Items"') as items_cap_reg
    `
  );
  const tableName = reg.rows?.[0]?.items_reg ? 'items' : reg.rows?.[0]?.items_cap_reg ? 'Items' : null;
  if (!tableName) throw new Error('Items table not found in public schema');

  const colsRes = await pool.query(
    `SELECT column_name, column_default, identity_generation
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );

  const cols = colsRes.rows ?? [];
  if (cols.length === 0) {
    throw new Error(
      `Items table columns not as expected. Found: (none). This usually means the DB user lacks privileges on public.${tableName}. Grant SELECT/INSERT/UPDATE/DELETE to your DB user and try again.`
    );
  }
  const names = cols.map((r) => r.column_name);
  const pick = (wantedLower) => names.find((c) => String(c).toLowerCase() === wantedLower);
  const pickLoose = (predicate) => names.find((c) => predicate(String(c).toLowerCase()));

  const idCol = pick('id');
  const nameCol = pick('name');
  const subCol = pick('sub_item') ?? pickLoose((x) => x.replace(/[^a-z]/g, '') === 'subitem');
  const itemNoCol = pick('item_no') ?? pickLoose((x) => x.replace(/[^a-z]/g, '') === 'itemno');
  const srCol = pick('sr_number') ?? pick('srno') ?? pickLoose((x) => x.replace(/[^a-z]/g, '') === 'srnumber');
  const descCol = pick('description');
  const qtyCol = pick('qty') ?? pick('quantity');
  const condCol = pick('condition');
  const makeCol = pick('make');
  const makeNoCol = pick('make_no') ?? pickLoose((x) => x.replace(/[^a-z]/g, '') === 'makeno');

  if (!idCol || !nameCol || !subCol) {
    throw new Error(`Items table columns not as expected. Found: ${names.join(', ')}`);
  }

  const idMeta = cols.find((r) => r.column_name === idCol);
  const idHasDefault = Boolean(idMeta?.identity_generation) || Boolean(idMeta?.column_default);

  return {
    tableName,
    idCol,
    idHasDefault,
    nameCol,
    subCol,
    itemNoCol,
    srCol,
    descCol,
    qtyCol,
    condCol,
    makeCol,
    makeNoCol,
  };
}

export async function GET() {
  try {
    const pool = getPool();
    const meta = await resolveItemsMeta(pool);
    const tableRef = `public.${qIdent(meta.tableName)}`;

    const result = await pool.query(
      `SELECT
        ${qIdent(meta.idCol)} as id,
        ${qIdent(meta.nameCol)} as name,
        ${qIdent(meta.subCol)} as sub_item,
        ${meta.itemNoCol ? `${qIdent(meta.itemNoCol)} as item_no,` : ''} 
        ${meta.srCol ? `${qIdent(meta.srCol)} as sr_number,` : ''} 
        ${meta.descCol ? `${qIdent(meta.descCol)} as description,` : ''} 
        ${meta.qtyCol ? `${qIdent(meta.qtyCol)} as qty,` : ''} 
        ${meta.condCol ? `${qIdent(meta.condCol)} as condition,` : ''} 
        ${meta.makeCol ? `${qIdent(meta.makeCol)} as make,` : ''} 
        ${meta.makeNoCol ? `${qIdent(meta.makeNoCol)} as make_no` : 'NULL as make_no'}
      FROM ${tableRef}
      ORDER BY ${qIdent(meta.idCol)} ASC`
    );

    // Group rows into the UI's parent Item shape.
    const byName = new Map();
    for (const r of result.rows ?? []) {
      const name = String(r?.name ?? '').trim();
      if (!name) continue;
      const existing = byName.get(name) ?? {
        id: null,
        parentName: name,
        subItemsCount: 0,
        items: [],
      };
      existing.id = existing.id ?? r.id;
      existing.subItemsCount = Math.max(existing.subItemsCount ?? 0, Number(r?.sub_item ?? 0) || 0);
      existing.items.push({
        itemNo: r?.item_no ?? '',
        srNo: r?.sr_number ?? '',
        description: r?.description ?? '',
        qty: Number(r?.qty ?? 0) || 0,
        condition: r?.condition ?? '',
        make: r?.make ?? '',
        makeNo: r?.make_no ?? '',
      });
      byName.set(name, existing);
    }

    const grouped = Array.from(byName.values()).map((it) => ({
      ...it,
      id: String(it.id ?? it.parentName),
      subItemsCount: it.items.length,
    }));

    return Response.json(grouped, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const pool = getPool();
    const meta = await resolveItemsMeta(pool);
    const tableRef = `public.${qIdent(meta.tableName)}`;

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? body?.parentName ?? '').trim();
    const rows = Array.isArray(body?.rows ?? body?.items) ? (body.rows ?? body.items) : null;
    const cleanedRows = (rows ?? []).map((r) => ({
      itemNo: String(r?.itemNo ?? r?.item_no ?? '').trim(),
      srNo: String(r?.srNo ?? r?.sr_number ?? '').trim(),
      description: String(r?.description ?? '').trim(),
      qty: Number(r?.qty ?? 0) || 0,
      condition: String(r?.condition ?? '').trim(),
      make: String(r?.make ?? '').trim(),
      makeNo: String(r?.makeNo ?? r?.make_no ?? '').trim(),
    }));

    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!cleanedRows || cleanedRows.length === 0) {
      return Response.json({ error: 'At least one item row is required' }, { status: 400 });
    }

    const subItemNum = cleanedRows.length;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Determine next id if the ID column has no default/identity.
      let nextId = null;
      if (!meta.idHasDefault) {
        const maxRes = await client.query(`SELECT COALESCE(MAX(${qIdent(meta.idCol)}), 0) as m FROM ${tableRef}`);
        nextId = Number(maxRes.rows?.[0]?.m ?? 0) + 1;
      }

      for (const r of cleanedRows) {
        const cols = [qIdent(meta.nameCol), qIdent(meta.subCol)];
        const vals = [name, subItemNum];
        if (meta.itemNoCol) {
          cols.push(qIdent(meta.itemNoCol));
          vals.push(r.itemNo);
        }
        if (meta.srCol) {
          cols.push(qIdent(meta.srCol));
          vals.push(r.srNo);
        }
        if (meta.descCol) {
          cols.push(qIdent(meta.descCol));
          vals.push(r.description);
        }
        if (meta.qtyCol) {
          cols.push(qIdent(meta.qtyCol));
          vals.push(r.qty);
        }
        if (meta.condCol) {
          cols.push(qIdent(meta.condCol));
          vals.push(r.condition);
        }
        if (meta.makeCol) {
          cols.push(qIdent(meta.makeCol));
          vals.push(r.make);
        }
        if (meta.makeNoCol) {
          cols.push(qIdent(meta.makeNoCol));
          vals.push(r.makeNo);
        }

        if (!meta.idHasDefault) {
          cols.unshift(qIdent(meta.idCol));
          vals.unshift(nextId++);
        }

        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`INSERT INTO ${tableRef} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
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

