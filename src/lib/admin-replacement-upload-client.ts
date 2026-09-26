import type { DeliverableRow } from "@/components/admin/AdminDeliverableUpload";

const FINALIZE_FAILED = "The replacement could not be finalized. The rework request was not updated.";
const FINALIZE_UNKNOWN = "Could not confirm whether the replacement was finalized. Refresh the order before trying another upload.";

/** The two admin replacement controls share this one replacement-only flow. */
export async function uploadAdminReplacement(
  reviewId: string,
  file: File,
  onProgress: (message: string) => void,
): Promise<DeliverableRow> {
  const url = `/api/admin/reviews/${reviewId}/replacement`;
  const mimeType = file.type || "application/octet-stream";
  onProgress("Preparing replacement…");
  const prepared = await fetch(url, {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_type: mimeType, file_size: file.size }),
  });
  if (!prepared.ok) throw new Error("Could not prepare replacement upload. Refresh the order and try again.");
  const preparation = await prepared.json() as { ok?: boolean; replacementDeliverableId?: string; signedUrl?: string };
  if (!preparation.ok || !preparation.replacementDeliverableId || !preparation.signedUrl) {
    throw new Error("Could not prepare replacement upload.");
  }
  const candidateId = preparation.replacementDeliverableId;
  onProgress("Uploading file…");
  const uploaded = await fetch(preparation.signedUrl, {
    method: "PUT", headers: { "Content-Type": mimeType }, body: file,
  });
  if (!uploaded.ok) throw new Error("Replacement upload failed. The rework request was not updated.");

  const body = JSON.stringify({ mode: "atomic_upload", replacementDeliverableId: candidateId,
    filename: file.name, file_size: file.size, mime_type: mimeType });
  // One bounded reconciliation attempt. Never prepare/upload a second candidate
  // because the commit response was lost, malformed, or returned a server error.
  for (let attempt = 0; attempt < 2; attempt++) {
    onProgress(attempt === 0 ? "Finalizing replacement…" : "Confirming replacement…");
    let response: Response;
    try {
      response = await fetch(url, { method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body });
    } catch { continue; }
    if (response.status >= 500) continue;
    if (!response.ok) throw new Error(attempt === 0 ? FINALIZE_FAILED : FINALIZE_UNKNOWN);
    try {
      const result = await response.json() as { ok?: boolean; status?: string; deliverable?: DeliverableRow };
      if (result.ok && result.status === "rework_delivered" && result.deliverable?.id === candidateId) {
        return result.deliverable;
      }
    } catch { /* A lost/truncated success body is also an unknown outcome. */ }
  }
  throw new Error(FINALIZE_UNKNOWN);
}
