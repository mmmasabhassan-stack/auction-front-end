'use client';

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import type { SubAdminAuction as Auction, SubAdminAuctionItem as AuctionItem, SubAdminLot as Lot } from '@/types/subAdmin';
import { useTheme } from '@/hooks/useTheme';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';

// ==================== UTILITY BAR COMPONENT ====================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function UtilityBar() {
  // Initialize state from localStorage to avoid setState in effect
  const safeGet = (key: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
  const getInitialDarkMode = () => safeGet('theme') === 'dark';
  const getInitialSound = () => safeGet('soundEnabled') !== 'false';
  const getInitialLang = () => safeGet('language') || 'EN';

  const [currentDate, setCurrentDate] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const { isDark, toggleTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(isDark);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => getInitialSound());
  const [currentLang, setCurrentLang] = useState(() => getInitialLang());
  const [temperature, setTemperature] = useState(0);

  // Define fetchWeather early to use in useEffect
  const fetchWeather = useCallback(() => {
    const cachedWeather = localStorage.getItem('weatherData');
    const cacheTime = localStorage.getItem('weatherCacheTime');
    const now = Date.now();

    if (cachedWeather && cacheTime && (now - parseInt(cacheTime)) < 600000) {
      const data = JSON.parse(cachedWeather);
      setTemperature(data.temp);
    } else {
      const temp = Math.floor(Math.random() * 20) + 10;
      localStorage.setItem('weatherData', JSON.stringify({ city: 'Islamabad', temp }));
      localStorage.setItem('weatherCacheTime', now.toString());
      setTemperature(temp);
    }
  }, []);

  useLayoutEffect(() => {
    // Initialize theme from localStorage on mount
    // Using useLayoutEffect is appropriate for DOM mutations before paint
    const initializeTheme = () => {
      if (isDark) {
        document.body.classList.add('dark-mode');
        setIsDarkMode(true);
      } else {
        document.body.classList.remove('dark-mode');
        setIsDarkMode(false);
      }
    };
    initializeTheme();

    // Fetch initial temperature - setState in effect is acceptable for initialization
    // @ts-ignore - React recommendation suppressed for initialization
    fetchWeather();

    // Update date/time every second
    const updateDateTime = () => {
      const now = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
      
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      setCurrentDate(dateStr);
      setCurrentTime(timeStr);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [fetchWeather, isDark]);

  // keep local flag in sync with shared theme
  useEffect(() => {
    setIsDarkMode(isDark);
  }, [isDark]);


  const handleToggleTheme = () => {
    toggleTheme();
    setIsDarkMode((prev) => !prev);
  };

  const toggleSound = () => {
    const newSoundState = !isSoundEnabled;
    setIsSoundEnabled(newSoundState);
    localStorage.setItem('soundEnabled', newSoundState ? 'true' : 'false');
  };

  const toggleLanguage = () => {
    const newLang = currentLang === 'EN' ? 'UR' : 'EN';
    setCurrentLang(newLang);
    localStorage.setItem('language', newLang);
  };

  const changeTextSize = (size: string) => {
    document.body.classList.remove('text-small', 'text-large', 'text-xlarge');
    if (size !== 'normal') {
      document.body.classList.add(`text-${size}`);
    }
    localStorage.setItem('textSize', size);
  };

  return (
    <div className="utility-bar">
      <div className="utility-bar-content">
        <div className="utility-left">
          <div className="location-weather">
            <i className="fas fa-map-marker-alt"></i>
            <span>Islamabad, Pakistan</span>
          </div>
          <div className="separator"></div>
          <div className="date-time">
            <i className="fas fa-calendar-alt"></i>
            <span id="current-date">{currentDate}</span>
          </div>
          <div className="separator"></div>
          <div className="date-time">
            <i className="fas fa-clock"></i>
            <span id="current-time">{currentTime}</span>
          </div>
          <div className="separator"></div>
          <div className="location-weather">
            <i className="fas fa-thermometer-half"></i>
            <span id="temperature">{temperature}°C</span>
          </div>
        </div>

        <div className="utility-right">
          <button className="utility-btn" onClick={handleToggleTheme} aria-label="Toggle theme" title="Toggle Dark Mode">
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          <button className="utility-btn" onClick={toggleSound} title="Toggle Sound">
            <i className={`fas ${isSoundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
          </button>

          <div className="text-size-controls">
            <button className="utility-btn" onClick={() => changeTextSize('small')} title="Decrease Text">
              <i className="fas fa-minus"></i>
            </button>
            <span className="text-size-icon">Aa</span>
            <button className="utility-btn" onClick={() => changeTextSize('large')} title="Increase Text">
              <i className="fas fa-plus"></i>
            </button>
          </div>

          <div className="language-switch">
            <button className="utility-btn" onClick={toggleLanguage} title="Toggle Language">
              <span id="current-lang">{currentLang}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== NOTIFICATION COMPONENT ====================
function Notification({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification notification-${type}`}>
      {message}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function SubAdminPage() {
  const [activeTab, setActiveTab] = useState('auction-start');
  const { isDark } = useTheme();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Modal States
  const [createAuctionModal, setCreateAuctionModal] = useState(false);
  const [createLotModal, setCreateLotModal] = useState(false);
  const [selectLotsModal, setSelectLotsModal] = useState(false);
  const [selectItemsModal, setSelectItemsModal] = useState(false);
  const [createItemModal, setCreateItemModal] = useState(false);
  const [auctionSuccessModal, setAuctionSuccessModal] = useState(false);
  const [deleteAuctionModal, setDeleteAuctionModal] = useState(false);

  // Form States
  const [auctionForm, setAuctionForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [lotForm, setLotForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState<{ serialNumber: string; category: string; description: string; condition: string; make: string; }[]>([]);

  // Selection States
  const [selectedLots, setSelectedLots] = useState<Map<number, Lot>>(new Map());
  const [selectedItems, setSelectedItems] = useState<Map<string, { parentId: string; itemData: AuctionItem; isParent: boolean }>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);

  // Search States
  const [searchLotsInput, setSearchLotsInput] = useState('');
  const [searchItemsInput, setSearchItemsInput] = useState('');

  // Auction Controls
  const [currentLotIndex, setCurrentLotIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [bidTimer, setBidTimer] = useState(120);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Success Modal State
  const [successData, setSuccessData] = useState({ title: '', lotsCount: 0, auctionId: '' });

  // Delete Modal State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const [auctionToDelete, setAuctionToDelete] = useState<string | null>(null);

  // Pagination State
  const [currentPages, setCurrentPages] = useState({ auctions: 1, lots: 1, items: 1 });
  const itemsPerPage = 10;

  // Initialize data on mount
  useEffect(() => {
    initializeAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer Effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      timerInterval.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
    }

    return () => {
      if (timerInterval.current) clearTimeout(timerInterval.current);
    };
  }, [isRunning, timeRemaining]);

  // Helper Functions
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ message, type });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize all sample data
  const initializeAllData = () => {
    initializeSampleItems();
    initializeSampleLots();
    loadSavedAuctions();
    loadSavedLots();
    loadSavedItems();
  };

  // Item Functions
  const initializeSampleItems = () => {
    const itemCategories = {
      Electronics: ['Mobile Phone', 'Laptop', 'Tablet', 'Headphones', 'Camera'],
      Furniture: ['Chair', 'Table', 'Desk', 'Cabinet', 'Shelf'],
      Clothing: ['Shirt', 'Jacket', 'Pants', 'Shoes', 'Hat'],
      Jewelry: ['Necklace', 'Ring', 'Bracelet', 'Earrings', 'Watch'],
      Books: ['Novel', 'Textbook', 'Magazine', 'Dictionary', 'Comic'],
    };

    const conditions = ['Used', 'New', 'Broken'];
    const makes = {
      Electronics: ['Apple', 'Samsung', 'Sony', 'LG', 'Dell'],
      Furniture: ['IKEA', 'Herman Miller', 'Steelcase', 'Knoll', 'USM'],
      Clothing: ['Nike', 'Adidas', 'Zara', 'H&M', 'Gucci'],
      Jewelry: ['Rolex', 'Cartier', 'Tiffany', 'Bulgari', 'Pandora'],
      Books: ['Penguin', 'Oxford', 'Random House', 'Scholastic', 'Vintage'],
    };

    const sampleItems: AuctionItem[] = [];
    let itemId = 100000;
    // const baseDate = new Date('2025-01-01');

    for (let i = 0; i < 400; i++) {
      const category = Object.keys(itemCategories)[Math.floor(Math.random() * Object.keys(itemCategories).length)];
      const itemType = itemCategories[category as keyof typeof itemCategories][Math.floor(Math.random() * 5)];
      const isSingle = Math.random() < 0.4;

      if (isSingle) {
        sampleItems.push({
          id: `ITEM-${itemId}`,
          parentName: itemType,
          items: [
            {
              serialNumber: `SN-${itemId}`,
              category: category,
              description: `${itemType} - Item ${itemId}`,
              condition: conditions[Math.floor(Math.random() * 3)],
              make: makes[category as keyof typeof makes][Math.floor(Math.random() * 5)],
            },
          ],
        });
      } else {
        const childCount = Math.floor(Math.random() * 3) + 2;
        const childItems = [];
        for (let j = 0; j < childCount; j++) {
          childItems.push({
            serialNumber: `SN-${itemId}-${j}`,
            category: category,
            description: `${itemType} - Item ${itemId}-${j}`,
            condition: conditions[Math.floor(Math.random() * 3)],
            make: makes[category as keyof typeof makes][Math.floor(Math.random() * 5)],
          });
        }
        sampleItems.push({
          id: `ITEM-${itemId}`,
          parentName: `${itemType} Group ${itemId}`,
          items: childItems,
        });
      }
      itemId++;
    }

    localStorage.setItem('auctionItems', JSON.stringify(sampleItems));
  };

  const initializeSampleLots = () => {
    const savedItems = JSON.parse(localStorage.getItem('auctionItems') || '[]') as AuctionItem[];
    if (savedItems.length === 0) return;

    const categorizeItem = (itemName: string) => {
      if (['Mobile Phone', 'Laptop', 'Tablet', 'Headphones', 'Camera'].some(t => itemName.includes(t))) return 'Electronics';
      if (['Chair', 'Table', 'Desk', 'Cabinet', 'Shelf'].some(t => itemName.includes(t))) return 'Furniture';
      if (['Shirt', 'Jacket', 'Pants', 'Shoes', 'Hat'].some(t => itemName.includes(t))) return 'Clothing';
      if (['Necklace', 'Ring', 'Bracelet', 'Earrings', 'Watch'].some(t => itemName.includes(t))) return 'Jewelry';
      return 'Books';
    };

    const itemsByCategory: { [key: string]: AuctionItem[] } = {};
    savedItems.forEach((item) => {
      const category = categorizeItem(item.parentName ?? '');
      if (!itemsByCategory[category]) itemsByCategory[category] = [];
      itemsByCategory[category].push(item);
    });

    const lotConfigs = [
      { category: 'Electronics', quantity: 50 },
      { category: 'Furniture', quantity: 40 },
      { category: 'Clothing', quantity: 45 },
      { category: 'Jewelry', quantity: 35 },
      { category: 'Books', quantity: 30 },
    ];

    const sampleLots: Lot[] = [];
    let lotIdCounter = 1;

    lotConfigs.forEach((config) => {
      if (itemsByCategory[config.category]) {
        const categoryItems = itemsByCategory[config.category].slice(0, config.quantity);
        sampleLots.push({
          id: lotIdCounter,
          name: `Lot ${lotIdCounter}: ${config.category}`,
          description: `Collection of ${config.category.toLowerCase()} items`,
          itemCount: categoryItems.length,
          items: categoryItems,
        });
        lotIdCounter++;
      }
    });

    while (sampleLots.length < 10 && lotIdCounter <= 20) {
      const randomCategory = Object.keys(itemsByCategory)[Math.floor(Math.random() * Object.keys(itemsByCategory).length)];
      const categoryItems = itemsByCategory[randomCategory].slice(0, 30);
      if (categoryItems.length > 0) {
        sampleLots.push({
          id: lotIdCounter,
          name: `Lot ${lotIdCounter}: Mixed Items`,
          description: 'Mixed collection of various items',
          itemCount: categoryItems.length,
          items: categoryItems,
        });
        lotIdCounter++;
      }
    }

    localStorage.setItem('auctionLots', JSON.stringify(sampleLots));
  };

  const loadSavedItems = () => {
    const savedItems = JSON.parse(localStorage.getItem('auctionItems') || '[]') as AuctionItem[];
    setItems(savedItems);
  };

  const loadSavedLots = () => {
    const savedLots = JSON.parse(localStorage.getItem('auctionLots') || '[]') as Lot[];
    setLots(savedLots);
  };

  const loadSavedAuctions = () => {
    const savedAuctions = JSON.parse(localStorage.getItem('auctionAuctions') || '[]') as Auction[];
    setAuctions(savedAuctions);
  };

  const deleteItem = (itemId: string) => {
    const savedItems = JSON.parse(localStorage.getItem('auctionItems') || '[]') as AuctionItem[];
    const itemToDelete = savedItems.find(item => item.id === itemId);
    const itemName = itemToDelete ? itemToDelete.parentName : itemId;

    if (confirm(`Are you sure you want to delete "${itemName}" (${itemId})?\n\nThis action cannot be undone.`)) {
      const updatedItems = savedItems.filter(item => item.id !== itemId);
      localStorage.setItem('auctionItems', JSON.stringify(updatedItems));
      loadSavedItems();
    }
  };

  const editItem = (itemId: string) => {
    const savedItems = JSON.parse(localStorage.getItem('auctionItems') || '[]') as AuctionItem[];
    const itemToEdit = savedItems.find(item => item.id === itemId);

    if (!itemToEdit) {
      alert('Item not found');
      return;
    }

    setEditingId(itemId);
    setItemForm(itemToEdit.items ?? []);
    setCreateItemModal(true);
  };

  const saveItemsToStorage = (itemsData: typeof itemForm, editingItemId: string | null = null) => {
    const savedItems = JSON.parse(localStorage.getItem('auctionItems') || '[]') as AuctionItem[];

    let parentName = 'Parent Item';
    if (itemsData.length > 0) {
      parentName = itemsData.map(item => item.description).join(', ');
      if (parentName.length > 50) parentName = parentName.substring(0, 47) + '...';
    }

    if (editingItemId) {
      const index = savedItems.findIndex(item => item.id === editingItemId);
      if (index !== -1) {
        savedItems[index] = { id: editingItemId, parentName, items: itemsData };
      }
    } else {
      const newId = `ITEM-${Date.now()}`;
      savedItems.push({ id: newId, parentName, items: itemsData });
    }

    localStorage.setItem('auctionItems', JSON.stringify(savedItems));
    setItemForm([]);
    setEditingId(null);
    setCreateItemModal(false);
    loadSavedItems();
  };

  // Auction Functions
  const saveAuctionToStorage = (auctionData: typeof auctionForm, editingAuctionId: string | null = null) => {
    const savedAuctions = JSON.parse(localStorage.getItem('auctionAuctions') || '[]') as Auction[];

    const lotsArray = Array.from(selectedLots.values());

    if (editingAuctionId) {
      const index = savedAuctions.findIndex(a => a.id === editingAuctionId);
      if (index !== -1) {
        savedAuctions[index] = {
          ...savedAuctions[index],
          ...auctionData,
          lotsCount: lotsArray.length,
          lots: lotsArray,
        };
      }
    } else {
      const newId = `AUCTION-${Date.now()}`;
      savedAuctions.push({
        id: newId,
        ...auctionData,
        lotsCount: lotsArray.length,
        lots: lotsArray,
        createdAt: new Date().toISOString(),
      });
    }

    localStorage.setItem('auctionAuctions', JSON.stringify(savedAuctions));
    setSuccessData({
      title: editingAuctionId ? 'Auction Updated!' : 'Auction Created!',
      lotsCount: lotsArray.length,
      auctionId: editingAuctionId || `AUCTION-${Date.now()}`,
    });
    setAuctionSuccessModal(true);
    setCreateAuctionModal(false);
    setSelectLotsModal(false);
    setSelectedLots(new Map());
    loadSavedAuctions();
  };

  const deleteAuction = (auctionId: string) => {
    setAuctionToDelete(auctionId);
    setDeleteAuctionModal(true);
  };

  const performAuctionDeletion = (auctionId: string) => {
    const savedAuctions = JSON.parse(localStorage.getItem('auctionAuctions') || '[]') as Auction[];
    const updatedAuctions = savedAuctions.filter(a => a.id !== auctionId);
    localStorage.setItem('auctionAuctions', JSON.stringify(updatedAuctions));
    loadSavedAuctions();
    setDeleteAuctionModal(false);
    setDeleteConfirmText('');
    setDeleteErrorMessage('');
  };

  const editAuction = (auctionId: string) => {
    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) return;

    setAuctionForm({
      name: auction.name ?? '',
      description: auction.description ?? '',
      startDate: auction.startDate ?? '',
      endDate: auction.endDate ?? '',
    });
    setSelectedLots(new Map((auction.lots ?? []).map(lot => [Number(lot.id), lot as Lot])));
    setEditingId(auctionId);
    setCreateAuctionModal(true);
  };

  // Lot Functions
  const saveLotToStorage = (lotData: typeof lotForm, editingLotId: number | null = null) => {
    const savedLots = JSON.parse(localStorage.getItem('auctionLots') || '[]') as Lot[];
    const itemsArray = Array.from(selectedItems.values()).map(item => item.itemData);

    if (editingLotId !== null) {
      const index = savedLots.findIndex(l => l.id === editingLotId);
      if (index !== -1) {
        savedLots[index] = {
          ...savedLots[index],
          ...lotData,
          itemCount: itemsArray.length,
          items: itemsArray,
        };
      }
    } else {
      const newId = Math.max(...savedLots.map(l => Number(l.id)), 0) + 1;
      savedLots.push({
        id: newId,
        ...lotData,
        itemCount: itemsArray.length,
        items: itemsArray,
      });
    }

    localStorage.setItem('auctionLots', JSON.stringify(savedLots));
    setLotForm({ name: '', description: '' });
    setSelectedItems(new Map());
    setCreateLotModal(false);
    setSelectItemsModal(false);
    setEditingId(null);
    loadSavedLots();
  };

  const deleteLot = (lotId: number) => {
    const savedLots = JSON.parse(localStorage.getItem('auctionLots') || '[]') as Lot[];
    const updatedLots = savedLots.filter(l => l.id !== lotId);
    localStorage.setItem('auctionLots', JSON.stringify(updatedLots));
    loadSavedLots();
  };

  const editLot = (lotId: number) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;

    setLotForm({ name: lot.name ?? '', description: lot.description ?? '' });
    setSelectedItems(
      new Map(
        (lot.items ?? []).map((item) => {
          const key = String(item.id ?? crypto.randomUUID());
          return [key, { parentId: key, itemData: item, isParent: true }];
        })
      )
    );
    setEditingId(String(lotId));
    setCreateLotModal(true);
  };

  // Auction Controls
  const startTimer = () => {
    if (bidTimer <= 0) {
      showNotification('Please set a valid timer value', 'error');
      return;
    }
    setTimeRemaining(bidTimer);
    setIsRunning(true);
    showNotification('Timer started', 'info');
  };

  const pauseTimer = () => {
    setIsRunning(false);
    showNotification('Timer paused', 'info');
  };

  const nextLot = () => {
    setCurrentLotIndex(prev => prev + 1);
    setTimeRemaining(0);
    setIsRunning(false);
    showNotification('Moving to next lot', 'info');
  };

  // Pagination
  const getPaginatedData = <T extends Auction | Lot | AuctionItem>(data: T[], tableType: 'auctions' | 'lots' | 'items'): T[] => {
    const page = currentPages[tableType];
    const start = (page - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  };

  const getTotalPages = <T extends Auction | Lot | AuctionItem>(data: T[]) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const goToPage = (tableType: 'auctions' | 'lots' | 'items', page: number) => {
    setCurrentPages(prev => ({ ...prev, [tableType]: page }));
  };

  // Modal closing handlers
  const closeAllModals = () => {
    setCreateAuctionModal(false);
    setCreateLotModal(false);
    setSelectLotsModal(false);
    setSelectItemsModal(false);
    setCreateItemModal(false);
    setAuctionSuccessModal(false);
    setDeleteAuctionModal(false);
    setDeleteConfirmText('');
    setDeleteErrorMessage('');
    setEditingId(null);
  };

  return (
    <div className={`page-shell ${isDark ? 'dark' : ''}`}>
      {/* Top utility bar (matches Admin) */}
      <UtilityBar />

      {/* Header */}
      <Header title="IIAP Lost & Found Auction System" rightText="Sub-Admin Dashboard" rightHref="/sub-admin" />

      <main className="dashboard-container">
        {/* Sidebar */}
        <Sidebar
          title="Sub-Admin Menu"
          items={[
            {
              key: 'auction-start',
              label: 'Auction Start',
              iconClass: 'fas fa-stopwatch',
              active: activeTab === 'auction-start',
              onClick: () => {
                setActiveTab('auction-start');
                closeAllModals();
              },
            },
            {
              key: 'create-auction',
              label: 'Create Auction',
              iconClass: 'fas fa-calendar-plus',
              active: activeTab === 'create-auction',
              onClick: () => {
                setActiveTab('create-auction');
                closeAllModals();
              },
            },
            {
              key: 'create-lots',
              label: 'Create Lots',
              iconClass: 'fas fa-boxes-stacked',
              active: activeTab === 'create-lots',
              onClick: () => {
                setActiveTab('create-lots');
                closeAllModals();
              },
            },
            {
              key: 'create-items',
              label: 'Create Items',
              iconClass: 'fas fa-list-check',
              active: activeTab === 'create-items',
              onClick: () => {
                setActiveTab('create-items');
                closeAllModals();
              },
            },
          ]}
        />

        {/* Content Area */}
        <section className="content-area">
          {/* Auction Start */}
          {activeTab === 'auction-start' && (
            <div className="dashboard-content active-content">
              <h2>🎯 Live Auction Control Panel</h2>
              <div className="auction-control">
                <div className="current-lot-display">
                  <h3>📍 Current Lot</h3>
                  <div id="admin-lot-details">
                    {currentLotIndex >= 0 && currentLotIndex < lots.length ? (
                      <div>
                        <p><strong>Lot ID:</strong> {lots[currentLotIndex].id}</p>
                        <p><strong>Lot Name:</strong> {lots[currentLotIndex].name}</p>
                        <p><strong>Items in Lot:</strong> {lots[currentLotIndex].itemCount}</p>
                      </div>
                    ) : (
                      <p className='text-gray-500 font-bold '>No lot selected. Click &quot;Next Lot&quot; to start.</p>
                    )}
                  </div>
                </div>
                <div className="timer-section">
                  <h3>⏰ Bid Timer</h3>
                  <input
                    type="number"
                    id="bid-timer-value"
                    value={bidTimer}
                    onChange={(e) => setBidTimer(parseInt(e.target.value) || 120)}
                    min="10"
                    max="600"
                    placeholder="Enter timer value (seconds)"
                  />
                  <div className="timer-display">{formatTime(timeRemaining)}</div>
                </div>
                <div className="control-buttons">
                  <button
                    id="start-btn"
                    onClick={() => startTimer()}
                    className="btn btn-success"
                    disabled={isRunning}
                    aria-disabled={isRunning}
                    title={isRunning ? 'Timer already running' : 'Start timer'}
                  >
                    <i className="fas fa-play"></i> Start Timer
                  </button>
                  <button
                    id="pause-btn"
                    onClick={() => pauseTimer()}
                    className="btn btn-warning"
                    disabled={!isRunning}
                    aria-disabled={!isRunning}
                    title={!isRunning ? 'Timer is not running' : 'Pause timer'}
                  >
                    <i className="fas fa-pause"></i> Pause Timer
                  </button>
                  <button id="next-lot-btn" onClick={() => nextLot()} className="btn btn-info">
                    <i className="fas fa-forward"></i> Next Lot
                  </button>
                </div>
                <div id="live-status-text" className="live-status-box" aria-live="polite">
                  <strong>Status:</strong>{' '}
                  <span className={`live-status-badge ${isRunning ? 'is-running' : 'is-paused'}`}>
                    {isRunning ? '🔴 LIVE' : '⏸️ PAUSED'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Create Auction */}
          {activeTab === 'create-auction' && (
            <div className="dashboard-content active-content">
              <h2>➕ Create New Auction</h2>
              <button 
                onClick={() => {
                  setCreateAuctionModal(true);
                  setEditingId(null);
                  setAuctionForm({ name: '', description: '', startDate: '', endDate: '' });
                }} 
                className="btn btn-primary"
              >
                <i className="fas fa-plus"></i> Create Auction
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Auction ID</th>
                    <th>Name</th>
                    <th>Lots</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="saved-auctions-tbody">
                  {getPaginatedData(auctions, 'auctions').map((auction) => (
                    <tr key={auction.id}>
                      <td>{auction.id}</td>
                      <td>{auction.name}</td>
                      <td>{auction.lotsCount}</td>
                      <td>{auction.startDate}</td>
                      <td>{auction.endDate}</td>
                      <td>
                        <button onClick={() => editAuction(String(auction.id))} className="btn btn-sm btn-info">
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button onClick={() => deleteAuction(String(auction.id))} className="btn btn-sm btn-danger">
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination">
                <button onClick={() => goToPage('auctions', Math.max(1, currentPages.auctions - 1))} className="pagination-prev">← Previous</button>
                <span>Page {currentPages.auctions} of {getTotalPages(auctions)}</span>
                <button onClick={() => goToPage('auctions', Math.min(getTotalPages(auctions), currentPages.auctions + 1))} className="pagination-next">Next →</button>
              </div>
            </div>
          )}

          {/* Create Lots */}
          {activeTab === 'create-lots' && (
            <div className="dashboard-content active-content">
              <h2>📦 Create New Lot</h2>
              <button 
                onClick={() => {
                  setCreateLotModal(true);
                  setEditingId(null);
                  setSelectedItems(new Map());
                  setLotForm({ name: '', description: '' });
                }} 
                className="btn btn-primary"
              >
                <i className="fas fa-plus"></i> Create Lot
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lot ID</th>
                    <th>Name</th>
                    <th>Items</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="saved-lots-tbody">
                  {getPaginatedData(lots, 'lots').map((lot) => (
                    <tr key={lot.id}>
                      <td>{lot.id}</td>
                      <td>{lot.name}</td>
                      <td>{lot.itemCount}</td>
                      <td>{lot.description}</td>
                      <td>
                        <button onClick={() => editLot(lot.id)} className="btn btn-sm btn-info">
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button onClick={() => deleteLot(lot.id)} className="btn btn-sm btn-danger">
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination">
                <button onClick={() => goToPage('lots', Math.max(1, currentPages.lots - 1))} className="pagination-prev">← Previous</button>
                <span>Page {currentPages.lots} of {getTotalPages(lots)}</span>
                <button onClick={() => goToPage('lots', Math.min(getTotalPages(lots), currentPages.lots + 1))} className="pagination-next">Next →</button>
              </div>
            </div>
          )}

          {/* Create Items */}
          {activeTab === 'create-items' && (
            <div className="dashboard-content active-content">
              <h2>📋 Create New Parent Item</h2>
              <button 
                onClick={() => {
                  setCreateItemModal(true);
                  setEditingId(null);
                  setItemForm([{ serialNumber: '', category: '', description: '', condition: '', make: '' }]);
                }} 
                className="btn btn-primary"
              >
                <i className="fas fa-plus"></i> Create Item
              </button>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                    <th>Parent Name</th>
                    <th>Sub Items</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="saved-items-tbody">
                  {getPaginatedData(items, 'items').map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.parentName}</td>
                    <td>{item.items?.length ?? 0}</td>
                      <td>
                        <button onClick={() => editItem(String(item.id))} className="btn btn-sm btn-info">
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button onClick={() => deleteItem(String(item.id))} className="btn btn-sm btn-danger">
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination">
                <button onClick={() => goToPage('items', Math.max(1, currentPages.items - 1))} className="pagination-prev">← Previous</button>
                <span>Page {currentPages.items} of {getTotalPages(items)}</span>
                <button onClick={() => goToPage('items', Math.min(getTotalPages(items), currentPages.items + 1))} className="pagination-next">Next →</button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* ==================== MODALS ==================== */}

      {/* Create Auction Modal */}
      {createAuctionModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeAllModals()}>
          <div className="modal-container">
            <div className="modal-header">
              <h2>{editingId ? '✏️ Edit Auction' : '➕ Create New Auction'}</h2>
              <button onClick={closeAllModals} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Auction Name"
                value={auctionForm.name}
                onChange={(e) => setAuctionForm({ ...auctionForm, name: e.target.value })}
              />
              <textarea
                placeholder="Auction Description"
                value={auctionForm.description}
                onChange={(e) => setAuctionForm({ ...auctionForm, description: e.target.value })}
              ></textarea>
              <input
                type="date"
                value={auctionForm.startDate}
                onChange={(e) => setAuctionForm({ ...auctionForm, startDate: e.target.value })}
              />
              <input
                type="date"
                value={auctionForm.endDate}
                onChange={(e) => setAuctionForm({ ...auctionForm, endDate: e.target.value })}
              />
              <button onClick={() => { setSelectLotsModal(true); setCreateAuctionModal(false); }} className="btn btn-primary" style={{ width: '100%' }}>
                📦 Select Lots ({selectedLots.size})
              </button>
              <button onClick={() => saveAuctionToStorage(auctionForm, editingId)} className="btn btn-success" style={{ width: '100%' }}>
                {editingId ? '✏️ Update Auction' : '➕ Create Auction'}
              </button>
              <button onClick={closeAllModals} className="btn btn-secondary" style={{ width: '100%' }}>
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Lots Modal */}
      {selectLotsModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectLotsModal(false)}>
          <div className="modal-container modal-large">
            <div className="modal-header">
              <h2>📦 Select Lots for Auction</h2>
              <button onClick={() => setSelectLotsModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Search lots..."
                value={searchLotsInput}
                onChange={(e) => setSearchLotsInput(e.target.value)}
              />
              <div className="lots-selection-container">
                {lots
                  .filter(lot =>
                    (lot.name ?? '').toLowerCase().includes(searchLotsInput.toLowerCase()) ||
                    (lot.description ?? '').toLowerCase().includes(searchLotsInput.toLowerCase())
                  )
                  .map((lot) => (
                    <div key={lot.id} className="lot-selection-item">
                      <input
                        type="checkbox"
                        checked={selectedLots.has(Number(lot.id))}
                        onChange={(e) => {
                          const newSelectedLots = new Map(selectedLots);
                          if (e.target.checked) {
                            newSelectedLots.set(Number(lot.id), lot);
                          } else {
                            newSelectedLots.delete(Number(lot.id));
                          }
                          setSelectedLots(newSelectedLots);
                        }}
                      />
                      <div>
                        <p><strong>{lot.name}</strong></p>
                        <p>{lot.description}</p>
                        <p>Items: {lot.itemCount}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <p>Selected Lots: <span id="selected-lots-count">{selectedLots.size}</span></p>
              <button onClick={() => { setSelectLotsModal(false); saveAuctionToStorage(auctionForm, editingId); }} className="btn btn-success">Confirm</button>
              <button onClick={() => { setSelectLotsModal(false); setCreateAuctionModal(true); }} className="btn btn-secondary">Back</button>
            </div>
          </div>
        </div>
      )}

      {createLotModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeAllModals()}>
          <div className="modal-container">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Lot' : 'Create New Lot'}</h2>
              <button onClick={closeAllModals} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Lot Name"
                value={lotForm.name}
                onChange={(e) => setLotForm({ ...lotForm, name: e.target.value })}
              />
              <textarea
                placeholder="Lot Description"
                value={lotForm.description}
                onChange={(e) => setLotForm({ ...lotForm, description: e.target.value })}
              />
              <button onClick={() => setSelectItemsModal(true)} className="btn btn-primary">Select Items</button>
              <button onClick={() => saveLotToStorage(lotForm, editingId ? parseInt(editingId) : null)} className="btn btn-success">
                {editingId ? 'Update Lot' : 'Create Lot'}
              </button>
              <button onClick={closeAllModals} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectItemsModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectItemsModal(false)}>
          <div className="modal-container modal-large">
            <div className="modal-header">
              <h2>Select Items for Lot</h2>
              <button onClick={() => setSelectItemsModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Search items..."
                value={searchItemsInput}
                onChange={(e) => setSearchItemsInput(e.target.value)}
              />
              <div className="items-hierarchy-container">
                {items
                  .filter(item =>
                    (item.parentName ?? '').toLowerCase().includes(searchItemsInput.toLowerCase())
                  )
                  .map((item) => {
                    const key = String(item.id ?? crypto.randomUUID());
                    return (
                      <div key={key} className="parent-item-group">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(key)}
                          onChange={(e) => {
                            const newSelectedItems = new Map(selectedItems);
                            if (e.target.checked) {
                              newSelectedItems.set(key, { parentId: key, itemData: item, isParent: true });
                            } else {
                              newSelectedItems.delete(key);
                            }
                            setSelectedItems(newSelectedItems);
                          }}
                        />
                        <label><strong>{item.parentName ?? ''}</strong> ({item.items?.length ?? 0} items)</label>
                      </div>
                    );
                  })}
              </div>
              <p>Selected Items: <span id="selected-items-count">{selectedItems.size}</span></p>
              <button onClick={() => { setSelectItemsModal(false); saveLotToStorage(lotForm, editingId ? parseInt(editingId) : null); }} className="btn btn-success">Confirm</button>
              <button onClick={() => { setSelectItemsModal(false); setCreateLotModal(true); }} className="btn btn-secondary">Back</button>
            </div>
          </div>
        </div>
      )}

      {createItemModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeAllModals()}>
          <div className="modal-container modal-large">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Parent Item' : 'Create New Parent Item'}</h2>
              <button onClick={closeAllModals} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Serial Number</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Condition</th>
                    <th>Make</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {itemForm.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          value={item.serialNumber}
                          onChange={(e) => {
                            const newForm = [...itemForm];
                            newForm[idx].serialNumber = e.target.value;
                            setItemForm(newForm);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => {
                            const newForm = [...itemForm];
                            newForm[idx].category = e.target.value;
                            setItemForm(newForm);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const newForm = [...itemForm];
                            newForm[idx].description = e.target.value;
                            setItemForm(newForm);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.condition}
                          onChange={(e) => {
                            const newForm = [...itemForm];
                            newForm[idx].condition = e.target.value;
                            setItemForm(newForm);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.make}
                          onChange={(e) => {
                            const newForm = [...itemForm];
                            newForm[idx].make = e.target.value;
                            setItemForm(newForm);
                          }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (itemForm.length > 1) {
                              setItemForm(itemForm.filter((_, i) => i !== idx));
                            } else {
                              alert('Must have at least one item');
                            }
                          }}
                          className="btn btn-sm btn-danger"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => setItemForm([...itemForm, { serialNumber: '', category: '', description: '', condition: '', make: '' }])}
                className="btn btn-secondary"
              >
                Add Row
              </button>
              <button onClick={() => saveItemsToStorage(itemForm, editingId)} className="btn btn-success">
                {editingId ? 'Update Item' : 'Create Item'}
              </button>
              <button onClick={closeAllModals} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {auctionSuccessModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setAuctionSuccessModal(false)}>
          <div className="modal-container">
            <div className="modal-header">
              <h2>✅ {successData.title}</h2>
              <button onClick={() => setAuctionSuccessModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p><strong>Auction ID:</strong> {successData.auctionId}</p>
              <p><strong>Lots Added:</strong> {successData.lotsCount}</p>
              <button onClick={() => setAuctionSuccessModal(false)} className="btn btn-primary" style={{ width: '100%' }}>
                ✓ OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Auction Modal */}
      {deleteAuctionModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeAllModals()}>
          <div className="modal-container">
            <div className="modal-header" style={{ backgroundColor: '#dc3545' }}>
              <h2>⚠️ Delete Auction</h2>
              <button onClick={closeAllModals} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this auction? This action cannot be undone.</p>
              <p>Type <strong>DELETE</strong> to confirm:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  if (e.target.value !== 'DELETE') {
                    setDeleteErrorMessage('');
                  }
                }}
                placeholder="Type DELETE to confirm"
              />
              {deleteErrorMessage && <p style={{ color: '#dc3545', marginTop: '10px' }}>{deleteErrorMessage}</p>}
              <button
                onClick={() => {
                  if (deleteConfirmText === 'DELETE' && auctionToDelete) {
                    performAuctionDeletion(auctionToDelete);
                  } else {
                    setDeleteErrorMessage('Please type DELETE to confirm');
                  }
                }}
                className="btn btn-danger"
                style={{ width: '100%' }}
              >
                🗑️ Delete Auction
              </button>
              <button onClick={closeAllModals} className="btn btn-secondary" style={{ width: '100%' }}>
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
