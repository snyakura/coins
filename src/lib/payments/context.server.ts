import { decrypt } from "@/lib/deriv/crypto";
import { getDeriv } from "@/lib/deriv";
import { config, type Ctx } from "./common";
import { MemoryRepo, type Repo } from "./repo";
import { SupabaseRepo, serviceClient } from "./supabaseRepo";

let repo: Repo | null = null;
const getRepo = (): Repo => {
  if (repo) return repo;
  const haveDb = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!haveDb && process.env.NODE_ENV === "production") throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
  return (repo = haveDb ? new SupabaseRepo() : new MemoryRepo());
};

export function getCtx(): Ctx {
  return {
    repo: getRepo(),
    deriv: getDeriv().provider,
    now: () => new Date(),
    decryptToken: decrypt,
    ...config(),
    saveProof: async (userId, depositId, f) => {
      const path = `${userId}/${depositId}-${Date.now()}.${f.ext}`;
      const { error } = await serviceClient().storage.from("deposit-proofs").upload(path, f.bytes, { contentType: f.mime, upsert: false });
      if (error) throw new Error(`proof upload failed: ${error.message}`);
      return path;
    },
  };
}

/** Short-lived signed URL so an admin can view a private proof. */
export async function signedProofUrl(path: string) {
  const { data } = await serviceClient().storage.from("deposit-proofs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
