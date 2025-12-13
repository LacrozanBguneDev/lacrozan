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
    query, 
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
    where, 
    orderBy, 
    limit,
    increment,
    writeBatch,
    startAfter,
    getDocs
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
    Bug, ArrowUp, Move, ChevronDown, ChevronUp
} from 'lucide-react';

setLogLevel('silent'); // Default firebase silent

// --- DISCLAIMER KEAMANAN ---
// Catatan: API Key Firebase memang bersifat publik (client-side). 
// Keamanan data SEPENUHNYA bergantung pada "Firestore Security Rules" di Console Firebase Anda.
// Pastikan Anda telah mengatur rules agar user hanya bisa edit data mereka sendiri.

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i150/VrL65.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- KUNCI VAPID BARU (FIX) ---
const VAPID_KEY = "BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE"; 

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const getPublicCollection = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let messaging = null;
try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
    }
} catch (e) {
    console.log("Messaging skipped");
}

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

// 0. SYSTEM LOGGER (FIX: Menangani null user properties agar tidak crash)
const logSystemError = async (error, context = 'general', user = null) => {
    try {
        if (error.message && (error.message.includes('offline') || error.message.includes('network'))) return;

        // SAFE GUARD: Pastikan username tidak dibaca dari null
        const safeUsername = user ? (user.displayName || user.username || 'Guest') : 'Guest';
        const safeUid = user ? (user.uid || 'guest') : 'guest';

        await addDoc(collection(db, getPublicCollection('systemLogs')), {
            message: error.message || String(error),
            stack: error.stack || '',
            context: context,
            userId: safeUid,
            username: safeUsername,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        });
    } catch (e) {
        // Silent fail jika logging gagal
    }
};

// 1. Request Izin Notifikasi
const requestNotificationPermission = async (userId) => {
    if (!messaging || !userId) return;
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

// 2. Kompresi Gambar CERDAS ke Base64 (Untuk Foto - Hemat Ruang)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // OPTIMASI: Kurangi resolusi maksimal sedikit agar loading lebih cepat
                const MAX_WIDTH = 600; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // OPTIMASI: Kualitas 0.5 cukup untuk mobile, mempercepat loading
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// 3. API Upload Khusus Video & Audio (FAA API - Tourl)
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(10);
    formData.append('file', file); 

    try {
        const progressInterval = setInterval(() => {
            onProgress(prev => Math.min(prev + 5, 90));
        }, 500);

        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        clearInterval(progressInterval);
        
        onProgress(95);
        if (!response.ok) { throw new Error(`Server Error: ${response.status}`); }
        
        const data = await response.json();
        onProgress(100);
        
        if (data && data.result && data.result.url) {
            let secureUrl = data.result.url;
            return secureUrl;
        } else if (data && data.url) {
            return data.url;
        } else {
            console.error("API Response:", data);
            throw new Error('Gagal mendapatkan URL dari server.'); 
        }
    } catch (error) {
        console.error("Upload Error:", error);
        onProgress(0); throw new Error('Gagal upload video/audio. Cek koneksi.');
    }
};

// 4. Algoritma Acak
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

// 5. Sistem Notifikasi
const sendNotification = async (toUserId, type, message, fromUser, postId = null) => {
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId, fromUserId: fromUser.uid, fromUsername: fromUser.username, fromPhoto: fromUser.photoURL || '',
            type: type, message: message, postId: postId, isRead: false, timestamp: serverTimestamp()
        });
    } catch (error) { console.error("Gagal mengirim notifikasi:", error); }
};

// 6. Formatter Waktu
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
        if (minutes < 60) return { relative: `${minutes} menit lalu`, full: fullDate };
        const hours = Math.floor(minutes / 60);
        return { relative: `${hours} jam lalu`, full: fullDate };
    } catch (e) {
        return { relative: 'Baru saja', full: '' };
    }
};

// 7. Detektor Media Embed
const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { 
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; 
    }
    const igMatch = url.match(/(?:instagram\.com\/(?:p|reel|tv)\/)([\w-]+)/);
    if (igMatch) {
        return { type: 'instagram', embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed`, id: igMatch[1], displayUrl: url };
    }
    const tiktokMatch = url.match(/(?:tiktok\.com\/)(?:@[\w.-]+\/video\/|v\/)([\d]+)/);
    if (tiktokMatch) {
        return { type: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`, id: tiktokMatch[1], displayUrl: url };
    }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) { return { type: 'audio_file', url: url }; }
    if (url.startsWith('http')) {
        return { type: 'link', embedUrl: url, displayUrl: url }; 
    }
    return null;
};

// 8. Kalkulator Reputasi
const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 1000) return { label: "LEGEND", icon: Crown, color: "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white" };
    if (reputation >= 500) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 100) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
};

// 9. Ekstraktor Hashtag
const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g);
    return matches ? matches : [];
};

// 10. Cek Online Status
const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    try {
        const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        const diff = Date.now() - last.getTime();
        return diff < 10 * 60 * 1000; 
    } catch(e) { return false; }
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL & PERBAIKAN
// ==========================================

// --- COMPONENT: Draggable Gift Button ---
const DraggableGift = ({ onClick, canClaim, nextClaimTime }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const btnRef = useRef(null);

    useEffect(() => {
        setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    }, []);

    const handleStart = (clientX, clientY) => {
        setIsDragging(false);
        if(btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            dragStartRef.current = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }
    };

    const handleMove = (clientX, clientY) => {
        setIsDragging(true);
        const newX = Math.min(Math.max(0, clientX - dragStartRef.current.x), window.innerWidth - 60);
        const newY = Math.min(Math.max(0, clientY - dragStartRef.current.y), window.innerHeight - 60);
        setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
        setTimeout(() => setIsDragging(false), 100);
    };

    return (
        <div 
            ref={btnRef}
            className="fixed z-[55] touch-none select-none cursor-move transition-shadow"
            style={{ left: position.x, top: position.y }}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleEnd}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        >
            <button 
                onClick={() => !isDragging && onClick()}
                className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-full shadow-2xl shadow-orange-500/50 relative group active:scale-95 transition-transform"
            >
                <GiftIcon size={28} className={`text-white ${canClaim ? 'animate-bounce' : ''}`}/>
                {canClaim && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Geser Aku!
                </div>
            </button>
        </div>
    );
};

// --- PWA INSTALL PROMPT ---
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            const lastDismiss = localStorage.getItem('pwa_dismissed');
            if (!lastDismiss || Date.now() - parseInt(lastDismiss) > 86400000) {
                setShowBanner(true);
            }
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowBanner(false);
        }
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom duration-500 border border-gray-700">
            <div className="flex items-center gap-3">
                <div className="bg-sky-500 p-2.5 rounded-xl shadow-lg shadow-sky-500/20"><Smartphone size={24}/></div>
                <div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-gray-300">Notifikasi & Fullscreen</p></div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full"><X size={16}/></button>
                <button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600 transition">Pasang</button>
            </div>
        </div>
    );
};

// --- AVATAR ROBUST (FIX: Mencegah error null access) ---
const Avatar = ({ src, alt, className, fallbackText }) => {
    const [error, setError] = useState(false);
    
    // SAFE GUARD: Pastikan fallbackText ada sebelum diakses indexnya
    const safeFallback = fallbackText ? fallbackText : "?";
    
    if (!src || error) {
        return (
            <div className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-black text-gray-500 dark:text-gray-400 select-none`}>
                {safeFallback[0]?.toUpperCase() || '?'}
            </div>
        );
    }
    return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setError(true)} loading="lazy" />;
};

// --- NETWORK STATUS NOTIFICATION ---
const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showNotif, setShowNotif] = useState(false);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); setShowNotif(true); setTimeout(() => setShowNotif(false), 3000); };
        const handleOffline = () => { setIsOnline(false); setShowNotif(true); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);

    if (!showNotif) return null;

    return (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 transition-all duration-300 ${isOnline ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
            {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
            {isOnline ? "Koneksi Stabil Kembali" : "Koneksi Terputus - Mode Offline"}
        </div>
    );
};

// --- REWARDS MODAL ---
const DailyRewardModal = ({ onClose, onClaim, canClaim, nextClaimTime, isGuest, onLoginRequest }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-sky-100 dark:border-gray-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <GiftIcon size={40} className="text-yellow-600 dark:text-yellow-400"/>
                </div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Hujan Hadiah!</h2>
                {isGuest ? (
                    <>
                        <p className="text-gray-500 text-sm mb-6">Login sekarang untuk mengklaim reputasi gratis dan mulai mendaki Leaderboard!</p>
                        <button onClick={() => { onClose(); onLoginRequest(); }} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition flex items-center justify-center gap-2">
                            <LogIn size={18}/> Login Untuk Klaim
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-gray-500 text-sm mb-6">Login setiap hari untuk mendapatkan reputasi gratis dan jadilah Legend!</p>
                        {canClaim ? (
                            <button onClick={onClaim} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-105 transition flex items-center justify-center gap-2">
                                <Sparkles size={18}/> Klaim Hadiah
                            </button>
                        ) : (
                            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-300">
                                <Clock size={16} className="inline mr-1 mb-0.5"/>
                                Tunggu {nextClaimTime} lagi
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- LIGHTBOX ---
const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md z-50">
                <X size={24}/>
            </button>
            <div className="flex-1 w-full flex items-center justify-center relative">
                {images.length > 1 && (
                    <button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length)}} className="absolute left-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronLeft/></button>
                )}
                <img src={images[index]} className="max-w-full max-h-screen object-contain" />
                {images.length > 1 && (
                    <button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length)}} className="absolute right-2 p-2 text-white bg-black/50 rounded-full hover:bg-black/70"><ChevronRight/></button>
                )}
            </div>
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 overflow-x-auto max-w-full p-2">
                    {images.map((img, i) => (
                        <div key={i} onClick={() => setIndex(i)} className={`w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition ${i === index ? 'border-sky-500 scale-110' : 'border-transparent opacity-50'}`}>
                            <img src={img} className="w-full h-full object-cover"/>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- AUDIO PLAYER ---
const AudioPlayer = ({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-3 flex items-center gap-3 mb-4 shadow-md border border-gray-700">
            <button onClick={togglePlay} className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition">
                {isPlaying ? <Pause size={18} fill="white"/> : <Play size={18} fill="white" className="ml-1"/>}
            </button>
            <div className="flex-1">
                <div className="flex items-center gap-1 text-xs font-bold text-sky-400 mb-1"><Music size={12}/> Audio Clip</div>
                <audio ref={audioRef} src={src} className="w-full h-6 opacity-80" controls onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}/>
            </div>
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-gray-900 dark:to-black z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow">
            <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
            <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        </div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Memuat data terbaru...</p>
    </div>
);

const OfflinePage = ({ onRetry }) => (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center">
        <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <WifiOff size={40} className="text-gray-400"/>
        </div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Kamu Offline</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">Sepertinya internet kamu sedang istirahat. Cek koneksi wifi atau data seluler kamu ya.</p>
        <button onClick={onRetry} className="bg-sky-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-sky-600 transition flex items-center gap-2">
            <RefreshCw size={18}/> Coba Lagi
        </button>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded-full"></div><div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text, onHashtagClick) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 dark:bg-sky-900/30 px-1 rounded text-sm text-sky-700 dark:text-sky-400 font-mono border border-sky-100 dark:border-sky-800">$1</code>');
    
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline hashtag" data-tag="$1">#$1</span>');
    html = html.replace(/\n/g, '<br>');
    
    return <div 
        className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-sm" 
        dangerouslySetInnerHTML={{ __html: html }} 
        onClick={(e) => {
            if (e.target.classList.contains('hashtag')) {
                e.stopPropagation();
                if(onHashtagClick) onHashtagClick(e.target.getAttribute('data-tag'));
            }
        }}
    />;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER
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
            const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => { resolve(snap); unsub(); }); });
            // FIX: NAIKKAN LIMIT DASHBOARD AGAR SEMUA DATA MASUK (10000)
            const postsSnap = await new Promise(resolve => { const unsub = onSnapshot(query(collection(db, getPublicCollection('posts')), limit(10000)), (snap) => { resolve(snap); unsub(); }); });
            
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

        const unsubLogs = onSnapshot(query(collection(db, getPublicCollection('systemLogs')), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
            setSystemLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => unsubLogs();
    }, []);

    const handleBroadcast = async () => {
        if(!broadcastMsg.trim()) return;
        if(!confirm("Kirim pengumuman ke SEMUA user?")) return;
        setSendingBC(true);
        try {
            const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => { resolve(s); unsub(); }); });
            const promises = usersSnap.docs.map(docSnap => addDoc(collection(db, getPublicCollection('notifications')), {
                toUserId: docSnap.id, fromUserId: 'admin', fromUsername: 'Developer System', fromPhoto: APP_LOGO, type: 'system', message: `📢 PENGUMUMAN: ${broadcastMsg}`, isRead: false, timestamp: serverTimestamp()
            }));
            await Promise.all(promises);
            alert("Pengumuman berhasil dikirim!"); setBroadcastMsg('');
        } catch(e) { alert("Gagal kirim broadcast: " + e.message); } finally { setSendingBC(false); }
    };

    const handleBanUser = async (uid, currentStatus) => {
        if(!confirm(currentStatus ? "Buka blokir user ini?" : "BLOKIR/BAN User ini? Mereka tidak akan bisa login lagi.")) return;
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), uid), { isBanned: !currentStatus });
            setAllUsersList(prev => prev.map(u => u.id === uid ? {...u, isBanned: !currentStatus} : u));
            alert(currentStatus ? "User di-unban." : "User berhasil di-ban.");
        } catch(e) { alert("Gagal: " + e.message); }
    };

    const handleDeleteUser = async (uid) => {
        if(!confirm("⚠️ PERINGATAN: Hapus data user ini secara permanen? Tindakan ini tidak bisa dibatalkan!")) return;
        try {
            await deleteDoc(doc(db, getPublicCollection('userProfiles'), uid));
            setAllUsersList(prev => prev.filter(u => u.id !== uid));
            alert("Data user dihapus.");
        } catch(e) { alert("Gagal hapus: " + e.message); }
    };

    const filteredUsers = allUsersList.filter(u => u.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2"><ShieldCheck className="text-sky-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white dark:bg-gray-800 dark:text-white p-2 rounded-full shadow hover:bg-gray-200 dark:hover:bg-gray-700"><X/></button></div>
                
                <div className="flex gap-2 mb-6">
                    <button onClick={()=>setActiveTab('overview')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab==='overview'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}>Overview</button>
                    <button onClick={()=>setActiveTab('logs')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${activeTab==='logs'?'bg-rose-500 text-white':'bg-white dark:bg-gray-800 text-gray-500'}`}><Bug size={14}/> System Logs</button>
                </div>

                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : activeTab === 'logs' ? (
                    <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-[500px] overflow-y-auto">
                        <h3 className="text-white font-bold mb-4 border-b border-gray-700 pb-2">Console Error Logs (User Side)</h3>
                        {systemLogs.length === 0 && <p className="text-gray-500">Belum ada error log.</p>}
                        {systemLogs.map(log => (
                            <div key={log.id} className="mb-3 border-b border-gray-800 pb-2">
                                <span className="text-gray-500">[{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Just now'}]</span>
                                <span className="text-yellow-500 mx-2">[{log.username}]</span>
                                <span className="text-blue-400">[{log.context}]</span>
                                <div className="text-red-400 mt-1">{log.message}</div>
                                {log.stack && <div className="text-gray-600 mt-1 whitespace-pre-wrap">{log.stack.substring(0,200)}...</div>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-sky-100 dark:border-gray-700 text-center"><Users className="mx-auto text-sky-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.users}</h3><p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Total User</p></div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-purple-100 dark:border-gray-700 text-center"><ImageIcon className="mx-auto text-purple-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.posts}</h3><p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Total Post</p></div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 text-center"><Activity className="mx-auto text-emerald-500 mb-2"/><h3 className="text-2xl font-bold dark:text-white">{stats.postsToday}</h3><p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Post Hari Ini</p></div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-orange-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-3 rounded-xl text-sm border border-gray-200 dark:border-gray-600 mb-3 outline-none" rows="3" placeholder="Tulis pesan untuk semua user..."/>
                            <button onClick={handleBroadcast} disabled={sendingBC} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition">{sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}</button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-red-100 dark:border-gray-700">
                             <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><UserX size={18} className="text-red-500"/> Manajemen User (Ban/Hapus)</h3>
                             <input value={userSearchTerm} onChange={e=>setUserSearchTerm(e.target.value)} placeholder="Cari username / email..." className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white p-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600 mb-4 outline-none"/>
                             <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                                 {filteredUsers.map(u => (
                                     <div key={u.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                         <div className="flex items-center gap-2">
                                             <Avatar src={u.photoURL} fallbackText={u.username} className="w-8 h-8 rounded-full"/>
                                             <div>
                                                 <p className="text-xs font-bold dark:text-white">{u.username} {u.isBanned && <span className="text-red-500">(BANNED)</span>}</p>
                                                 <p className="text-[10px] text-gray-500 dark:text-gray-400">{u.email}</p>
                                             </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={()=>handleBanUser(u.id, u.isBanned)} className={`p-1.5 rounded text-xs font-bold ${u.isBanned ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`} title={u.isBanned ? "Unban" : "Ban"}>
                                                 <Ban size={14}/>
                                             </button>
                                             <button onClick={()=>handleDeleteUser(u.id)} className="p-1.5 bg-red-100 text-red-600 rounded text-xs font-bold" title="Hapus Permanen">
                                                 <Trash2 size={14}/>
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><BarChart3 size={18}/> Aktivitas Minggu Ini</h3>
                            <div className="flex items-end justify-between h-32 gap-2">{chartData.map((d, i) => ( <div key={i} className="flex flex-col items-center w-full group"><div className="text-xs font-bold text-sky-600 mb-1 opacity-0 group-hover:opacity-100 transition">{d.count}</div><div className="w-full bg-sky-100 dark:bg-sky-900/50 rounded-t-lg hover:bg-sky-300 transition-all relative" style={{height: `${d.height}%`}}></div><div className="text-[10px] text-gray-400 mt-2 font-bold">{d.day}</div></div> ))}</div>
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

// --- ONBOARDING SCREEN ---
const OnboardingScreen = ({ onComplete, user }) => {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim()) return alert("Username wajib diisi!");
        setLoading(true);
        try {
            await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {
                username: username.trim(),
                email: user.email,
                uid: user.uid,
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
                following: [],
                followers: [],
                savedPosts: [],
                lastSeen: serverTimestamp(),
                reputation: 0,
                lastPostTime: 0 // Inisialisasi untuk anti-spam
            });
            onComplete();
        } catch (error) {
            alert("Gagal menyimpan data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-[80] flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-sm text-center">
                <img src={APP_LOGO} className="w-24 h-24 mx-auto mb-6 object-contain"/>
                <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang! 👋</h2>
                <p className="text-gray-500 mb-8 text-sm">Lengkapi profil Anda untuk mulai berinteraksi.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="text-left">
                        <label className="text-xs font-bold text-gray-600 ml-1">Username Unik</label>
                        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Contoh: user_keren123" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none"/>
                    </div>
                    <button disabled={loading} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-sky-600 transition disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : "Mulai Menjelajah"}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- AUTH SCREEN ---
const AuthModal = ({ onClose }) => {
    const handleGoogleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Gagal login dengan Google.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button>
                <div className="text-center mb-6">
                    <img src={APP_LOGO} className="w-16 h-16 mx-auto mb-3"/>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white">Masuk ke {APP_NAME}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bergabunglah dengan komunitas sekarang!</p>
                </div>
                <button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/>
                    Lanjutkan dengan Google
                </button>
                <p className="text-[10px] text-center text-gray-400 mt-4">Dengan masuk, Anda menyetujui Ketentuan Layanan kami.</p>
            </div>
        </div>
    );
};

// --- LEGAL PAGE (DIPERBARUI) ---
const LegalPage = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pb-24 pt-20 px-6 max-w-2xl mx-auto animate-in fade-in">
            <button onClick={onBack} className="fixed top-6 left-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"><ArrowLeft/></button>
            
            <div className="text-center mb-10">
                <Scale className="w-12 h-12 mx-auto text-sky-600 mb-4"/>
                <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">Pusat Kebijakan</h1>
                <p className="text-gray-500 dark:text-gray-400">Transparansi untuk kepercayaan Anda.</p>
            </div>

            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Code size={18} className="text-sky-500"/> Tentang Pembuat</h2>
                    <div className="bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800 flex items-center gap-4">
                        <img src="https://c.termai.cc/i6/EAb.jpg" alt="Pembuat" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"/>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">M. Irham Andika Putra</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Siswa SMP Negeri 3 Mentok</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Umur 14 Tahun</p>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Lock size={18} className="text-sky-500"/> Kebijakan Privasi</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700">
                        <p className="mb-3">Di {APP_NAME}, privasi Anda adalah prioritas kami. Kami mengumpulkan data minimal yang diperlukan untuk fungsionalitas aplikasi.</p>
                        <ul className="list-disc pl-5 space-y-1 mb-3">
                            <li><strong>Data Akun:</strong> Nama, Email, Foto Profil (via Google Login).</li>
                            <li><strong>Konten:</strong> Postingan, Komentar, dan Pesan yang Anda buat.</li>
                            <li><strong>Aktivitas:</strong> Log interaksi seperti Like dan Follow untuk personalisasi.</li>
                        </ul>
                    </div>
                </section>
                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><FileText size={18} className="text-purple-500"/> Ketentuan Layanan</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700">
                        <p className="mb-3">Dengan menggunakan aplikasi ini, Anda setuju untuk:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Tidak memposting konten ilegal, pornografi, atau ujaran kebencian.</li>
                            <li>Saling menghormati antar pengguna.</li>
                            <li>Tidak melakukan spam atau aktivitas bot.</li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
};

// --- LEADERBOARD SCREEN (DIPERBARUI SISTEM REPUTASI) ---
const LeaderboardScreen = ({ allUsers }) => {
    // Sortir user berdasarkan REPUTASI (Reputasi sudah diakumulasi dari interaksi)
    const sortedUsers = useMemo(() => {
        return [...allUsers]
            .sort((a, b) => (b.reputation || 0) - (a.reputation || 0))
            .slice(0, 50); 
    }, [allUsers]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Top Kreator Viral</h1>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {sortedUsers.map((u, index) => {
                     // Styling khusus untuk peringkat 1, 2, 3
                     let rankStyle = "";
                     let rankIcon = null;
                     
                     if (index === 0) {
                         rankStyle = "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/20 border-l-4 border-yellow-500";
                         rankIcon = <Crown size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm"/>;
                     } else if (index === 1) {
                         rankStyle = "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-700/30 border-l-4 border-gray-400";
                         rankIcon = <Medal size={20} className="text-gray-400 fill-gray-200"/>;
                     } else if (index === 2) {
                         rankStyle = "bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/20 border-l-4 border-orange-500";
                         rankIcon = <Medal size={20} className="text-orange-500 fill-orange-200"/>;
                     }

                     return (
                        <div key={u.uid} className={`flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 ${rankStyle}`}>
                            <div className={`w-8 h-8 flex items-center justify-center font-black text-lg mr-3 ${index===0?'text-yellow-600':index===1?'text-gray-500':index===2?'text-orange-600':'text-gray-300'}`}>
                                {index + 1}
                            </div>
                            <div className="relative mr-3">
                                <Avatar src={u.photoURL} fallbackText={u.username} className={`w-12 h-12 rounded-full border-2 ${index===0?'border-yellow-500':index===1?'border-gray-400':index===2?'border-orange-500':'border-gray-200 dark:border-gray-600'}`}/>
                                {index === 0 && <div className="absolute -top-2 -right-1 animate-bounce">{rankIcon}</div>}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-1">
                                    {u.username}
                                    {index < 3 && <Sparkles size={12} className={index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-500'}/>}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">
                                    {u.followers?.length || 0} Pengikut
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center justify-end gap-1">
                                    <Flame size={14} className={index < 3 ? 'text-rose-500' : 'text-gray-300'}/>
                                    {u.reputation || 0}
                                </div>
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Poin</div>
                            </div>
                        </div>
                     )
                })}
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
    if (count === 1) {
        return (
            <div className="mb-4 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/20 border border-gray-100 dark:border-gray-700 relative" onClick={() => onImageClick(0)}>
                <img src={mediaUrls[0]} className="w-full h-auto max-h-[500px] object-cover cursor-pointer hover:scale-105 transition duration-500"/>
            </div>
        );
    }
    return (
        <div className={`mb-4 grid ${count === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-0.5 rounded-2xl overflow-hidden`}>
            {mediaUrls.slice(0, 9).map((url, i) => (
                <div key={i} className="relative aspect-square cursor-pointer overflow-hidden group" onClick={() => onImageClick(i)}>
                    <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy"/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    {i === 8 && count > 9 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm">+{count - 9}</div>
                    )}
                </div>
            ))}
        </div>
    );
};

// --- POST ITEM ---
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
        if (currentUserId) {
            setLiked(post.likes?.includes(currentUserId));
            setIsSaved(profile?.savedPosts?.includes(post.id));
        } else {
            setLiked(false);
            setIsSaved(false);
        }
        setLikeCount(post.likes?.length || 0);
    }, [post, currentUserId, profile?.savedPosts]);

    const handleLike = async () => {
        if (isGuest) { onRequestLogin(); return; }
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
        const ref = doc(db, getPublicCollection('posts'), post.id);
        const authorRef = doc(db, getPublicCollection('userProfiles'), post.userId);
        try {
            if (newLiked) {
                await updateDoc(ref, { likes: arrayUnion(currentUserId) });
                // REPUTASI UPDATE: Tambah reputasi author saat di-like
                // SECURITY UPDATE: Cegah user dapat poin jika like postingan sendiri
                if (post.userId !== currentUserId) {
                    await updateDoc(authorRef, { reputation: increment(2) }); // +2 Poin per Like
                    sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
                }
            } else {
                await updateDoc(ref, { likes: arrayRemove(currentUserId) });
            }
        } catch (error) { setLiked(!newLiked); setLikeCount(prev => !newLiked ? prev + 1 : prev - 1); }
    };

    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };

    const handleSave = async () => {
        if (isGuest) { onRequestLogin(); return; }
        const newSaved = !isSaved;
        setIsSaved(newSaved);
        const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
        try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); }
    };

    const handleComment = async (e) => {
        e.preventDefault(); 
        if (isGuest) { onRequestLogin(); return; }
        // CRASH FIX: Guard clause jika profil belum termuat
        if (!profile) return;
        
        if (!newComment.trim()) return;
        try {
            const commentData = { 
                postId: post.id, 
                userId: currentUserId, 
                text: newComment, 
                username: profile.username || 'User', // Fallback
                timestamp: serverTimestamp(),
                parentId: replyTo ? replyTo.id : null, 
                replyToUsername: replyTo ? replyTo.username : null
            };

            await addDoc(collection(db, getPublicCollection('comments')), commentData);
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            
            // REPUTASI UPDATE: Tambah reputasi author saat dikomen
            // SECURITY UPDATE: Cegah user dapat poin jika komen postingan sendiri
            if (post.userId !== currentUserId) {
                await updateDoc(doc(db, getPublicCollection('userProfiles'), post.userId), { reputation: increment(5) }); // +5 Poin per Komen
                if (!replyTo) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            }
            // Reputasi untuk yang membalas (Cegah self-reply farming)
            if (replyTo && replyTo.userId !== currentUserId) {
                await updateDoc(doc(db, getPublicCollection('userProfiles'), replyTo.userId), { reputation: increment(3) }); // +3 Poin balasan
                sendNotification(replyTo.userId, 'comment', `membalas komentar Anda: "${newComment.substring(0,15)}.."`, profile, post.id);
            }

            setNewComment('');
            setReplyTo(null);
        } catch (error) { console.error(error); }
    };

    // --- FIX: REPUTATION ROLLBACK ON DELETE ---
    const handleDelete = async () => {
        // Pesan konfirmasi yang jelas
        const confirmMsg = isMeDeveloper && !isOwner 
            ? "⚠️ ADMIN: Hapus postingan orang lain?" 
            : "Hapus postingan ini? Reputasi yang didapat dari post ini (Likes/Comments/Create) akan DITARIK KEMBALI.";

        if (confirm(confirmMsg)) { 
            try {
                // 1. Hitung total reputasi yang harus ditarik kembali
                // Base Post: 10 poin
                // Likes: 2 poin * jumlah like
                // Komentar: 5 poin * jumlah komentar (estimasi kasar, karena kita tidak bisa track siapa yg komen untuk tarik poin mereka, kita tarik poin authornya saja dari "keterlibatan")
                const earnedReputation = 10 + ((post.likes?.length || 0) * 2) + ((post.commentsCount || 0) * 5);
                
                // 2. Tarik kembali reputasi dari user
                const userRef = doc(db, getPublicCollection('userProfiles'), post.userId);
                await updateDoc(userRef, {
                    reputation: increment(-earnedReputation)
                });

                // 3. Hapus Postingan
                await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); 
                
                alert(`Postingan dihapus. ${earnedReputation} Poin Reputasi ditarik kembali.`);
            } catch (e) {
                alert("Gagal menghapus: " + e.message);
            }
        } 
    };

    const handleDeleteComment = async (commentId) => { if(confirm("Hapus komentar?")) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin! Orang lain bisa membukanya langsung.'); } catch (e) { alert('Gagal menyalin link'); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.toMillis || 0) - (b.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !embed;
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    // --- LOGIKA KOMENTAR BERJENJANG (REFACTORED) ---
    const rootComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);

    // FIX: KOMPONEN TERPISAH UNTUK ITEM KOMENTAR (MENGHINDARI ERROR #310)
    const CommentItem = ({ c, isReply }) => {
        const replies = getReplies(c.id);
        const [showAllReplies, setShowAllReplies] = useState(false);
        const visibleReplies = showAllReplies ? replies : replies.slice(0, 2);

        return (
            <div className="flex flex-col">
                <div className={`p-3 rounded-xl text-xs flex flex-col group transition ${isReply ? 'ml-8 bg-gray-100 dark:bg-gray-800 border-l-2 border-sky-300 mb-2' : 'bg-gray-50 dark:bg-gray-900'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800 dark:text-gray-200">{c.username || 'User'}</span>
                                {c.replyToUsername && isReply && <span className="flex items-center text-sky-600 text-[10px]"><CornerDownRight size={10} className="mr-0.5"/> {c.replyToUsername}</span>}
                            </div>
                            <span className="text-gray-600 dark:text-gray-400 leading-relaxed block">{c.text}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                {!isGuest && <button onClick={()=>setReplyTo(c)} className="text-gray-400 hover:text-sky-500"><Reply size={12}/></button>}
                                {(currentUserId === c.userId || isMeDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500">{isMeDeveloper && currentUserId !== c.userId ? <ShieldAlert size={12}/> : <Trash size={12}/>}</button>}
                        </div>
                    </div>
                </div>
                
                {replies.length > 0 && (
                    <div className="mt-1">
                        <div className="space-y-3">
                            {visibleReplies.map(reply => (
                                <CommentItem key={reply.id} c={reply} isReply={true} />
                            ))}
                        </div>
                        {replies.length > 2 && !showAllReplies && (
                            <button onClick={() => setShowAllReplies(true)} className="ml-8 text-[10px] font-bold text-sky-600 hover:underline flex items-center mb-2">
                                Lihat {replies.length - 2} balasan lainnya...
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Wrapper Sederhana
    const CommentList = ({ commentList }) => (
        <div className="space-y-3">
            {commentList.map(c => <CommentItem key={c.id} c={c} isReply={false} />)}
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-700 relative overflow-hidden group transition hover:shadow-lg">
            {post.isShort && <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md z-10 flex items-center"><Zap size={10} className="mr-1 text-yellow-400"/> SHORT</div>}
            {!post.isShort && likeCount > 10 && <div className="absolute top-4 right-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-200 dark:border-orange-800 flex items-center z-10"><Flame size={10} className="mr-1"/> TRENDING</div>}
            {isMeme && !post.isShort && <div className="absolute top-4 right-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800 flex items-center z-10"><Laugh size={10} className="mr-1"/> MEME</div>}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white overflow-hidden">
                             <Avatar src={post.user?.photoURL} fallbackText={post.user?.username || "?"} className="w-full h-full"/>
                        </div>
                    </div>
                    <div><h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-tight flex items-center gap-1">{post.user?.username || 'Pengguna'} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>{isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>}</div></div>
                </div>
                <div className="flex gap-2">
                    {!isOwner && post.userId !== currentUserId && ( <button onClick={() => isGuest ? onRequestLogin() : handleFollow(post.userId, isFollowing)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${isFriend ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md'}`}>{isFriend ? <><UserCheck size={12}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                    {(isOwner || isMeDeveloper) && !isGuest && ( <div className="flex gap-2">{isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-sky-600 rounded-full"><Edit size={16}/></button>}<button onClick={handleDelete} className={`p-2 rounded-full ${isMeDeveloper && !isOwner ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-red-600'}`}>{isMeDeveloper && !isOwner ? <ShieldAlert size={16}/> : <Trash2 size={16}/>}</button></div> )}
                </div>
            </div>

            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3"><input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg font-bold text-sm dark:text-white"/><textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg text-sm resize-none dark:text-white" rows="4"/><div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-1">Batal</button><button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button></div></div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{post.title}</h3>}
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{renderMarkdown(displayText, onHashtagClick)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
                    
                    <div onDoubleClick={handleDoubleTap} className="relative">
                         {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700 pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                         
                         {isAudio && <AudioPlayer src={post.mediaUrl || embed.url} />}
                         {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black rounded-2xl mb-4"/>}
                         {embed?.type === 'youtube' && <div className="aspect-video mb-4 rounded-2xl overflow-hidden"><iframe src={embed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                         {embed?.type === 'instagram' && ( <div className="aspect-square mb-4 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700"><iframe src={embed.embedUrl} className="w-full h-full border-0" scrolling="no" allowTransparency="true"></iframe></div>)}
                         {embed?.type === 'tiktok' && ( <div className="aspect-[9/16] mb-4 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black"><iframe src={embed.embedUrl} className="w-full h-full border-0"></iframe></div>)}
                         {embed?.type === 'link' && <a href={embed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center bg-sky-50 dark:bg-gray-900 text-sky-600 font-bold text-sm hover:underline mb-4 rounded-2xl">Buka Tautan Eksternal <ExternalLink size={14} className="inline ml-1"/></a>}

                         {!isAudio && !isVideo && !embed && mediaList.length > 0 && (
                             <MediaGrid mediaUrls={mediaList} onImageClick={(idx) => {setLightboxIndex(idx); setLightboxOpen(true);}} />
                         )}
                    </div>
                </>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50 dark:border-gray-700">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={22}/> {post.commentsCount || 0}</button>
                <button onClick={sharePost} className="text-gray-400 hover:text-sky-500"><Share2 size={22}/></button>
                <button onClick={handleSave} className={`ml-auto transition ${isSaved ? 'text-sky-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} /></button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in">
                    <div className="max-h-60 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">
                        {comments.length === 0 ? (
                            <p className="text-xs text-center text-gray-400">Belum ada komentar.</p> 
                        ) : (
                            // MENGGUNAKAN KOMPONEN LIST BARU YANG NESTED
                            <CommentList commentList={rootComments} />
                        )}
                    </div>
                    <form onSubmit={handleComment} className="relative">
                        {replyTo && (
                            <div className="flex items-center justify-between text-[10px] bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 p-2 rounded-t-lg">
                                <span>Membalas <b>{replyTo.username}</b>: "{replyTo.text.substring(0,20)}..."</span>
                                <button type="button" onClick={()=>setReplyTo(null)}><X size={12}/></button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder={isGuest ? "Login untuk komentar..." : "Tulis komentar..."} disabled={isGuest || !profile} className={`flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200 ${replyTo ? 'rounded-b-xl' : 'rounded-xl'}`}/>
                            <button type="submit" disabled={!newComment.trim() || isGuest} className="p-2.5 bg-sky-500 text-white rounded-xl shadow-md hover:bg-sky-600 disabled:opacity-50 h-fit self-end"><Send size={16}/></button>
                        </div>
                    </form>
                </div>
            )}
            
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
        </div>
    );
};

// --- CREATE POST ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '', isShort: false, isAudio: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);

    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
            const isAudio = selectedFiles[0].type.startsWith('audio');
            const isVideo = selectedFiles[0].type.startsWith('video');
            setForm({
                ...form, 
                files: selectedFiles, 
                isShort: isVideo, 
                isAudio: isAudio,
                url: '' 
            });
        }
    };

    const submit = async (e) => {
        e.preventDefault(); 
        
        // SECURITY UPDATE: Rate Limiting (Cooldown 60 detik)
        try {
            const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const lastPost = userData.lastPostTime || 0;
                const now = Date.now();
                if (now - lastPost < 60000) { // 60000 ms = 1 menit
                    alert("Tunggu 1 menit sebelum memposting lagi. (Anti-Spam)");
                    return;
                }
            }
        } catch(err) {
            console.error("Gagal cek cooldown", err);
        }

        setLoading(true); setProg(0);
        try {
            let mediaUrls = [];
            let mediaType = 'text';

            if (form.files.length > 0) {
                const firstFile = form.files[0];
                if (firstFile.type.startsWith('image')) {
                    mediaType = 'image';
                    setProg(10);
                    for (let i = 0; i < form.files.length; i++) {
                        const base64 = await compressImageToBase64(form.files[i]);
                        mediaUrls.push(base64);
                        setProg(10 + ((i + 1) / form.files.length) * 80);
                    }
                } else if (firstFile.type.startsWith('video') || firstFile.type.startsWith('audio')) {
                    const uploadedUrl = await uploadToFaaAPI(firstFile, setProg);
                    mediaUrls.push(uploadedUrl);
                    mediaType = firstFile.type.startsWith('video') ? 'video' : 'audio';
                    setProg(100);
                }
            } else if (form.url) {
                mediaType = 'link';
                mediaUrls.push(form.url);
            }
            
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            
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
                user: {username, uid: userId}
            });
            
            // REPUTASI UPDATE: Bonus Posting Konten & Update Last Post Time
            await updateDoc(doc(db, getPublicCollection('userProfiles'), userId), { 
                reputation: increment(10),
                lastPostTime: Date.now() // Update waktu post terakhir
            }); 
            
            setProg(100); setTimeout(()=>onSuccess(ref.id, false), 500);
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-xl border border-sky-50 dark:border-gray-700 relative overflow-hidden mt-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-purple-400"></div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white mb-6">Buat Postingan Baru</h2>
                <form onSubmit={submit} className="space-y-4">
                    {loading && <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul Menarik..." className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 transition"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu... (Gunakan #meme untuk kategori meme)" rows="4" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    <div className="flex gap-2 text-xs"><button type="button" onClick={()=>setForm({...form, content: form.content + "**Tebal**"})} className="bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-200">B</button><button type="button" onClick={()=>setForm({...form, content: form.content + "*Miring*"})} className="bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-200">I</button><button type="button" onClick={insertLink} className="bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 px-2 py-1 rounded hover:bg-sky-200 flex items-center gap-1"><LinkIcon size={10}/> Link</button></div>
                    
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.files.length > 0 && !form.isAudio ?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                            <ImageIcon size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.files.length > 0 && !form.isAudio ? `${form.files.length} File` : 'Foto (Banyak)'}</span>
                            <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} disabled={loading}/>
                        </label>
                        
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.isAudio ?'bg-pink-50 border-pink-200 text-pink-600':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                            <Music size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.isAudio ? 'Audio Siap' : 'Audio'}</span>
                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={loading}/>
                        </label>
                    </div>
                    
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, files:[]})} placeholder="Atau Link Video (YouTube/TikTok/IG)..." className="w-full pl-10 py-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs outline-none"/></div>
                    <button disabled={loading || (!form.content && form.files.length === 0 && !form.url)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN (DENGAN VISUAL RANK BARU) ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest, allUsers }) => {
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false);
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); 
    const [mood, setMood] = useState(profileData.mood || '');
    const [isEditingMood, setIsEditingMood] = useState(false);
    
    // FIX POSTINGAN HILANG & PERFORMA: LIMIT DINAMIS
    const [localPosts, setLocalPosts] = useState([]);
    const [loadingLocal, setLoadingLocal] = useState(true);
    const [postsLimit, setPostsLimit] = useState(15); // Mulai dari 15 postingan

    const viewerUid = viewerProfile ? viewerProfile.uid : null;
    const isSelf = viewerUid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;

    // FETCH KHUSUS: Ambil postingan spesifik user ini, tidak bergantung feed global
    useEffect(() => {
        setLoadingLocal(true);
        // Hapus orderBy yang berat, gunakan client-side sorting untuk performa maksimal
        // Gunakan dynamic limit yang bisa ditambah (15 -> 25 -> 35 dst)
        const q = query(
            collection(db, getPublicCollection('posts')), 
            where('userId', '==', profileData.uid), 
            limit(postsLimit)
        );
        
        const unsub = onSnapshot(q, (snap) => {
            let fetched = snap.docs.map(d => ({id: d.id, ...d.data(), user: profileData}));
            
            // Manual Sort di Client Side agar lebih cepat dan tidak butuh index composite
            fetched.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return timeB - timeA; // Descending
            });

            setLocalPosts(fetched);
            setLoadingLocal(false);
        });
        return () => unsub();
    }, [profileData.uid, postsLimit]); // Re-run saat limit bertambah

    const loadMoreProfilePosts = () => {
        setPostsLimit(prev => prev + 10);
    };

    const followersCount = (profileData.followers || []).length;
    const followingCount = (profileData.following || []).length;
    const targetFollowers = profileData.followers || [];
    const targetFollowing = profileData.following || [];
    const friendsCount = targetFollowing.filter(id => targetFollowers.includes(id)).length;

    const save = async () => { 
        setLoad(true); 
        try { 
            let url = profileData.photoURL;
            if (file) {
                url = await compressImageToBase64(file);
            }
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); 
            setEdit(false); 
        } catch(e){alert(e.message)} finally{setLoad(false)}; 
    };

    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    
    // Badge menggunakan REPUTASI ASLI yang tersimpan di DB
    const badge = getReputationBadge(profileData.reputation || 0, isDev);
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; 
    const isFollowedByTarget = viewerProfile ? (viewerProfile.followers || []).includes(profileData.uid) : false;
    const isFriend = isFollowing && isFollowedByTarget; 
    const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    // HITUNG RANKING
    let rank = null;
    if (allUsers) {
        const sorted = [...allUsers].sort((a,b) => (b.reputation||0) - (a.reputation||0));
        rank = sorted.findIndex(u => u.uid === profileData.uid) + 1;
    }

    // HITUNG PROGRESS KE LEVEL BERIKUTNYA (FITUR BARU)
    const getNextRankData = (points) => {
        if (points < 100) return { next: 100, label: 'Rising Star', percent: (points/100)*100 };
        if (points < 500) return { next: 500, label: 'Influencer', percent: ((points-100)/400)*100 };
        if (points < 1000) return { next: 1000, label: 'Legend', percent: ((points-500)/500)*100 };
        return { next: null, label: 'Max Level', percent: 100 };
    };
    const rankProgress = getNextRankData(profileData.reputation || 0);

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className={`bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm mb-8 mx-4 text-center relative overflow-hidden border ${rank === 1 ? 'border-yellow-400 ring-2 ring-yellow-200' : rank === 2 ? 'border-gray-400 ring-2 ring-gray-200' : rank === 3 ? 'border-orange-400 ring-2 ring-orange-200' : 'border-sky-50 dark:border-gray-700'}`}>
                {/* Indikator Peringkat Visual */}
                {rank && rank <= 3 && (
                    <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl font-black text-white text-xs ${rank===1?'bg-yellow-500':rank===2?'bg-gray-400':'bg-orange-500'}`}>
                        #{rank} VIRAL
                    </div>
                )}

                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 dark:from-sky-900 dark:to-purple-900 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8">
                    <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 dark:bg-gray-700 ${rank===1 ? 'border-yellow-400' : isOnline ? 'border-emerald-400' : 'border-white dark:border-gray-600'} relative`}>
                        {load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}
                        <Avatar src={profileData.photoURL} fallbackText={profileData.username} className="w-full h-full"/>
                    </div>
                    <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    {isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}
                </div>

                {edit ? ( <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent dark:text-white"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs dark:text-gray-300"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'Mengunggah...':'Simpan'}</button></div> ) : ( <> <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> {isSelf ? ( isEditingMood ? ( <div className="flex items-center justify-center gap-2 mt-2"><input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32 dark:bg-gray-700 dark:text-white"/><button onClick={saveMood} className="text-green-500"><Check size={14}/></button></div> ) : ( <div onClick={()=>setIsEditingMood(true)} className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-sky-500 flex items-center justify-center gap-1">{profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/></div> ) ) : ( profileData.mood && <p className="text-sm text-gray-500 mt-1 italic">"{profileData.mood}"</p> )} </> )}
                
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}>
                    <badge.icon size={14}/> {badge.label}
                </div>

                {/* Progress Bar Feature */}
                <div className="px-8 mt-2 mb-4 w-full">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                        <span>{profileData.reputation || 0} XP</span>
                        <span>{rankProgress.next ? `${rankProgress.next} XP` : 'MAX'}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-purple-500 transition-all duration-1000" style={{width: `${rankProgress.percent}%`}}></div>
                    </div>
                    <p className="text-[10px] text-center mt-1 text-sky-500 font-bold">
                        {rankProgress.next ? `Butuh ${rankProgress.next - (profileData.reputation||0)} poin lagi ke ${rankProgress.label}` : 'Kamu adalah Legenda!'}
                    </p>
                </div>

                {!isSelf && !isGuest && ( <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${isFriend ? 'bg-emerald-500 text-white shadow-emerald-200' : isFollowing ? 'bg-gray-200 text-gray-600' : 'bg-sky-500 text-white shadow-sky-200'}`}>{isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                {isDev && isSelf && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 shadow-lg"><ShieldCheck size={16}/> Dashboard Developer</button>}
                <div className="flex justify-center gap-6 mt-6 border-t dark:border-gray-700 pt-6"><div><span className="font-bold text-xl block dark:text-white">{followersCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div><div><span className="font-bold text-xl block dark:text-white">{followingCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div><div><span className="font-bold text-xl block text-emerald-600">{friendsCount}</span><span className="text-[10px] text-emerald-600 font-bold uppercase">Teman</span></div></div>
            </div>
            {isSelf && ( <div className="flex gap-2 px-4 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Disimpan</button></div> )}
            
            <div className="px-4 space-y-6">
                {activeTab === 'posts' ? (
                    loadingLocal && localPosts.length === 0 ? <SkeletonPost /> :
                    localPosts.length > 0 ? (
                        <>
                            {localPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}
                            <button onClick={loadMoreProfilePosts} className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-bold text-xs hover:bg-sky-100 hover:text-sky-600 transition">Muat Lebih Banyak...</button>
                        </>
                    ) : <div className="text-center text-gray-400 py-10">Belum ada postingan.</div>
                ) : ( 
                    savedPostsData.length > 0 ? savedPostsData.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>) : <div className="text-center text-gray-400 py-10">Belum ada postingan yang disimpan.</div>
                )}
            </div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

// --- TRENDING TAGS ---
const TrendingTags = ({ posts, onTagClick }) => {
    const tags = useMemo(() => { 
        const tagCounts = {}; 
        posts.forEach(p => { 
            // SECURITY UPDATE: Cegah satu postingan spam tag yang sama
            const uniqueTags = new Set(extractHashtags(p.content));
            uniqueTags.forEach(tag => { 
                tagCounts[tag] = (tagCounts[tag] || 0) + 1; 
            }); 
        }); 
        return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10); 
    }, [posts]);

    if (tags.length === 0) return null;
    return (
        <div className="mb-4 overflow-x-auto no-scrollbar py-2"><div className="flex gap-3"><div className="flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap mr-2"><TrendingUp size={16}/> Trending:</div>{tags.map(([tag, count]) => ( <div key={tag} onClick={()=>onTagClick(tag)} className="px-3 py-1 bg-white dark:bg-gray-800 border border-sky-100 dark:border-gray-700 rounded-full text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm whitespace-nowrap flex items-center gap-1 cursor-pointer hover:bg-sky-50">#{tag.replace('#','')} <span className="text-sky-400 ml-1">({count})</span></div> ))}</div></div>
    );
};

// --- HOME SCREEN (SCROLL BUTTON DIHAPUS, GANTI PAGINATION) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, isGuest, onRequestLogin, onHashtagClick, isLoadingFeed, feedError, retryFeed }) => {
    const [sortType, setSortType] = useState('random'); 
    const [stableFeed, setStableFeed] = useState([]);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const bottomRef = useRef(null);

    // Initial Sync dengan Realtime data
    useEffect(() => {
        if (isLoadingFeed) return;
        
        let basePosts = [...allPosts]; 
        let pinnedPost = null;
        if (newPostId) {
            const idx = basePosts.findIndex(p => p.id === newPostId);
            if (idx > -1) { pinnedPost = basePosts[idx]; basePosts.splice(idx, 1); }
        }

        let processedPosts = [];
        
        // PENGATURAN FEED SPESIFIK:
        if (sortType === 'meme') {
             // LOGIKA MUAT KHUSUS MEME (Jika di feed global ada meme, tampilkan. Sisanya loadMore)
             processedPosts = basePosts.filter(p => p.category === 'meme').sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        } else if (sortType === 'popular') {
             // LOGIKA POPULAR: Sortir dari data yang ada
             processedPosts = basePosts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        } else if (sortType === 'latest') {
             // LOGIKA TERBARU
             processedPosts = basePosts.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        } else {
             // DEFAULT (Shuffle)
             if (isFirstLoad || stableFeed.length === 0) processedPosts = shuffleArray([...basePosts]);
             else processedPosts = stableFeed.map(oldPost => basePosts.find(p => p.id === oldPost.id)).filter(p => p !== undefined);
             
             // Gabungkan dengan post yang sudah diload
             const loadedOldPosts = stableFeed.filter(old => !basePosts.find(bp => bp.id === old.id));
             processedPosts = [...processedPosts, ...loadedOldPosts];
        }

        if (pinnedPost) processedPosts.unshift(pinnedPost);
        
        const uniquePosts = Array.from(new Set(processedPosts.map(a => a.id)))
             .map(id => processedPosts.find(a => a.id === id));
             
        setStableFeed(uniquePosts);
        setIsFirstLoad(false);
    }, [allPosts, sortType, newPostId, isLoadingFeed]); 

    // LOAD MORE FUNCTION (Pagination)
    const loadMorePosts = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const lastPost = stableFeed[stableFeed.length - 1];
            if (!lastPost || !lastPost.timestamp) { setLoadingMore(false); return; }

            // SISTEM MUAT MASING-MASING BERDASARKAN KATEGORI
            let q;
            if (sortType === 'meme') {
                q = query(collection(db, getPublicCollection('posts')), where('category', '==', 'meme'), orderBy('timestamp', 'desc'), startAfter(lastPost.timestamp), limit(10));
            } else if (sortType === 'popular') {
                // Untuk popular, fetch latest batch berikutnya lalu sort client side (keterbatasan NoSQL)
                q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), startAfter(lastPost.timestamp), limit(10));
            } else {
                q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), startAfter(lastPost.timestamp), limit(10));
            }

            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const newPosts = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
                
                const enrichedPostsPromises = newPosts.map(async (p) => {
                    const uSnap = await getDoc(doc(db, getPublicCollection('userProfiles'), p.userId));
                    return { ...p, user: uSnap.exists() ? uSnap.data() : {username: 'User'} };
                });
                
                const enrichedPosts = await Promise.all(enrichedPostsPromises);
                
                // Jika sedang di tab populer, gabungkan lalu sort ulang
                if (sortType === 'popular') {
                    setStableFeed(prev => [...prev, ...enrichedPosts].sort((a,b) => (b.likes?.length || 0) - (a.likes?.length || 0)));
                } else {
                    setStableFeed(prev => [...prev, ...enrichedPosts]);
                }
            }
        } catch (e) {
            console.error("Gagal load more:", e);
        }
        setLoadingMore(false);
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting && !loadingMore && !isLoadingFeed) {
                loadMorePosts();
            }
        }, { threshold: 0.5 });
        const currentBottom = bottomRef.current;
        if (currentBottom) observer.observe(currentBottom);
        return () => { if (currentBottom) observer.unobserve(currentBottom); };
    }, [stableFeed, loadingMore, isLoadingFeed, sortType]);

    const manualRefresh = () => { 
        setIsFirstLoad(true); 
        setSortType('random'); 
        setStableFeed([]); // Clear feed
        clearNewPost(); 
        retryFeed(); 
    };
    
    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            <div className="flex items-center justify-between mb-4 pt-4 sticky top-16 z-30 bg-[#F0F4F8]/90 dark:bg-[#111827]/90 backdrop-blur-md py-2 -mx-4 px-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     <button onClick={() => setSortType('latest')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='latest'?'bg-sky-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>Terbaru</button>
                     <button onClick={() => setSortType('popular')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-purple-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>Populer</button>
                     <button onClick={() => setSortType('meme')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-yellow-400 text-white border-yellow-400':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>😂 Meme</button>
                </div>
                <button onClick={manualRefresh} className="p-2 bg-white dark:bg-gray-800 text-gray-500 rounded-full shadow-sm hover:rotate-180 transition duration-500"><RefreshCw size={20}/></button>
            </div>

            <TrendingTags posts={allPosts} onTagClick={onHashtagClick} />

            {feedError && (
                <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-3xl mb-4 text-center">
                    <WifiOff size={48} className="text-red-400 mb-2"/>
                    <h3 className="text-red-600 dark:text-red-400 font-bold">Koneksi Bermasalah</h3>
                    <p className="text-xs text-red-400 mb-4">Gagal memuat postingan.</p>
                    <button onClick={manualRefresh} className="px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg">Coba Lagi</button>
                </div>
            )}

            {isLoadingFeed ? <><SkeletonPost/><SkeletonPost/></> : stableFeed.length === 0 && !feedError ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700"><p className="text-gray-400 font-bold">Belum ada postingan.</p></div>
            ) : (
                <>
                    {stableFeed.map(p => (
                        <div key={p.id} className={p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                            {p.id === newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-1"><CheckCircle size={14}/> Postingan Berhasil Terkirim</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile?.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={onRequestLogin} onHashtagClick={onHashtagClick}/>
                        </div>
                    ))}
                    <div ref={bottomRef} className="h-20 w-full flex items-center justify-center">
                        {loadingMore && <div className="flex flex-col items-center"><Loader2 className="animate-spin text-sky-500 mb-2"/><span className="text-xs text-gray-400">Memuat postingan lama...</span></div>}
                        {!loadingMore && stableFeed.length > 5 && <button onClick={loadMorePosts} className="text-xs text-gray-400 hover:text-sky-500 font-bold px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full">Muat Lebih Banyak</button>}
                    </div>
                </>
            )}
        </div>
    );
};

const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifs, setNotifs] = useState([]);
    useEffect(() => {
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50));
        return onSnapshot(q, s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead)));
    }, [userId]);
    const handleClick = async (n) => { await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true}); if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); } else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); } };
    return <div className="max-w-lg mx-auto p-4 pb-24"><h1 className="text-xl font-black text-gray-800 dark:text-white mb-6">Notifikasi</h1>{notifs.length===0?<div className="text-center py-20 text-gray-400">Tidak ada notifikasi baru.</div>:<div className="space-y-3">{notifs.map(n=><div key={n.id} onClick={()=>handleClick(n)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 dark:hover:bg-gray-700 transition"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>{n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}</div></div><div className="flex-1"><p className="text-sm font-bold dark:text-gray-200">{n.fromUsername}</p><p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p></div></div>)}</div>}</div>;
};

// FIX: Direct fetch jika postingan tidak ada di feed (Mengatasi "postingan hilang" saat di-share)
const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const [fetchedPost, setFetchedPost] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Cek apakah ada di feed (cache)
    const postFromFeed = allPosts.find(p => p.id === postId);
    const displayPost = postFromFeed || fetchedPost;

    useEffect(() => {
        if (!postFromFeed && postId) {
            setLoading(true);
            const fetchSingle = async () => {
                try {
                    const docRef = doc(db, getPublicCollection('posts'), postId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // Fetch user data juga agar lengkap
                        let userData = { username: 'User' };
                        if (data.userId) {
                            try {
                                const uSnap = await getDoc(doc(db, getPublicCollection('userProfiles'), data.userId));
                                if (uSnap.exists()) userData = uSnap.data();
                            } catch(e) {}
                        }
                        setFetchedPost({ id: docSnap.id, ...data, user: userData });
                    }
                } catch (e) {
                    console.error("Gagal fetch post:", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchSingle();
        }
    }, [postId, postFromFeed]);
    
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    
    if (loading) return <div className="p-10 text-center flex flex-col items-center justify-center h-60"><Loader2 className="animate-spin text-sky-500 mb-2"/> <span className="text-gray-400 text-xs">Mengunduh postingan...</span></div>;

    if (!displayPost) return <div className="p-10 text-center text-gray-400 mt-20">Postingan tidak ditemukan atau telah dihapus.<br/><button onClick={handleBack} className="text-sky-600 font-bold mt-4 text-sm">Kembali ke Beranda</button></div>;
    
    return (
        <div className="max-w-lg mx-auto p-4 pb-40 pt-6">
            <button onClick={handleBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white dark:bg-gray-800 dark:text-gray-200 px-4 py-2 rounded-xl shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button>
            <PostItem post={displayPost} {...props}/>
            <div className="mt-8 text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400 text-sm font-bold flex flex-col items-center justify-center gap-2"><Coffee size={24} className="opacity-50"/> Gaada lagi postingan di bawah</div>
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile, isGuest, onRequestLogin, initialQuery, setPage, setTargetPostId }) => {
    const [queryTerm, setQueryTerm] = useState(initialQuery || '');
    const [results, setResults] = useState({ users: [], posts: [] });

    useEffect(() => {
        if (!queryTerm) { setResults({ users: [], posts: [] }); return; }
        const lower = queryTerm.toLowerCase();
        const foundUsers = allUsers.filter(u => u.username?.toLowerCase().includes(lower));
        // Pencarian post saat ini hanya di Top 20 (bisa diupgrade ke Algolia/Full Text Search Firebase extension untuk full DB)
        const foundPosts = allPosts.filter(p => p.content?.toLowerCase().includes(lower) || p.title?.toLowerCase().includes(lower));
        setResults({ users: foundUsers, posts: foundPosts });
    }, [queryTerm, allPosts, allUsers]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 mb-6">
                <Search className="ml-2 text-gray-400"/><input value={queryTerm} onChange={e=>setQueryTerm(e.target.value)} placeholder="Cari orang, hashtag, atau postingan..." className="flex-1 p-2 outline-none bg-transparent dark:text-white"/>
            </div>
            {queryTerm && (
                <div className="space-y-6">
                    {results.users.length > 0 && (
                        <div>
                            <h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wider">Pengguna</h3>
                            <div className="space-y-3">{results.users.map(u => ( <div key={u.uid} className="bg-white dark:bg-gray-800 p-3 rounded-xl flex justify-between items-center shadow-sm"> <div className="flex items-center gap-3" onClick={()=>goToProfile(u.uid)}> <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200 object-cover"/> <div><p className="font-bold text-sm dark:text-white">{u.username}</p><p className="text-[10px] text-gray-500">{u.followers?.length} Pengikut</p></div> </div> <button onClick={()=>isGuest ? onRequestLogin() : handleFollow(u.uid, (profile?.following||[]).includes(u.uid))} className="bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-xs font-bold">{(profile?.following||[]).includes(u.uid) ? 'Mengikuti' : 'Ikuti'}</button> </div> ))}</div>
                        </div>
                    )}
                    {results.posts.length > 0 && (
                        <div>
                            <h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wider">Postingan</h3>
                            <div className="space-y-3">{results.posts.map(p => ( 
                                <div key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex gap-3 cursor-pointer" onClick={()=>{ setTargetPostId(p.id); setPage('view_post'); }}> 
                                    <div className="flex-1"> <p className="font-bold text-sm mb-1 line-clamp-1 dark:text-white">{p.title || 'Tanpa Judul'}</p> <p className="text-xs text-gray-500 line-clamp-2">{p.content}</p> </div> 
                                </div> 
                            ))}</div>
                        </div>
                    )}
                </div>
            )}
            {!queryTerm && <div className="text-center text-gray-400 mt-20 flex flex-col items-center"><Search size={48} className="opacity-20 mb-4"/><p>Mulai ketik untuk mencari...</p></div>}
        </div>
    );
};

// --- 11. APP UTAMA ---
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null); 
    const [notifCount, setNotifCount] = useState(0); 
    const [newPostId, setNewPostId] = useState(null);
    const [showSplash, setShowSplash] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingFeed, setIsLoadingFeed] = useState(true);
    const [feedError, setFeedError] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showRewards, setShowRewards] = useState(false);
    const [canClaimReward, setCanClaimReward] = useState(false);
    const [nextRewardTime, setNextRewardTime] = useState('');

    useEffect(() => {
        const handleError = (event) => {
            if (!user || user.email !== DEVELOPER_EMAIL) {
                event.preventDefault(); 
                logSystemError(event.error || new Error(event.message), 'global_error', user);
            }
        };
        const handleRejection = (event) => {
            if (!user || user.email !== DEVELOPER_EMAIL) {
                event.preventDefault();
                logSystemError(event.reason || new Error('Unhandled Promise Rejection'), 'promise_rejection', user);
            }
        };
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, [user]);

    useEffect(() => {
        if (user && user.email !== DEVELOPER_EMAIL) {
             console.error = (...args) => {};
        }
    }, [user]);

    useEffect(() => { 
        const handleOff = () => setIsOffline(true);
        const handleOn = () => { setIsOffline(false); setRefreshTrigger(prev=>prev+1); };
        window.addEventListener('offline', handleOff);
        window.addEventListener('online', handleOn);
        return () => { window.removeEventListener('offline', handleOff); window.removeEventListener('online', handleOn); }
    }, []);

    useEffect(() => { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('firebase-messaging-sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed')); } }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [page]);
    useEffect(() => { 
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            setDarkMode(true);
        }
    }, []);

    useEffect(() => {
        if (!profile) return;
        const lastClaim = profile.lastRewardClaim ? profile.lastRewardClaim.toMillis() : 0;
        const now = Date.now();
        const diff = now - lastClaim;
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (diff >= oneDay) {
            setCanClaimReward(true);
            setNextRewardTime('');
        } else {
            setCanClaimReward(false);
            const remaining = oneDay - diff;
            const hrs = Math.floor(remaining / (1000 * 60 * 60));
            const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            setNextRewardTime(`${hrs} jam ${mins} menit`);
        }
    }, [profile, showRewards]);

    const handleClaimReward = async () => {
        if (!canClaimReward || !user) return;
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {
                lastRewardClaim: serverTimestamp(),
                reputation: increment(50) 
            });
            alert("Selamat! Anda mendapatkan 50 Reputasi & Badge Aktivitas.");
            setShowRewards(false);
        } catch (e) {
            alert("Gagal klaim: " + e.message);
        }
    };

    const toggleDarkMode = () => {
        if (darkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setDarkMode(true);
        }
    };

    useEffect(() => { 
        const timer = setTimeout(() => setShowSplash(false), 3000); 
        const p = new URLSearchParams(window.location.search).get('post'); 
        if (p) {
            setTargetPid(p);
            setPage('view_post');
        }
        return () => clearTimeout(timer); 
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', user.uid), where('isRead', '==', false), orderBy('timestamp', 'desc'), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotifCount(snapshot.size);
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const now = Date.now();
                    const notifTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
                    if (now - notifTime < 10000) { 
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
            requestNotificationPermission(u.uid);
            const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid));
            if (!userDoc.exists()) {
                setShowOnboarding(true); 
            } else {
                 const userData = userDoc.data();
                 if (userData.isBanned) {
                     alert("AKUN ANDA TELAH DIBLOKIR/BANNED OLEH DEVELOPER.");
                     await signOut(auth);
                     setUser(null);
                     setProfile(null);
                     return;
                 }
                 await updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{});
            }
        } else { 
            setUser(null); 
            setProfile(null); 
        } 
    }), []);

    useEffect(() => { 
        if(user) {
            const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), async s => {
                if(s.exists()) {
                     const data = s.data();
                     if (data.isBanned) {
                         alert("AKUN ANDA TELAH DIBLOKIR/BANNED OLEH DEVELOPER.");
                         await signOut(auth);
                         return;
                     }
                     setProfile({...data, uid:user.uid, email:user.email});
                     if (showOnboarding) setShowOnboarding(false);
                }
            });
            const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));
            return () => { unsubP(); unsubNotif(); };
        }
    }, [user]);

    useEffect(() => {
        setIsLoadingFeed(true);
        setFeedError(false);
        
        // PERBAIKAN PERFORMA UTAMA: LIMIT 15
        // Ini adalah "Initial Load". Sisanya akan ditangani oleh "loadMorePosts" di HomeScreen
        // Menggunakan "orderBy" saja agar query ringan
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(15));
        
        const unsubPosts = onSnapshot(q, async s => {
            try {
                const raw = s.docs.map(d=>({id:d.id,...d.data()}));
                const postsWithFallback = raw.map(p => ({
                    ...p,
                    user: p.user || { username: 'Pengguna', photoURL: '' } 
                }));
                setPosts(postsWithFallback); 
                try {
                    const uids = [...new Set(raw.map(r=>r.userId))];
                    const userPromises = uids.map(uid => 
                        getDoc(doc(db, getPublicCollection('userProfiles'), uid))
                        .then(snap => ({ id: uid, data: snap.exists() ? snap.data() : null }))
                        .catch(() => ({ id: uid, data: null }))
                    );
                    const userResults = await Promise.all(userPromises);
                    const userMap = {};
                    userResults.forEach(res => { if(res.data) userMap[res.id] = res.data; });
                    if (Object.keys(userMap).length > 0) {
                        setPosts(prevPosts => prevPosts.map(p => ({
                            ...p,
                            user: userMap[p.userId] || p.user
                        })));
                    }
                } catch (backgroundError) {}
                setIsLoadingFeed(false);
            } catch (err) {
                setFeedError(true);
                setIsLoadingFeed(false);
            }
        }); 
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        return () => { unsubPosts(); unsubUsers(); };
    }, [refreshTrigger]); 

    const handleFollow = async (uid, isFollowing) => { 
        if (!user) { setShowAuthModal(true); return; } 
        if (!profile) return; 
        const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); 
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid); 
        try { 
            if(isFollowing) { 
                await updateDoc(meRef, {following: arrayRemove(uid)}); 
                await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); 
            } else { 
                await updateDoc(meRef, {following: arrayUnion(uid)}); 
                await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); 
                
                // REPUTASI UPDATE: Tambah Reputasi saat difollow
                // SECURITY UPDATE: Cegah follow diri sendiri (untuk jaga-jaga)
                if (uid !== profile.uid) {
                    await updateDoc(targetRef, { reputation: increment(5) }); // +5 Poin Follow
                    sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); 
                }
            } 
        } catch (e) { console.error("Gagal update pertemanan", e); } 
    };
    
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };

    if (showSplash) return <SplashScreen />;
    if (user === undefined && !isOffline) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;
    if (isOffline && !posts.length) return <OfflinePage onRetry={()=>setRefreshTrigger(prev=>prev+1)}/>;

    const isMeDeveloper = user && user.email === DEVELOPER_EMAIL;
    const targetUser = users.find(u => u.uid === targetUid);
    const isGuest = !user; 

    return (
        <div>
            <style>{`.dark body { background-color: #111827; color: white; }`}</style>
            <div className={`min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
                <NetworkStatus />
                {page!=='legal' && ( 
                    <header className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-white/50 dark:border-gray-800 shadow-sm transition-colors duration-300">
                        <div className="flex items-center gap-2" onClick={()=>setPage('home')}>
                            <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                            <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                        </div>
                        <div className="flex gap-3 items-center">
                            <button onClick={()=>setPage('legal')} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition" title="Kebijakan & Privasi">
                                <Scale size={20}/>
                            </button>
                            <button onClick={toggleDarkMode} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 dark:text-yellow-400 hover:bg-gray-100 transition">
                                {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                            </button>
                            {isGuest ? (
                                <button onClick={()=>setShowAuthModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-full font-bold text-xs shadow-lg hover:bg-sky-600 transition flex items-center gap-2">
                                    <LogIn size={16}/> Masuk
                                </button>
                            ) : (
                                <>
                                    <button onClick={()=>setPage('notifications')} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative">
                                        <Bell size={20}/>
                                        {notifCount>0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                                    </button>
                                    <button onClick={async()=>{await signOut(auth); setPage('home');}} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition"><LogOut size={20}/></button>
                                </>
                            )}
                        </div>
                    </header> 
                )}

                <main className={page!=='legal' ? 'pt-16' : ''}>
                    {page==='home' && (
                        <>
                            <HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}} isLoadingFeed={isLoadingFeed} feedError={feedError} retryFeed={()=>setRefreshTrigger(p=>p+1)}/>
                            <DraggableGift onClick={() => setShowRewards(true)} canClaim={canClaimReward && !isGuest} nextClaimTime={nextRewardTime}/>
                        </>
                    )}
                    {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage('home')}}/>}
                    {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} initialQuery={searchQuery} setPage={setPage} setTargetPostId={setTargetPid} />}
                    {page==='leaderboard' && <LeaderboardScreen allUsers={users} />}
                    {page==='legal' && <LegalPage onBack={()=>setPage('home')} />}
                    {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} allUsers={users} />}
                    {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} allUsers={users} />}
                    {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)} onHashtagClick={(tag)=>{setSearchQuery(tag); setPage('search');}}/>}
                </main>
                
                {page!=='legal' && (
                    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 dark:shadow-none flex items-center gap-6 z-40">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                        <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
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
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;