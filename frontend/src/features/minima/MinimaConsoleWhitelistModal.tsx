import { useEffect, useState } from "react";
import type { MinimaConsoleCatalogEntry } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { LoadingDots } from "../../components/LoadingDots";
import { Modal } from "../../components/Modal";
import { Pill } from "../../components/Pill";
import { ErrorText } from "../../components/Text";
import { getConsoleWhitelist, updateConsoleWhitelist } from "./minimaConsoleApi";

const formClass = "grid gap-3";
const labelClass = "grid gap-3 font-bold text-slate-700";

function CommandRow({ entry, checked, onToggle }: { entry: MinimaConsoleCatalogEntry; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="truncate font-mono text-sm text-slate-800">{entry.verb}</span>
        <span className="truncate text-sm text-slate-500">{entry.label}</span>
      </span>
      <Pill tone={entry.kind === "read" ? "good" : "warn"}>{entry.kind}</Pill>
    </label>
  );
}

export function MinimaConsoleWhitelistModal({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<MinimaConsoleCatalogEntry[] | null>(null);
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConsoleWhitelist()
      .then((whitelist) => {
        if (cancelled) return;
        setCatalog(whitelist.catalog);
        setEnabledKeys(new Set(whitelist.enabledKeys));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load console whitelist");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleKey(key: string) {
    setEnabledKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const whitelist = await updateConsoleWhitelist([...enabledKeys], currentPassword);
      setCatalog(whitelist.catalog);
      setEnabledKeys(new Set(whitelist.enabledKeys));
      setCurrentPassword("");
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update console whitelist");
    } finally {
      setSaving(false);
    }
  }

  const readEntries = catalog?.filter((entry) => entry.kind === "read").sort((a, b) => a.verb.localeCompare(b.verb)) ?? [];
  const writeEntries = catalog?.filter((entry) => entry.kind === "write").sort((a, b) => a.verb.localeCompare(b.verb)) ?? [];

  return (
    <Modal title="Console command whitelist" onClose={onClose} closeDisabled={saving}>
      {loadError && <ErrorText>{loadError}</ErrorText>}
      {!catalog && !loadError && <LoadingDots />}
      {catalog && (
        <form onSubmit={(e) => void handleSave(e)} className={formClass}>
          <div className="grid gap-2">
            <h4 className="m-0">Read (default on)</h4>
            <div className="grid gap-1.5">
              {readEntries.map((entry) => (
                <CommandRow key={entry.key} entry={entry} checked={enabledKeys.has(entry.key)} onToggle={() => toggleKey(entry.key)} />
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <h4 className="m-0">Write (default off)</h4>
            <div className="grid gap-1.5">
              {writeEntries.map((entry) => (
                <CommandRow key={entry.key} entry={entry} checked={enabledKeys.has(entry.key)} onToggle={() => toggleKey(entry.key)} />
              ))}
            </div>
          </div>
          <label className={labelClass}>
            Current PIN or password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setSaveError(null);
              }}
              placeholder="Your current credential"
              autoComplete="current-password"
            />
          </label>
          {saveError && <ErrorText className="m-0">{saveError}</ErrorText>}
          <ButtonRow>
            <Button type="submit" disabled={saving || currentPassword.length === 0}>
              {saving ? "Saving…" : "Save whitelist"}
            </Button>
          </ButtonRow>
        </form>
      )}
    </Modal>
  );
}
