// Kitchen app configuration.
// Leave SUPABASE_URL empty to run in demo mode (sample recipes saved in this browser only).
// Both values below are safe to publish: the anon key is public by design, and Row Level
// Security in supabase/schema.sql keeps every row private to the signed-in household account.
export const SUPABASE_URL = "https://rkwcvvuivgdiezxiqfgz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_jTxYOJq2sEFHX4dnBAVvtQ_nEzPnhuH"; // publishable (public) key

// The single shared household account. The login screen only asks for the password;
// this email is filled in behind the scenes.
export const HOUSEHOLD_EMAIL = "kitchen@gracekruse.com";
