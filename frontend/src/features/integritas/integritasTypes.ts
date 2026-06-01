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
