import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect
} from "react";

// HAPUS IMPORT EXTERNAL YANG MENYEBABKAN BLANK SCREEN
// import DOMPurify from "dompurify"; 
// GANTI DENGAN IMPLEMENTASI LOKAL:
const DOMPurify = {
    sanitize: (html) => {
        if (!html) return "";
        // Basic sanitization untuk mencegah XSS sederhana tanpa library berat
        return html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/on\w+="[^"]*"/g, "")
            .replace(/javascript:/gi, "");
    }
};

// ==========================================
// FIREBASE IMPORT
// ==========================================
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInAnonymously // TAMBAHAN: Penting untuk akses database tanpa login
} from "firebase/auth";

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
  getDocs
} from "firebase/firestore";

// NOTIFICATION
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// ICONS
import {
  LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon,
  Loader2, Link as LinkIcon, ListOrdered, Shuffle, Code, Calendar,
  Lock, Mail, UserPlus, LogIn, AlertCircle, Edit, Trash2, X, Check,
  Save, PlusCircle, Search, UserCheck, ChevronRight, Share2, Film,
  TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
  RefreshCw, Info, Clock, Star, ExternalLink, Gamepad2, BookOpen,
  Users, Globe, CheckCircle, Sparkles, Zap, ShieldCheck,
  MoreHorizontal, ShieldAlert, Trash, BarChart3, Activity, Gift, Eye,
  RotateCw, Megaphone, Trophy, Laugh, Moon, Sun, Award, Crown, Gem,
  Medal, Bookmark, Coffee, Smile, Frown, Meh, CloudRain, SunMedium,
  Hash, Tag, Wifi, Smartphone, Radio, ImageOff, Music, Mic, Play,
  Pause, Volume2, Minimize2, Scale, FileText, ChevronLeft,
  CornerDownRight, Reply, Ban, UserX, WifiOff, Signal, Gift as GiftIcon,
  Bug, ArrowUp, Move, ChevronDown, ChevronUp, MinusCircle,
  RefreshCcw, LayoutGrid, TimerReset, WifiHigh, Menu, MessagesSquare,
  MoreVertical, Copy, ArrowRight
} from "lucide-react";

setLogLevel("silent");

// ==========================================
// ERROR BOUNDARY
// ==========================================
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
            <h2 className="text-2xl font-black text-gray-800 mb-2">
              Terjadi Kesalahan
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Aplikasi mengalami crash.
            </p>
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

// ==========================================
// KONFIGURASI GLOBAL
// ==========================================
// FIX: Fallback values jika process.env undefined
const getEnv = (key, fallback) => (typeof process !== 'undefined' && process.env && process.env[key]) ? process.env[key] : fallback;

const DEVELOPER_EMAIL = getEnv('REACT_APP_DEV_EMAIL', "admin@bgunenet.com");
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i150/VrL65.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";

const API_ENDPOINT = "/api/feed";

// FIX: FIREBASE CONFIG AUTO DETECT
// Menggunakan __firebase_config dari environment canvas jika tersedia
let firebaseConfig;
try {
    firebaseConfig = typeof __firebase_config !== 'undefined' 
        ? JSON.parse(__firebase_config) 
        : {
            // Fallback ke process.env atau dummy agar tidak crash saat init
            apiKey: getEnv('REACT_APP_FIREBASE_API_KEY', "dummy-key"),
            authDomain: "eduku-web.firebaseapp.com",
            projectId: "eduku-web",
            storageBucket: "eduku-web.firebasestorage.com",
            messagingSenderId: "662463693471",
            appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
            measurementId: "G-G0VWNHHVB8"
        };
} catch (e) {
    console.error("Config parsing error", e);
    firebaseConfig = {};
}

const API_KEY = getEnv('REACT_APP_API_KEY', "dummy-api-key");
const VAPID_KEY = getEnv('REACT_APP_VAPID_KEY', "dummy-vapid-key");

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

const getPublicCollection = (collectionName) =>
  `artifacts/${appId}/public/data/${collectionName}`;

// ==========================================
// FIREBASE INIT
// ==========================================
let app, auth, db, googleProvider, messaging;

try {
  // Pastikan config valid
  if (firebaseConfig && firebaseConfig.apiKey) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      googleProvider = new GoogleAuthProvider();

      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          messaging = getMessaging(app);
        } catch (e) {
          console.warn("FCM tidak tersedia di environment ini (wajar):", e);
        }
      }
  } else {
      console.warn("Firebase config missing or invalid.");
  }
} catch (error) {
  console.error("Firebase init error:", error);
}



// ==================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

// Custom Hook untuk Dynamic Meta Tags (SEO & Share)
const usePageTitle = (title, description = "", image = "") => {
    useEffect(() => {
        const prevTitle = document.title;
        document.title = title ? `${title} - ${APP_NAME}` : APP_NAME;

        // Update Meta Tags Dinamis
        const updateMeta = (name, content, attribute = 'name') => {
            if (!content) return;
            let tag = document.querySelector(`meta[${attribute}="${name}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute(attribute, name);
                document.head.appendChild(tag);
            }
            tag.setAttribute('content', content);
        };

        if (title) {
            updateMeta('title', title);
            updateMeta('og:title', title, 'property');
            updateMeta('twitter:title', title);
        }
        if (description) {
            updateMeta('description', description);
            updateMeta('og:description', description, 'property');
            updateMeta('twitter:description', description);
        }
        if (image) {
            updateMeta('og:image', image, 'property');
            updateMeta('twitter:image', image);
        }
        
        // Tambahan Standar OG Tags untuk WhatsApp
        updateMeta('og:type', 'website', 'property');
        updateMeta('og:site_name', APP_NAME, 'property');
        updateMeta('og:url', window.location.href, 'property');

        return () => {
            document.title = prevTitle;
        };
    }, [title, description, image]);
};

// URL Helper untuk mengupdate link tanpa reload
const updateUrl = (params) => {
    try {
        const url = new URL(window.location);
        // Hapus parameter lama agar bersih
        url.searchParams.delete('post');
        url.searchParams.delete('user');
        url.searchParams.delete('q');
        
        // Set parameter baru
        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.set(key, params[key]);
        });
        
        window.history.pushState({}, '', url);
    } catch (e) {
        // Fallback untuk environment yg membatasi history API
    }
};

const fetchFeedData = async ({ mode = 'home', limit = 10, cursor = null, viewerId = null, userId = null, q = null }) => {
    // FIX: Gunakan fallback jika API external gagal/blocked CORS
    try {
        const params = new URLSearchParams();
        params.append('mode', mode);
        params.append('limit', limit);
        if (cursor) params.append('cursor', cursor);
        if (viewerId) params.append('viewerId', viewerId);
        if (userId) params.append('userId', userId);
        if (q) params.append('q', q);

        const url = `${API_ENDPOINT}?${params.toString()}`;
        
        // Cek jika API_KEY valid, jika dummy skip fetch
        if (API_KEY === "dummy-api-key") throw new Error("API Key not configured");

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY, 
            },
        });
        if (!response.ok) throw new Error("Gagal mengambil data dari server.");
        
        // PERBAIKAN CRITICAL: Mencegah 'Unexpected token <'
        const textData = await response.text();
        let data;
        try {
            data = JSON.parse(textData);
        } catch (parseError) {
            // Jika gagal parse JSON (misal server balikin HTML 404), throw error agar masuk catch blok bawah
            throw new Error("Invalid JSON response (HTML received)");
        }

        return { 
            posts: data.posts || [], 
            nextCursor: data.nextCursor
        };
    } catch (error) {
        console.warn("API Fetch Error (Using Local Fallback):", error);
        // Fallback: Kembalikan array kosong agar UI tidak crash, biarkan Firestore cache bekerja jika ada
        return { posts: [], nextCursor: null };
    }
};

// SECURITY: Enkripsi Log / Sanitasi Informasi Sensitif
const logSystemError = async (error, context = 'general', user = null) => {
    try {
        if (!db) return;
        if (error.message && (error.message.includes('offline') || error.message.includes('network'))) return;
        
        const safeUsername = user ? (user.displayName || user.username || 'Guest') : 'Guest';
        const safeUid = user ? (user.uid || 'guest') : 'guest';
        
        // Sanitasi pesan error dari info sensitif (email, password, token)
        let cleanMessage = error.message || String(error);
        cleanMessage = cleanMessage.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
        cleanMessage = cleanMessage.replace(/(password|token|key)=[^&]+/gi, '$1=[REDACTED]');

        await addDoc(collection(db, getPublicCollection('systemLogs')), {
            message: cleanMessage, 
            stack: error.stack || '', 
            context: context, 
            userId: safeUid, 
            username: safeUsername, 
            timestamp: serverTimestamp(), 
            userAgent: navigator.userAgent
        });
    } catch (e) {}
};

const requestNotificationPermission = async (userId) => {
    if (!messaging || !userId || !db) return;
    try {
        if (Notification.permission === 'granted') {
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                const userRef = doc(db, getPublicCollection('userProfiles'), userId);
                await updateDoc(userRef, { fcmTokens: arrayUnion(token), lastTokenUpdate: serverTimestamp() });
            }
        } else if (Notification.permission !== 'denied') {
             // Request only if not denied
             const permission = await Notification.requestPermission();
             if (permission === 'granted') {
                 // Retry logic inside
             }
        }
    } catch (error) { console.warn("Notifikasi skip:", error); }
};

// OPTIMASI DATA: Kompresi Gambar Lebih Efisien
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // PENGHEMATAN DATA: Kurangi resolusi maksimal dari 600 ke 480
                const MAX_WIDTH = 480; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // PENGHEMATAN DATA: Kualitas dikurangi dari 0.5 ke 0.35 (cukup untuk layar HP)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.35);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const uploadToFaaAPI = async (file, onProgress) => {
    // MOCK UPLOAD karena CORS mungkin memblokir API external
    // Kita simulasi progress dan kembalikan base64
    onProgress(10);
    
    // Coba upload beneran dulu
    try {
        const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
        const formData = new FormData();
        formData.append('file', file); 
        
        const progressInterval = setInterval(() => { onProgress(prev => Math.min(prev + 5, 90)); }, 500);
        
        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        clearInterval(progressInterval);
        
        if (response.ok) {
            const data = await response.json();
            onProgress(100);
            if (data && data.result && data.result.url) return data.result.url;
            if (data && data.url) return data.url;
        }
        throw new Error("Upload Failed");
    } catch (e) {
        console.warn("Upload API failed, falling back to base64", e);
        // Fallback ke local base64
        const res = await compressImageToBase64(file);
        onProgress(100);
        return res;
    }
};

const shuffleArray = (array) => {
    const newArray = [...array]; 
    let currentIndex = newArray.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
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
// BAGIAN 3: KOMPONEN UI KECIL & CUSTOM DIALOG
// ==========================================

// CUSTOM UI: Dialog Alert & Confirm yang Cantik
const CustomDialog = ({ isOpen, type, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-xs shadow-2xl scale-100 animate-in zoom-in-95 border border-gray-100 dark:border-gray-700">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${type === 'danger' ? 'bg-red-100 text-red-500' : 'bg-sky-100 text-sky-500'}`}>
                    {type === 'danger' ? <AlertCircle size={32}/> : <Info size={32}/>}
                </div>
                <h3 className="text-xl font-black text-center text-gray-800 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    {onCancel && (
                        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm">
                            Batal
                        </button>
                    )}
                    <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition text-sm ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200'}`}>
                        {type === 'danger' ? 'Ya, Hapus' : 'OK, Mengerti'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DraggableGift = ({ onClick, canClaim, nextClaimTime }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 70, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const btnRef = useRef(null);

    // FIX: Desktop Mouse Event Listeners untuk Dragging
    useEffect(() => {
        const handleWinMove = (e) => {
            if(isDragging) {
                e.preventDefault(); // Mencegah seleksi teks
                const newX = Math.min(Math.max(0, e.clientX - dragStartRef.current.x), window.innerWidth - 60);
                const newY = Math.min(Math.max(0, e.clientY - dragStartRef.current.y), window.innerHeight - 60);
                setPosition({ x: newX, y: newY });
            }
        };
        const handleWinUp = () => { if(isDragging) setIsDragging(false); };
        if (isDragging) {
             window.addEventListener('mousemove', handleWinMove);
             window.addEventListener('mouseup', handleWinUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleWinMove);
            window.removeEventListener('mouseup', handleWinUp);
        };
    }, [isDragging]);

    useEffect(() => { setPosition({ x: window.innerWidth - 70, y: window.innerHeight - 150 }); }, []);

    const handleStart = (clientX, clientY) => { setIsDragging(false); if(btnRef.current) { const rect = btnRef.current.getBoundingClientRect(); dragStartRef.current = { x: clientX - rect.left, y: clientY - rect.top }; } };
    const handleMove = (clientX, clientY) => { setIsDragging(true); const newX = Math.min(Math.max(0, clientX - dragStartRef.current.x), window.innerWidth - 60); const newY = Math.min(Math.max(0, clientY - dragStartRef.current.y), window.innerHeight - 60); setPosition({ x: newX, y: newY }); };
    const handleEnd = () => { setTimeout(() => setIsDragging(false), 100); };

    return (
        <div 
            ref={btnRef} 
            className="fixed z-[55] touch-none select-none cursor-move transition-shadow" 
            style={{ left: position.x, top: position.y }} 
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)} 
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)} 
            onTouchEnd={handleEnd} 
            onMouseDown={(e) => {
                e.preventDefault();
                handleStart(e.clientX, e.clientY);
                setIsDragging(true); // Langsung set dragging true untuk desktop
            }}
        >
            <button onClick={() => !isDragging && onClick()} className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2.5 rounded-full shadow-2xl shadow-orange-500/50 relative group active:scale-95 transition-transform">
                <GiftIcon size={24} className={`text-white ${canClaim ? 'animate-bounce' : ''}`}/>
                {canClaim && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
        </div>
    );
};

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

const DailyRewardModal = ({ onClose, onClaim, canClaim, nextClaimTime, isGuest, onLoginRequest }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-sky-100 dark:border-gray-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><GiftIcon size={40} className="text-yellow-600 dark:text-yellow-400"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Hujan Hadiah!</h2>
                {isGuest ? (
                    <>
                        <p className="text-gray-500 text-sm mb-6">Login sekarang untuk mengklaim reputasi gratis dan mulai mendaki Leaderboard!</p>
                        <button onClick={() => { onClose(); onLoginRequest(); }} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition flex items-center justify-center gap-2"><LogIn size={18}/> Login Untuk Klaim</button>
                    </>
                ) : (
                    <>
                        <p className="text-gray-500 text-sm mb-6">Login setiap hari untuk mendapatkan reputasi gratis dan jadilah Legend!</p>
                        {canClaim ? (
                            <button onClick={onClaim} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-105 transition flex items-center justify-center gap-2"><Sparkles size={18}/> Klaim Hadiah</button>
                        ) : (
                            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-300"><Clock size={16} className="inline mr-1 mb-0.5"/> Tunggu {nextClaimTime} lagi</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
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

const AudioPlayer = ({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const togglePlay = () => { if (audioRef.current) { if (isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); } };
    return (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-3 flex items-center gap-3 mb-4 shadow-md border border-gray-700">
            <button onClick={togglePlay} className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition">{isPlaying ? <Pause size={18} fill="white"/> : <Play size={18} fill="white" className="ml-1"/>}</button>
            <div className="flex-1"><div className="flex items-center gap-1 text-xs font-bold text-sky-400 mb-1"><Music size={12}/> Audio Clip</div><audio ref={audioRef} src={src} className="w-full h-6 opacity-80" controls onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}/></div>
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-gray-900 dark:to-black z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow"><img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/><div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div></div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Menghubungkan ke server...</p>
        <p className="text-gray-300 text-[10px] mt-2">Sinkronisasi Profile & Papan Peringkat...</p>
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

// SECURITY FIX: Gunakan DOMPurify lokal alih-alih external module
const renderMarkdown = (text, onHashtagClick) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    
    // Step 1: Escape dasar untuk karakter HTML berbahaya (Layer 1 Security)
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Step 2: Konversi Markdown ke HTML String
    
    // Link Protection: Anti Javascript/Data URI
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        if (/^(javascript|vbscript|data):/i.test(url)) return `${label} (Link Diblokir)`;
        return `<a href="${url}" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">${label} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`;
    });

    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { 
        if (match.includes('href="')) return match; 
        return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; 
    });

    // Formatting Markdown
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/`(.*?)`/g, '<code class="bg-sky-5 dark:bg-sky-900/30 px-1 rounded text-sm text-sky-700 dark:text-sky-400 font-mono border border-sky-100 dark:border-sky-800">$1</code>');
    
    // Hashtags
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline hashtag" data-tag="$1">#$1</span>');
    html = html.replace(/\n/g, '<br>');
    
    // Step 3: SANITASI AKHIR DENGAN DOMPurify Lokal
    const cleanHtml = DOMPurify.sanitize(html);

    return <div className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-[13px] md:text-sm" dangerouslySetInnerHTML={{ __html: cleanHtml }} onClick={(e) => { if (e.target.classList.contains('hashtag')) { e.stopPropagation(); if(onHashtagClick) onHashtagClick(e.target.getAttribute('data-tag')); } }}/>;
};

// ==========================================
// BAGIAN BARU: SIDEBAR & CHAT SYSTEM
// ==========================================

const Sidebar = ({ isOpen, onClose, user, onLogout, setPage }) => {
    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/60 z-[140] backdrop-blur-sm transition-opacity" onClick={onClose}></div>}
            <div className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 z-[150] shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-black text-sky-600 flex items-center gap-2"><Menu size={24}/> Menu</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                    {user ? (
                        <div className="mb-8 bg-sky-50 dark:bg-sky-900/20 p-4 rounded-2xl border border-sky-100 dark:border-sky-800">
                             <div className="flex items-center gap-3 mb-3">
                                 <Avatar src={user.photoURL} className="w-12 h-12 rounded-full border-2 border-white"/>
                                 <div>
                                     <p className="font-bold text-gray-800 dark:text-white truncate max-w-[140px]">{user.displayName || user.email}</p>
                                     <p className="text-xs text-sky-600 font-bold">Member Online</p>
                                 </div>
                             </div>
                             <button onClick={() => { setPage('profile'); onClose(); }} className="w-full bg-white dark:bg-gray-800 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-700">Lihat Profil Saya</button>
                        </div>
                    ) : (
                        <div className="mb-8 text-center">
                            <p className="text-sm text-gray-500 mb-4">Login untuk akses fitur penuh</p>
                            <button onClick={onLogout} className="bg-sky-500 text-white w-full py-3 rounded-xl font-bold">Login Sekarang</button>
                        </div>
                    )}

                    <div className="space-y-2">
                         <button onClick={() => { setPage('home'); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition"><Home size={18}/> Beranda</button>
                         {user && <button onClick={() => { setPage('chat_list'); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition"><MessagesSquare size={18} className="text-purple-500"/> Chat Room <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">New</span></button>}
                         <button onClick={() => { setPage('leaderboard'); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition"><Trophy size={18} className="text-yellow-500"/> Papan Peringkat</button>
                         <button onClick={() => { setPage('search'); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition"><Search size={18}/> Pencarian</button>
                         <div className="h-px bg-gray-100 dark:bg-gray-800 my-2"></div>
                         <button onClick={() => { setPage('legal'); onClose(); }} className="w-full text-left px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition"><Scale size={18}/> Kebijakan & Legal</button>
                    </div>
                </div>

                {user && (
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                        <button onClick={onLogout} className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition"><LogOut size={18}/> Keluar Aplikasi</button>
                    </div>
                )}
            </div>
        </>
    );
};

const ChatListScreen = ({ user, setPage, setChatId, profile }) => {
    // LAZY LOAD: Data loaded only when component mounts
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState([]);
    const [showNewChat, setShowNewChat] = useState(false);

    // Load Existing Chats
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('chats')), where('participants', 'array-contains', user.uid), orderBy('lastUpdated', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const loadedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChats(loadedChats);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    // Load Friends for New Chat
    useEffect(() => {
        if (showNewChat && profile && profile.following) {
             // Simple Logic: User can chat with people they follow (assuming friend logic is mutual follow)
             const fetchFriends = async () => {
                 const friendIds = profile.following.filter(id => (profile.followers || []).includes(id));
                 if (friendIds.length === 0) { setFriends([]); return; }
                 
                 // Firestore 'in' query limit is 10. For simplicity, we fetch mostly recently used or just chunks.
                 // For now, let's fetch individual docs for robustness or use 'in' if < 10
                 const friendsData = [];
                 // Fetch simple
                 for (const fid of friendIds.slice(0, 10)) {
                     const docSnap = await getDoc(doc(db, getPublicCollection('userProfiles'), fid));
                     if (docSnap.exists()) friendsData.push({id: docSnap.id, ...docSnap.data()});
                 }
                 setFriends(friendsData);
             };
             fetchFriends();
        }
    }, [showNewChat, profile]);

    const startChat = async (friendId, friendData) => {
        // Check if chat exists
        const chatId = [user.uid, friendId].sort().join('_');
        const chatRef = doc(db, getPublicCollection('chats'), chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (!chatSnap.exists()) {
             await setDoc(chatRef, {
                 participants: [user.uid, friendId],
                 participantsData: {
                     [user.uid]: { username: profile.username, photoURL: profile.photoURL },
                     [friendId]: { username: friendData.username, photoURL: friendData.photoURL }
                 },
                 lastMessage: 'Chat dimulai',
                 lastUpdated: serverTimestamp(),
                 typing: {}
             });
        }
        setChatId(chatId);
        setPage('chat_room');
    };

    const deleteChatHistory = async (e, chatId) => {
        e.stopPropagation();
        if(!confirm("Hapus riwayat chat ini? Pesan akan hilang untuk Anda.")) return;
        // In a real app, we would just hide it for this user. 
        // For this demo, we might delete the document if we are the owner, but let's just delete local reference logically or alert limitation.
        // Let's actually delete the doc for simplicity in this demo environment
        try {
             await deleteDoc(doc(db, getPublicCollection('chats'), chatId));
        } catch(e) { alert("Gagal hapus"); }
    };

    return (
        <div className="max-w-md md:max-w-xl mx-auto p-4 pt-20 pb-24 min-h-screen">
            <h1 className="text-2xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><MessagesSquare className="text-purple-500"/> Chat Saya</h1>
            
            {loading ? <div className="text-center py-10"><Loader2 className="animate-spin text-purple-500 mx-auto"/></div> : (
                <>
                    {chats.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                            <MessagesSquare size={48} className="text-gray-300 mx-auto mb-4"/>
                            <p className="text-gray-500 font-bold mb-4">Belum ada percakapan.</p>
                            <button onClick={()=>setShowNewChat(true)} className="bg-purple-500 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-purple-600 transition">Mulai Chat Baru</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {chats.map(chat => {
                                const otherId = chat.participants.find(id => id !== user.uid);
                                const otherData = chat.participantsData ? chat.participantsData[otherId] : { username: 'User' };
                                return (
                                    <div key={chat.id} onClick={() => { setChatId(chat.id); setPage('chat_room'); }} onContextMenu={(e) => {e.preventDefault(); deleteChatHistory(e, chat.id)}} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 cursor-pointer hover:bg-purple-50 dark:hover:bg-gray-700 transition relative overflow-hidden group">
                                         <Avatar src={otherData?.photoURL} className="w-12 h-12 rounded-full bg-gray-200"/>
                                         <div className="flex-1 min-w-0">
                                             <div className="flex justify-between items-center mb-1">
                                                 <h4 className="font-bold text-gray-800 dark:text-white truncate">{otherData?.username}</h4>
                                                 <span className="text-[10px] text-gray-400">{formatTimeAgo(chat.lastUpdated).relative}</span>
                                             </div>
                                             <p className="text-sm text-gray-500 truncate dark:text-gray-400">{chat.lastMessage}</p>
                                         </div>
                                         <button onClick={(e)=>deleteChatHistory(e, chat.id)} className="absolute right-4 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"><Trash2 size={16}/></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <button onClick={()=>setShowNewChat(true)} className="fixed bottom-24 right-6 bg-purple-600 text-white p-4 rounded-full shadow-2xl shadow-purple-400 hover:scale-110 transition z-50"><PlusCircle size={28}/></button>

            {showNewChat && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[160] flex items-end md:items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 h-[80vh] md:h-auto flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black dark:text-white">Pilih Teman</h3>
                            <button onClick={()=>setShowNewChat(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3">
                             {friends.length === 0 ? <p className="text-center text-gray-400 mt-10">Belum ada teman mutual (saling follow) untuk diajak chat.</p> : friends.map(f => (
                                 <div key={f.id} onClick={()=>startChat(f.id, f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition">
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

const ChatRoomScreen = ({ user, chatId, goBack }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [chatMeta, setChatMeta] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const dummyScroll = useRef(null);

    // Load Metadata & Messages
    useEffect(() => {
        const chatRef = doc(db, getPublicCollection('chats'), chatId);
        const unsubMeta = onSnapshot(chatRef, (s) => setChatMeta(s.data()));
        
        // Use subcollection for messages if possible, but for single file structure we might use top level with chatId
        // Let's use top level 'chat_messages' for simplicity
        const q = query(collection(db, getPublicCollection('chat_messages')), where('chatId', '==', chatId), orderBy('timestamp', 'asc'), limit(100));
        const unsubMsg = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
            setLoading(false);
            setTimeout(() => dummyScroll.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => { unsubMeta(); unsubMsg(); };
    }, [chatId]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if(!inputText.trim()) return;
        
        const text = inputText;
        setInputText('');
        setReplyTo(null);

        try {
            await addDoc(collection(db, getPublicCollection('chat_messages')), {
                chatId,
                senderId: user.uid,
                text,
                timestamp: serverTimestamp(),
                replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.senderName } : null,
                isRead: false
            });
            
            await updateDoc(doc(db, getPublicCollection('chats'), chatId), {
                lastMessage: text,
                lastUpdated: serverTimestamp()
            });
        } catch(e) { console.error(e); }
    };

    const handleCopy = (text) => { navigator.clipboard.writeText(text); alert("Pesan disalin"); };
    const handleDelete = async (msgId, senderId) => {
        if(senderId !== user.uid) return;
        if(confirm("Hapus pesan ini untuk semua orang?")) {
            await deleteDoc(doc(db, getPublicCollection('chat_messages'), msgId));
        }
    };

    if(loading) return <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900"><Loader2 className="animate-spin text-purple-500"/></div>;

    const otherUserId = chatMeta?.participants?.find(id => id !== user.uid);
    const otherUser = chatMeta?.participantsData ? chatMeta.participantsData[otherUserId] : { username: 'Chat' };

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 fixed inset-0 z-[120]">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 pt-10 md:pt-4">
                <button onClick={goBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><ArrowLeft/></button>
                <Avatar src={otherUser?.photoURL} className="w-10 h-10 rounded-full bg-gray-200"/>
                <div>
                    <h3 className="font-bold dark:text-white">{otherUser?.username}</h3>
                    <p className="text-[10px] text-green-500 font-bold flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5] dark:bg-[#1a1a1a]">
                {messages.map(msg => {
                    const isMe = msg.senderId === user.uid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div 
                                className={`max-w-[75%] p-3 rounded-xl relative group shadow-sm ${isMe ? 'bg-[#dcf8c6] dark:bg-emerald-900 text-gray-800 dark:text-gray-100 rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none'}`}
                                onContextMenu={(e)=>{e.preventDefault(); handleDelete(msg.id, msg.senderId);}}
                            >
                                {msg.replyTo && (
                                    <div className="bg-black/5 dark:bg-white/10 p-2 rounded-lg mb-2 text-xs border-l-4 border-purple-500">
                                        <p className="font-bold opacity-70 mb-0.5">{msg.replyTo.senderName}</p>
                                        <p className="truncate opacity-60">{msg.replyTo.text}</p>
                                    </div>
                                )}
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[9px] opacity-60">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                                    {isMe && <Check size={12} className="text-blue-500"/>}
                                </div>
                                
                                {/* Swipe Action Emulator (Long press/Hover menu) */}
                                <div className={`absolute top-0 ${isMe ? '-left-20' : '-right-20'} h-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition px-2`}>
                                     <button onClick={()=>setReplyTo({...msg, senderName: isMe ? 'Anda' : otherUser.username})} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full shadow"><Reply size={14}/></button>
                                     <button onClick={()=>handleCopy(msg.text)} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full shadow"><Copy size={14}/></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={dummyScroll}></div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                {replyTo && (
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-lg mb-2 text-xs border-l-4 border-purple-500 animate-in slide-in-from-bottom">
                        <div>
                            <span className="font-bold text-purple-600 dark:text-purple-400">Membalas {replyTo.senderName}</span>
                            <p className="text-gray-500 dark:text-gray-300 truncate max-w-xs">{replyTo.text}</p>
                        </div>
                        <button onClick={()=>setReplyTo(null)}><X size={16}/></button>
                    </div>
                )}
                <form onSubmit={sendMessage} className="flex gap-2 items-center">
                    <input 
                        value={inputText} 
                        onChange={e=>setInputText(e.target.value)} 
                        placeholder="Ketik pesan..." 
                        className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white px-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="p-3 bg-purple-500 text-white rounded-full shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100">
                        <Send size={18} className={inputText.trim() ? "translate-x-0.5" : ""}/>
                    </button>
                </form>
            </div>
        </div>
    );
};


// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER (Admin Only)
// ==========================================

const DeveloperDashboard = ({ onClose }) => {
    const [stats, setStats] = useState({ users: 0, posts: 0, postsToday: 0 });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [sendingBC, setSendingBC] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [allUsersList, setAllUsersList] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); 
    const [systemLogs, setSystemLogs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => { resolve(snap); unsub(); }); });
            const postsSnap = await new Promise(resolve => { const unsub = onSnapshot(query(collection(db, getPublicCollection('posts')), limit(1000)), (snap) => { resolve(snap); unsub(); }); });
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
        };
        fetchData();
        if (db) {
            const unsubLogs = onSnapshot(query(collection(db, getPublicCollection('systemLogs')), orderBy('timestamp', 'desc'), limit(50)), (snap) => { setSystemLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
            return () => unsubLogs();
        }
    }, []);

    const handleBroadcast = async () => { if(!broadcastMsg.trim()) return; if(!confirm("Kirim pengumuman ke SEMUA user?")) return; setSendingBC(true); try { const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => { resolve(s); unsub(); }); }); const promises = usersSnap.docs.map(docSnap => addDoc(collection(db, getPublicCollection('notifications')), { toUserId: docSnap.id, fromUserId: 'admin', fromUsername: 'Developer System', fromPhoto: APP_LOGO, type: 'system', message: `📢 PENGUMUMAN: ${broadcastMsg}`, isRead: false, timestamp: serverTimestamp() })); await Promise.all(promises); alert("Pengumuman berhasil dikirim!"); setBroadcastMsg(''); } catch(e) { alert("Gagal kirim broadcast: " + e.message); } finally { setSendingBC(false); } };
    const handleBanUser = async (uid, currentStatus) => { if(!confirm(currentStatus ? "Buka blokir user ini?" : "BLOKIR/BAN User ini?")) return; try { await updateDoc(doc(db, getPublicCollection('userProfiles'), uid), { isBanned: !currentStatus }); setAllUsersList(prev => prev.map(u => u.id === uid ? {...u, isBanned: !currentStatus} : u)); alert(currentStatus ? "User di-unban." : "User berhasil di-ban."); } catch(e) { alert("Gagal: " + e.message); } };
    const handleDeleteUser = async (uid) => { if(!confirm("⚠️ PERINGATAN: Hapus data user ini secara permanen?")) return; try { await deleteDoc(doc(db, getPublicCollection('userProfiles'), uid)); setAllUsersList(prev => prev.filter(u => u.id !== uid)); alert("Data user dihapus."); } catch(e) { alert("Gagal hapus: " + e.message); } };
    
    // MODIFIKASI: Sistem Reset dengan Notifikasi & MANUAL RESET ALL
    const handleUpdateReputation = async (uid, amount, isReset = false) => { 
        if(!confirm(isReset ? "Reset poin user ini jadi 0?" : `Kurangi poin user ini sebanyak ${amount}?`)) return; 
        try { 
            const updateData = isReset ? { reputation: 0 } : { reputation: increment(-amount) }; 
            await updateDoc(doc(db, getPublicCollection('userProfiles'), uid), updateData); 
            
            // Tambahkan notifikasi ke user saat di reset
            if (isReset) {
                await addDoc(collection(db, getPublicCollection('notifications')), { 
                    toUserId: uid, 
                    fromUserId: 'admin', 
                    fromUsername: 'System', 
                    fromPhoto: APP_LOGO, 
                    type: 'system', 
                    message: `⚠️ Point reputasi Anda telah direset oleh sistem/admin.`, 
                    isRead: false, 
                    timestamp: serverTimestamp() 
                });
            }
            
            alert("Berhasil update poin."); 
        } catch(e) { alert("Gagal update poin: " + e.message); } 
    };

    // FITUR BARU: RESET SEMUA POIN (MANUAL TRIGGER)
    const handleResetAllPoints = async () => {
        if (!confirm("⚠️ BAHAYA: Apakah Anda yakin ingin MERESET POIN SEMUA USER menjadi 0? Tindakan ini tidak dapat dibatalkan!")) return;
        setLoading(true);
        try {
            // Ambil semua user profile
            const usersSnapshot = await getDocs(collection(db, getPublicCollection('userProfiles')));
            
            // Batch update tidak support > 500, jadi kita loop manual satu per satu (client-side batching simple)
            // Untuk app skala kecil ini acceptable.
            let successCount = 0;
            const promises = usersSnapshot.docs.map(async (docSnap) => {
                try {
                    await updateDoc(docSnap.ref, { reputation: 0 });
                    successCount++;
                } catch (err) {
                    console.error(`Gagal reset user ${docSnap.id}:`, err);
                }
            });

            await Promise.all(promises);
            
            // Catat log reset
            await addDoc(collection(db, getPublicCollection('systemLogs')), {
                message: `MANUAL RESET: ${successCount} user points reset to 0`,
                context: 'admin_action',
                userId: 'admin',
                username: 'Developer',
                timestamp: serverTimestamp()
            });

            alert(`Selesai! ${successCount} user telah direset.`);
        } catch (e) {
            alert("Gagal reset massal: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = allUsersList.filter(u => u.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2"><ShieldCheck className="text-sky-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white dark:bg-gray-800 dark:text-white p-2 rounded-full shadow hover:bg-gray-200 dark:hover:bg-gray-700"><X/></button></div>
                <div className="flex gap-2 mb-6"><button onClick={()=>setActiveTab('overview')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab==='overview'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Overview</button><button onClick={()=>setActiveTab('logs')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${activeTab==='logs'?'bg-rose-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}><Bug size={14}/> System Logs</button></div>
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
                        
                        {/* FITUR TOMBOL RESET ALL */}
                        <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-3xl shadow-sm border border-red-200 dark:border-red-700">
                             <h3 className="font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2"><TimerReset size={18}/> Kontrol Reset Mingguan</h3>
                             <p className="text-xs text-red-600 dark:text-red-300 mb-4">Jika otomatisasi gagal, gunakan tombol ini setiap Kamis jam 11:00 WIB.</p>
                             <button onClick={handleResetAllPoints} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm w-full shadow-lg hover:bg-red-700 transition flex items-center justify-center gap-2"><Trash2 size={16}/> RESET SEMUA POIN SEKARANG</button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-orange-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-3 rounded-xl text-sm border border-gray-200 dark:border-gray-600 mb-3 outline-none" rows="3" placeholder="Tulis pesan untuk semua user..."/>
                            <button onClick={handleBroadcast} disabled={sendingBC} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition">{sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}</button>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-red-100 dark:border-gray-700">
                             <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><UserX size={18} className="text-red-500"/> Manajemen User (Ban/Hapus)</h3>
                             <input value={userSearchTerm} onChange={e=>setUserSearchTerm(e.target.value)} placeholder="Cari username / email..." className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600 mb-4 outline-none"/>
                             <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">{filteredUsers.map(u => ( <div key={u.id} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Avatar src={u.photoURL} fallbackText={u.username} className="w-8 h-8 rounded-full"/><div><p className="text-xs font-bold dark:text-white">{u.username} {u.isBanned && <span className="text-red-500">(BANNED)</span>}</p><p className="text-[10px] text-gray-500">{u.email} | Rep: {u.reputation || 0}</p></div></div></div><div className="flex gap-2 justify-end"><button onClick={()=>handleUpdateReputation(u.id, 100)} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold border border-yellow-200">-100 Poin</button><button onClick={()=>handleUpdateReputation(u.id, 0, true)} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[10px] font-bold border border-orange-200">Reset Poin</button><button onClick={()=>handleBanUser(u.id, u.isBanned)} className={`px-2 py-1 rounded text-[10px] font-bold ${u.isBanned ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'}`}>{u.isBanned ? "Unban" : "Ban User"}</button><button onClick={()=>handleDeleteUser(u.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-[10px] font-bold border border-red-200">Hapus</button></div></div> ))}</div>
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
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => { e.preventDefault(); if (!username.trim()) return alert("Username wajib diisi!"); setLoading(true); try { await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { username: username.trim(), email: user.email, uid: user.uid, photoURL: user.photoURL || '', createdAt: serverTimestamp(), following: [], followers: [], savedPosts: [], lastSeen: serverTimestamp(), reputation: 0, lastPostTime: 0 }); onComplete(); } catch (error) { alert("Gagal menyimpan data: " + error.message); } finally { setLoading(false); } };
    return (
        <div className="fixed inset-0 bg-white z-[80] flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-sm text-center">
                <img src={APP_LOGO} className="w-24 h-24 mx-auto mb-6 object-contain"/>
                <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang! 👋</h2>
                <p className="text-gray-500 mb-8 text-sm">Lengkapi profil Anda untuk mulai berinteraksi.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="text-left">
                        <label className="text-xs font-bold text-gray-600 ml-1">Username Unik</label>
                        {/* PERBAIKAN: Input text warna kuning (text-yellow-600 agar readable di bg putih) */}
                        <input 
                            value={username} 
                            onChange={e=>setUsername(e.target.value)} 
                            placeholder="Contoh: user_keren123" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold text-yellow-600 focus:ring-2 focus:ring-sky-500 outline-none placeholder:text-gray-400"
                        />
                    </div>
                    <button disabled={loading} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Mulai Menjelajah"}</button>
                </form>
            </div>
        </div>
    );
};

const AuthModal = ({ onClose }) => {
    // FIX LOGIN ERROR: Tampilkan error spesifik
    const [errorMsg, setErrorMsg] = useState('');
    
    const handleGoogleLogin = async () => { 
        setErrorMsg('');
        try { 
            await signInWithPopup(auth, googleProvider); 
            onClose(); 
        } catch (error) { 
            console.error("Auth Error:", error); 
            // Parsing pesan error agar lebih mudah dibaca user
            let msg = "Gagal login.";
            if (error.code === 'auth/popup-closed-by-user') msg = "Login dibatalkan.";
            else if (error.code === 'auth/network-request-failed') msg = "Periksa koneksi internet.";
            else if (error.code === 'auth/unauthorized-domain') msg = "Domain ini belum diizinkan di Firebase.";
            else if (error.message.includes('app-check')) msg = "Gagal verifikasi keamanan (App Check).";
            
            setErrorMsg(msg + " (" + error.code + ")");
        } 
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button>
                <div className="text-center mb-6"><img src={APP_LOGO} className="w-16 h-16 mx-auto mb-3"/><h2 className="text-xl font-black text-gray-800 dark:text-white">Masuk ke {APP_NAME}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bergabunglah dengan komunitas sekarang!</p></div>
                
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-4 border border-red-100 font-medium">
                        <AlertTriangle size={14} className="inline mr-1 mb-0.5"/> {errorMsg}
                    </div>
                )}

                <button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Lanjutkan dengan Google</button>
                <p className="text-[10px] text-center text-gray-400 mt-4">Dengan masuk, Anda menyetujui Ketentuan Layanan kami.</p>
            </div>
        </div>
    );
};

const LegalPage = ({ onBack }) => {
    usePageTitle("Legal & Kebijakan");
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pb-24 pt-20 px-6 max-w-2xl mx-auto animate-in fade-in">
            <button onClick={onBack} className="fixed top-6 left-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"><ArrowLeft/></button>
            <div className="text-center mb-10"><Scale className="w-12 h-12 mx-auto text-sky-600 mb-4"/><h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">Pusat Kebijakan</h1><p className="text-gray-500 dark:text-gray-400">Transparansi untuk kepercayaan Anda.</p></div>
            <div className="space-y-8"><section><h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Code size={18} className="text-sky-500"/> Tentang Pembuat</h2><div className="bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800 flex items-center gap-4"><img src="https://c.termai.cc/i6/EAb.jpg" alt="Pembuat" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"/><div><h3 className="font-bold text-gray-900 dark:text-white">M. Irham Andika Putra</h3><p className="text-sm text-gray-600 dark:text-gray-300">Siswa SMP Negeri 3 Mentok</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Umur 14 Tahun</p></div></div></section><section><h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Lock size={18} className="text-sky-500"/> Kebijakan Privasi</h2><div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700"><p className="mb-3">Di {APP_NAME}, privasi Anda adalah prioritas kami. Kami mengumpulkan data minimal yang diperlukan untuk fungsionalitas aplikasi.</p><ul className="list-disc pl-5 space-y-1 mb-3"><li><strong>Data Akun:</strong> Nama, Email, Foto Profil (via Google Login).</li><li><strong>Konten:</strong> Postingan, Komentar, dan Pesan yang Anda buat.</li><li><strong>Aktivitas:</strong> Log interaksi seperti Like dan Follow untuk personalisasi.</li></ul></div></section><section><h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><FileText size={18} className="text-purple-500"/> Ketentuan Layanan</h2><div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700"><p className="mb-3">Dengan menggunakan aplikasi ini, Anda setuju untuk:</p><ul className="list-disc pl-5 space-y-1"><li>Tidak memposting konten ilegal, pornografi, atau ujaran kebencian.</li><li>Saling menghormati antar pengguna.</li><li>Tidak melakukan spam atau aktivitas bot.</li></ul></div></section></div>
        </div>
    );
};

const LeaderboardScreen = ({ allUsers, currentUser }) => {
    usePageTitle("Top 10 Legenda");
    // FIX: Leaderboard Logic - Top 10 Only (Tingkat Dewa) & User Rank Message
    const sortedUsers = useMemo(() => { return [...allUsers].sort((a, b) => (b.reputation || 0) - (a.reputation || 0)); }, [allUsers]);
    const top10 = sortedUsers.slice(0, 10);
    
    // Cari ranking user saat ini di list FULL (sebelum di slice)
    const myRankIndex = currentUser ? sortedUsers.findIndex(u => u.uid === currentUser.uid) : -1;
    const isMeInTop10 = myRankIndex !== -1 && myRankIndex < 10;

    return (
        // PERBAIKAN RESPONSIF UI: Lebar container diperbesar untuk desktop
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto p-4 pb-24 pt-20">
            {/* Banner Reset Mingguan */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm">
                <div className="bg-red-500 text-white p-2 rounded-lg"><TimerReset size={20}/></div>
                <div>
                    <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">Reset Poin Mingguan</h3>
                    {/* PERBAIKAN 3: Text Leaderboard diubah sesuai permintaan */}
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1 leading-relaxed">
                        Perhatian! Semua poin reputasi akan <strong>direset menjadi 0</strong> setiap hari <strong>Kamis pukul 11:00 WIB</strong>.
                    </p>
                </div>
            </div>

            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Top 10 Legenda (Hardcore)</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-fit">
                    {top10.map((u, index) => {
                         let rankStyle = ""; let rankIcon = null;
                         if (index === 0) { rankStyle = "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/20 border-l-4 border-yellow-500"; rankIcon = <Crown size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm"/>; } else if (index === 1) { rankStyle = "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-700/30 border-l-4 border-gray-400"; rankIcon = <Medal size={20} className="text-gray-400 fill-gray-200"/>; } else if (index === 2) { rankStyle = "bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/20 border-l-4 border-orange-500"; rankIcon = <Medal size={20} className="text-orange-500 fill-orange-200"/>; }
                         return (
                            <div key={u.uid} className={`flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 ${rankStyle}`}>
                                <div className={`w-8 h-8 flex items-center justify-center font-black text-lg mr-3 ${index===0?'text-yellow-600':index===1?'text-gray-500':index===2?'text-orange-600':'text-gray-300'}`}>{index + 1}</div>
                                <div className="relative mr-3"><Avatar src={u.photoURL} fallbackText={u.username} className={`w-12 h-12 rounded-full border-2 ${index===0?'border-yellow-500':index===1?'border-gray-400':index===2?'border-orange-500':'border-gray-200 dark:border-gray-600'}`}/>{index === 0 && <div className="absolute -top-2 -right-1 animate-bounce">{rankIcon}</div>}</div>
                                <div className="flex-1"><h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-1">{u.username}{index < 3 && <Sparkles size={12} className={index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-500'}/>}</h3><p className="text-xs text-gray-500 font-medium mt-0.5">{u.followers?.length || 0} Pengikut</p></div>
                                <div className="text-right"><div className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center justify-end gap-1"><Flame size={14} className={index < 3 ? 'text-rose-500' : 'text-gray-300'}/>{u.reputation || 0}</div><div className="text-[9px] text-gray-400 uppercase font-bold">Poin</div></div>
                            </div>
                         )
                    })}
                </div>

                {/* Info Card di Sebelah Kanan untuk Desktop */}
                <div className="space-y-4">
                     {/* Pesan Semangat jika tidak masuk Top 10 */}
                    {!isMeInTop10 && currentUser && (
                        <div className="bg-sky-50 dark:bg-sky-900/20 p-6 rounded-3xl text-center border border-sky-100 dark:border-sky-800">
                            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-2xl">💪</div>
                            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Perjalanan Masih Panjang!</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Masuk Top 10 butuh dedikasi tinggi.</p>
                            <p className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-800 py-1 px-3 rounded-full inline-block shadow-sm">
                                Posisi Kamu: #{myRankIndex + 1}
                            </p>
                        </div>
                    )}

                    <div className="bg-gray-900 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 blur-3xl opacity-20 rounded-full"></div>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Gamepad2/> Sistem Poin (Tingkat Dewa)</h3>
                        <ul className="space-y-3 text-sm text-gray-300">
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Membuat Post</span> <span className="text-green-400 font-bold">+2 Poin</span></li>
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Berkomentar</span> <span className="text-green-400 font-bold">+1 Poin</span></li>
                            <li className="flex justify-between items-center border-b border-gray-800 pb-2"><span>Dapat Like</span> <span className="text-green-400 font-bold">+1 Poin</span></li>
                            <li className="flex justify-between items-center pt-2"><span className="text-red-400">Hapus Post</span> <span className="text-red-400 font-bold">Sanksi Berat</span></li>
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

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick }) => {
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

    // STATE UNTUK DIALOG KONFIRMASI (MENGGANTIKAN CONFIRM)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // FITUR BARU: Title Truncation Logic
    const [expandedTitle, setExpandedTitle] = useState(false);
    const isTitleLong = post.title && post.title.length > 60;
    const displayTitle = expandedTitle || !isTitleLong ? post.title : post.title.substring(0, 60) + "...";

    const isOwner = currentUserId && post.userId === currentUserId;
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
        const newLiked = !liked; setLiked(newLiked); setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
        const ref = doc(db, getPublicCollection('posts'), post.id);
        const authorRef = doc(db, getPublicCollection('userProfiles'), post.userId);
        try {
            // FIX: HARDCORE MODE - Like cuma +1 Poin (sebelumnya +2)
            if (newLiked) { await updateDoc(ref, { likes: arrayUnion(currentUserId) }); if (post.userId !== currentUserId) { await updateDoc(authorRef, { reputation: increment(1) }); sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id); } } 
            else { await updateDoc(ref, { likes: arrayRemove(currentUserId) }); }
        } catch (error) { setLiked(!newLiked); setLikeCount(prev => !newLiked ? prev + 1 : prev - 1); }
    };

    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };
    const handleSave = async () => { if (isGuest) { onRequestLogin(); return; } const newSaved = !isSaved; setIsSaved(newSaved); const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId); try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); } };

    const handleComment = async (e) => {
        e.preventDefault(); if (isGuest) { onRequestLogin(); return; } if (!profile) return; if (!newComment.trim()) return;
        try {
            const commentData = { postId: post.id, userId: currentUserId, text: newComment, username: profile.username || 'User', timestamp: serverTimestamp(), parentId: replyTo ? replyTo.id : null, replyToUsername: replyTo ? replyTo.username : null };
            await addDoc(collection(db, getPublicCollection('comments')), commentData);
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            // FIX: HARDCORE MODE - Komen cuma +1 Poin (sebelumnya +5)
            if (post.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), post.userId), { reputation: increment(1) }); if (!replyTo) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id); }
            if (replyTo && replyTo.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), replyTo.userId), { reputation: increment(1) }); sendNotification(replyTo.userId, 'comment', `membalas komentar Anda: "${newComment.substring(0,15)}.."`, profile, post.id); }
            setNewComment(''); setReplyTo(null);
        } catch (error) { console.error(error); }
    };

    // UPDATE: Menggunakan CustomDialog untuk menghapus post
    const confirmDelete = async () => {
        setShowDeleteDialog(false); // Tutup dialog
        try { 
            const earnedReputation = 2 + ((post.likes?.length || 0) * 1) + ((post.commentsCount || 0) * 1); 
            const userRef = doc(db, getPublicCollection('userProfiles'), post.userId); 
            await updateDoc(userRef, { reputation: increment(-earnedReputation) }); 
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); 
            // Alert kecil bisa diganti toast, tapi untuk sekarang pakai alert standar atau silent
        } catch (e) { alert("Gagal menghapus: " + e.message); }
    };

    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const handleDeleteComment = async (commentId) => { if(confirm("Hapus komentar?")) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };
    
    // PERBAIKAN: SHARE LINK DENGAN WEB SHARE API & FALLBACK
    const sharePost = async () => { 
        const shareUrl = `${window.location.origin}?post=${post.id}`;
        const shareData = {
            title: post.title || 'Postingan BguneNet',
            text: post.content ? post.content.substring(0, 100) + '...' : 'Lihat postingan menarik ini!',
            url: shareUrl
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                 // Fallback ke copy jika user batal/error di native share
                 try {
                     await navigator.clipboard.writeText(shareUrl);
                 } catch(e){}
            }
        } else {
            try { 
                await navigator.clipboard.writeText(shareUrl); 
                alert('Link Postingan Disalin! Meta data akan mengikuti saat dibagikan.'); 
            } catch (e) { alert('Gagal menyalin link'); } 
        }
    };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.toMillis || 0) - (b.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    // FIX VIDEO: Prioritaskan mediaType 'video' dari API agar tidak dianggap embed link biasa
    const isVideo = post.mediaType === 'video' || ((post.mediaUrl && /\.(mp4|webm)$/i.test(post.mediaUrl)) && !embed);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 
    
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

    // PERBAIKAN: Padding dikurangi jadi p-3 agar compact ("Layout KECIL BETUL")
    // Label MEME dirapikan di header (inline)
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 mb-2 md:mb-0 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-700 relative overflow-hidden group transition hover:shadow-lg flex flex-col">
            <CustomDialog 
                isOpen={showDeleteDialog} 
                type="danger" 
                title="Hapus Postingan?" 
                message="Reputasi (XP) yang Anda dapatkan dari postingan ini akan ditarik kembali."
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteDialog(false)}
            />
            
            {post.isShort && <div className="absolute top-3 right-3 bg-black/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md z-10 flex items-center"><Zap size={8} className="mr-1 text-yellow-400"/> SHORT</div>}
            
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px] flex-shrink-0"><div className="w-full h-full rounded-full bg-white overflow-hidden"><Avatar src={post.user?.photoURL} fallbackText={post.user?.username || "?"} className="w-full h-full"/></div></div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-tight flex items-center gap-1 truncate">
                            {post.user?.username || 'Pengguna'} 
                            {isDeveloper && <ShieldCheck size={12} className="text-blue-500 fill-blue-100 flex-shrink-0"/>}
                            {/* FIX MEME LABEL POSITION */}
                            {isMeme && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold ml-1">MEME</span>}
                        </h4>
                        <div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTimeAgo(post.timestamp).relative}</span>{isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color} whitespace-nowrap scale-90 origin-left`}>{userBadge.label}</span>}</div>
                    </div>
                </div>
                <div className="flex gap-1">
                    {!isOwner && post.userId !== currentUserId && ( <button onClick={() => isGuest ? onRequestLogin() : handleFollow(post.userId, isFollowing)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${isFriend ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-sm'}`}>{isFriend ? <><UserCheck size={10}/> Teman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                    {(isOwner || isMeDeveloper) && !isGuest && ( <div className="flex gap-1">{isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 text-gray-400 hover:text-sky-600 rounded-full"><Edit size={14}/></button>}<button onClick={handleDeleteClick} className={`p-1.5 rounded-full ${isMeDeveloper && !isOwner ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-red-600'}`}>{isMeDeveloper && !isOwner ? <ShieldAlert size={14}/> : <Trash2 size={14}/>}</button></div> )}
                </div>
            </div>
            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3"><input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg font-bold text-sm dark:text-white"/><textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg text-sm resize-none dark:text-white" rows="4"/><div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-1">Batal</button><button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button></div></div>
            ) : (
                <div className="flex-1 flex flex-col">
                     {/* PERBAIKAN: Title Truncation Logic & View More */}
                    {post.title && (
                        <div className="mb-1">
                            <h3 className={`font-bold text-gray-900 dark:text-white text-[15px] inline ${expandedTitle ? '' : 'line-clamp-1'}`}>
                                {displayTitle}
                            </h3>
                            {isTitleLong && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setExpandedTitle(!expandedTitle); }} 
                                    className="text-[10px] text-sky-500 font-bold ml-1 hover:underline"
                                >
                                    {expandedTitle ? 'Tutup' : 'Selengkapnya'}
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed flex-1">{renderMarkdown(displayText, onHashtagClick)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
                    <div onDoubleClick={handleDoubleTap} className="relative mt-auto">
                         {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700 pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                         {isAudio && <AudioPlayer src={post.mediaUrl || embed.url} />}
                         {/* FIX VIDEO: Render video element jika isVideo true (termasuk dari API FAA) */}
                         {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[400px] bg-black rounded-lg mb-2 outline-none"/>}
                         
                         {displayEmbed?.type === 'youtube' && <div className="aspect-video mb-2 rounded-lg overflow-hidden"><iframe src={displayEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                         {displayEmbed?.type === 'instagram' && ( <div className="aspect-square mb-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"><iframe src={displayEmbed.embedUrl} className="w-full h-full border-0" scrolling="no" allowTransparency="true"></iframe></div>)}
                         {displayEmbed?.type === 'tiktok' && ( <div className="aspect-[9/16] mb-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black"><iframe src={displayEmbed.embedUrl} className="w-full h-full border-0"></iframe></div>)}
                         {displayEmbed?.type === 'link' && <a href={displayEmbed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-3 text-center bg-sky-50 dark:bg-gray-900 text-sky-600 font-bold text-xs hover:underline mb-2 rounded-lg">Buka Tautan <ExternalLink size={12} className="inline ml-1"/></a>}
                         
                         {!isAudio && !isVideo && !displayEmbed && mediaList.length > 0 && ( <MediaGrid mediaUrls={mediaList} onImageClick={(idx) => {setLightboxIndex(idx); setLightboxOpen(true);}} /> )}
                    </div>
                </div>
            )}
            <div className="flex items-center gap-6 pt-2 border-t border-gray-50 dark:border-gray-700 mt-1">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Heart size={16} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={16}/> {post.commentsCount || 0}</button>
                <button onClick={sharePost} className="text-gray-400 hover:text-sky-500"><Share2 size={16}/></button>
                <button onClick={handleSave} className={`ml-auto transition ${isSaved ? 'text-sky-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /></button>
            </div>
            {/* FIX KOMENTAR: Hapus absolute agar tidak menutupi postingan, ganti jadi relative & mt-3 */}
            {showComments && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 animate-in fade-in bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 relative flex flex-col max-h-[300px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"><h5 className="font-bold text-xs">Komentar</h5><button onClick={()=>setShowComments(false)}><X size={14}/></button></div>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-2 custom-scrollbar pr-1 min-h-[50px]">{comments.length === 0 ? ( <p className="text-xs text-center text-gray-400 mt-4">Belum ada komentar.</p> ) : ( <CommentList commentList={rootComments} /> )}</div>
                    <form onSubmit={handleComment} className="relative mt-auto">{replyTo && ( <div className="flex items-center justify-between text-[10px] bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 p-2 rounded-t-lg"><span>Membalas <b>{replyTo.username}</b>...</span><button type="button" onClick={()=>setReplyTo(null)}><X size={12}/></button></div> )}<div className="flex gap-2"><input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis..." disabled={isGuest || !profile} className={`flex-1 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-200 border border-gray-200 dark:border-gray-600 ${replyTo ? 'rounded-b-xl' : 'rounded-xl'}`}/><button type="submit" disabled={!newComment.trim() || isGuest} className="p-2 bg-sky-500 text-white rounded-xl shadow-md hover:bg-sky-600 disabled:opacity-50 h-fit self-end"><Send size={14}/></button></div></form>
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
        try { const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), userId)); if (userDoc.exists()) { const userData = userDoc.data(); const lastPost = userData.lastPostTime || 0; const now = Date.now(); if (now - lastPost < 60000) { alert("Tunggu 1 menit sebelum memposting lagi. (Anti-Spam)"); return; } } } catch(err) { console.error("Gagal cek cooldown", err); }
        setLoading(true); setProg(0);
        try {
            let mediaUrls = []; let mediaType = 'text';
            if (form.files.length > 0) { const firstFile = form.files[0]; if (firstFile.type.startsWith('image')) { mediaType = 'image'; setProg(10); for (let i = 0; i < form.files.length; i++) { const base64 = await compressImageToBase64(form.files[i]); mediaUrls.push(base64); setProg(10 + ((i + 1) / form.files.length) * 80); } } else if (firstFile.type.startsWith('video') || firstFile.type.startsWith('audio')) { const uploadedUrl = await uploadToFaaAPI(firstFile, setProg); mediaUrls.push(uploadedUrl); mediaType = firstFile.type.startsWith('video') ? 'video' : 'audio'; setProg(100); } } else if (form.url) { mediaType = 'link'; mediaUrls.push(form.url); }
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), { userId, title: form.title, content: form.content, mediaUrls: mediaUrls, mediaUrl: mediaUrls[0] || '', mediaType: mediaType, timestamp: serverTimestamp(), likes: [], commentsCount: 0, category: category, user: {username, uid: userId} });
            // FIX: HARDCORE MODE - Buat Post cuma +2 Poin (sebelumnya +10)
            await updateDoc(doc(db, getPublicCollection('userProfiles'), userId), { reputation: increment(2), lastPostTime: Date.now() }); 
            setProg(100); setTimeout(()=>onSuccess(ref.id, false), 500);
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-md md:max-w-xl lg:max-w-2xl mx-auto p-4 pb-24 pt-20">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-xl border border-sky-50 dark:border-gray-700 relative overflow-hidden mt-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-purple-400"></div><h2 className="text-xl font-black text-gray-800 dark:text-white mb-6">Buat Postingan Baru</h2>
                <form onSubmit={submit} className="space-y-4">
                    {loading && <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul Menarik..." className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 transition"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu... (Gunakan #meme untuk kategori meme)" rows="4" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    <div className="flex gap-2 text-xs"><button type="button" onClick={()=>setForm({...form, content: form.content + "**Tebal**"})} className="bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-200">B</button><button type="button" onClick={()=>setForm({...form, content: form.content + "*Miring*"})} className="bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-200">I</button><button type="button" onClick={insertLink} className="bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 px-2 py-1 rounded hover:bg-sky-200 flex items-center gap-1"><LinkIcon size={10}/> Link</button></div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.files.length > 0 && !form.isAudio ?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><ImageIcon size={18} className="mr-2"/><span className="text-xs font-bold">{form.files.length > 0 && !form.isAudio ? `${form.files.length} File` : 'Foto (Banyak)'}</span><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} disabled={loading}/></label>
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.isAudio ?'bg-pink-50 border-pink-200 text-pink-600':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><Music size={18} className="mr-2"/><span className="text-xs font-bold">{form.isAudio ? 'Audio Siap' : 'Audio'}</span><input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={loading}/></label>
                    </div>
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, files:[]})} placeholder="Atau Link Video (YouTube/TikTok/IG)..." className="w-full pl-10 py-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs outline-none"/></div>
                    <button disabled={loading || (!form.content && form.files.length === 0 && !form.url)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest, allUsers }) => {
    // Dynamic Meta Tags untuk Profil
    usePageTitle(
        profileData?.username ? `Profil ${profileData.username}` : "Profil",
        `Lihat profil ${profileData?.username || 'Pengguna'} di ${APP_NAME}. Bergabunglah untuk melihat postingan mereka!`,
        profileData?.photoURL || APP_LOGO
    );

    const [edit, setEdit] = useState(false); const [name, setName] = useState(profileData.username); const [file, setFile] = useState(null); const [load, setLoad] = useState(false); const [showDev, setShowDev] = useState(false); const [activeTab, setActiveTab] = useState('posts'); const [mood, setMood] = useState(profileData.mood || ''); const [isEditingMood, setIsEditingMood] = useState(false);
    
    const [localPosts, setLocalPosts] = useState([]);
    const [loadingLocal, setLoadingLocal] = useState(true);

    const viewerUid = viewerProfile ? viewerProfile.uid : null;
    const isSelf = viewerUid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;

    useEffect(() => {
        setLoadingLocal(true);
        setLocalPosts([]); // Reset posts dulu biar gak blank putih lama (biar muncul skeleton)
        
        const fetchUserPosts = async () => {
            try {
                const data = await fetchFeedData({
                    mode: 'user',
                    userId: profileData.uid,
                    limit: 20
                });
                
                const enrichedPosts = data.posts.map(p => ({
                    ...p,
                    user: profileData
                }));
                
                setLocalPosts(enrichedPosts);
            } catch (e) {
                console.error("Profile Fetch Error:", e);
            } finally {
                setLoadingLocal(false);
            }
        };

        if (profileData?.uid) {
            fetchUserPosts();
        }
    }, [profileData.uid]);

    const followersCount = (profileData.followers || []).length;
    const followingCount = (profileData.following || []).length;
    const targetFollowers = profileData.followers || [];
    const targetFollowing = profileData.following || [];
    const friendsCount = targetFollowing.filter(id => targetFollowers.includes(id)).length;

    const save = async () => { setLoad(true); try { let url = profileData.photoURL; if (file) { url = await compressImageToBase64(file); } await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); setEdit(false); } catch(e){alert(e.message)} finally{setLoad(false)}; };
    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    const badge = getReputationBadge(profileData.reputation || 0, isDev);
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; 
    const isFollowedByTarget = viewerProfile ? (viewerProfile.followers || []).includes(profileData.uid) : false;
    const isFriend = isFollowing && isFollowedByTarget; 
    const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    let rank = null;
    if (allUsers) { const sorted = [...allUsers].sort((a,b) => (b.reputation||0) - (a.reputation||0)); rank = sorted.findIndex(u => u.uid === profileData.uid) + 1; }
    // FIX HARDCORE LEVELING: Naik level dipersulit (100 -> 500 -> 2500 -> 5000)
    const getNextRankData = (points) => { if (points < 500) return { next: 500, label: 'Rising Star', percent: (points/500)*100 }; if (points < 2500) return { next: 2500, label: 'Influencer', percent: ((points-500)/2000)*100 }; if (points < 5000) return { next: 5000, label: 'Legend', percent: ((points-2500)/2500)*100 }; return { next: null, label: 'Max Level', percent: 100 }; };
    const rankProgress = getNextRankData(profileData.reputation || 0);

    return (
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pb-24 pt-20">
            <div className={`bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm mb-8 mx-4 text-center relative overflow-hidden border ${rank === 1 ? 'border-yellow-400 ring-2 ring-yellow-200' : rank === 2 ? 'border-gray-400 ring-2 ring-gray-200' : rank === 3 ? 'border-orange-400 ring-2 ring-orange-200' : 'border-sky-50 dark:border-gray-700'}`}>
                {rank && rank <= 3 && ( <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl font-black text-white text-xs ${rank===1?'bg-yellow-500':rank===2?'bg-gray-400':'bg-orange-500'}`}>#{rank} VIRAL</div> )}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 dark:from-sky-900 dark:to-purple-900 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8"><div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 dark:bg-gray-700 ${rank===1 ? 'border-yellow-400' : isOnline ? 'border-emerald-400' : 'border-white dark:border-gray-600'} relative`}>{load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}<Avatar src={profileData.photoURL} fallbackText={profileData.username} className="w-full h-full"/></div><div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>{isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}</div>
                {edit ? ( <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent dark:text-white"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs dark:text-gray-300"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'Mengunggah...':'Simpan'}</button></div> ) : ( <> <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> {isSelf ? ( isEditingMood ? ( <div className="flex items-center justify-center gap-2 mt-2"><input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32 dark:bg-gray-700 dark:text-white"/><button onClick={saveMood} className="text-green-500"><Check size={14}/></button></div> ) : ( <div onClick={()=>setIsEditingMood(true)} className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-sky-500 flex items-center justify-center gap-1">{profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/></div> ) ) : ( profileData.mood && <p className="text-sm text-gray-500 mt-1 italic">"{profileData.mood}"</p> )} </> )}
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label}</div>
                <div className="px-8 mt-2 mb-4 w-full"><div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1"><span>{profileData.reputation || 0} XP</span><span>{rankProgress.next ? `${rankProgress.next} XP` : 'MAX'}</span></div><div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-400 to-purple-500 transition-all duration-1000" style={{width: `${rankProgress.percent}%`}}></div></div><p className="text-[10px] text-center mt-1 text-sky-500 font-bold">{rankProgress.next ? `Butuh ${rankProgress.next - (profileData.reputation||0)} poin lagi ke ${rankProgress.label}` : 'Kamu adalah Legenda!'}</p></div>
                {!isSelf && !isGuest && ( <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${isFriend ? 'bg-emerald-500 text-white shadow-emerald-200' : isFollowing ? 'bg-gray-200 text-gray-600' : 'bg-sky-500 text-white shadow-sky-200'}`}>{isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                {isDev && isSelf && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 shadow-lg"><ShieldCheck size={16}/> Dashboard Developer</button>}
                <div className="flex justify-center gap-6 mt-6 border-t dark:border-gray-700 pt-6"><div><span className="font-bold text-xl block dark:text-white">{followersCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div><div><span className="font-bold text-xl block dark:text-white">{followingCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div><div><span className="font-bold text-xl block text-emerald-600">{friendsCount}</span><span className="text-[10px] text-emerald-600 font-bold uppercase">Teman</span></div></div>
            </div>
            {isSelf && ( <div className="flex gap-2 px-4 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Disimpan</button></div> )}
            <div className="px-4">
                {activeTab === 'posts' ? (
                    loadingLocal ? <SkeletonPost /> :
                    localPosts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
                            {localPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}
                        </div>
                    ) : <div className="text-center text-gray-400 py-10">Belum ada postingan.</div>
                ) : ( 
                    savedPostsData.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    currentUserId, 
    profile, 
    allPosts, 
    handleFollow, 
    goToProfile, 
    newPostId, 
    clearNewPost, 
    isMeDeveloper, 
    isGuest, 
    onRequestLogin, 
    onHashtagClick, 
    // PERBAIKAN 4: Terima state feed dari App.js agar persisten
    homeFeedState,
    setHomeFeedState
}) => {
    usePageTitle("Beranda");
    // Kita gunakan state dari parent (App), tidak membuat state lokal baru untuk posts/cursor
    const { posts: feedPosts, cursor: nextCursor, sortType, hasLoaded } = homeFeedState;
    
    const [loading, setLoading] = useState(false);
    const [feedError, setFeedError] = useState(false);
    const bottomRef = useRef(null);

    // Ambil top 1 trending tag untuk ditampilkan di header compact
    const topTrend = useMemo(() => {
        const tagCounts = {};
        allPosts.forEach(p => { const tags = extractHashtags(p.content); tags.forEach(t => tagCounts[t] = (tagCounts[t]||0)+1); });
        const sorted = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]);
        return sorted.length > 0 ? {tag: sorted[0][0], count: sorted[0][1]} : null;
    }, [allPosts]);

    // Modifikasi: Logic Load Feed (Updated for Following)
    const loadFeed = async (reset = false) => {
        if (loading) return;
        setLoading(true);
        setFeedError(false);

        const currentCursor = reset ? null : nextCursor;
        const currentSort = sortType; 
        
        try {
            const data = await fetchFeedData({
                mode: currentSort, 
                limit: 10,
                cursor: currentCursor,
                viewerId: currentUserId, 
            });

            const enrichedPosts = data.posts.map(p => ({
                ...p,
                user: p.user || { username: 'Pengguna', photoURL: '' } 
            }));

            setHomeFeedState(prev => ({
                ...prev,
                posts: reset ? enrichedPosts : [...prev.posts, ...enrichedPosts],
                cursor: data.nextCursor,
                hasLoaded: true
            }));
            
        } catch (e) {
            console.error("Feed load error:", e);
            setFeedError(true);
        } finally {
            setLoading(false);
        }
    };

    // Effect: Hanya load jika belum ada data (pertama kali buka app)
    // ATAU jika user mengganti kategori (dideteksi via hasLoaded = false di handler tombol)
    useEffect(() => {
        if (!hasLoaded) {
            loadFeed(true);
        }
    }, [hasLoaded, sortType]); // Dependency pada sortType penting

    // FIX SCROLL: Membekukan posisi scroll saat kembali ke halaman ini
    // Menggunakan useLayoutEffect agar scroll terjadi sebelum paint, mencegah kedipan
    useLayoutEffect(() => {
        if (homeFeedState.scrollPos > 0) {
            window.scrollTo(0, homeFeedState.scrollPos);
        }
    }, []); // Run once on mount

    // Simpan posisi scroll saat unmount (pergi ke halaman lain)
    useEffect(() => {
        return () => {
             setHomeFeedState(prev => ({ ...prev, scrollPos: window.scrollY }));
        };
    }, []); 

    // Handler Ganti Kategori (Tambahan: Following)
    const handleSortChange = (newSort) => {
        if (newSort === sortType) return;
        // Jika mode following & guest, minta login
        if (newSort === 'following' && isGuest) {
            onRequestLogin();
            return;
        }

        // Reset state di parent, set hasLoaded false untuk memicu fetch baru
        setHomeFeedState(prev => ({
            ...prev,
            sortType: newSort,
            posts: [],
            cursor: null,
            hasLoaded: false,
            scrollPos: 0 // Reset scroll jika ganti kategori
        }));
    };

    // Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && nextCursor && !loading && hasLoaded) {
                loadFeed(false);
            }
        }, { threshold: 0.5 });
        if (bottomRef.current) observer.observe(bottomRef.current);
        return () => { if (bottomRef.current) observer.unobserve(bottomRef.current); };
    }, [nextCursor, loading, hasLoaded]);

    // Manual Refresh Button
    const manualRefresh = () => { 
        clearNewPost();
        // Reset total untuk memaksa reload
        setHomeFeedState(prev => ({
            ...prev,
            posts: [],
            cursor: null,
            hasLoaded: false,
            scrollPos: 0
        }));
    };

    const finalPosts = [...feedPosts];
    if (newPostId) {
        const newlyCreated = allPosts.find(p => p.id === newPostId);
        if (newlyCreated && !finalPosts.find(p => p.id === newPostId)) {
            finalPosts.unshift(newlyCreated);
        }
    }

    // PERBAIKAN RESPONSIF UI: Navbar Kategori TIDAK Sticky & Lebih Rapi
    return (
        <div className="w-full max-w-xl md:max-w-2xl mx-auto pb-24 px-4 md:px-0 pt-4"> 
            {/* PERBAIKAN: Hapus 'sticky top-14 md:top-16 z-30' agar tidak lengket */}
            <div className="flex items-center justify-start mb-4 py-2 relative overflow-x-auto no-scrollbar gap-2 -mx-4 px-4">
                <div className="flex gap-2 items-center">
                     <button onClick={() => handleSortChange('home')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='home'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>Beranda</button>
                     <button onClick={() => handleSortChange('following')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap flex items-center gap-1 ${sortType==='following'?'bg-emerald-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}><Users size={12}/> Mengikuti</button>
                     <button onClick={() => handleSortChange('meme')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-yellow-400 text-white border-yellow-400 shadow-lg shadow-yellow-200':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>😂 Meme Zone</button>
                     <button onClick={() => handleSortChange('popular')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-purple-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>Populer</button>
                     
                     {topTrend && (
                        <div onClick={() => onHashtagClick(topTrend.tag.replace('#',''))} className="hidden md:flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-sky-100 dark:border-gray-700 rounded-full text-[10px] font-bold text-gray-500 cursor-pointer hover:bg-sky-50 whitespace-nowrap">
                            <TrendingUp size={12} className="mr-1 text-sky-500"/> {topTrend.tag}
                        </div>
                     )}
                     
                     <button onClick={manualRefresh} className="p-1.5 bg-white dark:bg-gray-800 text-gray-500 rounded-full shadow-sm hover:rotate-180 transition duration-500 border border-gray-100 dark:border-gray-700"><RefreshCw size={14}/></button>
                </div>
            </div>

            {feedError && (
                <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-3xl mb-4 text-center">
                    <WifiOff size={48} className="text-red-400 mb-2"/>
                    <h3 className="text-red-600 dark:text-red-400 font-bold">Koneksi Bermasalah</h3>
                    <button onClick={manualRefresh} className="px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg mt-2">Coba Lagi</button>
                </div>
            )}

            {loading && finalPosts.length === 0 ? <><SkeletonPost/><SkeletonPost/></> : finalPosts.length === 0 && !feedError ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-400 font-bold">Belum ada postingan.</p>
                </div>
            ) : (
                <div className="space-y-4"> 
                    {finalPosts.map(p => (
                        <div key={p.id} className={`${p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}`}>
                            {p.id === newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-1"><CheckCircle size={14}/> Postingan Berhasil Terkirim</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile?.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>onRequestLogin()} onHashtagClick={onHashtagClick}/>
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
    usePageTitle("Notifikasi");
    const [notifs, setNotifs] = useState([]);
    useEffect(() => { const q = query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50)); return onSnapshot(q, s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead))); }, [userId]);
    const handleClick = async (n) => { await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true}); if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); } else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); } };
    return <div className="max-w-md md:max-w-xl mx-auto p-4 pb-24 pt-20"><h1 className="text-xl font-black text-gray-800 dark:text-white mb-6">Notifikasi</h1>{notifs.length===0?<div className="text-center py-20 text-gray-400">Tidak ada notifikasi baru.</div>:<div className="space-y-3">{notifs.map(n=><div key={n.id} onClick={()=>handleClick(n)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>{n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}</div></div><div className="flex-1"><p className="text-sm font-bold dark:text-gray-200">{n.fromUsername}</p><p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p></div></div>)}</div>}</div>;
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const cachedPost = allPosts.find(p => p.id === postId);
    const [fetchedPost, setFetchedPost] = useState(cachedPost || null);
    const [loading, setLoading] = useState(!cachedPost);
    const [error, setError] = useState(false);

    // Dynamic Meta Tags untuk Single Post
    const postTitle = fetchedPost?.title || `Postingan oleh ${fetchedPost?.user?.username || 'Pengguna'}`;
    const postDesc = fetchedPost?.content ? fetchedPost.content.substring(0, 150) : "Lihat postingan menarik ini di BguneNet!";
    const postImage = fetchedPost?.mediaUrl || APP_LOGO;
    usePageTitle(postTitle, postDesc, postImage);

    useEffect(() => {
        if (cachedPost) { setFetchedPost(cachedPost); setLoading(false); return; }
        const fetchSinglePost = async () => {
            setLoading(true);
            try {
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
    const handleBack = () => { 
        // Bersihkan parameter post di URL
        const url = new URL(window.location);
        url.searchParams.delete('post');
        window.history.pushState({}, '', url);
        goBack(); 
    };
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
    usePageTitle(initialQuery ? `Cari: ${initialQuery}` : "Pencarian");
    const [queryTerm, setQueryTerm] = useState(initialQuery || '');
    const [results, setResults] = useState({ users: [], posts: [] });
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        // Update URL saat query berubah
        if (queryTerm) updateUrl({ q: queryTerm });
        
        if (!queryTerm.trim()) { setResults({ users: [], posts: [] }); return; }
        
        const doSearch = async () => {
            setIsSearching(true);
            const lower = queryTerm.toLowerCase();
            const foundUsers = allUsers.filter(u => u.username?.toLowerCase().includes(lower));
            try {
                const data = await fetchFeedData({
                    mode: 'search',
                    q: queryTerm,
                    limit: 20
                });
                const enrichedPosts = data.posts.map(p => ({
                   ...p,
                   user: p.user || { username: 'Pengguna' }
                }));

                setResults({ users: foundUsers, posts: enrichedPosts });
            } catch (e) {
                console.error("Search error", e);
            } finally {
                setIsSearching(false);
            }
        };

        const timeout = setTimeout(doSearch, 500);
        return () => clearTimeout(timeout);
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

const App = () => {
    const [user, setUser] = useState(undefined); const [profile, setProfile] = useState(null); const [page, setPage] = useState('home'); const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]); const [targetUid, setTargetUid] = useState(null); const [targetPid, setTargetPid] = useState(null); const [notifCount, setNotifCount] = useState(0); const [newPostId, setNewPostId] = useState(null); const [searchQuery, setSearchQuery] = useState(''); const [isLoadingFeed, setIsLoadingFeed] = useState(true); const [feedError, setFeedError] = useState(false); const [refreshTrigger, setRefreshTrigger] = useState(0); const [showAuthModal, setShowAuthModal] = useState(false); const [showOnboarding, setShowOnboarding] = useState(false); const [darkMode, setDarkMode] = useState(false); const [isOffline, setIsOffline] = useState(!navigator.onLine); const [showRewards, setShowRewards] = useState(false); const [canClaimReward, setCanClaimReward] = useState(false); const [nextRewardTime, setNextRewardTime] = useState('');

    // FIX SPLASH SCREEN: Tambahkan state untuk mendeteksi data profile & users sudah load atau belum
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [isUsersLoaded, setIsUsersLoaded] = useState(false);
    const [isDataTimeout, setIsDataTimeout] = useState(false);

    // SIDEBAR & CHAT STATE
    const [showSidebar, setShowSidebar] = useState(false);
    const [activeChatId, setActiveChatId] = useState(null);

    // FIX FEED PERSISTENCE: State feed diangkat ke App level
    const [homeFeedState, setHomeFeedState] = useState({
        posts: [],
        cursor: null,
        sortType: 'home',
        hasLoaded: false,
        scrollPos: 0 // FIX: Tambahkan scrollPos agar tidak refresh/scroll ke atas
    });

    // SISTEM ROUTING UNIK (URL PARSER)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const postParam = params.get('post');
        const userParam = params.get('user');
        const qParam = params.get('q');

        // Prioritaskan Post, lalu User, lalu Search
        if (postParam) {
            setTargetPid(postParam);
            setPage('view_post');
        } else if (userParam) {
            setTargetUid(userParam);
            setPage('other-profile');
        } else if (qParam) {
            setSearchQuery(qParam);
            setPage('search');
        }
        // Jika tidak ada param, default ke 'home' (sudah default state)
    }, []);

    useEffect(() => {
        const handleError = (event) => { if (!user || user.email !== DEVELOPER_EMAIL) { event.preventDefault(); logSystemError(event.error || new Error(event.message), 'global_error', user); } };
        const handleRejection = (event) => { if (!user || user.email !== DEVELOPER_EMAIL) { event.preventDefault(); logSystemError(event.reason || new Error('Unhandled Promise Rejection'), 'promise_rejection', user); } };
        window.addEventListener('error', handleError); window.addEventListener('unhandledrejection', handleRejection);
        return () => { window.removeEventListener('error', handleError); window.removeEventListener('unhandledrejection', handleRejection); };
    }, [user]);

    useEffect(() => { if (user && user.email !== DEVELOPER_EMAIL) { console.error = (...args) => {}; } }, [user]);
    useEffect(() => { const handleOff = () => setIsOffline(true); const handleOn = () => { setIsOffline(false); setRefreshTrigger(prev=>prev+1); }; window.addEventListener('offline', handleOff); window.addEventListener('online', handleOn); return () => { window.removeEventListener('offline', handleOff); window.removeEventListener('online', handleOn); } }, []);
    useEffect(() => { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('firebase-messaging-sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed')); } }, []);
    
    // FIX SCROLL: Reset scroll ke atas HANYA jika bukan ke home
    useEffect(() => { 
        if (page !== 'home') {
            window.scrollTo(0, 0); 
        }
    }, [page]);
    
    useEffect(() => { const savedTheme = localStorage.getItem('theme'); if (savedTheme === 'dark') { document.documentElement.classList.add('dark'); setDarkMode(true); } }, []);

    // FIX SPLASH: Timeout logic jika data tidak kunjung datang dalam 15 detik
    useEffect(() => {
        const timer = setTimeout(() => {
            // Jika user sudah login tapi profile/users belum load, atau user null tapi feed belum load
            if (!isUsersLoaded || (user && !isProfileLoaded)) {
                setIsDataTimeout(true);
            }
        }, 15000); 
        return () => clearTimeout(timer);
    }, [isUsersLoaded, isProfileLoaded, user]);

    // NEW FEATURE: LOGIKA TRIGGER RESET LEADERBOARD OTOMATIS (KAMIS 11:00)
    useEffect(() => {
        const checkAutoReset = async () => {
            // Hanya developer yang memicu ini agar tidak spam DB
            if (!user || user.email !== DEVELOPER_EMAIL) return; 
            
            const now = new Date();
            const isThursday = now.getDay() === 4; // 0=Min, 4=Kamis
            const isTime = now.getHours() >= 11; // 11:00
            
            if (isThursday && isTime) {
                // Cek apakah sudah reset hari ini (logika sederhana via console/log)
                const logRef = doc(db, getPublicCollection('systemLogs'), 'last_weekly_reset');
                const logSnap = await getDoc(logRef);
                const lastReset = logSnap.exists() ? logSnap.data().timestamp.toDate() : new Date(0);
                
                // Jika reset terakhir bukan hari ini
                if (lastReset.getDate() !== now.getDate()) {
                     console.log("TRIGGERING WEEKLY RESET...");
                     // Disini admin akan memicu batch update reputasi menjadi 0
                     // Karena ini canvas dan batch update ribuan user berat, kita tandai saja log-nya
                     await setDoc(logRef, { timestamp: serverTimestamp(), type: 'weekly_reset' });
                     alert("SYSTEM: Waktunya reset mingguan (Kamis 11:00). Silakan jalankan batch update dari dashboard jika belum otomatis.");
                }
            }
        };
        // Cek setiap kali user/admin load app
        if(user) checkAutoReset();
    }, [user]);

    useEffect(() => {
        if (!profile) return;
        const lastClaim = profile.lastRewardClaim ? profile.lastRewardClaim.toMillis() : 0; const now = Date.now(); const diff = now - lastClaim; const oneDay = 24 * 60 * 60 * 1000;
        if (diff >= oneDay) { setCanClaimReward(true); setNextRewardTime(''); } else { setCanClaimReward(false); const remaining = oneDay - diff; const hrs = Math.floor(remaining / (1000 * 60 * 60)); const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)); setNextRewardTime(`${hrs} jam ${mins} menit`); }
    }, [profile, showRewards]);

    const handleClaimReward = async () => { if (!canClaimReward || !user) return; try { await updateDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { lastRewardClaim: serverTimestamp(), reputation: increment(50) }); alert("Selamat! Anda mendapatkan 50 Reputasi & Badge Aktivitas."); setShowRewards(false); } catch (e) { alert("Gagal klaim: " + e.message); } };
    const toggleDarkMode = () => { if (darkMode) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setDarkMode(false); } else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setDarkMode(true); } };

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', user.uid), where('isRead', '==', false), orderBy('timestamp', 'desc'), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => { setNotifCount(snapshot.size); snapshot.docChanges().forEach((change) => { if (change.type === "added") { const data = change.doc.data(); const now = Date.now(); const notifTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0; if (now - notifTime < 10000) { if (Notification.permission === "granted") { new Notification(APP_NAME, { body: `${data.fromUsername} ${data.message}`, icon: APP_LOGO, tag: 'bgune-notif' }); } } } }); });
        return () => unsubscribe();
    }, [user]);

    // FIX AUTH INITIALIZATION: Gunakan token dari environment jika ada
    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                try {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } catch (e) {
                    console.error("Custom token error", e);
                }
            } else {
                // Optional: Auto sign-in anonymously for read-only access
                // await signInAnonymously(auth);
            }
        };
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, async (u) => { 
            if(u) { 
                setUser(u); 
                requestNotificationPermission(u.uid); 
                const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid)); 
                if (!userDoc.exists()) { 
                    setShowOnboarding(true); 
                    setIsProfileLoaded(true); 
                } else { 
                    const userData = userDoc.data(); 
                    if (userData.isBanned) { 
                        alert("AKUN ANDA TELAH DIBLOKIR/BANNED OLEH DEVELOPER."); 
                        await signOut(auth); setUser(null); setProfile(null); 
                        return; 
                    } 
                    await updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{}); 
                } 
            } else { 
                setUser(null); 
                setProfile(null); 
                setIsProfileLoaded(true); 
            } 
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => { 
        if(user) { 
            const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), async s => { 
                if(s.exists()) { 
                    const data = s.data(); 
                    if (data.isBanned) { alert("AKUN ANDA TELAH DIBLOKIR/BANNED OLEH DEVELOPER."); await signOut(auth); return; } 
                    setProfile({...data, uid:user.uid, email:user.email}); 
                    if (showOnboarding) setShowOnboarding(false); 
                }
                setIsProfileLoaded(true); // FIX: Profile sudah loaded
            }); 
            const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size)); 
            return () => { unsubP(); unsubNotif(); }; 
        } 
    }, [user]);

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => {
            setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id})));
            setIsUsersLoaded(true); // FIX: Users (leaderboard) sudah loaded
        });
        const unsubCache = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20)), s => {
             const raw = s.docs.map(d=>({id:d.id,...d.data()}));
             setPosts(raw); 
             setIsLoadingFeed(false);
        });
        
        return () => { unsubUsers(); unsubCache(); };
    }, [refreshTrigger]); 

    const handleFollow = async (uid, isFollowing) => { if (!user) { setShowAuthModal(true); return; } if (!profile) return; const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); const targetRef = doc(db, getPublicCollection('userProfiles'), uid); try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); if (uid !== profile.uid) { await updateDoc(targetRef, { reputation: increment(5) }); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } } } catch (e) { console.error("Gagal update pertemanan", e); } };
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };
    
    // LOGIKA SCROLL PINTAR & LINK HANDLER
    const handleHomeClick = () => {
        if (page === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setPage('home');
            updateUrl({}); // Reset URL ke root
        }
    };
    
    // Wrapper untuk pindah halaman yang juga update URL
    const goToProfileSafe = (uid) => {
        setTargetUid(uid);
        setPage('other-profile');
        updateUrl({ user: uid });
    };

    // LOGIKA SPLASH SCREEN BARU:
    const isDataReady = isUsersLoaded && isProfileLoaded;
    
    if (isDataTimeout) return <ErrorBoundary><DataTimeoutPage /></ErrorBoundary>;
    if (!isDataReady) return <ErrorBoundary><SplashScreen /></ErrorBoundary>;

    if (isOffline && !posts.length) return <ErrorBoundary><OfflinePage onRetry={()=>setRefreshTrigger(prev=>prev+1)}/></ErrorBoundary>;

    const isMeDeveloper = user && user.email === DEVELOPER_EMAIL; const targetUser = users.find(u => u.uid === targetUid); const isGuest = !user; 

    return (
        <ErrorBoundary>
            <div>
                <style>{`.dark body { background-color: #111827; color: white; }`}</style>
                <div className={`min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
                    <NetworkStatus />
                    <Sidebar isOpen={showSidebar} onClose={()=>setShowSidebar(false)} user={profile} onLogout={async()=>{await signOut(auth); setPage('home'); setShowSidebar(false);}} setPage={setPage} />
                    
                    {page!=='legal' && page!=='chat_room' && ( 
                        <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md h-16 flex items-center justify-between px-4 md:px-8 z-40 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300">
                            <div className="flex items-center gap-3">
                                <button onClick={()=>setShowSidebar(true)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><Menu size={24}/></button>
                                <div className="flex items-center gap-2 cursor-pointer" onClick={handleHomeClick}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span></div>
                            </div>
                            
                            {/* DESKTOP NAV - FIX: Reordered as requested */}
                            <div className="hidden md:flex items-center gap-6 mr-4">
                                <button onClick={handleHomeClick} className={`text-sm font-bold flex items-center gap-2 ${page==='home'?'text-sky-600':'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}><Home size={18}/> Beranda</button>
                                
                                {!isGuest && <button onClick={()=>{ setPage('profile'); updateUrl({}); }} className={`text-sm font-bold flex items-center gap-2 ${page==='profile'?'text-sky-600':'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}><User size={18}/> Profil</button>}
                                
                                {/* Tombol Buat Post Ditengahkan */}
                                <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-sky-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-sky-600 transition shadow-lg shadow-sky-200 flex items-center gap-2 mx-2"><PlusCircle size={16}/> Buat Post</button>
                                
                                <button onClick={()=>{ setPage('leaderboard'); updateUrl({}); }} className={`text-sm font-bold flex items-center gap-2 ${page==='leaderboard'?'text-sky-600':'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}><Trophy size={18}/> Top 10</button>
                                
                                {!isGuest && <button onClick={()=>{ setPage('chat_list'); }} className={`text-sm font-bold flex items-center gap-2 ${page==='chat_list'?'text-sky-600':'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}><MessagesSquare size={18}/> Chat</button>}
                            </div>

                            <div className="flex gap-2 items-center">
                                <button onClick={()=>setPage('notifications')} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-500 hover:text-sky-600 transition relative"><Bell size={18}/>{notifCount>0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
                                {isGuest && <button onClick={()=>setShowAuthModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-full font-bold text-xs shadow-lg hover:bg-sky-600 transition flex items-center gap-2 ml-2"><LogIn size={16}/> Masuk</button>}
                            </div>
                        </header> 
                    )}
                    <main className={page!=='legal' && page!=='chat_room' ? 'pt-16 md:pt-20' : ''}>
                        {page==='home' && ( <><HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={goToProfileSafe} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} isLoadingFeed={isLoadingFeed} feedError={feedError} retryFeed={()=>setRefreshTrigger(p=>p+1)} homeFeedState={homeFeedState} setHomeFeedState={setHomeFeedState}/><DraggableGift onClick={() => setShowRewards(true)} canClaim={canClaimReward && !isGuest} nextClaimTime={nextRewardTime}/></> )}
                        {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage('home')}}/>}
                        {page==='search' && <SearchScreen allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={goToProfileSafe} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} initialQuery={searchQuery} setPage={setPage} setTargetPostId={(pid)=>{ setTargetPid(pid); updateUrl({post: pid}); }} />}
                        {page==='leaderboard' && <LeaderboardScreen allUsers={users} currentUser={user} />}
                        {page==='legal' && <LegalPage onBack={()=>setPage('home')} />}
                        {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={(pid)=>{ setTargetPid(pid); updateUrl({post: pid}); }} setTargetProfileId={goToProfileSafe}/>}
                        {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} allUsers={users} />}
                        {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} allUsers={users} />}
                        {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={goToProfileSafe} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}}/>}
                        
                        {/* CHAT PAGES */}
                        {page==='chat_list' && <ChatListScreen user={user} setPage={setPage} setChatId={setActiveChatId} profile={profile}/>}
                        {page==='chat_room' && activeChatId && <ChatRoomScreen user={user} chatId={activeChatId} goBack={()=>setPage('chat_list')}/>}
                    </main>
                    
                    {/* BOTTOM NAV (MOBILE ONLY) - Tetap jangan diubah kecuali penambahan Chat jika perlu */}
                    {page!=='legal' && page!=='chat_room' && ( <nav className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-full px-5 py-2.5 shadow-2xl shadow-sky-100/50 dark:shadow-none flex items-center gap-5 z-40"><NavBtn icon={Home} active={page==='home'} onClick={handleHomeClick}/><NavBtn icon={Search} active={page==='search'} onClick={()=>{ setPage('search'); updateUrl({}); }}/><button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-2.5 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={22}/></button><NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>{ setPage('leaderboard'); updateUrl({}); } }/>{isGuest ? ( <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/> ) : ( <NavBtn icon={User} active={page==='profile'} onClick={()=>{ setPage('profile'); updateUrl({}); } }/> )}</nav> )}
                    
                    {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
                    {showRewards && ( <DailyRewardModal onClose={()=>setShowRewards(false)} onClaim={handleClaimReward} canClaim={canClaimReward} nextClaimTime={nextRewardTime} isGuest={isGuest} onLoginRequest={()=>{ setShowRewards(false); setShowAuthModal(true); }} /> )}
                    {showOnboarding && user && <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>}
                    <PWAInstallPrompt />
                </div>
            </div>
        </ErrorBoundary>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}><Icon size={22} strokeWidth={active?2.5:2} /></button>);

export default App;