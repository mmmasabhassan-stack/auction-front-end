export type Auction = {
  id: string;
  auctionName: string;
  auctionType: 'expensive' | 'general';
  auctionDate: string;
  startTime: string;
  endTime: string;
  defaultBidTimer: number;
  eventDescription?: string;
  status: 'Draft' | 'Scheduled';
  lotsCount: number;
};

export type Lot = {
  id: string;
  lotName: string;
  lotType: 'expensive' | 'general';
  itemCount: number;
  basePrice: number;
  assignedAuction?: string;
  /**
   * Optional: selected items/sub-items that belong to this lot (used by Admin "Add Items" flow).
   * Stored as a snapshot so lots remain stable even if the item catalog changes later.
   */
  selectedSubItems?: LotSelectedSubItem[];
};

export type LotSelectedSubItem = {
  parentId: string;
  parentName: string;
  rowIndex: number;
  row: ItemRow;
};

export type ItemRow = {
  description: string;
  condition: string;
  make: string;
  /**
   * Admin (table) fields
   */
  itemNo?: string;
  srNo?: string;
  qty?: number;
  makeNo?: string;

  /**
   * Legacy/Sub-admin fields (kept to avoid breaking existing screens)
   */
  serialNumber?: string;
  category?: string;
};

export type Item = {
  id: string;
  parentName: string;
  subItemsCount: number;
  /**
   * Legacy field (kept for backward compatibility with existing stored data).
   * New UI focuses on row-based sub-items instead.
   */
  dateFound?: string;
  /**
   * Detailed rows for the parent item (manual table / excel import).
   */
  items?: ItemRow[];
};

export type User = {
  id: string;
  name: string;
  cnic: string;
  paa: string;
  status: 'Enabled' | 'Disabled' | 'Pending';
  role: string;
};

