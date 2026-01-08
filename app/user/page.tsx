'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Auction as SharedAuction } from '../../types/auction';
import { useTheme } from '../../hooks/useTheme';

type Auction = Partial<Omit<SharedAuction, 'id' | 'auctionName' | 'status' | 'lotsCount'>> & {
  id: string;
  name: string;
  dateTime: string;
  lots: number;
  status: 'live' | 'scheduled' | 'ended';
  [k: string]: any;
};

type Bid = {
  id: string;
  auction: string;
  lot: string;
  myBid: number;
  highest: number;
  status: 'winning' | 'outbid' | 'live' | 'won';
};

type Won = {
  id: string;
  auction: string;
  lot: string;
  winningBid: number;
  status: 'payment' | 'pickup' | 'completed';
};

type Notification = {
  id: string;
  type: 'bid' | 'system' | 'win' | 'payment';
  message: string;
  lot?: string;
  date: string;
  status: 'read' | 'unread';
};

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
  const { isDark, toggleTheme } = useTheme();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentDate, setCurrentDate] = useState('--');
  const [currentTime, setCurrentTime] = useState('--');

  // Load data
  useEffect(() => {
    setAuctions(
      storage.get<Auction[]>('user_auctions', [
        { id: 'A-001', name: 'Costly Items Auction Q1 2026', dateTime: '2026-03-10 | 11:00 AM', lots: 35, status: 'live' },
        { id: 'A-002', name: 'Winter Wear Auction', dateTime: '2026-03-25 | 02:00 PM', lots: 20, status: 'scheduled' },
        { id: 'A-003', name: 'Electronics Clearance', dateTime: '2026-03-30 | 04:00 PM', lots: 15, status: 'ended' },
      ])
    );
    setBids(
      storage.get<Bid[]>('user_bids', [
        { id: 'B-1', auction: 'Costly Items Auction Q1 2026', lot: '#L-001', myBid: 12000, highest: 15000, status: 'outbid' },
        { id: 'B-2', auction: 'Winter Wear Auction', lot: '#L-010', myBid: 5000, highest: 5000, status: 'winning' },
      ])
    );
    setWon(
      storage.get<Won[]>('user_won', [
        { id: 'W-1', auction: 'Gadgets Auction', lot: '#L-020', winningBid: 25000, status: 'payment' },
      ])
    );
    setNotifications(
      storage.get<Notification[]>('user_notifications', [
        { id: 'N-1', type: 'bid', message: 'You have been outbid on #L-001', lot: '#L-001', date: '2026-01-05', status: 'unread' },
        { id: 'N-2', type: 'system', message: 'New auction added: Winter Wear Auction', date: '2026-01-04', status: 'read' },
      ])
    );
  }, []);

  // Persist
  useEffect(() => storage.set('user_auctions', auctions), [auctions]);
  useEffect(() => storage.set('user_bids', bids), [bids]);
  useEffect(() => storage.set('user_won', won), [won]);
  useEffect(() => storage.set('user_notifications', notifications), [notifications]);

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
    setBiddingModalOpen(true);
  };

  const placeBid = () => {
    if (!selectedAuction || !selectedLot) return;
    setBids((prev) => [
      ...prev,
      {
        id: `B-${Date.now()}`,
        auction: selectedAuction.name,
        lot: selectedLot,
        myBid: bidAmount,
        highest: bidAmount,
        status: 'winning',
      },
    ]);
    setBidAmount(0);
    setSelectedLot(null);
    setBiddingModalOpen(false);
  };

  const markNotification = (id: string, status: 'read' | 'unread') => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
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
      <header className="main-header">
        <div className="header-content">
          <div className="logo brand-row">
            <img src="/paa-logo.png" alt="IIAP Logo" className="brand-mark" />
            <div className="brand-text">
              <h1>IIAP Lost & Found Auction System</h1>
            </div>
          </div>
          <div className="utility-nav">
            <span>Welcome, User</span>
            <button className="action-btn btn-danger btn-sm">Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-container">
        <aside className="sidebar">
          <h2>Menu</h2>
          <ul>
            <li className={activeTab === 'active' ? 'active-menu' : ''}>
              <a onClick={() => setActiveTab('active')}>
                <i className="fas fa-gavel" /> Active Auctions
              </a>
            </li>
            <li className={activeTab === 'my-bids' ? 'active-menu' : ''}>
              <a onClick={() => setActiveTab('my-bids')}>
                <i className="fas fa-hand-holding-usd" /> My Bids
              </a>
            </li>
            <li className={activeTab === 'won' ? 'active-menu' : ''}>
              <a onClick={() => setActiveTab('won')}>
                <i className="fas fa-trophy" /> Won Auctions
              </a>
            </li>
            <li className={activeTab === 'notifications' ? 'active-menu' : ''}>
              <a onClick={() => setActiveTab('notifications')}>
                <i className="fas fa-bell" /> Notifications
              </a>
            </li>
          </ul>
        </aside>

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
                          <button className="action-btn btn-success" onClick={() => openBidding(a)}>
                            Bid
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
            <button className="btn-cancel" onClick={() => setBiddingModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-next" disabled={!selectedLot || bidAmount <= 0} onClick={placeBid}>
              Place Bid
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Select Lot</label>
            <select value={selectedLot || ''} onChange={(e) => setSelectedLot(e.target.value)}>
              <option value="">-- Choose a lot --</option>
              <option value="#L-001">#L-001 Sample Lot</option>
              <option value="#L-002">#L-002 Sample Lot</option>
            </select>
          </div>
          <div className="form-group">
            <label>Bid Amount (PKR)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={bidAmount}
              onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="page-subtitle">This is a demo bid flow with local state only.</p>
      </Modal>
    </div>
  );
}

