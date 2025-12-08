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
    Scale, FileText, ChevronLeft, CornerDownRight, Video, MessageCircle, MessageSquareText
} from 'lucide-react';

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i150/VrL65.png";
const VAPID_KEY = "BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE"; 

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
      authDomain: "eduku-web.firebaseapp.com",
      projectId: "eduku-web",
      storageBucket: "eduku-web.firebasestorage.com",
      messagingSenderId: "662463693471",
      appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
      measurementId: "G-G0VWNHHVB8"
    };
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// Mengubah path ke koleksi publik yang benar
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

// 2. Kompresi Gambar ke Base64 (Untuk Foto)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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
                // Menggunakan format gambar dan kualitas yang lebih baik untuk hasil akhir
                const dataUrl = canvas.toDataURL('image/webp', 0.85); // Mengganti ke webp untuk kompresi lebih baik
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// 3. Upload File API (Untuk Video & Audio)
const uploadFileToAPI = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        // Menggunakan API pihak ketiga untuk mendapatkan URL publik
        const response = await fetch("https://api-faa.my.id/faa/tourl", {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`Gagal upload ke API. Status: ${response.status}`);
        
        const data = await response.json();
        // Mencari URL dari berbagai kemungkinan struktur response
        const url = data.url || data.result || data.data?.url || data.link;
        
        if (!url) throw new Error("URL tidak ditemukan dalam response API");
        return url;
    } catch (error) {
        console.error("API Upload Error:", error);
        throw error;
    }
};

// 4. Algoritma Acak (Shuffle)
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
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const fullDate = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (seconds > 86400) return { relative: fullDate, full: fullDate };
    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes} mnt lalu`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam lalu`, full: fullDate };
};

// 7. Detektor Media Embed
const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] }; }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) { return { type: 'link', embedUrl: url, displayUrl: url }; }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) { return { type: 'audio_file', url: url }; }
    return null;
};

// 8. Kalkulator Reputasi
const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEV", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "STAR", icon: Gem, color: "bg-purple-500 text-white" };
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
    const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diff = Date.now() - last.getTime();
    return diff < 10 * 60 * 1000; 
};

// ==========================================
// BAGIAN 3: KOMPONEN UI KECIL (DIPERTAHANKAN)
// ==========================================

const ImageWithRetry = ({ src, alt, className, onClick }) => {
    const [error, setError] = useState(false);
    if (error) return <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 ${className}`}><ImageIcon size={20}/></div>;
    return (
        <img 
            src={src} 
            alt={alt} 
            className={className}
            onClick={onClick}
            onError={() => setError(true)}
            loading="lazy"
        />
    );
};

// --- LIGHTBOX (FULLSCREEN IMAGE VIEWER) ---
const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 z-50"><X size={24}/></button>
            <div className="flex-1 w-full flex items-center justify-center relative">
                {images.length > 1 && <button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length)}} className="absolute left-2 p-2 text-white bg-black/50 rounded-full"><ChevronLeft/></button>}
                <ImageWithRetry src={images[index]} className="max-w-full max-h-screen object-contain"/>
                {images.length > 1 && <button onClick={(e) => {e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length)}} className="absolute right-2 p-2 text-white bg-black/50 rounded-full"><ChevronRight/></button>}
            </div>
        </div>
    );
};

// --- AUDIO PLAYER (FITUR BARU) ---
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
                <div className="flex items-center gap-1 text-xs font-bold text-sky-400 mb-1"><Music size={12}/> Audio Player</div>
                <audio ref={audioRef} src={src} className="w-full h-6 opacity-80" controls onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}/>
            </div>
        </div>
    );
};

// --- MEDIA GRID SYSTEM (FOTO GRID - FITUR BARU) ---
const MediaGrid = ({ mediaUrls, onImageClick }) => {
    const count = mediaUrls.length;
    if (count === 0) return null;

    return (
        <div className={`grid gap-1 mb-4 rounded-2xl overflow-hidden ${count === 1 ? 'grid-cols-1 aspect-video' : count === 2 ? 'grid-cols-2 aspect-video' : 'grid-cols-2 aspect-square'}`}>
            {mediaUrls.slice(0, 4).map((url, i) => (
                <div key={i} className={`relative w-full h-full cursor-pointer hover:opacity-90 transition ${count === 3 && i === 0 ? 'col-span-2 row-span-2' : ''}`} onClick={() => onImageClick(i)}>
                    <ImageWithRetry src={url} className="w-full h-full object-cover"/>
                    {i === 3 && count > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-2xl">
                            +{count - 4}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// --- RENDER MARKDOWN WITH HASHTAG CLICK (MEMPERBAIKI FORMAT TEKS) ---
const RenderMarkdown = ({ text, onHashtagClick }) => {
    if (!text) return null;
    
    // 1. Split text by special delimiters (URLs, **bold**, *italic*, #hashtags)
    const parts = text.split(/((?:#\w+)|(?:\*\*([^*]+)\*\*)|(?:\*([^*]+)\*)|(?:https?:\/\/[^\s]+))/g).filter(Boolean);

    return (
        <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Teks Tebal
                    return <strong key={i}>{part.substring(2, part.length - 2)}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    // Teks Miring
                    return <em key={i}>{part.substring(1, part.length - 1)}</em>;
                }
                if (part.startsWith('#')) {
                    // Hashtag
                    return (
                        <span key={i} onClick={(e) => { e.stopPropagation(); onHashtagClick(part); }} className="text-sky-500 font-bold cursor-pointer hover:underline">
                            {part}
                        </span>
                    );
                }
                if (part.match(/^https?:\/\//)) {
                    // URL
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline break-all" onClick={e=>e.stopPropagation()}>{part}</a>;
                }
                // Teks Biasa
                return part;
            })}
        </div>
    );
};

// --- NAVIGATION BUTTON (ASLI) ---
const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}>
        <Icon size={24}/>
    </button>
);

// ==========================================
// BAGIAN 4: DASHBOARD & AUTH (DIPERTAHANKAN)
// ==========================================

const DeveloperDashboard = ({ onClose }) => {
    const [msg, setMsg] = useState('');
    const sendBC = async () => {
        if(!confirm('Kirim Broadcast Message?')) return;
        alert('Fitur BC Dummy Terkirim');
    };
    return (
        <div className="fixed inset-0 bg-white z-[60] p-6 dark:bg-gray-900">
            <h2 className="font-black text-2xl mb-4 dark:text-white">Dev Dashboard</h2>
            <textarea className="border w-full p-3 mb-2 dark:bg-gray-700 dark:border-gray-600 rounded-xl" rows="5" onChange={e=>setMsg(e.target.value)} placeholder="Pesan Broadcast..."></textarea>
            <button onClick={sendBC} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700">Kirim BC (Dummy)</button>
            <button onClick={onClose} className="mt-4 text-red-500 block">Tutup</button>
        </div>
    );
};

const AuthModal = ({ onClose }) => {
    const handleGoogleLogin = async () => {
        try { await signInWithPopup(auth, googleProvider); onClose(); } catch (error) { alert("Login Gagal: " + error.message); }
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"><X/></button>
                <img src={APP_LOGO} className="w-16 h-16 mx-auto mb-4 rounded-full shadow-md"/>
                <h2 className="font-black text-xl mb-2 dark:text-white">Masuk ke {APP_NAME}</h2>
                <p className="text-sm text-gray-500 mb-6">Bergabunglah untuk berinteraksi dan berkontribusi!</p>
                <button onClick={handleGoogleLogin} className="w-full bg-white border border-gray-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/> Login Dengan Google
                </button>
            </div>
        </div>
    );
};

// --- PWA INSTALL PROMPT (ASLI) ---
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('PWA installed');
                }
                setDeferredPrompt(null);
                setVisible(false);
            });
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 p-4 bg-sky-500 text-white rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between gap-4">
                <p className="font-bold">Pasang {APP_NAME} di layar Anda!</p>
                <button onClick={handleInstall} className="bg-white text-sky-500 px-4 py-1 rounded-full font-bold">Instal</button>
                <button onClick={()=>setVisible(false)} className="text-white opacity-70 hover:opacity-100"><X size={18}/></button>
            </div>
        </div>
    );
};

// --- ONBOARDING (ASLI) ---
const OnboardingScreen = ({ user, onComplete }) => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState(user.displayName || 'Anonim');
    const [loading, setLoading] = useState(false);

    const completeOnboarding = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {
                username: username, 
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL,
                onboarded: true,
                reputation: 0,
                createdAt: serverTimestamp(),
                followers: [],
                following: []
            }, {merge: true});
            onComplete();
        } catch(e) {
            alert("Gagal menyimpan profil: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-[80] p-6 flex flex-col items-center justify-center dark:bg-gray-900">
            <div className="max-w-md w-full text-center">
                <h1 className="text-3xl font-black mb-4 dark:text-white">Selamat Datang di {APP_NAME}</h1>
                {step === 1 && (
                    <div className="animate-in fade-in">
                        <UserCheck size={80} className="text-sky-500 mx-auto my-8"/>
                        <p className="text-lg mb-6 text-gray-600 dark:text-gray-300">Mari kita siapkan profil Anda dalam beberapa langkah cepat.</p>
                        <button onClick={() => setStep(2)} className="w-full py-3 bg-sky-500 text-white rounded-xl font-bold shadow-lg">Mulai</button>
                    </div>
                )}
                {step === 2 && (
                    <div className="animate-in fade-in">
                        <Edit size={80} className="text-purple-500 mx-auto my-8"/>
                        <p className="text-lg mb-4 dark:text-gray-300">Pilih Nama Pengguna Anda:</p>
                        <input 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nama Pengguna"
                            className="w-full p-3 mb-6 border rounded-xl text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <button onClick={completeOnboarding} disabled={loading} className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Selesai & Masuk'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 5: LAYAR & KOMPONEN UTAMA
// ==========================================

// --- POST ITEM (FITUR BARU) ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, isGuest, onRequestLogin, onHashtagClick }) => {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // { id, username, userId }
    
    // Lightbox
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const isOwner = currentUserId && post.userId === currentUserId;
    const isDev = post.user?.email === DEVELOPER_EMAIL;
    // Menggunakan mediaUrls untuk mendukung multiple image/video API upload
    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);

    useEffect(() => {
        if (currentUserId) setLiked(post.likes?.includes(currentUserId));
        else setLiked(false);
        setLikeCount(post.likes?.length || 0);
    }, [post, currentUserId]);

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
        } catch (error) { setLiked(!newLiked); }
    };

    const handleComment = async (e) => {
        e.preventDefault(); 
        if (isGuest) { onRequestLogin(); return; }
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { 
                postId: post.id, 
                userId: currentUserId, 
                text: newComment, 
                username: profile.username, 
                timestamp: serverTimestamp(),
                // Logic Balasan Baru
                parentId: replyingTo ? replyingTo.id : null,
                replyToUsername: replyingTo ? replyingTo.username : null,
                replyToUserId: replyingTo ? replyingTo.userId : null
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            
            // Kirim notifikasi ke pemilik post atau pengguna yang dibalas
            if (post.userId !== currentUserId && (!replyingTo || replyingTo.userId !== post.userId)) {
                sendNotification(post.userId, 'comment', `berkomentar: "${newComment.substring(0, 25)}..."`, profile, post.id);
            } else if (replyingTo && replyingTo.userId !== currentUserId) {
                 sendNotification(replyingTo.userId, 'reply', `membalas komentar Anda: "${newComment.substring(0, 25)}..."`, profile, post.id);
            }
            
            setNewComment('');
            setReplyingTo(null);
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        if(confirm("Hapus postingan ini? Tindakan ini tidak dapat diurungkan.")) await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
    };

    const sharePost = async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Postingan Disalin!'); } catch (e) { alert('Gagal copy link'); }
    };

    // Listener Komentar (Memuat balasan)
    useEffect(() => { 
        if (!showComments) return; 
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id), orderBy('timestamp', 'asc')); 
        return onSnapshot(q, s => { 
            const loaded = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setComments(loaded);
        }); 
    }, [showComments, post.id]);

    const embed = getMediaEmbed(post.mediaUrl);
    const isAudio = post.mediaType === 'audio' || embed?.type === 'audio_file';
    const isVideo = post.mediaType === 'video' || (post.mediaUrl && post.mediaUrl.match(/\.(mp4|webm)$/i));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
            {/* Header Post */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <ImageWithRetry src={post.user?.photoURL || APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200 object-cover"/>
                    <div>
                        <h4 className="font-bold text-sm dark:text-white flex items-center gap-1">
                            {post.user?.username} 
                            {isDev && <ShieldCheck size={14} className="text-blue-500"/>}
                        </h4>
                        <span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                    </div>
                </div>
                {(isOwner || isDev) && (
                    <button onClick={handleDelete} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                )}
            </div>

            {/* Content Text (Dengan Hashtag Click & Format Teks) */}
            <div className="mb-3">
                {post.title && <h3 className="font-bold text-lg mb-1 dark:text-white">{post.title}</h3>}
                <RenderMarkdown text={post.content} onHashtagClick={onHashtagClick} />
            </div>

            {/* Media Content */}
            <div className="mb-3">
                {isAudio && <AudioPlayer src={post.mediaUrl} />}
                {isVideo && !embed && <video src={post.mediaUrl} controls className="w-full rounded-xl bg-black max-h-[400px]" />}
                {embed?.type === 'youtube' && <div className="aspect-video rounded-xl overflow-hidden"><iframe src={embed.embedUrl} className="w-full h-full" allowFullScreen></iframe></div>}
                
                {/* Image Grid System */}
                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <MediaGrid mediaUrls={mediaList} onImageClick={(i) => { setLightboxIndex(i); setLightboxOpen(true); }} />
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6 pt-3 border-t dark:border-gray-700">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold ${liked ? 'text-rose-500' : 'text-gray-400'}`}>
                    <Heart size={20} fill={liked ? 'currentColor' : 'none'}/> {likeCount}
                </button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <MessageSquareText size={20}/> {post.commentsCount || 0}
                </button>
                <button onClick={sharePost} className="flex items-center gap-2 text-sm font-bold text-gray-400 ml-auto">
                    <Share2 size={20}/> Bagikan
                </button>
            </div>

            {/* Comments Section with Replies (FITUR BARU) */}
            {showComments && (
                <div className="mt-4 animate-in fade-in">
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        {comments.length === 0 ? <p className="text-center text-xs text-gray-400">Belum ada komentar.</p> : 
                            comments.map(c => (
                                <div key={c.id} className={`flex gap-2 ${c.parentId ? 'ml-8 relative' : ''}`}>
                                    {c.parentId && <CornerDownRight size={14} className="text-gray-300 absolute -left-4 top-2"/>}
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-2xl flex-1 text-xs">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold dark:text-white mr-2">{c.username}</span>
                                            {currentUserId && (
                                                <button onClick={() => setReplyingTo({id: c.id, username: c.username, userId: c.userId})} className="text-[10px] text-sky-500 font-bold hover:underline">Balas</button>
                                            )}
                                        </div>
                                        <p className="dark:text-gray-200 mt-1">
                                            {c.replyToUsername && <span className="text-sky-500 font-bold mr-1">@{c.replyToUsername}</span>}
                                            {c.text}
                                        </p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    
                    {/* Input Komentar */}
                    <form onSubmit={handleComment} className="relative">
                        {replyingTo && (
                            <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-900 px-3 py-1 rounded-t-xl text-[10px] text-sky-600 dark:text-sky-300 border border-sky-100 dark:border-sky-800">
                                <span>Membalas <b>{replyingTo.username}</b></span>
                                <button type="button" onClick={() => setReplyingTo(null)}><X size={12}/></button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input 
                                value={newComment} 
                                onChange={(e) => setNewComment(e.target.value)} 
                                placeholder={isGuest ? "Login untuk komen..." : replyingTo ? `Tulis balasan untuk ${replyingTo.username}...` : "Tulis komentar..."}
                                disabled={isGuest}
                                className={`flex-1 bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2 text-sm outline-none ${replyingTo ? 'rounded-tl-none' : ''}`}
                            />
                            <button type="submit" disabled={isGuest || !newComment.trim()} className="bg-sky-500 text-white p-3 rounded-xl hover:bg-sky-600 disabled:opacity-50 transition"><Send size={16}/></button>
                        </div>
                    </form>
                </div>
            )}
            
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
        </div>
    );
};

// --- CREATE POST (DENGAN API UPLOAD VIDEO/AUDIO - FITUR BARU) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', files: [], url: '' });
    const [loading, setLoading] = useState(false); 
    const [uploadType, setUploadType] = useState('none'); // none, image, video, audio

    const handleFile = (e, type) => {
        const selectedFiles = Array.from(e.target.files);
        if (type !== 'image' && selectedFiles.length > 1) {
            alert('Hanya satu file video atau audio yang dapat diunggah per postingan.');
            return;
        }
        setForm({...form, files: selectedFiles});
        setUploadType(type);
    };

    const submit = async (e) => {
        e.preventDefault(); 
        if(!form.content.trim() && form.files.length === 0) {
            alert("Konten tidak boleh kosong.");
            return;
        }

        setLoading(true);
        try {
            let mediaUrls = [];
            let mediaType = 'text';

            if (form.files.length > 0) {
                if (uploadType === 'image') {
                    mediaType = 'image';
                    for (let file of form.files) {
                        const base64 = await compressImageToBase64(file);
                        mediaUrls.push(base64);
                    }
                } else if (uploadType === 'video' || uploadType === 'audio') {
                    // Gunakan API Tourl untuk Video/Audio
                    const url = await uploadFileToAPI(form.files[0]);
                    mediaUrls.push(url);
                    mediaType = uploadType;
                }
            }

            const category = extractHashtags(form.content).length > 0 ? 'tagged' : 'general';

            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, 
                title: form.title, 
                content: form.content, 
                mediaUrls: mediaUrls, 
                mediaUrl: mediaUrls[0] || '', // Pertahankan untuk kompatibilitas lama
                mediaType: mediaType, 
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                category: category, 
                user: {username, uid: userId, photoURL: auth.currentUser.photoURL || APP_LOGO}
            });
            onSuccess();
        } catch(e) { 
            alert("Gagal posting: " + e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-sky-50 dark:border-gray-700">
                <h2 className="text-xl font-black mb-6 dark:text-white">Buat Postingan Baru</h2>
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)..." className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl font-bold text-sm outline-none dark:text-white"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang Anda pikirkan? Gunakan #hashtag, **tebal**, atau *miring*..." rows="4" className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm outline-none resize-none dark:text-white"/>
                    
                    {/* File Upload Selector */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 border-t pt-4 dark:border-gray-700">
                        <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap text-sm font-bold ${uploadType==='image'?'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/50 dark:border-sky-700 dark:text-sky-300':'border-gray-200 dark:border-gray-600 text-gray-500'}`}>
                            <ImageIcon size={18}/> Foto
                            <input type="file" hidden accept="image/*" multiple onChange={(e)=>handleFile(e, 'image')}/>
                        </label>
                        <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap text-sm font-bold ${uploadType==='video'?'bg-pink-50 border-pink-200 text-pink-600 dark:bg-pink-900/50 dark:border-pink-700 dark:text-pink-300':'border-gray-200 dark:border-gray-600 text-gray-500'}`}>
                            <Video size={18}/> Video
                            <input type="file" hidden accept="video/*" onChange={(e)=>handleFile(e, 'video')}/>
                        </label>
                        <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap text-sm font-bold ${uploadType==='audio'?'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-300':'border-gray-200 dark:border-gray-600 text-gray-500'}`}>
                            <Music size={18}/> Audio
                            <input type="file" hidden accept="audio/*" onChange={(e)=>handleFile(e, 'audio')}/>
                        </label>
                    </div>

                    {form.files.length > 0 && (
                        <div className="text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/50 dark:text-sky-300 p-2 rounded-lg text-center">
                            {form.files.length} file {uploadType} dipilih siap upload.
                        </div>
                    )}

                    <button disabled={loading || (!form.content.trim() && form.files.length === 0)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg hover:bg-sky-600 disabled:opacity-50 transition">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Posting Sekarang'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- HOME SCREEN (FEED - DENGAN FILTER HASHTAG BARU) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, filterHashtag, clearFilter, isGuest, onRequestLogin }) => {
    // Logika memfilter post berdasarkan Hashtag jika ada
    const displayPosts = useMemo(() => {
        let filtered = allPosts.sort((a,b) => (b.timestamp?.toMillis||0) - (a.timestamp?.toMillis||0));
        if (filterHashtag) {
            // Filter post yang mengandung hashtag yang sama (case insensitive)
            const tagToSearch = filterHashtag.toLowerCase();
            filtered = filtered.filter(p => p.content && p.content.toLowerCase().includes(tagToSearch));
        }
        return filtered;
    }, [allPosts, filterHashtag]);

    return (
        <div className="max-w-lg mx-auto pb-24 px-4 pt-4">
            {filterHashtag && (
                // Tombol X sekarang memanggil clearFilter yang diset sebagai fungsi yang mengosongkan filter hashtag
                <div className="bg-sky-500 text-white p-4 rounded-2xl mb-6 flex justify-between items-center shadow-lg animate-in fade-in">
                    <div>
                        <p className="text-xs opacity-80">Menampilkan hasil untuk:</p>
                        <h2 className="font-black text-xl">{filterHashtag}</h2>
                    </div>
                    <button onClick={clearFilter} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X/></button>
                </div>
            )}

            {displayPosts.length === 0 ? (
                <div className="text-center py-20 text-gray-400">Tidak ada postingan.</div>
            ) : (
                displayPosts.map(p => (
                    <PostItem 
                        key={p.id} 
                        post={p} 
                        currentUserId={currentUserId} 
                        profile={profile} 
                        handleFollow={handleFollow} 
                        goToProfile={goToProfile} 
                        isGuest={isGuest} 
                        onRequestLogin={onRequestLogin}
                        onHashtagClick={clearFilter} // Menggunakan clearFilter untuk SET filter
                    />
                ))
            )}
        </div>
    );
};

// --- PROFILE SCREEN (ASLI) ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, isGuest }) => {
    // Gunakan user posts
    const userPosts = allPosts.filter(p => p.userId === profileData.uid);
    const isSelf = viewerProfile && viewerProfile.uid === profileData.uid;

    const badge = getReputationBadge(profileData.reputation || 0, profileData.email === DEVELOPER_EMAIL);
    
    return (
        <div className="max-w-lg mx-auto pb-24 pt-6 px-4">
            <div className="text-center mb-8 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-md border dark:border-gray-700">
                <ImageWithRetry src={profileData.photoURL || APP_LOGO} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-sky-100 dark:border-gray-700 shadow-lg object-cover"/>
                <h1 className="text-2xl font-black dark:text-white flex items-center justify-center gap-2">
                    {profileData.username}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                        <badge.icon size={12} className="inline mr-1"/>{badge.label}
                    </span>
                </h1>
                <p className="text-gray-500 text-sm mb-4">{profileData.email}</p>
                
                <div className="flex justify-center gap-6 mb-6">
                    <div className="text-center">
                        <span className="font-bold block text-lg dark:text-white">{profileData.followers?.length || 0}</span>
                        <span className="text-[10px] text-gray-400 uppercase">Pengikut</span>
                    </div>
                    <div className="text-center">
                        <span className="font-bold block text-lg dark:text-white">{profileData.following?.length || 0}</span>
                        <span className="text-[10px] text-gray-400 uppercase">Mengikuti</span>
                    </div>
                    <div className="text-center">
                        <span className="font-bold block text-lg dark:text-white">{profileData.reputation || 0}</span>
                        <span className="text-[10px] text-gray-400 uppercase">Reputasi</span>
                    </div>
                </div>

                {!isSelf && (
                    <button onClick={() => isGuest ? onRequestLogin() : handleFollow(profileData.uid, (viewerProfile.following||[]).includes(profileData.uid))} className="bg-sky-500 text-white px-8 py-2 rounded-full font-bold shadow-lg hover:bg-sky-600 transition">
                        {(viewerProfile?.following||[]).includes(profileData.uid) ? 'Mengikuti' : 'Ikuti'}
                    </button>
                )}
                {isSelf && (
                    <p className="text-xs text-gray-400 mt-2">Ini adalah profil Anda.</p>
                )}
            </div>
            
            <h2 className="text-xl font-bold mb-4 dark:text-white">Postingan Saya ({userPosts.length})</h2>
            <div className="space-y-4">
                {userPosts.map(p => (
                    <PostItem key={p.id} post={p} currentUserId={viewerProfile?.uid} profile={viewerProfile} handleFollow={handleFollow} goToProfile={()=>{}} isGuest={isGuest} onRequestLogin={()=>alert('Login')} onHashtagClick={()=>{}}/>
                ))}
            </div>
        </div>
    );
};

// --- SINGLE POST VIEW (DEEP LINKING BARU) ---
const SinglePostView = ({ postId, allPosts, goBack, currentUserId, profile, isGuest, onRequestLogin, onHashtagClick }) => {
    const post = allPosts.find(p => p.id === postId);
    
    if (!post) return <div className="h-screen flex items-center justify-center text-gray-400">Memuat Postingan...</div>;
    
    return (
        <div className="max-w-lg mx-auto p-4 pt-6 pb-24">
            <button onClick={goBack} className="mb-4 flex items-center gap-2 font-bold text-gray-500 hover:text-sky-500 dark:text-gray-400 dark:hover:text-sky-400 transition"><ArrowLeft size={16}/> Kembali ke Feed</button>
            <PostItem 
                post={post} 
                currentUserId={currentUserId} 
                profile={profile} 
                isGuest={isGuest} 
                onRequestLogin={onRequestLogin} 
                onHashtagClick={onHashtagClick} 
                goToProfile={()=>{}} 
                handleFollow={()=>{}}
            />
        </div>
    );
};

// --- SCREEN PLACEHOLDERS (ASLI, DIPERTAHANKAN) ---
const PlaceholderScreen = ({ title, icon: Icon }) => (
    <div className="h-screen flex flex-col items-center justify-center text-gray-400 pt-16">
        <Icon size={48} className="mb-4"/>
        <h2 className="text-xl font-bold dark:text-gray-300">{title}</h2>
        <p className="text-sm">Fitur ini masih dalam tahap pengembangan.</p>
    </div>
);

const SearchScreen = () => <PlaceholderScreen title="Pencarian" icon={Search} />;
const ShortsScreen = () => <PlaceholderScreen title="Shorts/Video Pendek" icon={Film} />;
const LeaderboardScreen = () => <PlaceholderScreen title="Papan Peringkat" icon={Trophy} />;
const NotificationScreen = () => <PlaceholderScreen title="Notifikasi" icon={Bell} />;
const MessagesScreen = () => <PlaceholderScreen title="Pesan Pribadi" icon={MessageCircle} />;
const GameCenter = () => <PlaceholderScreen title="Pusat Game" icon={Gamepad2} />;


// ==========================================
// BAGIAN 6: APP UTAMA (DIPERBAIKI)
// ==========================================

const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]); 
    const [hashtagFilter, setHashtagFilter] = useState(null); // Filter Hashtag Baru
    const [targetUid, setTargetUid] = useState(null);
    const [targetPostId, setTargetPostId] = useState(null); // Deep Link Baru

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false); // Onboarding Asli
    const [showDev, setShowDev] = useState(false); // Dev Dashboard Asli
    const [darkMode, setDarkMode] = useState(false);

    // Dark Mode Init
    useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') { document.documentElement.classList.add('dark'); setDarkMode(true); }
    }, []);

    const toggleDark = () => {
        if (darkMode) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
        else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
        setDarkMode(!darkMode);
    };

    // Deep Linking Handler (Jalan untuk Guest & User)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pid = urlParams.get('post');
        if (pid) {
            setTargetPostId(pid);
            setPage('view_post');
        } else {
            // Kembali ke page normal jika URL bersih, tapi hanya jika bukan view_post
            if (page === 'view_post') setPage('home'); 
        }
    }, [page]);

    // Auth Listener
    useEffect(() => onAuthStateChanged(auth, async (u) => { 
        if(u) { 
            setUser(u);
            const userDoc = await getDoc(doc(db, getPublicCollection('userProfiles'), u.uid));
            if (!userDoc.exists() || !userDoc.data().onboarded) {
                 setShowOnboarding(true);
            }
        } else { setUser(null); setProfile(null); } 
    }), []);

    // Profile Data Listener
    useEffect(() => { 
        if(user && !showOnboarding) { 
            const unsub = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => {
                const data = s.data();
                if(data?.onboarded === true) {
                    setProfile({...data, uid:user.uid});
                    requestNotificationPermission(user.uid); // Request Notif
                } else {
                    setShowOnboarding(true);
                }
            });
            return () => unsub();
        }
    }, [user, showOnboarding]);

    // Data Listeners
    useEffect(() => {
        // Load Posts (Global - Guest can see)
        const unsub = onSnapshot(collection(db, getPublicCollection('posts')), s => {
            const raw = s.docs.map(d=>({id:d.id, ...d.data()}));
            setPosts(raw);
        });
        return () => unsub();
    }, []);

    const handleFollow = async (uid, isFollowing) => {
        if (!user) { setShowAuthModal(true); return; }
        const meRef = doc(db, getPublicCollection('userProfiles'), user.uid);
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid);
        const batch = writeBatch(db);

        if(isFollowing) {
            batch.update(meRef, {following: arrayRemove(uid)});
            batch.update(targetRef, {followers: arrayRemove(user.uid)});
        } else {
            batch.update(meRef, {following: arrayUnion(uid)});
            batch.update(targetRef, {followers: arrayUnion(user.uid)});
            sendNotification(uid, 'follow', 'mulai mengikuti Anda.', profile);
        }
        try {
            await batch.commit();
        } catch(e) {
            console.error("Gagal follow/unfollow:", e);
        }
    };

    // Fungsi untuk menetapkan Hashtag Filter (Baru)
    const handleHashtag = (tag) => {
        // Jika tag yang diklik adalah tag yang sedang aktif, kosongkan.
        // Jika tag yang diklik berbeda, set tag baru.
        // MEMPERBAIKI BUG SILANG: Saat mengklik silang (yang memanggil clearFilter), argumen 'tag' yang diterima adalah null
        setHashtagFilter(tag); 
        setPage('home');
        window.scrollTo(0,0);
    };
    
    // Fungsi untuk kembali dari Single Post View (Baru)
    const goBackFromPostView = () => {
        setPage('home');
        const url = new URL(window.location); 
        url.searchParams.delete('post'); 
        window.history.pushState({},'',url);
    };

    const isGuest = !user || !profile?.onboarded;

    // Tampilkan Loading state atau Onboarding
    if (user === undefined) return <div className="h-screen flex items-center justify-center dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500 size-10"/></div>;
    if (user && showOnboarding) return <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>;
    
    return (
        <div className="min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 transition-colors">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>{setPage('home'); handleHashtag(null); goBackFromPostView();}}>
                    <img src={APP_LOGO} className="w-8 h-8 rounded-full"/>
                    <span className="font-black text-xl bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700"><span className='sr-only'>Toggle Dark Mode</span>{darkMode?<Sun size={20}/>:<Moon size={20}/>}</button>
                    {profile?.email === DEVELOPER_EMAIL && (
                        <button onClick={()=>setShowDev(true)} className="p-2 text-rose-500 hover:text-rose-600"><Code size={20}/></button>
                    )}
                    {isGuest ? (
                        <button onClick={()=>setShowAuthModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-full font-bold text-xs hover:bg-sky-600 transition">Login</button>
                    ) : (
                        <button onClick={()=>signOut(auth)} className="p-2 text-rose-500 hover:text-rose-600"><LogOut size={20}/></button>
                    )}
                </div>
            </header>

            <main className="pt-16">
                {/* RENDER PAGES (SEMUA FITUR ASLI DIPERTAHANKAN) */}
                {page === 'home' && (
                    <HomeScreen 
                        currentUserId={user?.uid} 
                        profile={profile} 
                        allPosts={posts} 
                        handleFollow={handleFollow} 
                        goToProfile={(uid)=>{setTargetUid(uid); setPage('profile_view');}}
                        filterHashtag={hashtagFilter}
                        clearFilter={()=>handleHashtag(null)} // Diperbaiki: Tombol X sekarang mengosongkan filter.
                        isGuest={isGuest}
                        onRequestLogin={()=>setShowAuthModal(true)}
                    />
                )}
                {page === 'create' && (
                    <CreatePost 
                        setPage={setPage} 
                        userId={user?.uid} 
                        username={profile?.username} 
                        onSuccess={()=>{setPage('home'); handleHashtag(null);}}
                    />
                )}
                {page === 'profile' && user && profile && (
                    <ProfileScreen 
                        viewerProfile={profile} 
                        profileData={profile} 
                        allPosts={posts} 
                        handleFollow={handleFollow} 
                        isGuest={false}
                    />
                )}
                {page === 'profile_view' && targetUid && (
                    <ProfileScreen 
                        viewerProfile={profile} 
                        profileData={posts.find(p=>p.userId===targetUid)?.user || {uid:targetUid, username:'User'}} 
                        allPosts={posts} 
                        handleFollow={handleFollow} 
                        isGuest={isGuest}
                    />
                )}
                {/* Single Post View (Fitur Baru) */}
                 {page === 'view_post' && targetPostId && (
                    <SinglePostView 
                        postId={targetPostId} 
                        allPosts={posts} 
                        goBack={goBackFromPostView}
                        currentUserId={user?.uid}
                        profile={profile}
                        isGuest={isGuest}
                        onRequestLogin={()=>setShowAuthModal(true)}
                        onHashtagClick={handleHashtag}
                    />
                )}
                {/* Screens Asli yang Dipertahankan */}
                {page === 'shorts' && <ShortsScreen />}
                {page === 'search' && <SearchScreen />}
                {page === 'leaderboard' && <LeaderboardScreen />}
                {page === 'notifications' && <NotificationScreen />}
                {page === 'messages' && <MessagesScreen />}
                {page === 'games' && <GameCenter />}
            </main>

            {/* Bottom Nav (ASLI, DENGAN SEDIKIT PENYESUAIAN) */}
            {page !== 'create' && page !== 'view_post' && (
                <nav className="fixed bottom-0 w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md h-16 border-t dark:border-gray-700 shadow-lg flex items-center justify-around z-40">
                    <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                    <NavBtn icon={Film} active={page==='shorts'} onClick={()=>setPage('shorts')}/>
                    <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                    
                    {/* Tombol Utama Post */}
                    <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition -mt-6">
                        <PlusCircle size={24}/>
                    </button>
                    
                    <NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>
                    <NavBtn icon={Bell} active={page==='notifications'} onClick={()=>setPage('notifications')}/>
                    {isGuest ? (
                         <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/>
                    ) : (
                         <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/>
                    )}
                </nav>
            )}

            {/* MODAL & OVERLAYS */}
            {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)}/>}
            {/* Onboarding sudah ditangani di atas */}
            <PWAInstallPrompt />
        </div>
    );
};

export default App;