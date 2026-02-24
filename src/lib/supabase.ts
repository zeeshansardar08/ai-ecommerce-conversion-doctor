import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cachedClient: SupabaseClient<Database> | null = null;

const isValidSupabaseUrl = (url: string) => {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
};

export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    throw new Error(
      "SUPABASE_URL must be in the form https://<project-id>.supabase.co"
    );
  }

  cachedClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
};
