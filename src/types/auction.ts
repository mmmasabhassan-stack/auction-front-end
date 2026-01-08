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
};

export type Item = {
  id: string;
  parentName: string;
  subItemsCount: number;
  dateFound: string;
};

export type User = {
  id: string;
  name: string;
  cnic: string;
  paa: string;
  status: 'Enabled' | 'Disabled' | 'Pending';
  role: string;
};

