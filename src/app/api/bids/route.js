import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET() 
{
  try 
  {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM bids');
    return Response.json(result.rows, { status: 200 });
  } 
  catch (error) 
  {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) 
{
  try 
  {
    const pool = getPool();
    const { bidAmount, userId } = await req.json();
    const result = await pool.query
    ('INSERT INTO bids (amount, user_id) VALUES ($1, $2) RETURNING *', [bidAmount, userId]);
    return Response.json(result.rows[0], { status: 201 });
  } 
  catch (error) 
  {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

