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
    sendEmailVerification,
    sendPasswordResetEmail,
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
    increment
} from 'firebase/firestore';
import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from "firebase/storage";
import { getMessaging, getToken } from "firebase/messaging";

import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    Lock, Mail, UserPlus, LogIn, AlertCircle, Edit, Trash2, X, Check, PlusCircle, Search, 
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell,  
    RefreshCw, Info, ExternalLink, Users, Globe, CheckCircle, Sparkles, Zap, ShieldCheck, 
    ShieldAlert, Trash, BarChart3, Activity, Gift, Megaphone, Laugh, 
    Award, Crown, Gem, Bookmark, Coffee, Music, Play, Pause, FileText, Shield, Cookie
} from 'lucide-react';

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const VAPID_KEY = "BJyR2rcpzyDvJSPNZbLPBwIX3Gj09ArQLbjqb7S7aRBGlQDAnkOmDvEmuw9B0HGyMZnpj2CfLwi5mGpGWk8FimE"; 
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- GLOBAL CACHE (PERFORMA TINGGI) ---
// Menyimpan status gambar agar tidak perlu loading ulang (re-fetch)
const globalImageCache = new Map(); // Menggunakan Map untuk status spesifik ('loaded', 'error')

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
const storage = getStorage(app);

let messaging = null;
try { if (typeof window !== "undefined" && "serviceWorker" in navigator) messaging = getMessaging(app); } catch (e) {}

// ==========================================
// BAGIAN 2: UTILITY FUNCTIONS (OPTIMIZED)
// ==========================================

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
                let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                ctx.canvas.toBlob((blob) => {
                    if (!blob) { reject(new Error("Gagal kompresi")); return; }
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.8); 
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const uploadToFirebaseStorage = async (file, onProgress) => {
    if (!file) throw new Error("Tidak ada file");
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
    const storageRef = ref(storage, `artifacts/${appId}/public/uploads/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
            (snap) => { if(onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 100); }, 
            (err) => { console.error(err); reject(new Error("Gagal upload ke server.")); }, 
            async () => { resolve(await getDownloadURL(uploadTask.snapshot.ref)); }
        );
    });
};

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: '', full: '' };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return { relative: 'Baru saja' };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes}m lalu` };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { relative: `${hours}j lalu` };
    return { relative: date.toLocaleDateString('id-ID') };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    if (url.match(/(?:youtu\.be\/|youtube\.com\/)/)) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${url.match(/[\w-]{11}/)?.[0]}?rel=0` };
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) return { type: 'audio_file', url };
    return null;
};

const getReputationBadge = (likes, isDev) => {
    if (isDev) return { label: "DEV", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (likes >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (likes >= 100) return { label: "STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

// ==========================================
// BAGIAN 3: KOMPONEN UI (MEMOIZED FOR SPEED)
// ==========================================

// --- IMAGE WITH SMART CACHE (VERSI RINGAN) ---
const ImageWithRetry = React.memo(({ src, alt, className, fallbackText }) => {
    // Langsung cek cache sebelum render pertama
    const cachedStatus = globalImageCache.get(src);
    const [status, setStatus] = useState(cachedStatus || 'loading'); 
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (cachedStatus) {
            setStatus(cachedStatus);
        } else {
            // Preload image in background
            const img = new Image();
            img.src = src;
            img.onload = () => { globalImageCache.set(src, 'loaded'); setStatus('loaded'); };
            img.onerror = () => { 
                // Auto retry logic in background
                setTimeout(() => {
                    const retryImg = new Image();
                    retryImg.src = src; // Browser tries same URL
                    retryImg.onload = () => { globalImageCache.set(src, 'loaded'); setStatus('loaded'); };
                    retryImg.onerror = () => setStatus('error');
                }, 3000);
            };
        }
    }, [src, cachedStatus]);

    if (status === 'error' || !src) {
        return (
            <div className={`bg-gray-100 flex items-center justify-center text-gray-400 ${className}`}>
                {fallbackText ? <span className="font-bold text-lg text-sky-500">{fallbackText[0]}</span> : <AlertCircle size={20}/>}
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
    const [playing, setPlaying] = useState(false);
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

// --- GUEST LIMIT OVERLAY ---
const GuestLimitModal = ({ onClose, onLogin }) => (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl transform scale-100">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600"><Lock size={32}/></div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Akses Terbatas</h3>
            <p className="text-sm text-gray-600 mb-6">Mode Tamu hanya bisa melihat 5 postingan awal. Login untuk akses penuh, like, dan komentar!</p>
            <div className="space-y-3">
                <button onClick={onLogin} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl shadow-lg hover:bg-sky-700">Login / Daftar Sekarang</button>
                <button onClick={onClose} className="text-gray-400 text-xs font-bold hover:text-gray-600">Kembali ke Atas (Batal)</button>
            </div>
        </div>
    </div>
);

// --- POST ITEM (HEAVILY OPTIMIZED WITH MEMO) ---
// React.memo mencegah re-render jika props tidak berubah
const PostItem = React.memo(({ post, currentUserId, isGuest, onInteraction, goToProfile, isMeDeveloper }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    const isOwner = post.userId === currentUserId;
    const badge = getReputationBadge(0, post.user?.email === DEVELOPER_EMAIL); // Simplifikasi badge render

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
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: "User", timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            setNewComment('');
        } catch (e) {}
    };

    // Load comments lazy
    useEffect(() => {
        if (!showComments) return;
        return onSnapshot(query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id), orderBy('timestamp', 'desc'), limit(20)), s => setComments(s.docs.map(d=>({id:d.id,...d.data()}))));
    }, [showComments, post.id]);

    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);

    return (
        <div className="bg-white rounded-[1.5rem] p-4 mb-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3" onClick={() => !isGuest && goToProfile(post.userId)}>
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                        <ImageWithRetry src={post.user?.photoURL} className="w-full h-full object-cover" fallbackText={post.user?.username}/>
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
                    <button onClick={() => deleteDoc(doc(db, getPublicCollection('posts'), post.id))} className="text-gray-300 hover:text-red-500"><Trash size={16}/></button>
                )}
            </div>

            {post.title && <h3 className="font-bold text-gray-800 mb-1">{post.title}</h3>}
            <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>

            {embed?.type === 'audio_file' && <AudioPlayer src={embed.url} />}
            {embed?.type === 'youtube' && <div className="aspect-video rounded-xl overflow-hidden mb-3"><iframe src={embed.embedUrl} className="w-full h-full border-0"/></div>}
            {post.mediaUrl && !embed && post.mediaType === 'image' && (
                <div className="rounded-xl overflow-hidden mb-3 bg-gray-50 border border-gray-100">
                    <ImageWithRetry src={post.mediaUrl} className="w-full max-h-[400px] object-contain bg-gray-50"/>
                </div>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold ${liked ? 'text-rose-500' : 'text-gray-400'}`}>
                    <Heart size={18} fill={liked ? "currentColor" : "none"}/> {likeCount}
                </button>
                <button onClick={() => isGuest ? onInteraction() : setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <MessageSquare size={18}/> {post.commentsCount || 0}
                </button>
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

// ==========================================
// BAGIAN 4: SCREENS & AUTH LOGIC
// ==========================================

const AuthScreen = ({ onLoginSuccess, setPage }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);

    const handleAction = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (resetMode) {
                await sendPasswordResetEmail(auth, email);
                alert("Link reset password telah dikirim ke email!");
                setResetMode(false);
            } else if (isLogin) {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                if (!userCred.user.emailVerified) {
                    await signOut(auth); // Force logout if not verified
                    throw new Error("Email belum diverifikasi! Cek inbox/spam anda.");
                }
            } else {
                if (!username.trim()) throw new Error("Username wajib diisi");
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                
                // KIRIM EMAIL VERIFIKASI
                await sendEmailVerification(userCred.user);
                
                // SIMPAN PROFILE
                await setDoc(doc(db, getPublicCollection('userProfiles'), userCred.user.uid), { 
                    username: username.trim(), email, createdAt: serverTimestamp(), uid: userCred.user.uid, 
                    photoURL: '', following: [], followers: [], savedPosts: [], isVerified: false
                });

                await signOut(auth); // Logout agar user login ulang setelah verifikasi
                alert("Pendaftaran berhasil! Silakan CEK EMAIL untuk verifikasi akun sebelum login.");
                setIsLogin(true);
            }
            if(!resetMode && isLogin) onLoginSuccess();
        } catch (err) { setError(err.message.replace('Firebase:', '').replace('auth/', '')); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X/></button>
                <h2 className="text-2xl font-black text-gray-800 mb-1">{resetMode ? 'Reset Sandi' : (isLogin ? 'Login' : 'Daftar')}</h2>
                <p className="text-gray-400 text-xs mb-6">Masuk ke komunitas {APP_NAME}</p>
                {error && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 border border-red-100 flex items-center gap-2"><AlertTriangle size={14}/> {error}</div>}
                
                <form onSubmit={handleAction} className="space-y-3">
                    {!isLogin && !resetMode && <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3 border border-gray-200"><User size={16} className="text-gray-400"/><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="bg-transparent text-sm outline-none w-full" required/></div>}
                    <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3 border border-gray-200"><Mail size={16} className="text-gray-400"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email Asli" className="bg-transparent text-sm outline-none w-full" required/></div>
                    {!resetMode && <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3 border border-gray-200"><Lock size={16} className="text-gray-400"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="bg-transparent text-sm outline-none w-full" required/></div>}
                    <button disabled={loading} className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-sky-700 transition disabled:opacity-50">{loading ? 'Memproses...' : (resetMode ? 'Kirim Link Reset' : (isLogin ? 'Masuk' : 'Daftar & Verifikasi'))}</button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-500 space-y-2">
                    {!resetMode && <p>{isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} <button onClick={()=>setIsLogin(!isLogin)} className="font-bold text-sky-600 ml-1">{isLogin ? 'Daftar' : 'Login'}</button></p>}
                    <button onClick={()=>setResetMode(!resetMode)} className="text-gray-400 hover:text-sky-600">{resetMode ? 'Kembali ke Login' : 'Lupa Password?'}</button>
                </div>
            </div>
        </div>
    );
};

const HomeScreen = ({ user, profile, allPosts, setPage, isGuest }) => {
    const [showGuestLimit, setShowGuestLimit] = useState(false);
    
    // LOGIC: Batasi 5 postingan untuk Guest
    const visiblePosts = isGuest ? allPosts.slice(0, 5) : allPosts;

    const handleInteraction = () => {
        if (isGuest) setShowGuestLimit(true);
    };

    return (
        <div className="max-w-lg mx-auto pb-24 px-4 pt-4">
            {/* Header Sederhana */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <img src={APP_LOGO} className="w-8 h-8 rounded-full bg-sky-100 p-1"/>
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

            {/* Feed List - Optimized */}
            {visiblePosts.map(p => (
                <PostItem 
                    key={p.id} 
                    post={p} 
                    currentUserId={user?.uid} 
                    isGuest={isGuest}
                    onInteraction={handleInteraction}
                    goToProfile={(uid) => { console.log(uid); }} 
                    isMeDeveloper={false}
                />
            ))}

            {isGuest && (
                <div className="text-center py-8 bg-sky-50 rounded-2xl border border-sky-100 mt-4">
                    <Lock className="mx-auto text-sky-400 mb-2"/>
                    <p className="text-sm font-bold text-gray-600 mb-2">Ingin melihat lebih banyak?</p>
                    <button onClick={() => setPage('auth')} className="bg-sky-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg">Login Sekarang</button>
                </div>
            )}

            {!isGuest && visiblePosts.length > 0 && (
                <div className="h-20 flex items-center justify-center text-gray-300 text-xs font-bold italic">
                    -- Anda sudah di ujung dunia --
                </div>
            )}

            {showGuestLimit && <GuestLimitModal onClose={() => setShowGuestLimit(false)} onLogin={() => setPage('auth')} />}
        </div>
    );
};

const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null });
    const [loading, setLoading] = useState(false); 
    const [prog, setProg] = useState(0);

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let finalUrl = '', type = 'text';
            if(form.file) { 
                const compressed = await compressImage(form.file);
                finalUrl = await uploadToFirebaseStorage(compressed, setProg); 
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
                {loading && <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
                <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang Anda pikirkan?" rows="5" className="w-full p-4 bg-gray-50 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-sky-100 transition"/>
                
                <label className={`flex items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition ${form.file ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <div className="text-center">
                        <ImageIcon className={`mx-auto mb-2 ${form.file ? 'text-sky-500' : 'text-gray-300'}`} size={24}/>
                        <span className="text-xs font-bold text-gray-400">{form.file ? 'Foto Siap Upload' : 'Tambah Foto'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={e=>setForm({...form, file:e.target.files[0]})}/>
                </label>

                <button disabled={loading || !form.content} className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-200 disabled:opacity-50 hover:bg-sky-700 transition">Posting</button>
            </form>
        </div>
    );
};

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
                <button onClick={onLogin} className="w-full py-4 bg-white text-sky-900 font-black rounded-2xl shadow-xl hover:scale-105 transition transform">Masuk / Daftar Akun</button>
                <button onClick={onClose} className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/20 transition">Nanti Saja (Mode Tamu)</button>
            </div>
            <p className="text-white/40 text-[10px] mt-6">Mode tamu memiliki akses terbatas.</p>
        </div>
    </div>
);

// --- APP CORE (DENGAN GUEST MODE LOGIC) ---
const App = () => {
    const [user, setUser] = useState(null); 
    const [profile, setProfile] = useState(null); 
    const [posts, setPosts] = useState([]); 
    const [page, setPage] = useState('home'); 
    
    // Logic Guest Mode
    const [isGuest, setIsGuest] = useState(true); 
    const [showWelcome, setShowWelcome] = useState(true); 

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, u => {
            if (u && u.emailVerified) {
                setUser(u);
                setIsGuest(false);
                setShowWelcome(false);
                // Load Profile
                onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), s => {
                    if (s.exists()) setProfile({...s.data(), uid: u.uid});
                });
            } else {
                // User logout / Guest
                setUser(null);
                setProfile(null);
                setIsGuest(true);
                // Cek apakah baru pertama kali buka (pakai localStorage)
                const hasVisited = localStorage.getItem('has_visited');
                if (hasVisited) setShowWelcome(false);
            }
        });
        return () => unsubAuth();
    }, []);

    // Load Posts (Hemat Resource: Hanya load sekali atau real-time jika perlu)
    useEffect(() => {
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, s => {
            setPosts(s.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsub();
    }, []);

    const handleGuestLogin = () => {
        setPage('auth');
        setShowWelcome(false);
    };

    const handleGuestCancel = () => {
        setShowWelcome(false);
        localStorage.setItem('has_visited', 'true');
    };

    if (page === 'auth') return <AuthScreen onLoginSuccess={() => setPage('home')} setPage={setPage} />;

    return (
        <div className="bg-white min-h-screen font-sans text-gray-900">
            {showWelcome && <GuestWelcomeModal onLogin={handleGuestLogin} onClose={handleGuestCancel} />}
            
            <main>
                {page === 'home' && <HomeScreen user={user} profile={profile} allPosts={posts} setPage={setPage} isGuest={isGuest} />}
                {page === 'create' && <CreatePost setPage={setPage} userId={user?.uid} username={profile?.username} onSuccess={() => setPage('home')} />}
            </main>

            {/* Bottom Nav (Hanya muncul jika bukan mode create/auth) */}
            {page !== 'create' && page !== 'auth' && (
                <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe px-6 py-3 flex justify-around items-center z-50">
                    <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                    
                    {/* Tombol Create (Tengah) - Jika Guest, arahkan ke Login */}
                    <button onClick={() => isGuest ? setPage('auth') : setPage('create')} className="bg-sky-600 text-white p-3 rounded-full shadow-lg hover:bg-sky-700 hover:scale-110 transition transform">
                        <PlusCircle size={24}/>
                    </button>
                    
                    <NavBtn icon={User} active={page==='profile'} onClick={() => isGuest ? setPage('auth') : setPage('profile')}/>
                </nav>
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2 rounded-xl transition ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    </button>
);

export default App;