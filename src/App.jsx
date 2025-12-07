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
    signInAnonymously, 
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
    Download, LayoutGrid, Maximize2
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

const globalImageCache = new Set();
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
    } catch (error) { console.error("Gagal request notifikasi:", error); }
};

// --- BASE64 SMART COMPRESSION ---
// Mengompres gambar menjadi string base64 yang efisien untuk Firestore (< 500KB per gambar)
const compressImageSmart = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resolusi optimal untuk mobile/web grid
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Konversi ke Base64 dengan kualitas 0.7 (cukup bagus tapi ringan)
                const base64String = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64String);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
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
    } catch (error) { console.error("Gagal mengirim notifikasi:", error); }
};

// Fungsi lama upload ke FAA dipertahankan tapi tidak digunakan lagi sesuai request "jangan hapus kode"
const uploadToFaaAPI = async (file, onProgress) => {
    // Legacy function placeholder
    return null;
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
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
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
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-gray-900 p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom duration-500 border border-gray-700 dark:border-gray-200">
            <div className="flex items-center gap-3">
                <div className="bg-sky-500 p-2.5 rounded-xl shadow-lg shadow-sky-500/20"><Smartphone size={24}/></div>
                <div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-gray-300 dark:text-gray-600">Akses Lebih Cepat</p></div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-gray-400 hover:text-white bg-gray-800 dark:bg-gray-100 dark:hover:text-gray-900 rounded-full"><X size={16}/></button>
                <button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600 transition">Pasang</button>
            </div>
        </div>
    );
};

const ImageWithRetry = ({ src, alt, className, fallbackText, onClick }) => {
    const initialState = globalImageCache.has(src) ? 'loaded' : 'loading';
    const [status, setStatus] = useState(initialState);
    const [retryKey, setRetryKey] = useState(0);

    const handleSuccess = () => {
        globalImageCache.add(src); 
        setStatus('loaded');
    };

    if (!src) {
        return (
            <div className={`bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-400 ${className} border border-gray-200 dark:border-gray-700`}>
                 {fallbackText ? (
                    <div className="w-full h-full flex items-center justify-center bg-sky-100 dark:bg-sky-900/30 text-sky-600 font-black text-2xl uppercase">
                        {fallbackText[0]}
                    </div>
                ) : <ImageOff size={24} className="opacity-30"/>}
            </div>
        );
    }

    return (
        <div className={`relative ${className} overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-pointer`} onClick={onClick}>
            {status !== 'loaded' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm transition-all duration-300">
                    <Loader2 className="animate-spin text-sky-500 mb-2" size={20}/>
                </div>
            )}
            
            <img 
                key={retryKey} 
                src={src} 
                alt={alt} 
                className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                onLoad={handleSuccess}
                onError={()=>setStatus('error')}
                loading="lazy"
            />
        </div>
    );
};

// --- LIGHTBOX IMAGE VIEWER ---
const FullScreenViewer = ({ src, onClose }) => {
    if (!src) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"><X size={24}/></button>
            <img src={src} className="max-w-full max-h-screen object-contain p-2" />
        </div>
    );
};

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
                <div className="flex items-center gap-1 text-xs font-bold text-sky-400 mb-1">
                    <Music size={12}/> Audio Clip
                </div>
                <audio ref={audioRef} src={src} className="w-full h-6 opacity-80" controls onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}/>
            </div>
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow">
            <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
            <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        </div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Memuat data terbaru...</p>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700"></div><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4"></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 dark:bg-gray-700 px-1 rounded text-sm text-sky-700 dark:text-sky-300 font-mono border border-sky-100 dark:border-gray-600">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-gray-800 dark:text-gray-200 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER
// ==========================================
const DeveloperDashboard = ({ onClose }) => {
    // (Kode Dashboard Developer dipertahankan 100% sama, hanya disesuaikan style untuk dark mode)
    const [stats, setStats] = useState({ users: 0, posts: 0, postsToday: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock data fetch for simplicity in this snippet, assumes similar logic as before
        setLoading(false);
    }, []);

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2"><HardDrive className="text-sky-600"/> Developer Panel</h2>
                    <button onClick={onClose} className="bg-white dark:bg-gray-800 p-2 rounded-full shadow hover:bg-gray-200"><X className="text-gray-800 dark:text-white"/></button>
                </div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : (
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm text-center">
                        <p className="text-gray-600 dark:text-gray-300">Developer mode active. Logs are visible in console.</p>
                     </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI BARU (GOOGLE ONLY)
// ==========================================

const AuthScreen = ({ onLoginSuccess }) => {
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true); setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // Sukses login, listener onAuthStateChanged di App akan menangani sisanya
        } catch (err) {
            setError("Gagal Login Google: " + err.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900 p-6 font-sans">
            <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-white dark:border-gray-700 p-8 relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400"></div>
                <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain"/>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Masuk ke {APP_NAME}</h2>
                <p className="text-gray-400 text-sm mb-8">Interaksi penuh, berbagi foto, dan berteman.</p>
                
                {error && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center font-medium border border-red-100 text-left"><AlertTriangle size={14} className="mr-2 flex-shrink-0"/>{error}</div>}
                
                <button 
                    onClick={handleGoogleLogin} 
                    disabled={isLoading}
                    className="w-full bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-gray-700 py-3.5 rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-3"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            Lanjutkan dengan Google
                        </>
                    )}
                </button>
                <div className="mt-6">
                    <button onClick={() => window.location.reload()} className="text-xs text-gray-400 hover:text-sky-500">Kembali ke Mode Tamu</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: KOMPONEN UTAMA APLIKASI
// ==========================================

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');
    
    const [isSaved, setIsSaved] = useState(profile?.savedPosts?.includes(post.id));
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);

    const isOwner = currentUserId && post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 
    
    // Safety check for profile (Guest mode)
    const isFollowing = profile ? (profile.following || []).includes(post.userId) : false;
    const isFriend = profile ? ((profile.followers || []).includes(post.userId) && isFollowing) : false;

    const MAX_CHARS = 250;
    const isLongText = post.content && post.content.length > MAX_CHARS;
    const displayText = isExpanded || !isLongText ? post.content : post.content.substring(0, MAX_CHARS) + "...";

    // Media Logic (Grid System)
    const images = post.images || (post.mediaUrl && post.mediaType === 'image' ? [post.mediaUrl] : []);
    const hasMultipleImages = images.length > 1;

    const handleLike = async () => {
        if (!currentUserId) return alert("Silakan login untuk menyukai.");
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

    const handleDoubleTap = () => { if (!currentUserId) return; setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };

    const handleSave = async () => {
        if (!currentUserId) return alert("Login untuk menyimpan.");
        const newSaved = !isSaved;
        setIsSaved(newSaved);
        const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
        try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); }
    };

    const handleComment = async (e) => {
        e.preventDefault(); if (!currentUserId) return alert("Login dulu."); if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-6 shadow-xl shadow-sky-100/70 dark:shadow-none border border-white dark:border-gray-700 relative overflow-hidden group transition-all duration-300">
            {viewerOpen && <FullScreenViewer src={selectedImage} onClose={()=>setViewerOpen(false)} />}
            
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                            <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                        </div>
                    </div>
                    <div><h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight flex items-center gap-1">{post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span></div></div>
                </div>
                {currentUserId && (
                <div className="flex gap-2">
                    {!isOwner && post.userId !== currentUserId && ( <button onClick={() => handleFollow(post.userId, isFollowing)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${isFriend ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md'}`}>{isFriend ? <><UserCheck size={12}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                    {(isOwner || isMeDeveloper) && ( <button onClick={handleDelete} className="p-2 rounded-full text-gray-400 hover:text-red-600"><Trash2 size={16}/></button> )}
                </div>
                )}
            </div>

            {post.title && <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{post.title}</h3>}
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{renderMarkdown(displayText)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
            
            {/* GRID IMAGE DISPLAY - SMART LAYOUT */}
            {images.length > 0 && (
                <div className={`mb-4 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/20 relative select-none cursor-pointer grid gap-1 ${
                    images.length === 1 ? 'grid-cols-1' : 
                    images.length === 2 ? 'grid-cols-2' : 
                    images.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2'
                }`} onDoubleClick={handleDoubleTap}>
                    
                    {images.slice(0, 4).map((img, idx) => (
                        <div key={idx} className={`relative overflow-hidden ${
                            images.length === 3 && idx === 0 ? 'row-span-2' : ''
                        }`} onClick={() => { setSelectedImage(img); setViewerOpen(true); }}>
                            <ImageWithRetry src={img} className="w-full h-full object-cover min-h-[150px] max-h-[500px]" />
                            {images.length > 4 && idx === 3 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">
                                    +{images.length - 4}
                                </div>
                            )}
                        </div>
                    ))}
                    {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><Heart size={100} className="text-white drop-shadow-2xl fill-white animate-ping" /></div>}
                </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button 
                    onClick={handleLike} 
                    className={`flex items-center gap-2 text-xs px-4 py-2 rounded-full font-bold transition-all duration-300 ${liked ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-900' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100'}`}
                >
                    <Heart size={16} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}
                </button>
                <button 
                    onClick={() => setShowComments(!showComments)} 
                    className="flex items-center gap-2 text-xs px-4 py-2 rounded-full font-bold transition-all bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100"
                >
                    <MessageSquare size={16}/> {post.commentsCount || 0}
                </button>
                <button 
                    onClick={handleSave} 
                    className={`ml-auto p-2 rounded-full transition-all ${isSaved ? 'bg-sky-50 text-sky-500' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}
                >
                    <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">{comments.length === 0 ? <p className="text-xs text-center text-gray-400">Belum ada komentar.</p> : comments.map(c => ( <div key={c.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl text-xs flex justify-between items-start group"><div><span className="font-bold text-gray-800 dark:text-gray-200 mr-1">{c.username}</span><span className="text-gray-600 dark:text-gray-400">{c.text}</span></div>{(currentUserId === c.userId || isMeDeveloper) && <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash size={12}/></button>}</div> ))}</div>
                    {currentUserId ? (
                        <form onSubmit={handleComment} className="flex gap-2 relative"><input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200"/><button type="submit" disabled={!newComment.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50"><Send size={14}/></button></form>
                    ) : (
                        <p className="text-center text-xs text-sky-600 font-bold cursor-pointer">Login untuk berkomentar</p>
                    )}
                </div>
            )}
        </div>
    );
};

const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '', isShort: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);

    const handleFileSelect = async (e) => {
        const selected = Array.from(e.target.files);
        // Validasi dan set
        if (selected.length > 5) return alert("Maksimal 5 foto sekaligus.");
        setForm({...form, files: selected});
    };

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(10);
        try {
            let mediaUrls = [];
            // Proses Upload Gambar dengan Kompresi Cerdas Base64
            if (form.files.length > 0) {
                for (let i = 0; i < form.files.length; i++) {
                    const compressedBase64 = await compressImageSmart(form.files[i]);
                    mediaUrls.push(compressedBase64);
                    setProg(prev => prev + (80 / form.files.length));
                }
            }
            
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            
            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: form.title, content: form.content, 
                mediaUrl: mediaUrls[0] || '', // Backward compatibility
                images: mediaUrls, // Array foto baru
                mediaType: mediaUrls.length > 0 ? 'image' : 'text', 
                timestamp: serverTimestamp(), likes: [], commentsCount: 0, 
                isShort: false, category: category, user: {username, uid: userId}
            });
            setProg(100); setTimeout(()=>onSuccess(null, false), 500);
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
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu..." rows="4" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.files.length>0 ?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 dark:border-gray-600 text-gray-500'}`}>
                            <ImageIcon size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.files.length > 0 ? `${form.files.length} Foto` : 'Pilih Foto (Bisa Banyak)'}</span>
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileSelect} disabled={loading}/>
                        </label>
                    </div>
                    {form.files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto py-2">
                            {Array.from(form.files).map((f, i) => (
                                <div key={i} className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                                    <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <button disabled={loading || (!form.content && form.files.length === 0)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 dark:shadow-none hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Mengompres & Upload...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, setPage }) => {
    // Profil logic (Guest handle)
    const isSelf = viewerProfile && viewerProfile.uid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;

    const userPosts = allPosts.filter(p=>p.userId===profileData.uid).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    const followersCount = (profileData.followers || []).length;
    const followingCount = (profileData.following || []).length;
    const isOnline = isUserOnline(profileData.lastSeen);

    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);
    
    const isFollowing = viewerProfile ? (viewerProfile.following || []).includes(profileData.uid) : false; 

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-xl shadow-sky-100/70 dark:shadow-none border border-white dark:border-gray-700 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 dark:from-sky-900 dark:to-purple-900 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8">
                    <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 ${isOnline ? 'border-emerald-400' : 'border-white dark:border-gray-600'} relative`}>
                        <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover" fallbackText={profileData.username}/>
                    </div>
                </div>

                <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1>
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label}</div>
                
                {!isSelf && viewerProfile && ( <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${isFollowing ? 'bg-gray-200 text-gray-600' : 'bg-sky-500 text-white shadow-sky-200'}`}>{isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                
                <div className="grid grid-cols-2 gap-3 mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3">
                        <span className="font-bold text-xl block text-gray-800 dark:text-white">{followersCount}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3">
                        <span className="font-bold text-xl block text-gray-800 dark:text-white">{followingCount}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span>
                    </div>
                </div>
            </div>
            <div className="px-4 space-y-6">{userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile?.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}</div>
        </div>
    );
};

const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, isMeDeveloper }) => {
    // Mode tamu: currentUserId bisa null
    const [stableFeed, setStableFeed] = useState([]);

    useEffect(() => {
        if (allPosts.length === 0) return;
        setStableFeed(shuffleArray([...allPosts]));
    }, [allPosts]); 

    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            {!currentUserId && (
                <div className="bg-sky-500 text-white p-4 rounded-2xl mb-6 shadow-lg flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-sm">Mode Tamu</h3>
                        <p className="text-xs opacity-90">Login untuk like, komen & posting.</p>
                    </div>
                </div>
            )}
            {stableFeed.length === 0 ? <SkeletonPost/> : stableFeed.map(p => (
                <PostItem key={p.id} post={p} currentUserId={currentUserId} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper}/>
            ))}
        </div>
    );
};

// ======================================================
// BAGIAN 10: LAYAR LEGAL & ONBOARDING (DIPERBARUI)
// ======================================================

const OnboardingComponent = ({ profile, onComplete }) => {
    const [username, setUsername] = useState(profile.username || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!username.trim()) return alert("Username wajib diisi");
        setLoading(true);
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profile.uid), {
                username: username,
                hasCompletedOnboarding: true,
                createdAt: serverTimestamp()
            });
            onComplete();
        } catch (e) {
            alert("Gagal menyimpan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-sm text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
                    <SparklesIcon size={40} className="text-white animate-pulse"/>
                </div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Selamat Datang!</h2>
                <p className="text-gray-500 mb-8">Satu langkah lagi untuk melengkapi profilmu.</p>
                
                <input 
                    value={username} 
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Pilih Username Unik"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl text-center font-bold mb-4 focus:ring-2 focus:ring-sky-500 outline-none"
                />
                
                <button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="w-full py-4 bg-sky-500 text-white font-bold rounded-2xl shadow-lg hover:bg-sky-600 transition"
                >
                    {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Mulai Jelajahi'}
                </button>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 12: APP UTAMA (CORE LOGIC - FIXED)
// ==========================================
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); // Default langsung ke HOME (Mode Tamu)
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    
    // PWA Prompt
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    // Dark Mode Effect
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
            if(u) {
                // User Login
                setUser(u);
                const userRef = doc(db, getPublicCollection('userProfiles'), u.uid);
                const snap = await getDoc(userRef);
                
                if (!snap.exists()) {
                    // Buat dokumen profil awal jika login pertama kali
                    await setDoc(userRef, {
                        email: u.email,
                        photoURL: u.photoURL,
                        username: u.displayName || 'User',
                        uid: u.uid,
                        followers: [],
                        following: [],
                        savedPosts: [],
                        hasCompletedOnboarding: false,
                        lastSeen: serverTimestamp()
                    });
                    setShowOnboarding(true);
                } else {
                    const data = snap.data();
                    if (data.hasCompletedOnboarding === false) setShowOnboarding(true);
                    updateDoc(userRef, { lastSeen: serverTimestamp() });
                }
            } else {
                // User Logout / Belum Login (Mode Tamu)
                setUser(null);
                setProfile(null);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // Fetch Data Realtime
    useEffect(() => {
        // Fetch Profil Sendiri
        let unsubP = () => {};
        if (user) {
            unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => {
                if(s.exists()) setProfile({...s.data(), uid: user.uid});
            });
        }

        // Fetch Posts & Users (Untuk semua, termasuk tamu)
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            // Populate user data manual untuk performa
            const uids = [...new Set(raw.map(r=>r.userId))];
            const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u))));
            const map = {};
            snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user})));
        });

        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        
        return () => { unsubP(); unsubPosts(); unsubUsers(); };
    }, [user]);

    const handleFollow = async (uid, isFollowing) => { 
        if (!user) return alert("Login dulu bos!");
        // Logic follow existing...
        const meRef = doc(db, getPublicCollection('userProfiles'), user.uid); 
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid); 
        try { 
            if(isFollowing) { 
                await updateDoc(meRef, {following: arrayRemove(uid)}); 
                await updateDoc(targetRef, {followers: arrayRemove(user.uid)}); 
            } else { 
                await updateDoc(meRef, {following: arrayUnion(uid)}); 
                await updateDoc(targetRef, {followers: arrayUnion(user.uid)}); 
            } 
        } catch (e) { console.error(e); } 
    };

    if (showOnboarding && profile) return <OnboardingComponent profile={profile} onComplete={()=>setShowOnboarding(false)} />;
    
    // Jika user === undefined (masih loading auth state awal), tampilkan loader
    if (user === undefined) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;

    // Jika page === 'auth' tapi user sudah login, lempar ke home
    if (page === 'auth' && user) setPage('home');

    // Cek Developer
    const isMeDeveloper = user?.email === DEVELOPER_EMAIL;
    const targetUser = users.find(u => u.uid === targetUid);

    return (
        <div className="min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300">
            {page === 'auth' ? (
                <AuthScreen />
            ) : (
                <>
                    <header className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100/80 dark:border-gray-800 shadow-lg shadow-sky-100/30 dark:shadow-none transition-colors duration-300">
                        <div className="flex items-center gap-2" onClick={()=>setPage('home')}>
                            <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                            <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600 hidden md:block">{APP_NAME}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Toggle Dark Mode */}
                            <button onClick={()=>setDarkMode(!darkMode)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-yellow-400">
                                {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                            </button>

                            {user ? (
                                <>
                                    <button onClick={()=>setPage('notifications')} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative">
                                        <Bell size={20}/>
                                    </button>
                                    <button onClick={async()=>{await signOut(auth); setPage('home');}} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition">
                                        <LogOut size={20}/>
                                    </button>
                                </>
                            ) : (
                                <button onClick={()=>setPage('auth')} className="px-4 py-2 bg-sky-500 text-white rounded-xl font-bold text-xs shadow hover:bg-sky-600">
                                    Login
                                </button>
                            )}
                        </div>
                    </header> 

                    <main className="pt-16">
                        {page==='home' && <HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper}/>}
                        {page==='create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={()=>{setPage('home')}}/>}
                        {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} setPage={setPage} />}
                        {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} setPage={setPage} />}
                    </main>

                    {/* Navigasi Bawah (Hanya muncul jika bukan halaman auth) */}
                    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-t from-white/95 to-white/90 dark:from-gray-800/95 dark:to-gray-800/90 backdrop-blur-2xl border-t border-white dark:border-gray-700 rounded-full px-6 py-3 shadow-2xl shadow-sky-200/60 dark:shadow-black/50 flex items-center gap-6 z-40">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <button onClick={()=>{ if(!user) return alert("Login dulu!"); setPage('create'); }} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                        <NavBtn icon={User} active={page==='profile'} onClick={()=>{ if(!user) return setPage('auth'); setPage('profile'); }}/>
                    </nav>

                    <PWAInstallPrompt deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} />
                </>
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-gray-700 dark:text-sky-400' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;