import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";
import type { Database } from "./database.types";

const MAX_PER_DAY = 50;
const WINDOW_HOURS = 24;

export const hashIp = (ip: string) => {
  const salt = process.env.IP_HASH_SALT || "local-dev-salt";
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
};

export const checkRateLimit = async (key: string) => {
  const supabase = getSupabaseAdmin();
  type RateLimitRow = Database["public"]["Tables"]["rate_limits"]["Row"];
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("rate_limits")
    .select("id,key,count,reset_at")
    .eq("key", key)
    .maybeSingle<RateLimitRow>();

  if (error) {
    throw new Error(`Unable to read rate limit: ${error.message}`);
  }

  if (!data || new Date(data.reset_at) <= now) {
    const { error: upsertError } = await supabase
      .from("rate_limits")
      .upsert(
        { key, count: 1, reset_at: resetAt.toISOString() },
        { onConflict: "key" }
      );

    if (upsertError) {
      throw new Error(`Unable to set rate limit: ${upsertError.message}`);
    }

    return { allowed: true, remaining: MAX_PER_DAY - 1, resetAt };
  }

  if (data.count >= MAX_PER_DAY) {
    return { allowed: false, remaining: 0, resetAt: new Date(data.reset_at) };
  }

  const { error: updateError } = await supabase
    .from("rate_limits")
    .update({ count: data.count + 1 })
    .eq("id", data.id);

  if (updateError) {
    throw new Error(`Unable to update rate limit: ${updateError.message}`);
  }

  return {
    allowed: true,
    remaining: MAX_PER_DAY - (data.count + 1),
    resetAt: new Date(data.reset_at),
  };
};
