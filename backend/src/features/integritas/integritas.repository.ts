import crypto from "node:crypto";
import { db } from "../../db/database.js";

export type IntegritasProofRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  file_name: string | null;
  file_size: number | null;
  hash: string;
  proof_uid: string | null;
  proof_status: string;
  proof_payload: string | null;
  status_response: string | null;
  verify_response: string | null;
  proof_error: string | null;
};

export function createProofRecord(input: { fileName?: string; fileSize?: number; hash: string; proofUid: string; proofStatus: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO integritas_proofs (id, created_at, updated_at, file_name, file_size, hash, proof_uid, proof_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, now, now, input.fileName ?? null, input.fileSize ?? null, input.hash, input.proofUid, input.proofStatus);
  return getProofRecord(id)!;
}

export function listProofRecords() {
  return db.prepare("SELECT * FROM integritas_proofs ORDER BY created_at DESC").all() as IntegritasProofRecord[];
}

export function listPendingProofRecords(limit?: number) {
  const sql = limit
    ? "SELECT * FROM integritas_proofs WHERE proof_status = 'pending' AND proof_uid IS NOT NULL ORDER BY created_at ASC LIMIT ?"
    : "SELECT * FROM integritas_proofs WHERE proof_status = 'pending' AND proof_uid IS NOT NULL ORDER BY created_at ASC";

  return (limit ? db.prepare(sql).all(limit) : db.prepare(sql).all()) as IntegritasProofRecord[];
}

export function getProofRecord(id: string) {
  return db.prepare("SELECT * FROM integritas_proofs WHERE id = ?").get(id) as IntegritasProofRecord | undefined;
}

export function updateProofStatus(id: string, input: { proofStatus: string; proofPayload?: unknown; statusResponse?: unknown; proofError?: string | null }) {
  db.prepare(`
    UPDATE integritas_proofs
    SET updated_at = ?, proof_status = ?, proof_payload = COALESCE(?, proof_payload), status_response = ?, proof_error = ?
    WHERE id = ?
  `).run(new Date().toISOString(), input.proofStatus, input.proofPayload === undefined ? null : JSON.stringify(input.proofPayload), input.statusResponse === undefined ? null : JSON.stringify(input.statusResponse), input.proofError ?? null, id);
  return getProofRecord(id)!;
}

export function updateVerifyResponse(id: string, verifyResponse: unknown) {
  db.prepare("UPDATE integritas_proofs SET updated_at = ?, verify_response = ? WHERE id = ?").run(new Date().toISOString(), JSON.stringify(verifyResponse), id);
  return getProofRecord(id)!;
}

export function deleteProofRecords(ids: string[]) {
  const stmt = db.prepare("DELETE FROM integritas_proofs WHERE id = ?");
  const tx = db.transaction((recordIds: string[]) => recordIds.forEach((id) => stmt.run(id)));
  tx(ids);
}
