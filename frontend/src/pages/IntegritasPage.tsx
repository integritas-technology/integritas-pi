import { useEffect, useState } from 'react';
import type { IntegritasConfig } from '../app/types';
import { JsonPreview } from '../components/JsonPreview';
import { Modal } from '../components/Modal';
import { Page } from '../components/Page';
import { IconButton } from '../components/Button';
import { useToast } from '../components/ToastProvider';
import { deleteJson, getJson, postJson } from '../lib/api';
import {
  checkIntegritasApiKey,
  stampFile,
  verifyProofFile,
} from '../features/integritas/integritasApi';
import type { IntegritasApiKeyCheck } from '../features/integritas/integritasTypes';
import { integritasErrorToast } from '../features/integritas/integritasErrors';
import { IntegritasRuntimeConfig } from '../features/integritas/IntegritasRuntimeConfig';
import { StampFilePanel } from '../features/integritas/StampFilePanel';
import { StampResultModal } from '../features/integritas/StampResultModal';
import type { IntegritasProofRecord } from '../features/integritas/integritasTypes';
import { VerifyProofPanel } from '../features/integritas/VerifyProofPanel';
import { SettingsIcon } from 'lucide-react';

export function IntegritasPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<IntegritasConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [stampUpload, setStampUpload] = useState<File | null>(null);
  const [verifyUpload, setVerifyUpload] = useState<File | null>(null);
  const [stampModalRecord, setStampModalRecord] =
    useState<IntegritasProofRecord | null>(null);
  const [stampModalDetails, setStampModalDetails] = useState<unknown>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [keyCheck, setKeyCheck] = useState<IntegritasApiKeyCheck | null>(null);
  const [keyCheckBusy, setKeyCheckBusy] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => {
      showToast({
        tone: 'error',
        title: 'Could not load Integritas config',
        message: err.message,
      });
    });
  }, []);

  async function refreshConfig() {
    setConfig(await getJson<IntegritasConfig>('/api/integritas/config'));
  }

  async function runKeyCheck() {
    setKeyCheckBusy(true);
    try {
      setKeyCheck(await checkIntegritasApiKey());
    } catch (err) {
      setKeyCheck(null);
      showToast({
        tone: 'error',
        title: 'Could not check Integritas API key',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setKeyCheckBusy(false);
    }
  }

  useEffect(() => {
    if (!configOpen) {
      setKeyCheck(null);
      setKeyCheckBusy(false);
      return;
    }

    if (!config?.hasApiKey) {
      setKeyCheck(null);
      return;
    }

    void runKeyCheck();
  }, [configOpen, config?.hasApiKey]);

  function showIntegritasError(error: unknown) {
    const { title, message } = integritasErrorToast(error);
    showToast({ tone: 'error', title, message, timeoutMs: 9000 });
    const err = error as { errorCode?: string };
    if (err.errorCode === 'unauthorized') {
      setConfigOpen(true);
    }
  }

  async function run(action: () => Promise<unknown>, showResult = true) {
    setBusy(true);
    try {
      const response = await action();
      if (showResult) setResult(response);
      return response;
    } catch (err) {
      showIntegritasError(err);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      eyebrow='Integritas'
      title='Prove local data'
      desc='Generate timestamp proofs from local files, poll proof status, export proof payloads, and verify JSON proof files.'
      action={
        <IconButton
          variant='primary'
          onClick={() => setConfigOpen(true)}
        >
          <SettingsIcon size={20} />
        </IconButton>
      }
    >
      {configOpen && (
        <Modal
          title='Runtime configuration'
          onClose={() => setConfigOpen(false)}
        >
          <IntegritasRuntimeConfig
            config={config}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            keyCheck={keyCheck}
            keyCheckBusy={keyCheckBusy}
            busy={busy}
            onCheckKey={() => void runKeyCheck()}
            onSave={() =>
              run(async () => {
                const response = await postJson('/api/integritas/api-key', {
                  apiKey: apiKeyInput,
                });
                setApiKeyInput('');
                await refreshConfig();
                await runKeyCheck();
                showToast({
                  tone: 'success',
                  title: 'Integritas API key saved',
                });
                return response;
              }, false)
            }
            onClear={() =>
              run(async () => {
                const result = await deleteJson<{ hasApiKey: boolean }>(
                  '/api/integritas/api-key',
                );
                await refreshConfig();
                if (result.hasApiKey) {
                  await runKeyCheck();
                } else {
                  setKeyCheck(null);
                }
                showToast({
                  tone: 'success',
                  title: 'Integritas API key cleared',
                });
                return null;
              }, false)
            }
          />
        </Modal>
      )}

      {stampModalRecord && (
        <StampResultModal
          record={stampModalRecord}
          technicalDetails={stampModalDetails ?? undefined}
          onClose={() => {
            setStampModalRecord(null);
            setStampModalDetails(null);
          }}
        />
      )}

      <div className='integritas-upload-grid'>
        <StampFilePanel
          file={stampUpload}
          setFile={setStampUpload}
          busy={busy}
          onStamp={() =>
            run(async () => {
              if (!stampUpload) throw new Error('Select a file first');
              const response = await stampFile(stampUpload);
              setStampUpload(null);
              setStampModalRecord(response.record);
              setStampModalDetails(response);
              return response;
            }, false)
          }
        />
        <VerifyProofPanel
          file={verifyUpload}
          setFile={(file) => {
            setVerifyUpload(file);
            setVerifyResult(null);
          }}
          busy={busy}
          result={verifyResult}
          onVerifyFile={() =>
            run(async () => {
              if (!verifyUpload)
                throw new Error('Select a proof JSON file first');
              const response = await verifyProofFile(verifyUpload);
              setVerifyUpload(null);
              setVerifyResult(response);
              setResult(null);
              return response;
            }, false)
          }
        />
      </div>

      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
