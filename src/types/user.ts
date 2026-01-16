import type { Auction as SharedAuction } from './auction';

export type UserAuction = Partial<Omit<SharedAuction, 'id' | 'auctionName' | 'status' | 'lotsCount'>> & {
  id: string;
  name: string;
  dateTime: string;
  lots: number;
  status: 'live' | 'scheduled' | 'ended';
  [k: string]: any;
};

export type UserBid = {
  id: string;
  auction: string;
  lot: string;
  myBid: number;
  highest: number;
  status: 'winning' | 'outbid' | 'live' | 'won';
};

export type UserWon = {
  id: string;
  auction: string;
  lot: string;
  winningBid: number;
  status: 'payment' | 'pickup' | 'completed';
};

export type UserNotification = {
  id: string;
  type: 'bid' | 'system' | 'win' | 'payment';
  message: string;
  lot?: string;
  date: string;
  status: 'read' | 'unread';
};

