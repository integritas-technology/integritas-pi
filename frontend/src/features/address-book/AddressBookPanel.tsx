import { useEffect, useState } from 'react';
import { Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { CopyableCode } from '../../components/CopyableCode';
import {
  DataTable,
  RowActions,
  TableIconButton,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from '../../components/DataTable';
import { ListPagerFilterBar } from '../../components/ListPagerFilterBar';
import { Modal } from '../../components/Modal';
import { TablePager } from '../../components/TablePager';
import { ErrorText, MutedText } from '../../components/Text';
import { useToast } from '../../components/ToastProvider';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '../../lib/paginated';
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

export function AddressBookPanel({
  actionsBlocked,
  addOpen,
  onCloseAdd,
}: {
  actionsBlocked: boolean;
  addOpen: boolean;
  onCloseAdd: () => void;
}) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [entryAction, setEntryAction] = useState<
    { entry: AddressBookEntry; mode: 'view' | 'edit' | 'delete' } | null
  >(null);

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

  const isLoading = loading || actionsBlocked;
  const trimmedQuery = query.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    if (!trimmedQuery) return true;
    return (
      entry.label.toLowerCase().includes(trimmedQuery) ||
      entry.address.toLowerCase().includes(trimmedQuery) ||
      (entry.notes ?? '').toLowerCase().includes(trimmedQuery)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEntries = filteredEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <>
      {error && <ErrorText>{error}</ErrorText>}

      {addOpen && (
        <AddContactForm
          onSave={async (data) => {
            const entry = await createAddressBookEntry(data);
            upsertEntry(entry);
            onCloseAdd();
            showToast({ tone: 'success', title: 'Contact added' });
          }}
          onCancel={onCloseAdd}
        />
      )}

      <ListPagerFilterBar
        page={currentPage}
        pageSize={pageSize}
        total={filteredEntries.length}
        totalPages={totalPages}
        q={query}
        searchPlaceholder='Name, address, or notes'
        disabled={isLoading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onQueryChange={(q) => {
          setQuery(q);
          setPage(1);
        }}
      />

      {isLoading ? (
        <div className='flex justify-center py-10'>
          <Loader2 className='size-10 animate-spin text-slate-400' aria-hidden='true' />
        </div>
      ) : filteredEntries.length === 0 ? (
        <MutedText>
          {trimmedQuery ? 'No matching contacts.' : 'No contacts saved yet.'}
        </MutedText>
      ) : (
        <TableWrap>
          <DataTable>
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeaderCellClass}>Name</th>
                <th className={tableHeaderCellClass}>Address</th>
                <th className={tableHeaderCellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.map((entry) => (
                <tr key={entry.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <span className='font-semibold text-slate-900'>{entry.label}</span>
                  </td>
                  <td className={tableCellClass}>
                    <code className='font-mono text-xs text-slate-500'>{shortAddr(entry.address)}</code>
                  </td>
                  <td className={tableCellClass}>
                    <RowActions>
                      <TableIconButton
                        type='button'
                        title='View contact'
                        aria-label={`View ${entry.label}`}
                        onClick={() => setEntryAction({ entry, mode: 'view' })}
                      >
                        <Eye size={16} />
                      </TableIconButton>
                      <TableIconButton
                        type='button'
                        title='Edit contact'
                        aria-label={`Edit ${entry.label}`}
                        onClick={() => setEntryAction({ entry, mode: 'edit' })}
                      >
                        <Pencil size={16} />
                      </TableIconButton>
                      <TableIconButton
                        danger
                        type='button'
                        title='Remove contact'
                        aria-label={`Remove ${entry.label}`}
                        onClick={() => setEntryAction({ entry, mode: 'delete' })}
                      >
                        <Trash2 size={16} />
                      </TableIconButton>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      )}
      <div className='mt-3'>
        <TablePager
          page={currentPage}
          pageSize={pageSize}
          total={filteredEntries.length}
          totalPages={totalPages}
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {entryAction && (
        <ContactDetailModal
          entry={entryAction.entry}
          initialMode={entryAction.mode}
          onClose={() => setEntryAction(null)}
          onSave={async (data) => {
            const updated = await updateAddressBookEntry(entryAction.entry.id, data);
            upsertEntry(updated);
            setEntryAction({ entry: updated, mode: 'view' });
            showToast({ tone: 'success', title: 'Contact updated' });
          }}
          onDelete={async () => {
            try {
              await deleteAddressBookEntry(entryAction.entry.id);
              setEntries((prev) => prev.filter((e) => e.id !== entryAction.entry.id));
              setEntryAction(null);
              showToast({ tone: 'success', title: 'Contact deleted' });
            } catch (err) {
              showToast({
                tone: 'error',
                title: 'Delete failed',
                message: err instanceof Error ? err.message : 'Could not delete.',
              });
              throw err;
            }
          }}
        />
      )}
    </>
  );
}

function ContactDetailModal({
  entry,
  initialMode = 'view',
  onClose,
  onSave,
  onDelete,
}: {
  entry: AddressBookEntry;
  initialMode?: 'view' | 'edit' | 'delete';
  onClose: () => void;
  onSave: (data: UpdateAddressBookEntryInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>(initialMode);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  }

  if (mode === 'edit') {
    return (
      <Modal title='Edit contact' onClose={onClose}>
        <EditContactForm
          entry={entry}
          onSave={async (data) => {
            await onSave(data);
            setMode('view');
          }}
          onCancel={() => setMode('view')}
        />
      </Modal>
    );
  }

  return (
    <Modal title={entry.label} onClose={onClose}>
      <div className='grid gap-4'>
        <div className='grid gap-1'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>Address</p>
          <CopyableCode value={entry.address} />
        </div>
        {entry.notes && (
          <div className='grid gap-1'>
            <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>Notes</p>
            <p className='text-sm text-slate-700'>{entry.notes}</p>
          </div>
        )}
        {mode === 'delete' ? (
          <div className='grid gap-3'>
            <p className='text-sm text-slate-700'>
              Delete <span className='font-semibold'>{entry.label}</span>? This cannot be undone.
            </p>
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='secondary' onClick={() => setMode('view')} disabled={deleting}>
                Cancel
              </Button>
              <Button type='button' variant='danger' onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={() => setMode('edit')}>
              Edit
            </Button>
            <Button type='button' variant='danger' onClick={() => setMode('delete')}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </Modal>
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
      className='grid gap-3 pb-4 mb-4 border-b border-slate-100'
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
    <form onSubmit={handleSubmit} className='grid gap-3'>
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
