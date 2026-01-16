import type { Auction as SharedAuction, Item as SharedItem, Lot as SharedLot } from './auction';

// Relaxed shapes used by Sub-Admin page (keeps minimal structural change)
export type SubAdminAuction = Partial<Omit<SharedAuction, 'id'>> & {
  id: string | number;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  lots?: SubAdminLot[];
  [k: string]: any;
};

export type SubAdminLot = Partial<Omit<SharedLot, 'id'>> & {
  id: number;
  name?: string;
  description?: string;
  items?: SubAdminAuctionItem[];
  lotName?: string;
  lotType?: 'expensive' | 'general';
  itemCount?: number;
  basePrice?: number;
  assignedAuction?: string;
  [k: string]: any;
};

export type SubAdminAuctionItem = Partial<Omit<SharedItem, 'id'>> & {
  id?: string;
  items?: {
    serialNumber: string;
    category: string;
    description: string;
    condition: string;
    make: string;
  }[];
  [k: string]: any;
};

