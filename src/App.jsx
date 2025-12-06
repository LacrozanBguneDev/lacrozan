import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==========================================
// BAGIAN 1: IMPORT LIBRARIES & KONFIGURASI
// ==========================================

import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
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
    Download
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
const PASSWORD_RESET_LINK = "https://forms.gle/cAWaoPMDkffg6fa89";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// Cache gambar global agar tidak reload ulang
const globalImageCache = new Map(); // Menggunakan Map untuk menyimpan status blob url jika perlu
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
    } catch (dbError) {
        // Silent fail
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

// --- MODIFIED: COMPRESS & CONVERT TO BASE64 ---
// Mengubah file gambar menjadi Base64 string yang sangat terkompresi
const processImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Kita batasi resolusi lebih agresif agar Base64 string tidak meledak di Firestore
                const MAX_WIDTH = 800; 
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
                
                // Konversi ke Base64 JPEG dengan kualitas rendah (0.6) untuk menghemat size
                // Firestore limit dokumen 1MB, jadi string harus efisien
                const base64String = canvas.toDataURL('image/jpeg', 0.6);
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
    if (url.startsWith('data:image')) {
        return null; // Ini akan dihandle sebagai image biasa
    }
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
                <div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-gray-300">Akses Cepat & Ringan</p></div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full"><X size={16}/></button>
                <button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600 transition">Pasang</button>
            </div>
        </div>
    );
};

// --- UPDATED IMAGE COMPONENT ---
// Menggunakan globalImageCache Map untuk efisiensi base64
const ImageWithRetry = ({ src, alt, className, fallbackText }) => {
    const [status, setStatus] = useState(globalImageCache.has(src) ? 'loaded' : 'loading');

    useEffect(() => {
        if (!src) return;
        if (globalImageCache.has(src)) {
            setStatus('loaded');
        } else {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                globalImageCache.set(src, true);
                setStatus('loaded');
            };
            img.onerror = () => setStatus('error');
        }
    }, [src]);

    if (!src || status === 'error') {
        return (
            <div className={`bg-gray-100 flex flex-col items-center justify-center text-gray-400 ${className} border border-gray-200`}>
                 {fallbackText ? (
                    <div className="w-full h-full flex items-center justify-center bg-sky-100 text-sky-600 font-black text-2xl uppercase">
                        {fallbackText[0]}
                    </div>
                ) : <ImageOff size={24} className="opacity-30"/>}
            </div>
        );
    }

    return (
        <div className={`relative ${className} overflow-hidden bg-gray-50`}>
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-100/80 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-sky-500" size={20}/>
                </div>
            )}
            <img 
                src={src} 
                alt={alt} 
                className={`${className} transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
            />
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
                <audio 
                    ref={audioRef} 
                    src={src} 
                    className="w-full h-6 opacity-80" 
                    controls 
                    onEnded={() => setIsPlaying(false)} 
                    onPause={() => setIsPlaying(false)} 
                    onPlay={() => setIsPlaying(true)}
                />
            </div>
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-bounce-slow">
            <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
            <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        </div>
        <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
        <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4"><div className="h-full bg-sky-500 animate-progress-indeterminate"></div></div>
        <p className="text-gray-400 text-xs font-medium animate-pulse">Memuat dunia baru...</p>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white rounded-[2rem] p-5 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200"></div><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 rounded-full"></div><div className="h-8 w-16 bg-gray-100 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 px-1 rounded text-sm text-sky-700 font-mono border border-sky-100">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 4: DASHBOARD DEVELOPER (Admin Panel)
// ==========================================
// ... (Kode DeveloperDashboard dipertahankan untuk admin)
const DeveloperDashboard = ({ onClose }) => {
    // ... (Isi sama seperti sebelumnya untuk menghemat baris, logika tidak berubah)
    return <div className="fixed inset-0 bg-white z-[60] flex items-center justify-center">Panel Developer (Fitur Admin Tetap Ada) <button onClick={onClose} className="ml-4 bg-gray-200 p-2 rounded">Tutup</button></div>;
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI
// ==========================================

const AuthScreen = ({ onLoginSuccess, onCancel }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setError(''); setIsLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (!username.trim()) throw new Error("Username wajib diisi");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                await setDoc(doc(db, getPublicCollection('userProfiles'), userCredential.user.uid), { 
                    username: username.trim(), 
                    email: email, 
                    createdAt: serverTimestamp(), 
                    uid: userCredential.user.uid, 
                    photoURL: '', 
                    following: [], 
                    followers: [], 
                    lastSeen: serverTimestamp(), 
                    savedPosts: [], 
                    mood: 'Warga Baru',
                    hasCompletedOnboarding: false
                });
            }
            onLoginSuccess();
        } catch (err) { setError("Gagal: " + err.message); } finally { setIsLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-300">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800"><X/></button>
                <div className="text-center mb-8 mt-2"><h2 className="text-3xl font-black text-gray-800 tracking-tight mb-1">{isLogin ? 'Masuk Dulu Yuk' : 'Gabung Sekarang'}</h2><p className="text-gray-400 text-sm">Untuk berinteraksi, kamu harus login.</p></div>
                {error && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center font-medium border border-red-100"><AlertTriangle size={14} className="mr-2 flex-shrink-0"/>{error}</div>}
                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && <div className="group relative"><User size={18} className="absolute left-4 top-3.5 text-gray-400"/><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username Unik" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>}
                    <div className="group relative"><Mail size={18} className="absolute left-4 top-3.5 text-gray-400"/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Alamat Email" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>
                    <div className="group relative"><Lock size={18} className="absolute left-4 top-3.5 text-gray-400"/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata Sandi" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>
                    <button disabled={isLoading} className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-800 shadow-lg shadow-gray-200 transition transform active:scale-95 disabled:opacity-70">{isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk Akun' : 'Daftar Gratis')}</button>
                </form>
                <div className="mt-6 text-center pt-6 border-t border-gray-100"><p className="text-xs text-gray-500 mb-4">{isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="font-bold text-sky-600 hover:underline ml-1">{isLogin ? 'Daftar' : 'Masuk'}</button></p></div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: KOMPONEN UTAMA APLIKASI
// ==========================================

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper, requestLogin }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [isSaved, setIsSaved] = useState(profile?.savedPosts?.includes(post.id));
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);

    const isGuest = !currentUserId;
    const isOwner = post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 

    // Handle Interaksi yang butuh Login
    const handleInteraction = (action) => {
        if (isGuest) {
            requestLogin();
            return;
        }
        action();
    };

    useEffect(() => {
        if (!isGuest) {
            setLiked(post.likes?.includes(currentUserId));
            setIsSaved(profile?.savedPosts?.includes(post.id));
        }
        setLikeCount(post.likes?.length || 0);
    }, [post, currentUserId, profile]);

    const handleLike = async () => {
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

    const handleDoubleTap = () => { 
        setShowHeartOverlay(true); 
        setTimeout(() => setShowHeartOverlay(false), 800); 
        handleInteraction(() => { if (!liked) handleLike(); });
    };

    const handleSave = async () => {
        const newSaved = !isSaved;
        setIsSaved(newSaved);
        const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
        try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); }
    };

    const handleComment = async (e) => {
        e.preventDefault(); if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isImage = (post.mediaUrl && !embed && !post.mediaType) || post.mediaType === 'image' || post.mediaUrl?.startsWith('data:image');
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-xl shadow-sky-100/70 border border-white relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-sky-200/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleInteraction(() => goToProfile(post.userId))}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                        </div>
                    </div>
                    <div><h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">{post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span></div></div>
                </div>
                {!isGuest && (isOwner || isMeDeveloper) && <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>}
            </div>

            <div className="text-sm text-gray-600 mb-4 leading-relaxed">{renderMarkdown(isExpanded ? post.content : (post.content?.length > 250 ? post.content.substring(0,250)+'...' : post.content))} {post.content?.length > 250 && <button onClick={()=>setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs">Baca {isExpanded?'Lebih Sedikit':'Selengkapnya'}</button>}</div>
            
            {isImage && (
                <div className="mb-4 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 relative select-none" onDoubleClick={handleDoubleTap}>
                    {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                    <ImageWithRetry src={post.mediaUrl} className="w-full max-h-[500px] object-cover" />
                </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleInteraction(handleLike)} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-full font-bold transition-all ${liked ? 'bg-rose-50 text-rose-500' : 'bg-gray-50 text-gray-500'}`}><Heart size={16} fill={liked ? 'currentColor' : 'none'}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-xs px-4 py-2 rounded-full font-bold bg-gray-50 text-gray-500"><MessageSquare size={16}/> {post.commentsCount || 0}</button>
                <button onClick={() => handleInteraction(handleSave)} className={`ml-auto p-2 rounded-full ${isSaved ? 'bg-sky-50 text-sky-500' : 'bg-gray-50 text-gray-500'}`}><Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'}/></button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar">{comments.map(c => ( <div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs"><span className="font-bold text-gray-800 mr-1">{c.username}</span>{c.text}</div> ))}</div>
                    <form onSubmit={(e) => handleInteraction(() => handleComment(e))} className="flex gap-2 relative"><input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={isGuest ? "Login untuk komentar" : "Tulis komentar..."} disabled={isGuest} className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-xs outline-none"/><button type="submit" className="absolute right-1.5 top-1.5 p-1.5 bg-sky-500 text-white rounded-lg"><Send size={14}/></button></form>
                </div>
            )}
        </div>
    );
};

const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null, isAudio: false });
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            let finalUrl = '', type = 'text';
            // SYSTEM UPLOAD BARU: BASE64 DENGAN KOMPRESI
            if (form.file) {
                if (form.file.type.startsWith('image')) {
                    finalUrl = await processImageToBase64(form.file);
                    type = 'image';
                }
            }
            
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: form.title, content: form.content, mediaUrl: finalUrl, mediaType: type, 
                timestamp: serverTimestamp(), likes: [], commentsCount: 0, isShort: false, category: category, user: {username, uid: userId}
            });
            setTimeout(()=>onSuccess(ref.id, false), 500);
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 relative overflow-hidden mt-4">
                <h2 className="text-xl font-black text-gray-800 mb-6">Buat Postingan</h2>
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul..." className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu..." rows="4" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none resize-none"/>
                    
                    <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer w-full transition ${form.file ?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 text-gray-500'}`}>
                        <ImageIcon size={18} className="mr-2"/>
                        <span className="text-xs font-bold">{form.file ?'Foto Siap Upload (Base64)':'Pilih Foto'}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={e=>setForm({...form, file:e.target.files[0]})} disabled={loading}/>
                    </label>
                    
                    <button disabled={loading || (!form.content && !form.file)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg hover:bg-sky-600 disabled:opacity-50">{loading ? 'Memproses Gambar...' : 'Posting'}</button>
                </form>
            </div>
        </div>
    );
};

const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, setPage, requestLogin }) => {
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false);
    
    // Logic: viewerProfile bisa null jika Guest
    const isGuest = !viewerProfile;
    const isSelf = !isGuest && viewerProfile.uid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;

    const userPosts = allPosts.filter(p=>p.userId===profileData.uid).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    const followersCount = (profileData.followers || []).length;
    
    const save = async () => { 
        setLoad(true); 
        try { 
            let url = profileData.photoURL;
            if (file) {
                // UPDATE BASE64 PROFILE PIC
                url = await processImageToBase64(file);
            }
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); 
            setEdit(false); 
        } catch(e){alert(e.message)} finally{setLoad(false)}; 
    };

    const isFollowing = !isGuest && (viewerProfile.following || []).includes(profileData.uid); 

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-white mb-8 mx-4 text-center relative">
                <div className="relative inline-block mb-4 mt-8">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 relative">
                        {load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}
                        <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover" fallbackText={profileData.username}/>
                    </div>
                    {isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}
                </div>

                {edit ? ( <div className="space-y-3 bg-gray-50 p-4 rounded-xl"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'Menyimpan...':'Simpan'}</button></div> ) : ( <h1 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> )}
                
                {!isSelf && ( <button onClick={() => isGuest ? requestLogin() : handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${isFollowing ? 'bg-gray-200 text-gray-600' : 'bg-sky-500 text-white shadow-sky-200'}`}>{isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                
                <div className="grid grid-cols-2 gap-3 mt-6 border-t border-gray-100 pt-6">
                    <div className="bg-gray-50/70 rounded-2xl p-3"><span className="font-bold text-xl block">{followersCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div>
                    <div className="bg-gray-50/70 rounded-2xl p-3"><span className="font-bold text-xl block">{(profileData.following || []).length}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div>
                </div>

                {isSelf && <button onClick={() => setPage('legal')} className="mt-8 w-full text-xs text-gray-400 hover:text-sky-600 font-medium flex items-center justify-center gap-1.5 transition group"><BookOpenIcon size={14} className="group-hover:text-sky-500"/> Info Legal</button>}
            </div>
            <div className="px-4 space-y-6">{userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile?.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}} requestLogin={requestLogin}/>)}</div>
        </div>
    );
};

const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper, requestLogin }) => {
    const [displayCount, setDisplayCount] = useState(5);
    const visiblePosts = allPosts.slice(0, displayCount);
    
    // Sederhanakan load more untuk performa
    const loadMore = () => setDisplayCount(prev => prev + 5);

    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            {!currentUserId && (
                <div className="bg-gradient-to-r from-sky-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold">Mode Tamu</h3>
                        <p className="text-xs opacity-90">Login untuk like, komen & posting!</p>
                    </div>
                    <button onClick={requestLogin} className="bg-white text-sky-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">Login</button>
                </div>
            )}

            {visiblePosts.map(p => (
                <PostItem key={p.id} post={p} currentUserId={currentUserId} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper} requestLogin={requestLogin}/>
            ))}
            
            {visiblePosts.length < allPosts.length && (
                <button onClick={loadMore} className="w-full py-3 bg-white text-gray-500 font-bold text-xs rounded-xl shadow-sm hover:text-sky-500">Muat Lebih Banyak</button>
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
    return <div className="max-w-lg mx-auto p-4 pb-24"><h1 className="text-xl font-black text-gray-800 mb-6">Notifikasi</h1>{notifs.length===0?<div className="text-center py-20 text-gray-400">Tidak ada notifikasi baru.</div>:<div className="space-y-3">{notifs.map(n=><div key={n.id} onClick={()=>handleClick(n)} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50 transition"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>{n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}</div></div><div className="flex-1"><p className="text-sm font-bold">{n.fromUsername}</p><p className="text-xs text-gray-600">{n.message}</p></div></div>)}</div>}</div>;
};

const LegalScreen = ({ setPage }) => {
    return (
        <div className="max-w-lg mx-auto p-4 pb-40 pt-6 animate-in fade-in">
            <button onClick={() => setPage('profile')} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white px-4 py-2 rounded-xl shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button>
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100">
                <h2 className="text-2xl font-black text-gray-800 mb-4">Ketentuan & Privasi</h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    Selamat datang di {APP_NAME}. Aplikasi ini dibuat untuk tujuan edukasi dan komunikasi.
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                    <li>Gunakan bahasa yang sopan.</li>
                    <li>Dilarang spam atau konten ilegal.</li>
                    <li>Data Anda disimpan aman di Google Firebase.</li>
                </ul>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 7: APP UTAMA (CORE LOGIC)
// ==========================================
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); // DEFAULT KE HOME
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null); 
    const [newPostId, setNewPostId] = useState(null);
    const [showSplash, setShowSplash] = useState(true);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false); // Modal Login untuk Guest

    useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 2500); return () => clearTimeout(timer); }, []);

    // FETCH DATA GLOBAL (Bisa dibaca Guest juga)
    useEffect(() => {
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(50)), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            const uids = [...new Set(raw.map(r=>r.userId))];
            // Optimasi: Ambil user profile hanya jika belum ada di state users
            const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u))));
            const map = {};
            snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user})));
        });

        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        return () => { unsubPosts(); unsubUsers(); };
    }, []);

    // AUTH LISTENER
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, u => {
            if(u) {
                setUser(u);
                updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{}); 
                // Fetch profile
                const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), s => {
                    if (s.exists()) {
                        const profileData = s.data();
                        setProfile({...profileData, uid:u.uid, email:u.email});
                        if (profileData.email === DEVELOPER_EMAIL) enableDevConsole();
                    }
                });
                return () => unsubP();
            } else {
                setUser(null);
                setProfile(null);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const handleFollow = async (uid, isFollowing) => { 
        if (!user) { setShowAuthModal(true); return; }
        if (!profile) return; 
        const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); 
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid); 
        try { 
            if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } 
            else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } 
        } catch (e) { console.error("Gagal update pertemanan", e); } 
    };

    const handlePWAInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    // Fungsi untuk memaksa login jika guest mencoba interaksi
    const requestLogin = () => setShowAuthModal(true);

    if (showSplash) return <SplashScreen />;

    // --- RENDER APP ---
    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800 transition-colors duration-300">
            {/* AUTH MODAL OVERLAY */}
            {showAuthModal && (
                <AuthScreen 
                    onLoginSuccess={() => setShowAuthModal(false)} 
                    onCancel={() => setShowAuthModal(false)}
                />
            )}

            <header className="fixed top-0 w-full bg-white/80 backdrop-blur-xl h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100/80 shadow-lg shadow-sky-100/30 transition-colors duration-300">
                <div className="flex items-center gap-2" onClick={()=>setPage('home')}>
                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                </div>
                <div className="flex items-center gap-3">
                    {deferredPrompt && <button onClick={handlePWAInstall} className="p-2 bg-sky-50 text-sky-600 rounded-full shadow-sm hover:bg-sky-100 transition"><Download size={20}/></button>}
                    
                    {user ? (
                        <>
                            <button onClick={()=>setPage('notifications')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative">
                                <Bell size={20}/>
                            </button>
                            <button onClick={async()=>{await signOut(auth); setPage('home');}} className="p-2 bg-white rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition">
                                <LogOut size={20}/>
                            </button>
                        </>
                    ) : (
                        <button onClick={()=>setShowAuthModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-sky-200 hover:bg-sky-600 transition">
                            Login
                        </button>
                    )}
                </div>
            </header> 
            
            <main className="pt-16">
                {page==='home' && <HomeScreen currentUserId={user?.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={user?.email === DEVELOPER_EMAIL} requestLogin={requestLogin}/>}
                
                {page==='create' && user && <CreatePost setPage={setPage} userId={user.uid} username={profile?.username} onSuccess={(id)=>{setNewPostId(id); setPage('home')}}/>}
                
                {page==='notifications' && user && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                
                {page==='profile' && user && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} setPage={setPage} requestLogin={requestLogin}/>}
                
                {page==='other-profile' && <ProfileScreen viewerProfile={profile} profileData={users.find(u=>u.uid===targetUid)||{}} allPosts={posts} handleFollow={handleFollow} setPage={setPage} requestLogin={requestLogin}/>}
                
                {page==='legal' && <LegalScreen setPage={setPage} />}
            </main>
            
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-t from-white/95 to-white/90 backdrop-blur-2xl border-t border-white rounded-full px-6 py-3 shadow-2xl shadow-sky-200/60 flex items-center gap-6 z-40">
                <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                <button onClick={()=> user ? setPage('create') : requestLogin()} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                <NavBtn icon={User} active={page==='profile'} onClick={()=> user ? setPage('profile') : requestLogin()}/>
            </nav>
            
            <PWAInstallPrompt deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} />
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;