'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Auction, Item, ItemRow, Lot, LotSelectedSubItem, User } from '@/types/auction';
import { StorageKeys } from '@/constants/storageKeys';
import { storage } from '@/services/storage';
import { useTheme } from '@/hooks/useTheme';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';

const PAGE_SIZE = 10;

// uses shared `storage` service

const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}> = ({ open, title, onClose, children, footer, width = '600px' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    // focus first focusable element (only when opening)
    requestAnimationFrame(() => {
      const focusable = containerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" aria-label="Close modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

const Pagination: React.FC<{
  total: number;
  current: number;
  onChange: (page: number) => void;
}> = ({ total, current, onChange }) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const go = (p: number) => onChange(Math.min(Math.max(1, p), pages));
  return (
    <div className="pagination">
      <a className="pagination-prev" onClick={() => go(current - 1)}>
        « Previous
      </a>
      <span className="pagination-numbers">
        Page {current} of {pages}
      </span>
      <a className="pagination-next" onClick={() => go(current + 1)}>
        Next »
      </a>
      <span className="pagination-info">
        (Showing {(current - 1) * PAGE_SIZE + 1}-
        {Math.min(current * PAGE_SIZE, total)} of <strong>{total}</strong>)
      </span>
    </div>
  );
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<
    'auction-start' | 'auctions' | 'lots' | 'items' | 'users'
  >('auction-start');

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [auctionForm, setAuctionForm] = useState<Partial<Auction>>({});
  const [auctionDraftId, setAuctionDraftId] = useState<string>('');
  const [auctionLotIds, setAuctionLotIds] = useState<string[]>([]);
  const [lotForm, setLotForm] = useState<Partial<Lot>>({});
  const [userForm, setUserForm] = useState<Partial<User>>({});
  const [editingIds, setEditingIds] = useState<{ auction?: string; lot?: string; item?: string; user?: string }>({});
  const emptyItemRow = (): ItemRow => ({
    itemNo: '',
    // Default SR# for a new (parent) item row
    srNo: '1',
    description: '',
    qty: 0,
    condition: '',
    make: '',
    makeNo: '',
  });
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyItemRow()]);
  const itemExcelInputRef = useRef<HTMLInputElement | null>(null);

  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [viewSubItemsOpen, setViewSubItemsOpen] = useState(false);
  const [viewSubItemsItem, setViewSubItemsItem] = useState<Item | null>(null);
  const [viewLotItemsOpen, setViewLotItemsOpen] = useState(false);
  const [viewLot, setViewLot] = useState<Lot | null>(null);
  const [viewAuctionLotsOpen, setViewAuctionLotsOpen] = useState(false);
  const [viewAuction, setViewAuction] = useState<Auction | null>(null);
  const [lotItemsModalOpen, setLotItemsModalOpen] = useState(false);
  const [lotItemsSearch, setLotItemsSearch] = useState('');

  const [pagination, setPagination] = useState({
    auctions: 1,
    lots: 1,
    items: 1,
    users: 1,
  });

  const [currentLotIndex, setCurrentLotIndex] = useState<number>(-1);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Utility bar
  const [currentDate, setCurrentDate] = useState('--');
  const [currentTime, setCurrentTime] = useState('--');
  const [textSize, setTextSize] = useState(1);
  const { isDark, toggleTheme } = useTheme();

  const errorMessageFromUnknown = (e: unknown): string | null => {
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message;
    }
    return null;
  };

  const apiErrorFromUnknown = (data: unknown): string | null => {
    if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
    return null;
  };

  const parseSrNumber = (value: unknown): number => {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const addItemRow = () => {
    setItemRows((prev) => [...prev, emptyItemRow()]);
  };

  const addSubItemRow = (parentIndex: number) => {
    setItemRows((prev) => {
      const parent = prev[parentIndex];
      const itemNo = String(parent?.itemNo ?? '').trim();
      if (!itemNo) {
        alert('Please enter Item No. first.');
        return prev;
      }

      const baseSr = Math.max(1, parseSrNumber(parent?.srNo));
      const maxExistingSrForItem = prev
        .filter((r) => String(r?.itemNo ?? '').trim() === itemNo)
        .reduce((max, r) => Math.max(max, parseSrNumber(r?.srNo)), 0);

      const nextSr = Math.max(baseSr, maxExistingSrForItem) + 1;
      const newRow: ItemRow = {
        ...emptyItemRow(),
        itemNo,
        srNo: String(nextSr),
      };

      return [...prev.slice(0, parentIndex + 1), newRow, ...prev.slice(parentIndex + 1)];
    });
  };

  const loadItemsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/items', { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorFromUnknown(data) || `Failed to load items (${res.status})`);

      const next: Item[] = (Array.isArray(data) ? data : []).map((r: unknown) => {
        const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
        return {
          id: String(obj.id ?? ''),
          parentName: String(obj.parentName ?? obj.name ?? ''),
          subItemsCount: Number(obj.subItemsCount ?? obj.sub_item ?? 0) || 0,
          items: Array.isArray(obj.items) ? (obj.items as ItemRow[]) : undefined,
        };
      });
      setItems(next.filter((x) => x.id && x.parentName));
      return true;
    } catch {
      return false;
    }
  };

  const loadLotsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/lots', { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorFromUnknown(data) || `Failed to load lots (${res.status})`);

      const next: Lot[] = (Array.isArray(data) ? data : []).map((r: unknown) => {
        const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
        return {
          id: String(obj.id ?? ''),
          lotName: String(obj.lotName ?? ''),
          lotType: (String(obj.lotType ?? 'general') as Lot['lotType']) ?? 'general',
          itemCount: Number(obj.itemCount ?? 0) || 0,
          basePrice: Number(obj.basePrice ?? 0) || 0,
          assignedAuction: obj.assignedAuction ? String(obj.assignedAuction) : undefined,
          selectedSubItems: Array.isArray(obj.selectedSubItems) ? (obj.selectedSubItems as LotSelectedSubItem[]) : [],
        };
      });
      setLots(next.filter((x) => x.id && x.lotName));
      return true;
    } catch {
      return false;
    }
  };

  const loadAuctionsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auctions', { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorFromUnknown(data) || `Failed to load auctions (${res.status})`);

      const next: Auction[] = (Array.isArray(data) ? data : []).map((r: unknown) => {
        const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
        return {
          id: String(obj.id ?? ''),
          auctionName: String(obj.auctionName ?? ''),
          auctionType: (String(obj.auctionType ?? 'general') as Auction['auctionType']) ?? 'general',
          auctionDate: String(obj.auctionDate ?? ''),
          startTime: String(obj.startTime ?? ''),
          endTime: String(obj.endTime ?? ''),
          defaultBidTimer: Number(obj.defaultBidTimer ?? 15) || 15,
          status: (String(obj.status ?? 'Draft') as Auction['status']) ?? 'Draft',
          lotsCount: Number(obj.lotsCount ?? 0) || 0,
          eventDescription: obj.eventDescription ? String(obj.eventDescription) : undefined,
        };
      });
      setAuctions(next.filter((x) => x.id && x.auctionName));
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      );
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load data
  useEffect(() => {
    void (async () => {
      const okAuctions = await loadAuctionsFromDb();
      if (okAuctions) return;
      setAuctions(
        storage.getJSON<Auction[]>(StorageKeys.auctionEvents, [
          {
            id: '#A-001',
            auctionName: 'Costly Items Auction Q1 2026',
            auctionType: 'expensive',
            auctionDate: '2026-03-10',
            startTime: '11:00',
            endTime: '12:00',
            defaultBidTimer: 15,
            eventDescription: 'Sample event',
            status: 'Scheduled',
            lotsCount: 2,
          },
        ])
      );
    })();
    void (async () => {
      const okLots = await loadLotsFromDb();
      if (okLots) return;
      setLots(
        storage.getJSON<Lot[]>(StorageKeys.auctionLots, [
          { id: '#L-001', lotName: 'High-End Laptops & Tablets (Damaged)', lotType: 'expensive', itemCount: 3, basePrice: 10000, assignedAuction: '#A-001' },
          { id: '#L-002', lotName: 'Bulk Winter Wear (15 Coats)', lotType: 'general', itemCount: 15, basePrice: 1000, assignedAuction: '#A-001' },
        ])
      );
    })();
    // Prefer DB items; fallback to local storage sample data for first-time setup.
    void (async () => {
      const ok = await loadItemsFromDb();
      if (ok) return;
      setItems(
        storage.getJSON<Item[]>(StorageKeys.auctionItems, [
          { id: '#00123', parentName: 'Black Check-in Trolley Bag', subItemsCount: 4, dateFound: '2025-10-25' },
          { id: '#00124', parentName: 'Apple MacBook Pro (Stand-alone)', subItemsCount: 0, dateFound: '2025-10-26' },
        ])
      );
    })();
    setUsers(
      storage.getJSON<User[]>(StorageKeys.auctionUsers, [
        { id: '1001', name: 'Ali Khan', cnic: '42101-1234567-3', paa: 'PAA-1234', status: 'Enabled', role: 'Bidder' },
        { id: '1002', name: 'Sara Ahmed', cnic: '42101-9876543-9', paa: 'PAA-5678', status: 'Disabled', role: 'Bidder' },
      ])
    );
  }, []);

  // Persist
  useEffect(() => storage.setJSON(StorageKeys.auctionEvents, auctions), [auctions]);
  useEffect(() => storage.setJSON(StorageKeys.auctionLots, lots), [lots]);
  useEffect(() => storage.setJSON(StorageKeys.auctionItems, items), [items]);
  useEffect(() => storage.setJSON(StorageKeys.auctionUsers, users), [users]);

  // Timer logic
  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const currentLot = useMemo(() => {
    if (currentLotIndex < 0 || lots.length === 0) return null;
    return lots[currentLotIndex % lots.length];
  }, [currentLotIndex, lots]);

  const nextLotPreview = useMemo(() => {
    if (lots.length === 0) return null;
    const idx = currentLotIndex < 0 ? 0 : (currentLotIndex + 1) % lots.length;
    return lots[idx];
  }, [currentLotIndex, lots]);

  const startAuction = () => {
    if (lots.length === 0) return;
    const startIndex = currentLotIndex === -1 ? 0 : currentLotIndex;
    setCurrentLotIndex(startIndex);
    setTimeRemaining(timerSeconds);
    setIsRunning(true);
  };

  const pauseAuction = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const goNextLot = () => {
    if (lots.length === 0) return;
    setCurrentLotIndex((prev) => (prev + 1) % lots.length);
    setTimeRemaining(timerSeconds);
    setIsRunning(false);
  };

  // Helpers
  const genId = (prefix: string) => `${prefix}-${Date.now()}`;

  const openAuctionModal = (auction?: Auction) => {
    const id = auction?.id ?? genId('#A');
    setEditingIds((prev) => ({ ...prev, auction: auction?.id }));
    setAuctionDraftId(id);
    // Preselect lots already assigned to this auction (edit) or none (new).
    setAuctionLotIds(lots.filter((l) => l.assignedAuction === id).map((l) => l.id));
    setAuctionForm(
      auction || {
        auctionName: '',
        auctionType: 'general',
        auctionDate: '',
        startTime: '',
        endTime: '',
        defaultBidTimer: 15,
        status: 'Draft',
        lotsCount: 0,
      }
    );
    setAuctionModalOpen(true);
  };

  const saveAuction = () => {
    if (!auctionForm.auctionName || !auctionForm.auctionDate || !auctionForm.startTime || !auctionForm.endTime) return;
    const lotsCount = auctionLotIds.length;
    const id = editingIds.auction ?? (auctionDraftId || genId('#A'));

    void (async () => {
      try {
        const payload = {
          auctionId: id,
          auctionName: String(auctionForm.auctionName ?? ''),
          auctionType: auctionForm.auctionType ?? 'general',
          auctionDate: String(auctionForm.auctionDate ?? ''),
          startTime: String(auctionForm.startTime ?? ''),
          endTime: String(auctionForm.endTime ?? ''),
          defaultBidTimer: auctionForm.defaultBidTimer ?? 15,
          status: auctionForm.status ?? 'Draft',
          eventDescription: auctionForm.eventDescription ?? '',
          lotIds: auctionLotIds,
          lotsCount,
        };

        const url = editingIds.auction ? `/api/auctions/${encodeURIComponent(id)}` : '/api/auctions';
        const method = editingIds.auction ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorFromUnknown(data) || `Failed to save auction (${res.status})`);

        await loadAuctionsFromDb();
        await loadLotsFromDb(); // refresh assigned_auction flags
        setAuctionModalOpen(false);
      } catch (e: unknown) {
        alert(errorMessageFromUnknown(e) || 'Failed to save auction to database');
      }
    })();
  };

  const openLotModal = (lot?: Lot) => {
    setEditingIds((prev) => ({ ...prev, lot: lot?.id }));
    setLotForm(
      lot || {
        id: '',
        lotName: '',
        lotType: 'general',
        itemCount: 0,
        basePrice: 0,
        selectedSubItems: [],
      }
    );
    setLotModalOpen(true);
  };

  const saveLot = () => {
    const lotId = String(lotForm.id ?? '').trim();
    if (!editingIds.lot && !lotId) {
      alert('Lot ID is required.');
      return;
    }
    if (!lotForm.lotName) {
      alert('Lot Name is required.');
      return;
    }
    const safeBase = lotForm.basePrice ?? 0;
    void (async () => {
      try {
        const payload = {
          lotId: editingIds.lot ?? lotId,
          lotName: String(lotForm.lotName ?? ''),
          lotType: (lotForm.lotType ?? 'general') as Lot['lotType'],
          basePrice: safeBase,
          assignedAuction: (lotForm as Lot).assignedAuction,
          selectedSubItems: (lotForm.selectedSubItems ?? []).map((s) => ({
            itemNo: s.row?.itemNo,
            srNo: s.row?.srNo,
          })),
        };

        const url = editingIds.lot ? `/api/lots/${encodeURIComponent(editingIds.lot)}` : '/api/lots';
        const method = editingIds.lot ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorFromUnknown(data) || `Failed to save lot (${res.status})`);

        await loadLotsFromDb();
        setLotModalOpen(false);
      } catch (e: unknown) {
        alert(errorMessageFromUnknown(e) || 'Failed to save lot to database');
      }
    })();
  };

  const lotSelectedMap = useMemo(() => {
    const map = new Map<string, LotSelectedSubItem>();
    for (const s of lotForm.selectedSubItems ?? []) {
      map.set(`${s.parentId}::${s.rowIndex}`, s);
    }
    return map;
  }, [lotForm.selectedSubItems]);

  const lotLockedMap = useMemo(() => {
    // Mark sub-items that are already selected in OTHER lots (so we can flag/disable them).
    const currentLotId = String(editingIds.lot ?? lotForm.id ?? '').trim();
    const locked = new Map<string, { lotId: string; lotName: string }>();
    for (const l of lots) {
      if (currentLotId && l.id === currentLotId) continue;
      for (const s of l.selectedSubItems ?? []) {
        locked.set(`${s.parentId}::${s.rowIndex}`, { lotId: l.id, lotName: l.lotName });
      }
    }
    return locked;
  }, [lots, editingIds.lot, lotForm.id]);

  const toggleLotSubItem = (parent: Item, row: ItemRow, rowIndex: number) => {
    const locked = lotLockedMap.get(`${parent.id}::${rowIndex}`);
    if (locked) {
      alert(`This sub-item is already assigned to Lot "${locked.lotName || locked.lotId}".`);
      return;
    }
    setLotForm((prev) => {
      const current = prev.selectedSubItems ?? [];
      const map = new Map<string, LotSelectedSubItem>(current.map((s) => [`${s.parentId}::${s.rowIndex}`, s]));
      const key = `${parent.id}::${rowIndex}`;
      if (map.has(key)) {
        map.delete(key);
      } else {
        map.set(key, {
          parentId: parent.id,
          parentName: parent.parentName,
          rowIndex,
          row,
        });
      }
      const next = Array.from(map.values());
      return { ...prev, selectedSubItems: next, itemCount: next.length };
    });
  };

  const setLotParentSelected = (parent: Item, checked: boolean) => {
    setLotForm((prev) => {
      const current = prev.selectedSubItems ?? [];
      const map = new Map<string, LotSelectedSubItem>(current.map((s) => [`${s.parentId}::${s.rowIndex}`, s]));
      const rows = parent.items && parent.items.length > 0 ? parent.items : [{ description: parent.parentName, condition: '', make: '' } as ItemRow];
      rows.forEach((row, idx) => {
        const key = `${parent.id}::${idx}`;
        const locked = lotLockedMap.get(key);
        if (checked) {
          // Don't allow selecting rows that are already taken by other lots.
          if (locked) return;
          map.set(key, { parentId: parent.id, parentName: parent.parentName, rowIndex: idx, row });
        } else {
          map.delete(key);
        }
      });
      const next = Array.from(map.values());
      return { ...prev, selectedSubItems: next, itemCount: next.length };
    });
  };

  const openItemModal = (item?: Item) => {
    setEditingIds((prev) => ({ ...prev, item: item?.id }));
    setItemRows(item?.items && item.items.length > 0 ? item.items : [emptyItemRow()]);
    setItemModalOpen(true);
  };

  const openViewSubItems = (item: Item) => {
    setViewSubItemsItem(item);
    setViewSubItemsOpen(true);
  };

  const openViewLotItems = (lot: Lot) => {
    setViewLot(lot);
    setViewLotItemsOpen(true);
  };

  const openViewAuctionLots = (auction: Auction) => {
    setViewAuction(auction);
    setViewAuctionLotsOpen(true);
  };

  const auctionStatusClass = (status: string) => {
    const s = String(status ?? '').toLowerCase();
    if (s === 'draft') return 'status-draft';
    if (s === 'scheduled') return 'status-scheduled';
    return 'status-pending';
  };

  const saveItem = async () => {
    const cleaned = itemRows
      .map((r) => ({
        ...r,
        itemNo: (r.itemNo ?? '').toString().trim(),
        srNo: (r.srNo ?? '').toString().trim(),
        description: (r.description ?? '').toString().trim(),
        condition: (r.condition ?? '').toString().trim(),
        make: (r.make ?? '').toString().trim(),
        makeNo: (r.makeNo ?? '').toString().trim(),
        qty: Number.isFinite(Number(r.qty)) ? Number(r.qty) : 0,
      }))
      .filter((r) =>
        [r.itemNo, r.srNo, r.description, String(r.qty || ''), r.condition, r.make, r.makeNo].some(
          (v) => String(v).trim() !== ''
        )
      );

    if (cleaned.length === 0) {
      alert('Please add at least one row (or import from Excel).');
      return;
    }
    if (cleaned.some((r) => !r.itemNo)) {
      alert('Item No. is required for each row.');
      return;
    }
    const itemNoStr = cleaned[0]?.itemNo ?? '';
    const itemNo = Number.parseInt(itemNoStr, 10);
    if (!Number.isFinite(itemNo)) {
      alert('Item No. must be a valid number.');
      return;
    }
    if (cleaned.some((r) => r.itemNo !== itemNoStr)) {
      alert('All rows must have the same Item No.');
      return;
    }
    const srNos = cleaned.map((r) => Number.parseInt(String(r.srNo ?? ''), 10));
    if (srNos.some((n) => !Number.isFinite(n) || n <= 0)) {
      alert('SR# must be a positive number for each row.');
      return;
    }
    const srSet = new Set(srNos);
    if (srSet.size !== srNos.length) {
      alert('SR# values must be unique within the same Item No.');
      return;
    }
    if (cleaned.some((r) => !r.description)) {
      alert('Description is required for each row.');
      return;
    }

    try {
      if (editingIds.item) {
        const res = await fetch(`/api/items/${encodeURIComponent(editingIds.item)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemNo, rows: cleaned }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed to update item (${res.status})`);
      } else {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemNo, rows: cleaned }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed to create item (${res.status})`);
      }

      await loadItemsFromDb();
      setItemModalOpen(false);
    } catch (e: unknown) {
      alert(errorMessageFromUnknown(e) || 'Failed to save item to database');
    }
  };

  const parseExcelToRows = async (file: File): Promise<ItemRow[]> => {
    const buf = await file.arrayBuffer();
    // dynamic import keeps bundle lighter and avoids importing unless needed
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false }) as unknown[][];
    if (!grid || grid.length === 0) return [];

    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const headerRowIdx = Math.max(
      0,
      grid.findIndex((row) => row?.some((c) => ['description', 'qty', 'quantity', 'sr'].some((k) => norm(c).includes(k))))
    );
    const header = (grid[headerRowIdx] ?? []).map(norm);

    const col = (aliases: string[]) => {
      const idx = header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
      return idx >= 0 ? idx : -1;
    };

    const idxItemNo = col(['item no', 'item no.', 'item number', 'item']);
    const idxSr = col(['sr #', 'sr#', 'sr no', 'sr no.', 'serial', 'serial number']);
    const idxDesc = col(['description', 'desc']);
    const idxQty = col(['qty', 'qty.', 'quantity']);
    const idxCond = col(['condition', 'nature/condition', 'nature']);
    const idxMake = col(['make', 'make of item', 'trade mark', 'trademark']);
    const idxMakeNo = col(['make no', 'make no.', 'identification', 'make no (identification)']);

    const dataStart = headerRowIdx + 1;
    const rows = grid.slice(dataStart).map((r) => {
      const byIndex = (i: number, fallbackIndex: number) => {
        const idx = i >= 0 ? i : fallbackIndex;
        return String(r?.[idx] ?? '').trim();
      };
      const qtyStr = idxQty >= 0 ? r?.[idxQty] : r?.[3];
      const qty = Number(String(qtyStr ?? '').trim()) || 0;
      return {
        itemNo: byIndex(idxItemNo, 0),
        srNo: byIndex(idxSr, 1),
        description: byIndex(idxDesc, 2),
        qty,
        condition: byIndex(idxCond, 4),
        make: byIndex(idxMake, 5),
        makeNo: byIndex(idxMakeNo, 6),
      } as ItemRow;
    });

    return rows.filter((r) =>
      [r.itemNo, r.srNo, r.description, String(r.qty || ''), r.condition, r.make, r.makeNo].some((v) => String(v).trim() !== '')
    );
  };

  const openUserModal = (user?: User) => {
    setEditingIds((prev) => ({ ...prev, user: user?.id }));
    setUserForm(
      user || {
        name: '',
        cnic: '',
        paa: '',
        status: 'Enabled',
        role: 'Bidder',
      }
    );
    setUserModalOpen(true);
  };

  const saveUser = () => {
    if (!userForm.name || !userForm.cnic) return;
    if (editingIds.user) {
      setUsers((prev) => prev.map((u) => (u.id === editingIds.user ? { ...u, ...userForm } as User : u)));
    } else {
      setUsers((prev) => [...prev, { ...(userForm as User), id: genId('#U') }]);
    }
    setUserModalOpen(false);
  };

  const deleteRow = (type: 'auction' | 'lot' | 'item' | 'user', id: string) => {
    if (type === 'auction') {
      const typed = window.prompt('Type DELETE to confirm deleting this auction:');
      if (!typed) return;
      const ok = ['DELETE', 'DELET'].includes(typed.trim().toUpperCase());
      if (!ok) {
        alert('Delete cancelled (you must type DELETE).');
        return;
      }
      void (async () => {
        try {
          // Use query-param delete to avoid issues with "#" in IDs.
          const res = await fetch(`/api/auctions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (!res.ok) {
            const data: unknown = await res.json().catch(() => null);
            throw new Error(apiErrorFromUnknown(data) || `Failed to delete auction (${res.status})`);
          }
          await loadAuctionsFromDb();
          await loadLotsFromDb();
        } catch (e: unknown) {
          alert(errorMessageFromUnknown(e) || 'Failed to delete auction from database');
        }
      })();
      return;
    }
    if (type === 'lot') {
      void (async () => {
        try {
          const res = await fetch(`/api/lots/${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (!res.ok) {
            const data: unknown = await res.json().catch(() => null);
            throw new Error(apiErrorFromUnknown(data) || `Failed to delete lot (${res.status})`);
          }
          await loadLotsFromDb();
        } catch (e: unknown) {
          alert(errorMessageFromUnknown(e) || 'Failed to delete lot from database');
        }
      })();
      return;
    }
    if (type === 'item') {
      void (async () => {
        try {
          const res = await fetch(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (!res.ok) {
            const data: unknown = await res.json().catch(() => null);
            throw new Error(apiErrorFromUnknown(data) || `Failed to delete item (${res.status})`);
          }
          await loadItemsFromDb();
        } catch (e: unknown) {
          alert(errorMessageFromUnknown(e) || 'Failed to delete item from database');
        }
      })();
      return;
    }
    if (type === 'user') setUsers((p) => p.filter((x) => x.id !== id));
  };

  const paginated = <T,>(data: T[], page: number) => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={`page-shell ${isDark ? 'dark' : ''}`} style={{ fontSize: `${textSize}em` }}>
      {/* Top bar */}
      <div className="utility-bar">
        <div className="utility-bar-content">
          <div className="utility-left">
            <div className="date-time">
              <i className="far fa-calendar" /> {currentDate}
              <span className="separator">|</span>
              <i className="far fa-clock" /> {currentTime}
            </div>
          </div>
          <div className="utility-right">
            <button className="utility-btn" aria-label="Toggle theme" onClick={toggleTheme}>
              <i className={`fas fa-${isDark ? 'sun' : 'moon'}`} />
            </button>
            <div className="text-size-controls">
              <button className="utility-btn" onClick={() => setTextSize((v) => Math.max(0.9, v - 0.1))}>
                A-
              </button>
              <button className="utility-btn" onClick={() => setTextSize((v) => Math.min(1.3, v + 0.1))}>
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <Header title="IIAP Lost & Found Auction System" rightText="Admin Dashboard" rightHref="/admin" />

      <main className="dashboard-container">
        <Sidebar
          title="Admin Menu"
          items={[
            {
              key: 'auction-start',
              label: 'Auction Start Dashboard',
              iconClass: 'fas fa-fire',
              active: activeTab === 'auction-start',
              onClick: () => setActiveTab('auction-start'),
            },
            {
              key: 'auctions',
              label: 'Create/Manage Auction',
              iconClass: 'fas fa-calendar-plus',
              active: activeTab === 'auctions',
              onClick: () => setActiveTab('auctions'),
            },
            {
              key: 'lots',
              label: 'Create/Manage Lots',
              iconClass: 'fas fa-boxes-stacked',
              active: activeTab === 'lots',
              onClick: () => setActiveTab('lots'),
            },
            {
              key: 'items',
              label: 'Create/Manage Items',
              iconClass: 'fas fa-list-check',
              active: activeTab === 'items',
              onClick: () => setActiveTab('items'),
            },
            {
              key: 'users',
              label: 'User Management',
              iconClass: 'fas fa-users',
              active: activeTab === 'users',
              onClick: () => setActiveTab('users'),
            },
          ]}
        />

        <section className="content-area">
          {activeTab === 'auction-start' && (
            <div className="dashboard-content active-content">
              <h2>🔥 Auction Start Dashboard</h2>
              <p className="page-subtitle live-lead">Start, pause, and switch lots for the live auction.</p>

              <div className="live-control-box">
                <div className="event-info">
                  <h3>Current Lot</h3>
                  <p className="live-lead">
                    {currentLot ? `${currentLot.id} - ${currentLot.lotName}` : 'Awaiting start'}
                  </p>
                  <div className="status-line">
                    <span className="status-label">LIVE Status:</span>
                    <span className={`status-pill ${isRunning ? 'pill-live' : 'pill-stopped'}`}>
                      <i className={`fas ${isRunning ? 'fa-circle-play' : 'fa-circle-stop'}`} style={{ marginRight: 8 }} />
                      {isRunning ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                </div>

                <div className="lot-progression">
                  <div className="lot-card-primary">
                    <div className="card-header">
                      <div className="icon-circle icon-circle-primary">
                        <i className="fas fa-gavel" />
                      </div>
                      <h4 className="card-title card-title-primary">Current Lot</h4>
                    </div>
                    <div className="card-content card-content-primary">
                      {currentLot ? (
                        <p>
                          {currentLot.id} - {currentLot.lotName}
                        </p>
                      ) : (
                        <p className="live-lead">Awaiting start</p>
                      )}
                    </div>
                  </div>
                  <div className="lot-card-warning">
                    <div className="card-header">
                      <div className="icon-circle icon-circle-warning">
                        <i className="fas fa-arrow-right" />
                      </div>
                      <h4 className="card-title card-title-warning">Next Lot</h4>
                    </div>
                    <div className="card-content card-content-warning">
                      {nextLotPreview ? (
                        <p>
                          {nextLotPreview.id} - {nextLotPreview.lotName}
                        </p>
                      ) : (
                        <p>None</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lot-card-info timer-display-admin">
                  <div className="card-header">
                    <div className="icon-circle icon-circle-info">
                      <i className="fas fa-clock" />
                    </div>
                    <h4 className="card-title card-title-info">Bid Timer</h4>
                  </div>
                  <div className="timer-grid">
                    <div className="timer-input-wrapper">
                      <label className="timer-label">Timer Value (Seconds)</label>
                      <input
                        type="number"
                        value={timerSeconds}
                        min={1}
                        onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 15)}
                      />
                    </div>
                    <div className="timer-display-wrapper">
                      <label className="timer-label">Live Countdown</label>
                      <div className="timer-display">
                        {timeRemaining.toString().padStart(2, '0')}s
                      </div>
                    </div>
                  </div>
                </div>

                <div className="control-actions">
                  <button
                    className="control-btn btn-success btn-large"
                    onClick={startAuction}
                    disabled={isRunning || lots.length === 0}
                    aria-disabled={isRunning || lots.length === 0}
                    title={lots.length === 0 ? 'Add lots first' : isRunning ? 'Already running' : 'Start'}
                  >
                    {isRunning ? 'Running' : 'Start'}
                  </button>
                  <button
                    className="control-btn btn-danger btn-large"
                    onClick={pauseAuction}
                    disabled={!isRunning}
                    aria-disabled={!isRunning}
                    title={!isRunning ? 'Not running' : 'Pause'}
                  >
                    Pause
                  </button>
                  <button
                    className="control-btn btn-info btn-large"
                    onClick={goNextLot}
                    disabled={lots.length === 0}
                    aria-disabled={lots.length === 0}
                    title={lots.length === 0 ? 'Add lots first' : 'Next lot'}
                  >
                    Next Lot
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auctions' && (
            <div className="dashboard-content active-content">
              <h2>🗓️ Create/Manage Auctions</h2>
              <button className="action-btn btn-create" onClick={() => openAuctionModal()}>
                + New Auction
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>TYPE</th>
                    <th>Date/Time</th>
                    <th>Lots</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(auctions, pagination.auctions).map((a) => (
                    <tr key={a.id}>
                      <td>{a.auctionName}</td>
                      <td style={{ textTransform: 'capitalize' }}>{a.auctionType}</td>
                      <td>{a.auctionDate} {a.startTime}</td>
                      <td>{lots.filter((l) => l.assignedAuction === a.id).length}</td>
                      <td>
                        <StatusBadge statusClass={auctionStatusClass(a.status)}>{a.status}</StatusBadge>
                      </td>
                      <td>
                        <button className="action-btn btn-info" onClick={() => openViewAuctionLots(a)}>
                          View Lots
                        </button>
                        <button className="action-btn btn-edit" onClick={() => openAuctionModal(a)}>
                          Edit
                        </button>
                        <button className="action-btn btn-delete" onClick={() => deleteRow('auction', a.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                total={auctions.length}
                current={pagination.auctions}
                onChange={(p) => setPagination((prev) => ({ ...prev, auctions: p }))}
              />
            </div>
          )}

          {activeTab === 'lots' && (
            <div className="dashboard-content active-content">
              <h2>📦 Create/Manage Lots</h2>
              <button className="action-btn btn-create" onClick={() => openLotModal()}>
                + New Lot
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Items</th>
                    <th>Base Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(lots, pagination.lots).map((l) => (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{l.lotName}</td>
                      <td>{l.itemCount}</td>
                      <td>{(l.basePrice ?? 0).toLocaleString()}</td>
                      <td>
                        <button className="action-btn btn-info" onClick={() => openViewLotItems(l)}>
                          View Items
                        </button>
                        <button className="action-btn btn-edit" onClick={() => openLotModal(l)}>
                          Edit
                        </button>
                        <button className="action-btn btn-delete" onClick={() => deleteRow('lot', l.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                total={lots.length}
                current={pagination.lots}
                onChange={(p) => setPagination((prev) => ({ ...prev, lots: p }))}
              />
            </div>
          )}

          {activeTab === 'items' && (
            <div className="dashboard-content active-content">
              <h2>📝 Create/Manage Items</h2>
              <button className="action-btn btn-create" onClick={() => openItemModal()}>
                + New Item
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ITEM NO</th>
                    <th>SR #</th>
                    <th>DESCRIPTION</th>
                    <th>QTY</th>
                    <th>CONDITION</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(items, pagination.items).map((it) => (
                    // Option A (Items + sub_items): one Item No with many sub-items.
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>
                        {(() => {
                          const rows = it.items ?? [];
                          if (rows.length === 0) return '-';
                          const srNums = rows
                            .map((r) => Number.parseInt(String(r?.srNo ?? ''), 10))
                            .filter((n) => Number.isFinite(n)) as number[];
                          if (srNums.length === 0) return String(rows[0]?.srNo ?? '-');
                          const min = Math.min(...srNums);
                          const max = Math.max(...srNums);
                          return min === max ? String(min) : `${min}..${max}`;
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const rows = it.items ?? [];
                          if (rows.length === 0) return '-';
                          const first = rows[0];
                          const more = rows.length - 1;
                          const base = String(first?.description ?? '').trim() || '-';
                          return more > 0 ? `${base} (+${more} more)` : base;
                        })()}
                      </td>
                      <td>{it.items?.[0]?.qty ?? '-'}</td>
                      <td>{it.items?.[0]?.condition ?? '-'}</td>
                      <td>
                        <button className="action-btn btn-info" onClick={() => openViewSubItems(it)}>
                          View
                        </button>
                        <button className="action-btn btn-edit" onClick={() => openItemModal(it)}>
                          Edit
                        </button>
                        <button className="action-btn btn-delete" onClick={() => deleteRow('item', it.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                total={items.length}
                current={pagination.items}
                onChange={(p) => setPagination((prev) => ({ ...prev, items: p }))}
              />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="dashboard-content active-content">
              <h2>👥 User Management</h2>
              <button className="action-btn btn-create" onClick={() => openUserModal()}>
                + New User
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>CNIC</th>
                    <th>PAA</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(users, pagination.users).map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.name}</td>
                      <td>{u.cnic}</td>
                      <td>{u.paa}</td>
                      <td>{u.status}</td>
                      <td>{u.role}</td>
                      <td>
                        <button className="action-btn btn-edit" onClick={() => openUserModal(u)}>
                          Edit
                        </button>
                        <button className="action-btn btn-delete" onClick={() => deleteRow('user', u.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                total={users.length}
                current={pagination.users}
                onChange={(p) => setPagination((prev) => ({ ...prev, users: p }))}
              />
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* Modals */}
      <Modal
        open={viewAuctionLotsOpen}
        title={viewAuction ? `Lots in Auction (${viewAuction.auctionName})` : 'Lots in Auction'}
        onClose={() => setViewAuctionLotsOpen(false)}
        width="1100px"
        footer={
          <>
            <button className="btn-next" onClick={() => setViewAuctionLotsOpen(false)}>
              Close
            </button>
          </>
        }
      >
        {viewAuction ? (
          (() => {
            const assigned = lots.filter((l) => l.assignedAuction === viewAuction.id);
            if (assigned.length === 0) return <p style={{ margin: 0 }}>No lots assigned to this auction.</p>;
            return (
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Items</th>
                    <th>Base Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assigned.map((l) => (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{l.lotName}</td>
                      <td>{l.itemCount ?? 0}</td>
                      <td>{(l.basePrice ?? 0).toLocaleString()}</td>
                      <td>
                        <button className="action-btn btn-info" onClick={() => openViewLotItems(l)}>
                          View Items
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()
        ) : (
          <p style={{ margin: 0 }}>No auction selected.</p>
        )}
      </Modal>

      <Modal
        open={viewLotItemsOpen}
        title={viewLot ? `Lot Items (${viewLot.id})` : 'Lot Items'}
        onClose={() => setViewLotItemsOpen(false)}
        width="1100px"
        footer={
          <>
            <button className="btn-next" onClick={() => setViewLotItemsOpen(false)}>
              Close
            </button>
          </>
        }
      >
        {viewLot && (viewLot.selectedSubItems?.length ?? 0) > 0 ? (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>ITEM NO</th>
                <th>SR #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Condition</th>
                <th>Make</th>
                <th>Make No</th>
              </tr>
            </thead>
            <tbody>
              {(viewLot.selectedSubItems ?? []).map((s, idx) => (
                <tr key={`${viewLot.id}-${s.parentId}-${s.rowIndex}-${idx}`}>
                  <td>{s.row?.itemNo ?? ''}</td>
                  <td>{s.row?.srNo ?? ''}</td>
                  <td>{s.row?.description ?? ''}</td>
                  <td>{s.row?.qty ?? 0}</td>
                  <td>{s.row?.condition ?? ''}</td>
                  <td>{s.row?.make ?? ''}</td>
                  <td>{s.row?.makeNo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ margin: 0 }}>No items are attached to this lot yet. Use “Edit” → “Add Items”.</p>
        )}
      </Modal>

      <Modal
        open={viewSubItemsOpen}
        title={viewSubItemsItem ? `Sub Items (Item No. ${viewSubItemsItem.id})` : 'Sub Items'}
        onClose={() => setViewSubItemsOpen(false)}
        width="1000px"
        footer={
          <>
            <button className="btn-next" onClick={() => setViewSubItemsOpen(false)}>
              Close
            </button>
          </>
        }
      >
        {viewSubItemsItem && (viewSubItemsItem.items?.length ?? 0) > 0 ? (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>SR #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Condition</th>
                <th>Make</th>
                <th>Make No</th>
              </tr>
            </thead>
            <tbody>
              {(viewSubItemsItem.items ?? []).map((r, idx) => (
                <tr key={`${viewSubItemsItem.id}-${r.srNo ?? idx}`}>
                  <td>{r.srNo ?? ''}</td>
                  <td>{r.description ?? ''}</td>
                  <td>{r.qty ?? 0}</td>
                  <td>{r.condition ?? ''}</td>
                  <td>{r.make ?? ''}</td>
                  <td>{r.makeNo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ margin: 0 }}>No sub-items found.</p>
        )}
      </Modal>

      <Modal
        open={auctionModalOpen}
        title={editingIds.auction ? 'Edit Auction' : 'New Auction'}
        onClose={() => setAuctionModalOpen(false)}
        footer={
          <>
            <button className="btn-cancel" onClick={() => setAuctionModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" onClick={saveAuction}>
              Save
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Auction Name</label>
            <input
              value={auctionForm.auctionName || ''}
              onChange={(e) => setAuctionForm({ ...auctionForm, auctionName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Auction Type</label>
            <select
              value={auctionForm.auctionType || 'general'}
              onChange={(e) =>
                setAuctionForm({ ...auctionForm, auctionType: e.target.value as Auction['auctionType'] })
              }
            >
              <option value="expensive">Expensive</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={auctionForm.auctionDate || ''}
              onChange={(e) => setAuctionForm({ ...auctionForm, auctionDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="time"
              value={auctionForm.startTime || ''}
              onChange={(e) => setAuctionForm({ ...auctionForm, startTime: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <input
              type="time"
              value={auctionForm.endTime || ''}
              onChange={(e) => setAuctionForm({ ...auctionForm, endTime: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Default Bid Timer (s)</label>
            <input
              type="number"
              min={1}
              value={auctionForm.defaultBidTimer || 15}
              onChange={(e) =>
                setAuctionForm({ ...auctionForm, defaultBidTimer: parseInt(e.target.value) || 15 })
              }
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={auctionForm.status || 'Draft'}
              onChange={(e) => setAuctionForm({ ...auctionForm, status: e.target.value as Auction['status'] })}
            >
              <option value="Draft">Draft</option>
              <option value="Scheduled">Scheduled</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Assign Lots</label>
            <div className="lots-selection-container">
              {lots.length === 0 ? (
                <p style={{ margin: 0 }}>No lots found. Create lots first.</p>
              ) : (
                lots.map((l) => {
                  const lockedToOther =
                    !!l.assignedAuction && l.assignedAuction !== auctionDraftId;
                  const checked = auctionLotIds.includes(l.id);
                  return (
                    <div
                      key={l.id}
                      className="lot-selection-item"
                      style={{ opacity: lockedToOther ? 0.6 : 1 }}
                      onClick={() => {
                        if (lockedToOther) return;
                        setAuctionLotIds((prev) =>
                          prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                        );
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={lockedToOther}
                        onChange={() => {
                          if (lockedToOther) return;
                          setAuctionLotIds((prev) =>
                            prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                          );
                        }}
                      />
                      <div>
                        <label style={{ fontWeight: 700 }}>{l.lotName || '(No name)'}</label>
                        <p style={{ margin: '4px 0 0 0' }}>
                          ID: {l.id} · Items: {l.itemCount ?? 0} · Base Price: {(l.basePrice ?? 0).toLocaleString()}
                          {lockedToOther ? ` · Assigned to ${l.assignedAuction}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <p style={{ marginTop: 10 }}>
              Selected lots: <strong>{auctionLotIds.length}</strong>
            </p>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Description</label>
            <textarea
              value={auctionForm.eventDescription || ''}
              onChange={(e) => setAuctionForm({ ...auctionForm, eventDescription: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={lotModalOpen}
        title={editingIds.lot ? 'Edit Lot' : 'New Lot'}
        onClose={() => setLotModalOpen(false)}
        footer={
          <>
            <button className="btn-cancel" onClick={() => setLotModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" onClick={saveLot}>
              Save
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Lot ID</label>
            <input
              value={lotForm.id || ''}
              onChange={(e) => setLotForm({ ...lotForm, id: e.target.value })}
              placeholder="Enter Lot ID (e.g. #L-001)"
              disabled={!!editingIds.lot}
            />
          </div>
          <div className="form-group">
            <label>Lot Name</label>
            <input
              value={lotForm.lotName || ''}
              onChange={(e) => setLotForm({ ...lotForm, lotName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Lot Type</label>
            <select
              value={lotForm.lotType || 'general'}
              onChange={(e) => setLotForm({ ...lotForm, lotType: e.target.value as Lot['lotType'] })}
            >
              <option value="expensive">Expensive</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Item Count</label>
            <input
              type="number"
              min={0}
              value={lotForm.selectedSubItems?.length ?? lotForm.itemCount ?? 0}
              readOnly
            />
          </div>
          <div className="form-group">
            <label>Base Price</label>
            <input
              type="number"
              min={0}
              value={lotForm.basePrice || 0}
              onChange={(e) => setLotForm({ ...lotForm, basePrice: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label>Items</label>
            <button
              type="button"
              className="action-btn btn-create"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setLotItemsModalOpen(true)}
            >
              Add Items ({lotForm.selectedSubItems?.length ?? 0})
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={lotItemsModalOpen}
        title="Add Items"
        onClose={() => setLotItemsModalOpen(false)}
        width="1100px"
        footer={
          <>
            <button className="btn-cancel" onClick={() => setLotItemsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" onClick={() => setLotItemsModalOpen(false)}>
              Done
            </button>
          </>
        }
      >
        <input
          className="search-input"
          placeholder="Search items by name, description, or ID..."
          value={lotItemsSearch}
          onChange={(e) => setLotItemsSearch(e.target.value)}
        />

        <div className="items-hierarchy-container">
          {items
            .filter((p) => {
              const q = lotItemsSearch.trim().toLowerCase();
              if (!q) return true;
              const parentHit =
                (p.id ?? '').toLowerCase().includes(q) || (p.parentName ?? '').toLowerCase().includes(q);
              const rows = p.items && p.items.length > 0 ? p.items : [];
              const rowHit = rows.some((r) => (r.description ?? '').toLowerCase().includes(q));
              return parentHit || rowHit;
            })
            .map((parent) => {
              const rows =
                parent.items && parent.items.length > 0
                  ? parent.items
                  : ([{ description: parent.parentName, condition: '', make: '' } as ItemRow] as ItemRow[]);
              const selectableIdxs = rows
                .map((_r, idx) => idx)
                .filter((idx) => !lotLockedMap.has(`${parent.id}::${idx}`));
              const selectedCountForParent = selectableIdxs.reduce(
                (acc, idx) => (lotSelectedMap.has(`${parent.id}::${idx}`) ? acc + 1 : acc),
                0
              );
              const lockedCountForParent = rows.length - selectableIdxs.length;
              const parentChecked =
                selectableIdxs.length > 0 && selectedCountForParent === selectableIdxs.length;
              const parentSomeSelected = selectedCountForParent > 0 && !parentChecked;
              return (
                <div key={parent.id} className="parent-item-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={parentChecked}
                      disabled={selectableIdxs.length === 0}
                      ref={(el) => {
                        if (el) el.indeterminate = parentSomeSelected;
                      }}
                      onChange={(e) => setLotParentSelected(parent, e.target.checked)}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>
                        {parent.id} - {parent.parentName}
                      </strong>{' '}
                      <span style={{ opacity: 0.75 }}>
                        ({selectedCountForParent} sub-items selected)
                      </span>
                      {lockedCountForParent > 0 && (
                        <span style={{ opacity: 0.75 }}>
                          {' '}
                          · {lockedCountForParent} locked
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {rows.map((row, idx) => {
                      const key = `${parent.id}::${idx}`;
                      const checked = lotSelectedMap.has(key);
                      const locked = lotLockedMap.get(key);
                      const sr = row.srNo || row.serialNumber || `SR #${idx + 1}`;
                      const qty = row.qty ?? 1;
                      const condition = row.condition || '—';
                      const label = row.description || parent.parentName;
                      return (
                        <div
                          key={key}
                          className="lot-selection-item"
                          style={{ marginBottom: 0, width: '100%', opacity: locked && !checked ? 0.6 : 1 }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!!locked && !checked}
                            onChange={() => toggleLotSubItem(parent, row, idx)}
                          />
                          <div>
                            <p style={{ marginBottom: 4 }}>
                              <strong>{sr}</strong> - {label}
                            </p>
                            <p style={{ opacity: 0.8, margin: 0 }}>
                              Qty: {qty} | Condition: {condition}
                            </p>
                            {locked && !checked && (
                              <p style={{ opacity: 0.85, margin: '6px 0 0 0', fontSize: 12 }}>
                                Assigned to lot: <strong>{locked.lotName || locked.lotId}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </Modal>

      <Modal
        open={itemModalOpen}
        title={editingIds.item ? 'Edit Item' : 'New Item'}
        onClose={() => setItemModalOpen(false)}
        footer={
          <>
            <button className="btn-cancel" onClick={() => setItemModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" onClick={saveItem}>
              Save
            </button>
          </>
        }
        width="1000px"
      >
        <div className="excel-import-section">
          <button
            type="button"
            className="btn-excel-import"
            onClick={() => itemExcelInputRef.current?.click()}
          >
            <i className="fas fa-file-excel" />
            Add items from Excel
          </button>
          <input
            ref={itemExcelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = await parseExcelToRows(file);
                setItemRows(rows.length > 0 ? rows : [emptyItemRow()]);
              } catch (err) {
                console.error(err);
                alert('Could not read the Excel file. Please check the format and try again.');
              } finally {
                // allow re-uploading same file
                e.target.value = '';
              }
            }}
          />
        </div>

        <div className="manual-entry-section">
          <div className="section-title">Enter Item Information Manually</div>
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th>ITEM NO.</th>
                  <th>SR #</th>
                  <th>DESCRIPTION</th>
                  <th>QTY.</th>
                  <th>NATURE/CONDITION OF ITEM</th>
                  <th>MAKE OF ITEM (TRADE MARK)</th>
                  <th>MAKE NO. (IDENTIFICATION)</th>
                  <th className="action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        className="excel-input"
                        value={row.itemNo}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], itemNo: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="Item No."
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        value={row.srNo}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], srNo: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="SR #"
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        value={row.description}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        type="number"
                        min={0}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], qty: Number(e.target.value) || 0 };
                          setItemRows(next);
                        }}
                        placeholder="Qty"
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        value={row.condition}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], condition: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="Select condition"
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        value={row.make}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], make: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="Make"
                      />
                    </td>
                    <td>
                      <input
                        className="excel-input"
                        value={row.makeNo}
                        onChange={(e) => {
                          const next = [...itemRows];
                          next[idx] = { ...next[idx], makeNo: e.target.value };
                          setItemRows(next);
                        }}
                        placeholder="Make No."
                      />
                    </td>
                    <td className="action-col">
                      <button
                        type="button"
                        className="btn-add-row"
                        aria-label="Sub-Item"
                        title="Sub-Item"
                        onClick={() => addSubItemRow(idx)}
                      >
                        Sub-Item
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn-add-row"
            onClick={addItemRow}
          >
            <i className="fas fa-plus" /> Add Item
          </button>
        </div>
      </Modal>

      <Modal
        open={userModalOpen}
        title={editingIds.user ? 'Edit User' : 'New User'}
        onClose={() => setUserModalOpen(false)}
        footer={
          <>
            <button className="btn-cancel" onClick={() => setUserModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" onClick={saveUser}>
              Save
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input
              value={userForm.name || ''}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>CNIC</label>
            <input
              value={userForm.cnic || ''}
              onChange={(e) => setUserForm({ ...userForm, cnic: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>PAA No.</label>
            <input
              value={userForm.paa || ''}
              onChange={(e) => setUserForm({ ...userForm, paa: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={userForm.status || 'Enabled'}
              onChange={(e) => setUserForm({ ...userForm, status: e.target.value as User['status'] })}
            >
              <option value="Enabled">Enabled</option>
              <option value="Disabled">Disabled</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="form-group">
            <label>Role</label>
            <input
              value={userForm.role || 'Bidder'}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

