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
    limit
} from 'firebase/firestore';

// IMPORT ICON
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    Trash2, X, Search, ChevronRight, Share2, Youtube, Flame, 
    Bell, Crown, Gem, ShieldCheck, PlusCircle, ArrowLeft,
    CheckCircle, MoreHorizontal, ShieldAlert, Zap,
    Megaphone, RefreshCw, Moon, Sun, Info, LogIn, Filter
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
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL;
    
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
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 relative group transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => {e.stopPropagation(); goToProfile(post.userId)}}>
                        <div className="w-10 h-10 rounded-full bg-gray-200">
                            <img src={post.user?.photoURL || APP_LOGO} className="w-full h-full rounded-full object-cover border border-gray-100 dark:border-gray-700"/>
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
                    <div className={`mb-4 rounded-xl overflow-hidden grid gap-0.5 cursor-pointer ${
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

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex gap-6">
                        <button onClick={(e)=>{e.stopPropagation(); handleLike()}} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                            <Heart size={20} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}
                        </button>
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-sky-500">
                            <MessageSquare size={20}/> {post.commentsCount || 0}
                        </button>
                    </div>
                    <button onClick={(e)=>{e.stopPropagation(); sharePost()}} className="text-gray-400 dark:text-gray-500 hover:text-sky-500 transition flex items-center gap-1 text-xs font-bold"><Share2 size={18}/></button>
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
        <div className="max-w-xl mx-auto p-4 animate-in slide-in-from-bottom-10">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-sky-50 dark:border-gray-700 relative overflow-hidden">
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
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang sedang terjadi?" rows="5" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-sm outline-none resize-none"/>
                    
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

// --- MAIN APP ---
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
    const [hashtagFilter, setHashtagFilter] = useState('');

    const GUEST = useMemo(()=>({ uid:'guest', username:'Tamu', photoURL:'', followers:[], following:[] }), []);

    // --- EFFECT: DATA FETCHING ---
    // Dipisah agar berjalan independen dari Auth
    useEffect(() => { 
        setTimeout(() => setShowSplash(false), 2000); 
        const savedTheme = localStorage.getItem('theme');
        if(savedTheme === 'dark') setDarkMode(true);
        
        // Load All Posts (Public Read)
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(150));
        const unsubPosts = onSnapshot(q, s => {
            const data = s.docs.map(d => ({id:d.id, ...d.data()}));
            setPosts(data);
        }, err => console.log("Post fetch error (Guest ok):", err));

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

    useEffect(() => window.scrollTo({top:0, behavior:'smooth'}), [page, feedType]);

    // --- FEED LOGIC ---
    const processedPosts = useMemo(() => {
        let data = [...posts];
        if (hashtagFilter) {
            if(hashtagFilter.startsWith('id:')) {
                const id = hashtagFilter.split(':')[1];
                data = data.filter(p => p.id === id);
            } else {
                data = data.filter(p => p.content?.includes(hashtagFilter) || p.category === hashtagFilter);
            }
            return data;
        }
        if (feedType === 'meme') data = data.filter(p => p.category === 'Meme' || p.content?.toLowerCase().includes('meme'));
        else if (feedType === 'popular') data = data.sort((a,b) => (b.likes?.length||0) - (a.likes?.length||0));
        else if (feedType === 'foryou') {
             const newest = data.slice(0, 3);
             const rest = data.slice(3).sort(() => Math.random() - 0.5);
             data = [...newest, ...rest];
        }
        return data;
    }, [posts, hashtagFilter, feedType]);

    // Handle Infinite Scroll
    const handleScroll = () => {
        if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
            setDisplayLimit(prev => Math.min(prev + 5, processedPosts.length));
        }
    };
    useEffect(() => { window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, [processedPosts]);

    const handleUploadSuccess = (newPostId) => {
        setPage('home'); setFeedType('latest'); setHashtagFilter(''); setUploadNotif(true);
        setTimeout(() => setUploadNotif(false), 4000);
    };

    const triggerLogin = () => setShowLogin(true);

    if (showSplash) return <SplashScreen/>;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><Loader2 className="animate-spin text-sky-500"/></div>;

    if (user && profile && !profile.isSetup && profile.uid !== 'guest') {
        return <SetupProfile user={user} allUsers={users} onComplete={()=>window.location.reload()}/>;
    }

    const displayedPosts = processedPosts.slice(0, displayLimit);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300">
            {/* --- HEADER --- */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-50 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 shadow-sm">
                <div onClick={()=>{setPage('home'); setHashtagFilter('');}} className="flex items-center gap-2 cursor-pointer">
                    <img src={APP_LOGO} className="w-8 h-8"/>
                    <span className="font-black text-lg bg-gradient-to-r from-sky-600 to-purple-600 bg-clip-text text-transparent">{APP_NAME}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={()=>setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-yellow-400">
                        {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                    </button>
                    {isGuest && <button onClick={triggerLogin} className="px-4 py-2 bg-sky-600 text-white rounded-full text-xs font-bold hover:bg-sky-700">Masuk</button>}
                </div>
            </header>

            {/* --- MAIN CONTENT (Padding adjusted to avoid overlap) --- */}
            <main className="pt-20 pb-28 min-h-screen">
                {uploadNotif && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 animate-bounce"><CheckCircle size={20}/> Terkirim!</div>}

                {page === 'home' && (
                    <div className="max-w-lg mx-auto px-4">
                        {!hashtagFilter ? (
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                                {[
                                    {id:'foryou', label:'Acak'},
                                    {id:'latest', label:'Terbaru'},
                                    {id:'popular', label:'Populer'},
                                    {id:'meme', label:'Meme'}
                                ].map(tab => (
                                    <button key={tab.id} onClick={()=>{setFeedType(tab.id); setDisplayLimit(5);}} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition ${feedType===tab.id ? 'bg-black dark:bg-white text-white dark:text-black border-transparent' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex justify-between items-center bg-sky-50 dark:bg-sky-900/30 p-3 rounded-xl mb-4 text-sky-700 dark:text-sky-300">
                                <span className="text-sm font-bold">Filter: {hashtagFilter}</span>
                                <button onClick={()=>setHashtagFilter('')}><X size={16}/></button>
                            </div>
                        )}

                        {displayedPosts.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <div className="mb-2">📭</div>
                                <p className="text-sm">Tidak ada postingan.</p>
                                <button onClick={()=>setHashtagFilter('')} className="mt-2 text-sky-500 text-xs font-bold">Refresh</button>
                            </div>
                        ) : (
                            displayedPosts.map(p => (
                                <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} triggerLogin={triggerLogin} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} goToTag={setHashtagFilter}/>
                            ))
                        )}
                        <div className="h-8 flex justify-center">{/* Spacer for infinite scroll trigger */}</div>
                    </div>
                )}

                {page === 'search' && (
                    <div className="max-w-lg mx-auto px-4">
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                            <input autoFocus onChange={e=>setHashtagFilter(e.target.value)} placeholder="Cari..." className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-transparent focus:border-sky-500 outline-none shadow-sm dark:text-white"/>
                        </div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Pengguna</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {users.filter(u => u.username?.toLowerCase().includes(hashtagFilter.toLowerCase())).slice(0, 5).map(u => (
                                <div key={u.uid} onClick={()=>{setTargetUid(u.uid); setPage('other-profile')}} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full object-cover"/>
                                    <div><p className="font-bold text-sm dark:text-white">{u.username}</p><p className="text-xs text-gray-400 truncate">{u.bio||'User'}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {page === 'create' && <CreatePost userId={profile.uid} username={profile.username} setPage={setPage} onSuccess={handleUploadSuccess} />}
                
                {page === 'notifications' && (
                    <div className="max-w-lg mx-auto px-4">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white"><Bell className="text-sky-500"/> Notifikasi</h2>
                        <div className="space-y-2">
                             {/* Fetch manually inside component usually, simplifying here */}
                             <p className="text-center text-gray-400 text-sm py-10">Belum ada notifikasi baru.</p>
                        </div>
                    </div>
                )}
                
                {page === 'ranking' && (
                    <div className="max-w-lg mx-auto px-4">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white"><Crown className="text-yellow-500"/> Peringkat Global</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                            {users.sort((a,b)=> (b.followers?.length||0) - (a.followers?.length||0)).slice(0,10).map((u,i) => (
                                <div key={u.uid} className="flex items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 ${i===0?'bg-yellow-100 text-yellow-600':i===1?'bg-gray-100 text-gray-600':i===2?'bg-orange-100 text-orange-600':'text-gray-400'}`}>#{i+1}</div>
                                    <img src={u.photoURL||APP_LOGO} className="w-10 h-10 rounded-full object-cover mr-3"/>
                                    <div className="flex-1"><p className="font-bold text-sm dark:text-white">{u.username}</p><p className="text-xs text-gray-400">{(u.followers?.length||0)*10} Reputasi</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(page === 'profile' || page === 'other-profile') && (
                    <div className="max-w-lg mx-auto px-4">
                        {page === 'other-profile' && <button onClick={()=>setPage('home')} className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft size={16}/> Kembali</button>}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm text-center mb-6">
                            <div className="inline-block relative mb-4">
                                <img src={(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.photoURL || APP_LOGO} className="w-24 h-24 rounded-full object-cover border-4 border-gray-50 dark:border-gray-700"/>
                                {page==='profile' && <label className="absolute bottom-0 right-0 bg-sky-500 text-white p-2 rounded-full cursor-pointer hover:bg-sky-600"><ImageIcon size={14}/><input type="file" className="hidden" accept="image/*" onChange={async(e)=>{
                                    if(e.target.files[0]) {
                                        try {
                                            const b64 = await compressImageToBase64(e.target.files[0]);
                                            await updateDoc(doc(db, getPublicCollection('userProfiles'), profile.uid), { photoURL: b64 });
                                            window.location.reload();
                                        } catch(err){alert("Gagal upload");}
                                    }
                                }}/></label>}
                            </div>
                            <h2 className="text-2xl font-black dark:text-white">{(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.username}</h2>
                            <p className="text-gray-500 text-sm mb-4">{(page==='profile'?profile:users.find(u=>u.uid===targetUid))?.bio || "Tidak ada bio."}</p>
                            
                            {page==='profile' && (
                                <button onClick={()=>signOut(auth)} className="w-full py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-red-500 font-bold text-xs">Keluar</button>
                            )}
                        </div>
                        {/* Simple Post List for Profile */}
                        {posts.filter(p => p.userId === (page==='profile'?profile.uid:targetUid)).map(p => (
                             <PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} triggerLogin={triggerLogin} goToProfile={()=>{}} goToTag={()=>{}}/>
                        ))}
                    </div>
                )}
            </main>

            {/* --- BOTTOM NAVBAR (Solid & Docked) --- */}
            <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe z-40">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                    <NavBtn icon={Home} active={page==='home'} onClick={()=>{setPage('home'); setHashtagFilter('');}}/>
                    <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                    
                    <div className="relative -top-5">
                        <button onClick={()=>isGuest?triggerLogin():setPage('create')} className="w-14 h-14 bg-sky-600 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 transition hover:bg-sky-700 border-4 border-gray-50 dark:border-gray-900">
                            <PlusCircle size={28}/>
                        </button>
                    </div>

                    <NavBtn icon={Crown} active={page==='ranking'} onClick={()=>setPage('ranking')}/>
                    <NavBtn icon={User} active={page==='profile'} onClick={()=>isGuest?triggerLogin():setPage('profile')}/>
                </div>
            </nav>

            {showLogin && <AuthScreen onLoginSuccess={()=>setShowLogin(false)} onCancel={()=>setShowLogin(false)}/>}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${active ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
        <Icon size={24} strokeWidth={active?2.5:2} />
    </button>
);

export default App;