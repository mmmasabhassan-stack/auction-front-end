'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Auction, Item, ItemRow, Lot, LotSelectedSubItem, User } from '@/types/auction';
import { StorageKeys } from '@/constants/storageKeys';
import { storage } from '@/services/storage';
import { useTheme } from '@/hooks/useTheme';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';

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

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // focus first focusable element
    const focusable = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

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
  const [lotForm, setLotForm] = useState<Partial<Lot>>({});
  const [userForm, setUserForm] = useState<Partial<User>>({});
  const [editingIds, setEditingIds] = useState<{ auction?: string; lot?: string; item?: string; user?: string }>({});
  const emptyItemRow = (): ItemRow => ({
    itemNo: '',
    srNo: '',
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
    setLots(
      storage.getJSON<Lot[]>(StorageKeys.auctionLots, [
        { id: '#L-001', lotName: 'High-End Laptops & Tablets (Damaged)', lotType: 'expensive', itemCount: 3, basePrice: 10000, assignedAuction: '#A-001' },
        { id: '#L-002', lotName: 'Bulk Winter Wear (15 Coats)', lotType: 'general', itemCount: 15, basePrice: 1000, assignedAuction: '#A-001' },
      ])
    );
    setItems(
      storage.getJSON<Item[]>(StorageKeys.auctionItems, [
        { id: '#00123', parentName: 'Black Check-in Trolley Bag', subItemsCount: 4, dateFound: '2025-10-25' },
        { id: '#00124', parentName: 'Apple MacBook Pro (Stand-alone)', subItemsCount: 0, dateFound: '2025-10-26' },
      ])
    );
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
    setEditingIds((prev) => ({ ...prev, auction: auction?.id }));
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
    if (editingIds.auction) {
      setAuctions((prev) =>
        prev.map((a) => (a.id === editingIds.auction ? { ...a, ...auctionForm } as Auction : a))
      );
    } else {
      setAuctions((prev) => [
        ...prev,
        {
          ...(auctionForm as Auction),
          id: genId('#A'),
          lotsCount: auctionForm.lotsCount || 0,
          status: auctionForm.status || 'Draft',
        },
      ]);
    }
    setAuctionModalOpen(false);
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
    const selectedCount = lotForm.selectedSubItems?.length ?? 0;
    const safeItems = selectedCount > 0 ? selectedCount : (lotForm.itemCount ?? 0);
    if (editingIds.lot) {
      setLots((prev) =>
        prev.map((l) =>
          l.id === editingIds.lot
            ? { ...l, ...lotForm, basePrice: safeBase, itemCount: safeItems } as Lot
            : l
        )
      );
    } else {
      if (lots.some((l) => l.id === lotId)) {
        alert(`Lot ID "${lotId}" already exists. Please use a unique Lot ID.`);
        return;
      }
      setLots((prev) => [
        ...prev,
        {
          ...(lotForm as Lot),
          id: lotId,
          basePrice: safeBase,
          itemCount: safeItems,
        },
      ]);
    }
    setLotModalOpen(false);
  };

  const lotSelectedMap = useMemo(() => {
    const map = new Map<string, LotSelectedSubItem>();
    for (const s of lotForm.selectedSubItems ?? []) {
      map.set(`${s.parentId}::${s.rowIndex}`, s);
    }
    return map;
  }, [lotForm.selectedSubItems]);

  const toggleLotSubItem = (parent: Item, row: ItemRow, rowIndex: number) => {
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
        if (checked) {
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

  const saveItem = () => {
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
    if (cleaned.some((r) => !r.description)) {
      alert('Description is required for each row.');
      return;
    }

    let parentName = cleaned.map((r) => r.description).filter(Boolean).join(', ');
    if (!parentName) parentName = 'Parent Item';
    if (parentName.length > 60) parentName = parentName.slice(0, 57) + '...';
    const subItemsCount = cleaned.length;

    if (editingIds.item) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingIds.item
            ? ({
                ...it,
                parentName,
                subItemsCount,
                items: cleaned,
              } as Item)
            : it
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: genId('#I'),
          parentName,
          subItemsCount,
          items: cleaned,
          dateFound: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setItemModalOpen(false);
  };

  const parseExcelToRows = async (file: File): Promise<ItemRow[]> => {
    const buf = await file.arrayBuffer();
    // dynamic import keeps bundle lighter and avoids importing unless needed
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false }) as any[][];
    if (!grid || grid.length === 0) return [];

    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
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
    if (type === 'auction') setAuctions((p) => p.filter((x) => x.id !== id));
    if (type === 'lot') setLots((p) => p.filter((x) => x.id !== id)); 
    if (type === 'item') setItems((p) => p.filter((x) => x.id !== id));
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
                    <th>ID</th>
                    <th>Name</th>
                    <th>Date/Time</th>
                    <th>Lots</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(auctions, pagination.auctions).map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.auctionName}</td>
                      <td>
                        {a.auctionDate} | {a.startTime}
                      </td>
                      <td>{a.lotsCount}</td>
                      <td>{a.status}</td>
                      <td>
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
                    <th>ID</th>
                    <th>Name</th>
                    <th>Sub Items</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(items, pagination.items).map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.parentName}</td>
                      <td>{it.items?.length ?? it.subItemsCount ?? 0}</td>
                      <td>
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
              onChange={(e) => setAuctionForm({ ...auctionForm, auctionType: e.target.value as any })}
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
              onChange={(e) => setAuctionForm({ ...auctionForm, status: e.target.value as any })}
            >
              <option value="Draft">Draft</option>
              <option value="Scheduled">Scheduled</option>
            </select>
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
              onChange={(e) => setLotForm({ ...lotForm, lotType: e.target.value as any })}
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
              const selectedCountForParent = rows.reduce(
                (acc, _r, idx) => (lotSelectedMap.has(`${parent.id}::${idx}`) ? acc + 1 : acc),
                0
              );
              const parentChecked = selectedCountForParent > 0 && selectedCountForParent === rows.length;
              return (
                <div key={parent.id} className="parent-item-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={parentChecked}
                      onChange={(e) => setLotParentSelected(parent, e.target.checked)}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>
                        {parent.id} - {parent.parentName}
                      </strong>{' '}
                      <span style={{ opacity: 0.75 }}>
                        ({selectedCountForParent} sub-items selected)
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {rows.map((row, idx) => {
                      const key = `${parent.id}::${idx}`;
                      const checked = lotSelectedMap.has(key);
                      const sr = row.srNo || row.serialNumber || `SR #${idx + 1}`;
                      const qty = row.qty ?? 1;
                      const condition = row.condition || '—';
                      const label = row.description || parent.parentName;
                      return (
                        <div
                          key={key}
                          className="lot-selection-item"
                          style={{ marginBottom: 0, width: '100%' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLotSubItem(parent, row, idx)}
                          />
                          <div>
                            <p style={{ marginBottom: 4 }}>
                              <strong>{sr}</strong> - {label}
                            </p>
                            <p style={{ opacity: 0.8, margin: 0 }}>
                              Qty: {qty} | Condition: {condition}
                            </p>
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
                        className="btn-remove-row"
                        aria-label="Remove row"
                        onClick={() => {
                          if (itemRows.length <= 1) {
                            alert('Must have at least one row.');
                            return;
                          }
                          setItemRows(itemRows.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
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
            onClick={() => setItemRows((prev) => [...prev, emptyItemRow()])}
          >
            <i className="fas fa-plus" /> Add Row
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
              onChange={(e) => setUserForm({ ...userForm, status: e.target.value as any })}
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

