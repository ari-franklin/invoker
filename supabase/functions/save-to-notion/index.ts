import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Note {
  title: string;
  content: string;
}

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATABASE_ID = Deno.env.get('NOTION_DATABASE_ID');

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error('Missing required environment variables');
  Deno.exit(1);
}

async function createNotionPage(note: Note) {
  const response = await fetch(`https://api.notion.com/v1/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: note.title,
              },
            },
          ],
        },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: note.content,
                },
              },
            ],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Notion API error:', error);
    throw new Error(`Notion API error: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, content } = await req.json();
    
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await createNotionPage({ title, content });
    
    return new Response(
      JSON.stringify({ success: true, pageId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/save-to-notion' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
