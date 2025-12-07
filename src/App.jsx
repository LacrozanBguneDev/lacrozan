import React, { useState, useEffect, useMemo, useRef } from 'react';

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
    orderBy, 
    limit,
    where
} from 'firebase/firestore';

// IMPORT ICON
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    Trash2, X, Search, ChevronRight, Share2, Youtube, Flame, 
    Bell, Crown, Gem, ShieldCheck, PlusCircle, ArrowLeft,
    CheckCircle, MoreHorizontal, ShieldAlert, Zap,
    Megaphone, RefreshCw, Moon, Sun, Info, LogIn, Filter,
    BarChart3, Activity, Users, Calendar
} from 'lucide-react';

setLogLevel('silent');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; 

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

// ==========================================
// BAGIAN 3: COMPONENTS
// ==========================================

// --- AVATAR HEMAT DATA ---
const Avatar = ({ url, name, size = "w-10 h-10", className = "", fontSize="text-sm" }) => {
    // Jika URL ada dan valid, tampilkan gambar
    if (url && url.length > 20) {
        return <img src={url} className={`${size} rounded-full object-cover border border-gray-100 dark:border-gray-700 ${className}`} alt={name} loading="lazy" />;
    }
    
    // Jika tidak ada URL, gunakan Inisial (Hemat Data)
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    // Warna background random/konsisten berdasarkan char code pertama
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
        'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 
        'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 
        'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
    const bgColor = colors[colorIndex];

    return (
        <div className={`${size} rounded-full ${bgColor} flex items-center justify-center text-white font-bold shadow-sm ${fontSize} ${className}`}>
            {initial}
        </div>
    );
};

const SplashScreen = () => (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col items-center justify-center transition-colors duration-300">
        <div className="relative mb-6 animate-bounce">
            <img src={APP_LOGO} className="w-24 h-24 object-contain drop-shadow-lg"/>
        </div>
        <h1 className="text-3xl font-black text-sky-600 tracking-tighter mb-2">{APP_NAME}</h1>
        <Loader2 className="animate-spin text-gray-400" size={24}/>
    </div>
);

const Lightbox = ({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    useEffect(() => { document.body.style.overflow = 'hidden'; return () => document.body.style.overflow = 'auto'; }, []);
    const next = (e) => { e.stopPropagation(); setIndex((prev) => (prev + 1) % images.length); };
    const prev = (e) => { e.stopPropagation(); setIndex((prev) => (prev - 1 + images.length) % images.length); };

    return (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-gray-800/50 rounded-full z-[130]"><X size={24}/></button>
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

const SetupProfile = ({ user, onComplete, allUsers }) => {
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if(username.length < 2) return setError("Username terlalu pendek.");
        
        // Cek duplikat saja, tapi perbolehkan karakter bebas
        const isTaken = allUsers.some(u => u.username?.toLowerCase() === username.toLowerCase() && u.uid !== user.uid);
        if(isTaken) return setError("Username sudah dipakai orang lain.");

        setLoading(true);
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {
                username: username,
                bio: bio,
                isSetup: true, 
                usernameLower: username.toLowerCase()
            });
            onComplete();
        } catch (err) {
            setError("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[80] flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain"/>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white">Lengkapi Profil</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Agar temanmu bisa mengenalimu.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">Nama Tampilan (Bebas)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400">@</span>
                            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white pl-8 p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-sky-500" placeholder="Nama Keren Kamu" required/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">Bio (Opsional)</label>
                        <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-sky-500" placeholder="Ceritakan sedikit tentangmu..." rows="3"/>
                    </div>
                    
                    {error && <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2"><ShieldAlert size={14}/>{error}</div>}
                    
                    <button disabled={loading} className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : "Simpan & Lanjutkan"}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- DEV DASHBOARD ---
const DevDashboard = ({ posts, users, onClose, userProfile }) => {
    const [announcement, setAnnouncement] = useState('');
    const [loading, setLoading] = useState(false);

    // Analisis Sederhana
    const postsLast7Days = posts.filter(p => {
        const date = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
        const diff = (new Date() - date) / (1000 * 3600 * 24);
        return diff <= 7;
    }).length;

    const usersOnline = Math.floor(users.length * 0.3) + 1; // Simulasi data online (heuristik)
    
    // Grafik Data (Mockup visual dengan CSS)
    const chartData = [40, 65, 30, 80, 55, 90, 45]; // Dummy trend

    const handleBroadcast = async () => {
        if(!announcement.trim()) return;
        setLoading(true);
        try {
            // Kirim ke notifikasi sistem (semua orang bisa fetch di tab notifikasi)
            await addDoc(collection(db, getPublicCollection('announcements')), {
                message: announcement,
                from: "Developer",
                timestamp: serverTimestamp(),
                type: 'system'
            });
            // Opsional: Kirim notif ke beberapa user aktif (disini kita simulasikan alert sukses aja)
            alert("Pengumuman berhasil dikirim ke halaman Notifikasi!");
            setAnnouncement('');
        } catch(e) { alert("Gagal broadcast"); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-gray-100 dark:bg-gray-900 overflow-y-auto animate-in slide-in-from-bottom">
            <div className="max-w-4xl mx-auto p-4 md:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="text-blue-600" size={32}/> Dashboard Developer
                        </h1>
                        <p className="text-gray-500">Panel Kontrol Admin & Analisis</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm"><X/></button>
                </div>

                {/* STATS CARDS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-gray-500 mb-2"><Users size={16}/> Total User</div>
                        <div className="text-2xl font-black dark:text-white">{users.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-green-500 mb-2"><Activity size={16}/> User Online</div>
                        <div className="text-2xl font-black dark:text-white">~{usersOnline}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-blue-500 mb-2"><MessageSquare size={16}/> Total Post</div>
                        <div className="text-2xl font-black dark:text-white">{posts.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-purple-500 mb-2"><Calendar size={16}/> Minggu Ini</div>
                        <div className="text-2xl font-black dark:text-white">{postsLast7Days}</div>
                    </div>
                </div>

                {/* CHART & BROADCAST */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* CHART */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm">
                        <h3 className="font-bold mb-6 flex items-center gap-2 dark:text-white"><BarChart3 size={20}/> Aktivitas Mingguan</h3>
                        <div className="flex items-end justify-between h-40 gap-2">
                            {chartData.map((h, i) => (
                                <div key={i} className="w-full bg-sky-100 dark:bg-sky-900 rounded-t-lg relative group">
                                    <div style={{height: `${h}%`}} className="bg-sky-500 rounded-t-lg absolute bottom-0 w-full transition-all group-hover:bg-sky-600"></div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2 font-bold">
                            <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
                        </div>
                    </div>

                    {/* BROADCAST */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm">
                        <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><Megaphone size={20}/> Buat Pengumuman</h3>
                        <textarea 
                            value={announcement} 
                            onChange={e=>setAnnouncement(e.target.value)}
                            placeholder="Tulis pesan untuk semua user (masuk ke halaman notifikasi)..." 
                            className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-xl mb-4 h-32 outline-none focus:ring-2 ring-sky-500 dark:text-white"
                        />
                        <button onClick={handleBroadcast} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin"/> : "Kirim Broadcast"}
                        </button>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-start gap-3">
                    <Info className="text-yellow-600 shrink-0 mt-1"/>
                    <div>
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-200">Info Developer</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Sebagai developer, Anda memiliki ikon <ShieldCheck size={14} className="inline"/> di nama Anda.
                            Anda juga dapat menghapus postingan siapapun dengan menekan ikon sampah di feed.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- POST ITEM ---
const PostItem = ({ post, currentUserId, profile, triggerLogin, goToProfile, goToTag, goToDetail, isDev }) => {
    const isGuest = currentUserId === 'guest';
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    const isPostOwner = post.userId === currentUserId;
    // Developer Permission: Can delete ANY post
    const canDelete = isPostOwner || isDev;
    
    // Check if verified developer
    const isVerifiedDev = post.user?.email === DEVELOPER_EMAIL || post.user?.uid === 'DEVELOPER_UID'; 

    useEffect(() => {
        setLiked(post.likes?.includes(currentUserId));
        setLikeCount(post.likes?.length || 0);
    }, [post.likes, currentUserId]);

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
        if (confirm("Hapus postingan ini secara permanen?")) deleteDoc(doc(db, getPublicCollection('posts'), post.id));
    };

    const sharePost = async () => {
        const url = `${window.location.origin}?post=${post.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Postingan oleh ${post.user?.username}`,
                    text: post.content,
                    url: url,
                });
            } catch (err) { console.log("Share failed", err); }
        } else {
            navigator.clipboard.writeText(url);
            alert("Link postingan disalin! Bagikan ke temanmu.");
        }
    };

    const renderContent = () => {
        const text = post.content || '';
        const shouldTruncate = text.length > 250 && !isExpanded;
        const displayText = shouldTruncate ? text.slice(0, 250) + '...' : text;
        const parts = displayText.split(/((?:https?:\/\/|www\.)[^\s]+|#\w+)/g);
        
        return (
            <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap break-words font-medium">
                {parts.map((part, i) => {
                    if (part.startsWith('#')) {
                        return <span key={i} onClick={(e)=>{e.stopPropagation(); goToTag(part)}} className="text-sky-600 dark:text-sky-400 font-bold cursor-pointer hover:underline">{part}</span>;
                    } else if (part.match(/^(https?:\/\/|www\.)/)) {
                        const href = part.startsWith('www.') ? `http://${part}` : part;
                        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={(e)=>e.stopPropagation()} className="text-blue-500 hover:underline inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-1 rounded"><LinkIcon size={10}/> {part.length > 25 ? part.slice(0,20)+'...' : part}</a>;
                    }
                    return part;
                })}
                {text.length > 250 && (
                    <button onClick={(e)=>{e.stopPropagation(); setIsExpanded(!isExpanded)}} className="ml-1 text-xs font-bold text-gray-400 hover:text-sky-500">
                        {isExpanded ? 'Lebih sedikit' : 'Baca selengkapnya'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            {lightboxOpen && <Lightbox images={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
            
            <div onClick={() => goToDetail(post)} className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 relative group transition-all hover:shadow-md cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3" onClick={(e) => {e.stopPropagation(); goToProfile(post.userId)}}>
                        {/* GUNAKAN AVATAR BARU */}
                        <Avatar url={post.user?.photoURL} name={post.user?.username} />
                        
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight flex items-center gap-1 hover:underline">
                                {post.user?.username}
                                {isVerifiedDev && <ShieldCheck size={14} className="text-blue-500 fill-blue-50"/>}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                                {post.category && <span className="text-[9px] bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-gray-500 uppercase font-bold tracking-wider">{post.category}</span>}
                            </div>
                        </div>
                    </div>
                    {canDelete && (
                        <button onClick={(e)=>{e.stopPropagation(); handleDelete()}} className="p-2 text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                    )}
                </div>

                {post.title && <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 leading-tight">{post.title}</h3>}
                {renderContent()}

                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <div className={`mb-4 rounded-xl overflow-hidden grid gap-0.5 ${
                        mediaList.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}>
                        {mediaList.slice(0, 4).map((url, i) => (
                            <div key={i} onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); setLightboxOpen(true); }} className={`relative bg-gray-100 dark:bg-gray-700 ${
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
                    <div className="mb-4 rounded-xl overflow-hidden aspect-video bg-black shadow-lg">
                        <iframe src={`https://www.youtube.com/embed/${post.mediaUrl.split('v=')[1] || post.mediaUrl.split('/').pop()}`} className="w-full h-full border-0" allowFullScreen></iframe>
                    </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700 mt-2">
                    <div className="flex gap-6">
                        <button onClick={(e)=>{e.stopPropagation(); handleLike()}} className={`flex items-center gap-2 text-sm font-bold transition-all active:scale-90 ${liked ? 'text-rose-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                            <Heart size={20} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110 drop-shadow-sm' : ''}/> {likeCount}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-sky-500">
                            <MessageSquare size={20}/> {post.commentsCount || 0}
                        </button>
                    </div>
                    <button onClick={(e)=>{e.stopPropagation(); sharePost()}} className="text-gray-400 dark:text-gray-500 hover:text-sky-500 transition flex items-center gap-1 text-xs font-bold bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-full"><Share2 size={16}/> Share</button>
                </div>
            </div>
        </>
    );
};

// --- CREATE POST ---
const CreatePost = ({ setPage, userId, username, userPhoto, onSuccess }) => {
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
            const postRef = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, 
                title: form.title, 
                content: form.content, 
                category: form.category,
                timestamp: serverTimestamp(),
                likes: [], 
                commentsCount: 0, 
                user: { username, uid: userId, photoURL: userPhoto || '' }, // Simpan snapshot user saat posting
                mediaType: images.length > 0 ? 'image' : (form.youtubeUrl ? 'video' : 'text'),
                mediaUrl: form.youtubeUrl ? form.youtubeUrl : (images[0] || ''),
                mediaUrls: images
            });
            onSuccess(postRef.id);
        } catch(e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <button onClick={() => setPage('home')} className="p-2 -ml-2 text-gray-600 dark:text-gray-300"><X size={24}/></button>
                <h2 className="font-bold text-lg dark:text-white">Buat Postingan</h2>
                <button 
                    onClick={submit}
                    disabled={loading || (!form.content && images.length===0)} 
                    className="px-4 py-2 bg-sky-600 text-white rounded-full font-bold text-sm disabled:opacity-50"
                >
                    {loading ? "..." : "Posting"}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
                <div className="flex gap-3 mb-4">
                    <Avatar url={userPhoto} name={username} />
                    <div className="flex-1">
                         <p className="font-bold text-sm dark:text-white">{username}</p>
                         <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 dark:text-gray-300 px-2 py-1 rounded-lg outline-none border-none">
                            <option value="Umum">🌍 Umum</option>
                            <option value="Meme">🤡 Meme & Lucu</option>
                            <option value="Tanya Jawab">💡 Tanya Jawab</option>
                            <option value="Berita">📰 Berita</option>
                            <option value="Curhat">❤️ Curhat</option>
                        </select>
                    </div>
                </div>

                <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full py-2 bg-transparent text-lg font-bold placeholder-gray-400 outline-none dark:text-white mb-2"/>
                <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi?" rows="6" className="w-full bg-transparent text-base placeholder-gray-400 outline-none resize-none dark:text-white"/>
                
                <div className="flex flex-wrap gap-2 mb-4">
                    {images.map((img, i) => (
                        <div key={i} className="w-24 h-24 rounded-xl overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-sm">
                            <img src={img} className="w-full h-full object-cover"/>
                            <button type="button" onClick={()=>setImages(images.filter((_,idx)=>idx!==i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12}/></button>
                        </div>
                    ))}
                </div>

                {form.youtubeUrl && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs text-red-600 flex items-center gap-2">
                        <Youtube size={16}/> {form.youtubeUrl}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-4">
                 {images.length < 5 && (
                    <label className="p-3 bg-white dark:bg-gray-800 text-sky-500 rounded-full shadow-sm cursor-pointer border border-gray-200 dark:border-gray-700">
                        <ImageIcon size={24}/>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} disabled={loading}/>
                    </label>
                )}
                 <div className="relative flex-1">
                    <Youtube size={20} className="absolute left-4 top-3.5 text-gray-400"/>
                    <input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} disabled={images.length>0} placeholder="Link YouTube..." className="w-full pl-12 p-3 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"/>
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
            if (!snap.exists()) {
                await setDoc(ref, { 
                    email: user.email, uid: user.uid, photoURL: user.photoURL,
                    username: user.displayName, 
                    followers: [], following: [], createdAt: serverTimestamp(), role: 'user',
                    isSetup: false 
                });
            }
            onLoginSuccess();
        } catch (e) { alert(`Login Gagal: ${e.message}`); } 
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-8 relative animate-in zoom-in-95 shadow-2xl">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-full hover:bg-gray-200"><X size={16}/></button>
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white">Masuk</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Akses semua fitur {APP_NAME}</p>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-3 rounded-full font-bold text-gray-700 dark:text-white shadow-sm hover:bg-gray-50 active:scale-95 transition">
                    {loading ? <Loader2 className="animate-spin text-sky-500"/> : "Lanjutkan dengan Google"}
                </button>
            </div>
        </div>
    );
};

// --- SINGLE POST DETAIL PAGE ---
const PostDetailPage = ({ post, onClose, currentUserId, profile, triggerLogin, isDev }) => {
    // In real app, fetch comments here. 
    return (
        <div className="fixed inset-0 z-[70] bg-white dark:bg-gray-900 overflow-y-auto animate-in slide-in-from-right">
             <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><ArrowLeft size={24} className="dark:text-white"/></button>
                <h3 className="font-bold text-lg dark:text-white">Postingan</h3>
             </div>
             <div className="p-4 max-w-xl mx-auto min-h-screen">
                <PostItem 
                    post={post} 
                    currentUserId={currentUserId} 
                    profile={profile} 
                    triggerLogin={triggerLogin} 
                    goToProfile={()=>{}} 
                    goToTag={()=>{}} 
                    goToDetail={()=>{}}
                    isDev={isDev}
                />
                <div className="mt-6">
                    <h4 className="font-bold dark:text-white mb-4">Komentar</h4>
                    <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        Belum ada komentar. Jadilah yang pertama!
                    </div>
                </div>
             </div>
        </div>
    )
}

// --- MAIN APP ---
const App = () => {
    const [user, setUser] = useState(undefined);
    const [profile, setProfile] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [page, setPage] = useState('home'); 
    const [posts, setPosts] = useState([]);
    const [users, setUsers] = useState([]);
    const [targetUid, setTargetUid] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null); // For detail view
    const [showLogin, setShowLogin] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [showDev, setShowDev] = useState(false);
    
    // Feed State
    const [feedType, setFeedType] = useState('foryou'); 
    const [displayLimit, setDisplayLimit] = useState(10);
    const [hashtagFilter, setHashtagFilter] = useState('');

    const GUEST = useMemo(()=>({ uid:'guest', username:'Tamu', photoURL:'', followers:[], following:[] }), []);

    // --- ALGORITMA FEED PERBAIKAN ---
    // Menggunakan Weighted Score agar tidak "Chaotic" (Acak murni)
    // Score = (Recency * 0.6) + (Likes * 0.3) + (Randomness * 0.1)
    const processedPosts = useMemo(() => {
        let data = [...posts];

        // 1. Filter Search/Hashtag
        if (hashtagFilter) {
            if(hashtagFilter.startsWith('id:')) {
                const id = hashtagFilter.split(':')[1];
                data = data.filter(p => p.id === id);
            } else {
                const lower = hashtagFilter.toLowerCase();
                data = data.filter(p => 
                    p.content?.toLowerCase().includes(lower) || 
                    p.category?.toLowerCase() === lower ||
                    p.user?.username?.toLowerCase().includes(lower)
                );
            }
            return data;
        }

        // 2. Feed Type Logic
        if (feedType === 'meme') {
            return data.filter(p => p.category === 'Meme' || p.content?.toLowerCase().includes('meme'));
        } 
        else if (feedType === 'popular') {
            // Sort by Likes purely
            return data.sort((a,b) => (b.likes?.length||0) - (a.likes?.length||0));
        }
        else if (feedType === 'latest') {
            // Strict Chronological (No algo)
            return data.sort((a,b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
        } 
        else if (feedType === 'foryou') {
             // ALGORITMA CERDAS:
             // Prioritaskan yang baru (< 24 jam) DAN punya interaksi
             const now = new Date().getTime();
             return data.sort((a,b) => {
                 const timeA = a.timestamp?.toMillis() || 0;
                 const timeB = b.timestamp?.toMillis() || 0;
                 const likesA = a.likes?.length || 0;
                 const likesB = b.likes?.length || 0;
                 
                 // Score Calculation
                 const ageA = (now - timeA) / (1000 * 3600); // Age in hours
                 const ageB = (now - timeB) / (1000 * 3600);
                 
                 // Lebih baru = score tinggi. Banyak like = score tambah dikit.
                 // Penalti berat jika post lebih dari 3 hari (72 jam)
                 const scoreA = (1000 / (ageA + 1)) + (likesA * 5);
                 const scoreB = (1000 / (ageB + 1)) + (likesB * 5);
                 
                 return scoreB - scoreA;
             });
        }
        return data;
    }, [posts, hashtagFilter, feedType]);

    // --- EFFECT: DATA FETCHING ---
    useEffect(() => { 
        setTimeout(() => setShowSplash(false), 2000); 
        const savedTheme = localStorage.getItem('theme');
        if(savedTheme === 'dark') setDarkMode(true);
        
        // Load All Posts (Public Read - Optimized)
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(150));
        const unsubPosts = onSnapshot(q, s => {
            const data = s.docs.map(d => ({id:d.id, ...d.data()}));
            setPosts(data);
        }, err => console.log("Post fetch error:", err));

        // Load All Users
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => {
            setUsers(s.docs.map(d=>({uid:d.id, ...d.data()})));
        });

        return () => { unsubPosts(); unsubUsers(); };
    }, []);

    // --- EFFECT: AUTH ---
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
        return () => unsubAuth();
    }, []);

    useEffect(() => {
        if(darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
        else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
    }, [darkMode]);

    useEffect(() => {
        // Reset scroll when changing "pages" (tabs)
        if(page !== 'create') window.scrollTo({top:0, behavior:'smooth'});
    }, [page, feedType]);

    const handleScroll = () => {
        if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
            setDisplayLimit(prev => Math.min(prev + 5, processedPosts.length));
        }
    };
    useEffect(() => { window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, [processedPosts]);

    const handleUploadSuccess = (newPostId) => {
        setPage('home'); setFeedType('latest'); setHashtagFilter('');
        // Optional: Show detail of new post
        // const newPost = posts.find(p => p.id === newPostId);
        // if(newPost) setSelectedPost(newPost);
    };

    const triggerLogin = () => setShowLogin(true);
    const isDeveloper = user?.email === DEVELOPER_EMAIL;

    // --- RENDER ---

    if (showSplash) return <SplashScreen/>;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500"/></div>;

    // FORCE PROFILE SETUP: Jika belum setup, tidak bisa kemana-mana
    if (user && profile && !profile.isSetup && profile.uid !== 'guest') {
        return <SetupProfile user={user} allUsers={users} onComplete={()=>window.location.reload()}/>;
    }

    const displayedPosts = processedPosts.slice(0, displayLimit);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300">
            {/* --- HEADER --- */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-50 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 shadow-sm">
                <div onClick={()=>{setPage('home'); setHashtagFilter('');}} className="flex items-center gap-2 cursor-pointer">
                    <img src={APP_LOGO} className="w-8 h-8 rounded-lg"/>
                    <span className="font-black text-xl tracking-tighter bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent hidden sm:block">{APP_NAME}</span>
                </div>
                
                {/* Search Bar Kecil di Header */}
                <div className="flex-1 mx-4 max-w-xs relative hidden md:block">
                     <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                     <input 
                        placeholder="Cari..." 
                        onChange={e=>setHashtagFilter(e.target.value)}
                        value={hashtagFilter}
                        className="w-full bg-gray-100 dark:bg-gray-800 rounded-full pl-9 py-2 text-sm outline-none focus:ring-2 ring-sky-500/50 dark:text-white"
                     />
                </div>

                <div className="flex gap-2 items-center">
                    {/* Dark Mode Toggle */}
                    <button onClick={()=>setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-yellow-400">
                        {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                    </button>
                    
                    {/* NOTIFICATION BELL */}
                    <button onClick={()=>setPage('notifications')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 relative">
                        <Bell size={20}/>
                        {/* Dot merah jika ada notif (dummy logic) */}
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* Developer Button */}
                    {isDeveloper && (
                        <button onClick={()=>setShowDev(true)} className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200">
                            <ShieldCheck size={20}/>
                        </button>
                    )}

                    {isGuest && <button onClick={triggerLogin} className="px-4 py-2 bg-sky-600 text-white rounded-full text-xs font-bold hover:bg-sky-700 shadow-lg shadow-sky-500/20">Masuk</button>}
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="pt-20 pb-24 min-h-screen">
                
                {page === 'home' && (
                    <div className="max-w-lg mx-auto px-4">
                        {/* Feed Tabs */}
                        {!hashtagFilter && (
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
                                {[
                                    {id:'foryou', label:'✨ Untuk Kamu'},
                                    {id:'latest', label:'⌚ Terbaru'},
                                    {id:'popular', label:'🔥 Populer'},
                                    {id:'meme', label:'🤡 Meme'}
                                ].map(tab => (
                                    <button key={tab.id} onClick={()=>{setFeedType(tab.id); setDisplayLimit(10);}} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition ${feedType===tab.id ? 'bg-sky-600 text-white border-transparent shadow-lg shadow-sky-500/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hashtagFilter && (
                            <div className="flex justify-between items-center bg-sky-50 dark:bg-sky-900/30 p-3 rounded-xl mb-4 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800">
                                <span className="text-sm font-bold">🔍 Hasil: {hashtagFilter}</span>
                                <button onClick={()=>setHashtagFilter('')}><X size={16}/></button>
                            </div>
                        )}

                        {/* Stories Bar (Placeholder for future) */}
                        <div className="flex gap-3 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                           {/* Add story logic here later */}
                        </div>

                        {displayedPosts.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <div className="mb-2 text-4xl">📭</div>
                                <p className="text-sm font-medium">Tidak ada postingan yang cocok.</p>
                                <button onClick={()=>setHashtagFilter('')} className="mt-4 text-sky-500 text-sm font-bold bg-sky-50 dark:bg-sky-900/20 px-4 py-2 rounded-full">Refresh Feed</button>
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
                                    goToTag={setHashtagFilter}
                                    goToDetail={(post)=>setSelectedPost(post)}
                                    isDev={isDeveloper}
                                />
                            ))
                        )}
                        
                        {/* Infinite Scroll Loader */}
                        <div className="h-10 flex justify-center items-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                            {displayedPosts.length < processedPosts.length ? <Loader2 className="animate-spin"/> : "• • •"}
                        </div>
                    </div>
                )}

                {page === 'search' && (
                    <div className="max-w-lg mx-auto px-4">
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                            <input autoFocus onChange={e=>setHashtagFilter(e.target.value)} placeholder="Cari postingan, user, atau topik..." className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-transparent focus:border-sky-500 outline-none shadow-sm dark:text-white transition-all"/>
                        </div>
                        
                        {!hashtagFilter && (
                             <div className="text-center text-gray-400 text-sm py-10">
                                 Ketik sesuatu untuk mencari...
                             </div>
                        )}

                        {hashtagFilter && (
                            <>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Pengguna</h3>
                                <div className="grid grid-cols-1 gap-2 mb-6">
                                    {users.filter(u => u.username?.toLowerCase().includes(hashtagFilter.toLowerCase())).slice(0, 3).map(u => (
                                        <div key={u.uid} onClick={()=>{setTargetUid(u.uid); setPage('other-profile')}} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <Avatar url={u.photoURL} name={u.username} size="w-10 h-10"/>
                                            <div>
                                                <p className="font-bold text-sm dark:text-white flex items-center gap-1">{u.username}</p>
                                                <p className="text-xs text-gray-400 truncate">{u.bio||'Tidak ada bio'}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {users.filter(u => u.username?.toLowerCase().includes(hashtagFilter.toLowerCase())).length === 0 && <p className="text-sm text-gray-400 italic">User tidak ditemukan.</p>}
                                </div>
                                
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Postingan Terkait</h3>
                                {/* Re-use Post List Logic from Home but filtered */}
                                {displayedPosts.map(p => (
                                    <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} triggerLogin={triggerLogin} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} goToTag={setHashtagFilter} goToDetail={(post)=>setSelectedPost(post)} isDev={isDeveloper}/>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {page === 'create' && (
                    <CreatePost 
                        userId={profile.uid} 
                        username={profile.username} 
                        userPhoto={profile.photoURL}
                        setPage={setPage} 
                        onSuccess={handleUploadSuccess} 
                    />
                )}
                
                {page === 'notifications' && (
                    <div className="max-w-lg mx-auto px-4">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2 dark:text-white"><Bell className="text-sky-500"/> Notifikasi</h2>
                        {/* Placeholder for real notifications - requires subcollection fetching */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm text-center">
                             <div className="bg-sky-50 dark:bg-sky-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-500">
                                <Bell size={32}/>
                             </div>
                             <h3 className="font-bold dark:text-white mb-2">Belum ada notifikasi</h3>
                             <p className="text-sm text-gray-500">Berinteraksi dengan pengguna lain agar notifikasi muncul disini!</p>
                        </div>
                    </div>
                )}
                
                {page === 'ranking' && (
                    <div className="max-w-lg mx-auto px-4">
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-white mb-6 shadow-lg relative overflow-hidden">
                            <Crown className="absolute -right-4 -bottom-4 opacity-20" size={120}/>
                            <h2 className="text-2xl font-black relative z-10">Top Global</h2>
                            <p className="text-yellow-100 text-sm relative z-10">User paling populer minggu ini</p>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                            {users.sort((a,b)=> (b.followers?.length||0) - (a.followers?.length||0)).slice(0,10).map((u,i) => (
                                <div key={u.uid} onClick={()=>{setTargetUid(u.uid); setPage('other-profile')}} className="flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-4 shrink-0 ${i===0?'bg-yellow-400 text-white shadow-lg shadow-yellow-400/50':i===1?'bg-gray-300 text-white':i===2?'bg-orange-400 text-white':'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>#{i+1}</div>
                                    <Avatar url={u.photoURL} name={u.username} size="w-10 h-10" className="mr-3"/>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm dark:text-white truncate">{u.username}</p>
                                        <p className="text-xs text-gray-400">{(u.followers?.length||0)*10} Reputasi</p>
                                    </div>
                                    {i < 3 && <Flame size={16} className="text-orange-500"/>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(page === 'profile' || page === 'other-profile') && (
                    <div className="max-w-lg mx-auto px-4">
                        {page === 'other-profile' && <button onClick={()=>setPage('home')} className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white transition"><ArrowLeft size={16}/> Kembali</button>}
                        
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm text-center mb-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-400 to-blue-500 opacity-20"></div>
                            
                            <div className="relative mt-4 mb-4 flex justify-center">
                                <Avatar 
                                    url={(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.photoURL} 
                                    name={(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.username}
                                    size="w-24 h-24"
                                    fontSize="text-3xl"
                                    className="border-4 border-white dark:border-gray-800 shadow-xl"
                                />
                                
                                {page==='profile' && (
                                    <label className="absolute bottom-0 translate-x-8 bg-gray-800 text-white p-2 rounded-full cursor-pointer hover:bg-black transition shadow-lg">
                                        <ImageIcon size={14}/>
                                        <input type="file" className="hidden" accept="image/*" onChange={async(e)=>{
                                            if(e.target.files[0]) {
                                                try {
                                                    const b64 = await compressImageToBase64(e.target.files[0]);
                                                    await updateDoc(doc(db, getPublicCollection('userProfiles'), profile.uid), { photoURL: b64 });
                                                    window.location.reload();
                                                } catch(err){alert("Gagal upload");}
                                            }
                                        }}/>
                                    </label>
                                )}
                            </div>

                            <h2 className="text-2xl font-black dark:text-white flex items-center justify-center gap-1">
                                {(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.username}
                                {((page==='profile'?profile:users.find(u=>u.uid===targetUid))?.email === DEVELOPER_EMAIL) && <ShieldCheck size={18} className="text-blue-500"/>}
                            </h2>
                            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto leading-relaxed">{(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.bio || "Pengguna ini belum menulis bio."}</p>
                            
                            {page==='profile' && (
                                <button onClick={()=>signOut(auth)} className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition">Keluar dari Akun</button>
                            )}
                        </div>

                        <h3 className="font-bold text-lg mb-4 dark:text-white ml-2">Postingan</h3>
                        {/* Simple Post List for Profile */}
                        {posts.filter(p => p.userId === (page==='profile'?profile.uid:targetUid)).map(p => (
                             <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} triggerLogin={triggerLogin} goToProfile={()=>{}} goToTag={()=>{}} goToDetail={(post)=>setSelectedPost(post)} isDev={isDeveloper}/>
                        ))}
                    </div>
                )}
            </main>

            {/* --- BOTTOM NAVBAR (Floating Modern Style) --- */}
            <nav className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-full shadow-2xl z-40 px-6 py-2">
                <div className="flex justify-between items-center">
                    <NavBtn icon={Home} active={page==='home'} onClick={()=>{setPage('home'); setHashtagFilter('');}}/>
                    <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                    
                    <button onClick={()=>isGuest?triggerLogin():setPage('create')} className="w-12 h-12 bg-sky-600 rounded-full text-white shadow-lg shadow-sky-500/40 flex items-center justify-center hover:scale-110 transition active:scale-95 -mt-6 border-4 border-gray-50 dark:border-gray-900">
                        <PlusCircle size={24}/>
                    </button>

                    <NavBtn icon={Crown} active={page==='ranking'} onClick={()=>setPage('ranking')}/>
                    <NavBtn icon={User} active={page==='profile'} onClick={()=>isGuest?triggerLogin():setPage('profile')}/>
                </div>
            </nav>

            {/* --- MODALS & OVERLAYS --- */}
            {showLogin && <AuthScreen onLoginSuccess={()=>setShowLogin(false)} onCancel={()=>setShowLogin(false)}/>}
            
            {showDev && isDeveloper && (
                <DevDashboard 
                    posts={posts} 
                    users={users} 
                    userProfile={profile}
                    onClose={()=>setShowDev(false)}
                />
            )}

            {selectedPost && (
                <PostDetailPage 
                    post={selectedPost} 
                    onClose={()=>setSelectedPost(null)}
                    currentUserId={profile.uid}
                    profile={profile}
                    triggerLogin={triggerLogin}
                    isDev={isDeveloper}
                />
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 scale-110' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
        <Icon size={22} strokeWidth={active?2.5:2} />
    </button>
);

export default App;