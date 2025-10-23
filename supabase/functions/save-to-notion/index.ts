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
  throw new Error('Missing required environment variables: NOTION_TOKEN, NOTION_DATABASE_ID');
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
        'Name': {
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
    const error = await response.json();
    throw new Error(error.message || 'Failed to create Notion page');
  }

  return await response.json();
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
        JSON.stringify({ error: 'Missing required fields: title, content' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await createNotionPage({ title, content });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        page_id: result.id,
        url: result.url 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
