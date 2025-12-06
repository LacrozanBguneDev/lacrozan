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
    increment
} from 'firebase/firestore';

// IMPORT ICON (LUCIDE REACT) - Dikembalikan Lengkap
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    Trash2, X, Check, Search, UserCheck, ChevronRight, Share2, Youtube, Flame, 
    Bell, Gift, Crown, Gem, ShieldCheck, PlusCircle, ArrowLeft,
    CheckCircle, ExternalLink, ChevronLeft, MoreHorizontal, ShieldAlert, Zap,
    Activity, Users, BarChart3, Megaphone, Radio, Globe, LayoutGrid, XCircle
} from 'lucide-react';

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; // Logo asli
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
// BAGIAN 2: UTILITY FUNCTIONS (BASE64 & LOGIC)
// ==========================================

// Kompresi Gambar ke Base64 (Sangat Penting untuk Performa)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resolusi dimaksimalkan tapi tetap hemat (Max 800px)
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
                
                // Kualitas 0.65 cukup bagus untuk HP tapi ukuran kecil
                resolve(canvas.toDataURL('image/jpeg', 0.65));
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
    if (url.startsWith('http')) return { type: 'link', url: url };
    return null;
};

// Fitur Badge Reputasi (Dikembalikan)
const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

// Markdown Rendering (Dikembalikan agar teks post rapi)
const renderMarkdown = (text) => {
    if (!text) return null;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="text-sky-600 hover:underline break-all" onClick="event.stopPropagation()">$1</a>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ==========================================
// BAGIAN 3: KOMPONEN UI UTAMA
// ==========================================

const SplashScreen = () => (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center">
        <div className="relative mb-6 animate-bounce">
            <img src={APP_LOGO} className="w-24 h-24 object-contain drop-shadow-lg"/>
        </div>
        <h1 className="text-3xl font-black text-sky-600 tracking-tighter mb-2">{APP_NAME}</h1>
        <Loader2 className="animate-spin text-gray-400" size={24}/>
    </div>
);

const SkeletonPost = () => (
    <div className="bg-white rounded-[2rem] p-5 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200"></div><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div></div>
        <div className="h-48 bg-gray-200 rounded-2xl mb-4"></div><div className="flex gap-4"><div className="h-8 w-16 bg-gray-100 rounded-full"></div></div>
    </div>
);

// --- LIGHTBOX GALLERY (FITUR BARU: FULL SCREEN IMAGE) ---
const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    
    // Mencegah scroll pada body saat lightbox terbuka
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => document.body.style.overflow = 'auto';
    }, []);

    const next = (e) => { e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length); };
    const prev = (e) => { e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length); };

    return (
        <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-gray-800/50 rounded-full hover:bg-gray-700 z-[80]"><X size={24}/></button>
            
            <div className="relative w-full h-full flex items-center justify-center p-4">
                <img 
                    src={images[index]} 
                    className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300"
                    onClick={(e) => e.stopPropagation()} // Supaya klik gambar tidak close
                    alt="Full view"
                />
                
                {images.length > 1 && (
                    <>
                        <button onClick={prev} className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition"><ChevronLeft size={32}/></button>
                        <button onClick={next} className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition"><ChevronRight size={32}/></button>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                            {index + 1} / {images.length}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- DEVELOPER DASHBOARD (DIKEMBALIKAN) ---
const DeveloperDashboard = ({ onClose }) => {
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [stats, setStats] = useState({ users: 0, posts: 0 });

    useEffect(() => {
        // Fetch stats simple
        const uSub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setStats(prev => ({...prev, users: s.size})));
        const pSub = onSnapshot(collection(db, getPublicCollection('posts')), s => setStats(prev => ({...prev, posts: s.size})));
        return () => { uSub(); pSub(); };
    }, []);

    const handleBroadcast = async () => {
        if(!broadcastMsg.trim() || !confirm("Kirim ke SEMUA user?")) return;
        try {
            const usersSnap = await getDoc(collection(db, getPublicCollection('userProfiles'))); // Ini hanya dummy, implementasi asli butuh loop query
            // Karena broadcast ke semua user berat di client-side tanpa cloud function, kita buat notif sistem global saja atau simple alert
            alert("Fitur broadcast disimulasikan (untuk keamanan client-side).");
            setBroadcastMsg('');
        } catch(e) { alert("Error"); }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-2xl rounded-t-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Dev Panel</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X/></button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 text-center"><h3 className="text-3xl font-bold text-sky-600">{stats.users}</h3><p className="text-xs text-gray-500 uppercase font-bold">Total User</p></div>
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center"><h3 className="text-3xl font-bold text-purple-600">{stats.posts}</h3><p className="text-xs text-gray-500 uppercase font-bold">Total Post</p></div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                    <h3 className="font-bold mb-2 flex items-center gap-2"><Megaphone size={16}/> Broadcast System</h3>
                    <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full p-2 text-sm border rounded-lg mb-2" placeholder="Pesan sistem..."/>
                    <button onClick={handleBroadcast} className="bg-blue-600 text-white w-full py-2 rounded-lg font-bold text-sm">Kirim Notifikasi</button>
                </div>
                <div className="text-center text-xs text-gray-400 mt-10">System ID: {appId}</div>
            </div>
        </div>
    );
};

// --- AUTH SCREEN (Google Only) ---
const AuthScreen = ({ onLoginSuccess, onCancel }) => {
    const [loading, setLoading] = useState(false);
    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const user = res.user;
            // Setup user profile if new
            const ref = doc(db, getPublicCollection('userProfiles'), user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, { 
                    username: user.displayName, email: user.email, uid: user.uid, photoURL: user.photoURL,
                    followers: [], following: [], savedPosts: [], createdAt: serverTimestamp(), role: 'user'
                });
            }
            onLoginSuccess();
        } catch (e) { alert(`Login Gagal: ${e.message}`); } 
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 relative animate-in zoom-in-95">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={16}/></button>
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h2 className="text-2xl font-black text-gray-800">Masuk</h2>
                    <p className="text-gray-500 text-sm">Akses penuh fitur {APP_NAME}</p>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 py-3 rounded-full font-bold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition">
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

// --- POST ITEM (GRID LAYOUT & LIGHTBOX) ---
const PostItem = ({ post, currentUserId, profile, triggerLogin, goToProfile }) => {
    const isGuest = currentUserId === 'guest';
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL;
    const badge = getReputationBadge(post.likes?.length || 0, isDeveloper);

    const handleLike = async () => {
        if (isGuest) { triggerLogin(); return; }
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(p => newLiked ? p + 1 : p - 1);
        try {
            const ref = doc(db, getPublicCollection('posts'), post.id);
            if (newLiked) {
                await updateDoc(ref, { likes: arrayUnion(currentUserId) });
                if (post.userId !== currentUserId) sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
            } else {
                await updateDoc(ref, { likes: arrayRemove(currentUserId) });
            }
        } catch (e) { setLiked(!newLiked); setLikeCount(p => !newLiked ? p + 1 : p - 1); }
    };

    const handleDelete = async () => {
        if (confirm("Hapus postingan ini?")) deleteDoc(doc(db, getPublicCollection('posts'), post.id));
    };

    const sharePost = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Link postingan disalin!");
    };

    // Fungsi membuka lightbox
    const openLightbox = (idx) => {
        setLightboxIndex(idx);
        setLightboxOpen(true);
    };

    return (
        <>
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
            
            <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 relative group transition-all hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-sky-200 to-purple-200">
                            <img src={post.user?.photoURL || APP_LOGO} className="w-full h-full rounded-full object-cover border-2 border-white"/>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">
                                {post.user?.username}
                                {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-50"/>}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${badge.color}`}>{badge.label}</span>
                            </div>
                        </div>
                    </div>
                    {post.userId === currentUserId && (
                        <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                    )}
                </div>

                {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
                <div className="text-sm text-gray-600 mb-4">{renderMarkdown(post.content)}</div>

                {/* GRID IMAGE LAYOUT (PETAK TAPI KLIK FULLSCREEN) */}
                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <div className={`mb-4 rounded-2xl overflow-hidden grid gap-1 cursor-pointer ${
                        mediaList.length === 1 ? 'grid-cols-1' : 
                        mediaList.length === 2 ? 'grid-cols-2' : 
                        mediaList.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
                    }`}>
                        {mediaList.slice(0, 4).map((url, i) => (
                            <div key={i} onClick={() => openLightbox(i)} className={`relative bg-gray-100 ${
                                mediaList.length === 3 && i === 0 ? 'row-span-2 h-full' : 'aspect-square'
                            }`}>
                                <img src={url} className="w-full h-full object-cover hover:opacity-90 transition"/>
                                {i === 3 && mediaList.length > 4 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">
                                        +{mediaList.length - 4}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {embed?.type === 'youtube' && (
                    <div className="mb-4 rounded-2xl overflow-hidden aspect-video bg-black shadow-lg">
                        <iframe src={embed.embedUrl} className="w-full h-full border-0" allowFullScreen></iframe>
                    </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex gap-6">
                        <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500">
                            <MessageSquare size={22}/> {post.commentsCount || 0}
                        </button>
                    </div>
                    <button onClick={sharePost} className="text-gray-400 hover:text-sky-500 transition"><Share2 size={20}/></button>
                </div>
            </div>
        </>
    );
};

// --- CREATE POST (BASE64 ONLY) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', youtubeUrl: '' });
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files);
        if(files.length + images.length > 5) return alert("Max 5 foto.");
        setLoading(true);
        try {
            const promises = files.map(f => compressImageToBase64(f));
            const results = await Promise.all(promises);
            setImages(p => [...p, ...results]);
        } catch(e){ alert("Error foto"); } 
        finally { setLoading(false); }
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const isYoutube = form.youtubeUrl.includes('youtu');
            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: form.title, content: form.content, timestamp: serverTimestamp(),
                likes: [], commentsCount: 0, user: { username, uid: userId },
                mediaType: images.length > 0 ? 'image' : (isYoutube ? 'video' : 'text'),
                mediaUrl: isYoutube ? form.youtubeUrl : (images[0] || ''),
                mediaUrls: images
            });
            onSuccess();
        } catch(e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 mt-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-purple-400"></div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-800">Buat Postingan</h2>
                    <button onClick={() => setPage('home')} className="p-2 bg-gray-100 rounded-full"><X size={18}/></button>
                </div>
                
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu... (Bisa pakai **tebal**, *miring*)" rows="5" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 resize-none"/>
                    
                    {/* Image Preview Grid */}
                    <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                            <div key={i} className="w-20 h-20 rounded-xl overflow-hidden relative border border-gray-200 group">
                                <img src={img} className="w-full h-full object-cover"/>
                                <button type="button" onClick={()=>setImages(images.filter((_,idx)=>idx!==i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X size={10}/></button>
                            </div>
                        ))}
                        {images.length < 5 && (
                            <label className="w-20 h-20 rounded-xl bg-sky-50 border-2 border-dashed border-sky-200 flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 text-sky-500 transition">
                                <ImageIcon size={20}/>
                                <span className="text-[9px] font-bold mt-1">Foto</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} disabled={loading}/>
                            </label>
                        )}
                    </div>

                    <div className="relative">
                        <Youtube size={18} className="absolute left-3 top-3 text-red-500"/>
                        <input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} disabled={images.length>0} placeholder="Link YouTube..." className="w-full pl-10 p-3 bg-gray-50 rounded-xl text-xs outline-none disabled:opacity-50"/>
                    </div>

                    <button disabled={loading || (!form.content && images.length===0 && !form.youtubeUrl)} className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin"/> : <><Send size={18}/> Posting</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN (FITUR LENGKAP) ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, triggerLogin }) => {
    const isGuest = viewerProfile.uid === 'guest';
    const isSelf = viewerProfile.uid === profileData.uid;
    const isDev = profileData.email === DEVELOPER_EMAIL;
    
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const userPosts = allPosts.filter(p => p.userId === profileData.uid);
    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);

    // Edit Profile Logic (Simple)
    const handleAvatar = async (e) => {
        const f = e.target.files[0];
        if(!f) return;
        try {
            const b64 = await compressImageToBase64(f);
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { photoURL: b64 });
        } catch(e){ alert("Gagal update foto"); }
    };

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6 px-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-50 mb-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-100 to-purple-100 opacity-50"></div>
                <div className="relative inline-block mt-8 mb-4">
                    <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-xl overflow-hidden relative group">
                        <img src={profileData.photoURL || APP_LOGO} className="w-full h-full object-cover"/>
                        {isSelf && !isGuest && (
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                                <ImageIcon className="text-white"/>
                                <input type="file" className="hidden" onChange={handleAvatar} accept="image/*"/>
                            </label>
                        )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md">
                        <div className={`w-4 h-4 rounded-full ${isDev ? 'bg-blue-500' : 'bg-green-500'} border-2 border-white`}></div>
                    </div>
                </div>

                <h1 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-2">
                    {profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-600"/>}
                </h1>
                
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold mt-2 ${badge.color}`}>
                    <badge.icon size={12}/> {badge.label}
                </div>

                <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-gray-50">
                    <div className="text-center"><span className="block font-black text-xl text-gray-800">{userPosts.length}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Post</span></div>
                    <div className="text-center"><span className="block font-black text-xl text-gray-800">{totalLikes}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Likes</span></div>
                </div>

                {isSelf && isDev && (
                    <button onClick={()=>setShowDev(true)} className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg">
                        <ShieldCheck size={16}/> Dashboard Admin
                    </button>
                )}
            </div>

            {/* TABS */}
            <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
                <button onClick={()=>setActiveTab('posts')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='posts'?'bg-sky-50 text-sky-600':'text-gray-400'}`}>Postingan</button>
                <button onClick={()=>setActiveTab('likes')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='likes'?'bg-rose-50 text-rose-600':'text-gray-400'}`}>Disukai</button>
            </div>

            <div className="space-y-4">
                {activeTab === 'posts' && (
                    userPosts.length > 0 ? userPosts.map(p => (
                        <PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} triggerLogin={triggerLogin} goToProfile={()=>{}}/>
                    )) : <div className="text-center text-gray-400 py-10">Belum ada postingan.</div>
                )}
                {activeTab === 'likes' && <div className="text-center text-gray-400 py-10">Fitur riwayat like akan segera hadir.</div>}
            </div>

            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)}/>}
        </div>
    );
};

// --- SEARCH SCREEN (DIKEMBALIKAN) ---
const SearchScreen = ({ allPosts, allUsers, goToProfile }) => {
    const [queryText, setQueryText] = useState('');
    const filteredPosts = allPosts.filter(p => p.content.toLowerCase().includes(queryText.toLowerCase()));
    
    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">
                <Search className="text-sky-500" size={28}/> Jelajahi
            </h1>
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                <input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Cari postingan atau topik..." className="w-full bg-white pl-12 pr-4 py-3 rounded-2xl shadow-sm border border-transparent focus:border-sky-200 outline-none transition"/>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {filteredPosts.map(p => (
                    <div key={p.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 h-40 flex flex-col justify-between cursor-pointer hover:shadow-md transition" onClick={()=>goToProfile(p.userId)}>
                        <p className="text-xs font-bold text-gray-800 line-clamp-3">{p.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <img src={p.user?.photoURL||APP_LOGO} className="w-6 h-6 rounded-full"/>
                            <span className="text-[10px] text-gray-500 truncate">{p.user?.username}</span>
                        </div>
                    </div>
                ))}
            </div>
            {filteredPosts.length === 0 && <div className="text-center text-gray-400 mt-10">Tidak ditemukan.</div>}
        </div>
    );
};

// --- APP UTAMA ---
const App = () => {
    const [user, setUser] = useState(undefined);
    const [profile, setProfile] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [page, setPage] = useState('home'); // home, search, create, profile, other-profile
    const [posts, setPosts] = useState([]);
    const [users, setUsers] = useState([]);
    const [targetUid, setTargetUid] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    const GUEST = useMemo(()=>({ uid:'guest', username:'Tamu', photoURL:'' }), []);

    // Splash Screen Timer
    useEffect(() => { setTimeout(() => setShowSplash(false), 2500); }, []);

    // Auth & Data Listener
    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, u => {
            if(u) {
                setUser(u); setIsGuest(false);
                onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), s => {
                    if(s.exists()) setProfile({...s.data(), uid:u.uid});
                });
            } else {
                setUser(null); setIsGuest(true); setProfile(GUEST);
            }
        });

        // Listen Posts (Realtime)
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(50)), s => {
            setPosts(s.docs.map(d=>({id:d.id, ...d.data()})));
        });

        // Listen Users (Untuk Search/Profile Lain)
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => {
            setUsers(s.docs.map(d=>({uid:d.id, ...d.data()})));
        });

        return () => { unsubAuth(); unsubPosts(); unsubUsers(); };
    }, []);

    const triggerLogin = () => setShowLogin(true);
    const targetProfileData = users.find(u => u.uid === targetUid);

    if (showSplash) return <SplashScreen/>;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500"/></div>;

    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setPage('home')}>
                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                </div>
                {isGuest ? (
                    <button onClick={triggerLogin} className="bg-sky-600 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg shadow-sky-200 hover:scale-105 transition">Masuk</button>
                ) : (
                    <button onClick={()=>signOut(auth)} className="bg-gray-100 text-rose-500 p-2 rounded-full hover:bg-rose-50 transition"><LogOut size={18}/></button>
                )}
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-24">
                {page === 'home' && (
                    <div className="max-w-lg mx-auto px-4">
                        {posts.length===0 ? <SkeletonPost/> : posts.map(p => (
                            <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} triggerLogin={triggerLogin} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>
                        ))}
                    </div>
                )}
                {page === 'search' && <SearchScreen allPosts={posts} allUsers={users} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} />}
                {page === 'create' && <CreatePost userId={profile.uid} username={profile.username} setPage={setPage} onSuccess={()=>setPage('home')} />}
                {page === 'profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} triggerLogin={triggerLogin} />}
                {page === 'other-profile' && targetProfileData && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-20 left-4 z-40 bg-white/80 p-2 rounded-full shadow-md"><ArrowLeft size={20}/></button>
                        <ProfileScreen viewerProfile={profile} profileData={targetProfileData} allPosts={posts} triggerLogin={triggerLogin} />
                    </>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40">
                <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                <button onClick={()=>isGuest?triggerLogin():setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3.5 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition active:scale-95"><PlusCircle size={24}/></button>
                <NavBtn icon={Bell} active={false} onClick={()=>alert("Notifikasi segera hadir!")}/>
                <NavBtn icon={User} active={page==='profile'} onClick={()=>isGuest?triggerLogin():setPage('profile')}/>
            </nav>

            {showLogin && <AuthScreen onLoginSuccess={()=>setShowLogin(false)} onCancel={()=>setShowLogin(false)}/>}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2.5 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={24} strokeWidth={active?2.5:2} />
    </button>
);

export default App;