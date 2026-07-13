import { useEffect, useState } from 'react';
import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ErrorText, MutedText } from '../../components/Text';
import { useToast } from '../../components/ToastProvider';
import {
  createAddressBookEntry,
  deleteAddressBookEntry,
  listAddressBookEntries,
  updateAddressBookEntry,
} from './addressBookApi';
import type {
  AddressBookEntry,
  CreateAddressBookEntryInput,
  UpdateAddressBookEntryInput,
} from './addressBookTypes';

function shortAddr(value: string): string {
  if (value.length <= 18) return value;
  if (value.startsWith('Mx')) return `${value.slice(0, 8)}…${value.slice(-6)}`;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function sortByLabel(entries: AddressBookEntry[]): AddressBookEntry[] {
  return [...entries].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}

export function AddressBookModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    listAddressBookEntries()
      .then(setEntries)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load address book.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function upsertEntry(next: AddressBookEntry) {
    setEntries((prev) =>
      sortByLabel([...prev.filter((e) => e.id !== next.id), next]),
    );
  }

  async function handleCopy(entry: AddressBookEntry) {
    await navigator.clipboard.writeText(entry.address);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 2000);
  }

  async function handleDelete(id: string) {
    try {
      await deleteAddressBookEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
      showToast({ tone: 'success', title: 'Contact deleted' });
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Could not delete.',
      });
    }
  }

  return (
    <Modal title='Address book' onClose={onClose}>
      {loading && <MutedText>Loading…</MutedText>}
      {error && <ErrorText>{error}</ErrorText>}

      {addOpen && (
        <AddContactForm
          onSave={async (data) => {
            const entry = await createAddressBookEntry(data);
            upsertEntry(entry);
            setAddOpen(false);
            showToast({ tone: 'success', title: 'Contact added' });
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}

      {!loading && !error && entries.length === 0 && !addOpen && (
        <MutedText>No contacts saved yet.</MutedText>
      )}

      {entries.length > 0 && (
        <div className='divide-y divide-slate-100'>
          {entries.map((entry) => {
            if (editingId === entry.id) {
              return (
                <EditContactForm
                  key={entry.id}
                  entry={entry}
                  onSave={async (data) => {
                    const updated = await updateAddressBookEntry(
                      entry.id,
                      data,
                    );
                    upsertEntry(updated);
                    setEditingId(null);
                    showToast({ tone: 'success', title: 'Contact updated' });
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            if (deletingId === entry.id) {
              return (
                <DeleteConfirm
                  key={entry.id}
                  entry={entry}
                  onConfirm={() => handleDelete(entry.id)}
                  onCancel={() => setDeletingId(null)}
                />
              );
            }
            return (
              <ContactRow
                key={entry.id}
                entry={entry}
                copied={copiedId === entry.id}
                onCopy={() => handleCopy(entry)}
                onEdit={() => {
                  setEditingId(entry.id);
                  setDeletingId(null);
                  setAddOpen(false);
                }}
                onDelete={() => {
                  setDeletingId(entry.id);
                  setEditingId(null);
                  setAddOpen(false);
                }}
              />
            );
          })}
        </div>
      )}

      {!addOpen && (
        <div className='mt-4'>
          <Button
            type='button'
            variant='secondary'
            className='w-full'
            onClick={() => {
              setAddOpen(true);
              setEditingId(null);
              setDeletingId(null);
            }}
          >
            Add contact
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ContactRow({
  entry,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  entry: AddressBookEntry;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className='flex items-center gap-3 py-2.5 first:pt-0 last:pb-0'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-slate-900'>{entry.label}</p>
        <p className='text-xs text-slate-400 font-mono'>
          {shortAddr(entry.address)}
        </p>
        {entry.notes && (
          <p className='text-xs text-slate-500 mt-0.5'>{entry.notes}</p>
        )}
      </div>
      <div className='flex items-center gap-1 shrink-0'>
        <button
          type='button'
          title='Copy address'
          onClick={onCopy}
          className='p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'
        >
          {copied ? (
            <Check size={14} className='text-green-600' />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <button
          type='button'
          title='Edit contact'
          onClick={onEdit}
          className='p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'
        >
          <Pencil size={14} />
        </button>
        <button
          type='button'
          title='Delete contact'
          onClick={onDelete}
          className='p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors'
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AddContactForm({
  onSave,
  onCancel,
}: {
  onSave: (data: CreateAddressBookEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimLabel = label.trim();
    const trimAddress = address.trim();
    if (!trimLabel) {
      setFormError('Label is required.');
      return;
    }
    if (trimLabel.length > 80) {
      setFormError('Label must be 80 characters or fewer.');
      return;
    }
    if (!trimAddress) {
      setFormError('Address is required.');
      return;
    }
    if (!/^(Mx|0x)/i.test(trimAddress)) {
      setFormError('Address must start with Mx or 0x.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onSave({
        label: trimLabel,
        address: trimAddress,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not save contact.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='grid gap-3 pb-4 mb-2 border-b border-slate-100'
    >
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Label
          </span>
          <input
            type='text'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. Alice'
            maxLength={80}
            autoFocus
          />
        </label>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Address
          </span>
          <input
            type='text'
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder='Mx… or 0x…'
            autoComplete='off'
            spellCheck={false}
          />
        </label>
      </div>
      <label className='grid gap-1.5'>
        <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
          Notes{' '}
          <span className='normal-case font-normal text-slate-400'>
            (optional)
          </span>
        </span>
        <input
          type='text'
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Alice's main wallet"
        />
      </label>
      {formError && (
        <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
          <p className='text-sm text-red-700'>{formError}</p>
        </div>
      )}
      <div className='flex gap-2 justify-end'>
        <Button
          type='button'
          variant='secondary'
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Add contact'}
        </Button>
      </div>
    </form>
  );
}

function EditContactForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: AddressBookEntry;
  onSave: (data: UpdateAddressBookEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(entry.label);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimLabel = label.trim();
    if (!trimLabel) {
      setFormError('Label is required.');
      return;
    }
    if (trimLabel.length > 80) {
      setFormError('Label must be 80 characters or fewer.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onSave({ label: trimLabel, notes: notes.trim() || null });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not update contact.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='grid gap-3 py-3'>
      <p className='text-xs text-slate-400 font-mono truncate'>
        {entry.address}
      </p>
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Label
          </span>
          <input
            type='text'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </label>
        <label className='grid gap-1.5'>
          <span className='text-xs font-bold uppercase tracking-widest text-slate-500'>
            Notes{' '}
            <span className='normal-case font-normal text-slate-400'>
              (optional)
            </span>
          </span>
          <input
            type='text'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Optional note'
          />
        </label>
      </div>
      {formError && (
        <div className='rounded-xl bg-red-50 border border-red-200 p-3'>
          <p className='text-sm text-red-700'>{formError}</p>
        </div>
      )}
      <div className='flex gap-2 justify-end'>
        <Button
          type='button'
          variant='secondary'
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: AddressBookEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className='flex items-center justify-between gap-3 py-3'>
      <p className='text-sm text-slate-700'>
        Delete <span className='font-semibold'>{entry.label}</span>?
      </p>
      <div className='flex gap-2 shrink-0'>
        <Button type='button' variant='secondary' onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type='button'
          variant='danger'
          onClick={onConfirm}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
