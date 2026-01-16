'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { UserAuction as Auction, UserBid as Bid, UserNotification as Notification, UserWon as Won } from '@/types/user';
import { storage } from '@/services/storage';
import { useTheme } from '@/hooks/useTheme';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

const PAGE_SIZE = 10;

// uses shared `storage` service

const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, title, onClose, children, footer }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const focusable = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()} ref={containerRef}>
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

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState<'active' | 'my-bids' | 'won' | 'notifications'>('active');

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [won, setWon] = useState<Won[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string>('1001');

  const [pagination, setPagination] = useState({
    active: 1,
    myBids: 1,
    won: 1,
    notifications: 1,
  });

  const [search, setSearch] = useState({ active: '', bids: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'scheduled' | 'ended'>('all');
  const [bidStatusFilter, setBidStatusFilter] = useState<'all' | 'winning' | 'outbid' | 'live' | 'won'>('all');

  const [biddingModalOpen, setBiddingModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [lotOptions, setLotOptions] = useState<
    { id: string; lotName: string; itemCount: number; basePrice: number }[]
  >([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState<string>('');
  const { isDark, toggleTheme } = useTheme();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentDate, setCurrentDate] = useState('--');
  const [currentTime, setCurrentTime] = useState('--');

  useEffect(() => {
    // Temporary auth: use a stored user id, fallback to 1001.
    const id = typeof window !== 'undefined' ? String(localStorage.getItem('userId') ?? '').trim() : '';
    if (id) setUserId(id);
  }, []);

  const formatUserDateTime = (date: string, time24: string): string => {
    const d = String(date ?? '').trim();
    const t = String(time24 ?? '').trim();
    if (!d || !t) return '';
    // date is already YYYY-MM-DD in our admin flow
    const [hhRaw, mmRaw = '00'] = t.split(':');
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return `${d} | ${t}`;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hh12 = ((hh + 11) % 12) + 1;
    return `${d} | ${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
  };

  const computeUserStatus = (auctionDate: string, startTime: string, endTime: string): Auction['status'] => {
    const d = String(auctionDate ?? '').trim();
    const s = String(startTime ?? '').trim();
    const e = String(endTime ?? '').trim();
    if (!d || !s) return 'scheduled';
    const start = new Date(`${d}T${s}:00`);
    const end = e ? new Date(`${d}T${e}:00`) : null;
    const now = new Date();
    if (Number.isNaN(start.getTime())) return 'scheduled';
    if (now < start) return 'scheduled';
    if (end && !Number.isNaN(end.getTime()) && now > end) return 'ended';
    return 'live';
  };

  const loadAuctionsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auctions', { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string') ? (data as any).error : `Failed to load auctions (${res.status})`);

      const rows = Array.isArray(data) ? data : [];
      const next: Auction[] = rows
        .map((r: unknown) => {
          const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
          const id = String(obj.id ?? '').trim();
          const name = String(obj.auctionName ?? '').trim();
          const auctionDate = String(obj.auctionDate ?? '').trim();
          const startTime = String(obj.startTime ?? '').trim();
          const endTime = String(obj.endTime ?? '').trim();
          const lotsCount = Number(obj.lotsCount ?? 0) || 0;
          const lotIds = Array.isArray(obj.lotIds) ? (obj.lotIds as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean) : [];

          if (!id || !name) return null;
          return {
            id,
            name,
            dateTime: formatUserDateTime(auctionDate, startTime),
            lots: lotsCount,
            status: computeUserStatus(auctionDate, startTime, endTime),
            lotIds,
          } as Auction;
        })
        .filter(Boolean) as Auction[];

      // Note: /api/auctions returns Draft/Scheduled; for user we show based on time-derived status (live/scheduled/ended).
      setAuctions(next);
      return true;
    } catch {
      return false;
    }
  };

  const loadMyBidsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bids?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) return false;
      const rows = Array.isArray(data) ? data : [];
      setBids(
        rows.map((r: any) => ({
          id: String(r?.lotId ?? r?.lot_id ?? ''),
          auction: String(r?.auctionName ?? ''),
          lot: String(r?.lotName ?? r?.lotId ?? ''),
          myBid: Number(r?.myBid ?? 0) || 0,
          highest: Number(r?.highest ?? 0) || 0,
          status: (String(r?.status ?? 'live') as Bid['status']) ?? 'live',
        }))
      );
      return true;
    } catch {
      return false;
    }
  };

  const loadWinsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/wins?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) return false;
      const rows = Array.isArray(data) ? data : [];
      setWon(
        rows.map((r: any) => ({
          id: String(r?.id ?? ''),
          auction: String(r?.auction ?? ''),
          lot: String(r?.lot ?? ''),
          winningBid: Number(r?.winningBid ?? 0) || 0,
          status: (String(r?.status ?? 'payment') as Won['status']) ?? 'payment',
        }))
      );
      return true;
    } catch {
      return false;
    }
  };

  const loadNotificationsFromDb = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) return false;
      const rows = Array.isArray(data) ? data : [];
      setNotifications(
        rows.map((r: any) => ({
          id: String(r?.id ?? ''),
          type: (String(r?.type ?? 'system') as Notification['type']) ?? 'system',
          message: String(r?.message ?? ''),
          lot: r?.entityType === 'lot' ? String(r?.entityId ?? '') : undefined,
          date: String(r?.date ?? ''),
          status: (String(r?.status ?? 'unread') as Notification['status']) ?? 'unread',
        }))
      );
      return true;
    } catch {
      return false;
    }
  };

  // Load data
  useEffect(() => {
    void (async () => {
      const ok = await loadAuctionsFromDb();
      if (ok) return;
      setAuctions(
        storage.getJSON<Auction[]>('user_auctions', [
          { id: 'A-001', name: 'Costly Items Auction Q1 2026', dateTime: '2026-03-10 | 11:00 AM', lots: 35, status: 'live' },
          { id: 'A-002', name: 'Winter Wear Auction', dateTime: '2026-03-25 | 02:00 PM', lots: 20, status: 'scheduled' },
          { id: 'A-003', name: 'Electronics Clearance', dateTime: '2026-03-30 | 04:00 PM', lots: 15, status: 'ended' },
        ])
      );
    })();
    void loadMyBidsFromDb();
    void loadWinsFromDb();
    void loadNotificationsFromDb();
  }, [userId]);

  // Persist (keep auctions cached for offline fallback; bids/wins/notifs are DB-backed)
  useEffect(() => storage.setJSON('user_auctions', auctions), [auctions]);

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

  useEffect(() => {
    if (!biddingModalOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [biddingModalOpen]);

  const filteredActive = useMemo(() => {
    return auctions
      .filter((a) =>
        statusFilter === 'all' ? true : a.status === statusFilter
      )
      .filter((a) => a.name.toLowerCase().includes(search.active.toLowerCase()) || a.id.toLowerCase().includes(search.active.toLowerCase()));
  }, [auctions, statusFilter, search.active]);

  const filteredBids = useMemo(() => {
    return bids
      .filter((b) => (bidStatusFilter === 'all' ? true : b.status === bidStatusFilter))
      .filter((b) => b.auction.toLowerCase().includes(search.bids.toLowerCase()) || b.lot.toLowerCase().includes(search.bids.toLowerCase()));
  }, [bids, bidStatusFilter, search.bids]);

  const paginated = <T,>(data: T[], page: number) => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openBidding = (auction: Auction) => {
    setSelectedAuction(auction);
    setSelectedLot(null);
    setBidAmount(0);
    setLotOptions([]);
    setLotsError('');
    setBiddingModalOpen(true);

    void (async () => {
      try {
        setLotsLoading(true);
        const res = await fetch('/api/lots', { cache: 'no-store' });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string'
              ? (data as any).error
              : `Failed to load lots (${res.status})`;
          throw new Error(msg);
        }

        const rows = Array.isArray(data) ? data : [];
        const allowedLotIds = Array.isArray((auction as any)?.lotIds) ? (auction as any).lotIds as string[] : [];
        const allowedSet = new Set(allowedLotIds.map((x) => String(x ?? '').trim()).filter(Boolean));
        const mapped = rows
          .map((r: unknown) => {
            const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
            const assignedAuction = String(obj.assignedAuction ?? '').trim();
            const id = String(obj.id ?? '').trim();
            const lotName = String(obj.lotName ?? '').trim();
            const itemCount = Number(obj.itemCount ?? 0) || 0;
            const basePrice = Number(obj.basePrice ?? 0) || 0;
            if (!id || !lotName) return null;
            // Prefer explicit lotIds (from /api/auctions) when available; fallback to assignedAuction.
            if (allowedSet.size > 0) {
              if (!allowedSet.has(id)) return null;
            } else {
              if (assignedAuction !== auction.id) return null;
            }
            return { id, lotName, itemCount, basePrice };
          })
          .filter(Boolean) as { id: string; lotName: string; itemCount: number; basePrice: number }[];

        setLotOptions(mapped);
        // Auto-select when there's exactly one lot.
        if (mapped.length === 1) setSelectedLot(mapped[0].id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load lots';
        setLotsError(msg);
      } finally {
        setLotsLoading(false);
      }
    })();
  };

  const placeBid = () => {
    if (!selectedAuction || !selectedLot) return;
    if (selectedAuction.status !== 'live') return;
    if (bidAmount <= 0) return;
    void (async () => {
      try {
        const res = await fetch('/api/bids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            auctionId: selectedAuction.id,
            lotId: selectedLot,
            amount: bidAmount,
          }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) throw new Error(String(data?.error ?? `Failed to place bid (${res.status})`));

        setBidAmount(0);
        setSelectedLot(null);
        setBiddingModalOpen(false);
        await loadMyBidsFromDb();
        await loadNotificationsFromDb();
      } catch (e: any) {
        alert(String(e?.message ?? 'Failed to place bid'));
      }
    })();
  };

  const markNotification = (id: string, status: 'read' | 'unread') => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
    void (async () => {
      try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      } catch {
        // ignore
      }
    })();
  };

  return (
    <div className={`page-shell ${isDark ? 'dark' : ''}`} style={{ fontSize: '1em' }}>
      {/* Utility bar */}
      <div className="utility-bar">
        <div className="utility-bar-content">
          <div className="utility-left">
            <div className="location-weather">
              <i className="fas fa-map-marker-alt" />
              <span>Islamabad</span>
              <span className="separator">|</span>
              <i className="fas fa-thermometer-half" />
              <span>--°C</span>
            </div>
            <div className="date-time">
              <i className="far fa-calendar" />
              <span>{currentDate}</span>
              <span className="separator">|</span>
              <i className="far fa-clock" />
              <span>{currentTime}</span>
            </div>
          </div>
          <div className="utility-right">
            <button className="utility-btn">
              <i className="fas fa-volume-up" />
            </button>
            <button className="utility-btn" aria-label="Toggle theme" onClick={toggleTheme}>
              <i className={`fas fa-${isDark ? 'sun' : 'moon'}`} />
            </button>
            <div className="text-size-controls">
              <button className="utility-btn">A-</button>
              <button className="utility-btn">A+</button>
            </div>
            <div className="language-switch">
              <button className="utility-btn">
                <i className="fas fa-language" /> EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <Header
        title="IIAP Lost & Found Auction System"
        rightSlot={
          <>
            <span>Welcome, User</span>
            <button className="action-btn btn-danger btn-sm">Logout</button>
          </>
        }
      />

      <main className="dashboard-container">
        <Sidebar
          title="Menu"
          items={[
            {
              key: 'active',
              label: 'Active Auctions',
              iconClass: 'fas fa-gavel',
              active: activeTab === 'active',
              onClick: () => setActiveTab('active'),
            },
            {
              key: 'my-bids',
              label: 'My Bids',
              iconClass: 'fas fa-hand-holding-usd',
              active: activeTab === 'my-bids',
              onClick: () => setActiveTab('my-bids'),
            },
            {
              key: 'won',
              label: 'Won Auctions',
              iconClass: 'fas fa-trophy',
              active: activeTab === 'won',
              onClick: () => setActiveTab('won'),
            },
            {
              key: 'notifications',
              label: 'Notifications',
              iconClass: 'fas fa-bell',
              active: activeTab === 'notifications',
              onClick: () => setActiveTab('notifications'),
            },
          ]}
        />

        <section className="content-area">
          {activeTab === 'active' && (
            <div className="dashboard-content active-content">
              <h2>Active Auctions</h2>
              <p className="page-subtitle">Browse and participate in live and scheduled auctions</p>

              <div className="search-filter-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search auction or lot..."
                  value={search.active}
                  onChange={(e) => setSearch((s) => ({ ...s, active: e.target.value }))}
                />
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="live">Live</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="ended">Ended</option>
                </select>
              </div>

              <div className="auctions-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Auction Name</th>
                      <th>Date & Time</th>
                      <th>Total Lots</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated(filteredActive, pagination.active).map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.dateTime}</td>
                        <td>{a.lots}</td>
                        <td>{a.status}</td>
                        <td>
                          <button
                            className="action-btn btn-success"
                            onClick={() => openBidding(a)}
                            title={a.status !== 'live' ? 'View lots (bidding opens when the auction is live)' : 'Bid'}
                          >
                            {a.status === 'live' ? 'Bid' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  <a onClick={() => setPagination((p) => ({ ...p, active: Math.max(1, p.active - 1) }))}>
                    « Previous
                  </a>
                  <span>Page {pagination.active}</span>
                  <a
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        active:
                          p.active * PAGE_SIZE >= filteredActive.length
                            ? p.active
                            : p.active + 1,
                      }))
                    }
                  >
                    Next »
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'my-bids' && (
            <div className="dashboard-content active-content">
              <h2>My Bids</h2>
              <p className="page-subtitle">Track and manage all your active and past bids</p>

              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-label">Total Bids</div>
                  <div className="card-value">{bids.length}</div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Winning</div>
                  <div className="card-value winning">{bids.filter((b) => b.status === 'winning').length}</div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Outbid</div>
                  <div className="card-value outbid">{bids.filter((b) => b.status === 'outbid').length}</div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Won</div>
                  <div className="card-value won">{bids.filter((b) => b.status === 'won').length}</div>
                </div>
              </div>

              <div className="search-filter-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search lot or auction..."
                  value={search.bids}
                  onChange={(e) => setSearch((s) => ({ ...s, bids: e.target.value }))}
                />
                <select
                  className="filter-select"
                  value={bidStatusFilter}
                  onChange={(e) => setBidStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="winning">Winning</option>
                  <option value="outbid">Outbid</option>
                  <option value="live">Live</option>
                  <option value="won">Won</option>
                </select>
              </div>

              <div className="bids-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Auction</th>
                      <th>Lot</th>
                      <th>My Bid (PKR)</th>
                      <th>Highest Bid</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated(filteredBids, pagination.myBids).map((b) => (
                      <tr key={b.id}>
                        <td>{b.auction}</td>
                        <td>{b.lot}</td>
                        <td>{b.myBid.toLocaleString()}</td>
                        <td>{b.highest.toLocaleString()}</td>
                        <td>{b.status}</td>
                        <td>
                          <button className="action-btn btn-edit" onClick={() => openBidding({ id: '', name: b.auction, dateTime: '', lots: 0, status: 'live' })}>
                            Re-bid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  <a onClick={() => setPagination((p) => ({ ...p, myBids: Math.max(1, p.myBids - 1) }))}>
                    « Previous
                  </a>
                  <span>Page {pagination.myBids}</span>
                  <a
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        myBids:
                          p.myBids * PAGE_SIZE >= filteredBids.length ? p.myBids : p.myBids + 1,
                      }))
                    }
                  >
                    Next »
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'won' && (
            <div className="dashboard-content active-content">
              <h2>🏆 Won Auctions</h2>
              <p className="page-subtitle">View your winning bids and manage payments</p>

              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-label">Total Won</div>
                  <div className="card-value">{won.length}</div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Payment Pending</div>
                  <div className="card-value payment-pending">
                    {won.filter((w) => w.status === 'payment').length}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Ready for Pickup</div>
                  <div className="card-value ready-pickup">
                    {won.filter((w) => w.status === 'pickup').length}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Total Amount (PKR)</div>
                  <div className="card-value">
                    {won.reduce((sum, w) => sum + w.winningBid, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="won-auctions-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Auction</th>
                      <th>Lot</th>
                      <th>Winning Bid (PKR)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated(won, pagination.won).map((w) => (
                      <tr key={w.id}>
                        <td>{w.auction}</td>
                        <td>{w.lot}</td>
                        <td>{w.winningBid.toLocaleString()}</td>
                        <td>{w.status}</td>
                        <td>
                          <button className="action-btn btn-success btn-sm">Pay</button>
                          <button className="action-btn btn-info btn-sm">Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  <a onClick={() => setPagination((p) => ({ ...p, won: Math.max(1, p.won - 1) }))}>
                    « Previous
                  </a>
                  <span>Page {pagination.won}</span>
                  <a
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        won: p.won * PAGE_SIZE >= won.length ? p.won : p.won + 1,
                      }))
                    }
                  >
                    Next »
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="dashboard-content active-content">
              <h2>Notifications</h2>
              <p className="page-subtitle">Stay updated with your bids, wins, payments, and pickups</p>

              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-label">Total</div>
                  <div className="card-value">{notifications.length}</div>
                </div>
                <div className="summary-card">
                  <div className="card-label">Unread</div>
                  <div className="card-value unread">
                    {notifications.filter((n) => n.status === 'unread').length}
                  </div>
                </div>
              </div>

              <div className="notifications-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Related Lot</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated(notifications, pagination.notifications).map((n) => (
                      <tr key={n.id}>
                        <td>{n.type}</td>
                        <td>{n.message}</td>
                        <td>{n.lot || '-'}</td>
                        <td>{n.date}</td>
                        <td>{n.status}</td>
                        <td>
                          {n.status === 'unread' ? (
                            <button className="action-btn btn-success btn-sm" onClick={() => markNotification(n.id, 'read')}>
                              Mark Read
                            </button>
                          ) : (
                            <button className="action-btn btn-secondary btn-sm" onClick={() => markNotification(n.id, 'unread')}>
                              Mark Unread
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  <a onClick={() => setPagination((p) => ({ ...p, notifications: Math.max(1, p.notifications - 1) }))}>
                    « Previous
                  </a>
                  <span>Page {pagination.notifications}</span>
                  <a
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        notifications:
                          p.notifications * PAGE_SIZE >= notifications.length
                            ? p.notifications
                            : p.notifications + 1,
                      }))
                    }
                  >
                    Next »
                  </a>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Live Bidding Modal */}
      <Modal
        open={biddingModalOpen}
        title={selectedAuction ? `Live Bidding - ${selectedAuction.name}` : 'Live Bidding'}
        onClose={() => setBiddingModalOpen(false)}
        footer={
          <>
            <button className="action-btn btn-delete" onClick={() => setBiddingModalOpen(false)}>
              Cancel
            </button>
            <button
              className="action-btn btn-success"
              disabled={!selectedAuction || selectedAuction.status !== 'live' || !selectedLot || bidAmount <= 0}
              onClick={placeBid}
              title={
                !selectedAuction
                  ? 'Select an auction'
                  : selectedAuction.status !== 'live'
                    ? 'Auction is not live'
                    : !selectedLot
                      ? 'Select a lot'
                      : bidAmount <= 0
                        ? 'Enter a bid amount'
                        : 'Place bid'
              }
            >
              Place Bid
            </button>
          </>
        }
      >
        {selectedAuction && (
          <div style={{ marginBottom: 12 }}>
            <span className="live-detail">
              Status: <strong>{selectedAuction.status}</strong> · Lots: <strong>{selectedAuction.lots}</strong>
            </span>
            {selectedAuction.status !== 'live' && (
              <p className="live-detail" style={{ margin: '6px 0 0 0' }}>
                Bidding is only available when the auction is <strong>live</strong>. You can still view lots here.
              </p>
            )}
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Select Lot</label>
            <select
              value={selectedLot || ''}
              onChange={(e) => setSelectedLot(e.target.value)}
              disabled={lotsLoading || !selectedAuction}
            >
              <option value="">-- Choose a lot --</option>
              {lotOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotName}
                </option>
              ))}
            </select>
            {lotsLoading && <p className="live-detail">Loading lots…</p>}
            {!lotsLoading && !lotsError && selectedAuction && lotOptions.length === 0 && (
              <p className="live-detail">No lots are assigned to this auction yet.</p>
            )}
            {lotsError && <p className="live-detail" style={{ color: '#dc3545' }}>{lotsError}</p>}
          </div>
          <div className="form-group">
            <label>Bid Amount (PKR)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={bidAmount}
              onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
              disabled={!selectedAuction || selectedAuction.status !== 'live' || !selectedLot}
            />
          </div>
        </div>

        {selectedLot && (
          (() => {
            const lot = lotOptions.find((x) => x.id === selectedLot);
            if (!lot) return null;
            return (
              <div style={{ marginTop: 10 }}>
                <p className="live-detail" style={{ margin: 0 }}>
                  Lot: <strong>{lot.lotName}</strong>
                </p>
                <p className="live-detail" style={{ margin: 0 }}>
                  ID: {lot.id} · Items: {lot.itemCount.toLocaleString()} · Base Price: {lot.basePrice.toLocaleString()}
                </p>
              </div>
            );
          })()
        )}

        <p className="page-subtitle" style={{ marginTop: 12 }}>
          Tip: choose a lot first, then enter your bid. (Demo bid flow — bids are stored locally for now.)
        </p>
      </Modal>
    </div>
  );
}

