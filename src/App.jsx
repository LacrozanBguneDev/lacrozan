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
    writeBatch
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
    FileText, Shield, Cookie, Gavel, FileCheck, Layers, LayoutGrid
} from 'lucide-react';

// SET LOG LEVEL FIRESTORE AGAR TIDAK SPAM CONSOLE
setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const PASSWORD_RESET_LINK = "https://forms.gle/cAWaoPMDkffg6fa89";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- GLOBAL IMAGE CACHE ---
const globalImageCache = new Set();

// --- KUNCI VAPID BARU ---
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

let messaging = null;
try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
    }
} catch (e) {
    console.log("Messaging skipped");
}

// ==========================================
// BAGIAN 2: LEGAL & POLICY DATA
// ==========================================

const LEGAL_DOCS = {
    privacy: {
        title: "Kebijakan Privasi",
        icon: Shield,
        content: `
### 1. Data yang Kami Kumpulkan
Kami mengumpulkan data berikut untuk fungsionalitas aplikasi:
- **Informasi Akun:** Username, alamat email, dan foto profil.
- **Konten Pengguna:** Postingan, komentar, pesan, dan media (foto/video/audio) yang Anda unggah.
- **Data Teknis:** Alamat IP (untuk keamanan), jenis perangkat, dan log aktivitas.

### 2. Penggunaan Data
Data Anda digunakan untuk:
- Menyediakan layanan jejaring sosial (posting, interaksi).
- Personalisasi konten (rekomendasi postingan).
- Keamanan dan moderasi konten (mencegah spam/penipuan).
- Notifikasi pembaruan layanan.

### 3. Penyimpanan Data
Data disimpan secara aman menggunakan **Google Firebase** (Firestore & Storage). Kami menerapkan aturan keamanan database untuk mencegah akses tidak sah.

### 4. Hak Pengguna
Anda berhak untuk:
- Mengakses data pribadi Anda.
- Meminta penghapusan akun dan data (Hubungi Developer).
- Mengubah informasi profil kapan saja.
        `
    },
    tos: {
        title: "Ketentuan Layanan",
        icon: Gavel,
        content: `
### 1. Penerimaan Syarat
Dengan menggunakan ${APP_NAME}, Anda menyetujui ketentuan ini.

### 2. Aturan Penggunaan
- **Usia:** Minimal 13 tahun.
- **Akun:** Anda bertanggung jawab atas keamanan akun Anda.
- **Larangan:** Dilarang menggunakan bot, scraping, atau teknik hacking.

### 3. Hak Kekayaan Intelektual
- Konten yang Anda unggah tetap milik Anda.
- Dengan mengunggah, Anda memberi kami lisensi non-eksklusif untuk menampilkannya di aplikasi ini.

### 4. Penafian (Disclaimer)
Aplikasi ini disediakan "sebagaimana adanya". Kami tidak bertanggung jawab atas kerugian akibat penggunaan aplikasi atau konten pengguna lain.

### 5. Perubahan Layanan
Kami berhak mengubah atau menghentikan fitur sewaktu-waktu tanpa pemberitahuan.
        `
    },
    community: {
        title: "Panduan Komunitas",
        icon: Users,
        content: `
### Jadilah Pengguna yang Baik
Aplikasi ini dibangun untuk koneksi positif.

### Dilarang Keras:
1. **Ujaran Kebencian:** SARA, bullying, atau pelecehan.
2. **Konten Seksual:** Pornografi atau konten dewasa eksplisit.
3. **Kekerasan:** Ancaman atau promosi kekerasan fisik.
4. **Spam:** Promosi berlebihan atau link berbahaya.
5. **Berita Palsu:** Menyebarkan hoax yang meresahkan.

### Sanksi
Pelanggaran dapat mengakibatkan:
- Penghapusan konten.
- Penangguhan akun sementara.
- Pemblokiran permanen (Banned).
        `
    },
    cookies: {
        title: "Kebijakan Cookie",
        icon: Cookie,
        content: `
### Penggunaan Cookie
Kami menggunakan cookie dan teknologi penyimpanan lokal (Local Storage) untuk:
- **Sesi Login:** Mengingat Anda agar tidak perlu login ulang setiap saat.
- **Preferensi:** Menyimpan pengaturan tema atau bahasa.
- **Analitik:** Memahami bagaimana fitur digunakan (secara anonim).

Kami **tidak** menggunakan cookie untuk pelacakan iklan pihak ketiga yang agresif.
        `
    },
    security: {
        title: "Pemberitahuan Keamanan",
        icon: FileCheck,
        content: `
### Keamanan Data
- Semua transmisi data dienkripsi menggunakan **SSL/TLS (HTTPS)**.
- Password Anda di-hash dan tidak dapat dilihat oleh developer.
- Kami menggunakan autentikasi token yang aman.

### Tips Keamanan
- Jangan bagikan password Anda kepada siapapun.
- Gunakan password yang unik dan kuat.
- Hati-hati terhadap link mencurigakan di komentar.
        `
    }
};

// ==========================================
// BAGIAN 3: UTILITY FUNCTIONS & HELPERS
// ==========================================

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

const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1080; 
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
                
                ctx.canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Gagal kompresi gambar"));
                        return;
                    }
                    const newFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                }, 'image/jpeg', 0.8); 
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

const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    if(onProgress) onProgress(10);
    formData.append('file', file, file.name);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    try {
        for (let i = 10; i <= 50; i += 10) { 
            if(onProgress) onProgress(i); 
            await delay(100); 
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(apiUrl, { 
            method: 'POST', 
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if(onProgress) onProgress(80);
        
        if (!response.ok) { throw new Error(`Server Error: ${response.status}`); }
        
        const data = await response.json();
        if(onProgress) onProgress(100);
        
        if (data && data.url) {
            let secureUrl = data.url;
            if (secureUrl.startsWith('http://')) { secureUrl = secureUrl.replace('http://', 'https://'); }
            return secureUrl;
        } else if (data && data.result && data.result.url) { 
            return data.result.url;
        } else { 
            throw new Error('Format respon API tidak dikenali.'); 
        }
    } catch (error) {
        if(onProgress) onProgress(0); 
        console.error("Upload Error:", error);
        throw new Error('Gagal upload. Koneksi server gambar sedang sibuk.');
    }
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
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-amber-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-indigo-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-sky-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-slate-200 text-slate-600" };
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
// BAGIAN 4: KOMPONEN UI KECIL & HELPER
// ==========================================

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
        <div className="fixed bottom-24 left-4 right-4 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom duration-500 border border-slate-700">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><Smartphone size={24}/></div>
                <div><h4 className="font-bold text-sm">Install {APP_NAME}</h4><p className="text-xs text-slate-300">Notifikasi & Fullscreen</p></div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={()=>{setShowBanner(false); localStorage.setItem('pwa_dismissed', Date.now())}} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"><X size={16}/></button>
                <button onClick={handleInstall} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-blue-700 transition">Pasang</button>
            </div>
        </div>
    );
};

const ImageWithRetry = ({ src, alt, className, fallbackText }) => {
    const initialState = globalImageCache.has(src) ? 'loaded' : 'loading';
    const [status, setStatus] = useState(initialState);
    const [retryKey, setRetryKey] = useState(0);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        if (globalImageCache.has(src)) {
            setStatus('loaded');
        } else {
            setStatus('loading');
            setRetryKey(0);
            setAttempts(0);
        }
    }, [src]);

    useEffect(() => {
        let timeout;
        if (status === 'error') {
            timeout = setTimeout(() => {
                if (globalImageCache.has(src)) {
                    setStatus('loaded');
                } else {
                    setRetryKey(prev => prev + 1);
                    setStatus('loading');
                    setAttempts(prev => prev + 1);
                }
            }, 4000);
        }
        return () => clearTimeout(timeout);
    }, [status, src]);

    const handleSuccess = () => {
        globalImageCache.add(src); 
        setStatus('loaded');
    };

    const handleError = () => {
        setStatus('error');
    };

    if (!src) {
        return (
            <div className={`bg-slate-100 flex flex-col items-center justify-center text-slate-400 ${className} border border-slate-200`}>
                 {fallbackText ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-black text-2xl uppercase">
                        {fallbackText[0]}
                    </div>
                ) : <ImageOff size={24} className="opacity-30"/>}
            </div>
        );
    }

    return (
        <div className={`relative ${className} overflow-hidden bg-slate-50`}>
            {status !== 'loaded' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-100/80 backdrop-blur-sm transition-all duration-300">
                    <Loader2 className="animate-spin text-blue-500 mb-2" size={20}/>
                </div>
            )}
            
            <img 
                key={retryKey} 
                src={src} 
                alt={alt} 
                className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                onLoad={handleSuccess}
                onError={handleError}
                loading="lazy"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
            />
        </div>
    );
};

const AudioPlayer = ({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState(false);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Audio playback error:", error);
                        setIsPlaying(false);
                        setError(true);
                    });
                }
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleRetry = () => {
        setError(false);
        setIsPlaying(false);
        if(audioRef.current) {
            audioRef.current.load();
        }
    };

    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-3 flex items-center gap-3 mb-4 shadow-md border border-slate-700">
            {error ? (
                 <button onClick={handleRetry} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition" title="Coba Lagi">
                    <RefreshCw size={18} />
                 </button>
            ) : (
                <button onClick={togglePlay} className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition">
                    {isPlaying ? <Pause size={18} fill="white"/> : <Play size={18} fill="white" className="ml-1"/>}
                </button>
            )}
            
            <div className="flex-1">
                <div className="flex items-center gap-1 text-xs font-bold text-blue-400 mb-1">
                    <Music size={12}/> {error ? "Gagal memuat audio" : "Audio Clip"}
                </div>
                {!error && (
                    <audio 
                        ref={audioRef} 
                        src={src} 
                        className="w-full h-6 opacity-80" 
                        controls 
                        onEnded={() => setIsPlaying(false)} 
                        onPause={() => setIsPlaying(false)} 
                        onPlay={() => setIsPlaying(true)}
                        onError={() => setError(true)}
                    />
                )}
                {error && <p className="text-[10px] text-red-400">Terjadi kesalahan jaringan.</p>}
            </div>
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-8 animate-in zoom-in duration-700">
            <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-xl"/>
        </div>
        <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tighter">{APP_NAME}</h1>
        <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay:'0s'}}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
        </div>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white rounded-[1.5rem] p-5 mb-6 border border-slate-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-slate-200"></div><div className="flex-1"><div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div><div className="h-3 bg-slate-100 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div><div className="h-48 bg-slate-200 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-slate-100 rounded-full"></div><div className="h-8 w-16 bg-slate-100 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-slate-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (match) => { if (match.includes('href="')) return match; return `<a href="${match}" target="_blank" class="text-blue-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`; });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm text-blue-700 font-mono border border-slate-200">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-slate-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 5: DASHBOARD & LEGAL PAGES
// ==========================================

const LegalCenter = ({ onClose }) => {
    const [view, setView] = useState('menu'); // menu, privacy, tos, community, cookies, security
    const DocContent = LEGAL_DOCS[view];

    return (
        <div className="fixed inset-0 bg-slate-50 z-[70] overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between z-10">
                <button onClick={view === 'menu' ? onClose : () => setView('menu')} className="p-2 rounded-full hover:bg-slate-100 transition">
                    <ArrowLeft size={24} className="text-slate-700"/>
                </button>
                <h2 className="font-bold text-lg text-slate-800">{view === 'menu' ? 'Pusat Informasi' : DocContent.title}</h2>
                <div className="w-10"></div>
            </div>

            <div className="p-6 max-w-2xl mx-auto pb-24">
                {view === 'menu' ? (
                    <div className="space-y-4">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={40} className="text-blue-600"/>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">Transparansi & Keamanan</h3>
                            <p className="text-slate-500 text-sm">Informasi lengkap mengenai hak, kewajiban, dan keamanan data Anda di {APP_NAME}.</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                            {Object.entries(LEGAL_DOCS).map(([key, data]) => (
                                <button key={key} onClick={() => setView(key)} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition text-left">
                                    <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600"><data.icon size={20}/></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800 text-sm">{data.title}</h4>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300"/>
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 text-center border-t border-slate-200 pt-8">
                            <p className="text-xs text-slate-400 font-medium">Versi Aplikasi 24.1 (Pro)</p>
                            <p className="text-xs text-slate-400">© 2024 {APP_NAME} Professional.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-blue-50 rounded-2xl p-6 mb-6 text-center border border-blue-100">
                            <DocContent.icon size={48} className="mx-auto text-blue-600 mb-3"/>
                            <h3 className="text-2xl font-black text-slate-800">{DocContent.title}</h3>
                        </div>
                        <div className="prose prose-sm prose-blue text-slate-600 max-w-none">
                             {renderMarkdown(DocContent.content)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

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
        <div className="fixed inset-0 bg-slate-100 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white p-2 rounded-full shadow hover:bg-slate-200"><X/></button></div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center"><Users className="mx-auto text-blue-500 mb-2"/><h3 className="text-2xl font-bold">{stats.users}</h3><p className="text-[10px] text-slate-500 uppercase font-bold">Total User</p></div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center"><ImageIcon className="mx-auto text-indigo-500 mb-2"/><h3 className="text-2xl font-bold">{stats.posts}</h3><p className="text-[10px] text-slate-500 uppercase font-bold">Total Post</p></div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center"><Activity className="mx-auto text-emerald-500 mb-2"/><h3 className="text-2xl font-bold">{stats.postsToday}</h3><p className="text-[10px] text-slate-500 uppercase font-bold">Post Hari Ini</p></div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border border-slate-200 mb-3 outline-none" rows="3" placeholder="Tulis pesan untuk semua user..."/>
                            <button onClick={handleBroadcast} disabled={sendingBC} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition">{sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}</button>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart3 size={18}/> Aktivitas Minggu Ini</h3>
                            <div className="flex items-end justify-between h-32 gap-2">{chartData.map((d, i) => ( <div key={i} className="flex flex-col items-center w-full group"><div className="text-xs font-bold text-blue-600 mb-1 opacity-0 group-hover:opacity-100 transition">{d.count}</div><div className="w-full bg-blue-100 rounded-t-lg hover:bg-blue-300 transition-all relative" style={{height: `${d.height}%`}}></div><div className="text-[10px] text-slate-400 mt-2 font-bold">{d.day}</div></div> ))}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const OnboardingOverlay = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[80] flex items-center justify-center p-6 animate-in fade-in duration-700">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-slate-100">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Sparkles size={40} className="text-blue-500"/>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Selamat Datang</h2>
                <p className="text-slate-500 mb-8 leading-relaxed text-sm">Bergabunglah dengan komunitas profesional di <strong>{APP_NAME}</strong>. Bagikan cerita, temukan inspirasi.</p>
                <button onClick={onClose} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition transform active:scale-[0.98]">Mulai Menjelajah</button>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: LAYAR OTENTIKASI & LANDING
// ==========================================

const AuthScreen = ({ onLoginSuccess }) => {
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
                    mood: '' 
                });
            }
        } catch (err) { setError("Login/Daftar gagal. " + err.message); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
                <div className="text-center mb-8 mt-2">
                    <img src={APP_LOGO} className="w-16 h-16 mx-auto mb-4 object-contain"/>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{isLogin ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}</h2>
                    <p className="text-slate-400 text-sm">Masuk untuk melanjutkan</p>
                </div>
                {error && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center font-medium border border-red-100"><AlertTriangle size={14} className="mr-2 flex-shrink-0"/>{error}</div>}
                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && <div className="group relative"><User size={18} className="absolute left-4 top-3.5 text-slate-400"/><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"/></div>}
                    <div className="group relative"><Mail size={18} className="absolute left-4 top-3.5 text-slate-400"/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"/></div>
                    <div className="group relative"><Lock size={18} className="absolute left-4 top-3.5 text-slate-400"/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"/></div>
                    <button disabled={isLoading} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-[0.98] disabled:opacity-70 disabled:scale-100">{isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk' : 'Daftar')}</button>
                </form>
                <div className="mt-6 text-center pt-6 border-t border-slate-100"><p className="text-xs text-slate-500 mb-4">{isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="font-bold text-blue-600 hover:underline ml-1">{isLogin ? 'Daftar' : 'Masuk'}</button></p></div>
            </div>
        </div>
    );
};

const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12 font-sans relative overflow-hidden">
            {/* Background Decorations - Soft Blue Only */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[120px] opacity-30"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-200 rounded-full blur-[120px] opacity-30"></div>

            <div className="relative z-10 text-center w-full max-w-md">
                <div className="bg-white/70 backdrop-blur-2xl border border-white shadow-2xl shadow-blue-100/50 rounded-[2.5rem] p-10">
                    <div className="relative inline-block mb-8">
                        <img src={APP_LOGO} alt="Logo" className="w-24 h-24 mx-auto object-contain drop-shadow-sm" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight leading-tight">{APP_NAME}</h1>
                    <p className="text-slate-500 font-medium mb-10 leading-relaxed text-sm">Platform sosial modern yang mengutamakan kecepatan, privasi, dan pengalaman pengguna yang mulus.</p>
                    
                    <div className="space-y-3 mb-10 text-left">
                         <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Zap size={18}/></div>
                            <span className="text-sm font-bold text-slate-700">Performa Cepat & Ringan</span>
                         </div>
                         <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><ShieldCheck size={18}/></div>
                            <span className="text-sm font-bold text-slate-700">Privasi Terjamin</span>
                         </div>
                         <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Globe size={18}/></div>
                            <span className="text-sm font-bold text-slate-700">Koneksi Global</span>
                         </div>
                    </div>

                    <button onClick={onGetStarted} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transform active:scale-[0.98] transition-all flex items-center justify-center group text-sm">Mulai Sekarang <ChevronRight className="ml-2 group-hover:translate-x-1 transition"/></button>
                    
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Developed By</p>
                        <div className="flex items-center justify-center gap-2">
                             <img src={DEV_PHOTO} className="w-6 h-6 rounded-full border border-white shadow-sm"/>
                             <span className="text-xs font-bold text-slate-700">Irham Andika Putra</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 7: KOMPONEN UTAMA APLIKASI
// ==========================================

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    
    const [isSaved, setIsSaved] = useState(profile.savedPosts?.includes(post.id));
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);

    const isOwner = post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 
    const isMeme = post.category === 'meme';

    const isFollowing = (profile.following || []).includes(post.userId);
    const isFollowedByTarget = (profile.followers || []).includes(post.userId);
    const isFriend = isFollowing && isFollowedByTarget;

    const MAX_CHARS = 250;
    const isLongText = post.content && post.content.length > MAX_CHARS;
    const displayText = isExpanded || !isLongText ? post.content : post.content.substring(0, MAX_CHARS) + "...";

    useEffect(() => {
        setLiked(post.likes?.includes(currentUserId));
        setLikeCount(post.likes?.length || 0);
        setIsSaved(profile.savedPosts?.includes(post.id));
    }, [post, currentUserId, profile.savedPosts]);

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

    const handleDoubleTap = () => { setShowHeartOverlay(true); setTimeout(() => setShowHeartOverlay(false), 800); if (!liked) { handleLike(); } };

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

    const handleDelete = async () => { if (confirm(isMeDeveloper && !isOwner ? "⚠️ ADMIN: Hapus postingan orang lain?" : "Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };
    const handleDeleteComment = async (commentId) => { if(confirm("Hapus komentar?")) { await deleteDoc(doc(db, getPublicCollection('comments'), commentId)); await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) }); } };
    const handleUpdatePost = async () => { await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent }); setIsEditing(false); };
    const sharePost = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin!'); } catch (e) { alert('Gagal menyalin link'); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isAudio = post.mediaType === 'audio' || (embed && embed.type === 'audio_file');
    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !embed;
    const isImage = (post.mediaUrl && (/\.(jpg|png|webp|jpeg)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !embed;
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white rounded-[2rem] p-6 mb-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 relative overflow-hidden group transition hover:shadow-lg hover:border-blue-100">
            {post.isShort && <div className="absolute top-4 right-4 bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full z-10 flex items-center shadow-lg"><Zap size={10} className="mr-1 text-yellow-400"/> SHORT</div>}
            
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="relative">
                         <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden ring-2 ring-white shadow-sm">
                            <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                         </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-1">
                            {post.user?.username} 
                            {isDeveloper && <ShieldCheck size={14} className="text-blue-600 fill-blue-50"/>}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-medium">{formatTimeAgo(post.timestamp).relative}</span>
                            {isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${userBadge.color}`}>{userBadge.label}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!isOwner && post.userId !== currentUserId && ( <button onClick={() => handleFollow(post.userId, isFollowing)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${isFriend ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : isFollowing ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700'}`}>{isFriend ? <><UserCheck size={12}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                    {(isOwner || isMeDeveloper) && ( <div className="flex gap-2">{isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition"><Edit size={16}/></button>}<button onClick={handleDelete} className={`p-2 rounded-full transition ${isMeDeveloper && !isOwner ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}>{isMeDeveloper && !isOwner ? <ShieldAlert size={16}/> : <Trash2 size={16}/>}</button></div> )}
                </div>
            </div>

            {isEditing ? (
                <div className="mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"><input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-sm"/><textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm resize-none" rows="4"/><div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs font-bold text-slate-500 px-3 py-1">Batal</button><button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-lg">Simpan</button></div></div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-slate-900 mb-2 text-lg tracking-tight">{post.title}</h3>}
                    <div className="text-sm text-slate-600 mb-4 leading-relaxed font-normal">{renderMarkdown(displayText)}{isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-blue-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}</div>
                    
                    {(isImage || isVideo || isAudio || embed) && (
                        <div className="mb-4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 relative select-none" onDoubleClick={handleDoubleTap}>
                            {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                            {isAudio && <AudioPlayer src={post.mediaUrl || embed.url} />}
                            {isImage && <ImageWithRetry src={post.mediaUrl} className="w-full max-h-[500px] object-cover cursor-pointer" />}
                            {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black"/>}
                            {embed?.type === 'youtube' && <div className="aspect-video"><iframe src={embed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                            {embed?.type === 'link' && <a href={embed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center bg-blue-50 text-blue-600 font-bold text-sm hover:underline">Buka Tautan Eksternal <ExternalLink size={14} className="inline ml-1"/></a>}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-6 pt-3 border-t border-slate-50">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}><Heart size={20} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-500"><MessageSquare size={20}/> {post.commentsCount || 0}</button>
                <button onClick={sharePost} className="text-slate-400 hover:text-blue-500 ml-auto"><Share2 size={20}/></button>
                <button onClick={handleSave} className={`transition ${isSaved ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}><Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} /></button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-slate-100 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">{comments.length === 0 ? <p className="text-xs text-center text-slate-400">Belum ada komentar.</p> : comments.map(c => ( <div key={c.id} className="bg-slate-50 p-3 rounded-xl text-xs flex justify-between items-start group"><div><span className="font-bold text-slate-800 mr-1">{c.username}</span><span className="text-slate-600">{c.text}</span></div>{(currentUserId === c.userId || isMeDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">{isMeDeveloper && currentUserId !== c.userId ? <ShieldAlert size={12}/> : <Trash size={12}/>}</button>}</div> ))}</div>
                    <form onSubmit={handleComment} className="flex gap-2 relative"><input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-100 font-medium"/><button type="submit" disabled={!newComment.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"><Send size={14}/></button></form>
                </div>
            )}
        </div>
    );
};

// --- CREATE POST ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null, url: '', isShort: false, isAudio: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0);

    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let finalUrl = form.url, type = 'text';
            let fileToUpload = form.file;

            if (fileToUpload && fileToUpload.type.startsWith('image')) {
                fileToUpload = await compressImage(fileToUpload);
            }

            if(fileToUpload) { 
                finalUrl = await uploadToFaaAPI(fileToUpload, setProg); 
                if (fileToUpload.type.startsWith('image')) type = 'image';
                else if (fileToUpload.type.startsWith('video')) type = 'video';
                else if (fileToUpload.type.startsWith('audio')) type = 'audio';
            }
            else if(form.url) { type='link'; }
            
            const category = form.content.toLowerCase().includes('#meme') ? 'meme' : 'general';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: form.title, content: form.content, mediaUrl: finalUrl, mediaType: type, 
                timestamp: serverTimestamp(), likes: [], commentsCount: 0, isShort: form.isShort, category: category, user: {username, uid: userId}
            });
            setProg(100); setTimeout(()=>onSuccess(ref.id, form.isShort), 500);
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden mt-4">
                <h2 className="text-xl font-black text-slate-800 mb-6">Buat Postingan</h2>
                <form onSubmit={submit} className="space-y-4">
                    {loading && <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2"><div className="bg-blue-600 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul Menarik..." className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100 transition"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu..." rows="4" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 transition resize-none"/>
                    <div className="flex gap-2 text-xs"><button type="button" onClick={()=>setForm({...form, content: form.content + "**Tebal**"})} className="bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 font-bold">B</button><button type="button" onClick={()=>setForm({...form, content: form.content + "*Miring*"})} className="bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 italic">I</button><button type="button" onClick={insertLink} className="bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1 font-bold"><LinkIcon size={10}/> Link</button></div>
                    
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.file && !form.isAudio ?'bg-blue-50 border-blue-200 text-blue-600':'border-slate-200 text-slate-500'}`}>
                            <ImageIcon size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.file && !form.isAudio ?'File Dipilih':'Foto/Video'}</span>
                            <input type="file" className="hidden" accept="image/*,video/*" onChange={e=>{const f=e.target.files[0]; if(f) {setForm({...form, file:f, isShort: f.type.startsWith('video'), isAudio: false});}}} disabled={loading}/>
                        </label>
                        
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.isAudio ?'bg-indigo-50 border-indigo-200 text-indigo-600':'border-slate-200 text-slate-500'}`}>
                            <Music size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.isAudio ? 'Audio Siap' : 'Audio'}</span>
                            <input type="file" className="hidden" accept="audio/*" onChange={e=>{const f=e.target.files[0]; if(f) {setForm({...form, file:f, isShort: false, isAudio: true});}}} disabled={loading}/>
                        </label>

                        <div onClick={()=>setForm({...form, isShort:!form.isShort})} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap transition ${form.isShort?'bg-slate-900 text-white border-slate-900':'border-slate-200 text-slate-500'}`}><Zap size={18} className="mr-2"/><span className="text-xs font-bold">Shorts</span></div>
                    </div>
                    
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, file:null, isShort: e.target.value.includes('shorts')})} placeholder="Atau Link Video (YouTube)..." className="w-full pl-10 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100 transition"/></div>
                    <button disabled={loading || (!form.content && !form.file && !form.url)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transform active:scale-[0.98] transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, onShowLegal }) => {
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false);
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); 
    const [mood, setMood] = useState(profileData.mood || '');
    const [isEditingMood, setIsEditingMood] = useState(false);

    const isSelf = viewerProfile.uid === profileData.uid; 
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
                const compressedFile = await compressImage(file);
                url = await uploadToFaaAPI(compressedFile, ()=>{});
            }
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); 
            setEdit(false); 
        } catch(e){alert(e.message)} finally{setLoad(false)}; 
    };

    const saveMood = async () => { try { await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood }); setIsEditingMood(false); } catch(e) { console.error(e); } };
    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);
    const isFollowing = (viewerProfile.following || []).includes(profileData.uid); 
    const isFollowedByTarget = (viewerProfile.followers || []).includes(profileData.uid);
    const isFriend = isFollowing && isFollowedByTarget; 
    const isOnline = isUserOnline(profileData.lastSeen);
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="relative inline-block mb-4 mt-2">
                    <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-slate-50 ${isOnline ? 'border-emerald-400' : 'border-white'} relative`}>
                        {load && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 className="animate-spin text-white" size={32}/></div>}
                        <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover" fallbackText={profileData.username}/>
                    </div>
                    {isSelf && !load && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md text-blue-600 hover:bg-slate-50"><Edit size={14}/></button>}
                </div>

                {edit ? ( <div className="space-y-3 bg-slate-50 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-blue-500 w-full text-center font-bold bg-transparent outline-none"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs text-slate-500"/><button onClick={save} disabled={load} className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold">{load?'Mengunggah...':'Simpan'}</button></div> ) : ( <> <h1 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1> {isSelf ? ( isEditingMood ? ( <div className="flex items-center justify-center gap-2 mt-2"><input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32 bg-white"/><button onClick={saveMood} className="text-green-500"><Check size={14}/></button></div> ) : ( <div onClick={()=>setIsEditingMood(true)} className="text-sm text-slate-500 mt-1 cursor-pointer hover:text-blue-500 flex items-center justify-center gap-1 font-medium">{profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/></div> ) ) : ( profileData.mood && <p className="text-sm text-slate-500 mt-1 italic">"{profileData.mood}"</p> )} </> )}
                
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label}</div>
                
                {!isSelf && ( <button onClick={()=>handleFollow(profileData.uid, isFollowing)} className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 transform active:scale-[0.98] ${isFriend ? 'bg-emerald-500 text-white shadow-emerald-200' : isFollowing ? 'bg-slate-100 text-slate-600' : 'bg-blue-600 text-white shadow-blue-200'}`}>{isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                
                {isSelf && (
                    <div className="grid grid-cols-2 gap-2 mt-4 mb-2">
                        {isDev && <button onClick={()=>setShowDev(true)} className="bg-slate-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-900 shadow-lg"><ShieldCheck size={16}/> Dev Dashboard</button>}
                         <button onClick={onShowLegal} className="bg-white text-slate-600 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 border border-slate-200 shadow-sm"><Info size={16}/> Info & Legal</button>
                    </div>
                )}

                <div className="flex justify-center gap-8 mt-6 border-t border-slate-100 pt-6"><div><span className="font-bold text-xl block text-slate-800">{followersCount}</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pengikut</span></div><div><span className="font-bold text-xl block text-slate-800">{followingCount}</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mengikuti</span></div></div>
            </div>
            {isSelf && ( <div className="flex gap-2 px-4 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>Disimpan</button></div> )}
            <div className="px-4 space-y-6">{activeTab === 'posts' ? (userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)) : ( savedPostsData.length > 0 ? savedPostsData.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>) : <div className="text-center text-slate-400 py-10 font-medium">Belum ada postingan yang disimpan.</div>)}</div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

// --- TRENDING TAGS ---
const TrendingTags = ({ posts }) => {
    const tags = useMemo(() => { const tagCounts = {}; posts.forEach(p => { extractHashtags(p.content).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); }); return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10); }, [posts]);
    if (tags.length === 0) return null;
    return (
        <div className="mb-4 overflow-x-auto no-scrollbar py-2"><div className="flex gap-3"><div className="flex items-center gap-1 text-xs font-bold text-blue-600 whitespace-nowrap mr-2"><TrendingUp size={16}/> Trending:</div>{tags.map(([tag, count]) => ( <div key={tag} className="px-3 py-1 bg-white border border-blue-100 rounded-full text-[10px] font-bold text-slate-600 shadow-sm whitespace-nowrap flex items-center gap-1">#{tag.replace('#','')} <span className="text-blue-400 ml-1">({count})</span></div> ))}</div></div>
    );
};

// --- HOME SCREEN (FIX BUG BEKU) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper }) => {
    const [sortType, setSortType] = useState('random'); 
    const [stableFeed, setStableFeed] = useState([]);
    const [displayCount, setDisplayCount] = useState(5);
    const [loadingMore, setLoadingMore] = useState(false);
    const bottomRef = useRef(null);

    // FIX: Reaktif terhadap perubahan allPosts untuk mencegah layar kosong
    useEffect(() => {
        let basePosts = allPosts.filter(p => !p.isShort);
        let processedPosts = [];

        // Logic Sort
        if (sortType === 'latest') processedPosts = basePosts.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        else if (sortType === 'popular') processedPosts = basePosts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        else if (sortType === 'meme') processedPosts = basePosts.filter(p => p.category === 'meme').sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        else {
            // Random: Hanya shuffle jika feed kosong ATAU sortType berubah. 
            // Jika data bertambah (allPosts berubah), kita append atau refresh cerdas.
            // Untuk simplifikasi dan fix bug "blank", kita regenerate jika stableFeed kosong.
            if (stableFeed.length === 0 && basePosts.length > 0) {
                processedPosts = shuffleArray([...basePosts]);
            } else {
                // Pertahankan order lama, tapi update isinya jika ada perubahan di post itu
                processedPosts = stableFeed.map(old => basePosts.find(p => p.id === old.id)).filter(Boolean);
                
                // Jika ada post baru yang belum masuk stableFeed (misal real-time update), masukkan di atas
                const newIncoming = basePosts.filter(p => !stableFeed.find(old => old.id === p.id));
                if (newIncoming.length > 0) processedPosts = [...newIncoming, ...processedPosts];
            }
        }
        
        // Handle New Post Highlight
        if (newPostId) {
            const idx = processedPosts.findIndex(p => p.id === newPostId);
            if (idx > -1) {
                const [pinned] = processedPosts.splice(idx, 1);
                processedPosts.unshift(pinned);
            }
        }

        // Safety check: Jika hasil kosong tapi allPosts ada, paksa shuffle
        if (processedPosts.length === 0 && basePosts.length > 0) {
             processedPosts = shuffleArray([...basePosts]);
        }

        setStableFeed(processedPosts);
    }, [allPosts, sortType, newPostId]); // Dependency array penting: allPosts

    // Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting && !loadingMore && stableFeed.length > displayCount) {
                setLoadingMore(true);
                setTimeout(() => { setDisplayCount(prev => prev + 5); setLoadingMore(false); }, 500);
            }
        }, { threshold: 0.5 });
        const currentBottom = bottomRef.current;
        if (currentBottom) observer.observe(currentBottom);
        return () => { if (currentBottom) observer.unobserve(currentBottom); };
    }, [stableFeed, displayCount, loadingMore]);

    const manualRefresh = () => { setStableFeed([]); setSortType('random'); setDisplayCount(5); clearNewPost(); };
    const visiblePosts = stableFeed.slice(0, displayCount);

    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            <div className="flex items-center justify-between mb-4 pt-4 sticky top-16 z-30 bg-slate-50/90 backdrop-blur-md py-2 -mx-4 px-4 border-b border-slate-200/50">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     <button onClick={() => setSortType('latest')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='latest'?'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200':'bg-white text-slate-500 border-slate-200'}`}>Terbaru</button>
                     <button onClick={() => setSortType('popular')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200':'bg-white text-slate-500 border-slate-200'}`}>Populer</button>
                     <button onClick={() => setSortType('meme')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-amber-400 text-white border-amber-400 shadow-md shadow-amber-200':'bg-white text-slate-500 border-slate-200'}`}>😂 Meme</button>
                </div>
                <button onClick={manualRefresh} className="p-2 bg-white text-slate-500 rounded-full shadow-sm border border-slate-200 hover:rotate-180 transition duration-500"><RefreshCw size={18}/></button>
            </div>

            <TrendingTags posts={allPosts} />

            {stableFeed.length === 0 && allPosts.length === 0 ? (
                 <div className="py-10 text-center"><Loader2 className="animate-spin text-blue-500 mx-auto mb-2"/><p className="text-xs text-slate-400">Sedang memuat feed...</p></div>
            ) : visiblePosts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-slate-200"><p className="text-slate-400 font-bold">Belum ada postingan.</p></div>
            ) : (
                <>
                    {visiblePosts.map(p => (
                        <div key={p.id} className={p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                            {p.id === newPostId && <div className="bg-emerald-50 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-100 shadow-sm mx-1"><CheckCircle size={14}/> Postingan Berhasil Terkirim</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper}/>
                        </div>
                    ))}
                    <div ref={bottomRef} className="h-10 w-full flex items-center justify-center">
                        {loadingMore && <Loader2 className="animate-spin text-blue-500"/>}
                        {!loadingMore && stableFeed.length <= displayCount && stableFeed.length > 0 && <span className="text-xs text-slate-400 font-medium">-- Anda sudah mencapai ujung dunia --</span>}
                    </div>
                </>
            )}
        </div>
    );
};

// --- SHORTS SCREEN ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollow, profile }) => {
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
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 font-bold"><Film size={48} className="mb-4 opacity-50"/> <p>Belum ada video Shorts</p></div>
                ) : (
                    feed.map((p, i) => <ShortItem key={`${p.id}-${i}`} post={p} currentUserId={currentUserId} handleFollow={handleFollow} profile={profile}/>)
                )}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollow, profile }) => {
    const ref = useRef(); const vidRef = useRef();
    const [playing, setPlaying] = useState(false); const [muted, setMuted] = useState(false);
    const [showCom, setShowCom] = useState(false); const [comments, setComments] = useState([]); const [txt, setTxt] = useState('');
    const isLiked = post.likes?.includes(currentUserId); const embed = useMemo(()=>getMediaEmbed(post.mediaUrl),[post.mediaUrl]);

    useEffect(() => {
        const obs = new IntersectionObserver(e => { e.forEach(en => { setPlaying(en.isIntersecting); if(vidRef.current) { if(en.isIntersecting) vidRef.current.play().catch(()=>{}); else { vidRef.current.pause(); vidRef.current.currentTime = 0; } } }); }, {threshold: 0.6});
        if(ref.current) obs.observe(ref.current); return () => ref.current && obs.unobserve(ref.current);
    }, []);

    const toggleLike = async () => {
        const r = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) updateDoc(r, {likes:arrayRemove(currentUserId)});
        else { updateDoc(r, {likes:arrayUnion(currentUserId)}); if(post.userId!==currentUserId) sendNotification(post.userId, 'like', 'menyukai shorts Anda', profile, post.id); }
    };

    useEffect(()=>{if(showCom) return onSnapshot(query(collection(db,getPublicCollection('comments')), where('postId','==',post.id)),s=>setComments(s.docs.map(d=>d.data())))},[showCom,post.id]);

    return (
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-800">
             {embed?.type==='youtube' ? <div className="w-full h-full relative pointer-events-auto">{playing?<iframe src={`${embed.embedUrl}&autoplay=1&controls=0&loop=1`} className="w-full h-full"/>:<div className="w-full h-full bg-black"/>}<div className="absolute inset-0 bg-transparent pointer-events-none"/></div> : <video ref={vidRef} src={post.mediaUrl} className="w-full h-full object-cover" loop muted={muted} playsInline onClick={()=>setMuted(!muted)}/>}
             <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none flex flex-col justify-end p-5 pb-24">
                <div className="pointer-events-auto flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-white/50 p-0.5"><img src={post.user?.photoURL||APP_LOGO} className="w-full h-full rounded-full object-cover"/></div>
                    <div><p className="text-white font-bold text-sm drop-shadow-md">@{post.user?.username}</p><button onClick={()=>handleFollow(post.userId, false)} className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-0.5 rounded-full mt-1 hover:bg-white/40 transition">Ikuti</button></div>
                </div>
                <p className="text-white text-sm drop-shadow-md line-clamp-3 mb-2">{post.content}</p>
             </div>
             <div className="absolute right-3 bottom-28 flex flex-col gap-6 pointer-events-auto z-20">
                <button onClick={toggleLike} className="flex flex-col items-center group"><div className={`p-3 rounded-full backdrop-blur-md transition ${isLiked?'bg-rose-500/80 text-white':'bg-black/30 text-white border border-white/20'}`}><Heart size={24} fill={isLiked?'currentColor':'none'}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.likes?.length||0}</span></button>
                <button onClick={()=>setShowCom(true)} className="flex flex-col items-center"><div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20"><MessageSquare size={24}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.commentsCount||0}</span></button>
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin')}} className="flex flex-col items-center"><div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20"><Share2 size={24}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">Share</span></button>
             </div>
             {showCom && <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end pointer-events-auto"><div className="w-full h-[60%] bg-white rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom duration-300"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800">Komentar</h3><button onClick={()=>setShowCom(false)} className="bg-slate-100 p-1 rounded-full"><X size={20}/></button></div><div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">{comments.map((c,i)=><div key={i} className="text-xs text-slate-800 border-b border-slate-50 pb-2"><span className="font-bold text-blue-600 mr-2">{c.username}</span>{c.text}</div>)}</div><div className="flex gap-2 mt-2 pt-2 border-t"><input value={txt} onChange={e=>setTxt(e.target.value)} className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs outline-none" placeholder="Ketik..."/><button onClick={async()=>{if(!txt.trim())return;await addDoc(collection(db,getPublicCollection('comments')),{postId:post.id,userId:currentUserId,text:txt,username:profile.username});await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });setTxt('')}} className="text-blue-600 font-bold text-xs px-2">Kirim</button></div></div></div>}
        </div>
    );
};

// --- SEARCH SCREEN ---
const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile }) => {
    const [queryText, setQueryText] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); 
    const [tab, setTab] = useState('users');

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setSearchTerm(queryText);
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [queryText]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm || !allUsers) return [];
        const term = searchTerm.toLowerCase();
        return allUsers.filter(u => {
            if (!u || !u.username) return false;
            return u.username.toLowerCase().includes(term) && u.uid !== profile.uid;
        });
    }, [allUsers, searchTerm, profile?.uid]);

    const filteredPosts = useMemo(() => {
        if (!searchTerm || !allPosts) return [];
        const term = searchTerm.toLowerCase();
        return allPosts.filter(p => {
            const contentMatch = p.content && p.content.toLowerCase().includes(term);
            const titleMatch = p.title && p.title.toLowerCase().includes(term);
            const tagMatch = p.category && p.category.toLowerCase().includes(term); 
            return contentMatch || titleMatch || tagMatch;
        });
    }, [allPosts, searchTerm]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <Search className="text-blue-500" size={28}/> Pencarian
            </h1>
            
            <div className="relative mb-6 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="text-slate-400 group-focus-within:text-blue-500 transition duration-300" size={20}/>
                </div>
                <input 
                    value={queryText} 
                    onChange={e => setQueryText(e.target.value)} 
                    placeholder={tab === 'users' ? "Cari teman..." : "Cari postingan..."}
                    className="w-full pl-12 pr-12 py-4 bg-white rounded-2xl shadow-sm border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300 font-medium text-slate-700"
                    autoFocus
                />
                {queryText && (
                    <button onClick={() => setQueryText('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition">
                        <X size={18} className="bg-slate-100 rounded-full p-0.5"/>
                    </button>
                )}
            </div>

            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
                <button onClick={() => setTab('users')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${tab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Users size={16}/> Pengguna
                </button>
                <button onClick={() => setTab('posts')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${tab === 'posts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <FileText size={16}/> Postingan
                </button>
            </div>

            {searchTerm ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {tab === 'users' ? (
                        <div className="space-y-4">
                            {filteredUsers.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><UserPlus size={32} className="text-slate-300"/></div>
                                    <p className="text-slate-500 font-medium">Pengguna tidak ditemukan.</p>
                                </div>
                            ) : (
                                filteredUsers.map(u => {
                                    const isFollowing = (profile.following || []).includes(u.uid);
                                    return (
                                        <div key={u.uid} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-blue-100 transition duration-300">
                                            <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => goToProfile(u.uid)}>
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden">
                                                         <ImageWithRetry src={u.photoURL} className="w-full h-full object-cover" fallbackText={u.username}/>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{u.username}</h4>
                                                    <p className="text-xs text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-md inline-block mt-1">{u.followers?.length || 0} Pengikut</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleFollow(u.uid, isFollowing)} 
                                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 transform active:scale-95 ${isFollowing ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700'}`}
                                            >
                                                {isFollowing ? 'Mengikuti' : 'Ikuti'}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    ) : (
                        <div className="columns-1 gap-4 space-y-4">
                            {filteredPosts.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><Search size={32} className="text-slate-300"/></div>
                                    <p className="text-slate-500 font-medium">Tidak ada postingan yang cocok.</p>
                                </div>
                            ) : (
                                filteredPosts.map(p => (
                                    <div key={p.id} className="break-inside-avoid bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition cursor-pointer group" onClick={() => goToProfile(p.userId)}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                                <ImageWithRetry src={p.user?.photoURL} className="w-full h-full object-cover" fallbackText={p.user?.username}/>
                                            </div>
                                            <span className="font-bold text-xs text-slate-700 group-hover:text-blue-600 transition">{p.user?.username}</span>
                                            <span className="text-[10px] text-slate-400 ml-auto">{formatTimeAgo(p.timestamp).relative}</span>
                                        </div>
                                        <h4 className="font-bold text-sm text-slate-900 mb-1 line-clamp-2">{p.title || p.content}</h4>
                                        {p.mediaUrl && p.mediaType === 'image' && (
                                            <div className="mt-2 rounded-xl overflow-hidden h-32 relative">
                                                <ImageWithRetry src={p.mediaUrl} className="w-full h-full object-cover"/>
                                            </div>
                                        )}
                                        <div className="mt-3 flex items-center gap-4 text-slate-400 text-xs font-bold">
                                            <span className="flex items-center gap-1"><Heart size={12}/> {p.likes?.length || 0}</span>
                                            <span className="flex items-center gap-1"><MessageSquare size={12}/> {p.commentsCount || 0}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-10 opacity-60">
                    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Search size={40} className="text-blue-200"/>
                    </div>
                    <p className="text-slate-400 font-medium">Ketik nama teman atau topik menarik...</p>
                </div>
            )}
        </div>
    );
};

// --- SINGLE POST VIEW ---
const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    if (!post) return <div className="p-10 text-center text-slate-400 mt-20">Postingan tidak ditemukan.<br/><button onClick={handleBack} className="text-blue-600 font-bold mt-4">Kembali</button></div>;
    return (
        <div className="max-w-lg mx-auto p-4 pb-40 pt-6">
            <button onClick={handleBack} className="mb-6 flex items-center font-bold text-slate-600 hover:text-blue-600 bg-white px-4 py-2 rounded-xl shadow-sm w-fit border border-slate-200"><ArrowLeft size={18} className="mr-2"/> Kembali</button>
            <PostItem post={post} {...props}/>
            <div className="mt-8 text-center p-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-sm font-bold flex flex-col items-center justify-center gap-2"><Coffee size={24} className="opacity-50"/> Akhir dari konten</div>
        </div>
    );
};

// ==========================================
// BAGIAN 8: APP UTAMA (CORE LOGIC)
// ==========================================

const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('landing'); 
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null); 
    const [notifCount, setNotifCount] = useState(0); 
    const [newPostId, setNewPostId] = useState(null);
    const [showSplash, setShowSplash] = useState(true);
    const [showLegal, setShowLegal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isAppReady, setIsAppReady] = useState(false);

    useEffect(() => { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('firebase-messaging-sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed')); } }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [page]);
    useEffect(() => { document.documentElement.classList.remove('dark'); localStorage.removeItem('theme'); }, []);
    useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 3000); const p = new URLSearchParams(window.location.search).get('post'); if (p) setTargetPid(p); return () => clearTimeout(timer); }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
            if (u) {
                try {
                    const docRef = doc(db, getPublicCollection('userProfiles'), u.uid);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        setProfile({ ...docSnap.data(), uid: u.uid, email: u.email });
                        updateDoc(docRef, { lastSeen: serverTimestamp() }).catch(e => console.log("Silent error update lastSeen", e));
                        const data = docSnap.data();
                        if (!data.photoURL || data.followers?.length < 3) {
                           const hasSeen = localStorage.getItem('onboarding_seen');
                           if(!hasSeen) setShowOnboarding(true);
                        }
                    } else {
                        console.warn("Profil belum siap saat Auth init.");
                    }
                } catch (error) { console.error("Gagal fetch initial profile:", error); }
                setUser(u);
                requestNotificationPermission(u.uid);
            } else {
                setUser(null);
                setProfile(null);
                setIsAppReady(true);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;
        const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => {
            if (s.exists()) {
                setProfile(prev => ({ ...prev, ...s.data(), uid: user.uid, email: user.email }));
                setIsAppReady(true);
            }
        });
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            const uids = [...new Set(raw.map(r=>r.userId))];
            const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u))));
            const map = {};
            snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user})));
        });
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));
        return () => { unsubP(); unsubPosts(); unsubUsers(); unsubNotif(); };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', user.uid), where('isRead', '==', false), orderBy('timestamp', 'desc'), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const now = Date.now();
                    const notifTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
                    if (now - notifTime < 10000 && Notification.permission === "granted") { 
                         new Notification(APP_NAME, { body: `${data.fromUsername} ${data.message}`, icon: APP_LOGO });
                    }
                }
            });
        });
        return () => unsubscribe();
    }, [user]);

    const handleFollow = async (uid, isFollowing) => { if (!profile) return; const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); const targetRef = doc(db, getPublicCollection('userProfiles'), uid); try { if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } } catch (e) { console.error("Gagal update pertemanan", e); } };
    const handleGoBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); setTargetPid(null); setPage('home'); };

    if (showSplash) return <SplashScreen />;
    if (user !== undefined && user !== null && !isAppReady) {
        return (
             <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={40}/>
                <p className="text-slate-400 font-bold animate-pulse text-sm tracking-widest">MENYIAPKAN DATA...</p>
            </div>
        );
    }
    if(user===undefined) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500" size={40}/></div>;
    if(!user) { if(page==='auth') return <AuthScreen onLoginSuccess={()=>{}}/>; return <LandingPage onGetStarted={()=>setPage('auth')}/>; }
    if(!profile) return null;

    const isMeDeveloper = user.email === DEVELOPER_EMAIL;
    const targetUser = users.find(u => u.uid === targetUid);

    return (
        <div>
            <div className="min-h-screen bg-slate-50 font-sans text-slate-800 transition-colors duration-300">
                {page!=='shorts' && ( <header className="fixed top-0 w-full bg-white/70 backdrop-blur-xl h-16 flex items-center justify-between px-4 z-40 border-b border-white shadow-sm transition-colors duration-300"><div className="flex items-center gap-2" onClick={()=>setPage('home')}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-lg tracking-tighter text-slate-800">{APP_NAME}</span></div><div className="flex gap-3"><a href={WHATSAPP_CHANNEL} target="_blank" className="p-2 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 transition" title="Dukung Kami"><Gift size={20}/></a><button onClick={()=>setPage('notifications')} className="p-2 bg-white rounded-full text-slate-500 hover:text-blue-600 transition relative hover:bg-slate-100"><Bell size={20}/>{notifCount>0 && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}</button><button onClick={async()=>{await signOut(auth); setPage('landing')}} className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-600 transition hover:bg-rose-50"><LogOut size={20}/></button></div></header> )}
                <main className={page!=='shorts'?'pt-16':''}>
                    {page==='home' && <HomeScreen currentUserId={user.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper}/>}
                    {page==='shorts' && <><button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition"><ArrowLeft/></button><ShortsScreen allPosts={posts} currentUserId={user.uid} handleFollow={handleFollow} profile={profile}/></>}
                    {page==='create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage(short?'shorts':'home')}}/>}
                    {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    {page==='notifications' && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} onShowLegal={()=>setShowLegal(true)}/>}
                    {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} onShowLegal={()=>{}}/>}
                    {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper}/>}
                </main>
                {page!=='shorts' && (
                    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl px-2 py-2 shadow-2xl shadow-blue-900/10 flex items-center gap-1 z-40">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                        <button onClick={()=>setPage('create')} className="bg-blue-600 text-white p-3.5 rounded-xl shadow-lg shadow-blue-300 hover:scale-105 transition mx-2"><PlusCircle size={24}/></button>
                        <NavBtn icon={Film} active={page==='shorts'} onClick={()=>setPage('shorts')}/>
                        <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/>
                    </nav>
                )}
                
                <PWAInstallPrompt />
                {showLegal && <LegalCenter onClose={()=>setShowLegal(false)} />}
                {showOnboarding && <OnboardingOverlay onClose={()=>{setShowOnboarding(false); localStorage.setItem('onboarding_seen', 'true');}} />}
            </div>
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all duration-300 relative ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
        <Icon size={24} strokeWidth={active?2.5:2} />
        {active && <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></span>}
    </button>
);

export default App;