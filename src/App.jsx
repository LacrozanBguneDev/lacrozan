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
    signInAnonymously
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
    getDocs 
} from 'firebase/firestore';

// IMPORT KHUSUS NOTIFIKASI
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// IMPORT ICON DARI LUCIDE REACT
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
    BookOpen as BookOpenIcon,
    Sparkles as SparklesIcon,
    HardDrive, Terminal, ServerCrash,
    Download, FileText, Shield, Cookie, Layers
} from 'lucide-react';

// ==========================================
// STABILISASI APLIKASI: Global Console Silencer
// ==========================================
const originalConsole = { ...console };
console.log = () => {};
console.warn = () => {};
console.error = () => {};
console.info = () => {};
const enableDevConsole = () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    originalConsole.log("Developer console diaktifkan.");
};
// ==========================================

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- GLOBAL IMAGE CACHE (Supaya gambar tidak loading ulang - FIX LOADING) ---
const globalImageCache = new Map();

const VAPID_KEY = "BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE"; 

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

let messaging = null;
try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
    }
} catch (e) {
    originalConsole.log("Messaging skipped");
}

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

// --- SISTEM UPLOAD TANPA SERVER (BASE64) - FIX UPLOAD ERROR ---
const processImageForDatabase = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Batasi ukuran max 600px agar database tidak penuh (HEMAT & CEPAT)
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
                
                // Konversi ke JPEG kualitas rendah (cukup untuk HP)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
            img.onerror = (e) => reject(new Error("Gagal memproses gambar"));
        };
        reader.onerror = (e) => reject(new Error("Gagal membaca file"));
    });
};

const logErrorToFirestore = async (error, errorInfo, userId = 'unknown') => {
    try {
        await addDoc(collection(db, getPublicCollection('globalErrors')), {
            userId: userId,
            message: error.message || 'Unknown error',
            stack: errorInfo ? errorInfo.componentStack : error.stack || 'No stack available',
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        });
        originalConsole.error("ERROR FATAL TERCATAT KE DB:", error);
    } catch (dbError) {
        originalConsole.error("GAGAL MENCATAT ERROR KE DB:", dbError);
    }
};

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
    } catch (error) { originalConsole.error("Gagal request notifikasi:", error); }
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
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId, fromUserId: fromUser.uid, fromUsername: fromUser.username, fromPhoto: fromUser.photoURL || '',
            type: type, message: message, postId: postId, isRead: false, timestamp: serverTimestamp()
        });
    } catch (error) { originalConsole.error("Gagal mengirim notifikasi:", error); }
};

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

const getMediaEmbed = (url) => {
    if (!url) return null;
    // Cek Base64 Image
    if (url.startsWith('data:image')) return { type: 'image_base64', url };

    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) { return { type: 'link', embedUrl: url, displayUrl: url }; }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) { return { type: 'audio_file', url: url }; }
    return null;
};

const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g);
    return matches ? matches : [];
};

const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diff = Date.now() - last.getTime();
    return diff < 10 * 60 * 1000; 
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL & HELPER
// ==========================================

const PWAInstallPrompt = ({ deferredPrompt, setDeferredPrompt }) => {
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
    }, [setDeferredPrompt]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowBanner(false);
        }
    };

    if (!showBanner || !deferredPrompt) return null;

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

// --- IMAGE WITH SMART CACHE (VERSI RINGAN & ANTI-BLINK) ---
// Perbaikan: Gambar yang sudah dimuat tidak akan loading lagi (FIXED)
const ImageWithRetry = React.memo(({ src, alt, className, fallbackText }) => {
    const cachedStatus = globalImageCache.get(src);
    const [status, setStatus] = useState(cachedStatus || 'loading'); 
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (cachedStatus) {
            setStatus(cachedStatus);
        } else if (src) {
            const img = new Image();
            img.src = src;
            img.onload = () => { globalImageCache.set(src, 'loaded'); setStatus('loaded'); };
            img.onerror = () => { 
                setTimeout(() => {
                    const retryImg = new Image();
                    retryImg.src = src; 
                    retryImg.onload = () => { globalImageCache.set(src, 'loaded'); setStatus('loaded'); };
                    retryImg.onerror = () => setStatus('error');
                }, 3000);
            };
        } else {
            setStatus('error');
        }
    }, [src, cachedStatus]);

    if (status === 'error' || !src) {
        return (
            <div className={`bg-gray-100 flex flex-col items-center justify-center text-gray-400 ${className} border border-gray-100`}>
                {fallbackText ? (
                    <span className="font-black text-lg text-sky-500">{fallbackText[0]?.toUpperCase()}</span>
                ) : <AlertCircle size={20} className="opacity-30"/>}
            </div>
        );
    }

    return (
        <div className={`relative ${className} overflow-hidden bg-gray-50`}>
            {status === 'loading' && <div className="absolute inset-0 bg-gray-200 animate-pulse"/>}
            <img 
                key={retryKey}
                src={src} 
                alt={alt} 
                className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                loading="lazy"
            />
        </div>
    );
});

// --- AUDIO PLAYER (MEMOIZED) ---
const AudioPlayer = React.memo(({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    return (
        <div className="bg-gray-100 rounded-xl p-2 flex items-center gap-3 border border-gray-200">
            <button onClick={() => { if(playing) audioRef.current.pause(); else audioRef.current.play(); setPlaying(!playing); }} className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white">
                {playing ? <Pause size={14}/> : <Play size={14} className="ml-0.5"/>}
            </button>
            <div className="flex-1 text-xs font-bold text-gray-600">Audio Clip</div>
            <audio ref={audioRef} src={src} onEnded={()=>setPlaying(false)} className="hidden"/>
        </div>
    );
});

// --- SPLASH SCREEN ---
const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow">
            <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
            <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        </div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Memuat data terbaru...</p>
    </div>
);

// --- SKELETON LOADING ---
const SkeletonPost = () => (
    <div className="bg-white rounded-[2rem] p-5 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200"></div><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 rounded-full"></div><div className="h-8 w-16 bg-gray-100 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 px-1 rounded text-sm text-sky-700 font-mono border border-sky-100">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER (Original)
// ==========================================
const DeveloperDashboard = ({ onClose }) => {
    const [stats, setStats] = useState({ users: 0, posts: 0, postsToday: 0 });
    const [allUsers, setAllUsers] = useState([]); 
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [sendingBC, setSendingBC] = useState(false);

    const [devTab, setDevTab] = useState('stats'); 
    const [errorLogs, setErrorLogs] = useState([]);
    const [terminalCmd, setTerminalCmd] = useState('');
    const [terminalOutput, setTerminalOutput] = useState([
        { type: 'info', msg: `Selamat datang di ${APP_NAME} Terminal.` }
    ]);
    const [isExecuting, setIsExecuting] = useState(false);
    const terminalEndRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            const usersSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => { resolve(snap); unsub(); }); });
            const postsSnap = await new Promise(resolve => { const unsub = onSnapshot(collection(db, getPublicCollection('posts')), (snap) => { resolve(snap); unsub(); }); });
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const rawPosts = postsSnap.docs.map(d => d.data());
            const postsToday = rawPosts.filter(p => p.timestamp?.toMillis && p.timestamp.toMillis() >= todayStart).length;
            
            const usersList = usersSnap.docs.map(d => ({id: d.id, ...d.data()}));
            setAllUsers(usersList); 

            const tenMinAgo = Date.now() - 10 * 60 * 1000;
            const active = usersList.filter(u => u.lastSeen?.toMillis && u.lastSeen.toMillis() > tenMinAgo);
            
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
        
        const qErrors = query(collection(db, getPublicCollection('globalErrors')), orderBy('timestamp', 'desc'), limit(50));
        const unsubErrors = onSnapshot(qErrors, (snapshot) => {
            setErrorLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => unsubErrors();
    }, []);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalOutput]);

    const addOutput = (type, msg) => {
        setTerminalOutput(prev => [...prev, { type, msg }]);
    };

    const handleTerminalCommand = async (e) => {
        e.preventDefault();
        const cmd = terminalCmd.trim();
        if (!cmd || isExecuting) return;

        addOutput('input', `> ${cmd}`);
        setTerminalCmd('');
        setIsExecuting(true);

        try {
            if (cmd === '/help') {
                addOutput('info', "Perintah Tersedia: /help, /list_users, /clear_errors");
            } 
            else if (cmd === '/list_users') {
                addOutput('info', `Menampilkan ${allUsers.length} pengguna.`);
            }
            else if (cmd === '/clear_errors') {
                if (!confirm("Hapus semua log eror?")) throw new Error("Operasi dibatalkan.");
                const q = query(collection(db, getPublicCollection('globalErrors')));
                const snapshot = await getDocs(q);
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                addOutput('success', `Berhasil menghapus log eror.`);
            }
            else {
                throw new Error(`Perintah tidak dikenali: ${cmd}`);
            }
        } catch (error) {
            addOutput('error', `Error: ${error.message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleBroadcast = async () => {
        if(!broadcastMsg.trim()) return;
        if(!confirm("Kirim pengumuman ke SEMUA user?")) return;
        setSendingBC(true);
        try {
            const promises = allUsers.map(u => addDoc(collection(db, getPublicCollection('notifications')), {
                toUserId: u.id, fromUserId: 'admin', fromUsername: 'Developer System', fromPhoto: APP_LOGO, type: 'system', message: `📢 PENGUMUMAN: ${broadcastMsg}`, isRead: false, timestamp: serverTimestamp()
            }));
            await Promise.all(promises);
            alert("Pengumuman berhasil dikirim!"); setBroadcastMsg('');
        } catch(e) { alert("Gagal kirim broadcast: " + e.message); } finally { setSendingBC(false); }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><HardDrive className="text-sky-600"/> Developer Panel</h2>
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow hover:bg-gray-200"><X/></button>
                </div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : (
                    <div className="space-y-4">
                        <div className="flex p-1 bg-gray-200 rounded-xl mb-6 shadow-inner">
                            <button onClick={() => setDevTab('stats')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${devTab === 'stats' ? 'bg-white text-sky-600 shadow' : 'text-gray-600'}`}>Statistik</button>
                            <button onClick={() => setDevTab('errors')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${devTab === 'errors' ? 'bg-white text-red-600 shadow' : 'text-gray-600'}`}>Error Log</button>
                            <button onClick={() => setDevTab('terminal')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${devTab === 'terminal' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>Terminal</button>
                        </div>
                        {devTab === 'stats' && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl shadow-sm text-center"><Users className="mx-auto text-sky-500 mb-2"/><h3 className="text-2xl font-bold">{stats.users}</h3><p className="text-[10px]">User</p></div>
                                <div className="bg-white p-4 rounded-2xl shadow-sm text-center"><ImageIcon className="mx-auto text-purple-500 mb-2"/><h3 className="text-2xl font-bold">{stats.posts}</h3><p className="text-[10px]">Post</p></div>
                                <div className="bg-white p-4 rounded-2xl shadow-sm text-center"><Activity className="mx-auto text-emerald-500 mb-2"/><h3 className="text-2xl font-bold">{stats.postsToday}</h3><p className="text-[10px]">Today</p></div>
                            </div>
                        )}
                        {devTab === 'terminal' && (
                            <div className="bg-gray-900 p-4 rounded-2xl shadow-lg border border-gray-700">
                                <div className="h-64 bg-black rounded-lg p-3 overflow-y-auto font-mono text-sm space-y-2 mb-3">
                                    {terminalOutput.map((out, i) => <p key={i} className={out.type === 'error' ? 'text-red-400' : 'text-green-400'}>{out.msg}</p>)}
                                    <div ref={terminalEndRef} />
                                </div>
                                <form onSubmit={handleTerminalCommand} className="flex gap-2">
                                    <input value={terminalCmd} onChange={(e) => setTerminalCmd(e.target.value)} disabled={isExecuting} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 outline-none" placeholder="Command..."/>
                                    <button type="submit" className="bg-sky-500 text-white px-4 rounded-lg font-bold">Run</button>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI & LEGAL (Updated)
// ==========================================

const LegalModal = ({ type, onClose }) => {
    if (!type) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400"><X size={20}/></button>
                <h3 className="font-bold text-lg mb-4 text-gray-800">Informasi Legal</h3>
                <div className="text-sm text-gray-600 space-y-2 max-h-[60vh] overflow-y-auto">
                    <p><strong>Privasi:</strong> Kami menyimpan data Anda dengan aman di Google Firebase.</p>
                    <p><strong>Konten:</strong> Dilarang memposting konten SARA/Pornografi.</p>
                    <p><strong>Keamanan:</strong> Gunakan akun Google asli untuk keamanan maksimal.</p>
                </div>
                <button onClick={onClose} className="w-full mt-4 bg-sky-500 text-white py-2 rounded-xl font-bold text-sm">Tutup</button>
            </div>
        </div>
    );
};

// --- AUTH SCREEN (GOOGLE ONLY) ---
const AuthScreen = ({ onLoginSuccess, setPage, setLegal }) => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true); setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // CEK APAKAH USER BARU (Profile belum ada di Firestore?)
            const docRef = doc(db, getPublicCollection('userProfiles'), user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                // Buat Profil Baru dari Data Google
                await setDoc(docRef, {
                    username: user.displayName || "User",
                    email: user.email,
                    photoURL: user.photoURL, // Ambil foto dari Google
                    createdAt: serverTimestamp(),
                    uid: user.uid,
                    following: [],
                    followers: [],
                    savedPosts: [],
                    lastSeen: serverTimestamp(),
                    hasCompletedOnboarding: false
                });
            } else {
                // Update timestamp login
                await updateDoc(docRef, { lastSeen: serverTimestamp() });
            }
            onLoginSuccess();
        } catch (err) {
            originalConsole.error(err);
            setError("Gagal login dengan Google. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden text-center">
                <button onClick={() => setPage('home')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X/></button>
                <div className="mb-6 inline-block">
                    <img src={APP_LOGO} className="w-20 h-20 object-contain drop-shadow-md"/>
                </div>
                <h2 className="text-2xl font-black text-gray-800 mb-2">Selamat Datang</h2>
                <p className="text-gray-500 text-xs mb-8">Masuk untuk terhubung dengan teman & kreator.</p>
                
                {error && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 border border-red-100 flex items-center gap-2 text-left"><AlertTriangle size={14} className="flex-shrink-0"/> {error}</div>}
                
                <button 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                    className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                    {loading ? <Loader2 className="animate-spin text-sky-600" size={20}/> : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Lanjutkan dengan Google
                        </>
                    )}
                </button>

                <div className="mt-8 text-[10px] text-gray-400">
                    Dengan masuk, Anda menyetujui <button onClick={()=>setLegal('tos')} className="underline hover:text-sky-600">Ketentuan</button> & <button onClick={()=>setLegal('privacy')} className="underline hover:text-sky-600">Privasi</button> kami.
                </div>
            </div>
        </div>
    );
};

const OnboardingComponent = ({ profile, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border-4 border-white/50 relative text-center transform animate-in zoom-in-90 duration-300">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                    <SparklesIcon size={48} className="text-white animate-pulse" style={{animationDuration: '3s'}}/>
                </div>
                <h2 className="text-2xl font-black text-gray-800 mt-16 mb-3">Selamat Datang!</h2>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                    Halo {profile.username}, selamat bergabung di komunitas kreatif {APP_NAME}.
                </p>
                <div className="space-y-3 text-left bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 bg-sky-100 text-sky-600 rounded-full flex-shrink-0 flex items-center justify-center"><User size={16}/></div><p className="text-xs font-medium text-gray-700">Profil Anda dibuat otomatis dari akun Google.</p></div>
                    <div className="flex items-center gap-3"><div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex-shrink-0 flex items-center justify-center"><Search size={16}/></div><p className="text-xs font-medium text-gray-700">Temukan teman baru di tab Pencarian.</p></div>
                </div>
                <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-gray-800">Mulai Jelajahi</button>
            </div>
        </div>
    );
};

const GuestLimitModal = ({ onClose, onLogin }) => (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl transform scale-100">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600"><Lock size={32}/></div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Login Diperlukan</h3>
            <p className="text-sm text-gray-600 mb-6">Mode Tamu terbatas (5 Post). Login dengan Google untuk akses penuh!</p>
            <div className="space-y-3">
                <button onClick={onLogin} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl shadow-lg hover:bg-sky-700">Masuk dengan Google</button>
                <button onClick={onClose} className="text-gray-400 text-xs font-bold hover:text-gray-600">Batal</button>
            </div>
        </div>
    </div>
);

const GuestWelcomeModal = ({ onClose, onLogin }) => (
    <div className="fixed inset-0 bg-black/90 z-[90] flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-500">
        <div className="text-center max-w-sm">
            <div className="mb-6 relative inline-block">
                <img src={APP_LOGO} className="w-24 h-24 object-contain drop-shadow-2xl animate-bounce-slow"/>
                <div className="absolute inset-0 bg-sky-400 blur-2xl opacity-30 rounded-full"></div>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Selamat Datang!</h1>
            <p className="text-white/70 text-sm mb-8 leading-relaxed">Gabung komunitas {APP_NAME}. Bagikan momen, temukan teman, dan jadilah kreatif.</p>
            
            <div className="space-y-3 w-full">
                <button onClick={onLogin} className="w-full py-4 bg-white text-sky-900 font-black rounded-2xl shadow-xl hover:scale-105 transition transform flex items-center justify-center gap-2">Masuk dengan Google</button>
                <button onClick={onClose} className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/20 transition">Nanti Saja (Mode Tamu)</button>
            </div>
            <p className="text-white/40 text-[10px] mt-6">Mode tamu memiliki akses terbatas.</p>
        </div>
    </div>
);

// ==========================================
// BAGIAN 6: CORE COMPONENTS (OPTIMIZED)
// ==========================================

const ErrorBoundary = class extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
    componentDidCatch(error, errorInfo) { logErrorToFirestore(error, errorInfo, this.props.userId || 'unknown'); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                        <ServerCrash size={64} className="text-red-400 mx-auto mb-6"/>
                        <h1 className="text-2xl font-black text-gray-800 mb-3">Aplikasi Eror</h1>
                        <button onClick={() => window.location.reload()} className="bg-sky-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-sky-600 transition">Muat Ulang</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const PostItem = React.memo(({ post, currentUserId, profile, isGuest, onInteraction, goToProfile, isMeDeveloper }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [isSaved, setIsSaved] = useState(profile?.savedPosts?.includes(post.id));
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);

    const isOwner = post.userId === currentUserId;
    const badge = getReputationBadge(0, post.user?.email === DEVELOPER_EMAIL);

    const handleLike = () => {
        if (isGuest) return onInteraction();
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
        const ref = doc(db, getPublicCollection('posts'), post.id);
        if (newLiked) updateDoc(ref, { likes: arrayUnion(currentUserId) }).catch(() => setLiked(!newLiked));
        else updateDoc(ref, { likes: arrayRemove(currentUserId) }).catch(() => setLiked(!newLiked));
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (isGuest) return onInteraction();
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            setNewComment('');
        } catch (e) {}
    };

    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) handleLike(); };
    const handleSave = async () => { if(isGuest) return onInteraction(); const newSaved = !isSaved; setIsSaved(newSaved); const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId); if (newSaved) updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); else updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); };
    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id), orderBy('timestamp', 'desc'), limit(20)); return onSnapshot(q, s => setComments(s.docs.map(d=>({id:d.id,...d.data()})))); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);

    return (
        <div className="bg-white rounded-[1.5rem] p-4 mb-4 shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3" onClick={() => !isGuest && goToProfile(post.userId)}>
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                        <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <h4 className="font-bold text-sm text-gray-900">{post.user?.username}</h4>
                            {badge.label !== "WARGA" && <badge.icon size={12} className="text-blue-500"/>}
                        </div>
                        <span className="text-[10px] text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                    </div>
                </div>
                {(isOwner || isMeDeveloper) && !isGuest && (
                    <div className="flex gap-2">
                        {isOwner && <button onClick={()=>setIsEditing(!isEditing)}><Edit size={16} className="text-gray-400"/></button>}
                        <button onClick={handleDelete} className="text-gray-300 hover:text-red-500"><Trash size={16}/></button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="mb-2"><input value={editedTitle} onChange={e=>setEditedTitle(e.target.value)} className="w-full border p-1 rounded mb-1"/><textarea value={editedContent} onChange={e=>setEditedContent(e.target.value)} className="w-full border p-1 rounded"/><button onClick={handleUpdatePost} className="bg-sky-500 text-white px-2 py-1 rounded text-xs mt-1">Simpan</button></div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-800 mb-1">{post.title}</h3>}
                    <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap leading-relaxed">{renderMarkdown(post.content)}</p>
                    
                    <div className="relative rounded-xl overflow-hidden mb-3 bg-gray-50 border border-gray-100 select-none" onDoubleClick={handleDoubleTap}>
                        {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700"><Heart size={80} className="text-white drop-shadow-2xl fill-white" /></div>}
                        {embed?.type === 'audio_file' && <AudioPlayer src={embed.url} />}
                        {embed?.type === 'youtube' && <div className="aspect-video"><iframe src={embed.embedUrl} className="w-full h-full border-0"/></div>}
                        {/* Logic Gambar Base64 */}
                        {(post.mediaUrl && !embed) && (
                            <ImageWithRetry src={post.mediaUrl} className="w-full max-h-[400px] object-contain bg-gray-50"/>
                        )}
                    </div>
                </>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold ${liked ? 'text-rose-500' : 'text-gray-400'}`}>
                    <Heart size={18} fill={liked ? "currentColor" : "none"}/> {likeCount}
                </button>
                <button onClick={() => isGuest ? onInteraction() : setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <MessageSquare size={18}/> {post.commentsCount || 0}
                </button>
                <button onClick={handleSave} className={`ml-auto ${isSaved ? 'text-sky-500' : 'text-gray-400'}`}><Bookmark size={18} fill={isSaved?"currentColor":"none"}/></button>
            </div>

            {showComments && (
                <div className="mt-3 pt-3 border-t border-gray-50 animate-in fade-in">
                    <div className="max-h-40 overflow-y-auto space-y-2 mb-2 custom-scrollbar">
                        {comments.map(c => <div key={c.id} className="text-xs bg-gray-50 p-2 rounded-lg"><span className="font-bold mr-1">{c.username}</span>{c.text}</div>)}
                    </div>
                    <form onSubmit={handleComment} className="flex gap-2">
                        <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs outline-none"/>
                        <button type="submit" disabled={!newComment} className="text-sky-500 font-bold text-xs">Kirim</button>
                    </form>
                </div>
            )}
        </div>
    );
});

// --- HOME SCREEN ---
const HomeScreen = ({ user, profile, allPosts, setPage, isGuest }) => {
    const [showGuestLimit, setShowGuestLimit] = useState(false);
    const visiblePosts = isGuest ? allPosts.slice(0, 5) : allPosts;
    const handleInteraction = () => { if (isGuest) setShowGuestLimit(true); };

    return (
        <div className="max-w-lg mx-auto pb-24 px-4 pt-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <img src={APP_LOGO} className="w-8 h-8 rounded-full bg-sky-100 p-1 object-contain"/>
                    <div>
                        <h1 className="font-black text-lg leading-none text-gray-800">{APP_NAME}</h1>
                        <p className="text-[10px] text-gray-400 font-bold">{isGuest ? 'Mode Tamu' : `Hi, ${profile?.username || 'User'}`}</p>
                    </div>
                </div>
                {isGuest ? (
                    <button onClick={() => setPage('auth')} className="bg-sky-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md">Login</button>
                ) : (
                    <button onClick={() => setPage('notifications')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 relative"><Bell size={20}/></button>
                )}
            </div>

            {visiblePosts.map(p => (
                <PostItem key={p.id} post={p} currentUserId={user?.uid} profile={profile} isGuest={isGuest} onInteraction={handleInteraction} goToProfile={(uid) => {}} isMeDeveloper={false}/>
            ))}

            {isGuest && (
                <div className="text-center py-8 bg-sky-50 rounded-2xl border border-sky-100 mt-4">
                    <Lock className="mx-auto text-sky-400 mb-2"/>
                    <p className="text-sm font-bold text-gray-600 mb-2">Login untuk melihat lebih banyak!</p>
                    <button onClick={() => setPage('auth')} className="bg-sky-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg">Login dengan Google</button>
                </div>
            )}

            {showGuestLimit && <GuestLimitModal onClose={() => setShowGuestLimit(false)} onLogin={() => setPage('auth')} />}
        </div>
    );
};

const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let finalUrl = '', type = 'text';
            if(form.file) { 
                // GUNAKAN PROCESS IMAGE (BASE64) BUKAN UPLOAD API
                finalUrl = await processImageForDatabase(form.file);
                type = 'image';
            }
            await addDoc(collection(db, getPublicCollection('posts')), { 
                userId, content: form.content, mediaUrl: finalUrl, mediaType: type, 
                timestamp: serverTimestamp(), likes: [], commentsCount: 0, user: {username, uid: userId} 
            });
            onSuccess();
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4">
            <div className="flex items-center gap-2 mb-6 text-gray-500 cursor-pointer" onClick={()=>setPage('home')}><ArrowLeft size={20}/><span className="font-bold text-sm">Batal</span></div>
            <h2 className="text-xl font-black text-gray-800 mb-6">Posting Sesuatu</h2>
            <form onSubmit={submit} className="space-y-4">
                {loading && <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`100%`}}/></div>}
                <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang Anda pikirkan?" rows="5" className="w-full p-4 bg-gray-50 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-sky-100 transition"/>
                <label className={`flex items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition ${form.file ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <div className="text-center">
                        <ImageIcon className={`mx-auto mb-2 ${form.file ? 'text-sky-500' : 'text-gray-300'}`} size={24}/>
                        <span className="text-xs font-bold text-gray-400">{form.file ? 'Foto Siap' : 'Tambah Foto'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={e=>setForm({...form, file:e.target.files[0]})}/>
                </label>
                <button disabled={loading || !form.content} className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-200 disabled:opacity-50 hover:bg-sky-700 transition">{loading ? 'Mengirim...' : 'Posting'}</button>
            </form>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, setPage }) => {
    // --- Logic Profile Screen disederhanakan agar tidak redundant ---
    const userPosts = allPosts.filter(p=>p.userId===profileData.uid).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm text-center mb-6">
                <ImageWithRetry src={profileData.photoURL} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" fallbackText={profileData.username}/>
                <h2 className="text-2xl font-black">{profileData.username}</h2>
                <div className="flex justify-center gap-4 mt-4">
                    <div className="text-center"><span className="font-bold block">{profileData.followers?.length||0}</span><span className="text-xs text-gray-500">Pengikut</span></div>
                    <div className="text-center"><span className="font-bold block">{profileData.following?.length||0}</span><span className="text-xs text-gray-500">Mengikuti</span></div>
                </div>
            </div>
            <div className="px-4 space-y-4">
                {userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}
            </div>
        </div>
    );
};

// --- APP CORE (DENGAN GUEST MODE LOGIC) ---
const App = () => {
    const [user, setUser] = useState(null); 
    const [profile, setProfile] = useState(null); 
    const [posts, setPosts] = useState([]); 
    const [page, setPage] = useState('home'); 
    
    // Logic Guest Mode
    const [isGuest, setIsGuest] = useState(true); 
    const [showWelcome, setShowWelcome] = useState(true); 
    const [showLegal, setShowLegal] = useState(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, u => {
            if (u) {
                setUser(u);
                setIsGuest(false);
                setShowWelcome(false);
                onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), s => {
                    if (s.exists()) {
                        const data = s.data();
                        setProfile({...data, uid: u.uid});
                        if (!data.hasCompletedOnboarding) setShowOnboarding(true);
                    }
                });
            } else {
                setUser(null);
                setProfile(null);
                setIsGuest(true);
                const hasVisited = localStorage.getItem('has_visited');
                if (hasVisited) setShowWelcome(false);
            }
        });
        
        // Service worker try-catch
        if ('serviceWorker' in navigator) {
            try { navigator.serviceWorker.register('firebase-messaging-sw.js').catch(()=>{}); } catch(e){}
        }

        return () => unsubAuth();
    }, []);

    useEffect(() => {
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, s => {
            setPosts(s.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsub();
    }, []);

    const handleGuestLogin = () => { setPage('auth'); setShowWelcome(false); };
    const handleGuestCancel = () => { setShowWelcome(false); localStorage.setItem('has_visited', 'true'); };

    if (page === 'auth') return <><AuthScreen onLoginSuccess={() => setPage('home')} setPage={setPage} setLegal={setShowLegal} /><LegalModal type={showLegal} onClose={()=>setShowLegal(null)}/></>;

    return (
        <ErrorBoundary userId={profile?.uid}>
            <div className="bg-white min-h-screen font-sans text-gray-900">
                {showWelcome && <GuestWelcomeModal onLogin={handleGuestLogin} onClose={handleGuestCancel} />}
                {showOnboarding && <OnboardingComponent profile={profile} onClose={async () => {
                    await updateDoc(doc(db, getPublicCollection('userProfiles'), profile.uid), { hasCompletedOnboarding: true });
                    setShowOnboarding(false);
                }} />}
                
                <main>
                    {page === 'home' && <HomeScreen user={user} profile={profile} allPosts={posts} setPage={setPage} isGuest={isGuest} />}
                    {page === 'create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={() => setPage('home')} />}
                    {page === 'search' && <SearchScreen allPosts={posts} allUsers={[]} profile={profile} handleFollow={()=>{}} goToProfile={()=>{}} />}
                    {page === 'profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={()=>{}} setPage={setPage} />}
                    {page === 'notifications' && <NotificationScreen userId={user?.uid} setPage={setPage} setTargetPostId={null} setTargetProfileId={null} />}
                </main>

                {page !== 'create' && page !== 'auth' && (
                    <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe px-6 py-3 flex justify-around items-center z-50">
                        <button onClick={()=>setPage('home')} className={`p-2 rounded-xl transition ${page==='home'?'text-sky-600':'text-gray-400'}`}><Home size={24}/></button>
                        <button onClick={()=>setPage('search')} className={`p-2 rounded-xl transition ${page==='search'?'text-sky-600':'text-gray-400'}`}><Search size={24}/></button>
                        <button onClick={() => isGuest ? setPage('auth') : setPage('create')} className="bg-sky-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition"><PlusCircle size={24}/></button>
                        <button onClick={() => isGuest ? setPage('auth') : setPage('notifications')} className={`p-2 rounded-xl transition ${page==='notifications'?'text-sky-600':'text-gray-400'}`}><Bell size={24}/></button>
                        <button onClick={() => isGuest ? setPage('auth') : setPage('profile')} className={`p-2 rounded-xl transition ${page==='profile'?'text-sky-600':'text-gray-400'}`}><User size={24}/></button>
                    </nav>
                )}
                
                <PWAInstallPrompt deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} />
                <LegalModal type={showLegal} onClose={()=>setShowLegal(null)}/>
            </div>
        </ErrorBoundary>
    );
};

export default App;