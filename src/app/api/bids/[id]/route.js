import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

export async function PUT(req, { params }) 
{
  const id = Number(params?.id);
  if (!Number.isFinite(id)) 
  {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try 
  {
    const pool = getPool();
    const { bidAmount } = await req.json();
    const result = await pool.query('UPDATE bids SET amount=$1 WHERE id=$2 RETURNING *', 
      [
      bidAmount,
      id,
    ]);

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

export async function DELETE(_req, { params }) 
{
  const id = Number(params?.id);
  if (!Number.isFinite(id)) 
    {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try 
  {
    const pool = getPool();
    await pool.query('DELETE FROM bids WHERE id=$1', [id]);
    return new Response(null, { status: 204 });
  } catch (error) 
  {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

