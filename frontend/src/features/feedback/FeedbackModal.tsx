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

const feedbackAreas = [
  { value: "current_page", label: "Current page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "node", label: "Minima Core" },
  { value: "wallet", label: "Wallet" },
  { value: "integritas", label: "Integritas" },
  { value: "data", label: "Devices" },
  { value: "automation", label: "Automation" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "setup_login", label: "Setup / Login" },
  { value: "install_update", label: "Install / Update" },
  { value: "other", label: "Other" }
];

const bugSeverities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" }
];

const bugReproducibilities = [
  { value: "always", label: "Always" },
  { value: "sometimes", label: "Sometimes" },
  { value: "once", label: "Once" },
  { value: "not_sure", label: "Not sure" }
];

const featurePriorities = [
  { value: "nice_to_have", label: "Nice to have" },
  { value: "important", label: "Important" },
  { value: "blocking_workflow", label: "Blocking workflow" }
];

type FeedbackSubmitResponse = {
  id: string;
  fileName: string;
  exportUrl: string;
};

export function FeedbackModal({ pagePath, pageLabel, onClose }: { pagePath: string; pageLabel: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [type, setType] = useState("bug");
  const [area, setArea] = useState("current_page");
  const [bugSeverity, setBugSeverity] = useState("medium");
  const [bugReproducibility, setBugReproducibility] = useState("not_sure");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [featurePriority, setFeaturePriority] = useState("nice_to_have");
  const [desiredOutcome, setDesiredOutcome] = useState("");
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
        area: { id: area, label: feedbackAreas.find((item) => item.value === area)?.label ?? area },
        description: trimmedDescription,
        page: { path: pagePath, label: pageLabel },
        ...(type === "bug" ? {
          bug: {
            severity: bugSeverity,
            reproducibility: bugReproducibility,
            expectedBehavior,
            actualBehavior
          }
        } : {}),
        ...(type === "feature_request" ? {
          featureRequest: {
            priority: featurePriority,
            desiredOutcome
          }
        } : {}),
        browser: getBrowserContext()
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
            What is this about?
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              {feedbackAreas.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          {type === "bug" && (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 font-bold text-slate-700">
                  Severity
                  <select value={bugSeverity} onChange={(event) => setBugSeverity(event.target.value)}>
                    {bugSeverities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 font-bold text-slate-700">
                  Reproducibility
                  <select value={bugReproducibility} onChange={(event) => setBugReproducibility(event.target.value)}>
                    {bugReproducibilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="grid gap-2 font-bold text-slate-700">
                Expected behavior
                <input maxLength={1000} value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} placeholder="What did you expect to happen?" />
              </label>
              <label className="grid gap-2 font-bold text-slate-700">
                Actual behavior
                <input maxLength={1000} value={actualBehavior} onChange={(event) => setActualBehavior(event.target.value)} placeholder="What happened instead?" />
              </label>
            </div>
          )}

          {type === "feature_request" && (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="grid gap-2 font-bold text-slate-700">
                Priority
                <select value={featurePriority} onChange={(event) => setFeaturePriority(event.target.value)}>
                  {featurePriorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 font-bold text-slate-700">
                Desired outcome
                <input maxLength={1000} value={desiredOutcome} onChange={(event) => setDesiredOutcome(event.target.value)} placeholder="What should this help you do?" />
              </label>
            </div>
          )}

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

function getBrowserContext() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  };
}
