export type AddressBookEntry = {
  id: string;
  label: string;
  address: string;
  notes: string | null;
  created_at: string;
};

export type CreateAddressBookEntryInput = {
  label: string;
  address: string;
  notes?: string | null;
};

export type UpdateAddressBookEntryInput = {
  label?: string;
  notes?: string | null;
};
