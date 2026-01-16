import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

async function getParams(ctx) {
  return await Promise.resolve(ctx?.params);
}

export async function PUT(req, ctx) 
{
  const params = await getParams(ctx);
  const id = Number(params?.id);
  if (!Number.isFinite(id)) 
  {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try 
  {
    const pool = getPool();
    const { amount } = await req.json().catch(() => ({}));
    const bidAmount = Number.parseInt(String(amount ?? '').trim(), 10);
    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const result = await pool.query(
      'UPDATE public.bids SET amount=$1 WHERE bid_id=$2 RETURNING bid_id, auction_id, lot_id, user_id, amount, created_at',
      [bidAmount, id]
    );

    if (!result.rows[0]) 
      {
      return Response.json({ error: 'Bid not found' }, { status: 404 });
    }

    return Response.json(result.rows[0], { status: 200 });
  } catch (error) 
  {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) 
{
  const params = await getParams(ctx);
  const id = Number(params?.id);
  if (!Number.isFinite(id)) 
    {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try 
  {
    const pool = getPool();
    await pool.query('DELETE FROM public.bids WHERE bid_id=$1', [id]);
    return new Response(null, { status: 204 });
  } catch (error) 
  {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

