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

// IMPORT ICON
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    Trash2, X, Check, Search, UserCheck, ChevronRight, Share2, Youtube, Flame, 
    Bell, Gift, Crown, Gem, ShieldCheck, PlusCircle, ArrowLeft,
    CheckCircle, ExternalLink, ChevronLeft, MoreHorizontal, ShieldAlert, Zap,
    Activity, Users, BarChart3, Megaphone, Radio, Globe, LayoutGrid, XCircle, RefreshCw, Hash
} from 'lucide-react';

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; 
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
// BAGIAN 2: UTILITY FUNCTIONS
// ==========================================

const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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
            toUserId: toUserId, 
            fromUserId: fromUser.uid, 
            fromUsername: fromUser.username, 
            fromPhoto: fromUser.photoURL || '',
            type: type, 
            message: message, 
            postId: postId, 
            isRead: false, 
            timestamp: serverTimestamp()
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

const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

// ==========================================
// BAGIAN 3: COMPONENTS
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

const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    useEffect(() => { document.body.style.overflow = 'hidden'; return () => document.body.style.overflow = 'auto'; }, []);
    const next = (e) => { e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length); };
    const prev = (e) => { e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length); };

    return (
        <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-gray-800/50 rounded-full z-[80]"><X size={24}/></button>
            <div className="relative w-full h-full flex items-center justify-center p-4">
                <img src={images[index]} className="max-w-full max-h-full object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
                {images.length > 1 && (
                    <>
                        <button onClick={prev} className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md"><ChevronLeft size={32}/></button>
                        <button onClick={next} className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md"><ChevronRight size={32}/></button>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-1 rounded-full text-xs font-bold backdrop-blur-sm">{index + 1} / {images.length}</div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- SETUP PROFILE (WAJIB UTK USER BARU) ---
const SetupProfile = ({ user, onComplete, allUsers }) => {
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validasi Simple
        if(username.length < 3) return setError("Username minimal 3 karakter.");
        if(!/^[a-zA-Z0-9_]+$/.test(username)) return setError("Username hanya boleh huruf, angka, dan underscore.");
        
        // Cek Unik (Client side check vs existing loaded users for simplicity in this env)
        const isTaken = allUsers.some(u => u.username?.toLowerCase() === username.toLowerCase() && u.uid !== user.uid);
        if(isTaken) return setError("Username sudah dipakai orang lain.");

        setLoading(true);
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {
                username: username,
                bio: bio,
                isSetup: true, // Flag penanda profil lengkap
                usernameLower: username.toLowerCase() // Untuk search case insensitive nanti
            });
            onComplete();
        } catch (err) {
            setError("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-[65] flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain"/>
                    <h2 className="text-2xl font-black text-gray-800">Selamat Datang!</h2>
                    <p className="text-gray-500 text-sm">Lengkapi profilmu sebelum memulai.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Username (Unik)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400">@</span>
                            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-gray-50 pl-8 p-3 rounded-xl border border-gray-200 outline-none focus:border-sky-500" placeholder="username_keren" required/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Bio (Opsional)</label>
                        <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 outline-none focus:border-sky-500" placeholder="Ceritakan sedikit tentangmu..." rows="3"/>
                    </div>
                    
                    {error && <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2"><ShieldAlert size={14}/>{error}</div>}
                    
                    <button disabled={loading} className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : "Simpan Profil"}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- POST ITEM ---
const PostItem = ({ post, currentUserId, profile, triggerLogin, goToProfile, goToTag }) => {
    const isGuest = currentUserId === 'guest';
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
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
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        navigator.clipboard.writeText(url);
        alert("Link postingan disalin! Bagikan ke temanmu.");
    };

    // Render Text dengan Hashtag & Read More
    const renderContent = () => {
        const text = post.content || '';
        const shouldTruncate = text.length > 200 && !isExpanded;
        const displayText = shouldTruncate ? text.slice(0, 200) + '...' : text;
        
        // Regex untuk hashtag
        const parts = displayText.split(/(#\w+)/g);
        
        return (
            <div className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                {parts.map((part, i) => {
                    if (part.startsWith('#')) {
                        return <span key={i} onClick={(e)=>{e.stopPropagation(); goToTag(part)}} className="text-sky-600 font-bold cursor-pointer hover:underline">{part}</span>;
                    }
                    return part;
                })}
                {text.length > 200 && (
                    <button onClick={()=>setIsExpanded(!isExpanded)} className="ml-1 text-xs font-bold text-gray-400 hover:text-sky-500">
                        {isExpanded ? 'Lebih sedikit' : 'Baca selengkapnya'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
            
            <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-sm border border-gray-100 relative group transition-all hover:shadow-md">
                {/* Header Post */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-sky-200 to-purple-200">
                            <img src={post.user?.photoURL || APP_LOGO} className="w-full h-full rounded-full object-cover border-2 border-white"/>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">
                                {post.user?.username}
                                {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-50"/>}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                                {post.category && <span className="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase font-bold">{post.category}</span>}
                            </div>
                        </div>
                    </div>
                    {post.userId === currentUserId && (
                        <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                    )}
                </div>

                {post.title && <h3 className="font-bold text-gray-900 mb-2">{post.title}</h3>}
                {renderContent()}

                {/* Media */}
                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <div className={`mb-4 rounded-2xl overflow-hidden grid gap-1 cursor-pointer ${
                        mediaList.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}>
                        {mediaList.slice(0, 4).map((url, i) => (
                            <div key={i} onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }} className={`relative bg-gray-100 ${
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

                {post.mediaUrl && post.mediaUrl.includes('youtube') && (
                    <div className="mb-4 rounded-2xl overflow-hidden aspect-video bg-black shadow-lg">
                        <iframe src={`https://www.youtube.com/embed/${post.mediaUrl.split('v=')[1] || post.mediaUrl.split('/').pop()}`} className="w-full h-full border-0" allowFullScreen></iframe>
                    </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex gap-6">
                        <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Heart size={20} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500">
                            <MessageSquare size={20}/> {post.commentsCount || 0}
                        </button>
                    </div>
                    <button onClick={sharePost} className="text-gray-400 hover:text-sky-500 transition flex items-center gap-1 text-xs font-bold"><Share2 size={18}/> Share</button>
                </div>
            </div>
        </>
    );
};

// --- CREATE POST ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', youtubeUrl: '', category: 'Umum' });
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
            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, 
                title: form.title, 
                content: form.content, 
                category: form.category,
                timestamp: serverTimestamp(),
                likes: [], 
                commentsCount: 0, 
                user: { username, uid: userId },
                mediaType: images.length > 0 ? 'image' : (form.youtubeUrl ? 'video' : 'text'),
                mediaUrl: form.youtubeUrl ? form.youtubeUrl : (images[0] || ''),
                mediaUrls: images
            });
            onSuccess();
        } catch(e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24 animate-in slide-in-from-bottom-10">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 mt-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-800">Buat Postingan</h2>
                    <button onClick={() => setPage('home')} className="p-2 bg-gray-100 rounded-full"><X size={18}/></button>
                </div>
                
                <form onSubmit={submit} className="space-y-4">
                    <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold outline-none">
                        <option value="Umum">Kategori: Umum</option>
                        <option value="Meme">Meme & Lucu</option>
                        <option value="Tanya Jawab">Tanya Jawab</option>
                        <option value="Berita">Berita & Info</option>
                    </select>

                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi? Gunakan #hashtag untuk topik." rows="5" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none resize-none"/>
                    
                    <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                            <div key={i} className="w-20 h-20 rounded-xl overflow-hidden relative border border-gray-200">
                                <img src={img} className="w-full h-full object-cover"/>
                                <button type="button" onClick={()=>setImages(images.filter((_,idx)=>idx!==i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X size={10}/></button>
                            </div>
                        ))}
                        {images.length < 5 && (
                            <label className="w-20 h-20 rounded-xl bg-sky-50 border-2 border-dashed border-sky-200 flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 text-sky-500">
                                <ImageIcon size={20}/>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} disabled={loading}/>
                            </label>
                        )}
                    </div>

                    <div className="relative">
                        <Youtube size={18} className="absolute left-3 top-3 text-red-500"/>
                        <input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} disabled={images.length>0} placeholder="Link YouTube..." className="w-full pl-10 p-3 bg-gray-50 rounded-xl text-xs outline-none disabled:opacity-50"/>
                    </div>

                    <button disabled={loading || (!form.content && images.length===0)} className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-sky-700 transition">
                        {loading ? <Loader2 className="animate-spin"/> : <><Send size={18}/> Posting</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- NOTIFICATION SCREEN ---
const NotificationScreen = ({ userId, goToPost }) => {
    const [notifs, setNotifs] = useState([]);
    useEffect(() => {
        // Query notifikasi milik user ini
        // Note: Karena keterbatasan index di environment ini, kita ambil semua notif dan filter client side (not ideal for production but works here)
        // Atau ambil berdasarkan userId jika permission allow tanpa index.
        const q = query(collection(db, getPublicCollection('notifications')), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, (s) => {
            const data = s.docs.map(d => ({id:d.id, ...d.data()})).filter(n => n.toUserId === userId);
            setNotifs(data);
        });
        return unsub;
    }, [userId]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2"><Bell className="text-sky-500"/> Notifikasi</h1>
            <div className="space-y-2">
                {notifs.length === 0 && <div className="text-center text-gray-400 mt-10">Belum ada notifikasi.</div>}
                {notifs.map(n => (
                    <div key={n.id} onClick={()=>n.postId && goToPost(n.postId)} className={`bg-white p-4 rounded-2xl border ${n.isRead ? 'border-gray-50' : 'border-sky-100 bg-sky-50/30'} flex items-center gap-3 cursor-pointer hover:bg-gray-50`}>
                        <img src={n.fromPhoto || APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200"/>
                        <div className="flex-1">
                            <p className="text-sm text-gray-800">
                                <span className="font-bold">{n.fromUsername}</span> {n.message}
                            </p>
                            <span className="text-[10px] text-gray-400">{formatTimeAgo(n.timestamp).relative}</span>
                        </div>
                        {n.type === 'like' && <Heart size={16} className="text-rose-500"/>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- RANKING / LEADERBOARD ---
const RankingScreen = ({ allUsers }) => {
    const sortedUsers = [...allUsers].sort((a,b) => {
        // Hitung total reputasi (dummy logic: followers + random reputation point jika belum ada data post likes aggregate)
        // Di real app, kita hitung total likes dari semua post user. Disini kita pakai data 'followers' array length sebagai proxy popularitas
        const scoreA = (a.followers?.length || 0) * 10;
        const scoreB = (b.followers?.length || 0) * 10;
        return scoreB - scoreA;
    });

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
             <h1 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Peringkat</h1>
             <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100">
                {sortedUsers.slice(0, 10).map((u, i) => (
                    <div key={u.uid} className="flex items-center gap-4 p-3 border-b border-gray-50 last:border-0">
                        <div className={`w-8 h-8 flex items-center justify-center font-black rounded-full ${i===0?'bg-yellow-100 text-yellow-600':i===1?'bg-gray-100 text-gray-600':i===2?'bg-orange-100 text-orange-600':'text-gray-400'}`}>
                            {i+1}
                        </div>
                        <img src={u.photoURL || APP_LOGO} className="w-10 h-10 rounded-full object-cover"/>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm">{u.username}</h4>
                            <p className="text-[10px] text-gray-400">Reputasi: {(u.followers?.length||0)*10} Poin</p>
                        </div>
                        {i===0 && <Crown size={20} className="text-yellow-500"/>}
                    </div>
                ))}
             </div>
        </div>
    );
}

// --- PROFILE SCREEN ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, triggerLogin }) => {
    const isGuest = viewerProfile.uid === 'guest';
    const isSelf = viewerProfile.uid === profileData.uid;
    const isDev = profileData.email === DEVELOPER_EMAIL;
    
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const userPosts = allPosts.filter(p => p.userId === profileData.uid);
    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);

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
                </div>

                <h1 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-2">
                    {profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-600"/>}
                </h1>
                <p className="text-sm text-gray-500 mb-2">{profileData.bio || "Belum ada bio."}</p>
                
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

            <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
                <button onClick={()=>setActiveTab('posts')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='posts'?'bg-sky-50 text-sky-600':'text-gray-400'}`}>Postingan</button>
                <button onClick={()=>setActiveTab('likes')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='likes'?'bg-rose-50 text-rose-600':'text-gray-400'}`}>Disukai</button>
            </div>

            <div className="space-y-4">
                {activeTab === 'posts' && (
                    userPosts.length > 0 ? userPosts.map(p => (
                        <PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} triggerLogin={triggerLogin} goToProfile={()=>{}} goToTag={()=>{}}/>
                    )) : <div className="text-center text-gray-400 py-10">Belum ada postingan.</div>
                )}
                 {activeTab === 'likes' && <div className="text-center text-gray-400 py-10">Fitur riwayat like akan segera hadir.</div>}
            </div>

            {showDev && <DeveloperDashboard onClose={()=>setShowDev(false)}/>}
        </div>
    );
};

// --- DEVELOPER DASHBOARD ---
const DeveloperDashboard = ({ onClose }) => {
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [stats, setStats] = useState({ users: 0, posts: 0 });

    useEffect(() => {
        const uSub = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setStats(prev => ({...prev, users: s.size})));
        const pSub = onSnapshot(collection(db, getPublicCollection('posts')), s => setStats(prev => ({...prev, posts: s.size})));
        return () => { uSub(); pSub(); };
    }, []);

    const handleBroadcast = async () => {
        if(!broadcastMsg.trim() || !confirm("Kirim ke SEMUA user?")) return;
        alert("Broadcast tersend (Simulasi).");
        setBroadcastMsg('');
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-[60] overflow-y-auto p-4 animate-in slide-in-from-bottom">
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
            </div>
        </div>
    );
};

// --- AUTH SCREEN ---
const AuthScreen = ({ onLoginSuccess, onCancel }) => {
    const [loading, setLoading] = useState(false);
    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const user = res.user;
            const ref = doc(db, getPublicCollection('userProfiles'), user.uid);
            const snap = await getDoc(ref);
            // Jangan overwrite jika user sudah ada
            if (!snap.exists()) {
                await setDoc(ref, { 
                    email: user.email, uid: user.uid, photoURL: user.photoURL,
                    username: user.displayName, // Username sementara
                    followers: [], following: [], createdAt: serverTimestamp(), role: 'user',
                    isSetup: false // Perlu setup
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
                    <p className="text-gray-500 text-sm">Bergabung dengan komunitas {APP_NAME}</p>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 py-3 rounded-full font-bold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition">
                    {loading ? <Loader2 className="animate-spin text-sky-500"/> : "Lanjutkan dengan Google"}
                </button>
            </div>
        </div>
    );
};

// ==========================================
// BAGIAN 4: APP UTAMA & LOGIC FEED
// ==========================================

const App = () => {
    const [user, setUser] = useState(undefined);
    const [profile, setProfile] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]);
    const [users, setUsers] = useState([]);
    const [targetUid, setTargetUid] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    
    // Feed State
    const [feedType, setFeedType] = useState('foryou'); // foryou, latest, popular, meme
    const [displayLimit, setDisplayLimit] = useState(5); // Start with 5 posts
    const [refreshing, setRefreshing] = useState(false);
    const [hashtagFilter, setHashtagFilter] = useState('');

    const GUEST = useMemo(()=>({ uid:'guest', username:'Tamu', photoURL:'' }), []);

    useEffect(() => { setTimeout(() => setShowSplash(false), 2500); }, []);

    // Deep Linking Handler (Share Link)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        if (postId) {
            setHashtagFilter(`id:${postId}`); // Hacky way to reuse filter logic
            setPage('home');
        }
    }, []);

    // Load Users & Auth
    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => {
            setUsers(s.docs.map(d=>({uid:d.id, ...d.data()})));
        });

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
        return () => { unsubAuth(); unsubUsers(); };
    }, []);

    // Load Posts Logic
    useEffect(() => {
        // Query semua posts, filter di client (karena limitasi index compound firestore di environment ini)
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(100));
        
        const unsubPosts = onSnapshot(q, s => {
            let data = s.docs.map(d=>({id:d.id, ...d.data()}));
            
            // Filter by hashtag or ID
            if (hashtagFilter) {
                if(hashtagFilter.startsWith('id:')) {
                    const id = hashtagFilter.split(':')[1];
                    data = data.filter(p => p.id === id);
                } else {
                    data = data.filter(p => p.content?.includes(hashtagFilter) || p.category === hashtagFilter);
                }
            } else {
                // Algoritma Feed
                if (feedType === 'meme') {
                    data = data.filter(p => p.category === 'Meme' || p.content?.toLowerCase().includes('meme') || p.content?.toLowerCase().includes('lucu'));
                } else if (feedType === 'popular') {
                    data = data.sort((a,b) => (b.likes?.length||0) - (a.likes?.length||0));
                } else if (feedType === 'foryou') {
                    // Random shuffle simple
                    data = data.sort(() => Math.random() - 0.5);
                }
                // 'latest' is default (timestamp desc)
            }

            setPosts(data);
            setRefreshing(false);
        });

        return () => unsubPosts();
    }, [feedType, hashtagFilter]);

    // Infinite Scroll / Load More Logic
    const handleScroll = (e) => {
        const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
        if (bottom) setDisplayLimit(prev => prev + 5);
    };

    const triggerLogin = () => setShowLogin(true);

    const handleRefresh = () => {
        setRefreshing(true);
        // Simulate refresh delay
        setTimeout(() => setRefreshing(false), 1000);
    };

    if (showSplash) return <SplashScreen/>;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500"/></div>;

    // Force Setup Profile if needed
    if (user && profile && !profile.isSetup && profile.uid !== 'guest') {
        return <SetupProfile user={user} allUsers={users} onComplete={()=>window.location.reload()}/>;
    }

    // Prepare Posts for Display
    const displayedPosts = posts.slice(0, displayLimit);

    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800" onScroll={handleScroll}>
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>{setPage('home'); setHashtagFilter(''); setDisplayLimit(5);}}>
                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                </div>
                <div className="flex gap-2">
                    {page === 'home' && (
                        <button onClick={handleRefresh} className={`p-2 rounded-full bg-gray-100 ${refreshing ? 'animate-spin' : ''}`}>
                            <RefreshCw size={18} className="text-gray-600"/>
                        </button>
                    )}
                    {isGuest ? (
                        <button onClick={triggerLogin} className="bg-sky-600 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg shadow-sky-200">Masuk</button>
                    ) : (
                        <button onClick={()=>signOut(auth)} className="bg-gray-100 text-rose-500 p-2 rounded-full"><LogOut size={18}/></button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-24 min-h-screen">
                {page === 'home' && (
                    <div className="max-w-lg mx-auto px-4">
                        {/* Feed Filter Tabs */}
                        {!hashtagFilter && (
                            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
                                {[
                                    {id:'foryou', label:'Untuk Anda'},
                                    {id:'latest', label:'Terbaru'},
                                    {id:'popular', label:'Populer'},
                                    {id:'meme', label:'Meme'}
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={()=>{setFeedType(tab.id); setDisplayLimit(5);}}
                                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${feedType===tab.id ? 'bg-black text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hashtagFilter && (
                            <div className="flex items-center justify-between bg-sky-100 text-sky-700 px-4 py-3 rounded-xl mb-4">
                                <span className="font-bold text-sm">Filter: {hashtagFilter}</span>
                                <button onClick={()=>setHashtagFilter('')}><X size={16}/></button>
                            </div>
                        )}
                        
                        {displayedPosts.length===0 && !refreshing ? (
                            <div className="text-center py-10">
                                <p className="text-gray-400 font-bold">Tidak ada postingan.</p>
                                <button onClick={()=>setHashtagFilter('')} className="text-sky-500 text-sm mt-2">Reset Filter</button>
                            </div>
                        ) : (
                            displayedPosts.map(p => (
                                <PostItem 
                                    key={p.id} 
                                    post={p} 
                                    currentUserId={profile.uid} 
                                    profile={profile} 
                                    triggerLogin={triggerLogin} 
                                    goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}
                                    goToTag={(tag)=>setHashtagFilter(tag)}
                                />
                            ))
                        )}
                        
                        {posts.length > displayLimit && (
                            <button onClick={()=>setDisplayLimit(prev=>prev+5)} className="w-full py-3 text-sky-600 font-bold text-sm bg-sky-50 rounded-xl mt-4">
                                Muat Lebih Banyak
                            </button>
                        )}
                    </div>
                )}
                
                {page === 'search' && (
                    <div className="max-w-lg mx-auto p-4">
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                            <input 
                                onChange={e=>setHashtagFilter(e.target.value)} 
                                placeholder="Cari user, topik, atau #hashtag..." 
                                className="w-full bg-white pl-12 pr-4 py-3 rounded-2xl shadow-sm border border-transparent focus:border-sky-200 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {users.map(u => (
                                <div key={u.uid} onClick={()=>{setTargetUid(u.uid); setPage('other-profile')}} className="bg-white p-3 rounded-xl flex items-center gap-3 cursor-pointer shadow-sm border border-gray-50">
                                    <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full object-cover"/>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-sm truncate">{u.username}</h4>
                                        <p className="text-[10px] text-gray-400 truncate">{u.bio || "User"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {page === 'create' && <CreatePost userId={profile.uid} username={profile.username} setPage={setPage} onSuccess={()=>setPage('home')} />}
                
                {page === 'notifications' && <NotificationScreen userId={profile.uid} goToPost={(pid)=>{setHashtagFilter(`id:${pid}`); setPage('home');}} />}
                
                {page === 'ranking' && <RankingScreen allUsers={users} />}

                {page === 'profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} triggerLogin={triggerLogin} />}
                
                {page === 'other-profile' && users.find(u=>u.uid===targetUid) && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-20 left-4 z-40 bg-white/80 p-2 rounded-full shadow-md"><ArrowLeft size={20}/></button>
                        <ProfileScreen viewerProfile={profile} profileData={users.find(u=>u.uid===targetUid)} allPosts={posts} triggerLogin={triggerLogin} />
                    </>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-4 py-2 shadow-2xl shadow-sky-100/50 flex items-center gap-2 z-40">
                <NavBtn icon={Home} active={page==='home'} onClick={()=>{setPage('home'); setHashtagFilter('');}}/>
                <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                <button onClick={()=>isGuest?triggerLogin():setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg hover:scale-110 transition mx-2"><PlusCircle size={24}/></button>
                <NavBtn icon={Crown} active={page==='ranking'} onClick={()=>setPage('ranking')}/>
                <NavBtn icon={Bell} active={page==='notifications'} onClick={()=>isGuest?triggerLogin():setPage('notifications')}/>
                <NavBtn icon={User} active={page==='profile'} onClick={()=>isGuest?triggerLogin():setPage('profile')}/>
            </nav>

            {showLogin && <AuthScreen onLoginSuccess={()=>setShowLogin(false)} onCancel={()=>setShowLogin(false)}/>}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-3 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={22} strokeWidth={active?2.5:2} />
    </button>
);

export default App;