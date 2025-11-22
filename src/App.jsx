import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==========================================
// BAGIAN 1: IMPORT LIBRARIES & KONFIGURASI
// ==========================================

// Import Firebase Core & Services
// Pastikan library firebase sudah terinstall di project (npm install firebase)
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

// IMPORT KHUSUS NOTIFIKASI (Messaging)
// Gunakan try-catch saat inisialisasi agar tidak error di browser lama
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Import Icons (Lucide React) - Lengkap
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
    RefreshCw, Info, Clock, Star, ExternalLink, Gamepad2, BookOpen, Users, Globe,
    CheckCircle, Sparkles, Zap, ShieldCheck, MoreHorizontal, ShieldAlert, Trash,
    BarChart3, Activity, Gift, Eye, RotateCw, Megaphone, Trophy, Laugh, Moon, Sun,
    Award, Crown, Gem, Medal, Bookmark, Coffee, Smile, Frown, Meh, CloudRain, SunMedium, 
    Hash, Tag, Wifi, Smartphone, Radio // <-- Radio & Smartphone untuk Icon PWA
} from 'lucide-react';

// Atur Log Level Firebase (Supaya tidak berisik di console saat development)
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const PASSWORD_RESET_LINK = "https://forms.gle/cAWaoPMDkffg6fa89";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- KUNCI VAPID (WAJIB DIISI DARI FIREBASE CONSOLE) ---
// Ganti string di bawah dengan Key pair yang kamu generate di langkah 1 (Firebase Console -> Project Settings -> Cloud Messaging)
const VAPID_KEY = "BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE"; 

// --- KONFIGURASI FIREBASE ---
// Menggunakan konfigurasi environment jika tersedia, atau fallback ke config default
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

// Inisialisasi App
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const getPublicCollection = (collectionName) => `artifacts/${appId}/public/data/${collectionName}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Inisialisasi Messaging (Dengan Safely Check)
let messaging = null;
try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
    }
} catch (e) {
    console.log("Messaging not supported (mungkin bukan HTTPS atau browser lama)");
}

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

// 1. Fungsi Request Izin & Simpan Token (JANTUNGNYA NOTIFIKASI)
const requestNotificationPermission = async (userId) => {
    if (!messaging || !userId) return;
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Dapatkan Token Unik HP ini
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                // Simpan token ke database user agar server bisa mengirim pesan nanti
                const userRef = doc(db, getPublicCollection('userProfiles'), userId);
                // Kita pakai arrayUnion agar 1 user bisa punya banyak HP (Token)
                await updateDoc(userRef, { 
                    fcmTokens: arrayUnion(token),
                    lastTokenUpdate: serverTimestamp()
                });
                console.log("Token Push Notifikasi tersimpan:", token);
            }
        }
    } catch (error) {
        console.error("Gagal request notifikasi:", error);
    }
};

// 2. Algoritma Acak (Fisher-Yates Shuffle)
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

// 3. Sistem Notifikasi (Database)
const sendNotification = async (toUserId, type, message, fromUser, postId = null) => {
    // Mencegah notifikasi spam ke diri sendiri
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    
    try {
        // Simpan ke Notifikasi di App (Lonceng)
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId,
            fromUserId: fromUser.uid,
            fromUsername: fromUser.username,
            fromPhoto: fromUser.photoURL || '',
            type: type, // 'like', 'comment', 'follow', 'system', 'bookmark'
            message: message,
            postId: postId,
            isRead: false,
            timestamp: serverTimestamp()
        });
    } catch (error) { 
        console.error("Gagal mengirim notifikasi:", error); 
    }
};

// 4. Upload API (Faa API)
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    
    // Reset progress
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        // Simulasi progress awal
        for (let i = 0; i <= 50; i += 5) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        onProgress(80);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        onProgress(100);
        
        if (data && data.status) {
            return data.url;
        } else {
            throw new Error(data.message || 'Gagal mengunggah file. Respon tidak valid.');
        }
    } catch (error) {
        onProgress(0); 
        console.error('Upload error:', error);
        throw new Error('Gagal mengunggah. Koneksi bermasalah atau file terlalu besar.');
    }
};

// 5. Formatter Waktu (Relative Time)
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const fullDate = date.toLocaleDateString('id-ID', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    if (seconds > 86400) return { relative: fullDate, full: fullDate };
    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes} menit lalu`, full: fullDate };
    
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam lalu`, full: fullDate };
};

// 6. Detektor Media Embed (YouTube / TikTok / IG)
const getMediaEmbed = (url) => {
    if (!url) return null;
    
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { 
            type: 'youtube', 
            embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, 
            id: youtubeMatch[1] 
        };
    }
    
    if (url.includes('tiktok.com') || url.includes('instagram.com')) {
        return { 
            type: 'link', 
            embedUrl: url, 
            displayUrl: url 
        };
    }
    return null;
};

// 7. Kalkulator Reputasi & Badge
const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

// 8. Ekstraktor Hashtag (Untuk Trending)
const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g);
    return matches ? matches : [];
};

// 9. Cek Online Status (Berdasarkan Last Seen)
const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diff = Date.now() - last.getTime();
    return diff < 10 * 60 * 1000; // Online jika aktif dalam 10 menit terakhir
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL
// ==========================================

// --- KOMPONEN BARU: INSTALL PWA PROMPT ---
// Ini akan memunculkan banner di bawah jika web belum diinstall
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Mencegah Chrome menampilkan banner default
            e.preventDefault();
            // Simpan event agar bisa dipanggil nanti
            setDeferredPrompt(e);
            // Tampilkan banner custom kita
            setShowBanner(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        // Munculkan prompt asli browser
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowBanner(false);
        }
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-sky-500 p-2 rounded-xl"><Smartphone size={24}/></div>
                <div>
                    <h4 className="font-bold text-sm">Install {APP_NAME}</h4>
                    <p className="text-xs text-gray-400">Akses lebih cepat & Notifikasi</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setShowBanner(false)} className="p-2 text-gray-400 hover:text-white"><X size={18}/></button>
                <button onClick={handleInstall} className="bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-sky-600">Install</button>
            </div>
        </div>
    );
};

// Komponen Gambar dengan Indikator Loading & Retry
const ImageWithRetry = ({ src, alt, className }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);

    const handleRetry = (e) => {
        e.stopPropagation();
        setError(false);
        setLoading(true);
        setRetryCount(prev => prev + 1);
    };

    // Force reload dengan query param timestamp
    const displaySrc = retryCount > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}` : src;

    if (error) {
        return (
            <div className={`bg-gray-100 flex flex-col items-center justify-center text-gray-500 ${className}`} style={{minHeight: '200px'}}>
                <ImageIcon size={32} className="mb-2 opacity-50"/>
                <p className="text-xs mb-2">Gagal memuat gambar</p>
                <button 
                    onClick={handleRetry} 
                    className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-gray-50 transition text-gray-800"
                >
                    <RotateCw size={12}/> Coba Lagi
                </button>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {loading && (
                <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
                    <Loader2 className="animate-spin text-gray-400" size={24}/>
                </div>
            )}
            <img 
                src={displaySrc} 
                alt={alt} 
                className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                onLoad={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
            />
        </div>
    );
};

// Komponen Splash Screen
const SplashScreen = () => {
    const quotes = [
        "Menghubungkan ke dunia...", 
        "Membangun komunitas positif...", 
        "Berbagi cerita, berbagi inspirasi...", 
        "Siapkan konten terbaikmu..."
    ];
    const [quote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-sky-50 to-white z-[100] flex flex-col items-center justify-center">
            <div className="relative mb-8 animate-bounce-slow">
                <img src={APP_LOGO} className="w-32 h-32 object-contain drop-shadow-2xl"/>
                <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-3xl font-black text-sky-600 mb-2 tracking-widest">{APP_NAME}</h1>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-sky-500 animate-progress-indeterminate"></div>
            </div>
            <p className="text-gray-400 text-xs font-medium animate-pulse">{quote}</p>
        </div>
    );
};

// Komponen Skeleton Loading
const SkeletonPost = () => (
    <div className="bg-white rounded-[2rem] p-5 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-gray-200"></div>
            <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/4"></div>
            </div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="space-y-2 mb-4">
            <div className="h-3 bg-gray-100 rounded w-full"></div>
            <div className="h-3 bg-gray-100 rounded w-2/3"></div>
        </div>
        <div className="h-48 bg-gray-200 rounded-2xl mb-4"></div>
        <div className="flex gap-4">
            <div className="h-8 w-16 bg-gray-100 rounded-full"></div>
            <div className="h-8 w-16 bg-gray-100 rounded-full"></div>
        </div>
    </div>
);

// --- FORMAT TEKS LANJUTAN ---
const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text;

    // Sanitasi
    html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 

    // Format Link Custom
    html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g, 
        '<a href="$2" target="_blank" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1" onClick="event.stopPropagation()">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>'
    );

    // Auto Detect HTTPS
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g, 
        (match) => {
            if (match.includes('href="')) return match;
            return `<a href="${match}" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">${match}</a>`;
        }
    );

    // Format Style
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-sky-50 px-1 rounded text-sm text-sky-700 font-mono border border-sky-100">$1</code>');
    html = html.replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>'); 
    html = html.replace(/\n/g, '<br>');

    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
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
            const usersSnap = await new Promise(resolve => {
                const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => {
                    resolve(snap);
                    unsub();
                });
            });

            const postsSnap = await new Promise(resolve => {
                const unsub = onSnapshot(collection(db, getPublicCollection('posts')), (snap) => {
                    resolve(snap);
                    unsub();
                });
            });

            const totalUsers = usersSnap.size;
            const totalPosts = postsSnap.size;
            
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const rawPosts = postsSnap.docs.map(d => d.data());
            const postsToday = rawPosts.filter(p => p.timestamp?.toMillis && p.timestamp.toMillis() >= todayStart).length;

            const tenMinAgo = Date.now() - 10 * 60 * 1000;
            const active = usersSnap.docs.map(d => ({id: d.id, ...d.data()}))
                .filter(u => u.lastSeen?.toMillis && u.lastSeen.toMillis() > tenMinAgo);

            const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); 
                d.setDate(d.getDate() - i);
                const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                const dayEnd = dayStart + 86400000;
                const count = rawPosts.filter(p => {
                    const t = p.timestamp?.toMillis ? p.timestamp.toMillis() : 0;
                    return t >= dayStart && t < dayEnd;
                }).length;
                last7Days.push({ day: days[d.getDay()], count, height: Math.min(count * 10 + 10, 100) });
            }

            setStats({ users: totalUsers, posts: totalPosts, postsToday });
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
            const usersSnap = await new Promise(resolve => {
                const unsub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => { resolve(s); unsub(); });
            });
            
            const promises = usersSnap.docs.map(docSnap => {
                return addDoc(collection(db, getPublicCollection('notifications')), {
                    toUserId: docSnap.id,
                    fromUserId: 'admin',
                    fromUsername: 'Developer System',
                    fromPhoto: APP_LOGO,
                    type: 'system',
                    message: `📢 PENGUMUMAN: ${broadcastMsg}`,
                    isRead: false,
                    timestamp: serverTimestamp()
                });
            });
            
            await Promise.all(promises);
            alert("Pengumuman berhasil dikirim!");
            setBroadcastMsg('');
        } catch(e) {
            alert("Gagal kirim broadcast: " + e.message);
        } finally {
            setSendingBC(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <ShieldCheck className="text-sky-600"/> Developer Panel
                    </h2>
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow hover:bg-gray-200">
                        <X/>
                    </button>
                </div>

                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-sky-600"/></div> : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100 text-center">
                                <Users className="mx-auto text-sky-500 mb-2"/>
                                <h3 className="text-2xl font-bold text-gray-800">{stats.users}</h3>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total User</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 text-center">
                                <ImageIcon className="mx-auto text-purple-500 mb-2"/>
                                <h3 className="text-2xl font-bold text-gray-800">{stats.posts}</h3>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total Post</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 text-center">
                                <Activity className="mx-auto text-emerald-500 mb-2"/>
                                <h3 className="text-2xl font-bold text-gray-800">{stats.postsToday}</h3>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Post Hari Ini</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman
                            </h3>
                            <textarea 
                                value={broadcastMsg} 
                                onChange={e=>setBroadcastMsg(e.target.value)} 
                                className="w-full bg-gray-50 p-3 rounded-xl text-sm border border-gray-200 mb-3 outline-none"
                                rows="3" 
                                placeholder="Tulis pesan untuk semua user..."
                            />
                            <button 
                                onClick={handleBroadcast} 
                                disabled={sendingBC} 
                                className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full disabled:opacity-50 hover:bg-orange-600 transition"
                            >
                                {sendingBC ? 'Mengirim...' : 'Kirim ke Semua'}
                            </button>
                        </div>

                        {/* --- PWA TOOL UNTUK TEST (NOtifikasi Manual) --- */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Radio size={18} className="text-blue-500"/> Push Notification Check
                            </h3>
                            <button 
                                onClick={async () => {
                                    if (!("Notification" in window)) { 
                                        alert("Browser ini tidak support notifikasi."); 
                                        return; 
                                    }
                                    
                                    const permission = await Notification.requestPermission();
                                    
                                    if (permission === "granted") { 
                                        new Notification("Tes Lokal", { 
                                            body: "Ini tes notifikasi lokal dari tombol.", 
                                            icon: APP_LOGO 
                                        });
                                    } else { 
                                        alert("Izin notifikasi ditolak oleh user."); 
                                    }
                                }} 
                                className="w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition"
                            >
                                Tes Izin & Notif Lokal
                            </button>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <BarChart3 size={18}/> Aktivitas Minggu Ini
                            </h3>
                            <div className="flex items-end justify-between h-32 gap-2">
                                {chartData.map((d, i) => (
                                    <div key={i} className="flex flex-col items-center w-full group">
                                        <div className="text-xs font-bold text-sky-600 mb-1 opacity-0 group-hover:opacity-100 transition">{d.count}</div>
                                        <div 
                                            className="w-full bg-sky-100 rounded-t-lg hover:bg-sky-300 transition-all relative" 
                                            style={{height: `${d.height}%`}}
                                        ></div>
                                        <div className="text-[10px] text-gray-400 mt-2 font-bold">{d.day}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Globe size={18}/> Pengguna Online ({onlineUsers.length})
                            </h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                                {onlineUsers.length === 0 ? (
                                    <p className="text-gray-400 text-sm">Tidak ada user aktif saat ini.</p>
                                ) : (
                                    onlineUsers.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-sky-200 rounded-full flex items-center justify-center font-bold text-sky-700">{u.username?.[0]}</div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{u.username}</p>
                                                    <p className="text-[10px] text-gray-500">{u.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded-full">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Online
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR OTENTIKASI & LANDING
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
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // Update lastSeen
                const ref = doc(db, getPublicCollection('userProfiles'), userCredential.user.uid);
                const snap = await getDoc(ref);
                if(!snap.exists()) {
                    await setDoc(ref, { 
                        username: email.split('@')[0], email: email, createdAt: serverTimestamp(), 
                        uid: userCredential.user.uid, photoURL: '', following: [], followers: [], lastSeen: serverTimestamp() 
                    });
                } else {
                    await updateDoc(ref, { lastSeen: serverTimestamp() });
                }
            } else {
                if (!username.trim()) throw new Error("Username wajib diisi");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, getPublicCollection('userProfiles'), userCredential.user.uid), { 
                    username: username.trim(), email: email, createdAt: serverTimestamp(), 
                    uid: userCredential.user.uid, photoURL: '', following: [], followers: [], lastSeen: serverTimestamp(),
                    savedPosts: [], mood: '' 
                });
            }
            onLoginSuccess();
        } catch (err) {
            let msg = "Gagal. Periksa data Anda.";
            if (err.code === 'auth/wrong-password') msg = "Kata sandi salah.";
            if (err.code === 'auth/user-not-found') msg = "Akun tidak ditemukan.";
            if (err.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar.";
            setError(msg);
        } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-white p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400"></div>
                
                <div className="text-center mb-8 mt-2">
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight mb-1">
                        {isLogin ? 'Selamat Datang' : 'Buat Akun'}
                    </h2>
                    <p className="text-gray-400 text-sm">Masuk ke dunia {APP_NAME}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center font-medium border border-red-100">
                        <AlertTriangle size={14} className="mr-2 flex-shrink-0"/>{error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && (
                        <div className="group relative">
                            <User size={18} className="absolute left-4 top-3.5 text-gray-400"/>
                            <input 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                placeholder="Username Unik" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                            />
                        </div>
                    )}
                    <div className="group relative">
                        <Mail size={18} className="absolute left-4 top-3.5 text-gray-400"/>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="Alamat Email" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                        />
                    </div>
                    <div className="group relative">
                        <Lock size={18} className="absolute left-4 top-3.5 text-gray-400"/>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="Kata Sandi" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                        />
                    </div>
                    
                    <button disabled={isLoading} className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-800 shadow-lg shadow-gray-200 transition transform active:scale-95 disabled:opacity-70">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk Akun' : 'Daftar Gratis')}
                    </button>
                </form>

                <div className="mt-6 text-center pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-4">
                        {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} 
                        <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="font-bold text-sky-600 hover:underline ml-1">
                            {isLogin ? 'Daftar' : 'Masuk'}
                        </button>
                    </p>
                    {isLogin && (
                        <a href={PASSWORD_RESET_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-xs font-bold hover:bg-sky-100 transition">
                            <HelpCircle size={14} className="mr-2"/> Lupa Kata Sandi?
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center px-6 py-12 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            <div className="relative z-10 text-center w-full max-w-md">
                <div className="bg-white/60 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-[2.5rem] p-8 transform hover:scale-[1.01] transition duration-500">
                    <div className="relative inline-block mb-6">
                        <img src={APP_LOGO} alt="Logo" className="w-28 h-28 mx-auto drop-shadow-md object-contain" />
                        <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white">V22.2 (Stable)</div>
                    </div>
                    
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-purple-600 mb-3 tracking-tight">{APP_NAME}</h1>
                    <p className="text-gray-600 font-medium mb-8 leading-relaxed">Jejaring sosial serbaguna. Kini dengan dukungan Notifikasi & PWA! 📲</p>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-indigo-100 transition"><Gamepad2 size={24} className="mb-1"/><span className="text-[10px] font-bold uppercase tracking-wide">Gamers</span></div>
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-emerald-100 transition"><BookOpen size={24} className="mb-1"/><span className="text-[10px] font-bold uppercase tracking-wide">Edukasi</span></div>
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-rose-100 transition"><Users size={24} className="mb-1"/><span className="text-[10px] font-bold uppercase tracking-wide">Sosial</span></div>
                        <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-amber-100 transition"><Globe size={24} className="mb-1"/><span className="text-[10px] font-bold uppercase tracking-wide">Global</span></div>
                    </div>

                    <button onClick={onGetStarted} className="w-full py-4 bg-gradient-to-r from-sky-500 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-200 hover:shadow-xl transform active:scale-95 transition-all flex items-center justify-center group">
                        Mulai Sekarang <ChevronRight className="ml-2 group-hover:translate-x-1 transition"/>
                    </button>
                </div>

                <div className="mt-8 bg-white/40 backdrop-blur-md border border-white/40 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/60 transition shadow-sm cursor-default">
                    <div className="relative">
                        <img src={DEV_PHOTO} className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover" alt="Developer"/>
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"><Check size={10} className="text-white absolute top-0.5 left-0.5"/></div>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5">Developed By</p>
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1">M. Irham Andika Putra <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/></h3>
                        <p className="text-xs text-gray-500">Siswa SMP Negeri 3 Mentok • 14 Tahun</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 6: KOMPONEN UTAMA APLIKASI
// ==========================================

// --- POST ITEM (LENGKAP) ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isMeDeveloper }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    
    // Fitur Bookmark
    const [isSaved, setIsSaved] = useState(profile.savedPosts?.includes(post.id));
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [showHeartOverlay, setShowHeartOverlay] = useState(false);

    const isOwner = post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; 
    const isMeme = post.category === 'meme';

    // LOGIKA BARU: Cek status pertemanan yang akurat
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

    const handleDoubleTap = () => {
        setShowHeartOverlay(true);
        setTimeout(() => setShowHeartOverlay(false), 800);
        if (!liked) { handleLike(); }
    };

    const handleSave = async () => {
        const newSaved = !isSaved;
        setIsSaved(newSaved);
        const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
        try {
            if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } 
            else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); }
        } catch (error) { setIsSaved(!newSaved); }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), {
                postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() 
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        if (confirm(isMeDeveloper && !isOwner ? "⚠️ ADMIN: Hapus postingan orang lain?" : "Hapus postingan ini?")) {
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
        }
    };

    const handleDeleteComment = async (commentId) => {
        if(confirm("Hapus komentar?")) {
            await deleteDoc(doc(db, getPublicCollection('comments'), commentId));
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(-1) });
        }
    };

    const handleUpdatePost = async () => {
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent });
        setIsEditing(false);
    };

    const sharePost = async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin!'); } catch (e) { alert('Gagal menyalin link'); }
    };

    useEffect(() => {
        if (!showComments) return;
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        return onSnapshot(q, s => {
            setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0)));
        });
    }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !embed;
    const isImage = (post.mediaUrl && (/\.(jpg|png|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !embed;
    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden group transition hover:shadow-lg">
            {post.isShort && <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md z-10 flex items-center"><Zap size={10} className="mr-1 text-yellow-400"/> SHORT</div>}
            {!post.isShort && likeCount > 10 && <div className="absolute top-4 right-4 bg-orange-100 text-orange-600 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-200 flex items-center z-10"><Flame size={10} className="mr-1"/> TRENDING</div>}
            {isMeme && !post.isShort && <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-200 flex items-center z-10"><Laugh size={10} className="mr-1"/> MEME</div>}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            {post.user?.photoURL ? <ImageWithRetry src={post.user.photoURL} alt="User" className="w-full h-full object-cover"/> : <span className="font-bold text-sky-600">{post.user?.username?.[0]}</span>}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">{post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                            {isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    {!isOwner && post.userId !== currentUserId && (
                        <button 
                            onClick={() => handleFollow(post.userId, isFollowing)} 
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                                isFriend 
                                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' // Berteman (Hijau)
                                    : isFollowing 
                                        ? 'bg-gray-100 text-gray-500' // Cuma Follow (Abu)
                                        : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md' // Belum Follow (Biru)
                            }`}
                        >
                            {isFriend ? <><UserCheck size={12}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}
                    {(isOwner || isMeDeveloper) && (
                        <>
                            {isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-sky-600 rounded-full"><Edit size={16}/></button>}
                            <button onClick={handleDelete} className={`p-2 rounded-full ${isMeDeveloper && !isOwner ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-red-600'}`}>
                                {isMeDeveloper && !isOwner ? <ShieldAlert size={16}/> : <Trash2 size={16}/>}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold text-sm"/>
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full p-2 bg-white border rounded-lg text-sm resize-none" rows="4"/>
                    <div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-1">Batal</button><button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button></div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
                    <div className="text-sm text-gray-600 mb-4 leading-relaxed">
                        {renderMarkdown(displayText)}
                        {isLongText && <button onClick={() => setIsExpanded(!isExpanded)} className="text-sky-600 font-bold text-xs ml-1 hover:underline inline-block mt-1">{isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</button>}
                    </div>
                    {(isImage || isVideo || embed) && (
                        <div className="mb-4 rounded-2xl overflow-hidden bg-black/5 border border-gray-100 relative select-none" onDoubleClick={handleDoubleTap}>
                            {showHeartOverlay && <div className="absolute inset-0 z-20 flex items-center justify-center animate-in zoom-in-50 fade-out duration-700"><Heart size={100} className="text-white drop-shadow-2xl fill-white" /></div>}
                            {isImage && <ImageWithRetry src={post.mediaUrl} className="w-full max-h-[500px] object-cover cursor-pointer"/>}
                            {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black"/>}
                            {embed?.type === 'youtube' && <div className="aspect-video"><iframe src={embed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>}
                            {embed?.type === 'link' && <a href={embed.displayUrl} target="_blank" rel="noopener noreferrer" className="block p-6 text-center bg-sky-50 text-sky-600 font-bold text-sm hover:underline">Buka Tautan Eksternal <ExternalLink size={14} className="inline ml-1"/></a>}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}><Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={22}/> {post.commentsCount || 0}</button>
                <button onClick={sharePost} className="text-gray-400 hover:text-sky-500"><Share2 size={22}/></button>
                <button onClick={handleSave} className={`ml-auto transition ${isSaved ? 'text-sky-500' : 'text-gray-400 hover:text-gray-600'}`}><Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} /></button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">
                        {comments.length === 0 ? <p className="text-xs text-center text-gray-400">Belum ada komentar.</p> : comments.map(c => (
                            <div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs flex justify-between items-start group">
                                <div><span className="font-bold text-gray-800 mr-1">{c.username}</span><span className="text-gray-600">{c.text}</span></div>
                                {(currentUserId === c.userId || isMeDeveloper) && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">{isMeDeveloper && currentUserId !== c.userId ? <ShieldAlert size={12}/> : <Trash size={12}/>}</button>}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleComment} className="flex gap-2 relative"><input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200"/><button type="submit" disabled={!newComment.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50"><Send size={14}/></button></form>
                </div>
            )}
        </div>
    );
};

// --- TRENDING HASHTAGS (FITUR V19) ---
const TrendingTags = ({ posts }) => {
    const tags = useMemo(() => {
        const tagCounts = {};
        posts.forEach(p => {
            const extracted = extractHashtags(p.content);
            extracted.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [posts]);

    if (tags.length === 0) return null;

    return (
        <div className="mb-4 overflow-x-auto no-scrollbar py-2">
            <div className="flex gap-3">
                <div className="flex items-center gap-1 text-xs font-bold text-sky-600 whitespace-nowrap mr-2">
                    <TrendingUp size={16}/> Trending:
                </div>
                {tags.map(([tag, count]) => (
                    <div key={tag} className="px-3 py-1 bg-white border border-sky-100 rounded-full text-[10px] font-bold text-gray-600 shadow-sm whitespace-nowrap flex items-center gap-1">
                        <Hash size={10} className="text-sky-500"/> {tag.replace('#','')} <span className="text-sky-400 ml-1">({count})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 7. HOME SCREEN (AUTO SCROLL INFINITE) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost, isMeDeveloper }) => {
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
            <div className="flex items-center justify-between mb-4 pt-4 sticky top-16 z-30 bg-[#F0F4F8]/90 backdrop-blur-md py-2 -mx-4 px-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     <button onClick={() => setSortType('latest')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='latest'?'bg-sky-500 text-white':'bg-white text-gray-500'}`}>Terbaru</button>
                     <button onClick={() => setSortType('popular')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='popular'?'bg-purple-500 text-white':'bg-white text-gray-500'}`}>Populer</button>
                     <button onClick={() => setSortType('meme')} className={`px-4 py-2 rounded-full text-xs font-bold transition border whitespace-nowrap ${sortType==='meme'?'bg-yellow-400 text-white border-yellow-400':'bg-white text-gray-500'}`}>😂 Meme</button>
                </div>
                <button onClick={manualRefresh} className="p-2 bg-white text-gray-500 rounded-full shadow-sm hover:rotate-180 transition duration-500"><RefreshCw size={20}/></button>
            </div>

            {/* FITUR BARU: TRENDING TAGS */}
            <TrendingTags posts={allPosts} />

            {loadingFeed ? <><SkeletonPost/><SkeletonPost/></> : visiblePosts.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200"><p className="text-gray-400 font-bold">Belum ada postingan.</p></div>
            ) : (
                <>
                    {visiblePosts.map(p => (
                        <div key={p.id} className={p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                            {p.id === newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-1"><CheckCircle size={14}/> Postingan Berhasil Terkirim</div>}
                            <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile.email} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile} isMeDeveloper={isMeDeveloper}/>
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
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 font-bold"><Film size={48} className="mb-4 opacity-50"/> <p>Belum ada video Shorts</p></div>
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
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center overflow-hidden border-b border-gray-800">
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
             {showCom && <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end pointer-events-auto"><div className="w-full h-[60%] bg-white rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom duration-300"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">Komentar</h3><button onClick={()=>setShowCom(false)} className="bg-gray-100 p-1 rounded-full"><X size={20}/></button></div><div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">{comments.map((c,i)=><div key={i} className="text-xs text-gray-800 border-b border-gray-50 pb-2"><span className="font-bold text-sky-600 mr-2">{c.username}</span>{c.text}</div>)}</div><div className="flex gap-2 mt-2 pt-2 border-t"><input value={txt} onChange={e=>setTxt(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-xs outline-none" placeholder="Ketik..."/><button onClick={async()=>{if(!txt.trim())return;await addDoc(collection(db,getPublicCollection('comments')),{postId:post.id,userId:currentUserId,text:txt,username:profile.username});await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });setTxt('')}} className="text-sky-600 font-bold text-xs px-2">Kirim</button></div></div></div>}
        </div>
    );
};

// --- 9. CREATE POST ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null, url: '', isShort: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0); const [isLarge, setIsLarge] = useState(false);

    const insertLink = () => { setForm({ ...form, content: form.content + " [Judul Link](https://...)" }); };
    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let finalUrl = form.url, type = 'text';
            if(form.file) { finalUrl = await uploadToFaaAPI(form.file, setProg); type = form.file.type.startsWith('image')?'image':'video'; }
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
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 relative overflow-hidden mt-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-purple-400"></div>
                <h2 className="text-xl font-black text-gray-800 mb-6">Buat Postingan Baru</h2>
                <form onSubmit={submit} className="space-y-4">
                    {loading && <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul Menarik..." className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 transition"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu... (Gunakan #meme untuk kategori meme)" rows="4" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    <div className="flex gap-2 text-xs"><button type="button" onClick={()=>setForm({...form, content: form.content + "**Tebal**"})} className="bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">B</button><button type="button" onClick={()=>setForm({...form, content: form.content + "*Miring*"})} className="bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">I</button><button type="button" onClick={insertLink} className="bg-sky-100 text-sky-600 px-2 py-1 rounded hover:bg-sky-200 flex items-center gap-1"><LinkIcon size={10}/> Link</button></div>
                    {isLarge && <div className="bg-orange-50 text-orange-600 text-xs p-3 rounded-xl flex items-center font-medium"><AlertTriangle size={14} className="mr-2"/> File besar detected. Upload mungkin lama.</div>}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.file?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 text-gray-500'}`}><ImageIcon size={18} className="mr-2"/><span className="text-xs font-bold">{form.file?'Ganti File':'Foto/Video'}</span><input type="file" className="hidden" accept="image/*,video/*" onChange={e=>{const f=e.target.files[0]; if(f) {setForm({...form, file:f, isShort: f.type.startsWith('video')}); setIsLarge(f.size > 25*1024*1024);}}} disabled={loading}/></label>
                        <div onClick={()=>setForm({...form, isShort:!form.isShort})} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap transition ${form.isShort?'bg-black text-white border-black':'border-gray-200 text-gray-500'}`}><Zap size={18} className="mr-2"/><span className="text-xs font-bold">Mode Shorts</span></div>
                    </div>
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, file:null, isShort: e.target.value.includes('shorts')})} placeholder="Atau Link Video (YouTube)..." className="w-full pl-10 py-3 bg-gray-50 rounded-xl text-xs outline-none"/></div>
                    <button disabled={loading || (!form.content && !form.file && !form.url)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
            </div>
        </div>
    );
};

// --- 10. PROFILE (LEVELING SYSTEM + MOOD + FIX STATS) ---
// PERBAIKAN V20: Menerima 'viewerProfile' (Yang melihat) dan 'profileData' (Yang dilihat)
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow }) => {
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username); 
    const [file, setFile] = useState(null); 
    const [load, setLoad] = useState(false);
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); 
    const [mood, setMood] = useState(profileData.mood || '');
    const [isEditingMood, setIsEditingMood] = useState(false);

    const isSelf = viewerProfile.uid === profileData.uid; // Cek apakah ini profil sendiri
    const isDev = profileData.email === DEVELOPER_EMAIL;

    // DATA YANG DITAMPILKAN (REAL DARI PROFILE DATA)
    const userPosts = allPosts.filter(p=>p.userId===profileData.uid).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    
    // PERBAIKAN STATISTIK (V20 Fix)
    const followersCount = (profileData.followers || []).length;
    const followingCount = (profileData.following || []).length;
    
    // Hitung Teman (Mutual di profil target)
    const targetFollowers = profileData.followers || [];
    const targetFollowing = profileData.following || [];
    const friendsCount = targetFollowing.filter(id => targetFollowers.includes(id)).length;

    const save = async () => { 
        setLoad(true); 
        try { 
            const url = file ? await uploadToFaaAPI(file, ()=>{}) : profileData.photoURL; 
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:url, username:name}); 
            setEdit(false); 
        } catch(e){alert(e.message)} finally{setLoad(false)}; 
    };

    const saveMood = async () => {
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { mood: mood });
            setIsEditingMood(false);
        } catch(e) { console.error(e); }
    };

    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);

    // Logika Tombol Follow (Berdasarkan viewerProfile)
    const isFollowing = (viewerProfile.following || []).includes(profileData.uid); 
    const isFollowedByTarget = (viewerProfile.followers || []).includes(profileData.uid);
    const isFriend = isFollowing && isFollowedByTarget; 

    // Bonus: Indikator Online
    const isOnline = isUserOnline(profileData.lastSeen);

    // Saved posts hanya ditampilkan jika profil sendiri (Privasi)
    const savedPostsData = isSelf ? allPosts.filter(p => viewerProfile.savedPosts?.includes(p.id)) : [];

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-50 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8">
                    <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg bg-gray-100 ${isOnline ? 'border-emerald-400' : 'border-white'}`}>
                        {profileData.photoURL ? <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-sky-500 text-3xl font-bold">{profileData.username?.[0]}</div>}
                    </div>
                    {/* Indikator Online (Bulatan) */}
                    <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    
                    {isSelf && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}
                </div>

                {edit ? (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl animate-in fade-in">
                        <input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold bg-transparent"/>
                        <input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs"/>
                        <button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'...':'Simpan'}</button>
                    </div> 
                ) : (
                    <>
                        <h1 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1>
                        
                        {/* STATUS MOOD */}
                        {isSelf ? (
                            isEditingMood ? (
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <input value={mood} onChange={e=>setMood(e.target.value)} placeholder="Status Mood..." className="text-xs p-1 border rounded text-center w-32"/>
                                    <button onClick={saveMood} className="text-green-500"><Check size={14}/></button>
                                </div>
                            ) : (
                                <div onClick={()=>setIsEditingMood(true)} className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-sky-500 flex items-center justify-center gap-1">
                                    {profileData.mood ? `"${profileData.mood}"` : "+ Pasang Status"} <Edit size={10} className="opacity-50"/>
                                </div>
                            )
                        ) : (
                            profileData.mood && <p className="text-sm text-gray-500 mt-1 italic">"{profileData.mood}"</p>
                        )}
                    </>
                )}
                
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label} (Reputasi: {totalLikes})</div>
                
                {!isSelf && (
                    <button 
                        onClick={()=>handleFollow(profileData.uid, isFollowing)} 
                        className={`w-full mb-2 px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${
                            isFriend 
                                ? 'bg-emerald-500 text-white shadow-emerald-200' 
                                : isFollowing 
                                    ? 'bg-gray-200 text-gray-600' 
                                    : 'bg-sky-500 text-white shadow-sky-200'
                        }`}
                    >
                        {isFriend ? <><UserCheck size={16}/> Berteman</> : isFollowing ? 'Mengikuti' : 'Ikuti'}
                    </button>
                )}
                
                {isDev && isSelf && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 shadow-lg"><ShieldCheck size={16}/> Dashboard Developer</button>}
                
                {/* STATISTIK YANG BENAR SESUAI PROFILE DATA */}
                <div className="flex justify-center gap-6 mt-6 border-t pt-6">
                    <div><span className="font-bold text-xl block">{followersCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div>
                    <div><span className="font-bold text-xl block">{followingCount}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div>
                    <div><span className="font-bold text-xl block text-emerald-600">{friendsCount}</span><span className="text-[10px] text-emerald-600 font-bold uppercase">Teman</span></div>
                </div>
            </div>
            
            {isSelf && (
                <div className="flex gap-2 px-4 mb-6">
                    <button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-gray-500'}`}>Postingan Saya</button>
                    <button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white text-gray-500'}`}>Disimpan</button>
                </div>
            )}

            <div className="px-4 space-y-6">
                {activeTab === 'posts' ? (userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>)
                ) : ( savedPostsData.length > 0 ? savedPostsData.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}}/>) : <div className="text-center text-gray-400 py-10">Belum ada postingan yang disimpan.</div>)}
            </div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile }) => {
    const [term, setTerm] = useState(''); const [tab, setTab] = useState('posts');
    const posts = allPosts.filter(p=>p.content?.toLowerCase().includes(term.toLowerCase()) || p.title?.toLowerCase().includes(term.toLowerCase()));
    const users = allUsers.filter(u=>u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid!==profile.uid);
    
    const checkStatus = (targetUid) => {
        const isFollowing = (profile.following || []).includes(targetUid);
        const isFriend = isFollowing && (profile.followers || []).includes(targetUid);
        return { isFollowing, isFriend };
    };

    return <div className="max-w-lg mx-auto p-4 pb-24"><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari..." className="w-full p-3 bg-white rounded-xl border mb-4 outline-none focus:ring-2 focus:ring-sky-200"/><div className="flex gap-2 mb-4"><button onClick={()=>setTab('posts')} className={`flex-1 py-2 rounded-lg font-bold transition ${tab==='posts'?'bg-sky-500 text-white':'bg-white text-gray-500'}`}>Postingan</button><button onClick={()=>setTab('users')} className={`flex-1 py-2 rounded-lg font-bold transition ${tab==='users'?'bg-sky-500 text-white':'bg-white text-gray-500'}`}>Pengguna</button></div>{term.length<2?<div className="text-center py-20 text-gray-400">Ketik minimal 2 huruf</div>:(tab==='posts'?posts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile}/>):users.map(u=>{
        const status = checkStatus(u.uid);
        return <div key={u.uid} className="flex justify-between p-4 bg-white rounded-xl mb-2 shadow-sm"><div className="font-bold cursor-pointer flex items-center gap-2" onClick={()=>goToProfile(u.uid)}><div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sky-600">{u.username[0]}</div>{u.username}</div><button onClick={()=>handleFollow(u.uid, status.isFollowing)} className={`text-xs px-3 py-1.5 rounded-full font-bold ${status.isFriend ? 'bg-emerald-100 text-emerald-600' : status.isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-sky-100 text-sky-600'}`}>{status.isFriend?'Berteman':status.isFollowing?'Mengikuti':'Ikuti'}</button></div>
    }))}</div>;
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

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    const handleBack = () => { const url = new URL(window.location); url.searchParams.delete('post'); window.history.pushState({}, '', url); goBack(); };
    if (!post) return <div className="p-10 text-center text-gray-400 mt-20">Postingan hilang.<br/><button onClick={handleBack} className="text-sky-600 font-bold mt-4">Kembali</button></div>;
    return (
        <div className="max-w-lg mx-auto p-4 pb-40 pt-6">
            <button onClick={handleBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white px-4 py-2 rounded-xl shadow-sm w-fit">
                <ArrowLeft size={18} className="mr-2"/> Kembali
            </button>
            <PostItem post={post} {...props}/>
            <div className="mt-8 text-center p-6 bg-gray-50 rounded-2xl border border-gray-200 text-gray-400 text-sm font-bold flex flex-col items-center justify-center gap-2">
                <Coffee size={24} className="opacity-50"/>
                Gaada lagi postingan di bawah
            </div>
        </div>
    );
};

// --- 11. APP UTAMA (LOGIKA FIXED) ---
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

    // --- PWA SERVICE WORKER REGISTRATION ---
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Gunakan file SW baru untuk notifikasi
            navigator.serviceWorker.register('firebase-messaging-sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.log('SW failed', err));
        }
    }, []);

    useEffect(() => { window.scrollTo(0, 0); }, [page]);
    useEffect(() => { document.documentElement.classList.remove('dark'); localStorage.removeItem('theme'); }, []);
    useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 3000); const p = new URLSearchParams(window.location.search).get('post'); if (p) setTargetPid(p); return () => clearTimeout(timer); }, []);

    useEffect(() => onAuthStateChanged(auth, u => { 
        if(u) { 
            setUser(u); 
            updateDoc(doc(db, getPublicCollection('userProfiles'), u.uid), { lastSeen: serverTimestamp() }).catch(()=>{}); 
            
            // PANGGIL FUNGSI REQUEST NOTIFIKASI SAAT LOGIN
            requestNotificationPermission(u.uid);
        } 
        else { setUser(null); setProfile(null); } 
    }), []);
    
    useEffect(() => {
        if(!user) return;
        if(page==='landing' || page==='auth') setPage(targetPid ? 'view_post' : 'home');
        
        const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => s.exists() ? setProfile({...s.data(), uid:user.uid, email:user.email}) : setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {username:user.email.split('@')[0], email:user.email, uid:user.uid, following:[], followers:[], photoURL:'', lastSeen: serverTimestamp(), savedPosts: []}));
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            const uids = [...new Set(raw.map(r=>r.userId))];
            const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u))));
            const map = {}; snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user})));
        });
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));
        return () => { unsubP(); unsubPosts(); unsubUsers(); unsubNotif(); };
    }, [user]);

    const handleFollow = async (uid, isFollowing) => {
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
                sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); 
            }
        } catch (e) { console.error("Gagal update pertemanan", e); }
    };

    const handleGoBack = () => {
        const url = new URL(window.location);
        url.searchParams.delete('post');
        window.history.pushState({}, '', url);
        setTargetPid(null);
        setPage('home');
    };

    if (showSplash) return <SplashScreen />;
    if(user===undefined) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;
    if(!user) { if(page==='auth') return <AuthScreen onLoginSuccess={()=>{}}/>; return <LandingPage onGetStarted={()=>setPage('auth')}/>; }
    if(!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500"/></div>;

    const isMeDeveloper = user.email === DEVELOPER_EMAIL;
    
    // FIX: Pastikan targetUser ada saat membuka profil orang lain
    const targetUser = users.find(u => u.uid === targetUid);

    return (
        <div>
            <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800 transition-colors duration-300">
                {page!=='shorts' && (
                    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-white/50 shadow-sm transition-colors duration-300">
                        <div className="flex items-center gap-2" onClick={()=>setPage('home')}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span></div>
                        <div className="flex gap-3">
                            <a href={WHATSAPP_CHANNEL} target="_blank" className="p-2 bg-emerald-50 text-emerald-600 rounded-full shadow-sm hover:bg-emerald-100 transition" title="Dukung Kami"><Gift size={20}/></a>
                            <button onClick={()=>setPage('notifications')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative"><Bell size={20}/>{notifCount>0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
                            <button onClick={async()=>{await signOut(auth); setPage('landing')}} className="p-2 bg-white rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition"><LogOut size={20}/></button>
                        </div>
                    </header>
                )}
                <main className={page!=='shorts'?'pt-16':''}>
                    {page==='home' && <HomeScreen currentUserId={user.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} isMeDeveloper={isMeDeveloper}/>}
                    {page==='shorts' && <><button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition"><ArrowLeft/></button><ShortsScreen allPosts={posts} currentUserId={user.uid} handleFollow={handleFollow} profile={profile}/></>}
                    {page==='create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage(short?'shorts':'home')}}/>}
                    {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    {page==='notifications' && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                    
                    {/* LOGIKA PROFILE DIPERBAIKI DISINI */}
                    {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} />}
                    {page==='other-profile' && targetUser && <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} />}
                    
                    {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} goBack={handleGoBack} currentUserId={user.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} isMeDeveloper={isMeDeveloper}/>}
                </main>
                {page!=='shorts' && <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40"><NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/><NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/><button onClick={()=>setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button><NavBtn icon={Film} active={page==='shorts'} onClick={()=>setPage('shorts')}/><NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/></nav>}
                
                {/* KOMPONEN INSTALL PWA */}
                <PWAInstallPrompt />
            </div>
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;