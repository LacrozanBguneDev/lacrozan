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
    Scale, FileText, ChevronLeft
} from 'lucide-react';

setLogLevel('silent');

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
  apiKey: "AIzaSyCK9UJfQr9kxOR8DjUYGGbtFAcHO7Bj10w",
  authDomain: "bgunenet.firebaseapp.com",
  projectId: "bgunenet",
  storageBucket: "bgunenet.firebasestorage.app",
  messagingSenderId: "234576095202",
  appId: "1:234576095202:web:b8931f7548359650a4fbbb",
  measurementId: "G-M2HY1489XB"
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

// 2. Kompresi Gambar CERDAS ke Base64 (Updated V25)
// Mengubah file gambar menjadi string base64 yang sangat terkompresi
// agar bisa disimpan di Firestore (max 1MB per doc)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Kita batasi lebar max 800px untuk menghemat ruang drastis
                const MAX_WIDTH = 800; 
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
                
                // Konversi ke Base64 JPEG dengan kualitas 60% (Cukup untuk web/mobile)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// 3. Algoritma Acak
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

// 4. Sistem Notifikasi
const sendNotification = async (toUserId, type, message, fromUser, postId = null) => {
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId, fromUserId: fromUser.uid, fromUsername: fromUser.username, fromPhoto: fromUser.photoURL || '',
            type: type, message: message, postId: postId, isRead: false, timestamp: serverTimestamp()
        });
    } catch (error) { console.error("Gagal mengirim notifikasi:", error); }
};

// 5. Formatter Waktu
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
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
};

// 6. Detektor Media Embed
const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) { return { type: 'link', embedUrl: url, displayUrl: url }; }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) { return { type: 'audio_file', url: url }; }
    return null;
};

// 7. Kalkulator Reputasi
const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
};

// 8. Ekstraktor Hashtag
const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g);
    return matches ? matches : [];
};

// 9. Cek Online Status
const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diff = Date.now() - last.getTime();
    return diff < 10 * 60 * 1000; 
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL
// ==========================================

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

// --- IMAGE WITH RETRY (SOLUSI STUCK LOADING) ---
const ImageWithRetry = ({ src, alt, className, onClick }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    
    useEffect(() => {
        let timer;
        if (loading) {
            timer = setTimeout(() => {
                if (loading) { setLoading(false); setError(true); }
            }, 10000); 
        }
        return () => clearTimeout(timer);
    }, [loading, src]);

    const handleRetry = (e) => {
        e.stopPropagation(); setError(false); setLoading(true); setRetryCount(prev => prev + 1);
    };

    const displaySrc = retryCount > 0 && !src.startsWith('data:') ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}-${Date.now()}` : src;

    if (error) {
        return (
            <div className={`bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 ${className}`} style={{minHeight: '200px'}}>
                <ImageOff size={24} className="mb-2 opacity-50"/>
                <p className="text-[10px] mb-2 text-center px-2">Gambar Error</p>
                <button onClick={handleRetry} className="bg-white dark:bg-gray-800 border px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 flex items-center gap-1"><RefreshCw size={10}/> Refresh</button>
            </div>
        );
    }

    return (
        <div className={`relative ${className} overflow-hidden bg-gray-100 dark:bg-gray-800`} onClick={onClick}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10"><Loader2 className="animate-spin text-gray-400" size={24}/></div>
            )}
            <img 
                src={displaySrc} 
                alt={alt} 
                className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
                onLoad={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
                loading="lazy"
            />
        </div>
    );
};

// --- LIGHTBOX (FULLSCREEN IMAGE VIEWER) ---
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

const SkeletonPost = () => (
    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded-full"></div><div className="h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 dark:bg-sky-900/30 px-1 rounded text-sm text-sky-700 dark:text-sky-400 font-mono border border-sky-100 dark:border-sky-800">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER
// ==========================================
const DeveloperDashboard = ({ onClose }) => {
    const [stats, setStats] = useState({ users: 0, posts: 0, postsToday: 0 });
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [sendingBC, setSendingBC] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => { resolve(snap); unsub(); }); });
            const postsSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('posts')), (snap) => { resolve(snap); unsub(); }); });
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const rawPosts = postsSnap.docs.map(d => d.data());
            const postsToday = rawPosts.filter(p => p.timestamp?.toMillis && p.timestamp.toMillis() >= todayStart).length;
            const tenMinAgo = Date.now() - 10 * 60 * 1000;
            const active = usersSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(u => u.lastSeen?.toMillis && u.lastSeen.toMillis() > tenMinAgo);
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
            setOnlineUsers(active);
            setChartData(last7Days);
            setLoading(false);
        };
        fetchData();
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

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="text-sky-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white p-2 rounded-full shadow hover:bg-gray-200"><X/></button></div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100 text-center"><Users className="mx-auto text-sky-500 mb-2"/><h3 className="text-2xl font-bold">{stats.users}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total User</p></div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 text-center"><ImageIcon className="mx-auto text-purple-500 mb-2"/><h3 className="text-2xl font-bold">{stats.posts}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total Post</p></div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 text-center"><Activity className="mx-auto text-emerald-500 mb-2"/><h3 className="text-2xl font-bold">{stats.postsToday}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Post Hari Ini</p></div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm border border-gray-200 mb-3 outline-none" rows="3" placeholder="Tulis pesan untuk semua user..."/>
                            <button onClick={handleBroadcast} disabled={sendingBC} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition">{sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}</button>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={18}/> Aktivitas Minggu Ini</h3>
                            <div className="flex items-end justify-between h-32 gap-2">{chartData.map((d, i) => ( <div key={i} className="flex flex-col items-center w-full group"><div className="text-xs font-bold text-sky-600 mb-1 opacity-0 group-hover:opacity-100 transition">{d.count}</div><div className="w-full bg-sky-100 rounded-t-lg hover:bg-sky-300 transition-all relative" style={{height: `${d.height}%`}}></div><div className="text-[10px] text-gray-400 mt-2 font-bold">{d.day}</div></div> ))}</div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Globe size={18}/> Pengguna Online ({onlineUsers.length})</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">{onlineUsers.length === 0 ? <p className="text-gray-400 text-sm">Tidak ada user aktif saat ini.</p> : onlineUsers.map(u => ( <div key={u.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-sky-200 rounded-full flex items-center justify-center font-bold text-sky-700">{u.username?.[0]}</div><div><p className="text-sm font-bold text-gray-800">{u.username}</p><p className="text-[10px] text-gray-500">{u.email}</p></div></div><div className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded-full"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Online</div></div> ))}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI, LEGAL & PENGATURAN USER
// ==========================================

// --- ONBOARDING SCREEN (PENGGANTI LANDING PAGE UNTUK USER BARU) ---
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
                lastSeen: serverTimestamp()
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

// --- AUTH SCREEN (LOGIN GOOGLE SAJA) ---
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

// --- LEGAL PAGE (KEBIJAKAN HUKUM) ---
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
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Lock size={18} className="text-sky-500"/> Kebijakan Privasi</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700">
                        <p className="mb-3">Di {APP_NAME}, privasi Anda adalah prioritas kami. Kami mengumpulkan data minimal yang diperlukan untuk fungsionalitas aplikasi.</p>
                        <ul className="list-disc pl-5 space-y-1 mb-3">
                            <li><strong>Data Akun:</strong> Nama, Email, Foto Profil (via Google Login).</li>
                            <li><strong>Konten:</strong> Postingan, Komentar, dan Pesan yang Anda buat.</li>
                            <li><strong>Aktivitas:</strong> Log interaksi seperti Like dan Follow untuk personalisasi.</li>
                        </ul>
                        <p>Kami tidak menjual data Anda ke pihak ketiga. Data disimpan aman menggunakan infrastruktur Google Cloud (Firebase).</p>
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
                        <p className="mt-3 text-rose-500 font-bold text-xs">Pelanggaran dapat mengakibatkan pemblokiran akun permanen.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Info size={18} className="text-emerald-500"/> Tentang Kami</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700">
                        <p>BguneNet dikembangkan oleh <strong>Irham Andika</strong> (Siswa SMPN 3 Mentok) sebagai platform sosial media alternatif yang ringan, cepat, dan berfokus pada komunitas lokal & global.</p>
                        <p className="mt-2 text-xs text-gray-400">Versi Aplikasi: 25.0 (Ultimate Build)</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

// --- LEADERBOARD SCREEN (FITUR BARU) ---
const LeaderboardScreen = ({ allUsers }) => {
    // Sortir user berdasarkan followers terbanyak
    const sortedUsers = useMemo(() => {
        return [...allUsers]
            .sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0))
            .slice(0, 50); // Top 50
    }, [allUsers]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Papan Peringkat</h1>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {sortedUsers.map((u, index) => (
                    <div key={u.uid} className={`flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 ${index < 3 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10' : ''}`}>
                        <div className={`w-8 h-8 flex items-center justify-center font-black text-lg mr-3 ${index===0?'text-yellow-500':index===1?'text-gray-400':index===2?'text-orange-500':'text-gray-300'}`}>
                            {index + 1}
                        </div>
                        <div className="relative mr-3">
                            <img src={u.photoURL || APP_LOGO} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"/>
                            {index === 0 && <Crown size={14} className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-500"/>}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{u.username}</h3>
                            <p className="text-xs text-gray-400">{(u.followers?.length || 0)} Pengikut</p>
                        </div>
                        {index < 3 && <Medal size={20} className={index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-500'}/>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: KOMPONEN UTAMA APLIKASI
// ==========================================

// --- SMART GRID MEDIA DISPLAY (NEW V25) ---
const MediaGrid = ({ mediaUrls, onImageClick }) => {
    const count = mediaUrls.length;
    
    if (count === 0) return null;

    if (count === 1) {
        return (
            <div className="mb-4 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/20 border border-gray-100 dark:border-gray-700 relative aspect-video" onClick={() => onImageClick(0)}>
                <img src={mediaUrls[0]} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-500"/>
            </div>
        );
    }

    if (count === 2) {
        return (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl overflow-hidden aspect-video">
                {mediaUrls.map((url, i) => (
                    <div key={i} className="relative h-full" onClick={() => onImageClick(i)}>
                        <img src={url} className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition"/>
                    </div>
                ))}
            </div>
        );
    }

    if (count === 3) {
        return (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl overflow-hidden aspect-square">
                <div className="col-span-2 h-[60%]" onClick={() => onImageClick(0)}>
                    <img src={mediaUrls[0]} className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition"/>
                </div>
                <div className="h-[40%]" onClick={() => onImageClick(1)}>
                    <img src={mediaUrls[1]} className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition"/>
                </div>
                <div className="h-[40%]" onClick={() => onImageClick(2)}>
                    <img src={mediaUrls[2]} className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition"/>
                </div>
            </div>
        );
    }

    // 4 or more
    return (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl overflow-hidden aspect-square">
            {mediaUrls.slice(0, 4).map((url, i) => (
                <div key={i} className="relative h-full" onClick={() => onImageClick(i)}>
                    <img src={url} className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition"/>
                    {i === 3 && count > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl cursor-pointer">
                            +{count - 4}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// --- POST ITEM (LENGKAP DENGAN MODE TAMU & DARK MODE & MULTI IMAGE) ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper, isGuest, onRequestLogin }) => {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    
    const [isSaved, setIsSaved] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);
    
    // Lightbox State
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const isOwner = currentUserId && post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 
    const isMeme = post.category === 'meme';

    // Safe access untuk guest mode
    const isFollowing = profile ? (profile.following || []).includes(post.userId) : false;
    const isFollowedByTarget = profile ? (profile.followers || []).includes(post.userId) : false;
    const isFriend = isFollowing && isFollowedByTarget;

    const MAX_CHARS = 250;
    const isLongText = post.content && post.content.length > MAX_CHARS;
    const displayText = isExpanded || !isLongText ? post.content : post.content.substring(0, MAX_CHARS) + "...";

    // Handle legacy single image vs new multi image array
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
        try {
            if (newLiked) {
                await updateDoc(ref, { likes: arrayUnion(currentUserId) });
                if (post.userId !== currentUserId) sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
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
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => { if (confirm(isMeDeveloper && !isOwner ? "⚠️ ADMIN: Hapus postingan orang lain?" : "Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };
    const handleDeleteComment = async (commentId) => { if(confirm("Hapus komentar?")) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin!'); } catch (e) { alert('Gagal menyalin link'); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !embed;
    // Images handled by mediaList now

    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-700 relative overflow-hidden group transition hover:shadow-lg">
            {post.isShort && <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md z-10 flex items-center"><Zap size={10} className="mr-1 text-yellow-400"/> SHORT</div>}
            {!post.isShort && likeCount > 10 && <div className="absolute top-4 right-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-200 dark:border-orange-800 flex items-center z-10"><Flame size={10} className="mr-1"/> TRENDING</div>}
            {isMeme && !post.isShort && <div className="absolute top-4 right-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800 flex items-center z-10"><Laugh size={10} className="mr-1"/> MEME</div>}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]"><div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">{post.user?.photoURL ? <ImageWithRetry src={post.user.photoURL} alt="User" className="w-full h-full object-cover"/> : <span className="font-bold text-sky-600">{post.user?.username?.[0]}</span>}</div></div>
                    <div><h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-tight flex items-center gap-1">{post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>{isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>}</div></div>
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
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{renderMarkdown(displayText)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
                    
                    {/* Media Display Area */}
                    <div onDoubleClick={handleDoubleTap} className="relative">
                         {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700 pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                         
                         {/* Audio */}
                         {isAudio && <AudioPlayer src={post.mediaUrl || embed.url} />}
                         
                         {/* Video */}
                         {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black rounded-2xl mb-4"/>}
                         
                         {/* Embeds */}
                         {embed?.type === 'youtube' && <div className="aspect-video mb-4 rounded-2xl overflow-hidden"><iframe src={embed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                         {embed?.type === 'link' && <a href={embed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center bg-sky-50 dark:bg-gray-900 text-sky-600 font-bold text-sm hover:underline mb-4 rounded-2xl">Buka Tautan Eksternal <ExternalLink size={14} className="inline ml-1"/></a>}

                         {/* New Multi Image Grid System (Base64 Friendly) */}
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
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">{comments.length === 0 ? <p className="text-xs text-center text-gray-400">Belum ada komentar.</p> : comments.map(c => ( <div key={c.id} className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900 p-3 rounded-xl text-xs flex justify-between items-start group"><div><span className="font-bold text-gray-800 dark:text-gray-200 mr-1">{c.username}</span><span className="text-gray-600 dark:text-gray-400">{c.text}</span></div>{(currentUserId === c.userId || isMeDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">{isMeDeveloper && currentUserId !== c.userId ? <ShieldAlert size={12}/> : <Trash size={12}/>}</button>}</div> ))}</div>
                    <form onSubmit={handleComment} className="flex gap-2 relative"><input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={isGuest ? "Login untuk komentar..." : "Tulis komentar..."} disabled={isGuest} className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200"/><button type="submit" disabled={!newComment.trim() || isGuest} className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50"><Send size={14}/></button></form>
                </div>
            )}
            
            {/* Lightbox Component inside PostItem to avoid portal complexity */}
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
        </div>
    );
};

// --- CREATE POST (DENGAN MULTI UPLOAD & BASE64 COMPRESSION) ---
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
                url: '' // reset URL input if file is selected
            });
        }
    };

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let mediaUrls = [];
            let mediaType = 'text';

            if (form.files.length > 0) {
                const firstFile = form.files[0];
                
                if (firstFile.type.startsWith('image')) {
                    mediaType = 'image';
                    setProg(10);
                    // Loop compress semua gambar
                    for (let i = 0; i < form.files.length; i++) {
                        const base64 = await compressImageToBase64(form.files[i]);
                        mediaUrls.push(base64);
                        setProg(10 + ((i + 1) / form.files.length) * 80);
                    }
                } else if (firstFile.type.startsWith('video') || firstFile.type.startsWith('audio')) {
                    // Untuk video/audio kita pakai single file saja karena berat base64 nya
                    // Tapi karena request user adalah base64, kita convert video/audio ke base64 juga (RISKY tapi sesuai request)
                    // Note: Base64 video sangat berat. Sebaiknya video tetap link/api.
                    // Tapi demi "no api system", kita coba convert to base64 (Max size file harus kecil)
                    const reader = new FileReader();
                    reader.readAsDataURL(firstFile);
                    await new Promise(resolve => {
                         reader.onload = () => {
                             mediaUrls.push(reader.result);
                             resolve();
                         }
                    });
                    mediaType = firstFile.type.startsWith('video') ? 'video' : 'audio';
                    setProg(100);
                }
            } else if (form.url) {
                mediaType = 'link';
                mediaUrls.push(form.url);
            }
            
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            
            // Simpan ke Firestore
            // Note: mediaUrls adalah array string Base64
            const ref = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, 
                title: form.title, 
                content: form.content, 
                mediaUrls: mediaUrls, // Array foto
                mediaUrl: mediaUrls[0] || '', // Legacy support
                mediaType: mediaType, 
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                isShort: form.isShort, 
                category: category, 
                user: {username, uid: userId}
            });
            setProg(100); setTimeout(()=>onSuccess(ref.id, form.isShort), 500);
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
                            <span className="text-xs font-bold">{form.files.length > 0 && !form.isAudio ? `${form.files.length} Foto Dipilih` : 'Foto (Banyak)'}</span>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} disabled={loading}/>
                        </label>
                        
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.isAudio ?'bg-pink-50 border-pink-200 text-pink-600':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                            <Music size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.isAudio ? 'Audio Siap' : 'Audio'}</span>
                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={loading}/>
                        </label>

                        <div onClick={()=>setForm({...form, isShort:!form.isShort})} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap transition ${form.isShort?'bg-black text-white border-black':'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><Zap size={18} className="mr-2"/><span className="text-xs font-bold">Shorts</span></div>
                    </div>
                    
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, files:[], isShort: e.target.value.includes('shorts')})} placeholder="Atau Link Video (YouTube)..." className="w-full pl-10 py-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs outline-none"/></div>
                    <button disabled={loading || (!form.content && form.files.length === 0 && !form.url)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest }) => {
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false);
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); 
    const [mood, setMood] = useState(profileData.mood || '');
    const [isEditingMood, setIsEditingMood] = useState(false);

    // Jika viewerProfile null (guest), set uid null agar tidak crash
    const viewerUid = viewerProfile ? viewerProfile.uid : null;
    const isSelf = viewerUid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;

    const userPosts = allPosts.filter(p=>p.userId===profileData.uid).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
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
                // Update V25: Use Base64 compression for profile pic too
                url = await compressImageToBase64(file);
            }
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); 
            setEdit(false); 
        } catch(e){alert(e.message)} finally{setLoad(false)}; 
    };

    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; 
    const isFollowedByTarget = viewerProfile ? (viewerProfile.followers || []).includes(profileData.uid) : false;
    const isFriend = isFollowing && isFollowedByTarget; 
    const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-sky-50 dark:border-gray-700 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 dark:from-sky-900 dark:to-purple-900 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8">
                    <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 dark:bg-gray-700 ${isOnline ? 'border-emerald-400' : 'border-white dark:border-gray-600'} relative`}>
                        {load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}
                        {profileData.photoURL ? <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-sky-500 text-3xl font-bold">{profileData.username?.[0]}</div>}
                    </div>
                    <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    {isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}
                </div>

                {edit ? ( <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent dark:text-white"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs dark:text-gray-300"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'Mengunggah...':'Simpan'}</button></div> ) : ( <> <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> {isSelf ? ( isEditingMood ? ( <div className="flex items-center justify-center gap-2 mt-2"><input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32"/><button onClick={saveMood} className="text-green-500"><Check size={14}/></button></div> ) : ( <div onClick={()=>setIsEditingMood(true)} className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-sky-500 flex items-center justify-center gap-1">{profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/></div> ) ) : ( profileData.mood && <p className="text-sm text-gray-500 mt-1 italic">"{profileData.mood}"</p> )} </> )}
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label} (Reputasi: {totalLikes})</div>
                {!isSelf && !isGuest && ( <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${isFriend ? 'bg-emerald-500 text-white shadow-emerald-200' : isFollowing ? 'bg-gray-200 text-gray-600' : 'bg-sky-500 text-white shadow-sky-200'}`}>{isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                {isDev && isSelf && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 shadow-lg"><ShieldCheck size={16}/> Dashboard Developer</button>}
                <div className="flex justify-center gap-6 mt-6 border-t dark:border-gray-700 pt-6"><div><span className="font-bold text-xl block dark:text-white">{followersCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div><div><span className="font-bold text-xl block dark:text-white">{followingCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div><div><span className="font-bold text-xl block text-emerald-600">{friendsCount}</span><span className="text-[10px] text-emerald-600 font-bold uppercase">Teman</span></div></div>
            </div>
            {isSelf && ( <div className="flex gap-2 px-4 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>Disimpan</button></div> )}
            <div className="px-4 space-y-6">{activeTab === 'posts' ? (userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)) : ( savedPostsData.length > 0 ? savedPostsData.map(p=><PostItem key={p.id} post={p} currentUserId={viewerUid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>) : <div className="text-center text-gray-400 py-10">Belum ada postingan yang disimpan.</div>)}</div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

// --- TRENDING TAGS ---
const TrendingTags = ({ posts }) => {
    const tags = useMemo(() => { const tagCounts = {}; posts.forEach(p => { extractHashtags(p.content).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); }); return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10); }, [posts]);
    if (tags.length === 0) return null;
    return (
        <div className="mb-4 overflow-x-auto no-scrollbar py-2"><div className="flex gap-3"><div className="flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap mr-2"><TrendingUp size={16}/> Trending:</div>{tags.map(([tag, count]) => ( <div key={tag} className="px-3 py-1 bg-white dark:bg-gray-800 border border-sky-100 dark:border-gray-700 rounded-full text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm whitespace-nowrap flex items-center gap-1">#{tag.replace('#','')} <span className="text-sky-400 ml-1">({count})</span></div> ))}</div></div>
    );
};

// --- HOME SCREEN ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, isGuest, onRequestLogin }) => {
    const [sortType, setSortType] = useState('random'); 
    const [stableFeed, setStableFeed] = useState([]);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [displayCount, setDisplayCount] = useState(5);
    const [loadingMore, setLoadingMore] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (allPosts.length === 0) { setLoadingFeed(false); return; }
        let basePosts = allPosts.filter(p => !p.isShort);
        let pinnedPost = null;
        if (newPostId) {
            const idx = basePosts.findIndex(p => p.id === newPostId);
            if (idx > -1) { pinnedPost = basePosts[idx]; basePosts.splice(idx, 1); }
        }

        let processedPosts = [];
        if (sortType === 'latest') processedPosts = basePosts.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        else if (sortType === 'popular') processedPosts = basePosts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        else if (sortType === 'meme') processedPosts = basePosts.filter(p => p.category === 'meme').sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        else {
            if (isFirstLoad || stableFeed.length === 0) processedPosts = shuffleArray([...basePosts]);
            else processedPosts = stableFeed.map(oldPost => basePosts.find(p => p.id === oldPost.id)).filter(p => p !== undefined);
        }

        if (pinnedPost) processedPosts.unshift(pinnedPost);
        setStableFeed(processedPosts);
        setIsFirstLoad(false);
        setLoadingFeed(false);
    }, [allPosts, sortType, newPostId]); 

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting && !loadingMore && stableFeed.length > displayCount) {
                setLoadingMore(true);
                setTimeout(() => { setDisplayCount(prev => prev + 5); setLoadingMore(false); }, 800);
            }
        }, { threshold: 0.5 });
        const currentBottom = bottomRef.current;
        if (currentBottom) observer.observe(currentBottom);
        return () => { if (currentBottom) observer.unobserve(currentBottom); };
    }, [stableFeed, displayCount, loadingMore]);

    const manualRefresh = () => { setLoadingFeed(true); setStableFeed([]); setIsFirstLoad(true); setSortType('random'); setDisplayCount(5); clearNewPost(); setTimeout(() => setLoadingFeed(false), 800); };
    const visiblePosts = stableFeed.slice(0, displayCount);

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

            <TrendingTags posts={allPosts} />

            {loadingFeed ? <><SkeletonPost/><SkeletonPost/></> : visiblePosts.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700"><p className="text-gray-400 font-bold">Belum ada postingan.</p></div>
            ) : (
                <>
                    {visiblePosts.map(p => (
                        <div key={p.id} className={p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                            {p.id === newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-1"><CheckCircle size={14}/> Postingan Berhasil Terkirim</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile?.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={onRequestLogin}/>
                        </div>
                    ))}
                    <div ref={bottomRef} className="h-10 w-full flex items-center justify-center">
                        {loadingMore && <Loader2 className="animate-spin text-sky-500"/>}
                        {!loadingMore && stableFeed.length <= displayCount && stableFeed.length > 0 && <span className="text-xs text-gray-400">-- Anda sudah mencapai ujung dunia --</span>}
                    </div>
                </>
            )}
        </div>
    );
};

// --- 8. SHORTS SCREEN (INFINITE LOOP) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollow, profile, isGuest, onRequestLogin }) => {
    const [feed, setFeed] = useState([]);
    useEffect(() => { const shorts = allPosts.filter(p => p.isShort && p.mediaUrl); setFeed(shuffleArray(shorts)); }, [allPosts]);
    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 200) { setFeed(prev => [...prev, ...prev]); }
    };
    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center">
             <div className="w-full max-w-md h-[100dvh] overflow-y-scroll snap-y snap-mandatory snap-always no-scrollbar bg-black" onScroll={handleScroll}>
                {feed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 font-bold"><Film size={48} className="mb-4 opacity-50"/> <p>Belum ada video Shorts</p></div>
                ) : (
                    feed.map((p, i) => <ShortItem key={`${p.id}-${i}`} post={p} currentUserId={currentUserId} handleFollow={handleFollow} profile={profile} isGuest={isGuest} onRequestLogin={onRequestLogin}/>)
                )}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollow, profile, isGuest, onRequestLogin }) => {
    const ref = useRef(); const vidRef = useRef();
    const [playing, setPlaying] = useState(false); const [muted, setMuted] = useState(false);
    const [showCom, setShowCom] = useState(false); const [comments, setComments] = useState([]); const [txt, setTxt] = useState('');
    const isLiked = currentUserId ? post.likes?.includes(currentUserId) : false; 
    const embed = useMemo(()=>getMediaEmbed(post.mediaUrl),[post.mediaUrl]);

    useEffect(() => {
        const obs = new IntersectionObserver(e => { e.forEach(en => { setPlaying(en.isIntersecting); if(vidRef.current) { if(en.isIntersecting) vidRef.current.play().catch(()=>{}); else { vidRef.current.pause(); vidRef.current.currentTime = 0; } } }); }, {threshold: 0.6});
        if(ref.current) obs.observe(ref.current); return () => ref.current && obs.unobserve(ref.current);
    }, []);

    const toggleLike = async () => {
        if (isGuest) { onRequestLogin(); return; }
        const r = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) updateDoc(r, {likes:arrayRemove(currentUserId)});
        else { updateDoc(r, {likes:arrayUnion(currentUserId)}); if(post.userId!==currentUserId) sendNotification(post.userId, 'like', 'menyukai shorts Anda', profile, post.id); }
    };

    useEffect(()=>{if(showCom) return onSnapshot(query(collection(db,getPublicCollection('comments')), where('postId','==',post.id)),s=>setComments(s.docs.map(d=>d.data())))},[showCom,post.id]);

    return (
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center overflow-hidden border-b border-gray-800">
             {embed?.type==='youtube' ? <div className="w-full h-full relative pointer-events-auto">{playing?<iframe src={`${embed.embedUrl}&autoplay=1&controls=0&loop=1`} className="w-full h-full"/>:<div className="w-full h-full bg-black"/>}<div className="absolute inset-0 bg-transparent pointer-events-none"/></div> : <video ref={vidRef} src={post.mediaUrl} className="w-full h-full object-cover" loop muted={muted} playsInline onClick={()=>setMuted(!muted)}/>}
             <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none flex flex-col justify-end p-5 pb-24">
                <div className="pointer-events-auto flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-white/50 p-0.5"><img src={post.user?.photoURL||APP_LOGO} className="w-full h-full rounded-full object-cover"/></div>
                    <div><p className="text-white font-bold text-sm drop-shadow-md">@{post.user?.username}</p><button onClick={()=> isGuest ? onRequestLogin() : handleFollow(post.userId, false)} className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-0.5 rounded-full mt-1 hover:bg-white/40 transition">Ikuti</button></div>
                </div>
                <p className="text-white text-sm drop-shadow-md line-clamp-3 mb-2">{post.content}</p>
             </div>
             <div className="absolute right-3 bottom-28 flex flex-col gap-6 pointer-events-auto z-20">
                <button onClick={toggleLike} className="flex flex-col items-center group"><div className={`p-3 rounded-full backdrop-blur-md transition ${isLiked?'bg-rose-500/80 text-white':'bg-black/30 text-white border border-white/20'}`}><Heart size={24} fill={isLiked?'currentColor':'none'}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.likes?.length||0}</span></button>
                <button onClick={()=>setShowCom(true)} className="flex flex-col items-center"><div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20"><MessageSquare size={24}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.commentsCount||0}</span></button>
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin')}} className="flex flex-col items-center"><div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20"><Share2 size={24}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">Share</span></button>
             </div>
             {showCom && <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end pointer-events-auto"><div className="w-full h-[60%] bg-white rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom duration-300"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">Komentar</h3><button onClick={()=>setShowCom(false)} className="bg-gray-100 p-1 rounded-full"><X size={20}/></button></div><div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">{comments.map((c,i)=><div key={i} className="text-xs text-gray-800 border-b border-gray-50 pb-2"><span className="font-bold text-sky-600 mr-2">{c.username}</span>{c.text}</div>)}</div><div className="flex gap-2 mt-2 pt-2 border-t"><input value={txt} onChange={e=>setTxt(e.target.value)} disabled={isGuest} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-xs outline-none" placeholder={isGuest ? "Login dulu..." : "Ketik..."}/><button onClick={async()=>{if(!txt.trim() || isGuest)return;await addDoc(collection(db,getPublicCollection('comments')),{postId:post.id,userId:currentUserId,text:txt,username:profile.username});await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });setTxt('')}} className="text-sky-600 font-bold text-xs px-2">Kirim</button></div></div></div>}
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

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    if (!post) return <div className="p-10 text-center text-gray-400 mt-20">Postingan hilang.<br/><button onClick={handleBack} className="text-sky-600 font-bold mt-4">Kembali</button></div>;
    return (
        <div className="max-w-lg mx-auto p-4 pb-40 pt-6">
            <button onClick={handleBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white dark:bg-gray-800 dark:text-gray-200 px-4 py-2 rounded-xl shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button>
            <PostItem post={post} {...props}/>
            <div className="mt-8 text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400 text-sm font-bold flex flex-col items-center justify-center gap-2"><Coffee size={24} className="opacity-50"/> Gaada lagi postingan di bawah</div>
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile, isGuest, onRequestLogin }) => {
    const [queryTerm, setQueryTerm] = useState('');
    const [results, setResults] = useState({ users: [], posts: [] });

    useEffect(() => {
        if (!queryTerm) { setResults({ users: [], posts: [] }); return; }
        const lower = queryTerm.toLowerCase();
        const foundUsers = allUsers.filter(u => u.username?.toLowerCase().includes(lower));
        const foundPosts = allPosts.filter(p => p.content?.toLowerCase().includes(lower) || p.title?.toLowerCase().includes(lower));
        setResults({ users: foundUsers, posts: foundPosts });
    }, [queryTerm, allPosts, allUsers]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 mb-6">
                <Search className="ml-2 text-gray-400"/><input value={queryTerm} onChange={e=>setQueryTerm(e.target.value)} placeholder="Cari orang atau postingan..." className="flex-1 p-2 outline-none bg-transparent dark:text-white"/>
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
                            <div className="space-y-3">{results.posts.map(p => ( <div key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex gap-3" onClick={()=>goToProfile(p.userId)}> <div className="flex-1"> <p className="font-bold text-sm mb-1 line-clamp-1 dark:text-white">{p.title || 'Tanpa Judul'}</p> <p className="text-xs text-gray-500 line-clamp-2">{p.content}</p> </div> </div> ))}</div>
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
    const [page, setPage] = useState('home'); // Default ke home (beranda)
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null); 
    const [notifCount, setNotifCount] = useState(0); 
    const [newPostId, setNewPostId] = useState(null);
    const [showSplash, setShowSplash] = useState(true);

    // STATE BARU UNTUK FITUR BARU
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('firebase-messaging-sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed')); } }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [page]);
    useEffect(() => { 
        // Load tema dari localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            setDarkMode(true);
        }
    }, []);

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

    useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 3000); const p = new URLSearchParams(window.location.search).get('post'); if (p) setTargetPid(p); return () => clearTimeout(timer); }, []);

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
            
            // Cek apakah user sudah punya profil
            const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid));
            if (!userDoc.exists()) {
                setShowOnboarding(true); // Tampilkan onboarding jika belum punya data
            } else {
                 await updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{});
            }
        } else { 
            setUser(null); 
            setProfile(null); 
        } 
    }), []);

    useEffect(() => { 
        if(user) {
            // Jika user login, setup listener profil
            const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => {
                if(s.exists()) {
                     setProfile({...s.data(), uid:user.uid, email:user.email});
                     if (showOnboarding) setShowOnboarding(false); // Tutup onboarding jika data sudah masuk
                }
            });
            const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));
            return () => { unsubP(); unsubNotif(); };
        }
    }, [user]);

    // Listener Global untuk Post & User (Selalu jalan untuk Mode Tamu)
    useEffect(() => {
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => { const raw = s.docs.map(d=>({id:d.id,...d.data()})); const uids = [...new Set(raw.map(r=>r.userId))]; const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u)))); const map = {}; snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()}); setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user}))); }); 
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        return () => { unsubPosts(); unsubUsers(); };
    }, []);

    const handleFollow = async (uid, isFollowing) => { 
        if (!user) { setShowAuthModal(true); return; } // Guest check
        if (!profile) return; 
        const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); 
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid); 
        try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } } catch (e) { console.error("Gagal update pertemanan", e); } 
    };
    
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };

    if (showSplash) return <SplashScreen />;
    if (user === undefined) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;

    const isMeDeveloper = user && user.email === DEVELOPER_EMAIL;
    const targetUser = users.find(u => u.uid === targetUid);
    const isGuest = !user; // Mode tamu aktif jika user null

    return (
        <div>
            {/* INJECT CSS VARIABLES FOR DARK MODE COMPATIBILITY */}
            <style>{`
                .dark body { background-color: #111827; color: white; }
            `}</style>
            
            <div className={`min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300`}>
                
                {/* GLOBAL HEADER */}
                {page!=='shorts' && page!=='legal' && ( 
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

                <main className={page!=='shorts' && page!=='legal' ? 'pt-16' : ''}>
                    {page==='home' && <HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)}/>}
                    {page==='shorts' && <><button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition"><ArrowLeft/></button><ShortsScreen allPosts={posts} currentUserId={user?.uid} handleFollow={handleFollow} profile={profile} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)}/></>}
                    {page==='create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage(short?'shorts':'home')}}/>}
                    {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)}/>}
                    {page==='leaderboard' && <LeaderboardScreen allUsers={users} />}
                    {page==='legal' && <LegalPage onBack={()=>setPage('home')} />}
                    {page==='notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} isGuest={false} />}
                    {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} isGuest={isGuest} />}
                    {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user?.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper} isGuest={isGuest} onRequestLogin={()=>setShowAuthModal(true)}/>}
                </main>
                
                {page!=='shorts' && page!=='legal' && (
                    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 dark:shadow-none flex items-center gap-6 z-40">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                        <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                        <NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>
                        {isGuest ? (
                             <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/>
                        ) : (
                             <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/>
                        )}
                    </nav>
                )}

                {/* MODAL & OVERLAYS */}
                {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
                {showOnboarding && user && <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>}
                <PWAInstallPrompt />
            </div>
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;