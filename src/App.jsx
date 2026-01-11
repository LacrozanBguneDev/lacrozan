import React, { useState, useEffect, useMemo, useCallback, useRef, useContext, createContext } from 'react';
import DOMPurify from 'dompurify'; // LIBRARY KEAMANAN ANTI-XSS (Pastikan sudah diinstall)

// ==========================================
// BAGIAN 1: IMPORT LIBRARIES & KONFIGURASI
// ==========================================

import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    collection, 
    onSnapshot, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    setDoc, 
    serverTimestamp, 
    addDoc, 
    getDoc, 
    setLogLevel, 
    deleteDoc, 
    increment,
    limit, 
    query, 
    where, 
    orderBy,
    writeBatch,
    getDocs,
    startAfter 
} from 'firebase/firestore';

// IMPORT KHUSUS NOTIFIKASI
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
    RefreshCw, Info, Clock, Star, ExternalLink, Gamepad2, BookOpen, Users, Globe,
    CheckCircle, Sparkles, Zap, ShieldCheck, MoreHorizontal, ShieldAlert, Trash,
    BarChart3, Activity, Gift, Eye, RotateCw, Megaphone, Trophy, Laugh, Moon, Sun,
    Award, Crown, Gem, Medal, Bookmark, Coffee, Smile, Frown, Meh, CloudRain, SunMedium, 
    Hash, Tag, Wifi, Smartphone, Radio, ImageOff, Music, Mic, Play, Pause, Volume2, Minimize2,
    Scale, FileText, ChevronLeft, CornerDownRight, Reply, Ban, UserX, WifiOff, Signal, Gift as GiftIcon,
    Bug, ArrowUp, Move, ChevronDown, ChevronUp, MinusCircle, RefreshCcw, LayoutGrid, TimerReset,
    WifiHigh, Menu, MessageCircle, FileCheck, MapPin, Check as CheckIcon, Copy, Plus, MoreVertical
} from 'lucide-react';

// DEBUGGING: Matikan silent mode agar error firebase terlihat di console
// setLogLevel('silent'); 

// --- CUSTOM ALERT SYSTEM (MODERN REPLACEMENT) ---
const CustomAlertContext = createContext();

const CustomAlertProvider = ({ children }) => {
    const [alertState, setAlertState] = useState({ 
        isOpen: false, 
        message: '', 
        type: 'info', 
        onConfirm: null, 
        isConfirm: false 
    });

    const showAlert = (message, type = 'info') => {
        return new Promise((resolve) => {
            setAlertState({ 
                isOpen: true, 
                message, 
                type, 
                isConfirm: false, 
                onConfirm: () => { 
                    setAlertState(prev => ({ ...prev, isOpen: false })); 
                    resolve(true); 
                } 
            });
        });
    };

    const showConfirm = (message) => {
        return new Promise((resolve) => {
            setAlertState({
                isOpen: true,
                message,
                type: 'confirm',
                isConfirm: true,
                onConfirm: () => { 
                    setAlertState(prev => ({ ...prev, isOpen: false })); 
                    resolve(true); 
                },
                onCancel: () => { 
                    setAlertState(prev => ({ ...prev, isOpen: false })); 
                    resolve(false); 
                }
            });
        });
    };

    return (
        <CustomAlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {alertState.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 transform scale-100 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-500 to-purple-500"></div>
                        <div className="flex flex-col items-center text-center">
                            {alertState.type === 'error' ? 
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4"><AlertCircle size={32} className="text-red-500"/></div> : 
                             alertState.type === 'confirm' ? 
                                <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-full mb-4"><HelpCircle size={32} className="text-sky-500"/></div> :
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4"><Info size={32} className="text-blue-500"/></div>
                            }
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{alertState.isConfirm ? 'Konfirmasi' : 'Informasi'}</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm leading-relaxed">{alertState.message}</p>
                            <div className="flex gap-3 w-full">
                                {alertState.isConfirm && (
                                    <button onClick={alertState.onCancel} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm">Batal</button>
                                )}
                                <button onClick={alertState.onConfirm} className="flex-1 py-3 px-4 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-600 shadow-lg shadow-sky-200 transition text-sm">
                                    {alertState.isConfirm ? 'Ya, Lanjutkan' : 'Mengerti'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </CustomAlertContext.Provider>
    );
};
const useCustomAlert = () => useContext(CustomAlertContext);

// --- ERROR BOUNDARY UNTUK MENCEGAH WHITE SCREEN ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
                <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-gray-800 mb-2">Terjadi Kesalahan</h2>
                <p className="text-gray-500 text-sm mb-6">Aplikasi mengalami crash. Mohon maaf atas ketidaknyamanan ini.</p>
                <button onClick={() => window.location.reload()} className="bg-sky-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 transition w-full">Muat Ulang Aplikasi</button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- KONSTANTA GLOBAL & API (UPDATED FOR DYNAMIC CONFIG) ---


// Initial Config Object
const CONFIG = {
  APP_NAME: "BguneNet",
  APP_LOGO: "https://c.termai.cc/i150/VrL65.png",
  DEV_PHOTO: "https://c.termai.cc/i6/EAb.jpg",
  API_ENDPOINT: "/api/feed"
};

// Mutable Globals (untuk kompatibilitas dengan kode lama)
let APP_NAME = CONFIG.APP_NAME;
let APP_LOGO = CONFIG.APP_LOGO;
let DEV_PHOTO = CONFIG.DEV_PHOTO;
let API_ENDPOINT = CONFIG.API_ENDPOINT;
// FIX: Definisi API_KEY untuk mencegah ReferenceError saat fetchFeedData dipanggil
let API_KEY = ""; 

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const getPublicCollection = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;

// Initialize Firebase Variables Only (No execution here!)
let app, auth, db, googleProvider, messaging;

const initFirebaseServices = (fbConfig) => {
    try {
        if (!fbConfig) throw new Error("Firebase Config is missing");
        app = initializeApp(fbConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();

        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            try {
                messaging = getMessaging(app);
            } catch (e) {
                console.log("Messaging skipped/not supported:", e);
            }
        }
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase Initialization Error:", error);
    }
};

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================
// FITUR BARU: Format Angka (1000 -> 1rb)
const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'm'; // Miliar
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt'; // Juta
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'rb'; // Ribu (Sesuai request 1rb)
    return num.toString();
};

const fetchFeedData = async ({
    mode = 'home',
    limit = 10,
    cursor = null,
    viewerId = null,
    userId = null,
    q = null
}) => {

    // 1. Bangun query param
    const params = new URLSearchParams();
    params.append('mode', mode === 'friends' ? 'home' : mode);
    params.append('limit', limit);

    if (cursor) params.append('cursor', cursor);
    if (viewerId) params.append('viewerId', viewerId);
    if (userId) params.append('userId', userId);
    if (q) params.append('q', q);

    const url = `${API_ENDPOINT}?${params.toString()}`;

    // 2. Header aman (API key opsional)
    const headers = {
        'Content-Type': 'application/json',
    };

    // ⚠️ HANYA kirim x-api-key kalau ADA isinya
    if (typeof API_KEY === 'string' && API_KEY.trim() !== '') {
        headers['x-api-key'] = API_KEY;
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`Server Error ${response.status}`);
        }

        const data = await response.json();

        return {
            posts: Array.isArray(data.posts) ? data.posts : [],
            nextCursor: data.nextCursor ?? null,
        };

    } catch (err) {
        console.error('API Fetch Error (Feed):', err);
        return {
            posts: [],
            nextCursor: null,
        };
    }
};


const logSystemError = async (error, context = 'general', user = null) => {
    console.error(`[SystemLog:${context}]`, error);
    try {
        if (!db) return;
        if (error.message && (error.message.includes('offline') || error.message.includes('network'))) return;
        const safeUsername = user ? (user.displayName || user.username || 'Guest') : 'Guest';
        const safeUid = user ? (user.uid || 'guest') : 'guest';
        await addDoc(collection(db, getPublicCollection('systemLogs')), {
            message: error.message || String(error), stack: error.stack || '', context: context, userId: safeUid, username: safeUsername, timestamp: serverTimestamp(), userAgent: navigator.userAgent
        });
    } catch (e) {
        console.warn("Gagal menulis log ke Firestore:", e);
    }
};

const requestNotificationPermission = async (userId) => {
    if (!messaging || !userId || !db) return;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, { vapidKey: 'BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE' }); // Placeholder to avoid error
            if (token) {
                // Check if doc exists first to prevent permission-denied error
                const userRef = doc(db, getPublicCollection('userProfiles'), userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    await updateDoc(userRef, { fcmTokens: arrayUnion(token), lastTokenUpdate: serverTimestamp() });
                }
            }
        }
    } catch (error) { console.error("Gagal request notifikasi:", error); }
};

const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // FIX 3: Hemat Bandwidth - Kompresi gambar lebih agresif
                const MAX_WIDTH = 500; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Kompresi JPEG kualitas 0.5 (cukup untuk web)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(10); formData.append('file', file); 
    try {
        const progressInterval = setInterval(() => { onProgress(prev => Math.min(prev + 5, 90)); }, 500);
        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        clearInterval(progressInterval);
        onProgress(95);
        if (!response.ok) { throw new Error(`Server Error: ${response.status}`); }
        const data = await response.json();
        onProgress(100);
        if (data && data.result && data.result.url) { return data.result.url; } 
        else if (data && data.url) { return data.url; } 
        else { throw new Error('Gagal mendapatkan URL dari server.'); }
    } catch (error) { onProgress(0); throw new Error('Gagal upload video/audio. Cek koneksi.'); }
};

const sendNotification = async (toUserId, type, message, fromUser, postId = null) => {
    if (!toUserId || !fromUser || toUserId === fromUser.uid || !db) return; 
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId, fromUserId: fromUser.uid, fromUsername: fromUser.username, fromPhoto: fromUser.photoURL || '',
            type: type, message: message, postId: postId, isRead: false, timestamp: serverTimestamp()
        });
    } catch (error) { console.error("Gagal mengirim notifikasi:", error); }
};

// FIX: Format Waktu Relatif (Update 2025)
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    try {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        // Custom Short Format
        if (seconds < 60) return { relative: 'Baru saja', full: '' };
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return { relative: `${minutes} menit`, full: '' };
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return { relative: `${hours} jam`, full: '' };
        const days = Math.floor(hours / 24);
        if (days < 7) return { relative: `${days} hari`, full: '' };
        if (days < 30) return { relative: `${Math.floor(days/7)} minggu`, full: '' };
        
        return { relative: date.toLocaleDateString('id-ID'), full: date.toLocaleDateString('id-ID') };
    } catch (e) { return { relative: 'Baru saja', full: '' }; }
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; }
    const igMatch = url.match(/(?:instagram\.com\/(?:p|reel|tv)\/)([\w-]+)/);
    if (igMatch) { return { type: 'instagram', embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed`, id: igMatch[1], displayUrl: url }; }
    const tiktokMatch = url.match(/(?:tiktok\.com\/)(?:@[\w.-]+\/video\/|v\/)([\d]+)/);
    if (tiktokMatch) { return { type: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`, id: tiktokMatch[1], displayUrl: url }; }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) { return { type: 'audio_file', url: url }; }
    if (url.startsWith('http')) { return { type: 'link', embedUrl: url, displayUrl: url }; }
    return null;
};

// MODIFIED: Badge hanya untuk DEVELOPER
const getReputationBadge = (followerCount, isDev) => {
    const DEVELOPER_EMAIL = "irhamdika00@gmail.com"; // Default placeholder
    if (isDev) return { label: "DEV", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    
    // Semua label lain DIHAPUS sesuai permintaan
    return null;
};

const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g);
    return matches ? matches : [];
};

const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    try {
        const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        const diff = Date.now() - last.getTime();
        return diff < 10 * 60 * 1000; 
    } catch(e) { return false; }
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL & SIDEBAR
// ==========================================

// FIX: Tambahkan props chatUnreadCount untuk indikator merah di sidebar
const ModernSidebar = ({ isOpen, onClose, setPage, user, onLogout, handleFriendsClick, setShowAuthModal, chatUnreadCount }) => {
    const sidebarRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (sidebarRef.current && !sidebarRef.current.contains(event.target)) onClose(); };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    const handleGuestAction = () => {
        onClose();
        if (setShowAuthModal) setShowAuthModal(true);
    };

    // LOGIKA BARU: Handle Chat Click
    const handleChatClick = () => {
        if (!user) {
            onClose();
            if (setShowAuthModal) setShowAuthModal(true);
        } else {
            setPage('chat');
            onClose();
        }
    };

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] transition-opacity" />}
            <div ref={sidebarRef} className={`fixed top-0 left-0 h-full w-[280px] bg-white dark:bg-gray-900 shadow-2xl z-[160] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Header User */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-sky-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 p-[2px]">
                            <img src={user?.photoURL || APP_LOGO} className="w-full h-full rounded-full object-cover border-2 border-white dark:border-gray-800"/>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{user?.displayName || user?.username || "Tamu"}</h3>
                            <p className="text-xs text-gray-500">{user ? "Member Aktif" : "Mode Tamu"}</p>
                        </div>
                    </div>
                    {user ? (
                        <button onClick={onLogout} className="w-full py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition"><LogOut size={14}/> Keluar</button>
                    ) : (
                        <button onClick={handleGuestAction} className="w-full py-2 bg-sky-500 text-white rounded-lg text-xs font-bold hover:bg-sky-600 transition">Masuk / Keluar Tamu</button>
                    )}
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <div className="text-[10px] font-bold text-gray-400 px-4 mb-2 uppercase tracking-wider">Navigasi Utama</div>
                    <SidebarItem icon={Home} label="Beranda" onClick={() => { setPage('home'); onClose(); }} />
                    <SidebarItem icon={User} label="Profil Saya" onClick={() => { setPage('profile'); onClose(); }} />
                    <SidebarItem icon={Trophy} label="Top Followers" onClick={() => { setPage('leaderboard'); onClose(); }} />
                    
                    <div className="text-[10px] font-bold text-gray-400 px-4 mb-2 mt-6 uppercase tracking-wider">Sosial & Info</div>
                    {/* FIX: Indikator Chat Belum Dibaca */}
                    <SidebarItem icon={MessageCircle} label="Ruang Chat" onClick={handleChatClick} badge={chatUnreadCount} />
                    <SidebarItem icon={Users} label="Teman Saya" onClick={() => { handleFriendsClick(); onClose(); }} />
                    
                    <div className="text-[10px] font-bold text-gray-400 px-4 mb-2 mt-6 uppercase tracking-wider">Hukum & Bantuan</div>
                    <SidebarItem icon={FileCheck} label="Kebijakan & Privasi" onClick={() => { setPage('legal'); onClose(); }} />
                    <SidebarItem icon={ShieldCheck} label="Aturan Komunitas" onClick={() => { setPage('legal'); onClose(); }} />
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-center">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{APP_NAME}</p>
                    <p className="text-[10px] text-gray-500 mt-1">di bawah naungan Bgune Digital</p>
                    <p className="text-[10px] text-gray-400 mt-2">v2.5.4 (Lite Edition)</p>
                </div>
            </div>
        </>
    );
};

const SidebarItem = ({ icon: Icon, label, onClick, badge }) => (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
        <div className="flex items-center gap-3">
            <Icon size={18} className="text-gray-400"/> {label}
        </div>
        {badge > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {badge > 99 ? '99+' : badge}
            </span>
        )}
    </button>
);

// ==========================================
// BAGIAN: SISTEM CHAT REALTIME (DIPERBAIKI TOTAL)
// ==========================================

const ChatSystem = ({ currentUser, onBack }) => {
    const { showAlert, showConfirm } = useCustomAlert();
    const [view, setView] = useState('list'); // 'list' or 'room'
    const [activeChatId, setActiveChatId] = useState(null);
    const [activeRecipient, setActiveRecipient] = useState(null);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Chat List
    useEffect(() => {
        if (!currentUser || !db) return;
        setLoading(true);
        // Query chats where user is participant
        const q = query(collection(db, getPublicCollection('chats')), where('participants', 'array-contains', currentUser.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by updated time locally
            chatList.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
            setChats(chatList);
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    // Handle New Chat / Select Chat
    const handleSelectChat = async (recipientId, recipientData) => {
        if (!currentUser || !recipientId || !db) return;
        
        // Cek existing chat
        const existingChat = chats.find(c => c.participants.includes(recipientId));
        if (existingChat) {
            setActiveChatId(existingChat.id);
            setActiveRecipient(recipientData || existingChat.userInfo?.[recipientId]);
            setView('room');
        } else {
            // Create New Chat Document
            try {
                const newChatRef = await addDoc(collection(db, getPublicCollection('chats')), {
                    participants: [currentUser.uid, recipientId],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    typing: { [currentUser.uid]: false, [recipientId]: false }
                });
                setActiveChatId(newChatRef.id);
                setActiveRecipient(recipientData);
                setView('room');
            } catch (e) {
                console.error("Gagal buat chat", e);
                showAlert("Gagal memulai percakapan", "error");
            }
        }
    };

    const handleDeleteChat = async (chatId) => {
        const ok = await showConfirm("Hapus riwayat chat ini? Pesan akan hilang permanen.");
        if (!ok) return;
        try {
            await deleteDoc(doc(db, getPublicCollection('chats'), chatId));
            showAlert("Chat dihapus", "success");
        } catch (e) { showAlert("Gagal hapus chat", "error"); }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[60] flex flex-col h-full w-full">
            {view === 'list' ? (
                <ChatList 
                    currentUser={currentUser} 
                    chats={chats} 
                    loading={loading}
                    onSelectChat={(chat) => {
                        const otherId = chat.participants.find(id => id !== currentUser.uid);
                        setActiveChatId(chat.id);
                        setActiveRecipient({ uid: otherId }); // Profile fetch inside room
                        setView('room');
                    }}
                    onNewChat={handleSelectChat}
                    onDeleteChat={handleDeleteChat}
                    onBack={onBack}
                />
            ) : (
                <ChatRoom 
                    currentUser={currentUser}
                    chatId={activeChatId}
                    recipient={activeRecipient}
                    onBack={() => { setView('list'); setActiveChatId(null); }}
                />
            )}
        </div>
    );
};

const ChatList = ({ currentUser, chats, loading, onSelectChat, onNewChat, onDeleteChat, onBack }) => {
    const [showNewChat, setShowNewChat] = useState(false);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
            {/* Header Chat List */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><ArrowLeft/></button>
                    <h1 className="text-xl font-bold dark:text-white">Pesan</h1>
                </div>
                <button onClick={() => setShowNewChat(true)} className="p-2 bg-sky-50 text-sky-600 rounded-full hover:bg-sky-100 transition"><Edit size={20}/></button>
            </div>

            {/* Chat List Items */}
            <div className="flex-1 overflow-y-auto">
                {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-sky-500"/></div> : 
                 chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                        <MessageCircle size={64} className="text-gray-200 mb-4"/>
                        <h3 className="font-bold text-gray-500">Belum ada percakapan</h3>
                        <p className="text-xs text-gray-400 mb-6">Mulai chat dengan teman-temanmu!</p>
                        <button onClick={() => setShowNewChat(true)} className="bg-sky-500 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-sky-600 transition">Mulai Chat Baru</button>
                    </div>
                 ) : (
                     <div className="divide-y divide-gray-50 dark:divide-gray-800">
                         {chats.map(chat => (
                             <ChatListItem 
                                key={chat.id} 
                                chat={chat} 
                                currentUserId={currentUser.uid} 
                                onClick={() => onSelectChat(chat)}
                                onLongPress={() => onDeleteChat(chat.id)}
                             />
                         ))}
                     </div>
                 )
                }
            </div>

            {/* Friend Selector Modal */}
            {showNewChat && <NewChatSelector currentUser={currentUser} onClose={() => setShowNewChat(false)} onSelect={onNewChat} />}
        </div>
    );
};

const ChatListItem = ({ chat, currentUserId, onClick, onLongPress }) => {
    const otherId = chat.participants.find(id => id !== currentUserId);
    const [profile, setProfile] = useState(null);
    const longPressTimer = useRef(null);

    useEffect(() => {
        if(!db) return;
        const unsub = onSnapshot(doc(db, getPublicCollection('userProfiles'), otherId), doc => {
            if (doc.exists()) setProfile(doc.data());
        });
        return () => unsub();
    }, [otherId]);

    const handleStart = () => { longPressTimer.current = setTimeout(onLongPress, 800); };
    const handleEnd = () => { clearTimeout(longPressTimer.current); };

    if (!profile) return <div className="p-4 animate-pulse flex gap-3"><div className="w-14 h-14 bg-gray-200 rounded-full"/><div className="flex-1 bg-gray-100 h-10 rounded-xl"/></div>;

    const lastMsg = chat.lastMessage || {};
    const isMe = lastMsg.senderId === currentUserId;
    const isUnread = !isMe && lastMsg.isRead === false;

    return (
        <div 
            onClick={onClick}
            onTouchStart={handleStart} onTouchEnd={handleEnd} onMouseDown={handleStart} onMouseUp={handleEnd} onMouseLeave={handleEnd}
            className={`p-4 flex items-center gap-4 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800 ${isUnread ? 'bg-sky-50/40 dark:bg-sky-900/10' : ''}`}
        >
            <div className="relative">
                <Avatar src={profile.photoURL} className="w-14 h-14 rounded-full object-cover border border-gray-100 dark:border-gray-700"/>
                {isUserOnline(profile.lastSeen) && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`text-base truncate ${isUnread ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-800 dark:text-gray-200'}`}>{profile.username}</h3>
                    <span className={`text-[10px] font-medium ${isUnread ? 'text-sky-500' : 'text-gray-400'}`}>{formatTimeAgo(chat.updatedAt).relative}</span>
                </div>
                <div className="flex items-center gap-1">
                    {isMe && (lastMsg.isRead ? <CheckCircle size={14} className="text-sky-500"/> : <Check size={14} className="text-gray-400"/>)}
                    <p className={`text-sm truncate leading-snug ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                        {chat.typing?.[otherId] ? <span className="text-sky-500 italic">Sedang mengetik...</span> : (lastMsg.text || 'Mulai percakapan')}
                    </p>
                </div>
            </div>
        </div>
    );
};

const NewChatSelector = ({ currentUser, onClose, onSelect }) => {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if(!db) return;
                const myProfile = await getDoc(doc(db, getPublicCollection('userProfiles'), currentUser.uid));
                if (myProfile.exists()) {
                    const data = myProfile.data();
                    const myFollowers = data.followers || [];
                    const myFollowing = data.following || [];
                    const friendIds = myFollowing.filter(id => myFollowers.includes(id)).slice(0, 20);
                    
                    if (friendIds.length > 0) {
                        const friendProfiles = [];
                        for (const id of friendIds) {
                            const snap = await getDoc(doc(db, getPublicCollection('userProfiles'), id));
                            if (snap.exists()) friendProfiles.push({ id: snap.id, ...snap.data() });
                        }
                        setFriends(friendProfiles);
                    }
                }
            } catch(e) { console.error(e); } finally { setLoading(false); }
        };
        load();
    }, [currentUser]);

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex flex-col justify-end md:justify-center md:items-center">
             <div className="bg-white dark:bg-gray-900 w-full md:w-[400px] h-[80vh] md:h-[600px] rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                 <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                     <h2 className="font-bold text-lg dark:text-white">Teman Baru</h2>
                     <button onClick={onClose}><X/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2">
                     {loading ? (
                         <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                             <Loader2 className="animate-spin text-sky-500" size={32} />
                             <p className="text-xs">Memuat daftar teman...</p>
                         </div>
                     ) : friends.length === 0 ? (
                         <div className="text-center mt-10 p-6">
                             <UserX size={48} className="mx-auto text-gray-200 mb-2"/>
                             <p className="text-gray-500 font-bold">Belum ada teman mutual.</p>
                             <p className="text-xs text-gray-400 mt-1">Saling follow user lain untuk memulai chat!</p>
                         </div>
                     ) : (
                      friends.map(f => (
                          <div key={f.id} onClick={() => { onSelect(f.id, f); onClose(); }} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition">
                              <Avatar src={f.photoURL} className="w-12 h-12 rounded-full"/>
                              <div><h4 className="font-bold dark:text-white">{f.username}</h4><p className="text-xs text-gray-400">Tap untuk chat</p></div>
                          </div>
                      ))
                     )}
                 </div>
             </div>
        </div>
    );
};

const ChatRoom = ({ currentUser, chatId, recipient, onBack }) => {
    const { showAlert } = useCustomAlert();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [recipientProfile, setRecipientProfile] = useState(recipient || null);
    const [isTyping, setIsTyping] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const bottomRef = useRef(null);
    const topRef = useRef(null);
    const typingTimeout = useRef(null);
    const [selectedMsg, setSelectedMsg] = useState(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const [messagesLimit, setMessagesLimit] = useState(15); // FIX: Lazy loading limit
    const [loadingMore, setLoadingMore] = useState(false);
    const lastSentTime = useRef(0);

    const recipientId = recipient?.uid || recipientProfile?.uid;
    const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🙏", "👋", "🤔", "🎉", "🤣", "🥺"];

    // Fetch Recipient Profile
    useEffect(() => {
        if (!recipientId || !db) return;
        const unsub = onSnapshot(doc(db, getPublicCollection('userProfiles'), recipientId), (doc) => {
            if (doc.exists()) setRecipientProfile({ uid: doc.id, ...doc.data() });
        });
        return () => unsub();
    }, [recipientId]);

    // FIX: Auto-delete messages older than 7 days (cleanup task)
    // Jalankan hanya sekali saat komponen mount
    useEffect(() => {
        const cleanupOldMessages = async () => {
            if (!chatId || !db) return;
            try {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                
                // Cari pesan lama yg SUDAH dibaca
                const q = query(
                    collection(db, getPublicCollection('chats'), chatId, 'messages'),
                    where('timestamp', '<', sevenDaysAgo),
                    where('isRead', '==', true),
                    limit(50) // Batch limit
                );
                
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`[Auto-Clean] Deleted ${snapshot.size} old messages.`);
                }
            } catch (e) { console.error("Auto-cleanup failed:", e); }
        };
        cleanupOldMessages();
    }, [chatId]);

    // Fetch Messages with Limit (Lazy Loading)
    useEffect(() => {
        if (!chatId || !db) return;
        
        // FIX: Path error - Gunakan collection() dengan path lengkap
        const messagesRef = collection(db, getPublicCollection('chats'), chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messagesLimit));

        const unsub = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
            setMessages(msgs);
            
            // Mark unread as read (logic tetap sama)
            const unreadIds = msgs.filter(m => m.senderId !== currentUser.uid && !m.isRead).map(m => m.id);
            if (unreadIds.length > 0) {
                unreadIds.forEach(id => {
                    // FIX: Path error - Gunakan doc() dengan 8 segmen (col, id, col, id...)
                    const msgDocRef = doc(db, getPublicCollection('chats'), chatId, 'messages', id);
                    updateDoc(msgDocRef, { isRead: true }).catch(err => console.error("Read mark fail:", err));
                });
                // Update parent chat doc
                updateDoc(doc(db, getPublicCollection('chats'), chatId), { [`lastMessage.isRead`]: true }).catch(()=>{});
            }
        });
        return () => unsub();
    }, [chatId, messagesLimit]); // Re-run when limit changes

    // Scroll effect
    useEffect(() => {
        if (messagesLimit === 15) { // Only scroll to bottom on initial load
             bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, messagesLimit]);

    const handleLoadMore = () => {
        setLoadingMore(true);
        setMessagesLimit(prev => prev + 15);
        setTimeout(() => setLoadingMore(false), 1000);
    };

    const handleTyping = (e) => {
        setText(e.target.value);
        if (!isTyping) {
            setIsTyping(true);
            updateDoc(doc(db, getPublicCollection('chats'), chatId), { [`typing.${currentUser.uid}`]: true }).catch(()=>{});
        }
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            setIsTyping(false);
            updateDoc(doc(db, getPublicCollection('chats'), chatId), { [`typing.${currentUser.uid}`]: false }).catch(()=>{});
        }, 2000);
    };

    const sendMessage = async (e) => {
        if(e) e.preventDefault();
        
        // FIX: Anti-Spam (1 detik delay)
        const now = Date.now();
        if (now - lastSentTime.current < 1000) {
             showAlert("Tunggu sebentar sebelum mengirim pesan lagi.", "error");
             return;
        }
        lastSentTime.current = now;

        if (!text.trim()) return;
        
        // FIX: Character Limit (1000 chars)
        if (text.length > 1000) {
            showAlert("Pesan terlalu panjang (Maks 1000 karakter).", "error");
            return;
        }

        const msgText = text.trim();
        setText(''); setReplyTo(null); setShowEmoji(false);
        
        try {
            const msgData = {
                text: msgText,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
                isRead: false,
                // FIX: Reply structure agar UI bisa render dengan benar
                replyTo: replyTo ? { 
                    id: replyTo.id, 
                    text: replyTo.text, 
                    senderName: replyTo.senderId === currentUser.uid ? 'Anda' : recipientProfile.username 
                } : null
            };
            
            await addDoc(collection(db, getPublicCollection('chats'), chatId, 'messages'), msgData);
            
            await updateDoc(doc(db, getPublicCollection('chats'), chatId), {
                lastMessage: { text: msgText, senderId: currentUser.uid, timestamp: serverTimestamp(), isRead: false },
                updatedAt: serverTimestamp(),
                [`typing.${currentUser.uid}`]: false
            });
            
            if (!isUserOnline(recipientProfile?.lastSeen)) {
                sendNotification(recipientId, 'chat', `mengirim pesan: ${msgText.substring(0, 30)}...`, {uid: currentUser.uid, username: currentUser.displayName || 'Teman', photoURL: currentUser.photoURL});
            }
            
        } catch (e) { console.error("Send failed", e); showAlert("Gagal kirim pesan", "error"); }
    };

    const handleActionReply = () => {
        if(!selectedMsg) return;
        setReplyTo(selectedMsg);
        setSelectedMsg(null);
    };

    const handleActionCopy = () => {
        if(!selectedMsg) return;
        navigator.clipboard.writeText(selectedMsg.text);
        setSelectedMsg(null);
        showAlert("Teks disalin", "success");
    };

    // FIX: Fitur Hapus Pesan yang sebelumnya error
    const handleActionDelete = async () => {
        if(!selectedMsg) return;
        try { 
            // FIX: Gunakan path 8 segmen yang benar
            await deleteDoc(doc(db, getPublicCollection('chats'), chatId, 'messages', selectedMsg.id)); 
            showAlert("Pesan dihapus", "success");
        }
        catch (e) { console.error(e); showAlert("Gagal menghapus pesan", "error"); }
        setSelectedMsg(null);
    };

    return (
        <div className="flex flex-col h-full bg-[#EFE7DD] dark:bg-gray-900 absolute inset-0">
            {/* Header Room / Context Menu */}
            {selectedMsg ? (
                <div className="px-4 py-3 bg-sky-600 text-white flex items-center justify-between shadow-md z-30 animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-4">
                         <button onClick={() => setSelectedMsg(null)}><X size={20}/></button>
                         <span className="font-bold text-sm">1 Pesan Dipilih</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button onClick={handleActionReply} className="flex flex-col items-center"><Reply size={20}/><span className="text-[10px]">Balas</span></button>
                        <button onClick={handleActionCopy} className="flex flex-col items-center"><Copy size={20}/><span className="text-[10px]">Salin</span></button>
                        {selectedMsg.senderId === currentUser.uid && (
                            <button onClick={handleActionDelete} className="flex flex-col items-center"><Trash2 size={20}/><span className="text-[10px]">Hapus</span></button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm z-20">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full"><ArrowLeft/></button>
                        <div className="flex items-center gap-3">
                            <Avatar src={recipientProfile?.photoURL} className="w-10 h-10 rounded-full"/>
                            <div>
                                <h3 className="font-bold text-base dark:text-white line-clamp-1">{recipientProfile?.username || 'Memuat...'}</h3>
                                <p className="text-xs text-gray-500">
                                    {isUserOnline(recipientProfile?.lastSeen) ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button className="p-2"><MoreVertical size={24} className="text-gray-500"/></button>
                </div>
            )}

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://c.termai.cc/i200/BGchat.png')] bg-repeat bg-contain opacity-100 dark:opacity-80">
                {/* FIX: Tombol Load More / Tarik ke atas */}
                <div className="flex justify-center py-2" ref={topRef}>
                    <button onClick={handleLoadMore} className="text-xs text-gray-500 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded-full shadow-sm hover:bg-white transition flex items-center gap-1">
                        {loadingMore ? <Loader2 size={12} className="animate-spin"/> : <ArrowUp size={12}/>}
                        {loadingMore ? 'Memuat...' : 'Tarik untuk pesan lama'}
                    </button>
                </div>

                {messages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showDate = idx === 0 || (msg.timestamp?.toMillis() - messages[idx-1].timestamp?.toMillis() > 3600000);
                    
                    return (
                        <React.Fragment key={msg.id}>
                            {showDate && <div className="text-center my-4"><span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-3 py-1 rounded-full font-bold shadow-sm">{formatTimeAgo(msg.timestamp).full}</span></div>}
                            <MessageBubble 
                                msg={msg} 
                                isMe={isMe} 
                                isSelected={selectedMsg && selectedMsg.id === msg.id}
                                onLongPress={() => setSelectedMsg(msg)} // Fix Long Press trigger
                            />
                        </React.Fragment>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 p-2 border-t border-gray-100 dark:border-gray-700 z-20 pb-safe">
                {replyTo && (
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-t-lg border-l-4 border-sky-500 mb-2 mx-2 animate-in slide-in-from-bottom-2">
                        <div className="text-xs">
                            <p className="font-bold text-sky-600">Membalas {replyTo.senderId === currentUser.uid ? 'Diri sendiri' : recipientProfile.username}</p>
                            <p className="truncate text-gray-500 dark:text-gray-300 max-w-[250px]">{replyTo.text}</p>
                        </div>
                        <button onClick={() => setReplyTo(null)}><X size={16}/></button>
                    </div>
                )}
                {/* EMOJI PICKER SIMPLE */}
                {showEmoji && (
                    <div className="flex gap-2 p-2 overflow-x-auto bg-gray-50 dark:bg-gray-700 mb-2 rounded-xl no-scrollbar">
                        {commonEmojis.map(emoji => (
                            <button key={emoji} onClick={() => setText(prev => prev + emoji)} className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-lg transition">{emoji}</button>
                        ))}
                    </div>
                )}
                <form onSubmit={sendMessage} className="flex items-end gap-2 p-2">
                    <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-3 transition ${showEmoji ? 'text-sky-500 bg-sky-50 rounded-full' : 'text-gray-400 hover:text-sky-500'}`}>
                        <Smile size={24}/>
                    </button>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2 flex items-center">
                        <textarea 
                            value={text} 
                            onChange={handleTyping} 
                            placeholder="Ketik pesan..." 
                            rows="1"
                            maxLength={1000} // FIX: Limit karakter
                            className="w-full bg-transparent outline-none text-base dark:text-white resize-none max-h-32 py-1.5"
                            style={{ minHeight: '24px' }}
                            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            onClick={() => setShowEmoji(false)}
                        />
                    </div>
                    <button type="submit" disabled={!text.trim()} className="p-3 bg-sky-500 text-white rounded-full shadow-md hover:bg-sky-600 transition disabled:opacity-50"><Send size={20}/></button>
                </form>
            </div>
        </div>
    );
};

// FIX: Helper khusus untuk render link chat yang aman & Warna PUTIH di bubble sender
const renderChatText = (text, isMe) => {
    if(!text) return "";
    // Regex URL sederhana
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" 
                   // FIX: Warna putih jika isMe=true, biru jika pesan teman. Tambahkan break-all.
                   className={`${isMe ? 'text-white' : 'text-blue-500 dark:text-blue-400'} underline hover:opacity-80 break-all`} 
                   onClick={(e) => e.stopPropagation()}>
                    {part}
                </a>
            );
        }
        return part;
    });
};

const MessageBubble = ({ msg, isMe, isSelected, onLongPress }) => {
    const timerRef = useRef(null);

    const handleStart = () => { timerRef.current = setTimeout(onLongPress, 600); };
    const handleEnd = () => { clearTimeout(timerRef.current); };
    
    const touchStart = useRef(0);
    const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; handleStart(); };
    const handleTouchEnd = (e) => { handleEnd(); };

    return (
        <div 
            className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-1 ${isSelected ? 'opacity-70 bg-sky-50 dark:bg-sky-900/20 py-1 -mx-4 px-4' : ''}`}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
            onMouseDown={handleStart} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        >
            <div className={`relative max-w-[80%] px-4 py-2.5 rounded-[1.2rem] text-[15px] shadow-sm cursor-pointer ${isMe ? 'bg-sky-500 text-white rounded-tr-none' : 'bg-white dark:bg-gray-700 dark:text-white rounded-tl-none border border-gray-100 dark:border-gray-600'}`}>
                {msg.replyTo && (
                    <div className={`mb-1 p-2 rounded-lg border-l-4 bg-black/5 dark:bg-white/10 text-[11px] ${isMe ? 'border-white/50' : 'border-sky-500'}`}>
                        <span className="font-bold opacity-90 block mb-0.5">{msg.replyTo.senderName}</span>
                        <p className="truncate opacity-80">{msg.replyTo.text}</p>
                    </div>
                )}
                {/* FIX: Render text dengan link clickable & break-words untuk overflow */}
                <p className="leading-relaxed whitespace-pre-wrap break-all">
                    {renderChatText(msg.text, isMe)}
                </p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-sky-100' : 'text-gray-400'}`}>
                    <span>{msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                    {isMe && (msg.isRead ? <CheckCircle size={12} className="text-white"/> : <Check size={12}/>)}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL & SIDEBAR (LANJUTAN)
// ==========================================

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    useEffect(() => {
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); const lastDismiss = localStorage.getItem('pwa_dismissed'); if (!lastDismiss || Date.now() - parseInt(lastDismiss) > 86400000) { setShowBanner(true); } };
        window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    const handleInstall = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { setDeferredPrompt(null); setShowBanner(false); } };
    if (!showBanner) return null;
    return (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom border border-gray-700">
            <div className="flex items-center gap-3"><div className="bg-sky-500 p-2.5 rounded-xl shadow-lg shadow-sky-500/20"><Smartphone size={24}/></div><div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-gray-300">Notifikasi & Fullscreen</p></div></div>
            <div className="flex items-center gap-2"><button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full"><X size={16}/></button><button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600 transition">Pasang</button></div>
        </div>
    );
};

const Avatar = ({ src, alt, className, fallbackText }) => {
    const [error, setError] = useState(false);
    const safeFallback = fallbackText ? fallbackText : "?";
    if (!src || error) { return ( <div className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-black text-gray-500 dark:text-gray-400 select-none`}>{safeFallback[0]?.toUpperCase() || '?'}</div> ); }
    return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setError(true)} loading="lazy" />;
};

const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showNotif, setShowNotif] = useState(false);
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); setShowNotif(true); setTimeout(() => setShowNotif(false), 3000); };
        const handleOffline = () => { setIsOnline(false); setShowNotif(true); };
        window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);
    if (!showNotif) return null;
    return ( <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 transition-all duration-300 ${isOnline ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}{isOnline ? "Koneksi Stabil Kembali" : "Koneksi Terputus - Mode Offline"}</div> );
};

const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md z-50"><X size={24}/></button>
            <div className="flex-1 w-full flex items-center justify-center relative">
                {images.length > 1 && (<button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length)}} className="absolute left-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronLeft/></button>)}
                <img src={images[index]} className="max-w-full max-h-screen object-contain" />
                {images.length > 1 && (<button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length)}} className="absolute right-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronRight/></button>)}
            </div>
        </div>
    );
};

// FIX: Audio Player UI Update (Vidstack-like style)
// REVISI: Tampilan Glassy Modern dengan Animasi Bar Visualizer
const AudioPlayer = ({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => { 
        if (audioRef.current) { 
            if (isPlaying) audioRef.current.pause(); 
            else audioRef.current.play(); 
            setIsPlaying(!isPlaying); 
        } 
    };

    const formatTime = (time) => {
        if(isNaN(time)) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0'+sec : sec}`;
    }
    
    return (
        <div className="group bg-zinc-900 rounded-xl p-3 flex items-center gap-3 mb-4 shadow-xl border border-zinc-800 overflow-hidden relative w-full max-w-md mx-auto">
             {/* Background Decoration */}
             <div className="absolute -right-10 -top-10 w-32 h-32 bg-sky-500/20 blur-3xl rounded-full pointer-events-none"></div>
             
             {/* Play Button */}
             <button onClick={togglePlay} className="relative z-10 w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform shrink-0">
                {isPlaying ? <Pause size={18} fill="white"/> : <Play size={18} fill="white" className="ml-1"/>}
             </button>

             {/* Content */}
             <div className="flex-1 relative z-10 min-w-0">
                 <div className="flex items-center justify-between mb-1.5">
                     <span className="text-[10px] font-black text-sky-400 tracking-wider flex items-center gap-1.5">
                        <Music size={10} /> AUDIO
                     </span>
                     <span className="text-[10px] font-mono text-zinc-400">
                        {formatTime(audioRef.current?.currentTime)} / {formatTime(duration)}
                     </span>
                 </div>
                 
                 {/* Progress Bar */}
                 <div className="relative h-1.5 w-full bg-zinc-700/50 rounded-full overflow-hidden cursor-pointer group-hover:h-2 transition-all" 
                      onClick={(e) => {
                          const bounds = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - bounds.left;
                          const pct = x / bounds.width;
                          if(audioRef.current) audioRef.current.currentTime = pct * duration;
                      }}>
                     <div className="absolute h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full" style={{width: `${progress}%`}}></div>
                 </div>
             </div>

             {/* Visualizer Bars (Fake Animation) */}
             <div className="flex gap-0.5 items-end h-8 shrink-0 opacity-50">
                {[...Array(5)].map((_,i) => (
                    <div key={i} className={`w-1 bg-sky-500 rounded-t-sm transition-all duration-300 ${isPlaying ? 'animate-music-bar' : 'h-2'}`} style={{animationDelay: `${i*0.1}s`}}></div>
                ))}
             </div>

             <audio 
                ref={audioRef} 
                src={src} 
                className="hidden" 
                onTimeUpdate={(e) => setProgress((e.target.currentTime / e.target.duration) * 100)}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onEnded={() => {setIsPlaying(false); setProgress(0);}} 
                onPause={() => setIsPlaying(false)} 
                onPlay={() => setIsPlaying(true)}
             />
             <style>{`
                @keyframes music-bar { 0%, 100% { height: 20%; } 50% { height: 80%; } }
                .animate-music-bar { animation: music-bar 0.8s ease-in-out infinite; }
             `}</style>
        </div>
    );
};

// FIX: New Video Player Component with Loading Indicator (Request #4)
const ModernVideoPlayer = ({ src }) => {
    const [buffering, setBuffering] = useState(true); // Start true to show load initially
    const videoRef = useRef(null);

    return (
        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-sky-900/50 shadow-lg shadow-sky-900/20 group">
            {/* Modern Blue Header Tag */}
            <div className="absolute top-4 left-4 z-10 bg-sky-600/90 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold flex items-center gap-1 shadow-lg">
                 <Film size={12} className="text-white" />
                 <span>HD VIDEO</span>
            </div>
            
            {/* Loading/Buffering Overlay */}
            {buffering && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
                         <Loader2 size={40} className="text-sky-500 animate-spin drop-shadow-lg" />
                         <span className="text-xs font-bold text-white shadow-black drop-shadow-md">Memuat Video...</span>
                    </div>
                </div>
            )}
            
            <video
                ref={videoRef}
                src={src}
                controls
                controlsList="nodownload"
                className="w-full h-auto max-h-[80vh] object-contain bg-black"
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onLoadedData={() => setBuffering(false)}
                onLoadStart={() => setBuffering(true)}
            />
        </div>
    );
};

// FIX: Splash Screen Update (Background Image & Blur)
const SplashScreen = () => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[url('https://c.termai.cc/i120/womQPBg.jpg')] bg-cover bg-center">
        {/* Overlay Blur & Color */}
        <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8 animate-bounce-slow">
                <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
                <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-widest drop-shadow-sm">{APP_NAME}</h1>
            <div className="w-48 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden mb-4 shadow-inner">
                <div className="h-full bg-sky-500 animate-progress-indeterminate"></div>
            </div>
            <p className="text-gray-500 dark:text-gray-300 text-xs font-bold animate-pulse">Menghubungkan ke server...</p>
        </div>
    </div>
);

const OfflinePage = ({ onRetry }) => (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center">
        <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6"><WifiOff size={40} className="text-gray-400"/></div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Kamu Offline</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">Sepertinya internet kamu sedang istirahat.</p>
        <button onClick={onRetry} className="bg-sky-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-sky-600 transition flex items-center gap-2"><RefreshCw size={18}/> Coba Lagi</button>
    </div>
);

// New Component: DataTimeoutPage
const DataTimeoutPage = () => (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center z-[110] relative">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse"><AlertTriangle size={40} className="text-red-500"/></div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Gagal Memuat Data</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs text-sm leading-relaxed">
            Data Profile atau Papan Peringkat memakan waktu terlalu lama.
            <br/><br/>
            Ini mungkin karena koneksi lambat atau server sedang dalam perbaikan oleh Developer.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => window.location.reload()} className="bg-sky-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition flex items-center justify-center gap-2"><RefreshCw size={18}/> Refresh Total</button>
            <p className="text-[10px] text-gray-400">Silakan kembali lagi nanti jika masalah berlanjut.</p>
        </div>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4"></div>
    </div>
);

// PERBAIKAN 1 & 3: Anti-XSS (Security Wise) & Layout
// FIX: TOKENIZATION LOGIC TO PREVENT BROKEN LINKS IN DESCRIPTION
const renderMarkdown = (text, onHashtagClick) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    
    let html = text;
    
    // --- FIX: TOKENIZATION AGAR LINK TIDAK RUSAK ---
    const linkTokens = [];

    // 1. Simpan MD Links [Label](url) ke token sementara
    // Ini mencegah regex Raw URL merusak HTML link yang sudah digenerate
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const token = `__MD_LINK_${linkTokens.length}__`;
        linkTokens.push({
            token,
            value: `<a href="${url}" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1">${label} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`
        });
        return token;
    });

    // 2. Convert Raw URLs (Hanya yang bukan bagian dari token HTML)
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { 
        // Jika match adalah bagian dari token placeholder (sangat jarang terjadi kecuali url aneh), abaikan
        if (match.includes('__MD_LINK_')) return match; 
        return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all">${match}</a>`; 
    });

    // 3. Formatting MD (Bold, Italic, Code)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/`(.*?)`/g, '<code class="bg-sky-50 dark:bg-sky-900/30 px-1 rounded text-sm text-sky-700 dark:text-sky-400 font-mono border border-sky-100 dark:border-sky-800">$1</code>');
    
    // 4. Hashtags
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline hashtag" data-tag="$1">#$1</span>');
    html = html.replace(/\n/g, '<br>');

    // 5. Kembalikan MD Links dari token
    linkTokens.forEach(item => {
        html = html.replace(item.token, item.value);
    });

    // 6. Sanitasi Akhir dengan DOMPurify (Hapus XSS)
    const cleanHtml = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'class', 'data-tag'], 
        ADD_TAGS: ['svg', 'path', 'polyline', 'line'], 
    });
    
    return (
        <div 
            className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-[13px] md:text-sm" 
            dangerouslySetInnerHTML={{ __html: cleanHtml }} 
            onClick={(e) => { 
                if (e.target.classList.contains('hashtag')) { 
                    e.stopPropagation(); 
                    if(onHashtagClick) onHashtagClick(e.target.getAttribute('data-tag')); 
                }
                const link = e.target.closest('a');
                if (link) { e.stopPropagation(); }
            }}
        />
    );
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER (Admin Only)
// ==========================================

const DeveloperDashboard = ({ onClose }) => {
    const { showConfirm, showAlert } = useCustomAlert();
    const [stats, setStats] = useState({ users: 0, posts: 0, postsToday: 0 });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [sendingBC, setSendingBC] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [allUsersList, setAllUsersList] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); 
    const [systemLogs, setSystemLogs] = useState([]);
    const DEVELOPER_EMAIL = "irhamdika00@gmail.com";

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            // FIX: Tambahkan error handling di sini juga
            try {
                const usersSnap = await new Promise((resolve, reject) => { 
                    const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), 
                    (snap) => { resolve(snap); unsub(); },
                    (err) => reject(err)
                    ); 
                });
                const postsSnap = await new Promise((resolve, reject) => { 
                    const unsub = onSnapshot(query(collection(db, getPublicCollection('posts')), limit(1000)), 
                    (snap) => { resolve(snap); unsub(); },
                    (err) => reject(err)
                    ); 
                });
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const rawPosts = postsSnap.docs.map(d => d.data());
                const postsToday = rawPosts.filter(p => p.timestamp?.toMillis && p.timestamp.toMillis() >= todayStart).length;
                setAllUsersList(usersSnap.docs.map(d => ({id: d.id, ...d.data()})));
                const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                const last7Days = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                    const dayEnd = dayStart + 86400000;
                    const count = rawPosts.filter(p => { const t = p.timestamp?.toMillis ? p.timestamp.toMillis() : 0; return t >= dayStart && t < dayEnd; }).length;
                    last7Days.push({ day: days[d.getDay()], count, height: Math.min(count * 10 + 10, 100) });
                }
                setStats({ users: usersSnap.size, posts: postsSnap.size, postsToday });
                setChartData(last7Days);
                setLoading(false);
            } catch(e) {
                console.error("Dashboard error:", e);
                setLoading(false);
            }
        };
        fetchData();
        if (db) {
            const unsubLogs = onSnapshot(query(collection(db, getPublicCollection('systemLogs')), orderBy('timestamp', 'desc'), limit(50)), (snap) => { setSystemLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
            return () => unsubLogs();
        }
    }, []);

    // FIX: ERUDA TOGGLE LOGIC LEBIH ROBUST
    const toggleEruda = () => {
        if (window.eruda) { 
            window.eruda.destroy(); 
            // Pastikan benar-benar dihapus dari window
            delete window.eruda;
            showAlert("Eruda Console Nonaktif", 'info');
            return; 
        }
        
        // Cek jika script sudah ada
        const existingScript = document.querySelector('script[src="//cdn.jsdelivr.net/npm/eruda"]');
        if (existingScript) {
             existingScript.remove();
        }

        const script = document.createElement('script');
        script.src = "//cdn.jsdelivr.net/npm/eruda";
        document.body.appendChild(script);
        script.onload = () => { 
            if(window.eruda) {
                window.eruda.init(); 
                showAlert("Eruda Console Aktif", 'success'); 
            }
        };
    };

    const handleBroadcast = async () => { if(!broadcastMsg.trim()) return; const ok = await showConfirm("Kirim pengumuman ke SEMUA user?"); if(!ok) return; setSendingBC(true); try { const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => { resolve(s); unsub(); }); }); const promises = usersSnap.docs.map(docSnap => addDoc(collection(db, getPublicCollection('notifications')), { toUserId: docSnap.id, fromUserId: 'admin', fromUsername: 'Developer System', fromPhoto: APP_LOGO, type: 'system', message: `📢 PENGUMUMAN: ${broadcastMsg}`, isRead: false, timestamp: serverTimestamp() })); await Promise.all(promises); await showAlert("Pengumuman berhasil dikirim!", 'success'); setBroadcastMsg(''); } catch(e) { await showAlert("Gagal kirim broadcast: " + e.message, 'error'); } finally { setSendingBC(false); } };
    const handleBanUser = async (uid, currentStatus) => { const ok = await showConfirm(currentStatus ? "Buka blokir user ini?" : "BLOKIR/BAN User ini?"); if(!ok) return; try { await updateDoc(doc(db, getPublicCollection('userProfiles'), uid), { isBanned: !currentStatus }); setAllUsersList(prev => prev.map(u => u.id === uid ? {...u, isBanned: !currentStatus} : u)); await showAlert(currentStatus ? "User di-unban." : "User berhasil di-ban.", 'success'); } catch(e) { await showAlert("Gagal: " + e.message, 'error'); } };
    const handleDeleteUser = async (uid) => { const ok = await showConfirm("⚠️ PERINGATAN: Hapus data user ini secara permanen?"); if(!ok) return; try { await deleteDoc(doc(db, getPublicCollection('userProfiles'), uid)); setAllUsersList(prev => prev.filter(u => u.id !== uid)); await showAlert("Data user dihapus.", 'success'); } catch(e) { await showAlert("Gagal hapus: " + e.message, 'error'); } };
    
    // Fitur manipulasi reputasi disembunyikan karena XP sudah dihapus

    const filteredUsers = allUsersList.filter(u => u.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2"><ShieldCheck className="text-sky-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white dark:bg-gray-800 dark:text-white p-2 rounded-full shadow hover:bg-gray-200 dark:hover:bg-gray-700"><X/></button></div>
                <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={()=>setActiveTab('overview')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab==='overview'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Overview</button>
                    <button onClick={()=>setActiveTab('logs')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${activeTab==='logs'?'bg-rose-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}><Bug size={14}/> System Logs</button>
                    <button onClick={toggleEruda} className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-purple-500 text-white"><Code size={14}/> Toggle Eruda</button>
                </div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : activeTab === 'logs' ? (
                    <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-[500px] overflow-y-auto">
                        <h3 className="text-white font-bold mb-4 border-b border-gray-700 pb-2">Console Error Logs (User Side)</h3>{systemLogs.length === 0 && <p className="text-gray-500">Belum ada error log.</p>}{systemLogs.map(log => ( <div key={log.id} className="mb-3 border-b border-gray-800 pb-2"><span className="text-gray-500">[{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Just now'}]</span><span className="text-yellow-500 mx-2">[{log.username}]</span><span className="text-blue-400">[{log.context}]</span><div className="text-red-400 mt-1">{log.message}</div></div> ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-sky-100 dark:border-gray-700 text-center"><Users className="mx-auto text-sky-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.users}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total User</p></div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-purple-100 dark:border-gray-700 text-center"><ImageIcon className="mx-auto text-purple-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.posts}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total Post</p></div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 text-center"><Activity className="mx-auto text-emerald-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.postsToday}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Post Hari Ini</p></div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-orange-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-3 rounded-xl text-sm border border-gray-200 dark:border-gray-600 mb-3 outline-none" rows="3" placeholder="Tulis pesan untuk semua user..."/>
                            <button onClick={handleBroadcast} disabled={sendingBC} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition">{sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}</button>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-red-100 dark:border-gray-700">
                             <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><UserX size={18} className="text-red-500"/> Manajemen User (Ban/Hapus)</h3>
                             <input value={userSearchTerm} onChange={e=>setUserSearchTerm(e.target.value)} placeholder="Cari username / email..." className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600 mb-4 outline-none"/>
                             <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">{filteredUsers.map(u => ( <div key={u.id} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Avatar src={u.photoURL} fallbackText={u.username} className="w-8 h-8 rounded-full"/><div><p className="text-xs font-bold dark:text-white">{u.username} {u.isBanned && <span className="text-red-500">(BANNED)</span>}</p><p className="text-[10px] text-gray-500">{u.email}</p></div></div></div><div className="flex gap-2 justify-end"><button onClick={()=>handleBanUser(u.id, u.isBanned)} className={`px-2 py-1 rounded text-[10px] font-bold ${u.isBanned ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'}`}>{u.isBanned ? "Unban" : "Ban User"}</button><button onClick={()=>handleDeleteUser(u.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-[10px] font-bold border border-red-200">Hapus</button></div></div> ))}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI & USER
// ==========================================

const OnboardingScreen = ({ onComplete, user }) => {
    const { showAlert } = useCustomAlert();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => { e.preventDefault(); if (!username.trim()) return await showAlert("Username wajib diisi!", 'error'); setLoading(true); try { await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { username: username.trim(), email: user.email, uid: user.uid, photoURL: user.photoURL || '', createdAt: serverTimestamp(), following: [], followers: [], savedPosts: [], lastSeen: serverTimestamp(), reputation: 0, lastPostTime: 0 }); onComplete(); } catch (error) { await showAlert("Gagal menyimpan data: " + error.message, 'error'); } finally { setLoading(false); } };
    return (
        <div className="fixed inset-0 bg-white z-[80] flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-sm text-center">
                <img src={APP_LOGO} className="w-24 h-24 mx-auto mb-6 object-contain"/>
                <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang! 👋</h2>
                <p className="text-gray-500 mb-8 text-sm">Lengkapi profil Anda untuk mulai berinteraksi.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="text-left">
                        <label className="text-xs font-bold text-gray-600 ml-1">Username Unik</label>
                        {/* FIX: Input text warna kuning (permintaan user) */}
                        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Contoh: user_keren123" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold text-yellow-500 focus:ring-2 focus:ring-sky-500 outline-none placeholder-gray-300"/>
                    </div>
                    <button disabled={loading} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Mulai Menjelajah"}</button>
                </form>
            </div>
        </div>
    );
};

const AuthModal = ({ onClose }) => {
    const { showAlert } = useCustomAlert();
    const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); onClose(); } catch (error) { console.error(error); await showAlert("Gagal login dengan Google.", 'error'); } };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button><div className="text-center mb-6"><img src={APP_LOGO} className="w-16 h-16 mx-auto mb-3"/><h2 className="text-xl font-black text-gray-800 dark:text-white">Masuk ke {APP_NAME}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bergabunglah dengan komunitas sekarang!</p></div><button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Lanjutkan dengan Google</button><p className="text-[10px] text-center text-gray-400 mt-4">Dengan masuk, Anda menyetujui Ketentuan Layanan kami.</p></div>
        </div>
    );
};

const LegalPage = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pb-24 pt-20 px-6 max-w-2xl mx-auto animate-in fade-in">
            <button onClick={onBack} className="fixed top-6 left-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"><ArrowLeft/></button>
            <div className="text-center mb-10"><Scale className="w-12 h-12 mx-auto text-sky-600 mb-4"/><h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">Pusat Kebijakan</h1><p className="text-gray-500 dark:text-gray-400">Transparansi untuk kepercayaan Anda.</p></div>
            <div className="space-y-8">
                {/* INFO PEMBUAT */}
                <section><h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Code size={18} className="text-sky-500"/> Tentang Pembuat</h2><div className="bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800 flex items-center gap-4"><img src="https://c.termai.cc/i6/EAb.jpg" alt="Pembuat" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"/><div><h3 className="font-bold text-gray-900 dark:text-white">M. Irham Andika Putra</h3><p className="text-sm text-gray-600 dark:text-gray-300">Siswa SMP Negeri 3 Mentok</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Umur 14 Tahun (Dibuat 2025)</p></div></div></section>
                
                {/* KEBIJAKAN PRIVASI DIPERLENGKAP */}
                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Lock size={18} className="text-sky-500"/> Kebijakan Privasi (Update 2025)</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700 space-y-4 text-justify">
                        <p>
                            Selamat datang di <strong>{APP_NAME}</strong>. Kami sangat menghargai privasi dan keamanan data Anda. 
                            Dokumen ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda saat menggunakan layanan kami.
                        </p>
                        
                        <div>
                            <h4 className="font-bold text-sky-600 dark:text-sky-400 mb-1">1. Data yang Kami Kumpulkan</h4>
                            <p className="mb-1">Kami mengumpulkan informasi berikut untuk memberikan layanan terbaik:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Informasi Akun:</strong> Saat Anda mendaftar menggunakan Google, kami menyimpan Nama Lengkap, Alamat Email, dan Foto Profil publik Anda.</li>
                                <li><strong>Konten Pengguna:</strong> Postingan, foto, video, komentar, dan pesan chat yang Anda unggah disimpan dengan aman di server kami.</li>
                                <li><strong>Data Teknis:</strong> Kami mencatat alamat IP, jenis perangkat, dan browser untuk tujuan keamanan dan analisis performa sistem.</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-sky-600 dark:text-sky-400 mb-1">2. Penggunaan Data</h4>
                            <p>Data Anda digunakan semata-mata untuk operasional aplikasi, seperti menampilkan profil, memfasilitasi interaksi sosial, dan mengirimkan notifikasi penting. Kami <strong>TIDAK AKAN PERNAH</strong> menjual data pribadi Anda kepada pihak ketiga.</p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sky-600 dark:text-sky-400 mb-1">3. Keamanan Data</h4>
                            <p>Kami menerapkan standar keamanan industri untuk melindungi data Anda dari akses yang tidak sah. Meskipun pesan chat bersifat pribadi, harap diingat bahwa saat ini pesan belum terenkripsi end-to-end (E2EE), sehingga kami menyarankan untuk tidak membagikan informasi sensitif seperti password atau data finansial melalui chat.</p>
                        </div>
                    </div>
                </section>
                
                {/* KETENTUAN LAYANAN */}
                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><FileText size={18} className="text-purple-500"/> Ketentuan Layanan</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700 space-y-4 text-justify">
                        <p>Dengan mengakses atau menggunakan aplikasi ini, Anda setuju untuk terikat oleh syarat dan ketentuan berikut:</p>
                        
                        <div>
                            <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-1">1. Etika Komunitas</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Dilarang keras memposting konten yang mengandung unsur SARA (Suku, Agama, Ras, dan Antargolongan), pornografi, kekerasan, atau ujaran kebencian.</li>
                                <li>Dilarang melakukan tindakan cyberbullying, pelecehan, atau ancaman terhadap pengguna lain.</li>
                                <li>Dilarang menyebarkan berita bohong (hoax) atau informasi yang menyesatkan.</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-1">2. Hak Cipta & Konten</h4>
                            <p>Anda bertanggung jawab penuh atas segala konten yang Anda unggah. Dengan mengunggah konten, Anda memberikan kami lisensi non-eksklusif untuk menampilkan konten tersebut di platform ini. Hormati hak kekayaan intelektual orang lain.</p>
                        </div>

                        <div>
                            <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-1">3. Sanksi Pelanggaran</h4>
                            <p>Kami memiliki hak mutlak untuk menghapus konten atau memblokir akun (Banned) secara permanen tanpa pemberitahuan sebelumnya jika ditemukan pelanggaran terhadap ketentuan ini demi menjaga keamanan dan kenyamanan komunitas.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const LeaderboardScreen = ({ allUsers, currentUser }) => {
    // UPDATE LOGIC: Sort Berdasarkan FOLLOWERS (Bukan Reputation/XP)
    const sortedUsers = useMemo(() => { 
        return [...allUsers].sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0)); 
    }, [allUsers]);
    const top10 = sortedUsers.slice(0, 10);
    
    // Cari ranking user saat ini di list FULL (sebelum di slice)
    const myRankIndex = currentUser ? sortedUsers.findIndex(u => u.uid === currentUser.uid) : -1;
    const isMeInTop10 = myRankIndex !== -1 && myRankIndex < 10;

    return (
        <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto p-4 pb-24 pt-20">
            {/* Banner Top Followers */}
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm">
                <div className="bg-sky-500 text-white p-2 rounded-lg"><Users size={20}/></div>
                <div>
                    <h3 className="font-bold text-sky-700 dark:text-sky-400 text-sm">Papan Peringkat Populer</h3>
                    <p className="text-xs text-sky-600 dark:text-sky-300 mt-1 leading-relaxed">
                        Peringkat ini dihitung berdasarkan <strong>Jumlah Pengikut (Followers)</strong>.
                        <br/>Semakin banyak yang mengikuti kamu, semakin tinggi posisimu!
                    </p>
                </div>
            </div>

            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Top 10 Populer (Followers)</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-fit">
                    {top10.map((u, index) => {
                         let rankStyle = ""; let rankIcon = null;
                         if (index === 0) { rankStyle = "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/20 border-l-4 border-yellow-500"; rankIcon = <Crown size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm"/>; } else if (index === 1) { rankStyle = "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-700/30 border-l-4 border-gray-400"; rankIcon = <Medal size={20} className="text-gray-400 fill-gray-200"/>; } else if (index === 2) { rankStyle = "bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/20 border-l-4 border-orange-500"; rankIcon = <Medal size={20} className="text-orange-500 fill-orange-200"/>; }
                         return (
                            <div key={u.uid} className={`flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 ${rankStyle}`}>
                                <div className={`w-8 h-8 flex items-center justify-center font-black text-lg mr-3 ${index===0?'text-yellow-600':index===1?'text-gray-500':index===2?'text-orange-600':'text-gray-300'}`}>{index + 1}</div>
                                <div className="relative mr-3"><Avatar src={u.photoURL} fallbackText={u.username} className={`w-12 h-12 rounded-full border-2 ${index===0?'border-yellow-500':index===1?'border-gray-400':index===2?'border-orange-500':'border-gray-200 dark:border-gray-600'}`}/>{index === 0 && <div className="absolute -top-2 -right-1 animate-bounce">{rankIcon}</div>}</div>
                                <div className="flex-1"><h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-1">{u.username}{index < 3 && <Sparkles size={12} className={index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-500'}/>}</h3><p className="text-xs text-gray-500 font-medium mt-0.5">Top Creator</p></div>
                                <div className="text-right"><div className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center justify-end gap-1"><Users size={14} className={index < 3 ? 'text-rose-500' : 'text-gray-300'}/>{formatNumber(u.followers?.length || 0)}</div><div className="text-[9px] text-gray-400 uppercase font-bold">Pengikut</div></div>
                            </div>
                         )
                    })}
                </div>

                {/* Info Card di Sebelah Kanan untuk Desktop */}
                <div className="space-y-4">
                     {/* Pesan Semangat jika tidak masuk Top 10 */}
                    {!isMeInTop10 && currentUser && (
                        <div className="bg-sky-50 dark:bg-sky-900/20 p-6 rounded-3xl text-center border border-sky-100 dark:border-sky-800">
                            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-2xl">🚀</div>
                            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Ayo Cari Teman Baru!</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Perbanyak koneksi untuk masuk ke daftar populer.</p>
                            <p className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-800 py-1 px-3 rounded-full inline-block shadow-sm">
                                Peringkat Kamu: #{myRankIndex + 1}
                            </p>
                        </div>
                    )}

                    <div className="bg-gray-900 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 blur-3xl opacity-20 rounded-full"></div>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Gamepad2/> Tips Populer</h3>
                        <ul className="space-y-3 text-sm text-gray-300">
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Aktif Posting Konten</span> <span className="text-green-400 font-bold">Penting</span></li>
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Saling Follow</span> <span className="text-green-400 font-bold">Wajib</span></li>
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Ramah di Komentar</span> <span className="text-green-400 font-bold">Disukai</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: KOMPONEN UTAMA APLIKASI
// ==========================================

const MediaGrid = ({ mediaUrls, onImageClick }) => {
    const count = mediaUrls.length;
    if (count === 0) return null;
    if (count === 1) { return ( <div className="mb-4 rounded-xl overflow-hidden bg-black/5 dark:bg-black/20 border border-gray-100 dark:border-gray-700 relative" onClick={() => onImageClick(0)}><img src={mediaUrls[0]} className="w-full h-auto max-h-[500px] object-cover cursor-pointer hover:scale-105 transition duration-500"/></div> ); }
    return ( <div className={`mb-4 grid ${count === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-0.5 rounded-xl overflow-hidden`}>{mediaUrls.slice(0, 9).map((url, i) => ( <div key={i} className="relative aspect-square cursor-pointer overflow-hidden group" onClick={() => onImageClick(i)}><img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy"/><div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />{i === 8 && count > 9 && ( <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm">+{count - 9}</div> )}</div> ))}</div> );
};

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick, onUpdate }) => {
    const { showConfirm, showAlert } = useCustomAlert();
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null); 
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [isSaved, setIsSaved] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const isOwner = currentUserId && post.userId === currentUserId;
    const DEVELOPER_EMAIL = "irhamdika00@gmail.com";
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 
    const isMeme = post.category === 'meme';
    const isFollowing = profile ? (profile.following || []).includes(post.userId) : false;
    const isFollowedByTarget = profile ? (profile.followers || []).includes(post.userId) : false;
    const isFriend = isFollowing && isFollowedByTarget;

    const MAX_CHARS = 250;
    const isLongText = post.content && post.content.length > MAX_CHARS;
    const displayText = isExpanded || !isLongText ? post.content : post.content.substring(0, MAX_CHARS) + "...";
    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);

    useEffect(() => {
        if (currentUserId) { setLiked(post.likes?.includes(currentUserId)); setIsSaved(profile?.savedPosts?.includes(post.id)); } else { setLiked(false); setIsSaved(false); }
        setLikeCount(post.likes?.length || 0);
    }, [post, currentUserId, profile?.savedPosts]);

    const handleLike = async () => {
        if (isGuest) { onRequestLogin(); return; }
        if (!currentUserId || !db) return; // Safety check

        const newLiked = !liked; setLiked(newLiked); setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
        
        // Optimistic UI Update in Parent
        if(onUpdate) {
            onUpdate(post.id, { 
                likes: newLiked ? [...(post.likes||[]), currentUserId] : (post.likes||[]).filter(id => id !== currentUserId) 
            });
        }

        const ref = doc(db, getPublicCollection('posts'), post.id);
        const authorRef = doc(db, getPublicCollection('userProfiles'), post.userId);
        try {
            if (newLiked) { await updateDoc(ref, { likes: arrayUnion(currentUserId) }); if (post.userId !== currentUserId) { sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id); } } 
            else { await updateDoc(ref, { likes: arrayRemove(currentUserId) }); }
        } catch (error) { 
            console.error("Like failed, rolling back:", error);
            // Rollback Local State
            setLiked(!newLiked); 
            setLikeCount(prev => !newLiked ? prev + 1 : prev - 1);
            // FIX: Rollback Parent State (Critical for Consistency)
            if(onUpdate) {
                onUpdate(post.id, {
                    likes: !newLiked ? [...(post.likes||[]), currentUserId] : (post.likes||[]).filter(id => id !== currentUserId)
                });
            }
        }
    };

    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };
    const handleSave = async () => { if (isGuest) { onRequestLogin(); return; } const newSaved = !isSaved; setIsSaved(newSaved); const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId); try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); } };

    const handleComment = async (e) => {
        e.preventDefault(); if (isGuest) { onRequestLogin(); return; } if (!profile) return; if (!newComment.trim()) return;
        
        // FIX: Limit komentar
        if(newComment.length > 500) { showAlert("Komentar terlalu panjang.", "error"); return; }

        try {
            const commentData = { postId: post.id, userId: currentUserId, text: newComment, username: profile.username || 'User', timestamp: serverTimestamp(), parentId: replyTo ? replyTo.id : null, replyToUsername: replyTo ? replyTo.username : null };
            await addDoc(collection(db, getPublicCollection('comments')), commentData);
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            
            // Optimistic update
            if(onUpdate) { onUpdate(post.id, { commentsCount: (post.commentsCount || 0) + 1 }); }

            if (post.userId !== currentUserId) { if (!replyTo) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id); }
            if (replyTo && replyTo.userId !== currentUserId) { sendNotification(replyTo.userId, 'comment', `membalas komentar Anda: "${newComment.substring(0,15)}.."`, profile, post.id); }
            setNewComment(''); setReplyTo(null);
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        const confirmMsg = isMeDeveloper && !isOwner ? "⚠️ ADMIN: Hapus postingan orang lain?" : "Hapus postingan ini?";
        const ok = await showConfirm(confirmMsg);
        if (ok) { try { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); await showAlert(`Postingan dihapus.`, 'success'); if(onUpdate) onUpdate(post.id, null); /* NULL means deleted */ } catch (e) { await showAlert("Gagal menghapus: " + e.message, 'error'); } } 
    };
    const handleDeleteComment = async (commentId) => { const ok = await showConfirm("Hapus komentar?"); if(ok) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); if(onUpdate) onUpdate(post.id, { commentsCount: Math.max(0, (post.commentsCount||0)-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); if(onUpdate) onUpdate(post.id, { title: editedTitle, content: editedContent }); };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); await showAlert('Link Disalin! Orang lain bisa membukanya langsung.', 'success'); } catch (e) { await showAlert('Gagal menyalin link', 'error'); } };

    useEffect(() => { if (!showComments || !db) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.toMillis || 0) - (b.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    // FIX VIDEO: Prioritaskan mediaType 'video' dari API agar tidak dianggap embed link biasa
    const isVideo = post.mediaType === 'video' || ((post.mediaUrl && /\.(mp4|webm)$/i.test(post.mediaUrl)) && !embed);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    // Ganti badge logic
    const userBadge = getReputationBadge(post.user?.followers?.length || 0, isDeveloper); 
    
    // Gunakan real embed jika bukan video internal dari API
    const displayEmbed = isVideo ? null : embed;

    const rootComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);

    const CommentItem = ({ c, isReply }) => {
        const replies = getReplies(c.id); const [showAllReplies, setShowAllReplies] = useState(false); const visibleReplies = showAllReplies ? replies : replies.slice(0, 2);
        return (
            <div className="flex flex-col">
                <div className={`p-3 rounded-xl text-xs flex flex-col group transition ${isReply ? 'ml-8 bg-gray-100 dark:bg-gray-800 border-l-2 border-sky-300 mb-2' : 'bg-gray-50 dark:bg-gray-900'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-800 dark:text-gray-200">{c.username || 'User'}</span>{c.replyToUsername && isReply && <span className="flex items-center text-sky-600 text-[10px]"><CornerDownRight size={10} className="mr-0.5"/> {c.replyToUsername}</span>}</div><span className="text-gray-600 dark:text-gray-400 leading-relaxed block">{c.text}</span></div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">{!isGuest && <button onClick={()=>setReplyTo(c)} className="text-gray-400 hover:text-sky-500"><Reply size={12}/></button>}{(currentUserId === c.userId || isMeDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500">{isMeDeveloper && currentUserId !== c.userId ? <ShieldAlert size={12}/> : <Trash size={12}/>}</button>}</div>
                    </div>
                </div>
                {replies.length > 0 && ( <div className="mt-1"><div className="space-y-3">{visibleReplies.map(reply => ( <CommentItem key={reply.id} c={reply} isReply={true} /> ))}</div>{replies.length > 2 && !showAllReplies && ( <button onClick={() => setShowAllReplies(true)} className="ml-8 text-[10px] font-bold text-sky-600 hover:underline flex items-center mb-2">Lihat {replies.length - 2} balasan lainnya...</button> )}</div> )}
            </div>
        );
    };
    const CommentList = ({ commentList }) => ( <div className="space-y-3">{commentList.map(c => <CommentItem key={c.id} c={c} isReply={false} />)}</div> );

    // UI REDESIGN: Modern Feed Style (Facebook/Threads)
    return (
        <div className="bg-white dark:bg-gray-800 md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:dark:border-gray-700 md:mb-4 border-b border-gray-100 dark:border-gray-800 p-4 mb-2 animate-in fade-in transition-colors">
            {post.isShort && <div className="mb-2"><span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center w-fit"><Zap size={8} className="mr-1 text-yellow-400"/> SHORT</span></div>}
            
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        {/* FIX: Profil selalu muncul, fallback ke "?" jika kosong */}
                        <Avatar src={post.user?.photoURL} fallbackText={post.user?.username || "?"} className="w-full h-full object-cover"/>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white cursor-pointer hover:underline" onClick={() => goToProfile(post.userId)}>{post.user?.username || 'User'}</h4>
                            <span className="text-gray-400 text-[10px] ml-1">• {formatTimeAgo(post.timestamp).relative}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             {userBadge && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>
                             )}
                             {isMeme && <span className="bg-yellow-100 text-yellow-800 text-[9px] px-1.5 py-0.5 rounded font-bold">MEME</span>}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-1">
                    {!isOwner && post.userId !== currentUserId && ( 
                         // PERBAIKAN: Warna tombol follow sesuai status
                         <button onClick={() => isGuest ? onRequestLogin() : handleFollow(post.userId, isFollowing)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                            isFriend 
                                ? 'bg-emerald-500 text-white shadow-emerald-200' // Berteman (Hijau)
                                : isFollowing 
                                    ? 'bg-yellow-400 text-white shadow-yellow-200' // Mengikuti (Kuning)
                                    : 'bg-sky-500 text-white shadow-sky-200' // Ikuti (Biru)
                         }`}>
                             {isFriend ? <><UserCheck size={14}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}
                         </button> 
                    )}
                    {(isOwner || isMeDeveloper) && !isGuest && ( 
                         <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition">
                            <Trash2 size={16}/>
                         </button>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3"><input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg font-bold text-sm dark:text-white"/><textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg text-sm resize-none dark:text-white" rows="4"/><div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-1">Batal</button><button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button></div></div>
            ) : (
                <div className="mb-3">
                    {post.title && <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-base">{post.title}</h3>}
                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line mb-3">{renderMarkdown(displayText, onHashtagClick)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
                    
                    <div onDoubleClick={handleDoubleTap} className="relative mt-2 rounded-xl overflow-hidden">
                         {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700 pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                         {isAudio && <AudioPlayer src={post.mediaUrl || embed.url} />}
                         
                         {/* FIX: Video UI Upgrade (Vidstack Style - Dark Theme, Rounded) */}
                         {isVideo && <ModernVideoPlayer src={post.mediaUrl} />}
                         
                         {displayEmbed?.type === 'youtube' && <div className="aspect-video rounded-lg overflow-hidden"><iframe src={displayEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                         {displayEmbed?.type === 'instagram' && ( <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"><iframe src={displayEmbed.embedUrl} className="w-full h-full border-0" scrolling="no" allowTransparency="true"></iframe></div>)}
                         {displayEmbed?.type === 'tiktok' && ( <div className="aspect-[9/16] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black"><iframe src={displayEmbed.embedUrl} className="w-full h-full border-0"></iframe></div>)}
                         {displayEmbed?.type === 'link' && <a href={displayEmbed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-3 text-center bg-sky-50 dark:bg-gray-900 text-sky-600 font-bold text-xs hover:underline rounded-lg">Buka Tautan <ExternalLink size={12} className="inline ml-1"/></a>}
                         
                         {!isAudio && !isVideo && !displayEmbed && mediaList.length > 0 && ( <MediaGrid mediaUrls={mediaList} onImageClick={(idx) => {setLightboxIndex(idx); setLightboxOpen(true);}} /> )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mt-2">
                <div className="flex gap-6">
                    <button onClick={handleLike} className={`flex items-center gap-1.5 transition group hover:text-rose-500 ${liked ? 'text-rose-500' : ''}`}>
                        <Heart size={20} fill={liked ? 'currentColor' : 'none'} className="group-active:scale-125 transition-transform"/> 
                        <span className="text-xs font-medium">{formatNumber(likeCount || 0)}</span>
                    </button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 transition hover:text-sky-500">
                        <MessageSquare size={20} /> 
                        <span className="text-xs font-medium">{formatNumber(post.commentsCount || 0)}</span>
                    </button>
                    <button onClick={sharePost} className="flex items-center gap-1.5 transition hover:text-green-500">
                        <Share2 size={20} />
                    </button>
                </div>
                <button onClick={handleSave} className={`transition hover:text-sky-500 ${isSaved ? 'text-sky-500' : ''}`}>
                    <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </div>

            {showComments && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in">
                    <div className="flex items-center justify-between mb-4"><h5 className="font-bold text-sm">Komentar</h5><button onClick={()=>setShowComments(false)}><X size={16}/></button></div>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar max-h-[300px]">{comments.length === 0 ? ( <p className="text-xs text-center text-gray-400 py-4">Belum ada komentar.</p> ) : ( <CommentList commentList={rootComments} /> )}</div>
                    <form onSubmit={handleComment} className="relative mt-auto">{replyTo && ( <div className="flex items-center justify-between text-[10px] bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 p-2 rounded-t-lg"><span>Membalas <b>{replyTo.username}</b>...</span><button type="button" onClick={()=>setReplyTo(null)}><X size={12}/></button></div> )}<div className="flex gap-2"><input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis..." disabled={isGuest || !profile} className={`flex-1 bg-gray-50 dark:bg-gray-900 dark:text-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-100 border border-gray-200 dark:border-gray-700 ${replyTo ? 'rounded-b-xl' : 'rounded-full'}`}/><button type="submit" disabled={!newComment.trim() || isGuest} className="p-2.5 bg-sky-500 text-white rounded-full shadow-md hover:bg-sky-600 disabled:opacity-50 h-fit self-end"><Send size={16}/></button></div></form>
                </div>
            )}
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
        </div>
    );
};

// FIX: Tambahkan prop userPhoto agar foto profil muncul instan saat baru post
const CreatePost = ({ setPage, userId, username, userPhoto, onSuccess }) => {
    const { showAlert } = useCustomAlert();
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '', isShort: false, isAudio: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);
    const [loadingText, setLoadingText] = useState(""); // UI: Fun Loading Text

    // Fun loading text logic
    const funTexts = ["Menghubungi satelit...", "Memasak postingan...", "Mengirim sinyal ke Mars...", "Sabar ya, lagi loading...", "Menyusun pixel...", "Mengupload kenangan...", "Hampir siap..."];

    useEffect(() => {
        if(loading) {
            const interval = setInterval(() => {
                setLoadingText(funTexts[Math.floor(Math.random() * funTexts.length)]);
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [loading]);

    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    const handleFileChange = (e) => { const selectedFiles = Array.from(e.target.files); if (selectedFiles.length > 0) { const isAudio = selectedFiles[0].type.startsWith('audio'); const isVideo = selectedFiles[0].type.startsWith('video'); setForm({ ...form, files: selectedFiles, isShort: isVideo, isAudio: isAudio, url: '' }); } };
    const submit = async (e) => {
        e.preventDefault(); 
        
        // FIX: Limit karakter post
        if(form.content.length > 2000) {
            await showAlert("Konten terlalu panjang (maks 2000 karakter).", 'error');
            return;
        }

        try { const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), userId)); if (userDoc.exists()) { const userData = userDoc.data(); const lastPost = userData.lastPostTime || 0; const now = Date.now(); if (now - lastPost < 60000) { await showAlert("Tunggu 1 menit sebelum memposting lagi. (Anti-Spam)", 'error'); return; } } } catch(err) { console.error("Gagal cek cooldown", err); }
        setLoading(true); setProg(0); setLoadingText("Memulai...");
        try {
            let mediaUrls = []; let mediaType = 'text';
            if (form.files.length > 0) { const firstFile = form.files[0]; if (firstFile.type.startsWith('image')) { mediaType = 'image'; setProg(10); for (let i = 0; i < form.files.length; i++) { const base64 = await compressImageToBase64(form.files[i]); mediaUrls.push(base64); setProg(10 + ((i + 1) / form.files.length) * 80); } } else if (firstFile.type.startsWith('video') || firstFile.type.startsWith('audio')) { const uploadedUrl = await uploadToFaaAPI(firstFile, setProg); mediaUrls.push(uploadedUrl); mediaType = firstFile.type.startsWith('video') ? 'video' : 'audio'; setProg(100); } } 
            
            // FIX: Auto-append HTTPS jika user memasukkan link tanpa protokol
            else if (form.url) { 
                let safeUrl = form.url;
                if (!/^https?:\/\//i.test(safeUrl)) {
                    safeUrl = 'https://' + safeUrl;
                }
                mediaType = 'link'; 
                mediaUrls.push(safeUrl); 
            }

            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            
            // FIX: Sertakan photoURL dalam data user saat membuat post
            const ref = await addDoc(collection(db, getPublicCollection('posts')), { 
                userId, 
                title: form.title, 
                content: form.content, 
                mediaUrls: mediaUrls, 
                mediaUrl: mediaUrls[0] || '', 
                mediaType: mediaType, 
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                category: category, 
                user: { username, uid: userId, photoURL: userPhoto } // <-- FIX DISINI
            });
            
            // Removed reputation increment
            await updateDoc(doc(db, getPublicCollection('userProfiles'), userId), { lastPostTime: Date.now() }); 
            setProg(100); setTimeout(()=>onSuccess(ref.id, false), 500);
            await showAlert("Postingan berhasil diterbitkan!", 'success');
        } catch(e){ await showAlert(e.message, 'error'); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 overflow-y-auto animate-in slide-in-from-bottom duration-300">
             {/* SCREEN FULL LOADING OVERLAY */}
             {loading && (
                <div className="fixed inset-0 z-[200] bg-white dark:bg-gray-900 flex flex-col items-center justify-center animate-in fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-sky-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                        <img src={APP_LOGO} className="w-24 h-24 object-contain animate-bounce-slow relative z-10"/>
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Memposting...</h2>
                    <p className="text-sky-600 font-bold text-lg animate-pulse mb-8">{loadingText}</p>
                    <div className="w-64 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
                        <div className="bg-gradient-to-r from-sky-400 to-purple-500 h-full transition-all duration-300 relative z-10" style={{width:`${prog}%`}}/>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">{Math.round(prog)}% Selesai</p>
                </div>
            )}
            
            <div className="max-w-2xl mx-auto p-4 pt-4 relative">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <button onClick={() => setPage('home')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft/></button>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white">Buat Postingan</h2>
                    <div className="w-8"></div> {/* Spacer */}
                </div>
                
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full p-3 bg-transparent border-b border-gray-200 dark:border-gray-700 dark:text-white font-bold text-lg outline-none focus:border-sky-500 transition placeholder-gray-400"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang Anda pikirkan?" rows="8" maxLength={2000} className="w-full p-3 bg-transparent dark:text-white text-base outline-none resize-none placeholder-gray-400"/>
                    
                    <div className="flex gap-2 text-xs mb-4"><button type="button" onClick={()=>setForm({...form, content: form.content + "**Tebal**"})} className="bg-gray-100 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-200 font-bold">B</button><button type="button" onClick={()=>setForm({...form, content: form.content + "*Miring*"})} className="bg-gray-100 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-200 italic font-serif">I</button><button type="button" onClick={insertLink} className="bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-3 py-1.5 rounded-full hover:bg-sky-100 flex items-center gap-1 font-bold"><LinkIcon size={12}/> Link</button></div>
                    
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Tambahkan ke postingan</p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            <label className={`flex items-center justify-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.files.length > 0 && !form.isAudio ?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><ImageIcon size={20} className="mr-2"/><span className="text-sm font-bold">{form.files.length > 0 && !form.isAudio ? `${form.files.length} File` : 'Foto/Video'}</span><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} disabled={loading}/></label>
                            <label className={`flex items-center justify-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.isAudio ?'bg-pink-50 border-pink-200 text-pink-600':'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><Music size={20} className="mr-2"/><span className="text-sm font-bold">{form.isAudio ? 'Audio Siap' : 'Audio'}</span><input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={loading}/></label>
                        </div>
                    </div>
                    
                    <div className="relative mt-2"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, files:[]})} placeholder="Atau tempel Link Video (YouTube/TikTok/IG)..." className="w-full pl-10 py-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs outline-none"/></div>
                    
                    <button disabled={loading || (!form.content && form.files.length === 0 && !form.url)} className="w-full py-3.5 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-[0.98] transition disabled:opacity-50 text-sm mt-4">{loading ? 'Memproses...' : 'Posting'}</button>
                </form>
            </div>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest, allUsers }) => {
    // FIX CRASH: Gunakan Safe Navigation Operator (?.) dan Default Value
    const { showAlert } = useCustomAlert();
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData?.username || ''); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false); 
    const [showDev, setShowDev] = useState(false); 
    const [activeTab, setActiveTab] = useState('posts'); 
    const [mood, setMood] = useState(profileData?.mood || ''); 
    const [isEditingMood, setIsEditingMood] = useState(false);
    
    const [localPosts, setLocalPosts] = useState([]);
    const [loadingLocal, setLoadingLocal] = useState(true);

    const viewerUid = viewerProfile ? viewerProfile.uid : null;
    const isSelf = viewerUid === profileData?.uid; 
    const DEVELOPER_EMAIL = "irhamdika00@gmail.com";
    const isDev = profileData?.email === DEVELOPER_EMAIL;

    useEffect(() => {
        setLoadingLocal(true);
        setLocalPosts([]); 
        
        const fetchUserPosts = async () => {
            try {
                const data = await fetchFeedData({
                    mode: 'user',
                    userId: profileData?.uid, 
                    limit: 20
                });
                const enrichedPosts = data.posts.map(p => ({
                    ...p,
                    user: profileData
                }));
                setLocalPosts(enrichedPosts);
            } catch (e) { console.error("Profile Fetch Error:", e); } finally { setLoadingLocal(false); }
        };
        if (profileData?.uid) { fetchUserPosts(); }
    }, [profileData?.uid]); 
    
    // FIX: Share Profile
    const handleShareProfile = async () => {
        const url = `${window.location.origin}?user=${profileData.uid}`;
        try {
            await navigator.clipboard.writeText(url);
            showAlert('Link profil berhasil disalin! Sebarkan ke temanmu.', 'success');
        } catch (e) {
            showAlert('Gagal menyalin link.', 'error');
        }
    };

    if (!profileData) {
        return ( <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center pt-24"><User size={48} className="text-gray-300 mb-4"/><h3 className="text-gray-500 font-bold text-lg">Profil Tidak Ditemukan</h3><p className="text-gray-400 text-sm mt-2 max-w-xs">Pengguna ini mungkin tidak ada atau data sedang dimuat.</p><button onClick={() => window.location.reload()} className="mt-6 text-sky-500 font-bold text-xs hover:underline">Muat Ulang Halaman</button></div> );
    }

    const followersCount = (profileData.followers || []).length;
    const followingCount = (profileData.following || []).length;
    const targetFollowers = profileData.followers || [];
    const targetFollowing = profileData.following || [];
    const friendsCount = targetFollowing.filter(id => targetFollowers.includes(id)).length;

    const save = async () => { setLoad(true); try { let url = profileData.photoURL; if (file) { url = await compressImageToBase64(file); } await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); setEdit(false); } catch(e){alert(e.message)} finally{setLoad(false)}; };
    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    const badge = getReputationBadge(followersCount, isDev);
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; 
    const isFollowedByTarget = viewerProfile ? (viewerProfile.followers || []).includes(profileData.uid) : false;
    const isFriend = isFollowing && isFollowedByTarget; 
    const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    return (
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pb-24 pt-20">
            <div className={`bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm mb-8 mx-4 text-center relative overflow-hidden border border-sky-50 dark:border-gray-700`}>
                
                {/* FIX: Tombol Share Profile */}
                <button onClick={handleShareProfile} className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-gray-700 dark:text-white transition">
                    <Share2 size={18} />
                </button>
                
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 dark:from-sky-900 dark:to-purple-900 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8"><div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 dark:bg-gray-700 ${isOnline ? 'border-emerald-400' : 'border-white dark:border-gray-600'} relative`}>{load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}<Avatar src={profileData.photoURL} fallbackText={profileData.username} className="w-full h-full"/></div><div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>{isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}</div>
                {edit ? ( <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent dark:text-white"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs dark:text-gray-300"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'Mengunggah...':'Simpan'}</button></div> ) : ( <> <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> {isSelf ? ( isEditingMood ? ( <div className="flex items-center justify-center gap-2 mt-2"><input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32 dark:bg-gray-700 dark:text-white"/><button onClick={saveMood} className="text-green-500"><Check size={14}/></button></div> ) : ( <div onClick={()=>setIsEditingMood(true)} className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-sky-500 flex items-center justify-center gap-1">{profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/></div> ) ) : ( profileData.mood && <p className="text-sm text-gray-500 mt-1 italic">"{renderChatText(profileData.mood, false)}"</p> )} </> )}
                
                {/* FIX: Badge hanya muncul jika ada (DEV) */}
                {badge && <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label}</div>}
                
                {/* PERBAIKAN: Tombol Follow Profil dengan Warna */}
                {!isSelf && !isGuest && ( 
                    <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${
                        isFriend 
                            ? 'bg-emerald-500 text-white shadow-emerald-200' 
                            : isFollowing 
                                ? 'bg-yellow-400 text-white shadow-yellow-200' 
                                : 'bg-sky-500 text-white shadow-sky-200'
                    }`}>
                        {isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}
                    </button> 
                )}
                
                {isDev && isSelf && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 shadow-lg"><ShieldCheck size={16}/> Dashboard Developer</button>}
                <div className="flex justify-center gap-6 mt-6 border-t dark:border-gray-700 pt-6"><div><span className="font-bold text-xl block dark:text-white">{formatNumber(followersCount)}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div><div><span className="font-bold text-xl block dark:text-white">{formatNumber(followingCount)}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div><div><span className="font-bold text-xl block text-emerald-600">{formatNumber(friendsCount)}</span><span className="text-[10px] text-emerald-600 font-bold uppercase">Teman</span></div></div>
            </div>
            {isSelf && ( <div className="flex gap-2 px-4 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Disimpan</button></div> )}
            <div className="px-4">
                {activeTab === 'posts' ? (
                    loadingLocal ? <SkeletonPost /> :
                    localPosts.length > 0 ? (
                        <div className="space-y-0"> 
                            {localPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}
                        </div>
                    ) : <div className="text-center text-gray-400 py-10">Belum ada postingan.</div>
                ) : ( 
                    savedPostsData.length > 0 ? (
                        <div className="space-y-0">
                             {savedPostsData.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}
                        </div>
                    ) : <div className="text-center text-gray-400 py-10">Belum ada postingan yang disimpan.</div>
                )}
            </div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

// ==========================================
// HomeScreen with Persistent Feed Logic
// ==========================================

const HomeScreen = ({ 
    currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick, homeFeedState, setHomeFeedState, handlePostUpdate
}) => {
    const { posts: feedPosts, cursor: nextCursor, sortType, hasLoaded } = homeFeedState;
    const [loading, setLoading] = useState(false);
    const [feedError, setFeedError] = useState(false);
    const bottomRef = useRef(null);

    const topTrend = useMemo(() => {
        const tagCounts = {};
        allPosts.forEach(p => { const tags = extractHashtags(p.content); tags.forEach(t => tagCounts[t] = (tagCounts[t]||0)+1); });
        const sorted = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]);
        return sorted.length > 0 ? {tag: sorted[0][0], count: sorted[0][1]} : null;
    }, [allPosts]);

    const loadFeed = async (reset = false) => {
        if (loading) return;
        setLoading(true); setFeedError(false);
        const currentCursor = reset ? null : nextCursor;
        const currentSort = sortType; 
        try {
            const data = await fetchFeedData({ mode: currentSort, limit: 10, cursor: currentCursor, viewerId: currentUserId });
            const enrichedPosts = data.posts.map(p => ({ ...p, user: p.user || { username: 'Pengguna', photoURL: '' } }));
            setHomeFeedState(prev => ({ ...prev, posts: reset ? enrichedPosts : [...prev.posts, ...enrichedPosts], cursor: data.nextCursor, hasLoaded: true }));
        } catch (e) { console.error("Feed load error:", e); setFeedError(true); } finally { setLoading(false); }
    };

    useEffect(() => { if (!hasLoaded) { loadFeed(true); } }, [hasLoaded, sortType]); 
    useEffect(() => { if (homeFeedState.scrollPos) { window.scrollTo(0, homeFeedState.scrollPos); } return () => { setHomeFeedState(prev => ({ ...prev, scrollPos: window.scrollY })); }; }, []); 

    const handleSortChange = (newSort) => { if (newSort === sortType) return; setHomeFeedState(prev => ({ ...prev, sortType: newSort, posts: [], cursor: null, hasLoaded: false, scrollPos: 0 })); };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && nextCursor && !loading && hasLoaded) { loadFeed(false); } }, { threshold: 0.5 });
        if (bottomRef.current) observer.observe(bottomRef.current);
        return () => { if (bottomRef.current) observer.unobserve(bottomRef.current); };
    }, [nextCursor, loading, hasLoaded]);

    const manualRefresh = () => { clearNewPost(); setHomeFeedState(prev => ({ ...prev, posts: [], cursor: null, hasLoaded: false, scrollPos: 0 })); };

    const finalPosts = [...feedPosts];
    // FIX: Profile Pin Bug - Ensure new post has profile attached for instant display
    if (newPostId) { 
        const newlyCreated = allPosts.find(p => p.id === newPostId); 
        if (newlyCreated && !finalPosts.find(p => p.id === newPostId)) { 
            // Attach current user profile if missing
            const postWithProfile = { ...newlyCreated, user: newlyCreated.user || profile };
            finalPosts.unshift(postWithProfile); 
        } 
    }

    return (
        <div className="w-full max-w-2xl mx-auto pb-24 px-0 md:px-0 pt-4"> 
            {/* UI UPDATE: Banner Kategori Diperkecil & Tidak Sticky */}
            <div className="flex items-center justify-start mb-4 py-3 px-4 transition-all gap-2 overflow-x-auto no-scrollbar">
                <button onClick={() => handleSortChange('home')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='home'?'bg-sky-500 text-white shadow-md shadow-sky-200':'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>Beranda</button>
                <button onClick={() => handleSortChange('friends')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='friends'?'bg-emerald-500 text-white shadow-md shadow-emerald-200':'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>Teman</button>
                <button onClick={() => handleSortChange('meme')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-yellow-400 text-white border-yellow-400 shadow-md shadow-yellow-200':'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>😂 Meme</button>
                <button onClick={() => handleSortChange('popular')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-purple-500 text-white shadow-md shadow-purple-200':'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>🔥 Populer</button>
                <button onClick={manualRefresh} className="ml-auto p-2 bg-white dark:bg-gray-800 text-gray-500 rounded-full shadow-sm hover:rotate-180 transition border border-gray-100 dark:border-gray-700"><RefreshCw size={16}/></button>
            </div>

            {feedError && ( <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-3xl mb-4 text-center mx-4"><WifiOff size={48} className="text-red-400 mb-2"/><h3 className="text-red-600 dark:text-red-400 font-bold">Koneksi Bermasalah</h3><button onClick={manualRefresh} className="px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg mt-2">Coba Lagi</button></div> )}

            {loading && finalPosts.length === 0 ? <div className="px-4 space-y-4"><SkeletonPost/><SkeletonPost/></div> : finalPosts.length === 0 && !feedError ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700 mx-4">
                    <p className="text-gray-400 font-bold">Belum ada postingan.</p>
                </div>
            ) : (
                <div className="space-y-0"> 
                    {finalPosts.map(p => (
                        <div key={p.id} className={`${p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}`}>
                            {p.id === newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-2 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-4"><CheckCircle size={14}/> Postingan Baru Disematkan</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile?.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} onUpdate={handlePostUpdate} />
                        </div>
                    ))}
                </div>
            )}
            <div ref={bottomRef} className="h-20 w-full flex items-center justify-center">
                 {loading && <div className="flex flex-col items-center"><Loader2 className="animate-spin text-sky-500 mb-2"/><span className="text-xs text-gray-400">Memuat lebih banyak...</span></div>}
            </div>
        </div>
    );
};

const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifs, setNotifs] = useState([]);
    
    // FIX: Simplified Query to Prevent Ghosting
    // Menghapus 'orderBy(type)' dan 'where(type != chat)' dari query level untuk stabilitas index
    useEffect(() => { 
        if(!userId) return;
        const q = query(
            collection(db, getPublicCollection('notifications')), 
            where('toUserId','==',userId), 
            orderBy('timestamp','desc'), 
            limit(50)
        ); 
        
        // Filter 'chat' dan 'isRead' di memori (client-side)
        return onSnapshot(q, s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            const filtered = raw.filter(n => !n.isRead && n.type !== 'chat');
            setNotifs(filtered);
        }); 
    }, [userId]);
    
    // GROUPING LOGIC
    const groupedNotifs = useMemo(() => {
        const groups = [];
        const processed = new Set();
        
        // Sort raw first to ensure chronological grouping
        const rawSorted = [...notifs].sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

        rawSorted.forEach(n => {
            if (processed.has(n.id)) return;

            // Only group likes
            if (n.type === 'like' && n.postId) {
                const samePostLikes = rawSorted.filter(
                    other => other.type === 'like' && other.postId === n.postId && !processed.has(other.id)
                );
                
                if (samePostLikes.length > 1) {
                    groups.push({
                        isGroup: true,
                        id: `group_${n.postId}_${Date.now()}`,
                        type: 'like',
                        postId: n.postId,
                        items: samePostLikes,
                        latest: samePostLikes[0],
                        count: samePostLikes.length,
                        timestamp: samePostLikes[0].timestamp
                    });
                    samePostLikes.forEach(x => processed.add(x.id));
                } else {
                    groups.push(n);
                    processed.add(n.id);
                }
            } else {
                groups.push(n);
                processed.add(n.id);
            }
        });
        return groups;
    }, [notifs]);

    const handleClick = async (n) => { 
        if (n.isGroup) {
            // Mark all in group as read
            const batch = writeBatch(db);
            n.items.forEach(item => {
                batch.update(doc(db, getPublicCollection('notifications'), item.id), { isRead: true });
            });
            await batch.commit();
            setTargetPostId(n.postId); setPage('view_post');
        } else {
            await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true}); 
            if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); } 
            else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); }
        }
    };
    
    // FIX: Fitur Hapus Semua Notifikasi (Tanpa Dibaca)
    const { showConfirm, showAlert } = useCustomAlert();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAll = async () => {
        if (notifs.length === 0) return;
        const ok = await showConfirm("Hapus semua notifikasi? (Tanpa dibaca)");
        if (!ok) return;

        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            notifs.forEach(n => {
                const ref = doc(db, getPublicCollection('notifications'), n.id);
                batch.delete(ref);
            });
            await batch.commit();
            setNotifs([]); // Optimistic clear
            showAlert("Notifikasi dibersihkan", "success");
        } catch(e) { console.error(e); showAlert("Gagal hapus", "error"); }
        finally { setIsDeleting(false); }
    };

    return (
        <div className="max-w-md md:max-w-xl mx-auto p-4 pb-24 pt-20">
            {/* Header with Back Button & Delete All */}
            <div className="flex items-center justify-between mb-6 sticky top-16 bg-[#F0F4F8] dark:bg-gray-900 z-10 py-2">
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage('home')} className="p-2 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm transition">
                        <ArrowLeft size={20} className="text-gray-700 dark:text-gray-200"/>
                    </button>
                    <h1 className="text-xl font-black text-gray-800 dark:text-white">Notifikasi</h1>
                </div>
                {notifs.length > 0 && (
                     <button onClick={handleDeleteAll} disabled={isDeleting} className="text-red-500 bg-white dark:bg-gray-800 p-2 rounded-full hover:bg-red-50 shadow-sm transition" title="Hapus Semua">
                        {isDeleting ? <Loader2 size={20} className="animate-spin"/> : <Trash2 size={20}/>}
                     </button>
                )}
            </div>

            {groupedNotifs.length===0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Bell size={48} className="mb-4 opacity-20"/>
                    <p className="text-sm font-bold">Semua bersih!</p>
                    <p className="text-xs">Tidak ada notifikasi baru.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {groupedNotifs.map(n => {
                        // Render Group
                        if (n.isGroup) {
                            return (
                                <div key={n.id} onClick={()=>handleClick(n)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition border-l-4 border-rose-500">
                                    <div className="relative">
                                        <div className="w-12 h-12 flex -space-x-4 overflow-hidden">
                                            {n.items.slice(0, 3).map((item, i) => (
                                                <img key={i} src={item.fromPhoto||APP_LOGO} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-gray-800"/>
                                            ))}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                                            <Heart size={10} fill="white"/>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm dark:text-gray-200">
                                            <span className="font-bold">{n.latest.fromUsername}</span> dan <span className="font-bold">{n.count - 1} lainnya</span>
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">menyukai postingan Anda.</p>
                                    </div>
                                </div>
                            );
                        }
                        // Render Single
                        return (
                            <div key={n.id} onClick={()=>handleClick(n)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition">
                                <div className="relative">
                                    <img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>
                                        {n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold dark:text-gray-200">{n.fromUsername}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const cachedPost = allPosts.find(p => p.id === postId);
    const [fetchedPost, setFetchedPost] = useState(cachedPost || null);
    const [loading, setLoading] = useState(!cachedPost);
    const [error, setError] = useState(false);
    useEffect(() => {
        if (cachedPost) { setFetchedPost(cachedPost); setLoading(false); return; }
        const fetchSinglePost = async () => {
            setLoading(true);
            try {
                if(!db) return;
                const docRef = doc(db, getPublicCollection('posts'), postId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const userSnap = await getDoc(doc(db, getPublicCollection('userProfiles'), data.userId));
                    const completePost = { id: docSnap.id, ...data, user: userSnap.exists() ? userSnap.data() : { username: 'User' } };
                    setFetchedPost(completePost);
                } else { setError(true); }
            } catch (e) { console.error(e); setError(true); }
            setLoading(false);
        };
        if (postId) fetchSinglePost();
    }, [postId, cachedPost]);
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-sky-500"/></div>;
    if (error || !fetchedPost) return <div className="p-10 text-center text-gray-400 mt-20">Postingan tidak ditemukan atau telah dihapus.<br/><button onClick={handleBack} className="text-sky-600 font-bold mt-4">Kembali ke Beranda</button></div>;
    return (
        <div className="max-w-md md:max-w-xl mx-auto p-4 pb-40 pt-24">
            <button onClick={handleBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white dark:bg-gray-800 dark:text-gray-200 px-4 py-2 rounded-xl shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button>
            <PostItem post={fetchedPost} {...props}/>
            <div className="mt-8 text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400 text-sm font-bold flex flex-col items-center justify-center gap-2"><Coffee size={24} className="opacity-50"/> Akhir dari postingan ini</div>
        </div>
    );
};

const SearchScreen = ({ allUsers, profile, handleFollow, goToProfile, isGuest, onRequestLogin, initialQuery, setPage, setTargetPostId }) => {
    const [queryTerm, setQueryTerm] = useState(initialQuery || '');
    const [results, setResults] = useState({ users: [], posts: [] });
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (!queryTerm.trim()) { setResults({ users: [], posts: [] }); return; }
        
        const doSearch = async () => {
            setIsSearching(true);
            const lower = queryTerm.toLowerCase();
            const foundUsers = allUsers.filter(u => u.username?.toLowerCase().includes(lower));
            try {
                const data = await fetchFeedData({ mode: 'search', q: queryTerm, limit: 20 });
                const enrichedPosts = data.posts.map(p => ({ ...p, user: p.user || { username: 'Pengguna' } }));
                setResults({ users: foundUsers, posts: enrichedPosts });
            } catch (e) { console.error("Search error", e); } finally { setIsSearching(false); }
        };
        const timeout = setTimeout(doSearch, 500); return () => clearTimeout(timeout);
    }, [queryTerm, allUsers]);

    return (
        <div className="max-w-md md:max-w-2xl mx-auto p-4 pb-24 pt-20">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 mb-6"><Search className="ml-2 text-gray-400"/><input value={queryTerm} onChange={e=>setQueryTerm(e.target.value)} placeholder="Cari orang, hashtag, atau postingan..." className="flex-1 p-2 outline-none bg-transparent dark:text-white"/></div>
            {isSearching ? ( <div className="text-center py-10"><Loader2 className="animate-spin text-sky-500 mx-auto"/></div> ) : queryTerm && (
                <div className="space-y-6">
                    {results.users.length > 0 && ( <div><h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wider">Pengguna</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{results.users.map(u => ( <div key={u.uid} className="bg-white dark:bg-gray-800 p-3 rounded-xl flex justify-between items-center shadow-sm border border-gray-50 dark:border-gray-700"> <div className="flex items-center gap-3" onClick={()=>goToProfile(u.uid)}> <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200 object-cover"/> <div><p className="font-bold text-sm dark:text-white">{u.username}</p><p className="text-[10px] text-gray-500">{u.followers?.length} Pengikut</p></div> </div> <button onClick={()=>isGuest ? onRequestLogin() : handleFollow(u.uid, (profile?.following||[]).includes(u.uid))} className="bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-xs font-bold">{(profile?.following||[]).includes(u.uid) ? 'Mengikuti' : 'Ikuti'}</button> </div> ))}</div></div> )}
                    {results.posts.length > 0 && ( <div><h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wider">Postingan Hasil Pencarian</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{results.posts.map(p => ( <div key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition border border-gray-50 dark:border-gray-700 h-full" onClick={()=>{ setTargetPostId(p.id); setPage('view_post'); }}> <div className="flex-1"> <p className="font-bold text-sm mb-1 line-clamp-1 dark:text-white">{p.title || 'Tanpa Judul'}</p> <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.content}</p> {p.mediaUrl && <div className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block text-gray-500"><ImageIcon size={10} className="inline mr-1"/>Ada Media</div>}</div> </div> ))}</div></div> )}
                    {results.users.length === 0 && results.posts.length === 0 && ( <div className="text-center text-gray-400 py-10">Tidak ditemukan hasil untuk "{queryTerm}"</div> )}
                </div>
            )}
            {!queryTerm && <div className="text-center text-gray-400 mt-20 flex flex-col items-center"><Search size={48} className="opacity-20 mb-4"/><p>Mulai ketik untuk mencari...</p></div>}
        </div>
    );
};

// ==========================================
// APP ROOT COMPONENT (UPDATED LAYOUT)
// ==========================================

const App = () => {
    // --- STATE CONFIG ---
    // READY adalah gatekeeper. Jika false, MainAppContent tidak akan dirender.
    const [ready, setReady] = useState(false);

    // --- FETCH CONFIG & INIT FIREBASE (REVISED FOR CANVAS/VERCEL) ---
    useEffect(() => {
        // HANYA JALANKAN SEKALI SAAT MOUNT
        const initSystem = async () => {
            // 1. Cek Environment Config (Canvas/Vercel)
            let fbConfig = null;
            if (typeof __firebase_config !== 'undefined') {
                try {
                    fbConfig = JSON.parse(__firebase_config);
                } catch (e) { console.error("Parse Env Error", e); }
            }

            // 2. Fetch Fallback (Original Logic + Valid endpoint)
            if (!fbConfig) {
                try {
                    // Coba endpoint firebase-config yang dibilang valid oleh user
                    const r = await fetch("/api/firebase-config"); 
                    if (r.ok) {
                        const cfg = await r.json();
                        // Jika struktur JSON langsung config, pakai cfg.
                        // Jika cfg.firebaseConfig, sesuaikan.
                        fbConfig = cfg.firebaseConfig || cfg; 
                    } else {
                        // Fallback ke public-config jika firebase-config gagal
                        const r2 = await fetch("/api/public-config");
                        if (r2.ok) {
                            const cfg2 = await r2.json();
                            Object.assign(CONFIG, cfg2);
                            fbConfig = cfg2.firebaseConfig;
                        }
                    }
                } catch (err) {
                    console.error("Config load failed", err);
                }
            }

            // 3. Initialize Firebase SECARA ASYNC DI DALAM COMPONENT
            if (fbConfig) {
                initFirebaseServices(fbConfig);
                
                // 4. Auth Handshake
                if (auth) {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        try { await signInWithCustomToken(auth, __initial_auth_token); } 
                        catch (e) { console.error("Auth Token Error", e); }
                    }
                }
                
                // 5. SET READY TRUE HANYA SETELAH SEMUA SELESAI
                setReady(true);
            } else {
                console.error("CRITICAL: No Firebase Config Available");
            }
        };

        initSystem();
    }, []); // Empty dependency array ensures run once

    if (!ready) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <Loader2 className="animate-spin text-sky-500 w-10 h-10 mb-4" />
                <p className="text-gray-500 text-sm font-bold">Memuat konfigurasi...</p>
            </div>
        );
    }

    return (
        <CustomAlertProvider>
            {/* MainAppContent hanya dirender jika ready === true, artinya auth sudah siap */}
            <MainAppContent />
        </CustomAlertProvider>
    );
};

const MainAppContent = () => {
    // Guard Clause Tambahan
    if (!auth) return <div className="p-10 text-center">Auth Error. Silakan refresh.</div>;

    const { showConfirm, showAlert } = useCustomAlert();
    const [user, setUser] = useState(undefined); const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); const [targetPid, setTargetPid] = useState(null); 
    const [notifCount, setNotifCount] = useState(0); const [newPostId, setNewPostId] = useState(null); 
    const [searchQuery, setSearchQuery] = useState(''); const [isLoadingFeed, setIsLoadingFeed] = useState(true); 
    const [feedError, setFeedError] = useState(false); const [refreshTrigger, setRefreshTrigger] = useState(0); 
    const [showAuthModal, setShowAuthModal] = useState(false); const [showOnboarding, setShowOnboarding] = useState(false); 
    const [darkMode, setDarkMode] = useState(false); const [isOffline, setIsOffline] = useState(!navigator.onLine); 
    const [showRewards, setShowRewards] = useState(false); 
    const DEVELOPER_EMAIL = "irhamdika00@gmail.com";
    
    // NEW STATE: Sidebar
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [isUsersLoaded, setIsUsersLoaded] = useState(false);
    const [isDataTimeout, setIsDataTimeout] = useState(false);

    // FIX: State untuk Notifikasi Chat Terpisah
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    const [homeFeedState, setHomeFeedState] = useState({ posts: [], cursor: null, sortType: 'home', hasLoaded: false, scrollPos: 0 });
    const lastNotifTimeRef = useRef(0); // Debounce notif

    // FIX: REALTIME UI STATE UPDATE
    const handlePostUpdate = (postId, newData) => {
        if (!newData) {
            // Case: Delete Post
            setHomeFeedState(prev => ({
                ...prev,
                posts: prev.posts.filter(p => p.id !== postId)
            }));
            setPosts(prev => prev.filter(p => p.id !== postId));
        } else {
            // Case: Update Post (Like/Comment)
            setHomeFeedState(prev => ({
                ...prev,
                posts: prev.posts.map(p => p.id === postId ? { ...p, ...newData } : p)
            }));
            // Update cache posts too just in case
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...newData } : p));
        }
    };

    useEffect(() => {
        const handleError = (event) => { if (!user || user.email !== DEVELOPER_EMAIL) { event.preventDefault(); logSystemError(event.error || new Error(event.message), 'global_error', user); } };
        window.addEventListener('error', handleError);
        return () => { window.removeEventListener('error', handleError); };
    }, [user]);

    useEffect(() => { const handleOff = () => setIsOffline(true); const handleOn = () => { setIsOffline(false); setRefreshTrigger(prev=>prev+1); }; window.addEventListener('offline', handleOff); window.addEventListener('online', handleOn); return () => { window.removeEventListener('offline', handleOff); window.removeEventListener('online', handleOn); } }, []);
    useEffect(() => { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('firebase-messaging-sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed')); } }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [page]);
    useEffect(() => { const savedTheme = localStorage.getItem('theme'); if (savedTheme === 'dark') { document.documentElement.classList.add('dark'); setDarkMode(true); } }, []);

    useEffect(() => {
        const timer = setTimeout(() => { if (!isUsersLoaded || (user && !isProfileLoaded)) { setIsDataTimeout(true); } }, 15000); 
        return () => clearTimeout(timer);
    }, [isUsersLoaded, isProfileLoaded, user]);

    useEffect(() => {
        const checkAutoReset = async () => {
            if (!user || user.email !== DEVELOPER_EMAIL) return; 
            const now = new Date();
            const isThursday = now.getDay() === 4; 
            const isTime = now.getHours() >= 11; 
            if (isThursday && isTime) {
                const logRef = doc(db, getPublicCollection('systemLogs'), 'last_weekly_reset');
                const logSnap = await getDoc(logRef);
                const lastReset = logSnap.exists() ? logSnap.data().timestamp.toDate() : new Date(0);
                if (lastReset.getDate() !== now.getDate()) {
                     console.log("TRIGGERING WEEKLY RESET...");
                     await setDoc(logRef, { timestamp: serverTimestamp(), type: 'weekly_reset' });
                     await showAlert("SYSTEM: Waktunya reset mingguan (Kamis 11:00).", 'info');
                }
            }
        };
        if(user) checkAutoReset();
    }, [user]);

    const handleLogout = async () => { const ok = await showConfirm("Yakin ingin keluar akun?"); if(ok) { await signOut(auth); setPage('home'); setSidebarOpen(false); } };

    // FIX: URL Parsing untuk Deep Link Profile & Post
    useEffect(() => { 
        const params = new URLSearchParams(window.location.search);
        const p = params.get('post');
        const u = params.get('user'); // New Param for Profile Sharing
        
        if (p) { 
            setTargetPid(p); 
            setPage('view_post'); 
        } else if (u) {
            setTargetUid(u);
            setPage('other-profile');
        }
    }, []);

    // FIX: Listen Chat Unread Counts Specifically
    useEffect(() => {
        if (!user) return;
        const qChat = query(
            collection(db, getPublicCollection('chats')), 
            where('participants', 'array-contains', user.uid)
        );
        const unsubChat = onSnapshot(qChat, (snapshot) => {
            // Hitung chat yg punya pesan terakhir dari orang lain dan belum dibaca
            const unread = snapshot.docs.filter(d => {
                const data = d.data();
                return data.lastMessage && 
                       data.lastMessage.senderId !== user.uid && 
                       data.lastMessage.isRead === false;
            }).length;
            setChatUnreadCount(unread);
        });
        return () => unsubChat();
    }, [user]);

    // FIX: Notifikasi Regular (Kecuali Chat)
    useEffect(() => {
        if (!user) return;
        // Filter type != 'chat' tidak bisa langsung di Firestore karena limitasi compound query
        // Jadi kita ambil notif belum dibaca, lalu filter di client
        const q = query(
            collection(db, getPublicCollection('notifications')), 
            where('toUserId', '==', user.uid), 
            where('isRead', '==', false), 
            orderBy('timestamp', 'desc'), 
            limit(20)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => { 
            // Filter hanya non-chat notifications
            const regularNotifs = snapshot.docs.filter(d => d.data().type !== 'chat');
            setNotifCount(regularNotifs.length); 
            
            snapshot.docChanges().forEach((change) => { 
                if (change.type === "added") { 
                    const data = change.doc.data(); 
                    if (data.type === 'chat') return; // Skip chat notif popup here (handled elsewhere if needed)

                    const now = Date.now(); 
                    const notifTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0; 
                    if (now - notifTime < 10000 && now - lastNotifTimeRef.current > 2000) { 
                        lastNotifTimeRef.current = now;
                        if (Notification.permission === "granted") { 
                            new Notification(APP_NAME, { body: `${data.fromUsername} ${data.message}`, icon: APP_LOGO, tag: 'bgune-notif' }); 
                        } 
                    } 
                } 
            }); 
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => onAuthStateChanged(auth, async (u) => { 
        if(u) { 
            setUser(u); 
            // FIX: Pindahkan request notifikasi ke dalam blok if(userDoc.exists()) di bawah
            try {
                const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid)); 
                if (!userDoc.exists()) { 
                    setShowOnboarding(true); 
                    setIsProfileLoaded(true); 
                } else { 
                    const userData = userDoc.data(); 
                    if (userData.isBanned) { await showAlert("AKUN ANDA TELAH DIBLOKIR/BANNED.", 'error'); await signOut(auth); setUser(null); setProfile(null); return; } 
                    
                    // Request permission HANYA jika profil user valid
                    requestNotificationPermission(u.uid);
                    await updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{}); 
                }
            } catch(e) { console.error("Auth State change error:", e); setIsProfileLoaded(true); }
        } else { setUser(null); setProfile(null); setIsProfileLoaded(true); } 
    }), []);
    
    useEffect(() => { 
        if(user) { 
            const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), 
                async s => { if(s.exists()) { const data = s.data(); if (data.isBanned) { await showAlert("AKUN ANDA TELAH DIBLOKIR/BANNED.", 'error'); await signOut(auth); return; } setProfile({...data, uid:user.uid, email:user.email}); if (showOnboarding) setShowOnboarding(false); } setIsProfileLoaded(true); },
                (error) => { console.error("Profile Snapshot Error:", error); setIsProfileLoaded(true); }
            ); 
            return () => { unsubP(); }; 
        } 
    }, [user]);

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), (s) => { setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))); setIsUsersLoaded(true); }, (error) => { console.error("CRITICAL ERROR: Gagal load userProfiles.", error); setIsUsersLoaded(true); });
        const unsubCache = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20)), (s) => { const raw = s.docs.map(d=>({id:d.id,...d.data()})); setPosts(raw); setIsLoadingFeed(false); }, (error) => { console.error("CRITICAL ERROR: Gagal load posts cache.", error); setIsLoadingFeed(false); });
        return () => { unsubUsers(); unsubCache(); };
    }, [refreshTrigger]); 

    const handleFollow = async (uid, isFollowing) => { if (!user) { setShowAuthModal(true); return; } if (!profile) return; const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); const targetRef = doc(db, getPublicCollection('userProfiles'), uid); try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); if (uid !== profile.uid) { sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } } } catch (e) { console.error("Gagal update pertemanan", e); } };
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };

    const isDataReady = isUsersLoaded && isProfileLoaded;
    if (isDataTimeout) return <ErrorBoundary><DataTimeoutPage /></ErrorBoundary>;
    if (!isDataReady) return <ErrorBoundary><SplashScreen /></ErrorBoundary>;
    if (isOffline && !posts.length) return <ErrorBoundary><OfflinePage onRetry={()=>setRefreshTrigger(prev=>prev+1)}/></ErrorBoundary>;

    const isMeDeveloper = user && user.email === DEVELOPER_EMAIL; const targetUser = users.find(u => u.uid === targetUid); const isGuest = !user; 
    
    // FIX: Halaman tanpa Navbar
    const hideNavbarPages = ['create', 'chat', 'notifications', 'legal'];
    const showHeader = !hideNavbarPages.includes(page);

    return (
        <ErrorBoundary>
            <div>
                <style>{`.dark body { background-color: #111827; color: white; }`}</style>
                <div className={`min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
                    <NetworkStatus />
                    
                    {/* --- MODERN SIDEBAR --- */}
                    <ModernSidebar 
                        isOpen={sidebarOpen} 
                        onClose={() => setSidebarOpen(false)} 
                        setPage={setPage} 
                        user={profile} 
                        onLogout={handleLogout} 
                        setShowAuthModal={setShowAuthModal}
                        chatUnreadCount={chatUnreadCount} // FIX: Pass prop
                        handleFriendsClick={() => {
                            setHomeFeedState(prev => ({ ...prev, sortType: 'friends', posts: [], cursor: null, hasLoaded: false }));
                            setPage('home');
                        }}
                    />

                    {/* FIX: Navbar Logic - Sembunyikan di halaman tertentu */}
                    {showHeader && ( 
                        <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300">
                            {/* Left: Hamburger & Logo */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setPage('home')}>
                                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                                </div>
                            </div>

                            {/* Center: Desktop Navigation (Pindah dari bawah) */}
                            <div className="hidden md:flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2">
                                <NavBtnDesktop icon={Home} active={page==='home'} onClick={()=>setPage('home')} label="Beranda" />
                                <NavBtnDesktop icon={Search} active={page==='search'} onClick={()=>setPage('search')} label="Cari" />
                                <NavBtnDesktop icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')} label="Top" />
                                <button onClick={() => isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-white border-2 border-sky-500 text-sky-500 p-2 rounded-full hover:bg-sky-50 transition">
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                                <NavBtnDesktop icon={User} active={page==='profile'} onClick={()=> isGuest ? setShowAuthModal(true) : setPage('profile')} label="Saya" />
                            </div>

                            {/* Right: Notifications & Actions */}
                            <div className="flex gap-2 items-center">
                                {!isGuest && (
                                     <button onClick={()=>setPage('notifications')} className="p-2 bg-white dark:bg-gray-800 rounded-full text-gray-500 hover:text-sky-600 transition relative border border-gray-100 dark:border-gray-700">
                                         <Bell size={20}/>
                                         {notifCount>0 && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                                     </button>
                                )}
                                <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full dark:text-white dark:hover:bg-gray-800 transition relative">
                                    <Menu size={24} />
                                    {/* FIX: Titik merah di hamburger menu jika ada chat */}
                                    {chatUnreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                                </button>
                            </div>
                        </header> 
                    )}

                    <main className={showHeader ? 'pt-16 md:pt-20' : ''}>
                        {page==='home' && ( <><HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} isLoadingFeed={isLoadingFeed} feedError={feedError} retryFeed={()=>setRefreshTrigger(p=>p+1)} homeFeedState={homeFeedState} setHomeFeedState={setHomeFeedState} handlePostUpdate={handlePostUpdate} /></> )}
                        {/* FIX: Kirim userPhoto ke CreatePost */}
                        {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} userPhoto={profile?.photoURL} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage('home')}}/>}
                        {page==='search' && <SearchScreen allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} initialQuery={searchQuery} setPage={setPage} setTargetPostId={setTargetPid} />}
                        {page==='leaderboard' && <LeaderboardScreen allUsers={users} currentUser={user} />}
                        {page==='legal' && <LegalPage onBack={()=>setPage('home')} />}
                        {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                        {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} allUsers={users} />}
                        {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} allUsers={users} />}
                        {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} onUpdate={handlePostUpdate} />}
                        {page==='chat' && <ChatSystem currentUser={user} onBack={() => setPage('home')} />}
                    </main>
                    
                    {/* BOTTOM NAV (MOBILE ONLY) - HIDDEN ON SPECIFIC PAGES */}
                    {showHeader && ( <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 pb-safe pt-2 px-6 flex justify-between items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"><NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/><NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/><button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-sky-500 text-white p-3.5 rounded-full shadow-xl shadow-sky-300 hover:scale-110 transition -mt-8 border-4 border-[#F0F4F8] dark:border-gray-900"><Plus size={28} strokeWidth={3}/></button><NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>{isGuest ? ( <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/> ) : ( <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/> )}</nav> )}
                    
                   
{showAuthModal && (
    <AuthModal onClose={() => setShowAuthModal(false)} />
)}

{showOnboarding && user && (
    <OnboardingScreen
        user={user}
        onComplete={() => setShowOnboarding(false)}
    />
)}

<PWAInstallPrompt />
</div>
</div>
</ErrorBoundary>
);
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`p-2 transition duration-300 flex flex-col items-center ${
            active ? 'text-sky-500' : 'text-gray-400'
        }`}
    >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    </button>
);

const NavBtnDesktop = ({ icon: Icon, active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`p-2 transition duration-300 flex items-center gap-2 px-3 py-1.5 rounded-full ${
            active
                ? 'bg-sky-50 text-sky-600 dark:bg-gray-800 dark:text-sky-400'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200'
        }`}
    >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        <span className={`text-xs font-bold ${active ? 'block' : 'hidden'}`}>
            {label}
        </span>
    </button>
);

export default App;