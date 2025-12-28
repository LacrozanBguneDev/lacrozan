import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
  useContext,
  createContext
} from "react";

// ==========================================
// BAGIAN 1: KONFIGURASI & LIBRARY (FIXED)
// ==========================================

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInAnonymously
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
  getDocs,
  startAfter,
  writeBatch
} from "firebase/firestore";

// NOTIFICATION (Optional handling)
import { getMessaging, getToken } from "firebase/messaging";

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
  RefreshCcw, LayoutGrid, TimerReset, WifiHigh, Menu, MessageCircle, 
  MoreVertical, Copy, Terminal, Plus
} from "lucide-react";

// MOCK DOMPURIFY
const DOMPurify = {
    sanitize: (html) => {
        if (!html) return "";
        return html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/on\w+="[^"]*"/g, "");
    }
};

setLogLevel("silent");

// --- CUSTOM ALERT SYSTEM ---
const CustomAlertContext = createContext();

const CustomAlertProvider = ({ children }) => {
    const [alertState, setAlertState] = useState({ 
        isOpen: false, 
        title: '',
        message: '', 
        type: 'info', 
        onConfirm: null, 
        isConfirm: false 
    });

    const showAlert = (title, message, type = 'info') => {
        return new Promise((resolve) => {
            setAlertState({ 
                isOpen: true, 
                title,
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
                title: 'Konfirmasi',
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 transform scale-100 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${alertState.type === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-sky-500 to-blue-600'}`}></div>
                        <div className="flex flex-col items-center text-center mt-2">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${alertState.type==='error'?'bg-red-50 text-red-500':'bg-sky-50 text-sky-600'} dark:bg-gray-700`}>
                                {alertState.type === 'error' ? <AlertCircle size={32}/> : alertState.type === 'confirm' ? <HelpCircle size={32}/> : <Info size={32}/>}
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{alertState.title || 'Informasi'}</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm leading-relaxed px-2">{alertState.message}</p>
                            <div className="flex gap-3 w-full">
                                {alertState.isConfirm && (
                                    <button onClick={alertState.onCancel} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm">Batal</button>
                                )}
                                <button onClick={alertState.onConfirm} className={`flex-1 py-3 px-4 text-white rounded-xl font-bold shadow-lg transition text-sm ${alertState.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200'}`}>
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

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-800 mb-2">Terjadi Kesalahan</h2>
            <p className="text-gray-500 text-sm mb-6">Aplikasi mengalami kendala teknis.</p>
            <button onClick={() => window.location.reload()} className="bg-sky-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 transition w-full">Muat Ulang Aplikasi</button>
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
const DEVELOPER_EMAIL = "admin@bgunenet.com"; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://cdn-icons-png.flaticon.com/512/3750/3750019.png"; 

// API ENDPOINT MOCK
const API_KEY = "mock-key";
const VAPID_KEY = "mock-vapid";

// ==========================================
// FIREBASE INIT
// ==========================================
let app, auth, db, googleProvider, messaging;

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const getPublicCollection = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "demo", projectId: "demo" };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  if (typeof window !== "undefined" && "serviceWorker" in navigator) { try { messaging = getMessaging(app); } catch (e) { console.warn("FCM skipped:", e); } }
} catch (error) { console.error("Firebase Init Error:", error); }

// ==========================================
// LOGIKA BACKEND DI CLIENT
// ==========================================

const safeMillis = (ts) => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

const dailySeedSort = (posts) => {
  const seed = Math.floor(Date.now() / 86400000); 
  return [...posts].sort((a, b) => {
    const ra = Math.sin(seed + (a.id?.length || 0)) * 10000;
    const rb = Math.sin(seed + (b.id?.length || 0)) * 10000;
    return rb - ra; 
  });
};

const fetchFeedData = async ({ mode = 'home', limit: limitReq = 10, cursor = null, viewerId = null, userId = null, q = null }) => {
    if (!db) return { posts: [], nextCursor: null };
    try {
        let qRef = collection(db, getPublicCollection('posts'));
        let constraints = [];

        if (mode === 'meme') constraints.push(where('category', '==', 'meme'));
        if (mode === 'user' && userId) constraints.push(where('userId', '==', userId));
        
        if (mode === 'following' && viewerId) {
             const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), viewerId));
             if (userDoc.exists()) {
                 const following = userDoc.data().following || [];
                 if (following.length > 0) {
                     constraints.push(where('userId', 'in', following.slice(0, 10)));
                 } else { return { posts: [], nextCursor: null }; }
             } else { return { posts: [], nextCursor: null }; }
        }

        if (mode === 'search' && q) {
            constraints.push(orderBy('timestamp', 'desc'));
            constraints.push(limit(50)); 
        } else {
            constraints.push(orderBy('timestamp', 'desc'));
            constraints.push(limit(limitReq * 2)); 
        }

        if (cursor) {
             const cursorDoc = await getDoc(doc(db, getPublicCollection('posts'), cursor));
             if (cursorDoc.exists()) constraints.push(startAfter(cursorDoc));
        }

        const finalQuery = query(qRef, ...constraints);
        const snapshot = await getDocs(finalQuery);

        if (snapshot.empty) return { posts: [], nextCursor: null };

        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: safeMillis(d.data().timestamp) }));

        if (mode === 'search' && q) {
            const lowerQ = q.toLowerCase();
            posts = posts.filter(p => (p.title && p.title.toLowerCase().includes(lowerQ)) || (p.content && p.content.toLowerCase().includes(lowerQ)));
        }

        if (mode === 'home' || mode === 'popular') {
             posts = dailySeedSort(posts); 
        }

        posts = posts.slice(0, limitReq);

        const uids = [...new Set(posts.map(p => p.userId).filter(Boolean))];
        const userMap = {};
        await Promise.all(uids.map(async (uid) => {
            if (userMap[uid]) return;
            try {
                const uSnap = await getDoc(doc(db, getPublicCollection('userProfiles'), uid));
                if (uSnap.exists()) { userMap[uid] = uSnap.data(); }
            } catch (e) { }
        }));

        const enrichedPosts = posts.map(p => ({
            ...p,
            user: userMap[p.userId] || { username: 'Pengguna', photoURL: null, reputation: 0, email: '' }
        }));

        const nextCursor = snapshot.docs[snapshot.docs.length - 1]?.id || null;
        return { posts: enrichedPosts, nextCursor };
    } catch (e) {
        console.error("Feed Logic Error:", e);
        return { posts: [], nextCursor: null };
    }
};

// ==========================================
// UTILITY LAINNYA
// ==========================================

const logSystemError = async (error, context = 'general', user = null) => { console.warn(`[Log] ${context}:`, error); };
const requestNotificationPermission = async (userId) => { return; };

const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 480; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const uploadToFaaAPI = async (file, onProgress) => {
    onProgress(50);
    const b64 = await compressImageToBase64(file);
    onProgress(100);
    return b64;
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
        if (seconds < 60) return { relative: 'Baru saja', full: '' };
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return { relative: `${minutes}m`, full: '' };
        const hours = Math.floor(minutes / 60);
        return { relative: `${hours}j`, full: '' };
    } catch (e) { return { relative: 'Baru saja', full: '' }; }
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; }
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
// BAGIAN 3: KOMPONEN UI
// ==========================================

const DraggableGift = ({ onClick, canClaim, nextClaimTime }) => {
    return (
        <div className="fixed bottom-24 right-4 z-[55] cursor-pointer hidden md:block">
            <button onClick={onClick} className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2.5 rounded-full shadow-2xl shadow-orange-500/50 relative group active:scale-95 transition-transform">
                <GiftIcon size={24} className={`text-white ${canClaim ? 'animate-bounce' : ''}`}/>
                {canClaim && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
        </div>
    );
};

const Avatar = ({ src, alt, className, fallbackText }) => {
    const [error, setError] = useState(false);
    const safeFallback = fallbackText ? fallbackText : "?";
    if (!src || error) { return ( <div className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-black text-gray-500 dark:text-gray-400 select-none`}>{safeFallback[0]?.toUpperCase() || '?'}</div> ); }
    return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setError(true)} loading="lazy" />;
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

const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-gray-900 dark:to-black z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow"><img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/><div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div></div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Menghubungkan ke server...</p>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-800 animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
    </div>
);

const renderMarkdown = (text, onHashtagClick) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = DOMPurify.sanitize(text.replace(/</g, "&lt;")); 
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline hashtag" data-tag="$1">#$1</span>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-[13px] md:text-sm" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => { if (e.target.classList.contains('hashtag')) { e.stopPropagation(); if(onHashtagClick) onHashtagClick(e.target.getAttribute('data-tag')); } }}/>;
};

// ==========================================
// NEW: SIDEBAR COMPONENT
// ==========================================
const Sidebar = ({ isOpen, onClose, user, onPageChange, isDev, toggleEruda, onLogout }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-800 w-[280px] h-full shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-left duration-300">
                <div className="p-6 border-b dark:border-gray-700 flex items-center gap-3">
                    <img src={APP_LOGO} className="w-10 h-10"/>
                    <div>
                        <h2 className="font-black text-xl text-sky-600">{APP_NAME}</h2>
                        <p className="text-[10px] text-gray-400">Versi 2.5 (Modern Feed)</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {user && (
                        <div className="mb-6 bg-sky-50 dark:bg-gray-700 p-3 rounded-xl flex items-center gap-3">
                             <Avatar src={user.photoURL} className="w-10 h-10 rounded-full"/>
                             <div className="min-w-0">
                                 <p className="font-bold text-sm truncate dark:text-white">{user.displayName || 'Pengguna'}</p>
                                 <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                             </div>
                        </div>
                    )}
                    
                    <div className="space-y-1">
                        <button onClick={()=>{onPageChange('chat'); onClose();}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 font-bold text-gray-700 dark:text-gray-200"><MessageCircle size={18} className="text-sky-500"/> Chat Room</button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
                        <button onClick={()=>{onPageChange('legal_privacy'); onClose();}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300"><Lock size={16}/> Kebijakan Privasi</button>
                        <button onClick={()=>{onPageChange('legal_tos'); onClose();}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300"><FileText size={16}/> Ketentuan Layanan</button>
                        <button onClick={()=>{onPageChange('legal_guide'); onClose();}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300"><BookOpen size={16}/> Panduan Komunitas</button>
                        <button onClick={()=>{onPageChange('legal_dmca'); onClose();}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300"><ShieldAlert size={16}/> Laporan / DMCA</button>
                    </div>

                    {isDev && (
                        <div className="mt-4 p-3 bg-gray-900 rounded-xl text-white">
                            <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Developer Tools</p>
                            <button onClick={toggleEruda} className="w-full py-2 bg-gray-800 rounded-lg text-xs font-mono flex items-center justify-center gap-2 hover:bg-gray-700"><Terminal size={14}/> Toggle Eruda Console</button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t dark:border-gray-700">
                     {user ? (
                         <button onClick={onLogout} className="w-full py-3 bg-rose-50 text-rose-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100"><LogOut size={18}/> Keluar Akun</button>
                     ) : (
                         <p className="text-center text-xs text-gray-400">Mode Tamu</p>
                     )}
                     <div className="mt-4 text-center">
                         <p className="text-[10px] text-gray-400">BguneNet Dibawah Naungan</p>
                         <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Bgune - Digital</p>
                     </div>
                </div>
            </div>
        </div>
    );
}

const ChatScreen = ({ currentUser, profile, onBack, onRequestLogin }) => {
    const [view, setView] = useState('list'); 
    const [activeChat, setActiveChat] = useState(null);
    const [chatList, setChatList] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [showNewChat, setShowNewChat] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!currentUser || view !== 'list') return;
        const q = query(collection(db, getPublicCollection('chats')), where('participants', 'array-contains', currentUser.uid), orderBy('lastMessageTime', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setChatList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser, view]);

    useEffect(() => {
        if (!activeChat || view !== 'room') return;
        const q = query(collection(db, getPublicCollection('chats'), activeChat.id, 'messages'), orderBy('timestamp', 'asc'), limit(100));
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
        return () => unsub();
    }, [activeChat, view]);

    const startChat = async (targetUser) => {
        const existing = chatList.find(c => c.participants.includes(targetUser.uid));
        if (existing) { setActiveChat(existing); setView('room'); } 
        else {
            const newChatRef = await addDoc(collection(db, getPublicCollection('chats')), {
                participants: [currentUser.uid, targetUser.uid],
                users: { [currentUser.uid]: { username: profile.username, photoURL: profile.photoURL }, [targetUser.uid]: { username: targetUser.username, photoURL: targetUser.photoURL } },
                lastMessage: 'Chat dimulai', lastMessageTime: serverTimestamp()
            });
            setActiveChat({ id: newChatRef.id, users: { [targetUser.uid]: targetUser } }); setView('room');
        }
        setShowNewChat(false);
    };

    const sendMessage = async (e) => {
        e.preventDefault(); if (!inputText.trim()) return;
        const text = inputText; setInputText('');
        try {
            await addDoc(collection(db, getPublicCollection('chats'), activeChat.id, 'messages'), { senderId: currentUser.uid, text: text, timestamp: serverTimestamp(), readBy: [currentUser.uid] });
            await updateDoc(doc(db, getPublicCollection('chats'), activeChat.id), { lastMessage: text, lastMessageTime: serverTimestamp() });
        } catch(e) { console.error(e); }
    };

    const deleteMessage = async (msgId) => { if (confirm("Hapus pesan ini?")) { await deleteDoc(doc(db, getPublicCollection('chats'), activeChat.id, 'messages', msgId)); } };

    const NewChatModal = () => {
        const [friends, setFriends] = useState([]);
        useEffect(() => {
            const loadFriends = async () => {
                if (!profile?.following?.length) return;
                const q = query(collection(db, getPublicCollection('userProfiles')), where('uid', 'in', profile.following.slice(0, 10)));
                const s = await getDocs(q); setFriends(s.docs.map(d => d.data()));
            };
            loadFriends();
        }, []);
        return (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-4 h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold dark:text-white">Mulai Chat Baru</h3><button onClick={()=>setShowNewChat(false)}><X/></button></div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {friends.length === 0 ? <p className="text-center text-gray-400 mt-10">Kamu belum mengikuti siapapun.</p> : friends.map(f => ( <div key={f.uid} onClick={()=>startChat(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><Avatar src={f.photoURL} className="w-10 h-10 rounded-full"/><span className="font-bold text-sm dark:text-white">{f.username}</span></div> ))}
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) return ( <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-900"><MessageCircle size={48} className="text-sky-200 mb-4"/><h2 className="text-xl font-bold dark:text-white">Login untuk Chat</h2><p className="text-gray-500 mb-6">Ngobrol seru dengan teman-temanmu!</p><button onClick={onRequestLogin} className="bg-sky-500 text-white px-6 py-2 rounded-full font-bold">Login Sekarang</button><button onClick={onBack} className="mt-4 text-gray-400 text-xs">Kembali</button></div> );

    if (view === 'room') {
        const otherUserId = Object.keys(activeChat.users || {}).find(uid => uid !== currentUser.uid);
        const otherUser = activeChat.users[otherUserId] || { username: 'User' };
        return (
            <div className="fixed inset-0 z-[110] bg-[#F0F4F8] dark:bg-gray-900 flex flex-col">
                <div className="bg-white dark:bg-gray-800 p-3 flex items-center gap-3 shadow-sm z-10"><button onClick={()=>setView('list')}><ArrowLeft className="dark:text-white"/></button><Avatar src={otherUser.photoURL} className="w-10 h-10 rounded-full"/><div><h3 className="font-bold text-sm dark:text-white">{otherUser.username}</h3><span className="text-[10px] text-green-500 flex items-center gap-1">● Online</span></div></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 bg-pattern">{messages.map(m => { const isMe = m.senderId === currentUser.uid; return ( <div key={m.id} onDoubleClick={()=>navigator.clipboard.writeText(m.text)} onContextMenu={(e)=>{e.preventDefault(); if(isMe) deleteMessage(m.id);}} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] p-3 rounded-2xl text-sm relative group ${isMe ? 'bg-sky-500 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 dark:text-white rounded-bl-none shadow-sm'}`}>{m.text}<span className={`text-[9px] block mt-1 opacity-70 ${isMe ? 'text-sky-100' : 'text-gray-400'}`}>{m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span></div></div> ) })}<div ref={messagesEndRef}/></div>
                <form onSubmit={sendMessage} className="bg-white dark:bg-gray-800 p-3 flex gap-2 items-center sticky bottom-0 border-t dark:border-gray-700"><input value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="Tulis pesan..." className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"/><button type="submit" disabled={!inputText.trim()} className="bg-sky-500 text-white p-2.5 rounded-full hover:bg-sky-600 disabled:opacity-50"><Send size={18}/></button></form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pt-16">
            <div className="px-4 py-2 border-b dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10"><h2 className="font-black text-xl dark:text-white">Chat</h2><button onClick={()=>setShowNewChat(true)}><PlusCircle className="text-sky-500"/></button></div>
            {loading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-sky-500"/></div> : ( <div className="divide-y dark:divide-gray-800">{chatList.length === 0 ? ( <div className="text-center py-20"><MessageCircle className="w-24 h-24 mx-auto mb-4 opacity-50 text-gray-300"/><p className="text-gray-400">Belum ada chat.</p><button onClick={()=>setShowNewChat(true)} className="mt-4 text-sky-500 font-bold text-sm">Mulai Chat Baru</button></div> ) : chatList.map(chat => { const otherUserId = Object.keys(chat.users).find(uid => uid !== currentUser.uid); const otherUser = chat.users[otherUserId] || { username: 'Unknown' }; return ( <div key={chat.id} onClick={()=>{setActiveChat(chat); setView('room');}} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"><Avatar src={otherUser.photoURL} className="w-12 h-12 rounded-full"/><div className="flex-1 min-w-0"><div className="flex justify-between items-center mb-1"><h4 className="font-bold text-gray-800 dark:text-white truncate">{otherUser.username}</h4><span className="text-[10px] text-gray-400">{chat.lastMessageTime?.toDate ? formatTimeAgo(chat.lastMessageTime).relative : ''}</span></div><p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p></div></div> ); })}</div> )}
            {showNewChat && <NewChatModal/>}
        </div>
    );
};

// ==========================================
// SCREENS
// ==========================================

const OnboardingScreen = ({ onComplete, user }) => {
    const { showAlert } = useCustomAlert();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => { e.preventDefault(); if (!username.trim()) return await showAlert("Peringatan", "Username wajib diisi!", 'error'); setLoading(true); try { await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { username: username.trim(), email: user.email, uid: user.uid, photoURL: user.photoURL || '', createdAt: serverTimestamp(), following: [], followers: [], savedPosts: [], lastSeen: serverTimestamp(), reputation: 0, lastPostTime: 0 }); onComplete(); } catch (error) { await showAlert("Error", "Gagal menyimpan data: " + error.message, 'error'); } finally { setLoading(false); } };
    return (
        <div className="fixed inset-0 bg-white z-[80] flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-sm text-center"><img src={APP_LOGO} className="w-24 h-24 mx-auto mb-6 object-contain"/><h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang! 👋</h2><p className="text-gray-500 mb-8 text-sm">Lengkapi profil Anda untuk mulai berinteraksi.</p><form onSubmit={handleSubmit} className="space-y-4"><div className="text-left"><label className="text-xs font-bold text-gray-600 ml-1">Username Unik</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Contoh: user_keren123" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none"/></div><button disabled={loading} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Mulai Menjelajah"}</button></form></div>
        </div>
    );
};

const AuthModal = ({ onClose }) => {
    const { showAlert } = useCustomAlert();
    const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); onClose(); } catch (error) { console.error(error); await showAlert("Error", "Gagal login dengan Google.", 'error'); } };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button><div className="text-center mb-6"><img src={APP_LOGO} className="w-16 h-16 mx-auto mb-3"/><h2 className="text-xl font-black text-gray-800 dark:text-white">Masuk ke {APP_NAME}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bergabunglah dengan komunitas sekarang!</p></div><button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Lanjutkan dengan Google</button></div>
        </div>
    );
};

const LegalPage = ({ onBack, section }) => {
    let content = null; let title = "";
    if (section === 'privacy') { title = "Kebijakan Privasi"; content = <p>Kami menjaga data Anda. Data yang dikoleksi hanya untuk keperluan login dan interaksi.</p>; }
    if (section === 'tos') { title = "Ketentuan Layanan"; content = <p>Dilarang spam, ujaran kebencian, dan konten ilegal.</p>; }
    if (section === 'guide') { title = "Panduan Komunitas"; content = <p>Jadilah pengguna yang ramah dan saling menghormati.</p>; }
    if (section === 'dmca') { title = "Laporan & DMCA"; content = <p>Laporkan konten melanggar hak cipta ke admin@bgunenet.com</p>; }
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pb-24 pt-20 px-6 max-w-2xl mx-auto animate-in fade-in"><button onClick={onBack} className="fixed top-6 left-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"><ArrowLeft/></button><div className="text-center mb-10"><Scale className="w-12 h-12 mx-auto text-sky-600 mb-4"/><h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{title}</h1></div><div className="prose dark:prose-invert mx-auto">{content}</div></div>
    );
};

const LeaderboardScreen = ({ allUsers, currentUser }) => {
    const sortedUsers = useMemo(() => { if (!allUsers) return []; return [...allUsers].sort((a, b) => (b.reputation || 0) - (a.reputation || 0)); }, [allUsers]);
    const top10 = sortedUsers.slice(0, 10);
    const myRankIndex = currentUser ? sortedUsers.findIndex(u => u.uid === currentUser.uid) : -1;
    return (
        <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto p-4 pb-24 pt-20">
            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Top 10 Legenda</h1>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-fit">
                {top10.length === 0 ? <p className="p-6 text-center text-gray-400">Belum ada data.</p> : top10.map((u, index) => (
                    <div key={u.uid} className={`flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 ${index===0 ? "bg-yellow-50/50" : ""}`}><div className={`w-8 h-8 flex items-center justify-center font-black text-lg mr-3`}>{index + 1}</div><Avatar src={u.photoURL} fallbackText={u.username} className={`w-12 h-12 rounded-full border-2 mr-3`}/><div className="flex-1"><h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{u.username || 'User'}</h3><p className="text-xs text-gray-500">{u.reputation || 0} Poin</p></div></div>
                ))}
            </div>
            {currentUser && myRankIndex > 9 && ( <div className="mt-4 bg-sky-50 p-4 rounded-xl text-center text-sky-800 font-bold text-sm">Posisi Kamu: #{myRankIndex + 1}</div> )}
        </div>
    );
};

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isGuest, onRequestLogin }) => {
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
            if (post.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), post.userId), { reputation: increment(1) }); if (!replyTo) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id); }
            if (replyTo && replyTo.userId !== currentUserId) { await updateDoc(doc(db, getPublicCollection('userProfiles'), replyTo.userId), { reputation: increment(1) }); sendNotification(replyTo.userId, 'comment', `membalas komentar Anda: "${newComment.substring(0,15)}.."`, profile, post.id); }
            setNewComment(''); setReplyTo(null);
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        const ok = await showConfirm("Hapus postingan ini? Reputasi yang didapat akan DITARIK KEMBALI.");
        if (ok) { try { const earnedReputation = 2 + ((post.likes?.length || 0) * 1) + ((post.commentsCount || 0) * 1); const userRef = doc(db, getPublicCollection('userProfiles'), post.userId); await updateDoc(userRef, { reputation: increment(-earnedReputation) }); await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); await showAlert("Berhasil", "Postingan dihapus.", 'success'); } catch (e) { await showAlert("Gagal", e.message, 'error'); } } 
    };
    const handleDeleteComment = async (commentId) => { const ok = await showConfirm("Hapus komentar?"); if(ok) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); await showAlert("Berhasil", "Link disalin!", 'success'); } catch (e) { await showAlert("Gagal", "Tidak bisa menyalin link.", 'error'); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.toMillis || 0) - (b.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isVideo = post.mediaType === 'video' || ((post.mediaUrl && /\.(mp4|webm)$/i.test(post.mediaUrl)) && !embed);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 
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
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">{!isGuest && <button onClick={()=>setReplyTo(c)} className="text-gray-400 hover:text-sky-500"><Reply size={12}/></button>}{(currentUserId === c.userId || isDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500"><Trash size={12}/></button>}</div>
                    </div>
                </div>
                {replies.length > 0 && ( <div className="mt-1"><div className="space-y-3">{visibleReplies.map(reply => ( <CommentItem key={reply.id} c={reply} isReply={true} /> ))}</div>{replies.length > 2 && !showAllReplies && ( <button onClick={() => setShowAllReplies(true)} className="ml-8 text-[10px] font-bold text-sky-600 hover:underline flex items-center mb-2">Lihat {replies.length - 2} balasan lainnya...</button> )}</div> )}
            </div>
        );
    };
    const CommentList = ({ commentList }) => ( <div className="space-y-3">{commentList.map(c => <CommentItem key={c.id} c={c} isReply={false} />)}</div> );

    // --- UI MODERN FEED STYLE ---
    return (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 p-4 mb-0 animate-in fade-in transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
            {post.isShort && <div className="mb-2"><span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center w-fit"><Zap size={8} className="mr-1 text-yellow-400"/> SHORT</span></div>}
            
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        <Avatar src={post.user?.photoURL} fallbackText={post.user?.username || "?"} className="w-full h-full object-cover"/>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white cursor-pointer hover:underline" onClick={() => goToProfile(post.userId)}>{post.user?.username || 'User'}</h4>
                            <span className="text-gray-400 text-xs">• {formatTimeAgo(post.timestamp).relative}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             {isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>}
                             {isMeme && <span className="bg-yellow-100 text-yellow-800 text-[9px] px-1.5 py-0.5 rounded font-bold">MEME</span>}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-1">
                    {!isOwner && post.userId !== currentUserId && ( 
                         <button onClick={() => isGuest ? onRequestLogin() : handleFollow(post.userId, isFollowing)} className={`p-2 rounded-full transition ${isFollowing ? 'text-sky-500 bg-sky-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                             {isFriend ? <UserCheck size={16}/> : <UserPlus size={16}/>}
                         </button> 
                    )}
                    {(isOwner || isDeveloper) && !isGuest && ( 
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
                         {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black rounded-lg outline-none"/>}
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
                    <button onClick={handleLike} className={`flex items-center gap-1.5 transition group hover:text-rose-500 ${liked ? 'text-rose-500' : ''}`}><Heart size={20} fill={liked ? 'currentColor' : 'none'} className="group-active:scale-125 transition-transform"/> <span className="text-xs font-medium">{likeCount || 0}</span></button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 transition hover:text-sky-500"><MessageSquare size={20} /> <span className="text-xs font-medium">{post.commentsCount || 0}</span></button>
                    <button onClick={sharePost} className="flex items-center gap-1.5 transition hover:text-green-500"><Share2 size={20} /></button>
                </div>
                <button onClick={handleSave} className={`transition hover:text-sky-500 ${isSaved ? 'text-sky-500' : ''}`}><Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} /></button>
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

const CreatePost = ({ setPage, userId, username, onSuccess, userPhoto }) => {
    const { showAlert } = useCustomAlert();
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '', isShort: false, isAudio: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);
    const [loadingText, setLoadingText] = useState("Menyiapkan...");

    // Fun Loading Text
    useEffect(() => {
        if(loading) {
            const texts = ["Menghubungi satelit...", "Memasak postingan...", "Mengirim sinyal ke Mars...", "Sabar ya...", "Menyusun pixel...", "Mengupload kenangan...", "Hampir siap..."];
            const interval = setInterval(() => setLoadingText(texts[Math.floor(Math.random() * texts.length)]), 1500);
            return () => clearInterval(interval);
        }
    }, [loading]);

    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    const handleFileChange = (e) => { const selectedFiles = Array.from(e.target.files); if (selectedFiles.length > 0) { const isAudio = selectedFiles[0].type.startsWith('audio'); const isVideo = selectedFiles[0].type.startsWith('video'); setForm({ ...form, files: selectedFiles, isShort: isVideo, isAudio: isAudio, url: '' }); } };
    const submit = async (e) => {
        e.preventDefault(); 
        try { const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), userId)); if (userDoc.exists()) { const userData = userDoc.data(); const lastPost = userData.lastPostTime || 0; const now = Date.now(); if (now - lastPost < 60000) { await showAlert("Tunggu", "Tunggu 1 menit sebelum memposting lagi.", 'error'); return; } } } catch(err) { console.error("Gagal cek cooldown", err); }
        setLoading(true); setProg(0); setLoadingText("Memulai...");
        try {
            let mediaUrls = []; let mediaType = 'text';
            if (form.files.length > 0) { const firstFile = form.files[0]; if (firstFile.type.startsWith('image')) { mediaType = 'image'; setProg(10); for (let i = 0; i < form.files.length; i++) { const base64 = await compressImageToBase64(form.files[i]); mediaUrls.push(base64); setProg(10 + ((i + 1) / form.files.length) * 80); } } else if (firstFile.type.startsWith('video') || firstFile.type.startsWith('audio')) { const uploadedUrl = await uploadToFaaAPI(firstFile, setProg); mediaUrls.push(uploadedUrl); mediaType = firstFile.type.startsWith('video') ? 'video' : 'audio'; setProg(100); } } else if (form.url) { mediaType = 'link'; mediaUrls.push(form.url); }
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), { userId, title: form.title, content: form.content, mediaUrls: mediaUrls, mediaUrl: mediaUrls[0] || '', mediaType: mediaType, timestamp: serverTimestamp(), likes: [], commentsCount: 0, category: category, user: {username, uid: userId, photoURL: userPhoto} });
            await updateDoc(doc(db, getPublicCollection('userProfiles'), userId), { reputation: increment(2), lastPostTime: Date.now() }); 
            setProg(100); setTimeout(()=>onSuccess(ref.id, false), 500); await showAlert("Berhasil", "Postingan diterbitkan!", 'success');
        } catch(e){ await showAlert("Gagal", e.message, 'error'); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-md md:max-w-xl lg:max-w-2xl mx-auto p-4 pb-24 pt-20 relative">
             {loading && (
                <div className="fixed inset-0 z-[100] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
                    <Loader2 size={48} className="text-sky-500 animate-spin mb-4"/>
                    <p className="text-sky-600 font-bold text-lg animate-pulse">{loadingText}</p>
                    <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>
                </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden mt-4">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-gray-800 dark:text-white">Buat Postingan</h2><button onClick={()=>setPage('home')} className="text-gray-400 hover:text-gray-600"><X/></button></div>
                <form onSubmit={submit} className="space-y-4">
                    <div className="flex gap-4">
                        <Avatar src={userPhoto} className="w-10 h-10 rounded-full"/>
                        <div className="flex-1 space-y-2">
                            <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full bg-transparent font-bold text-sm outline-none dark:text-white"/>
                            <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi?" className="w-full min-h-[150px] text-base outline-none bg-transparent placeholder:text-gray-400 dark:text-white resize-none" autoFocus/>
                        </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
                        <div className="flex gap-4">
                            <label className="cursor-pointer text-sky-500 hover:bg-sky-50 p-2 rounded-full transition"><ImageIcon size={20}/><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} disabled={loading}/></label>
                            <label className="cursor-pointer text-pink-500 hover:bg-pink-50 p-2 rounded-full transition"><Music size={20}/><input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={loading}/></label>
                            <button type="button" onClick={insertLink} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition"><LinkIcon size={20}/></button>
                        </div>
                        <button disabled={loading || (!form.content && form.files.length === 0 && !form.url)} className="px-6 py-2 bg-sky-500 text-white rounded-full font-bold shadow-md hover:bg-sky-600 disabled:opacity-50 text-sm">Posting</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest, allUsers }) => {
    const { showAlert } = useCustomAlert();
    const [edit, setEdit] = useState(false); const [name, setName] = useState(profileData?.username || ''); const [file, setFile] = useState(null); const [load, setLoad] = useState(false); const [showDev, setShowDev] = useState(false); const [activeTab, setActiveTab] = useState('posts'); const [mood, setMood] = useState(profileData?.mood || ''); const [isEditingMood, setIsEditingMood] = useState(false);
    const [localPosts, setLocalPosts] = useState([]); const [loadingLocal, setLoadingLocal] = useState(true);
    const viewerUid = viewerProfile ? viewerProfile.uid : null; const isSelf = viewerUid === profileData?.uid; const isDev = profileData?.email === DEVELOPER_EMAIL;

    useEffect(() => {
        setLoadingLocal(true); setLocalPosts([]); 
        const fetchUserPosts = async () => { try { const data = await fetchFeedData({ mode: 'user', userId: profileData?.uid, limit: 20 }); const enrichedPosts = data.posts.map(p => ({ ...p, user: profileData })); setLocalPosts(enrichedPosts); } catch (e) { console.error("Profile Fetch Error:", e); } finally { setLoadingLocal(false); } };
        if (profileData?.uid) { fetchUserPosts(); }
    }, [profileData?.uid]); 

    if (!profileData) { return ( <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center pt-24"><User size={48} className="text-gray-300 mb-4"/><h3 className="text-gray-500 font-bold text-lg">Profil Tidak Ditemukan</h3><p className="text-gray-400 text-sm mt-2 max-w-xs">Pengguna ini mungkin tidak ada atau data sedang dimuat.</p><button onClick={() => window.location.reload()} className="mt-6 text-sky-500 font-bold text-xs hover:underline">Muat Ulang Halaman</button></div> ); }

    const followersCount = (profileData.followers || []).length; const followingCount = (profileData.following || []).length; const targetFollowers = profileData.followers || []; const targetFollowing = profileData.following || []; const friendsCount = targetFollowing.filter(id => targetFollowers.includes(id)).length;
    const save = async () => { setLoad(true); try { let url = profileData.photoURL; if (file) { url = await compressImageToBase64(file); } await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); setEdit(false); } catch(e){ await showAlert("Error", e.message, 'error'); } finally{setLoad(false)}; };
    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    const badge = getReputationBadge(profileData.reputation || 0, isDev);
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; const isFollowedByTarget = viewerProfile ? (viewerProfile.followers || []).includes(profileData.uid) : false; const isFriend = isFollowing && isFollowedByTarget; const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];
    let rank = null; if (allUsers) { const sorted = [...allUsers].sort((a,b) => (b.reputation||0) - (a.reputation||0)); rank = sorted.findIndex(u => u.uid === profileData.uid) + 1; }
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
            <div className="px-0">
                {activeTab === 'posts' ? (
                    loadingLocal ? <div className="px-4"><SkeletonPost /></div> :
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

const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick, homeFeedState, setHomeFeedState }) => {
    const { posts: feedPosts, cursor: nextCursor, sortType, hasLoaded } = homeFeedState;
    const [loading, setLoading] = useState(false);
    const [feedError, setFeedError] = useState(false);
    const bottomRef = useRef(null);

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

    // PINNED POST LOGIC
    const finalPosts = [...feedPosts];
    if (newPostId) { 
        const newlyCreated = allPosts.find(p => p.id === newPostId); 
        if (newlyCreated && !finalPosts.find(p => p.id === newPostId)) { 
            finalPosts.unshift(newlyCreated); 
        } 
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-24 px-0 md:px-0 pt-4"> 
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
                        <div key={p.id} className={`${p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700 bg-sky-50/30" : ""}`}>
                            {p.id === newPostId && <div className="bg-sky-100 text-sky-700 text-xs font-bold text-center py-1 flex items-center justify-center gap-2"><CheckCircle size={12}/> Postingan Baru</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile?.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={onRequestLogin} onHashtagClick={onHashtagClick}/>
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
    useEffect(() => { const q = query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50)); return onSnapshot(q, s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead))); }, [userId]);
    const handleClick = async (n) => { await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true}); if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); } else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); } };
    return <div className="max-w-md md:max-w-xl mx-auto p-4 pb-24 pt-20"><h1 className="text-xl font-black text-gray-800 dark:text-white mb-6">Notifikasi</h1>{notifs.length===0?<div className="text-center py-20 text-gray-400">Tidak ada notifikasi baru.</div>:<div className="space-y-3">{notifs.map(n=><div key={n.id} onClick={()=>handleClick(n)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>{n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}</div></div><div className="flex-1"><p className="text-sm font-bold dark:text-gray-200">{n.fromUsername}</p><p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p></div></div>)}</div>}</div>;
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const cachedPost = allPosts.find(p => p.id === postId);
    const [fetchedPost, setFetchedPost] = useState(cachedPost || null);
    const [loading, setLoading] = useState(!cachedPost);
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
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        if (postId) fetchSinglePost();
    }, [postId, cachedPost]);
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-sky-500"/></div>;
    if (!fetchedPost) return <div className="p-10 text-center text-gray-400 mt-20">Postingan tidak ditemukan atau telah dihapus.<br/><button onClick={handleBack} className="text-sky-600 font-bold mt-4">Kembali ke Beranda</button></div>;
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

const App = () => {
    return (
        <CustomAlertProvider>
            <MainAppContent />
        </CustomAlertProvider>
    );
};

const MainAppContent = () => {
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
    const [showRewards, setShowRewards] = useState(false); const [canClaimReward, setCanClaimReward] = useState(false); 
    const [nextRewardTime, setNextRewardTime] = useState('');
    
    // NEW STATE: Sidebar & Eruda
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [erudaEnabled, setErudaEnabled] = useState(false);

    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [isUsersLoaded, setIsUsersLoaded] = useState(false);
    const [isDataTimeout, setIsDataTimeout] = useState(false);

    const [homeFeedState, setHomeFeedState] = useState({ posts: [], cursor: null, sortType: 'home', hasLoaded: false, scrollPos: 0 });

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
        if (!profile) return;
        const lastClaim = profile.lastRewardClaim ? profile.lastRewardClaim.toMillis() : 0; const now = Date.now(); const diff = now - lastClaim; const oneDay = 24 * 60 * 60 * 1000;
        if (diff >= oneDay) { setCanClaimReward(true); setNextRewardTime(''); } else { setCanClaimReward(false); const remaining = oneDay - diff; const hrs = Math.floor(remaining / (1000 * 60 * 60)); const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)); setNextRewardTime(`${hrs} jam ${mins} menit`); }
    }, [profile, showRewards]);

    const handleClaimReward = async () => { if (!canClaimReward || !user) return; try { await updateDoc(doc(db, getPublicCollection('userProfiles'), user.uid), { lastRewardClaim: serverTimestamp(), reputation: increment(50) }); await showAlert("Selamat!", "Anda mendapatkan 50 Reputasi & Badge Aktivitas.", 'success'); setShowRewards(false); } catch (e) { await showAlert("Error", "Gagal klaim: " + e.message, 'error'); } };
    const handleLogout = async () => { const ok = await showConfirm("Yakin ingin keluar akun?"); if(ok) { await signOut(auth); setPage('home'); setSidebarOpen(false); } };
    
    // Toggle Eruda Debugger
    const toggleEruda = () => {
        if (erudaEnabled) { if (window.eruda) window.eruda.destroy(); setErudaEnabled(false); } 
        else { const script = document.createElement('script'); script.src = "//cdn.jsdelivr.net/npm/eruda"; script.onload = () => { window.eruda.init(); setErudaEnabled(true); }; document.body.appendChild(script); }
    };

    useEffect(() => { const p = new URLSearchParams(window.location.search).get('post'); if (p) { setTargetPid(p); setPage('view_post'); } }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', user.uid), where('isRead', '==', false), orderBy('timestamp', 'desc'), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => { setNotifCount(snapshot.size); snapshot.docChanges().forEach((change) => { if (change.type === "added") { const data = change.doc.data(); const now = Date.now(); const notifTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0; if (now - notifTime < 10000) { if (Notification.permission === "granted") { new Notification(APP_NAME, { body: `${data.fromUsername} ${data.message}`, icon: APP_LOGO, tag: 'bgune-notif' }); } } } }); });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => onAuthStateChanged(auth, async (u) => { 
        if(u) { 
            setUser(u); 
            requestNotificationPermission(u.uid); 
            try {
                const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid)); 
                if (!userDoc.exists()) { setShowOnboarding(true); setIsProfileLoaded(true); } 
                else { 
                    const userData = userDoc.data(); 
                    if (userData.isBanned) { await showAlert("Error", "AKUN ANDA TELAH DIBLOKIR/BANNED.", 'error'); await signOut(auth); setUser(null); setProfile(null); return; } 
                    await updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{}); 
                }
            } catch(e) { console.error("Auth State change error:", e); setIsProfileLoaded(true); }
        } else { setUser(null); setProfile(null); setIsProfileLoaded(true); } 
    }), []);
    
    useEffect(() => { 
        if(user) { 
            const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), 
                async s => { if(s.exists()) { const data = s.data(); if (data.isBanned) { await showAlert("Error", "AKUN ANDA TELAH DIBLOKIR/BANNED.", 'error'); await signOut(auth); return; } setProfile({...data, uid:user.uid, email:user.email}); if (showOnboarding) setShowOnboarding(false); } setIsProfileLoaded(true); },
                (error) => { console.error("Profile Snapshot Error:", error); setIsProfileLoaded(true); }
            ); 
            const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size)); 
            return () => { unsubP(); unsubNotif(); }; 
        } 
    }, [user]);

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), (s) => { setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))); setIsUsersLoaded(true); }, (error) => { console.error("CRITICAL ERROR: Gagal load userProfiles.", error); setIsUsersLoaded(true); });
        const unsubCache = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20)), (s) => { const raw = s.docs.map(d=>({id:d.id,...d.data()})); setPosts(raw); setIsLoadingFeed(false); }, (error) => { console.error("CRITICAL ERROR: Gagal load posts cache.", error); setIsLoadingFeed(false); });
        return () => { unsubUsers(); unsubCache(); };
    }, [refreshTrigger]); 

    const handleFollow = async (uid, isFollowing) => { if (!user) { setShowAuthModal(true); return; } if (!profile) return; const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); const targetRef = doc(db, getPublicCollection('userProfiles'), uid); try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); if (uid !== profile.uid) { await updateDoc(targetRef, { reputation: increment(5) }); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } } } catch (e) { console.error("Gagal update pertemanan", e); } };
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };

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
                    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} setPage={setPage} user={profile} onLogout={handleLogout} isDev={isMeDeveloper} toggleEruda={toggleEruda} />

                    {page!=='legal' && ( 
                        <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300">
                            {/* Header Content */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setPage('home')}>
                                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                                </div>
                                {/* Desktop Navigation Links */}
                                <div className="hidden md:flex ml-8 gap-6">
                                    <button onClick={()=>setPage('home')} className={`text-sm font-bold ${page==='home'?'text-sky-600':'text-gray-500 hover:text-gray-800'}`}>Beranda</button>
                                    <button onClick={()=>setPage('leaderboard')} className={`text-sm font-bold ${page==='leaderboard'?'text-sky-600':'text-gray-500 hover:text-gray-800'}`}>Peringkat</button>
                                    {!isGuest && <button onClick={()=>setPage('profile')} className={`text-sm font-bold ${page==='profile'?'text-sky-600':'text-gray-500 hover:text-gray-800'}`}>Profil</button>}
                                </div>
                            </div>

                            <div className="flex gap-2 items-center">
                                {!isGuest && (
                                     <button onClick={()=>setPage('notifications')} className="p-2 text-gray-500 hover:text-sky-600 transition relative">
                                         <Bell size={22}/>
                                         {notifCount>0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                                     </button>
                                )}
                                <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full dark:text-white dark:hover:bg-gray-800 transition">
                                    <Menu size={24} />
                                </button>
                            </div>
                        </header> 
                    )}

                    <main className={page!=='legal' ? 'pt-16 md:pt-20' : ''}>
                        {page==='home' && ( <><HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} isLoadingFeed={isLoadingFeed} feedError={feedError} retryFeed={()=>setRefreshTrigger(p=>p+1)} homeFeedState={homeFeedState} setHomeFeedState={setHomeFeedState}/><DraggableGift onClick={() => setShowRewards(true)} canClaim={canClaimReward && !isGuest} nextClaimTime={nextRewardTime}/></> )}
                        {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage('home')}} userPhoto={profile?.photoURL} />}
                        {page==='search' && <SearchScreen allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} initialQuery={searchQuery} setPage={setPage} setTargetPostId={setTargetPid} />}
                        {page==='leaderboard' && <LeaderboardScreen allUsers={users} currentUser={user} />}
                        {page==='legal' && <LegalPage onBack={()=>setPage('home')} />}
                        {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                        {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} allUsers={users} />}
                        {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} allUsers={users} />}
                        {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}}/>}
                        {page==='chat' && <ChatScreen currentUser={user} profile={profile} onBack={()=>setPage('home')} onRequestLogin={()=>setShowAuthModal(true)}/>}
                    </main>
                    
                    {/* BOTTOM NAV (Mobile Only) */}
                    {page!=='legal' && page!=='create' && page!=='chat' && ( 
                        <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 pb-safe pt-2 px-6 flex justify-between items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                            <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                            <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                            <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-black dark:bg-sky-500 text-white p-3 rounded-full shadow-lg hover:scale-110 transition -mt-8 border-4 border-[#F0F4F8] dark:border-gray-900">
                                <Plus size={24}/>
                            </button>
                            <NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>
                            {isGuest ? ( <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/> ) : ( <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/> )}
                        </nav> 
                    )}
                    
                    {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
                    {showRewards && ( <DailyRewardModal onClose={()=>setShowRewards(false)} onClaim={handleClaimReward} canClaim={canClaimReward} nextClaimTime={nextRewardTime} isGuest={isGuest} onLoginRequest={()=>{ setShowRewards(false); setShowAuthModal(true); }} /> )}
                    {showOnboarding && user && <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>}
                    <PWAInstallPrompt />
                </div>
            </div>
        </ErrorBoundary>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 transition duration-300 flex flex-col items-center ${active ? 'text-sky-500' : 'text-gray-400'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;