import { supabase } from "@/lib/supabase";

/**
 * Returns the signed-in user only if Supabase confirms the account still exists.
 * getSession() alone just reads the browser's saved login, so a deleted or disabled
 * account would still look signed in until its token expired. Here a deleted user is signed out right away.
 */
export async function getVerifiedUser() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: u, error } = await supabase.auth.getUser();
  if (error) {
    const gone = error.status === 401 || error.status === 403 || error.status === 404 || /does not exist|invalid|expired/i.test(error.message);
    if (gone) await supabase.auth.signOut();
    else return data.session.user; // network hiccup: don't log people out
    return null;
  }
  return u.user ?? null;
}