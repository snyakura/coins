import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { submitProof } from "@/lib/payments/deposits";
import { ServiceError } from "@/lib/payments/common";
import { MAX_PROOF_BYTES } from "@/lib/payments/files";
import { guarded, publicDeposit } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deposits/$id/proof")({
  server: {
    handlers: {
      POST: guarded({ limit: 6 }, async ({ actor, request, params }) => {
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_PROOF_BYTES + 100_000) throw new ServiceError(413, "File is too large (max 5 MB).", "FILE_TOO_LARGE");
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File)) throw new ServiceError(400, "Please attach your proof of payment.", "NO_FILE");
        const d = await submitProof(getCtx(), actor.id, params.id!, {
          reference: form?.get("reference"), file: { bytes: new Uint8Array(await file.arrayBuffer()) },
        });
        return { deposit: publicDeposit(d, false) };
      }),
    },
  },
});
