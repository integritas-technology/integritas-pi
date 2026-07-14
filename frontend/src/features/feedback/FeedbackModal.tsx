import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Modal } from "../../components/Modal";
import { ErrorText, MutedText } from "../../components/Text";
import { postJson } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";

const feedbackTypes = [
  { value: "bug", label: "Bug" },
  { value: "ux_issue", label: "UX issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" }
];

type FeedbackSubmitResponse = {
  id: string;
  fileName: string;
  exportUrl: string;
};

export function FeedbackModal({ pagePath, pageLabel, onClose }: { pagePath: string; pageLabel: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [type, setType] = useState("bug");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<FeedbackSubmitResponse | null>(null);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("Describe the feedback before submitting.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await postJson<FeedbackSubmitResponse>("/api/feedback", {
        type,
        description: trimmedDescription,
        page: { path: pagePath, label: pageLabel }
      });
      setSaved(result);
      showToast({ tone: "success", title: "Feedback saved locally", message: "Download the JSON file when you are ready to share it." });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not save feedback.";
      showToast({ tone: "error", title: "Feedback was not saved", message });
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Send feedback" onClose={onClose}>
      {saved ? (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="m-0 text-base font-extrabold text-emerald-950">Feedback saved locally</h4>
            <MutedText className="mt-2 text-emerald-800">
              Your feedback was appended to <code>{saved.fileName}</code>. Download the aggregate JSON file and send it manually to the Integritas team.
            </MutedText>
          </div>
          <ButtonRow>
            <a className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800" href={saved.exportUrl}>
              <Download size={16} /> Download feedback JSON
            </a>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </ButtonRow>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submitFeedback}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Current page</p>
            <p className="m-0 mt-2 font-bold text-slate-950">{pageLabel}</p>
            <code className="mt-2 block break-all rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{pagePath}</code>
          </div>

          <label className="grid gap-2 font-bold text-slate-700">
            Feedback type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {feedbackTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 font-bold text-slate-700">
            Description
            <textarea
              className="min-h-40 resize-y"
              maxLength={10000}
              placeholder="What happened, what did you expect, or what would you like to improve?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <MutedText className="m-0">
            The local JSON export includes app/device metadata and a small stats snapshot. It does not include passwords, TOTP secrets, session cookies, Integritas API keys, or wallet seed phrases.
          </MutedText>

          {error && <ErrorText className="m-0">{error}</ErrorText>}

          <ButtonRow>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save feedback"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </ButtonRow>
        </form>
      )}
    </Modal>
  );
}
