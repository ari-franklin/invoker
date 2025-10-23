import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface SaveToNotionParams {
  title: string;
  content: string;
  labels?: string[];
  status?: string;
}

// Function to save transcript to Notion via Supabase Edge Function
export async function saveToNotion({ title, content, labels, status }: SaveToNotionParams) {
  const { data, error } = await supabase.functions.invoke('save-to-notion', {
    body: { 
      title, 
      content, 
      labels, 
      status 
    },
  });

  if (error) {
    console.error('Error saving to Notion:', error);
    throw error;
  }

  return data;
}
