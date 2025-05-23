import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    console.log(request)
  const body = await request.json();
  console.log('Received:', body);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
