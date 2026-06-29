import { deleteJson, getJson, patchJson, postJson } from '../../lib/api';
import type {
  AddressBookEntry,
  CreateAddressBookEntryInput,
  UpdateAddressBookEntryInput,
} from './addressBookTypes';

export function listAddressBookEntries() {
  return getJson<AddressBookEntry[]>('/api/wallet/address-book');
}

export function createAddressBookEntry(body: CreateAddressBookEntryInput) {
  return postJson<AddressBookEntry>('/api/wallet/address-book', body);
}

export function updateAddressBookEntry(id: string, body: UpdateAddressBookEntryInput) {
  return patchJson<AddressBookEntry>(`/api/wallet/address-book/${id}`, body);
}

export async function deleteAddressBookEntry(id: string): Promise<void> {
  await deleteJson<object>(`/api/wallet/address-book/${id}`);
}
