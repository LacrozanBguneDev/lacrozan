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
    signInWithPopup
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

// IMPORT ICON DARI LUCIDE REACT (LENGKAP SESUAI ASLI)
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
    ChevronLeft, LayoutGrid
} from 'lucide-react';

// SET LOG LEVEL FIRESTORE
setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

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

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS & HELPERS
// ==========================================

// FUNGSI KOMPRESI KE BASE64 (PENGGANTI API LUAR)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Optimasi ukuran: Max 800px agar ringan di HP & DB
                const MAX_SIDE = 800; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIDE) { height *= MAX_SIDE / width; width = MAX_SIDE; }
                } else {
                    if (height > MAX_SIDE) { width *= MAX_SIDE / height; height = MAX_SIDE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert ke JPEG quality 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

const sendNotification = async (toUserId, type, message, fromUser, postId = null) => {
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId, fromUserId: fromUser.uid, fromUsername: fromUser.username, fromPhoto: fromUser.photoURL || '',
            type: type, message: message, postId: postId, isRead: false, timestamp: serverTimestamp()
        });
    } catch (error) { console.error("Gagal notif", error); }
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
    if (minutes < 60) return { relative: `${minutes} mnt lalu`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam lalu`, full: fullDate };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { 
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`, id: youtubeMatch[1] }; 
    }
    if (url.startsWith('http')) {
        return { type: 'link', url: url };
    }
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

// ==========================================
// BAGIAN 3: KOMPONEN UI UTAMA
// ==========================================

const ImageWithRetry = ({ src, alt, className, fallbackText, onClick }) => {
    const [error, setError] = useState(false);
    if (!src || error) {
        return (
            <div className={`bg-gray-200 flex items-center justify-center text-gray-400 ${className}`} onClick={onClick}>
                 {fallbackText ? (
                    <div className="text-sky-600 font-black text-xl uppercase">{fallbackText[0]}</div>
                ) : <ImageIcon size={20} className="opacity-30"/>}
            </div>
        );
    }
    return <img src={src} alt={alt} className={className} onError={()=>setError(true)} loading="lazy" onClick={onClick} />;
};

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

const SkeletonPost = () => (
    <div className="bg-white rounded-[2rem] p-5 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200"></div><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div><div className="h-48 bg-gray-200 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 rounded-full"></div><div className="h-8 w-16 bg-gray-100 rounded-full"></div></div>
    </div>
);

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-400 italic">Tidak ada konten.</p>;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">$1</a>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-sky-50 px-1 rounded text-sm text-sky-700 font-mono border border-sky-100">$1</code>').replace(/#(\w+)/g, '<span class="text-blue-500 font-bold cursor-pointer hover:underline">#$1</span>').replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- LIGHTBOX (FULLSCREEN IMAGE VIEWER) ---
const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    useEffect(()=>{document.body.style.overflow='hidden'; return ()=>document.body.style.overflow='auto'},[]);
    const next = (e)=>{e.stopPropagation(); setIndex((prev)=>(prev+1)%images.length)};
    const prev = (e)=>{e.stopPropagation(); setIndex((prev)=>(prev-1+images.length)%images.length)};
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-300" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800/50 p-2 rounded-full text-white hover:bg-gray-700"><X/></button>
            <img src={images[index]} className="max-w-full max-h-[90vh] object-contain transition-transform" onClick={e=>e.stopPropagation()}/>
            {images.length > 1 && (
                <>
                    <button onClick={prev} className="absolute left-2 p-3 text-white hover:bg-white/10 rounded-full"><ChevronLeft size={30}/></button>
                    <button onClick={next} className="absolute right-2 p-3 text-white hover:bg-white/10 rounded-full"><ChevronRight size={30}/></button>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">{index+1} / {images.length}</div>
                </>
            )}
        </div>
    );
};

// --- DEVELOPER DASHBOARD (DIKEMBALIKAN) ---
const DeveloperDashboard = ({ onClose }) => {
    const [stats, setStats] = useState({ users: 0, posts: 0 });
    const [broadcastMsg, setBroadcastMsg] = useState('');
    
    useEffect(() => {
        const uSub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setStats(p=>({...p, users: s.size})));
        const pSub = onSnapshot(collection(db, getPublicCollection('posts')), s => setStats(p=>({...p, posts: s.size})));
        return () => { uSub(); pSub(); };
    }, []);

    const handleBroadcast = async () => {
        if(!broadcastMsg.trim()) return;
        if(!confirm("Kirim ke SEMUA user?")) return;
        alert("Simulasi Broadcast: " + broadcastMsg); // Simulasi untuk keamanan client-side
        setBroadcastMsg('');
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="text-sky-600"/> Developer Panel</h2><button onClick={onClose} className="bg-white p-2 rounded-full shadow hover:bg-gray-200"><X/></button></div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100 text-center"><Users className="mx-auto text-sky-500 mb-2"/><h3 className="text-2xl font-bold">{stats.users}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total User</p></div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 text-center"><ImageIcon className="mx-auto text-purple-500 mb-2"/><h3 className="text-2xl font-bold">{stats.posts}</h3><p className="text-[10px] text-gray-500 uppercase font-bold">Total Post</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Megaphone size={18} className="text-orange-500"/> Kirim Pengumuman</h3>
                    <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm border border-gray-200 mb-3 outline-none" rows="3" placeholder="Tulis pesan system..."/>
                    <button onClick={handleBroadcast} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full hover:bg-orange-600 transition">Kirim ke Semua</button>
                </div>
            </div>
        </div>
    );
};

// --- AUTH SCREEN (GOOGLE ONLY) ---
const AuthModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const user = res.user;
            // Setup profile jika user baru
            const ref = doc(db, getPublicCollection('userProfiles'), user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, { 
                    username: user.displayName, email: user.email, uid: user.uid, photoURL: user.photoURL,
                    followers: [], following: [], savedPosts: [], createdAt: serverTimestamp()
                });
            }
            onSuccess();
        } catch(e) { alert("Login error: " + e.message); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 relative overflow-hidden animate-in zoom-in-95">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={16}/></button>
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h2 className="text-2xl font-black text-gray-800">Masuk</h2>
                    <p className="text-gray-500 text-sm">Akses fitur like, komen & posting.</p>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full py-3 bg-white border border-gray-200 rounded-full font-bold text-gray-700 shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition">
                    {loading ? <Loader2 className="animate-spin text-sky-500"/> : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.81-.81z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            <span>Lanjutkan dengan Google</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 4: KOMPONEN POSTINGAN (CORE)
// ==========================================

const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, triggerLogin }) => {
    const isGuest = currentUserId === 'guest';
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isSaved, setIsSaved] = useState(profile?.savedPosts?.includes(post.id));
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const isOwner = post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL;
    
    // Normalisasi media (mendukung legacy string & new array)
    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]); // Youtube biasa di mediaUrl string

    const isFollowing = (profile?.following || []).includes(post.userId);

    const handleLike = async () => {
        if(isGuest) return triggerLogin();
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

    const handleSave = async () => {
        if(isGuest) return triggerLogin();
        const newSaved = !isSaved;
        setIsSaved(newSaved);
        const userRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
        try { if (newSaved) { await updateDoc(userRef, { savedPosts: arrayUnion(post.id) }); } else { await updateDoc(userRef, { savedPosts: arrayRemove(post.id) }); } } catch (error) { setIsSaved(!newSaved); }
    };

    const handleComment = async (e) => {
        e.preventDefault(); if(isGuest) return triggerLogin(); if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };
    const sharePost = async () => { try { await navigator.clipboard.writeText(window.location.href); alert('Link Disalin!'); } catch (e) { alert('Gagal menyalin link'); } };

    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 
    const openLightbox = (idx) => { setLightboxIndex(idx); setLightboxOpen(true); };

    return (
        <>
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={()=>setLightboxOpen(false)}/>}
            <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden group transition hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                                <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">
                                {post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                                {isDeveloper && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${userBadge.color}`}>{userBadge.label}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {!isOwner && !isGuest && ( <button onClick={() => handleFollow(post.userId, isFollowing)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md'}`}>{isFollowing ? 'Mengikuti' : 'Ikuti'}</button> )}
                        {isOwner && ( <button onClick={handleDelete} className="p-2 rounded-full text-gray-400 hover:text-red-600"><Trash2 size={16}/></button> )}
                    </div>
                </div>

                {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
                <div className="text-sm text-gray-600 mb-4 leading-relaxed">{renderMarkdown(post.content)}</div>
                
                {/* LOGIKA GRID / PETAK GAMBAR + LIGHTBOX */}
                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <div className={`mb-4 rounded-2xl overflow-hidden grid gap-1 ${mediaList.length===1?'grid-cols-1':mediaList.length===2?'grid-cols-2':mediaList.length===3?'grid-cols-2':'grid-cols-2'}`}>
                        {mediaList.slice(0, 4).map((url, i) => (
                            <div key={i} className={`relative bg-gray-100 aspect-square cursor-pointer ${mediaList.length===3 && i===0 ? 'row-span-2 h-full' : ''}`} onClick={()=>openLightbox(i)}>
                                <ImageWithRetry src={url} className="w-full h-full object-cover hover:opacity-90 transition"/>
                                {i===3 && mediaList.length > 4 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">+{mediaList.length-4}</div>}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* EMBED YOUTUBE */}
                {embed?.type === 'youtube' && <div className="aspect-video mb-4 rounded-2xl overflow-hidden shadow-lg"><iframe src={embed.embedUrl} className="w-full h-full border-0" allowFullScreen></iframe></div>}

                <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                    <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}><Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={22}/> {post.commentsCount || 0}</button>
                    <button onClick={sharePost} className="text-gray-400 hover:text-sky-500"><Share2 size={22}/></button>
                    <button onClick={handleSave} className={`ml-auto transition ${isSaved ? 'text-sky-500' : 'text-gray-400 hover:text-gray-600'}`}><Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} /></button>
                </div>

                {showComments && (
                    <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in">
                        <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">{comments.map(c => ( <div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs flex justify-between items-start group"><div><span className="font-bold text-gray-800 mr-1">{c.username}</span><span className="text-gray-600">{c.text}</span></div></div> ))}</div>
                        <form onSubmit={handleComment} className="flex gap-2 relative"><input disabled={isGuest} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={isGuest?"Login dulu...":"Tulis komentar..."} className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200"/><button type="submit" disabled={!newComment.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50"><Send size={14}/></button></form>
                    </div>
                )}
            </div>
        </>
    );
};

// --- CREATE POST (BASE64 MULTIPLE) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', youtubeUrl: '' });
    const [images, setImages] = useState([]); // Array Base64
    const [loading, setLoading] = useState(false);

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files);
        if(files.length + images.length > 5) return alert("Maksimal 5 foto.");
        setLoading(true);
        try {
            const promises = files.map(f => compressImageToBase64(f));
            const results = await Promise.all(promises);
            setImages(p => [...p, ...results]);
        } catch(e) { alert("Gagal proses gambar"); } finally { setLoading(false); }
    };

    const submit = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const isYoutube = form.youtubeUrl.includes('youtu');
            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: form.title, content: form.content, 
                mediaType: images.length > 0 ? 'image' : (isYoutube ? 'video' : 'text'),
                mediaUrl: isYoutube ? form.youtubeUrl : (images[0] || ''), // Legacy support
                mediaUrls: images, // New Grid support
                timestamp: serverTimestamp(), likes: [], commentsCount: 0, category: 'general', 
                user: {username, uid: userId}
            });
            onSuccess();
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 relative overflow-hidden mt-4">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-gray-800">Buat Postingan</h2><button onClick={()=>setPage('home')} className="bg-gray-100 p-2 rounded-full"><X/></button></div>
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul..." className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu..." rows="4" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 resize-none"/>
                    
                    <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => ( <div key={i} className="w-16 h-16 rounded-lg relative overflow-hidden group"><img src={img} className="w-full h-full object-cover"/><button type="button" onClick={()=>setImages(images.filter((_,x)=>x!==i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={10}/></button></div> ))}
                        {images.length < 5 && ( <label className="w-16 h-16 rounded-lg bg-sky-50 border-2 border-dashed border-sky-200 flex items-center justify-center cursor-pointer text-sky-500"><ImageIcon/><input type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} disabled={loading}/></label> )}
                    </div>

                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} disabled={images.length>0} placeholder="Link YouTube..." className="w-full pl-10 py-3 bg-gray-50 rounded-xl text-xs outline-none disabled:opacity-50"/></div>
                    <button disabled={loading || (!form.content && images.length===0 && !form.youtubeUrl)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg hover:bg-sky-600 disabled:opacity-50">{loading ? 'Mengirim...' : 'Posting'}</button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, handleFollow, triggerLogin }) => {
    const isGuest = viewerProfile.uid === 'guest';
    const isSelf = viewerProfile.uid === profileData.uid; 
    const isDev = profileData.email === DEVELOPER_EMAIL;
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); 

    const userPosts = allPosts.filter(p=>p.userId===profileData.uid);
    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);

    const handleAvatar = async (e) => {
        const f = e.target.files[0]; if(!f) return;
        try { const b64 = await compressImageToBase64(f); await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), {photoURL:b64}); } catch(e){ alert("Gagal ganti foto"); }
    };

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6 px-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-50 mb-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-200 to-purple-200 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-8">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 relative group">
                        <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover" fallbackText={profileData.username}/>
                        {isSelf && !isGuest && <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition"><ImageIcon className="text-white"/><input type="file" className="hidden" accept="image/*" onChange={handleAvatar}/></label>}
                    </div>
                </div>
                <h1 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-1">{profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-500"/>}</h1>
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs my-4 shadow-sm ${badge.color}`}><badge.icon size={14}/> {badge.label}</div>
                
                {isSelf && isDev && <button onClick={()=>setShowDev(true)} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg"><ShieldCheck size={16}/> Dashboard Admin</button>}
                
                <div className="flex justify-center gap-6 mt-6 border-t pt-6"><div><span className="font-bold text-xl block">{userPosts.length}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Post</span></div><div><span className="font-bold text-xl block">{totalLikes}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Likes</span></div></div>
            </div>

            {isSelf && ( <div className="flex gap-2 mb-6"><button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'posts' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-gray-500'}`}>Postingan Saya</button><button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 text-xs font-bold rounded-full transition ${activeTab === 'saved' ? 'bg-purple-500 text-white shadow-md' : 'bg-white text-gray-500'}`}>Disimpan</button></div> )}
            
            <div className="space-y-6">
                {activeTab === 'posts' ? (userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} handleFollow={handleFollow} triggerLogin={triggerLogin} goToProfile={()=>{}}/>)) : ( <div className="text-center text-gray-400 py-10">Fitur tersimpan.</div>)}
            </div>
            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)} />}
        </div>
    );
};

// --- TRENDING TAGS & SEARCH ---
const TrendingTags = ({ posts }) => {
    const tags = useMemo(() => { const c = {}; posts.forEach(p => extractHashtags(p.content).forEach(t => c[t] = (c[t]||0)+1)); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,10); }, [posts]);
    if(tags.length===0) return null;
    return <div className="mb-4 overflow-x-auto no-scrollbar py-2 px-4"><div className="flex gap-3"><div className="flex items-center gap-1 text-xs font-bold text-sky-600 whitespace-nowrap mr-2"><TrendingUp size={16}/> Trending:</div>{tags.map(([t, c]) => ( <div key={t} className="px-3 py-1 bg-white border border-sky-100 rounded-full text-[10px] font-bold text-gray-600 shadow-sm whitespace-nowrap">#{t.replace('#','')} <span className="text-sky-400 ml-1">({c})</span></div> ))}</div></div>;
};

const SearchScreen = ({ allPosts, allUsers, goToProfile }) => {
    const [q, setQ] = useState('');
    const filtered = allPosts.filter(p => p.content.toLowerCase().includes(q.toLowerCase()) || p.title?.toLowerCase().includes(q.toLowerCase()));
    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2"><Search className="text-sky-500" size={28}/> Pencarian</h1>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari..." className="w-full p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 outline-none focus:ring-2 focus:ring-sky-200"/>
            <div className="space-y-4">{filtered.map(p=><div key={p.id} onClick={()=>goToProfile(p.userId)} className="bg-white p-4 rounded-2xl shadow-sm cursor-pointer hover:bg-gray-50"><p className="font-bold text-sm mb-1">{p.title||p.content.substring(0,50)}...</p><p className="text-xs text-gray-500">Oleh: {p.user?.username}</p></div>)}</div>
        </div>
    );
};

// --- APP UTAMA ---
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [targetUid, setTargetUid] = useState(null); 
    const [showSplash, setShowSplash] = useState(true);
    const [showLogin, setShowLogin] = useState(false);

    // Guest Profile
    const GUEST = useMemo(()=>({uid:'guest', username:'Tamu', photoURL:''}), []);

    useEffect(() => { setTimeout(() => setShowSplash(false), 3000); }, []);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, u => {
            if(u) {
                setUser(u);
                onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), s => {
                    if(s.exists()) setProfile({...s.data(), uid:u.uid});
                });
            } else {
                setUser(null); setProfile(GUEST);
            }
        });

        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(50)), s => {
            setPosts(s.docs.map(d=>({id:d.id, ...d.data()})));
        });

        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({uid:d.id, ...d.data()}))));
        
        return () => { unsubAuth(); unsubPosts(); unsubUsers(); };
    }, []);

    const triggerLogin = () => setShowLogin(true);

    const handleFollow = async (uid, isFollowing) => { 
        if(profile.uid === 'guest') return triggerLogin();
        const meRef = doc(db, getPublicCollection('userProfiles'), profile.uid); 
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid); 
        try { 
            if(isFollowing) { await updateDoc(meRef, {following: arrayRemove(uid)}); await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); } 
            else { await updateDoc(meRef, {following: arrayUnion(uid)}); await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); } 
        } catch (e) { console.error(e); } 
    };

    if (showSplash) return <SplashScreen />;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;

    const targetUser = users.find(u => u.uid === targetUid);

    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800">
            <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-white/50 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-2" onClick={()=>setPage('home')}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span></div>
                {profile.uid === 'guest' ? (
                    <button onClick={triggerLogin} className="bg-sky-600 text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg hover:scale-105 transition">Masuk</button>
                ) : (
                    <button onClick={()=>signOut(auth)} className="p-2 bg-white rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition"><LogOut size={20}/></button>
                )}
            </header>

            <main className="pt-16">
                {page==='home' && (
                    <div className="max-w-lg mx-auto pb-24 px-4 pt-4">
                        <TrendingTags posts={posts}/>
                        {posts.map(p => (
                            <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} triggerLogin={triggerLogin} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>
                        ))}
                    </div>
                )}
                {page==='create' && <CreatePost setPage={setPage} userId={profile.uid} username={profile.username} onSuccess={()=>setPage('home')}/>}
                {page==='search' && <SearchScreen allPosts={posts} allUsers={users} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                {page==='profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} handleFollow={handleFollow} triggerLogin={triggerLogin}/>}
                {page==='other-profile' && targetUser && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-20 left-4 z-50 bg-white p-2 rounded-full shadow"><ArrowLeft/></button>
                        <ProfileScreen viewerProfile={profile} profileData={targetUser} allPosts={posts} handleFollow={handleFollow} triggerLogin={triggerLogin}/>
                    </>
                )}
            </main>

            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40">
                <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                <button onClick={()=>profile.uid==='guest'?triggerLogin():setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                <NavBtn icon={User} active={page==='profile'} onClick={()=>profile.uid==='guest'?triggerLogin():setPage('profile')}/>
            </nav>

            {showLogin && <AuthModal onClose={()=>setShowLogin(false)} onSuccess={()=>setShowLogin(false)}/>}
            <div className="fixed bottom-24 left-4"><a href={WHATSAPP_CHANNEL} target="_blank" className="p-3 bg-green-500 text-white rounded-full shadow-lg block hover:scale-110 transition"><MessageSquare size={20}/></a></div>
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;