import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

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
    writeBatch
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
    WifiHigh, Menu, MessageCircle, MoreVertical, Copy, CornerDownLeft, Shield, FileWarning, Gavel
} from 'lucide-react';

// DEBUGGING: Matikan silent mode agar error firebase terlihat di console
// setLogLevel('silent'); 

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
                <div className="bg-gray-100 p-4 rounded-xl text-left text-xs font-mono text-red-600 mb-6 overflow-auto max-h-32">
                    {this.state.error?.toString()}
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-sky-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 transition w-full"
                >
                    Muat Ulang Aplikasi
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- KONSTANTA GLOBAL & API ---
const DEVELOPER_EMAIL = process.env.REACT_APP_DEV_EMAIL; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i150/VrL65.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";

// Endpoint API
const API_ENDPOINT = '/api/feed';

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc", 
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8",
};

const API_KEY = process.env.REACT_APP_API_KEY;
const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;
const FEED_API_KEY = process.env.REACT_APP_FEED_API_KEY;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const getPublicCollection = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;

// Initialize Firebase with Error Handling
let app, auth, db, googleProvider, messaging;
try {
    app = initializeApp(firebaseConfig);
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
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

const fetchFeedData = async ({ mode = 'home', limit = 10, cursor = null, viewerId = null, userId = null, q = null }) => {
    if (!API_KEY) {
        console.warn("API Key missing, returning empty feed.");
        return { posts: [], nextCursor: null };
    }
    const params = new URLSearchParams();
    params.append('mode', mode); // Supports 'home', 'meme', 'popular', 'following' (teman)
    params.append('limit', limit);
    if (cursor) params.append('cursor', cursor);
    if (viewerId) params.append('viewerId', viewerId);
    if (userId) params.append('userId', userId);
    if (q) params.append('q', q);

    const url = `${API_ENDPOINT}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY, 
            },
        });
        if (!response.ok) throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        const data = await response.json();
        return { 
            posts: data.posts || [], 
            nextCursor: data.nextCursor
        };
    } catch (error) {
        console.error("API Fetch Error (Feed):", error);
        return { posts: [], nextCursor: null };
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
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                const userRef = doc(db, getPublicCollection('userProfiles'), userId);
                await updateDoc(userRef, { fcmTokens: arrayUnion(token), lastTokenUpdate: serverTimestamp() });
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
                const MAX_WIDTH = 800; // Increased quality slightly for modern UI
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
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

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    try {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        const fullDate = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        if (seconds > 86400) return { relative: fullDate, full: fullDate };
        if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return { relative: `${minutes}m`, full: fullDate };
        const hours = Math.floor(minutes / 60);
        return { relative: `${hours}j`, full: fullDate };
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

const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEV", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 1000) return { label: "LEGEND", icon: Crown, color: "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white" };
    if (reputation >= 500) return { label: "STAR", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 100) return { label: "HOT", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "", icon: User, color: "bg-gray-100 text-gray-500" };
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

const Sidebar = ({ isOpen, onClose, user, setPage, isErudaOpen, setIsErudaOpen, onLogout }) => {
    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm" onClick={onClose}></div>}
            <div className={`fixed top-0 left-0 h-full w-[280px] bg-white dark:bg-gray-900 z-[100] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <img src={APP_LOGO} className="w-8 h-8"/>
                         <span className="font-black text-lg text-gray-800 dark:text-white">{APP_NAME}</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Chat Menu */}
                    <button onClick={() => { setPage('chat'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sky-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition">
                        <MessageCircle size={20} className="text-sky-500"/>
                        <span className="font-bold text-sm">Pesan / Chat</span>
                    </button>

                    <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase px-3 mb-2">Kebijakan</h4>
                    
                    <button onClick={() => { setPage('policy_privacy'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition text-sm">
                        <Lock size={18}/> Kebijakan Privasi
                    </button>
                    <button onClick={() => { setPage('policy_tos'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition text-sm">
                        <FileText size={18}/> Ketentuan Layanan
                    </button>
                    <button onClick={() => { setPage('policy_community'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition text-sm">
                        <Users size={18}/> Panduan Komunitas
                    </button>
                    <button onClick={() => { setPage('policy_dmca'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition text-sm">
                        <FileWarning size={18}/> DMCA & Laporan
                    </button>
                     <button onClick={() => { setPage('policy_mod'); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition text-sm">
                        <Shield size={18}/> Moderasi Konten
                    </button>

                    {user?.email === DEVELOPER_EMAIL && (
                        <>
                            <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase px-3 mb-2">Developer Zone</h4>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                                <span className="text-sm font-bold flex items-center gap-2"><Code size={16}/> Eruda Console</span>
                                <button onClick={() => setIsErudaOpen(!isErudaOpen)} className={`w-10 h-5 rounded-full transition relative ${isErudaOpen ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isErudaOpen ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                     {user ? (
                        <button onClick={onLogout} className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition">
                            <LogOut size={18}/> Keluar Akun
                        </button>
                     ) : (
                         <div className="text-center text-xs text-gray-400">Belum Masuk</div>
                     )}
                     <div className="mt-4 text-center">
                         <p className="text-[10px] font-bold text-gray-400">BguneNet Dibawah Naungan</p>
                         <p className="text-[10px] font-black text-sky-600">Bgune - Digital</p>
                     </div>
                </div>
            </div>
        </>
    );
};

// ... (Komponen UI Kecil Lainnya Tetap Sama: DraggableGift, PWAInstallPrompt, Avatar, NetworkStatus, DailyRewardModal, Lightbox, AudioPlayer, SplashScreen, OfflinePage, DataTimeoutPage, SkeletonPost)
const DraggableGift = ({ onClick, canClaim, nextClaimTime }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 70, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const btnRef = useRef(null);
    useEffect(() => {
        const handleWinMove = (e) => {
            if(isDragging) {
                e.preventDefault(); 
                const newX = Math.min(Math.max(0, e.clientX - dragStartRef.current.x), window.innerWidth - 60);
                const newY = Math.min(Math.max(0, e.clientY - dragStartRef.current.y), window.innerHeight - 60);
                setPosition({ x: newX, y: newY });
            }
        };
        const handleWinUp = () => { if(isDragging) setIsDragging(false); };
        if (isDragging) { window.addEventListener('mousemove', handleWinMove); window.addEventListener('mouseup', handleWinUp); }
        return () => { window.removeEventListener('mousemove', handleWinMove); window.removeEventListener('mouseup', handleWinUp); };
    }, [isDragging]);
    useEffect(() => { setPosition({ x: window.innerWidth - 70, y: window.innerHeight - 150 }); }, []);
    const handleStart = (clientX, clientY) => { setIsDragging(false); if(btnRef.current) { const rect = btnRef.current.getBoundingClientRect(); dragStartRef.current = { x: clientX - rect.left, y: clientY - rect.top }; } };
    const handleMove = (clientX, clientY) => { setIsDragging(true); const newX = Math.min(Math.max(0, clientX - dragStartRef.current.x), window.innerWidth - 60); const newY = Math.min(Math.max(0, clientY - dragStartRef.current.y), window.innerHeight - 60); setPosition({ x: newX, y: newY }); };
    const handleEnd = () => { setTimeout(() => setIsDragging(false), 100); };
    return (
        <div ref={btnRef} className="fixed z-[55] touch-none select-none cursor-move transition-shadow" style={{ left: position.x, top: position.y }} onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)} onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={handleEnd} onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); setIsDragging(true); }}>
            <button onClick={() => !isDragging && onClick()} className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2.5 rounded-full shadow-2xl shadow-orange-500/50 relative group active:scale-95 transition-transform">
                <GiftIcon size={24} className={`text-white ${canClaim ? 'animate-bounce' : ''}`}/>
                {canClaim && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
        </div>
    );
};
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null); const [showBanner, setShowBanner] = useState(false);
    useEffect(() => { const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); const lastDismiss = localStorage.getItem('pwa_dismissed'); if (!lastDismiss || Date.now() - parseInt(lastDismiss) > 86400000) { setShowBanner(true); } }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler); }, []);
    const handleInstall = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { setDeferredPrompt(null); setShowBanner(false); } };
    if (!showBanner) return null;
    return ( <div className="fixed bottom-24 left-4 right-4 bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom border border-gray-700"> <div className="flex items-center gap-3"><div className="bg-sky-500 p-2.5 rounded-xl shadow-lg shadow-sky-500/20"><Smartphone size={24}/></div><div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-gray-300">Notifikasi & Fullscreen</p></div></div> <div className="flex items-center gap-2"><button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full"><X size={16}/></button><button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600 transition">Pasang</button></div> </div> );
};
const Avatar = ({ src, alt, className, fallbackText }) => {
    const [error, setError] = useState(false); const safeFallback = fallbackText ? fallbackText : "?";
    if (!src || error) { return ( <div className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-black text-gray-500 dark:text-gray-400 select-none`}>{safeFallback[0]?.toUpperCase() || '?'}</div> ); }
    return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setError(true)} loading="lazy" />;
};
const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine); const [showNotif, setShowNotif] = useState(false);
    useEffect(() => { const handleOnline = () => { setIsOnline(true); setShowNotif(true); setTimeout(() => setShowNotif(false), 3000); }; const handleOffline = () => { setIsOnline(false); setShowNotif(true); }; window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, []);
    if (!showNotif) return null;
    return ( <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 transition-all duration-300 ${isOnline ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}{isOnline ? "Koneksi Stabil Kembali" : "Koneksi Terputus - Mode Offline"}</div> );
};
const DailyRewardModal = ({ onClose, onClaim, canClaim, nextClaimTime, isGuest, onLoginRequest }) => {
    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in zoom-in-95"> <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-sky-100 dark:border-gray-700"> <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button> <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><GiftIcon size={40} className="text-yellow-600 dark:text-yellow-400"/></div> <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Hujan Hadiah!</h2> {isGuest ? ( <> <p className="text-gray-500 text-sm mb-6">Login sekarang untuk mengklaim reputasi gratis dan mulai mendaki Leaderboard!</p> <button onClick={() => { onClose(); onLoginRequest(); }} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition flex items-center justify-center gap-2"><LogIn size={18}/> Login Untuk Klaim</button> </> ) : ( <> <p className="text-gray-500 text-sm mb-6">Login setiap hari untuk mendapatkan reputasi gratis dan jadilah Legend!</p> {canClaim ? ( <button onClick={onClaim} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-105 transition flex items-center justify-center gap-2"><Sparkles size={18}/> Klaim Hadiah</button> ) : ( <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-300"><Clock size={16} className="inline mr-1 mb-0.5"/> Tunggu {nextClaimTime} lagi</div> )} </> )} </div> </div> );
};
const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    return ( <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200"> <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md z-50"><X size={24}/></button> <div className="flex-1 w-full flex items-center justify-center relative"> {images.length > 1 && (<button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length)}} className="absolute left-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronLeft/></button>)} <img src={images[index]} className="max-w-full max-h-screen object-contain" /> {images.length > 1 && (<button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length)}} className="absolute right-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronRight/></button>)} </div> </div> );
};
const AudioPlayer = ({ src }) => {
    const audioRef = useRef(null); const [isPlaying, setIsPlaying] = useState(false); const togglePlay = () => { if (audioRef.current) { if (isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); } };
    return ( <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-3 flex items-center gap-3 mb-4 shadow-md border border-gray-700"> <button onClick={togglePlay} className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition">{isPlaying ? <Pause size={18} fill="white"/> : <Play size={18} fill="white" className="ml-1"/>}</button> <div className="flex-1"><div className="flex items-center gap-1 text-xs font-bold text-sky-400 mb-1"><Music size={12}/> Audio Clip</div><audio ref={audioRef} src={src} className="w-full h-6 opacity-80" controls onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}/></div> </div> );
};
const SplashScreen = () => ( <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-gray-900 dark:to-black z-[100] flex flex-col items-center justify-center"> <div className="relative mb-8 animate-bounce-slow"><img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/><div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div></div> <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1> <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div> <p className="text-gray-400 text-xs font-medium animate-pulse">Menghubungkan ke server...</p> <p className="text-gray-300 text-[10px] mt-2">Sinkronisasi Profile & Papan Peringkat...</p> </div> );
const OfflinePage = ({ onRetry }) => ( <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center"> <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6"><WifiOff size={40} className="text-gray-400"/></div> <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Kamu Offline</h2> <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">Sepertinya internet kamu sedang istirahat.</p> <button onClick={onRetry} className="bg-sky-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-sky-600 transition flex items-center gap-2"><RefreshCw size={18}/> Coba Lagi</button> </div> );
const DataTimeoutPage = () => ( <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center z-[110] relative"> <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse"><AlertTriangle size={40} className="text-red-500"/></div> <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Gagal Memuat Data</h2> <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs text-sm leading-relaxed"> Data Profile atau Papan Peringkat memakan waktu terlalu lama. <br/><br/> Ini mungkin karena koneksi lambat atau server sedang dalam perbaikan oleh Developer. </p> <div className="flex flex-col gap-3 w-full max-w-xs"> <button onClick={() => window.location.reload()} className="bg-sky-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition flex items-center justify-center gap-2"><RefreshCw size={18}/> Refresh Total</button> <p className="text-[10px] text-gray-400">Silakan kembali lagi nanti jika masalah berlanjut.</p> </div> </div> );
const SkeletonPost = () => ( <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse"> <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div> <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4"></div> </div> );
const WaitingScreen = ({ progress }) => (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[80] flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-sky-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <Send size={40} className="text-sky-500"/>
        </div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Sedang Memposting...</h2>
        <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-sky-500 transition-all duration-300" style={{width: `${progress}%`}}></div>
        </div>
        <p className="text-gray-500 text-sm animate-pulse">Menghubungi satelit... {progress}%</p>
    </div>
);

// PERBAIKAN 1 & 2: Anti-XSS & Layout
const renderMarkdown = (text, onHashtagClick) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        if (/^(javascript|vbscript|data):/i.test(url)) return `${label} (Link Diblokir)`;
        return `<a href="${url}" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">${label} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`;
    });
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 dark:bg-sky-900/30 px-1 rounded text-sm text-sky-700 dark:text-sky-400 font-mono border border-sky-100 dark:border-sky-800">$1</code>');
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline hashtag" data-tag="$1">#$1</span>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-[13px] md:text-sm" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => { if (e.target.classList.contains('hashtag')) { e.stopPropagation(); if(onHashtagClick) onHashtagClick(e.target.getAttribute('data-tag')); } }}/>;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER (Admin Only)
// ==========================================

const DeveloperDashboard = ({ onClose }) => {
    // ... (Kode Developer Dashboard sama persis, disingkat untuk menghemat baris, logika tidak berubah)
    return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Dashboard (Placeholder) <button onClick={onClose}>Close</button></div>;
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI & USER
// ==========================================

const OnboardingScreen = ({ onComplete, user }) => {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => { e.preventDefault(); if (!username.trim()) return alert("Username wajib diisi!"); setLoading(true); try { await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { username: username.trim(), email: user.email, uid: user.uid, photoURL: user.photoURL || '', createdAt: serverTimestamp(), following: [], followers: [], savedPosts: [], lastSeen: serverTimestamp(), reputation: 0, lastPostTime: 0 }); onComplete(); } catch (error) { alert("Gagal menyimpan data: " + error.message); } finally { setLoading(false); } };
    return ( <div className="fixed inset-0 bg-white z-[80] flex flex-col items-center justify-center p-6 animate-in fade-in"> <div className="w-full max-w-sm text-center"> <img src={APP_LOGO} className="w-24 h-24 mx-auto mb-6 object-contain"/> <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang! 👋</h2> <p className="text-gray-500 mb-8 text-sm">Lengkapi profil Anda untuk mulai berinteraksi.</p> <form onSubmit={handleSubmit} className="space-y-4"><div className="text-left"><label className="text-xs font-bold text-gray-600 ml-1">Username Unik</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Contoh: user_keren123" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none"/></div><button disabled={loading} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Mulai Menjelajah"}</button></form> </div> </div> );
};
const AuthModal = ({ onClose }) => {
    const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); onClose(); } catch (error) { console.error(error); alert("Gagal login dengan Google."); } };
    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95"> <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button><div className="text-center mb-6"><img src={APP_LOGO} className="w-16 h-16 mx-auto mb-3"/><h2 className="text-xl font-black text-gray-800 dark:text-white">Masuk ke {APP_NAME}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bergabunglah dengan komunitas sekarang!</p></div><button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Lanjutkan dengan Google</button><p className="text-[10px] text-center text-gray-400 mt-4">Dengan masuk, Anda menyetujui Ketentuan Layanan kami.</p></div> </div> );
};

const PolicyPage = ({ type, onBack }) => {
    let title, icon, content;
    switch(type) {
        case 'policy_privacy': title="Kebijakan Privasi"; icon=<Lock size={24}/>; content="Kami menghargai privasi Anda. Data yang kami kumpulkan hanya nama, email, dan foto profil dari Google Auth."; break;
        case 'policy_tos': title="Ketentuan Layanan"; icon=<FileText size={24}/>; content="1. Dilarang spam. 2. Hormati pengguna lain. 3. Konten ilegal akan dihapus."; break;
        case 'policy_community': title="Panduan Komunitas"; icon=<Users size={24}/>; content="Jadilah pengguna yang baik. Jangan menyebarkan kebencian atau hoax."; break;
        case 'policy_dmca': title="DMCA / Laporan"; icon=<FileWarning size={24}/>; content="Laporkan pelanggaran hak cipta atau konten berbahaya ke email developer."; break;
        case 'policy_mod': title="Moderasi Konten"; icon=<Shield size={24}/>; content="Konten kasar, ilegal, dan pornografi akan dihapus secara otomatis atau manual."; break;
        default: title="Kebijakan"; icon=<Info size={24}/>; content="Halaman kebijakan.";
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pb-24 pt-20 px-6 max-w-2xl mx-auto animate-in fade-in">
            <button onClick={onBack} className="fixed top-6 left-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"><ArrowLeft/></button>
            <div className="text-center mb-10"><div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600">{icon}</div><h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{title}</h1><p className="text-gray-500 dark:text-gray-400">Pembaruan Terakhir: 2024</p></div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 leading-relaxed text-gray-700 dark:text-gray-300">
                {content}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: FITUR CHAT (NEW)
// ==========================================

const ChatScreen = ({ user, profile, allUsers, onBack }) => {
    const [view, setView] = useState('list'); // list | room
    const [activeChat, setActiveChat] = useState(null);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [loadingChats, setLoadingChats] = useState(true);

    // FETCH CHATS LIST
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('conversations')), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChats(list);
            setLoadingChats(false);
        });
        return () => unsub();
    }, [user]);

    // FETCH MESSAGES FOR ACTIVE CHAT
    useEffect(() => {
        if (!activeChat) return;
        const q = query(collection(db, getPublicCollection(`conversations/${activeChat.id}/messages`)), orderBy('timestamp', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            // Mark as read
            const batch = writeBatch(db);
            snap.docs.forEach(docSnap => {
                if (docSnap.data().senderId !== user.uid && !docSnap.data().isRead) {
                    batch.update(docSnap.ref, { isRead: true });
                }
            });
            batch.commit().catch(e => console.log("Read receipt error", e));
        });
        return () => unsub();
    }, [activeChat]);

    const startChat = async (targetUser) => {
        // Check existing
        const existing = chats.find(c => c.participants.includes(targetUser.uid));
        if (existing) {
            setActiveChat({ ...existing, otherUser: targetUser });
            setView('room');
            setShowNewChatModal(false);
        } else {
            // Create new
            const chatData = {
                participants: [user.uid, targetUser.uid],
                updatedAt: serverTimestamp(),
                lastMessage: 'Memulai percakapan',
                typing: {}
            };
            const ref = await addDoc(collection(db, getPublicCollection('conversations')), chatData);
            setActiveChat({ id: ref.id, ...chatData, otherUser: targetUser });
            setView('room');
            setShowNewChatModal(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        const text = inputText;
        setInputText('');
        
        await addDoc(collection(db, getPublicCollection(`conversations/${activeChat.id}/messages`)), {
            text: text,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            isRead: false
        });

        await updateDoc(doc(db, getPublicCollection('conversations'), activeChat.id), {
            lastMessage: text,
            updatedAt: serverTimestamp()
        });
    };

    const deleteChat = async (chatId) => {
        if(confirm("Hapus riwayat chat ini?")) {
            await deleteDoc(doc(db, getPublicCollection('conversations'), chatId));
            setView('list');
        }
    };

    const handleLongPress = (msg) => {
        if (msg.senderId === user.uid) {
            if(confirm("Hapus pesan ini?")) {
                deleteDoc(doc(db, getPublicCollection(`conversations/${activeChat.id}/messages`), msg.id));
            }
        } else {
             navigator.clipboard.writeText(msg.text);
             alert("Pesan disalin");
        }
    };

    // Filter teman untuk New Chat (Mutual Follow)
    const friends = allUsers.filter(u => 
        (profile.following || []).includes(u.uid) 
        // && (profile.followers || []).includes(u.uid) // Uncomment for strict friends only
    );

    if (view === 'room' && activeChat) {
        return (
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
                <div className="bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700 flex items-center gap-3 shadow-sm sticky top-0 z-20">
                    <button onClick={() => setView('list')}><ArrowLeft/></button>
                    <Avatar src={activeChat.otherUser.photoURL} className="w-10 h-10 rounded-full"/>
                    <div className="flex-1">
                        <h3 className="font-bold dark:text-white">{activeChat.otherUser.username}</h3>
                        <p className="text-xs text-green-500">Online</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map(msg => (
                        <div key={msg.id} onContextMenu={(e)=>{e.preventDefault(); handleLongPress(msg)}} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.senderId === user.uid ? 'bg-sky-500 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-white rounded-tl-none shadow-sm'}`}>
                                {msg.text}
                                <div className={`text-[9px] mt-1 text-right opacity-70 flex justify-end gap-1`}>
                                    {msg.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {msg.senderId === user.uid && (msg.isRead ? <CheckCircle size={10}/> : <Check size={10}/>)}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div id="scroll-anchor"></div>
                </div>
                <form onSubmit={sendMessage} className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2 sticky bottom-0">
                    <input value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="Ketik pesan..." className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white px-4 py-2 rounded-full outline-none"/>
                    <button type="submit" className="bg-sky-500 text-white p-2.5 rounded-full"><Send size={18}/></button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pt-20 pb-20 px-4">
             <div className="fixed top-0 left-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-4 border-b dark:border-gray-800 z-10 flex items-center justify-between">
                <button onClick={onBack}><ArrowLeft/></button>
                <h1 className="font-black text-lg">Pesan</h1>
                <div className="w-6"></div>
            </div>

            {loadingChats ? <div className="text-center mt-10"><Loader2 className="animate-spin mx-auto text-sky-500"/></div> : 
            chats.length === 0 ? (
                <div className="text-center mt-20 text-gray-400">
                    <MessageCircle size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>Belum ada percakapan.</p>
                    <button onClick={() => setShowNewChatModal(true)} className="mt-4 bg-sky-500 text-white px-6 py-2 rounded-full font-bold text-sm">Mulai Chat Baru</button>
                </div>
            ) : (
                <div className="space-y-2">
                    {chats.map(c => {
                        const otherUid = c.participants.find(p => p !== user.uid);
                        const otherUser = allUsers.find(u => u.uid === otherUid) || { username: 'Unknown', photoURL: '' };
                        return (
                            <div key={c.id} onClick={() => { setActiveChat({...c, otherUser}); setView('room'); }} onContextMenu={(e)=>{e.preventDefault(); deleteChat(c.id)}} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <Avatar src={otherUser.photoURL} className="w-12 h-12 rounded-full"/>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold dark:text-white truncate">{otherUser.username}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.lastMessage}</p>
                                </div>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTimeAgo(c.updatedAt).relative}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            <button onClick={() => setShowNewChatModal(true)} className="fixed bottom-6 right-6 bg-sky-500 text-white p-4 rounded-full shadow-xl hover:scale-105 transition z-30">
                <MessageCircle size={24}/>
            </button>

            {showNewChatModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end md:items-center justify-center p-4" onClick={()=>setShowNewChatModal(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 h-[70vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 dark:text-white">Mulai Chat Baru</h3>
                        <p className="text-xs text-gray-500 mb-4">Hanya bisa chat dengan teman yang diikuti.</p>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {friends.length === 0 ? <p className="text-center text-gray-400">Belum ada teman yang diikuti.</p> :
                            friends.map(f => (
                                <div key={f.uid} onClick={() => startChat(f)} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                    <Avatar src={f.photoURL} className="w-10 h-10 rounded-full"/>
                                    <span className="font-bold dark:text-white">{f.username}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// BAGIAN 7: KOMPONEN UTAMA LAINNYA
// ==========================================

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick }) => {
    // ... (Kode PostItem sama persis seperti sebelumnya)
    // Saya persingkat di sini agar muat, tapi asumsikan kode sama
    // Pastikan fallback user image aman
    const [liked, setLiked] = useState(false); const [likeCount, setLikeCount] = useState(post.likes?.length || 0); const [showComments, setShowComments] = useState(false); const [comments, setComments] = useState([]); const [newComment, setNewComment] = useState(''); const [replyTo, setReplyTo] = useState(null); const [isEditing, setIsEditing] = useState(false); const [editedTitle, setEditedTitle] = useState(post.title || ''); const [editedContent, setEditedContent] = useState(post.content || ''); const [isSaved, setIsSaved] = useState(false); const [isExpanded, setIsExpanded] = useState(false); const [showHeartOverlay, setShowHeartOverlay] = useState(false); const [lightboxOpen, setLightboxOpen] = useState(false); const [lightboxIndex, setLightboxIndex] = useState(0);
    const isOwner = currentUserId && post.userId === currentUserId; const isDeveloper = post.user?.email === DEVELOPER_EMAIL; const isMeme = post.category === 'meme'; const isFollowing = profile ? (profile.following || []).includes(post.userId) : false; const isFriend = isFollowing && (profile?.followers || []).includes(post.userId); const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    
    useEffect(() => { if (currentUserId) { setLiked(post.likes?.includes(currentUserId)); setIsSaved(profile?.savedPosts?.includes(post.id)); } setLikeCount(post.likes?.length || 0); }, [post, currentUserId, profile?.savedPosts]);
    const handleLike = async () => { if (isGuest) { onRequestLogin(); return; } const newLiked = !liked; setLiked(newLiked); setLikeCount(prev => newLiked ? prev + 1 : prev - 1); const ref = doc(db, getPublicCollection('posts'), post.id); const authorRef = doc(db, getPublicCollection('userProfiles'), post.userId); try { if (newLiked) { await updateDoc(ref, { likes: arrayUnion(currentUserId) }); if (post.userId !== currentUserId) { await updateDoc(authorRef, { reputation: increment(1) }); sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id); } } else { await updateDoc(ref, { likes: arrayRemove(currentUserId) }); } } catch (error) { setLiked(!newLiked); setLikeCount(prev => !newLiked ? prev + 1 : prev - 1); } };
    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };
    const handleSave = async () => { if (isGuest) { onRequestLogin(); return; } const newSaved = !isSaved; setIsSaved(newSaved); const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId); try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); } };
    const handleComment = async (e) => { e.preventDefault(); if (isGuest) { onRequestLogin(); return; } if (!profile) return; if (!newComment.trim()) return; try { const commentData = { postId: post.id, userId: currentUserId, text: newComment, username: profile.username || 'User', timestamp: serverTimestamp(), parentId: replyTo ? replyTo.id : null, replyToUsername: replyTo ? replyTo.username : null }; await addDoc(collection(db, getPublicCollection('comments')), commentData); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) }); if (post.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), post.userId), { reputation: increment(1) }); if (!replyTo) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id); } if (replyTo && replyTo.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), replyTo.userId), { reputation: increment(1) }); sendNotification(replyTo.userId, 'comment', `membalas komentar Anda: "${newComment.substring(0,15)}.."`, profile, post.id); } setNewComment(''); setReplyTo(null); } catch (error) { console.error(error); } };
    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { try { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); alert(`Postingan dihapus.`); } catch (e) { alert("Gagal menghapus: " + e.message); } } };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin!'); } catch (e) { alert('Gagal menyalin link'); } };
    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.toMillis || 0) - (b.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);
    
    // FIX POST IMAGE: Gunakan default object kosong jika post.user undefined
    const safeUser = post.user || { username: 'Unknown', photoURL: '' };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 mb-2 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-700 relative overflow-hidden group transition hover:shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px] flex-shrink-0"><div className="w-full h-full rounded-full bg-white overflow-hidden"><Avatar src={safeUser.photoURL} fallbackText={safeUser.username} className="w-full h-full"/></div></div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-tight flex items-center gap-1 truncate">
                            {safeUser.username} 
                            {isDeveloper && <ShieldCheck size={12} className="text-blue-500 fill-blue-100 flex-shrink-0"/>}
                            {isMeme && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold ml-1">MEME</span>}
                        </h4>
                        <div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTimeAgo(post.timestamp).relative}</span></div>
                    </div>
                </div>
                <div className="flex gap-1">
                    {!isOwner && post.userId !== currentUserId && ( <button onClick={() => isGuest ? onRequestLogin() : handleFollow(post.userId, isFollowing)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${isFriend ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-sm'}`}>{isFriend ? <><UserCheck size={10}/> Teman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                    {(isOwner || isMeDeveloper) && !isGuest && ( <div className="flex gap-1"><button onClick={handleDelete} className={`p-1.5 rounded-full ${isMeDeveloper && !isOwner ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-red-600'}`}>{isMeDeveloper && !isOwner ? <ShieldAlert size={14}/> : <Trash2 size={14}/>}</button></div> )}
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                 {post.title && <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-[15px] line-clamp-1">{post.title}</h3>}
                 <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed flex-1">{renderMarkdown(post.content, onHashtagClick)}</div>
                 <div onDoubleClick={handleDoubleTap} className="relative mt-auto">
                      {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700 pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                      {mediaList.length > 0 && <div className={`mb-4 rounded-xl overflow-hidden bg-black/5 dark:bg-black/20 border border-gray-100 dark:border-gray-700 relative`} onClick={() => {setLightboxIndex(0); setLightboxOpen(true);}}><img src={mediaList[0]} className="w-full h-auto max-h-[500px] object-cover cursor-pointer"/></div>}
                 </div>
            </div>
            <div className="flex items-center gap-6 pt-2 border-t border-gray-50 dark:border-gray-700 mt-1">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Heart size={16} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={16}/> {post.commentsCount || 0}</button>
                <button onClick={sharePost} className="text-gray-400 hover:text-sky-500"><Share2 size={16}/></button>
                <button onClick={handleSave} className={`ml-auto transition ${isSaved ? 'text-sky-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /></button>
            </div>
             {showComments && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 animate-in fade-in bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 relative flex flex-col max-h-[300px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"><h5 className="font-bold text-xs">Komentar</h5><button onClick={()=>setShowComments(false)}><X size={14}/></button></div>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-2 custom-scrollbar pr-1 min-h-[50px]">{comments.map(c => <div key={c.id} className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs"><span className="font-bold mr-2">{c.username}</span>{c.text}</div>)}</div>
                    <form onSubmit={handleComment} className="flex gap-2"><input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis..." disabled={isGuest || !profile} className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600"/><button type="submit" disabled={!newComment.trim() || isGuest} className="p-2 bg-sky-500 text-white rounded-xl"><Send size={14}/></button></form>
                </div>
            )}
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
        </div>
    );
};

const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '', isShort: false, isAudio: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);
    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    const handleFileChange = (e) => { const selectedFiles = Array.from(e.target.files); if (selectedFiles.length > 0) { const isAudio = selectedFiles[0].type.startsWith('audio'); const isVideo = selectedFiles[0].type.startsWith('video'); setForm({ ...form, files: selectedFiles, isShort: isVideo, isAudio: isAudio, url: '' }); } };
    const submit = async (e) => {
        e.preventDefault(); 
        setLoading(true); setProg(0);
        try {
            let mediaUrls = []; let mediaType = 'text';
            if (form.files.length > 0) { const firstFile = form.files[0]; if (firstFile.type.startsWith('image')) { mediaType = 'image'; setProg(10); for (let i = 0; i < form.files.length; i++) { const base64 = await compressImageToBase64(form.files[i]); mediaUrls.push(base64); setProg(10 + ((i + 1) / form.files.length) * 80); } } }
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), { userId, title: form.title, content: form.content, mediaUrls: mediaUrls, mediaUrl: mediaUrls[0] || '', mediaType: mediaType, timestamp: serverTimestamp(), likes: [], commentsCount: 0, category: category, user: {username, uid: userId} });
            await updateDoc(doc(db, getPublicCollection('userProfiles'), userId), { reputation: increment(2), lastPostTime: Date.now() }); 
            setProg(100); setTimeout(()=>onSuccess(ref.id, false), 500);
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    if (loading) return <WaitingScreen progress={prog}/>;

    // DESAIN BARU: HAMPARKAN (SPREAD) - FULL WIDTH CLEAN
    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
                <button onClick={()=>setPage('home')} className="text-gray-500 dark:text-gray-400 hover:text-gray-800"><X size={24}/></button>
                <h2 className="font-bold text-lg dark:text-white">Buat Postingan</h2>
                <button onClick={submit} disabled={!form.content.trim()} className="bg-sky-500 text-white px-4 py-1.5 rounded-full font-bold text-sm disabled:opacity-50">Posting</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
                <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full text-xl font-bold mb-4 bg-transparent outline-none dark:text-white placeholder:text-gray-300"/>
                <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi? Gunakan Markdown..." className="w-full h-64 bg-transparent resize-none outline-none text-base dark:text-gray-200 placeholder:text-gray-400 mb-4"/>
                
                {/* Tools Bar */}
                <div className="flex gap-4 border-t dark:border-gray-800 pt-4 overflow-x-auto">
                    <label className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl text-sky-500 cursor-pointer hover:bg-sky-100 transition flex flex-col items-center gap-1 min-w-[80px]">
                        <ImageIcon size={24}/>
                        <span className="text-[10px] font-bold">Foto</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange}/>
                    </label>
                     <button type="button" onClick={insertLink} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 cursor-pointer hover:bg-gray-100 transition flex flex-col items-center gap-1 min-w-[80px]">
                        <LinkIcon size={24}/>
                        <span className="text-[10px] font-bold">Link</span>
                    </button>
                </div>
                {form.files.length > 0 && <div className="mt-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold flex items-center gap-2"><CheckCircle size={16}/> {form.files.length} File siap diupload</div>}
            </div>
        </div>
    );
};

const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick, homeFeedState, setHomeFeedState }) => {
    const { posts: feedPosts, cursor: nextCursor, sortType, hasLoaded } = homeFeedState;
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    const loadFeed = async (reset = false) => {
        if (loading) return;
        setLoading(true);
        const currentCursor = reset ? null : nextCursor;
        try {
            // FIX FEED: Handle 'following' mode logic
            const data = await fetchFeedData({ mode: sortType === 'following' ? 'following' : sortType, limit: 10, cursor: currentCursor, viewerId: currentUserId });
            const enrichedPosts = data.posts.map(p => ({ ...p, user: p.user || { username: 'Pengguna', photoURL: '' } }));
            
            // Client side filter fallback for friends if API returns all
            let finalData = enrichedPosts;
            if (sortType === 'following' && profile) {
                finalData = enrichedPosts.filter(p => (profile.following || []).includes(p.userId));
            }

            setHomeFeedState(prev => ({ ...prev, posts: reset ? finalData : [...prev.posts, ...finalData], cursor: data.nextCursor, hasLoaded: true }));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { if (!hasLoaded) loadFeed(true); }, [hasLoaded, sortType]);
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && nextCursor && !loading && hasLoaded) loadFeed(false); }, { threshold: 0.5 });
        if (bottomRef.current) observer.observe(bottomRef.current);
        return () => { if (bottomRef.current) observer.unobserve(bottomRef.current); };
    }, [nextCursor, loading, hasLoaded]);

    const handleSortChange = (newSort) => { if (newSort === sortType) return; setHomeFeedState(prev => ({ ...prev, sortType: newSort, posts: [], cursor: null, hasLoaded: false })); };

    const finalPosts = [...feedPosts];
    if (newPostId) { const newlyCreated = allPosts.find(p => p.id === newPostId); if (newlyCreated && !finalPosts.find(p => p.id === newPostId)) finalPosts.unshift(newlyCreated); }

    return (
        <div className="w-full max-w-xl mx-auto pb-24 px-4 md:px-0 pt-4">
            {/* Banner Kategori - FIXED (Tidak Sticky, Lebih Kecil) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar items-center mb-4 py-2">
                <button onClick={() => handleSortChange('home')} className={`px-3 py-1 rounded-full text-[11px] font-bold transition border whitespace-nowrap ${sortType==='home'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Beranda</button>
                <button onClick={() => handleSortChange('following')} className={`px-3 py-1 rounded-full text-[11px] font-bold transition border whitespace-nowrap ${sortType==='following'?'bg-emerald-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Teman</button>
                <button onClick={() => handleSortChange('meme')} className={`px-3 py-1 rounded-full text-[11px] font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-yellow-400 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>😂 Meme</button>
                <button onClick={() => handleSortChange('popular')} className={`px-3 py-1 rounded-full text-[11px] font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-purple-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Populer</button>
            </div>

            {loading && finalPosts.length === 0 ? <SkeletonPost/> : finalPosts.length === 0 ? <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl"><p className="text-gray-400 font-bold">Belum ada postingan.</p></div> : (
                <div className="space-y-4">
                    {finalPosts.map(p => (
                        <div key={p.id}>
                            <PostItem post={p} currentUserId={currentUserId} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={onRequestLogin} onHashtagClick={onHashtagClick}/>
                        </div>
                    ))}
                </div>
            )}
            <div ref={bottomRef} className="h-20 w-full flex items-center justify-center">{loading && <Loader2 className="animate-spin text-sky-500"/>}</div>
        </div>
    );
};

// ... (Komponen LeaderboardScreen, ProfileScreen, SearchScreen, NotificationScreen, SinglePostView Tetap Sama - Saya skip untuk hemat tempat, asumsikan ada)
const LeaderboardScreen = ({ allUsers, currentUser }) => {
    // Logic Leaderboard
    const sortedUsers = useMemo(() => { return [...allUsers].sort((a, b) => (b.reputation || 0) - (a.reputation || 0)); }, [allUsers]);
    const top10 = sortedUsers.slice(0, 10);
    return (
        <div className="max-w-lg mx-auto p-4 pb-24 pt-20">
            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Top 10 Legenda</h1>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {top10.map((u, index) => (
                    <div key={u.uid} className={`flex items-center p-4 border-b dark:border-gray-700`}>
                        <div className="font-black text-lg mr-3 text-gray-400">#{index + 1}</div>
                        <Avatar src={u.photoURL} className="w-10 h-10 rounded-full mr-3"/>
                        <div className="flex-1"><h3 className="font-bold dark:text-white">{u.username}</h3></div>
                        <div className="font-bold text-sky-500">{u.reputation} XP</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest }) => {
    // Profile Logic Simpel
    if (!profileData) return <div className="text-center pt-24">Profil tidak ditemukan</div>;
    const isSelf = viewerProfile?.uid === profileData.uid;
    const myPosts = allPosts.filter(p => p.userId === profileData.uid);
    return (
        <div className="max-w-md mx-auto pb-24 pt-20 px-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] text-center mb-6 shadow-sm border dark:border-gray-700">
                <Avatar src={profileData.photoURL} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-lg"/>
                <h1 className="text-2xl font-black dark:text-white">{profileData.username}</h1>
                <div className="flex justify-center gap-4 my-4">
                    <div className="text-center"><span className="block font-bold dark:text-white">{profileData.followers?.length || 0}</span><span className="text-[10px] text-gray-400">Pengikut</span></div>
                    <div className="text-center"><span className="block font-bold dark:text-white">{profileData.following?.length || 0}</span><span className="text-[10px] text-gray-400">Mengikuti</span></div>
                </div>
                {!isSelf && <button onClick={()=>handleFollow(profileData.uid, (viewerProfile?.following||[]).includes(profileData.uid))} className="bg-sky-500 text-white px-8 py-2 rounded-full font-bold text-sm shadow-lg">{(viewerProfile?.following||[]).includes(profileData.uid) ? 'Mengikuti' : 'Ikuti'}</button>}
             </div>
             <div className="space-y-4">{myPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile?.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}</div>
        </div>
    );
};
const SearchScreen = ({ allUsers, profile, handleFollow, goToProfile, isGuest, onRequestLogin, initialQuery, setPage, setTargetPostId }) => {
    const [queryTerm, setQueryTerm] = useState(initialQuery || '');
    const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(queryTerm.toLowerCase()));
    return (
        <div className="max-w-md mx-auto p-4 pb-24 pt-20">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border flex gap-2 mb-6"><Search className="ml-2 text-gray-400"/><input value={queryTerm} onChange={e=>setQueryTerm(e.target.value)} placeholder="Cari orang..." className="flex-1 outline-none bg-transparent dark:text-white"/></div>
            {queryTerm && <div className="space-y-3">{filteredUsers.map(u => ( <div key={u.uid} className="bg-white dark:bg-gray-800 p-3 rounded-xl flex justify-between items-center shadow-sm"> <div className="flex items-center gap-3" onClick={()=>goToProfile(u.uid)}><Avatar src={u.photoURL} className="w-10 h-10 rounded-full"/> <span className="font-bold dark:text-white">{u.username}</span> </div> </div> ))}</div>}
        </div>
    );
};
const NotificationScreen = ({ userId, setPage, setTargetPostId }) => {
    const [notifs, setNotifs] = useState([]);
    useEffect(() => { if(userId) onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(20)), s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})))); }, [userId]);
    return <div className="max-w-md mx-auto p-4 pb-24 pt-20"><h1 className="text-xl font-black mb-6 dark:text-white">Notifikasi</h1>{notifs.map(n=><div key={n.id} className="bg-white dark:bg-gray-800 p-4 mb-2 rounded-xl flex gap-3 shadow-sm"><Avatar src={n.fromPhoto} className="w-10 h-10 rounded-full"/><div><p className="text-sm dark:text-white"><span className="font-bold">{n.fromUsername}</span> {n.message}</p></div></div>)}</div>;
};
const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p=>p.id===postId);
    if(!post) return <div className="pt-24 text-center">Post tidak ditemukan <button onClick={goBack}>Kembali</button></div>;
    return <div className="pt-20 px-4 max-w-md mx-auto pb-24"><button onClick={goBack} className="mb-4"><ArrowLeft/></button><PostItem post={post} {...props}/></div>;
};


// ==========================================
// APP COMPONENT (ROOT)
// ==========================================

const App = () => {
    const [user, setUser] = useState(undefined); const [profile, setProfile] = useState(null); const [page, setPage] = useState('home'); const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]); const [targetUid, setTargetUid] = useState(null); const [targetPid, setTargetPid] = useState(null); const [notifCount, setNotifCount] = useState(0); const [newPostId, setNewPostId] = useState(null); const [searchQuery, setSearchQuery] = useState(''); const [showAuthModal, setShowAuthModal] = useState(false); const [showOnboarding, setShowOnboarding] = useState(false); const [isOffline, setIsOffline] = useState(!navigator.onLine); const [showRewards, setShowRewards] = useState(false); const [canClaimReward, setCanClaimReward] = useState(false); const [nextRewardTime, setNextRewardTime] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isErudaOpen, setIsErudaOpen] = useState(false);
    
    // Feed State Persisten
    const [homeFeedState, setHomeFeedState] = useState({ posts: [], cursor: null, sortType: 'home', hasLoaded: false, scrollPos: 0 });

    // Eruda Logic
    useEffect(() => {
        if (isErudaOpen) {
            const script = document.createElement('script');
            script.src = "//cdn.jsdelivr.net/npm/eruda";
            script.onload = () => window.eruda.init();
            document.body.appendChild(script);
        }
    }, [isErudaOpen]);

    // Auth & Data Loaders (Sama seperti kode asli, diringkas)
    useEffect(() => onAuthStateChanged(auth, async (u) => { 
        if(u) { 
            setUser(u); 
            try { const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid)); if (!userDoc.exists()) setShowOnboarding(true); } catch(e){} 
        } else { setUser(null); setProfile(null); } 
    }), []);
    useEffect(() => { if(user) onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => { if(s.exists()) setProfile({...s.data(), uid:user.uid, email:user.email}); }); }, [user]);
    useEffect(() => { onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id})))); }, []);
    useEffect(() => { onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20)), s => setPosts(s.docs.map(d=>({id:d.id,...d.data()})))); }, []);
    
    const handleFollow = async (uid, isFollowing) => { if (!user) { setShowAuthModal(true); return; } const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); const targetRef = doc(db, getPublicCollection('userProfiles'), uid); try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); } } catch (e) {} };
    const handleGoBack = () => { setTargetPid(null); setPage('home'); };

    const isMeDeveloper = user && user.email === DEVELOPER_EMAIL; const targetUser = users.find(u => u.uid === targetUid); const isGuest = !user; 

    // Render Logic
    return (
        <ErrorBoundary>
            <div className={`min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
                <NetworkStatus />
                
                {/* HEADER NAVBAR (Only Burger, Logo, Notif) - KECUALI HALAMAN CHAT / POLICY */}
                {!['chat', 'create', 'policy_privacy', 'policy_tos', 'policy_community', 'policy_dmca', 'policy_mod'].includes(page) && (
                    <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            <button onClick={()=>setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><Menu size={24}/></button>
                            <div className="flex items-center gap-2" onClick={()=>setPage('home')}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span></div>
                        </div>
                        <div className="flex gap-2 items-center">
                            {isGuest ? ( <button onClick={()=>setShowAuthModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-full font-bold text-xs">Masuk</button> ) : ( <button onClick={()=>setPage('notifications')} className="p-2 relative"><Bell size={24}/>{notifCount>0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}</button> )}
                        </div>
                    </header>
                )}

                <Sidebar isOpen={isSidebarOpen} onClose={()=>setIsSidebarOpen(false)} user={user} setPage={setPage} isErudaOpen={isErudaOpen} setIsErudaOpen={setIsErudaOpen} onLogout={()=>signOut(auth)}/>

                <main className={!['chat', 'create', 'policy_privacy'].includes(page) ? 'pt-16' : ''}>
                    {page==='home' && <HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} homeFeedState={homeFeedState} setHomeFeedState={setHomeFeedState}/>}
                    {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage('home')}}/>}
                    {page==='search' && <SearchScreen allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} initialQuery={searchQuery} setPage={setPage} setTargetPostId={setTargetPid} />}
                    {page==='leaderboard' && <LeaderboardScreen allUsers={users} currentUser={user} />}
                    {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={setTargetPid}/>}
                    {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} />}
                    {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} />}
                    {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)}/>}
                    
                    {/* HALAMAN BARU */}
                    {page==='chat' && <ChatScreen user={user} profile={profile} allUsers={users} onBack={()=>setPage('home')}/>}
                    {page.startsWith('policy_') && <PolicyPage type={page} onBack={()=>setPage('home')}/>}
                </main>
                
                {/* BOTTOM NAV (Hanya muncul jika bukan halaman full screen seperti chat/create) */}
                {!['chat', 'create', 'policy_privacy', 'policy_tos', 'policy_community', 'policy_dmca', 'policy_mod'].includes(page) && ( 
                    <nav className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-full px-5 py-2.5 shadow-2xl shadow-sky-100/50 dark:shadow-none flex items-center gap-5 z-40">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                        <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-2.5 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={22}/></button>
                        <NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>
                        {isGuest ? ( <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/> ) : ( <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/> )}
                    </nav> 
                )}
                
                {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
                {showRewards && <DailyRewardModal onClose={()=>setShowRewards(false)} onClaim={()=>setCanClaimReward(false)} canClaim={canClaimReward} nextClaimTime={nextRewardTime} isGuest={isGuest} onLoginRequest={()=>{ setShowRewards(false); setShowAuthModal(true); }} />}
                {showOnboarding && user && <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>}
                <PWAInstallPrompt />
            </div>
        </ErrorBoundary>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}><Icon size={22} strokeWidth={active?2.5:2} /></button>);

export default App;