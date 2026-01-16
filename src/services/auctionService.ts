import { StorageKeys } from '@/constants/storageKeys';
import { storage } from '@/services/storage';
import type { Auction, Item, Lot, User } from '@/types/auction';

export const auctionService = {
  // Admin keys (shared by Admin screen)
  loadAdminAuctions(fallback: Auction[]) {
    return storage.getJSON<Auction[]>(StorageKeys.auctionEvents, fallback);
  },
  saveAdminAuctions(value: Auction[]) {
    storage.setJSON(StorageKeys.auctionEvents, value);
  },

  loadAdminLots(fallback: Lot[]) {
    return storage.getJSON<Lot[]>(StorageKeys.auctionLots, fallback);
  },
  saveAdminLots(value: Lot[]) {
    storage.setJSON(StorageKeys.auctionLots, value);
  },

  loadAdminItems(fallback: Item[]) {
    return storage.getJSON<Item[]>(StorageKeys.auctionItems, fallback);
  },
  saveAdminItems(value: Item[]) {
    storage.setJSON(StorageKeys.auctionItems, value);
  },

  loadAdminUsers(fallback: User[]) {
    return storage.getJSON<User[]>(StorageKeys.auctionUsers, fallback);
  },
  saveAdminUsers(value: User[]) {
    storage.setJSON(StorageKeys.auctionUsers, value);
  },
};

