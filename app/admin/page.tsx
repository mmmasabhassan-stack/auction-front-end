'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Auction, Item, Lot, User } from '../../types/auction';
import { useTheme } from '../../hooks/useTheme';
import { AppHeader } from '../../components/AppHeader';
import { AppFooter } from '../../components/AppFooter';
import { AppSidebar } from '../../components/AppSidebar';

const PAGE_SIZE = 10;

const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  },
};

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
          <button className="modal-close" aria-label="Close modal" onClick={onClose}>
            &times;
          </button>
          <h2>{title}</h2>
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
  const [itemForm, setItemForm] = useState<Partial<Item>>({});
  const [userForm, setUserForm] = useState<Partial<User>>({});
  const [editingIds, setEditingIds] = useState<{ auction?: string; lot?: string; item?: string; user?: string }>({});

  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

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
      storage.get<Auction[]>('auctionEvents', [
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
      storage.get<Lot[]>('auctionLots', [
        { id: '#L-001', lotName: 'High-End Laptops & Tablets (Damaged)', lotType: 'expensive', itemCount: 3, basePrice: 10000, assignedAuction: '#A-001' },
        { id: '#L-002', lotName: 'Bulk Winter Wear (15 Coats)', lotType: 'general', itemCount: 15, basePrice: 1000, assignedAuction: '#A-001' },
      ])
    );
    setItems(
      storage.get<Item[]>('auctionItems', [
        { id: '#00123', parentName: 'Black Check-in Trolley Bag', subItemsCount: 4, dateFound: '2025-10-25' },
        { id: '#00124', parentName: 'Apple MacBook Pro (Stand-alone)', subItemsCount: 0, dateFound: '2025-10-26' },
      ])
    );
    setUsers(
      storage.get<User[]>('auctionUsers', [
        { id: '1001', name: 'Ali Khan', cnic: '42101-1234567-3', paa: 'PAA-1234', status: 'Enabled', role: 'Bidder' },
        { id: '1002', name: 'Sara Ahmed', cnic: '42101-9876543-9', paa: 'PAA-5678', status: 'Disabled', role: 'Bidder' },
      ])
    );
  }, []);

  // Persist
  useEffect(() => storage.set('auctionEvents', auctions), [auctions]);
  useEffect(() => storage.set('auctionLots', lots), [lots]);
  useEffect(() => storage.set('auctionItems', items), [items]);
  useEffect(() => storage.set('auctionUsers', users), [users]);

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
        lotName: '',
        lotType: 'general',
        itemCount: 1,
        basePrice: 0,
        assignedAuction: auctions[0]?.id,
      }
    );
    setLotModalOpen(true);
  };

  const saveLot = () => {
    if (!lotForm.lotName) return;
    const safeBase = lotForm.basePrice ?? 0;
    const safeItems = lotForm.itemCount ?? 1;
    if (editingIds.lot) {
      setLots((prev) =>
        prev.map((l) =>
          l.id === editingIds.lot
            ? { ...l, ...lotForm, basePrice: safeBase, itemCount: safeItems } as Lot
            : l
        )
      );
    } else {
      setLots((prev) => [
        ...prev,
        {
          ...(lotForm as Lot),
          id: genId('#L'),
          basePrice: safeBase,
          itemCount: safeItems,
        },
      ]);
    }
    setLotModalOpen(false);
  };

  const openItemModal = (item?: Item) => {
    setEditingIds((prev) => ({ ...prev, item: item?.id }));
    setItemForm(
      item || {
        parentName: '',
        subItemsCount: 0,
        dateFound: '',
      }
    );
    setItemModalOpen(true);
  };

  const saveItem = () => {
    if (!itemForm.parentName) return;
    if (editingIds.item) {
      setItems((prev) => prev.map((it) => (it.id === editingIds.item ? { ...it, ...itemForm } as Item : it)));
    } else {
      setItems((prev) => [
        ...prev,
        { ...(itemForm as Item), id: genId('#I'), subItemsCount: itemForm.subItemsCount || 0 },
      ]);
    }
    setItemModalOpen(false);
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
      <AppHeader title="IIAP Lost & Found Auction System" rightText="Admin Dashboard" rightHref="/admin" />

      <main className="dashboard-container">
        <AppSidebar
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
                    <th>Auction</th>
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
                      <td>{l.assignedAuction || '—'}</td>
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
                    <th>Date Found</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(items, pagination.items).map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.parentName}</td>
                      <td>{it.subItemsCount}</td>
                      <td>{it.dateFound}</td>
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

      <AppFooter />

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
              min={1}
              value={lotForm.itemCount || 1}
              onChange={(e) => setLotForm({ ...lotForm, itemCount: parseInt(e.target.value) || 1 })}
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
            <label>Assigned Auction</label>
            <select
              value={lotForm.assignedAuction || ''}
              onChange={(e) => setLotForm({ ...lotForm, assignedAuction: e.target.value })}
            >
              <option value="">Unassigned</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.auctionName}
                </option>
              ))}
            </select>
          </div>
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
      >
        <div className="form-row">
          <div className="form-group">
            <label>Item Name</label>
            <input
              value={itemForm.parentName || ''}
              onChange={(e) => setItemForm({ ...itemForm, parentName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Sub Items Count</label>
            <input
              type="number"
              min={0}
              value={itemForm.subItemsCount || 0}
              onChange={(e) =>
                setItemForm({ ...itemForm, subItemsCount: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div className="form-group">
            <label>Date Found</label>
            <input
              type="date"
              value={itemForm.dateFound || ''}
              onChange={(e) => setItemForm({ ...itemForm, dateFound: e.target.value })}
            />
          </div>
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

