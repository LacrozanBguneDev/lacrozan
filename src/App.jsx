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
    Activity, Users, BarChart3, Megaphone, Radio, Globe, LayoutGrid, XCircle, RefreshCw, Hash,
    Moon, Sun, UserPlus, UserMinus, FileText, Info
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

const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 500) return { label: "LEGEND", icon: Crown, color: "bg-yellow-500 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    if (reputation >= 50) return { label: "RISING STAR", icon: Flame, color: "bg-orange-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
};

// ==========================================
// BAGIAN 3: COMPONENTS
// ==========================================

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
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-gray-800/50 rounded-full z-[110]"><X size={24}/></button>
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
        if(username.length < 3) return setError("Username minimal 3 karakter.");
        if(!/^[a-zA-Z0-9_]+$/.test(username)) return setError("Username hanya boleh huruf, angka, dan underscore.");
        
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
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white">Selamat Datang!</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Lengkapi profilmu sebelum memulai.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">Username (Unik)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400">@</span>
                            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white pl-8 p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-sky-500" placeholder="username_keren" required/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">Bio (Opsional)</label>
                        <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-sky-500" placeholder="Ceritakan sedikit tentangmu..." rows="3"/>
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
    
    // Perbaikan: Update state jika props berubah (penting untuk real-time update)
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
        if (confirm("Hapus postingan ini?")) deleteDoc(doc(db, getPublicCollection('posts'), post.id));
    };

    const sharePost = () => {
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        navigator.clipboard.writeText(url);
        alert("Link postingan disalin! Bagikan ke temanmu.");
    };

    const renderContent = () => {
        const text = post.content || '';
        const shouldTruncate = text.length > 200 && !isExpanded;
        const displayText = shouldTruncate ? text.slice(0, 200) + '...' : text;
        
        // Regex yang lebih kompleks untuk URL dan Hashtag
        const parts = displayText.split(/((?:https?:\/\/|www\.)[^\s]+|#\w+)/g);
        
        return (
            <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap break-words">
                {parts.map((part, i) => {
                    if (part.startsWith('#')) {
                        return <span key={i} onClick={(e)=>{e.stopPropagation(); goToTag(part)}} className="text-sky-600 dark:text-sky-400 font-bold cursor-pointer hover:underline">{part}</span>;
                    } else if (part.match(/^(https?:\/\/|www\.)/)) {
                        const href = part.startsWith('www.') ? `http://${part}` : part;
                        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={(e)=>e.stopPropagation()} className="text-blue-500 hover:underline flex items-center gap-1 inline-flex"><LinkIcon size={10}/> {part.length > 30 ? part.slice(0,25)+'...' : part}</a>;
                    }
                    return part;
                })}
                {text.length > 200 && (
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
            
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 relative group transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => {e.stopPropagation(); goToProfile(post.userId)}}>
                        <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-sky-200 to-purple-200">
                            <img src={post.user?.photoURL || APP_LOGO} className="w-full h-full rounded-full object-cover border-2 border-white dark:border-gray-800"/>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight flex items-center gap-1">
                                {post.user?.username}
                                {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-50"/>}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                                {post.category && <span className="text-[9px] bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-gray-500 uppercase font-bold">{post.category}</span>}
                            </div>
                        </div>
                    </div>
                    {post.userId === currentUserId && (
                        <button onClick={(e)=>{e.stopPropagation(); handleDelete()}} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                    )}
                </div>

                {post.title && <h3 className="font-bold text-gray-900 dark:text-white mb-2">{post.title}</h3>}
                {renderContent()}

                {mediaList.length > 0 && post.mediaType === 'image' && (
                    <div className={`mb-4 rounded-2xl overflow-hidden grid gap-1 cursor-pointer ${
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
                    <div className="mb-4 rounded-2xl overflow-hidden aspect-video bg-black shadow-lg">
                        <iframe src={`https://www.youtube.com/embed/${post.mediaUrl.split('v=')[1] || post.mediaUrl.split('/').pop()}`} className="w-full h-full border-0" allowFullScreen></iframe>
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex gap-6">
                        <button onClick={(e)=>{e.stopPropagation(); handleLike()}} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                            <Heart size={20} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-sky-500">
                            <MessageSquare size={20}/> {post.commentsCount || 0}
                        </button>
                    </div>
                    <button onClick={(e)=>{e.stopPropagation(); sharePost()}} className="text-gray-400 dark:text-gray-500 hover:text-sky-500 transition flex items-center gap-1 text-xs font-bold"><Share2 size={18}/> Share</button>
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
            const postRef = await addDoc(collection(db, getPublicCollection('posts')), {
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
            onSuccess(postRef.id);
        } catch(e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24 animate-in slide-in-from-bottom-10">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-xl border border-sky-50 dark:border-gray-700 mt-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-800 dark:text-white">Buat Postingan</h2>
                    <button onClick={() => setPage('home')} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full dark:text-white"><X size={18}/></button>
                </div>
                
                <form onSubmit={submit} className="space-y-4">
                    <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs font-bold outline-none">
                        <option value="Umum">Kategori: Umum</option>
                        <option value="Meme">Meme & Lucu</option>
                        <option value="Tanya Jawab">Tanya Jawab</option>
                        <option value="Berita">Berita & Info</option>
                    </select>

                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl font-bold text-sm outline-none"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi? Gunakan #hashtag untuk topik." rows="5" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-sm outline-none resize-none"/>
                    
                    <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                            <div key={i} className="w-20 h-20 rounded-xl overflow-hidden relative border border-gray-200 dark:border-gray-600">
                                <img src={img} className="w-full h-full object-cover"/>
                                <button type="button" onClick={()=>setImages(images.filter((_,idx)=>idx!==i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X size={10}/></button>
                            </div>
                        ))}
                        {images.length < 5 && (
                            <label className="w-20 h-20 rounded-xl bg-sky-50 dark:bg-gray-700 border-2 border-dashed border-sky-200 dark:border-gray-500 flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 dark:hover:bg-gray-600 text-sky-500">
                                <ImageIcon size={20}/>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} disabled={loading}/>
                            </label>
                        )}
                    </div>

                    <div className="relative">
                        <Youtube size={18} className="absolute left-3 top-3 text-red-500"/>
                        <input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} disabled={images.length>0} placeholder="Link YouTube..." className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-xs outline-none disabled:opacity-50"/>
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
        const q = query(collection(db, getPublicCollection('notifications')), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, (s) => {
            const data = s.docs.map(d => ({id:d.id, ...d.data()})).filter(n => n.toUserId === userId);
            setNotifs(data);
        });
        return unsub;
    }, [userId]);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Bell className="text-sky-500"/> Notifikasi</h1>
            <div className="space-y-2">
                {notifs.length === 0 && <div className="text-center text-gray-400 mt-10">Belum ada notifikasi.</div>}
                {notifs.map(n => (
                    <div key={n.id} onClick={()=>n.postId && goToPost(n.postId)} className={`bg-white dark:bg-gray-800 p-4 rounded-2xl border ${n.isRead ? 'border-gray-50 dark:border-gray-700' : 'border-sky-100 bg-sky-50/30 dark:bg-sky-900/10'} flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700`}>
                        <img src={n.fromPhoto || APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200 object-cover"/>
                        <div className="flex-1">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
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
        const scoreA = (a.followers?.length || 0) * 10;
        const scoreB = (b.followers?.length || 0) * 10;
        return scoreB - scoreA;
    });

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
             <h1 className="text-2xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Peringkat</h1>
             <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                {sortedUsers.slice(0, 10).map((u, i) => (
                    <div key={u.uid} className="flex items-center gap-4 p-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
                        <div className={`w-8 h-8 flex items-center justify-center font-black rounded-full ${i===0?'bg-yellow-100 text-yellow-600':i===1?'bg-gray-100 text-gray-600':i===2?'bg-orange-100 text-orange-600':'text-gray-400'}`}>
                            {i+1}
                        </div>
                        <img src={u.photoURL || APP_LOGO} className="w-10 h-10 rounded-full object-cover"/>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 dark:text-white text-sm">{u.username}</h4>
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
const ProfileScreen = ({ viewerProfile, profileData, allPosts, triggerLogin, onLogout }) => {
    const isGuest = viewerProfile.uid === 'guest';
    const isSelf = viewerProfile.uid === profileData.uid;
    const isDev = profileData.email === DEVELOPER_EMAIL;
    const [isFollowing, setIsFollowing] = useState(profileData.followers?.includes(viewerProfile.uid));
    
    const [showDev, setShowDev] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [showPolicies, setShowPolicies] = useState(false);

    // Filter post user dan URUTKAN dari TERBARU
    const userPosts = allPosts
        .filter(p => p.userId === profileData.uid)
        .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const totalLikes = userPosts.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
    const badge = getReputationBadge(totalLikes, isDev);

    useEffect(() => {
        setIsFollowing(profileData.followers?.includes(viewerProfile.uid));
    }, [profileData, viewerProfile]);

    const handleAvatar = async (e) => {
        const f = e.target.files[0];
        if(!f) return;
        try {
            const b64 = await compressImageToBase64(f);
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { photoURL: b64 });
        } catch(e){ alert("Gagal update foto"); }
    };

    const handleFollow = async () => {
        if(isGuest) { triggerLogin(); return; }
        const myRef = doc(db, getPublicCollection('userProfiles'), viewerProfile.uid);
        const targetRef = doc(db, getPublicCollection('userProfiles'), profileData.uid);
        
        try {
            if(isFollowing) {
                await updateDoc(myRef, { following: arrayRemove(profileData.uid) });
                await updateDoc(targetRef, { followers: arrayRemove(viewerProfile.uid) });
                setIsFollowing(false);
            } else {
                await updateDoc(myRef, { following: arrayUnion(profileData.uid) });
                await updateDoc(targetRef, { followers: arrayUnion(viewerProfile.uid) });
                sendNotification(profileData.uid, 'follow', 'mulai mengikuti Anda.', viewerProfile);
                setIsFollowing(true);
            }
        } catch(e) { alert("Gagal memproses follow"); }
    };

    return (
        <div className="max-w-lg mx-auto pb-32 pt-6 px-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-sky-50 dark:border-gray-700 mb-6 text-center relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-100 to-purple-100 opacity-50 dark:opacity-20"></div>
                <div className="relative inline-block mt-8 mb-4">
                    <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden relative group">
                        <img src={profileData.photoURL || APP_LOGO} className="w-full h-full object-cover"/>
                        {isSelf && !isGuest && (
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                                <ImageIcon className="text-white"/>
                                <input type="file" className="hidden" onChange={handleAvatar} accept="image/*"/>
                            </label>
                        )}
                    </div>
                </div>

                <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center justify-center gap-2">
                    {profileData.username} {isDev && <ShieldCheck size={20} className="text-blue-600"/>}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{profileData.bio || "Belum ada bio."}</p>
                
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold mt-2 ${badge.color}`}>
                    <badge.icon size={12}/> {badge.label}
                </div>

                {/* Follow Button */}
                {!isSelf && (
                    <button onClick={handleFollow} className={`mt-4 px-6 py-2 rounded-full font-bold text-sm shadow-md transition transform active:scale-95 ${isFollowing ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-sky-600 text-white'}`}>
                        {isFollowing ? 'Mengikuti' : 'Ikuti'}
                    </button>
                )}

                <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-50 dark:border-gray-700">
                    <div className="text-center"><span className="block font-black text-xl text-gray-800 dark:text-white">{userPosts.length}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Post</span></div>
                    <div className="text-center"><span className="block font-black text-xl text-gray-800 dark:text-white">{profileData.followers?.length || 0}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pengikut</span></div>
                    <div className="text-center"><span className="block font-black text-xl text-gray-800 dark:text-white">{profileData.following?.length || 0}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mengikuti</span></div>
                </div>

                {isSelf && (
                    <div className="mt-6 flex flex-col gap-2">
                        {isDev && (
                            <button onClick={()=>setShowDev(true)} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg">
                                <ShieldCheck size={16}/> Dashboard Admin
                            </button>
                        )}
                         <button onClick={()=>setShowPolicies(true)} className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <Info size={16}/> Kebijakan & Privasi
                        </button>
                        <button onClick={onLogout} className="w-full py-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <LogOut size={16}/> Keluar
                        </button>
                    </div>
                )}
            </div>

            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-sm mb-6">
                <button onClick={()=>setActiveTab('posts')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='posts'?'bg-sky-50 dark:bg-gray-700 text-sky-600 dark:text-sky-400':'text-gray-400'}`}>Postingan</button>
                <button onClick={()=>setActiveTab('likes')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${activeTab==='likes'?'bg-rose-50 dark:bg-gray-700 text-rose-600 dark:text-rose-400':'text-gray-400'}`}>Disukai</button>
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
            
            {showPolicies && (
                <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
                         <h3 className="font-bold text-lg mb-4 dark:text-white">Kebijakan Privasi</h3>
                         <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                             Aplikasi ini mengumpulkan data dasar seperti email dan foto profil untuk identifikasi. Kami menghargai privasi Anda dan tidak membagikan data kepada pihak ketiga tanpa izin.
                         </p>
                         <h3 className="font-bold text-lg mb-4 dark:text-white">Syarat & Ketentuan</h3>
                         <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                             Dilarang memposting konten SARA, pornografi, atau ujaran kebencian. Pelanggaran akan mengakibatkan pemblokiran akun.
                         </p>
                         <button onClick={()=>setShowPolicies(false)} className="w-full bg-sky-600 text-white py-2 rounded-xl font-bold">Tutup</button>
                    </div>
                </div>
            )}
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
        // Simulasi broadcast (karena limitasi write)
        alert("Broadcast tersend (Simulasi).");
        setBroadcastMsg('');
    };

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[150] overflow-y-auto p-4 animate-in slide-in-from-bottom">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 min-h-screen shadow-2xl rounded-t-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Dev Panel</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full dark:text-white"><X/></button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-sky-50 dark:bg-gray-700 p-4 rounded-xl border border-sky-100 dark:border-gray-600 text-center"><h3 className="text-3xl font-bold text-sky-600 dark:text-sky-400">{stats.users}</h3><p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-bold">Total User</p></div>
                    <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-xl border border-purple-100 dark:border-gray-600 text-center"><h3 className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.posts}</h3><p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-bold">Total Post</p></div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 mb-6">
                    <h3 className="font-bold mb-2 flex items-center gap-2 dark:text-white"><Megaphone size={16}/> Broadcast System</h3>
                    <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} className="w-full p-2 text-sm border rounded-lg mb-2 dark:bg-gray-800 dark:text-white" placeholder="Pesan sistem..."/>
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
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-8 relative animate-in zoom-in-95">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-full hover:bg-gray-200"><X size={16}/></button>
                <div className="text-center mb-8">
                    <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white">Masuk</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Bergabung dengan komunitas {APP_NAME}</p>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-3 rounded-full font-bold text-gray-700 dark:text-white shadow-sm hover:bg-gray-50 active:scale-95 transition">
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
    const [darkMode, setDarkMode] = useState(false);
    const [uploadNotif, setUploadNotif] = useState(false);
    
    // Feed State
    const [feedType, setFeedType] = useState('foryou'); 
    const [displayLimit, setDisplayLimit] = useState(5);
    const [refreshing, setRefreshing] = useState(false);
    const [hashtagFilter, setHashtagFilter] = useState('');

    const GUEST = useMemo(()=>({ uid:'guest', username:'Tamu', photoURL:'', followers:[], following:[] }), []);

    useEffect(() => { 
        setTimeout(() => setShowSplash(false), 2500); 
        const savedTheme = localStorage.getItem('theme');
        if(savedTheme === 'dark') setDarkMode(true);
    }, []);

    // Scroll to top on page change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [page, feedType]);

    // Update Theme
    useEffect(() => {
        if(darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        if (postId) {
            setHashtagFilter(`id:${postId}`); 
            setPage('home');
        }
    }, []);

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

    // Load Posts
    useEffect(() => {
        // Optimasi: Memastikan data tetap terambil meskipun tamu
        // Query disederhanakan agar tidak error permission
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(150));
        
        const unsubPosts = onSnapshot(q, s => {
            let data = s.docs.map(d=>({id:d.id, ...d.data()}));
            setPosts(data);
            setRefreshing(false);
        }, (err) => {
            console.error("Gagal load post:", err);
            // Fallback kosong atau pesan error
        });

        return () => unsubPosts();
    }, []);

    // FEED FILTER LOGIC
    const processedPosts = useMemo(() => {
        let data = [...posts];

        // 1. Filtering (Hashtag / ID / User)
        if (hashtagFilter) {
            if(hashtagFilter.startsWith('id:')) {
                const id = hashtagFilter.split(':')[1];
                data = data.filter(p => p.id === id);
            } else if (hashtagFilter.startsWith('uid:')) { // Support UID filter internal
                const uid = hashtagFilter.split(':')[1];
                data = data.filter(p => p.userId === uid);
            } else {
                data = data.filter(p => p.content?.includes(hashtagFilter) || p.category === hashtagFilter);
            }
            return data;
        }

        // 2. Feed Type Logic
        if (feedType === 'meme') {
            data = data.filter(p => p.category === 'Meme' || p.content?.toLowerCase().includes('meme'));
        } else if (feedType === 'popular') {
            data = data.sort((a,b) => (b.likes?.length||0) - (a.likes?.length||0));
        } else if (feedType === 'foryou') {
             // ACAK tapi tetap mempertahankan post TERBARU di atas (misal 3 teratas tetap terbaru)
             const newest = data.slice(0, 3);
             const rest = data.slice(3).sort(() => Math.random() - 0.5);
             data = [...newest, ...rest];
        }
        // 'latest' default order
        
        return data;
    }, [posts, hashtagFilter, feedType]);

    // INFINITE SCROLL AUTOMATIC
    const handleScroll = () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 200) { // Buffer 200px sebelum mentok
            setDisplayLimit(prev => Math.min(prev + 5, processedPosts.length));
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [processedPosts.length]);


    const triggerLogin = () => setShowLogin(true);
    const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); };
    
    // Handle Upload Sukses
    const handleUploadSuccess = (newPostId) => {
        setPage('home');
        setFeedType('latest'); // Pindah ke terbaru agar user lihat
        setHashtagFilter('');
        setUploadNotif(true);
        window.scrollTo(0,0);
        setTimeout(() => setUploadNotif(false), 4000);
    };

    // Navigasi ke Postingan Detail saat Search diklik
    const handleSearchResultClick = (type, data) => {
        if (type === 'user') {
            setTargetUid(data.uid); 
            setPage('other-profile');
        } else if (type === 'post') {
            // Langsung filter ke postingan tersebut
            setHashtagFilter(`id:${data.id}`);
            setPage('home');
        }
    };

    if (showSplash) return <SplashScreen/>;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500"/></div>;

    if (user && profile && !profile.isSetup && profile.uid !== 'guest') {
        return <SetupProfile user={user} allUsers={users} onComplete={()=>window.location.reload()}/>;
    }

    const displayedPosts = processedPosts.slice(0, displayLimit);

    return (
        <div className="min-h-screen bg-[#F0F4F8] dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md h-16 flex items-center justify-between px-4 z-50 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>{setPage('home'); setHashtagFilter(''); setDisplayLimit(5);}}>
                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                    <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">BguneNet</span>
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={()=>setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 transition">
                        {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
                    </button>
                    {page === 'home' && (
                        <button onClick={handleRefresh} className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${refreshing ? 'animate-spin' : ''}`}>
                            <RefreshCw size={18} className="text-gray-600 dark:text-gray-300"/>
                        </button>
                    )}
                    {isGuest ? (
                        <button onClick={triggerLogin} className="bg-sky-600 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg shadow-sky-200 dark:shadow-none">Masuk</button>
                    ) : null}
                </div>
            </header>
            
            {/* Upload Notification Toast */}
            {uploadNotif && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 animate-bounce">
                    <CheckCircle size={20}/> Upload Selesai!
                </div>
            )}

            {/* Main Content */}
            <main className="pt-20 pb-32 min-h-screen">
                {page === 'home' && (
                    <div className="max-w-lg mx-auto px-4">
                        {!hashtagFilter && (
                            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
                                {[
                                    {id:'foryou', label:'Acak'},
                                    {id:'latest', label:'Terbaru'},
                                    {id:'popular', label:'Populer'},
                                    {id:'meme', label:'Meme'}
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={()=>{setFeedType(tab.id); setDisplayLimit(5);}}
                                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${feedType===tab.id ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hashtagFilter && (
                            <div className="flex items-center justify-between bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-4 py-3 rounded-xl mb-4">
                                <span className="font-bold text-sm truncate max-w-[80%]">
                                    {hashtagFilter.startsWith('id:') ? 'Lihat Postingan' : `Filter: ${hashtagFilter}`}
                                </span>
                                <button onClick={()=>setHashtagFilter('')}><X size={16}/></button>
                            </div>
                        )}
                        
                        {displayedPosts.length===0 && !refreshing ? (
                            <div className="text-center py-10">
                                <p className="text-gray-400 font-bold">Tidak ada postingan.</p>
                                {isGuest && <p className="text-xs text-gray-400 mt-2">Login untuk pengalaman lebih baik.</p>}
                                <button onClick={()=>setHashtagFilter('')} className="text-sky-500 text-sm mt-2 font-bold">Reset Filter</button>
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
                        
                        {refreshing && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-sky-500"/></div>}
                    </div>
                )}
                
                {page === 'search' && (
                    <div className="max-w-lg mx-auto p-4">
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                            <input 
                                onChange={e=>setHashtagFilter(e.target.value)} 
                                placeholder="Cari user, topik, atau #hashtag..." 
                                className="w-full bg-white dark:bg-gray-800 dark:text-white pl-12 pr-4 py-3 rounded-2xl shadow-sm border border-transparent focus:border-sky-200 outline-none"
                            />
                        </div>
                        
                        {/* Hasil Pencarian User */}
                        <h3 className="font-bold text-gray-500 text-xs uppercase mb-2 ml-1">User</h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {users.filter(u => u.username?.toLowerCase().includes(hashtagFilter.toLowerCase())).slice(0, 4).map(u => (
                                <div key={u.uid} onClick={()=>handleSearchResultClick('user', u)} className="bg-white dark:bg-gray-800 p-3 rounded-xl flex items-center gap-3 cursor-pointer shadow-sm border border-gray-50 dark:border-gray-700">
                                    <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full object-cover"/>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-sm truncate dark:text-white">{u.username}</h4>
                                        <p className="text-[10px] text-gray-400 truncate">{u.bio || "User"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                         {/* Hasil Pencarian Postingan (jika ada input) */}
                         {hashtagFilter.length > 2 && (
                             <>
                                <h3 className="font-bold text-gray-500 text-xs uppercase mb-2 ml-1">Postingan Terkait</h3>
                                <div className="space-y-2">
                                    {posts.filter(p => p.content?.toLowerCase().includes(hashtagFilter.toLowerCase()) || p.title?.toLowerCase().includes(hashtagFilter.toLowerCase())).slice(0, 5).map(p => (
                                         <div key={p.id} onClick={()=>handleSearchResultClick('post', p)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                             <p className="text-sm font-bold text-gray-800 dark:text-white line-clamp-1">{p.title || p.content}</p>
                                             <p className="text-xs text-gray-400">Oleh {p.user?.username}</p>
                                         </div>
                                    ))}
                                </div>
                             </>
                         )}
                    </div>
                )}

                {page === 'create' && <CreatePost userId={profile.uid} username={profile.username} setPage={setPage} onSuccess={handleUploadSuccess} />}
                
                {page === 'notifications' && <NotificationScreen userId={profile.uid} goToPost={(pid)=>{setHashtagFilter(`id:${pid}`); setPage('home');}} />}
                
                {page === 'ranking' && <RankingScreen allUsers={users} />}

                {page === 'profile' && <ProfileScreen viewerProfile={profile} profileData={profile} allPosts={posts} triggerLogin={triggerLogin} onLogout={()=>signOut(auth)} />}
                
                {page === 'other-profile' && users.find(u=>u.uid===targetUid) && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-20 left-4 z-40 bg-white/80 dark:bg-gray-800/80 p-2 rounded-full shadow-md backdrop-blur-sm dark:text-white"><ArrowLeft size={20}/></button>
                        <ProfileScreen viewerProfile={profile} profileData={users.find(u=>u.uid===targetUid)} allPosts={posts} triggerLogin={triggerLogin} />
                    </>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-full px-4 py-2 shadow-2xl shadow-sky-100/50 dark:shadow-none flex items-center gap-2 z-[90]">
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
    <button onClick={onClick} className={`p-3 rounded-full transition duration-300 ${active ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
        <Icon size={22} strokeWidth={active?2.5:2} />
    </button>
);

export default App;