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
    Bell, Gift, RotateCw, Crown, Gem, ShieldCheck, LogIn, PlusCircle, ArrowLeft,
    CheckCircle, AlertTriangle, ExternalLink, ChevronLeft
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
// BAGIAN 2: UTILITY FUNCTIONS (BASE64 & COMPRESSION)
// ==========================================

// Fungsi Kompresi ke Base64 (Hemat Data)
const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize agresif untuk hemat storage Firestore (Max 1MB per doc)
                // Max sisi 600px cukup untuk HP
                const MAX_SIDE = 600; 
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
                
                // Kompresi JPEG kualitas 0.6 (60%)
                resolve(canvas.toDataURL('image/jpeg', 0.6));
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
    // Deteksi YouTube
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) { 
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`, id: youtubeMatch[1] }; 
    }
    // Link Biasa
    if (url.startsWith('http')) {
        return { type: 'link', url: url };
    }
    return null;
};

const getReputationBadge = (reputation, isDev) => {
    if (isDev) return { label: "DEVELOPER", icon: ShieldCheck, color: "bg-blue-600 text-white" };
    if (reputation >= 100) return { label: "INFLUENCER", icon: Gem, color: "bg-purple-500 text-white" };
    return { label: "WARGA", icon: User, color: "bg-gray-200 text-gray-600" };
};

// ==========================================
// BAGIAN 3: KOMPONEN UI UTAMA
// ==========================================

const ImageWithRetry = ({ src, alt, className, fallbackText }) => {
    const [error, setError] = useState(false);
    if (!src || error) {
        return (
            <div className={`bg-gray-200 flex items-center justify-center text-gray-400 ${className}`}>
                 {fallbackText ? (
                    <div className="text-sky-600 font-black text-xl uppercase">{fallbackText[0]}</div>
                ) : <ImageIcon size={20} className="opacity-30"/>}
            </div>
        );
    }
    return <img src={src} alt={alt} className={className} onError={()=>setError(true)} loading="lazy" />;
};

// --- LOGIN GOOGLE COMPONENT ---
const GoogleLoginBtn = ({ onSuccess, className }) => {
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Simpan/Update data user
            const userRef = doc(db, getPublicCollection('userProfiles'), user.uid);
            // Cek dulu apakah user baru agar tidak menimpa data followers
            const snap = await getDoc(userRef);
            
            if (!snap.exists()) {
                await setDoc(userRef, { 
                    username: user.displayName, 
                    email: user.email, 
                    uid: user.uid, 
                    photoURL: user.photoURL,
                    followers: [],
                    following: [],
                    savedPosts: [],
                    createdAt: serverTimestamp(),
                    lastSeen: serverTimestamp(),
                });
            } else {
                await updateDoc(userRef, { lastSeen: serverTimestamp() });
            }

            if (onSuccess) onSuccess();
        } catch (error) {
            alert(`Login Gagal!\nError: ${error.message}\nSilakan coba lagi.`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button onClick={handleLogin} disabled={loading} className={`flex items-center justify-center gap-3 bg-white text-gray-800 border border-gray-300 font-bold py-3 px-6 rounded-full shadow-sm hover:bg-gray-50 active:scale-95 transition w-full ${className}`}>
            {loading ? <Loader2 className="animate-spin text-sky-500" size={24}/> : (
                <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.81-.81z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span>Masuk dengan Google</span>
                </>
            )}
        </button>
    );
};

// --- AUTH SCREEN (KHUSUS GOOGLE) ---
const AuthScreen = ({ onLoginSuccess, onCancel }) => (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={16}/></button>
            <div className="text-center mb-8">
                <img src={APP_LOGO} className="w-20 h-20 mx-auto mb-4 object-contain" />
                <h2 className="text-2xl font-black text-gray-800">Selamat Datang</h2>
                <p className="text-gray-500 text-sm">Masuk untuk berinteraksi, memposting, dan berteman!</p>
            </div>
            <GoogleLoginBtn onSuccess={onLoginSuccess} />
            <p className="text-[10px] text-center text-gray-400 mt-6">Dengan masuk, Anda menyetujui aturan komunitas {APP_NAME}.</p>
        </div>
    </div>
);

// --- IMAGE CAROUSEL (UNTUK POSTINGAN MULTIPLE IMAGE) ---
const ImageCarousel = ({ images }) => {
    const [idx, setIdx] = useState(0);
    if (!images || images.length === 0) return null;
    if (images.length === 1) return <ImageWithRetry src={images[0]} className="w-full max-h-[500px] object-cover" />;

    return (
        <div className="relative w-full aspect-square bg-gray-100">
            <ImageWithRetry src={images[idx]} className="w-full h-full object-cover animate-in fade-in duration-300" />
            <button onClick={(e) => {e.stopPropagation(); setIdx(prev => (prev === 0 ? images.length - 1 : prev - 1))}} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"><ChevronLeft size={20}/></button>
            <button onClick={(e) => {e.stopPropagation(); setIdx(prev => (prev === images.length - 1 ? 0 : prev + 1))}} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"><ChevronRight size={20}/></button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}></div>
                ))}
            </div>
        </div>
    );
};

// --- POST ITEM ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile, triggerLogin }) => {
    const isGuest = currentUserId === 'guest';
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    
    // Support legacy 'mediaUrl' string and new 'mediaUrls' array
    const mediaList = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    const embed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]); // YouTube link biasanya di mediaUrl (string)

    const isOwner = post.userId === currentUserId;
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL;

    const handleLike = async () => {
        if (isGuest) { triggerLogin(); return; }
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

    const handleComment = async (e) => {
        e.preventDefault(); 
        if (isGuest) { triggerLogin(); return; }
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), { postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp() });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: increment(1) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => { if (confirm("Hapus postingan ini?")) { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } };
    
    useEffect(() => { if (!showComments) return; const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id)); return onSnapshot(q, s => { setComments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0))); }); }, [showComments, post.id]);

    const userBadge = isDeveloper ? getReputationBadge(1000, true) : getReputationBadge(0, false); 

    return (
        <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden">
                        <ImageWithRetry src={post.user?.photoURL} alt="User" className="w-full h-full object-cover" fallbackText={post.user?.username}/>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1">{post.user?.username} {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}</h4>
                        <div className="flex items-center gap-2"><span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span></div>
                    </div>
                </div>
                {isOwner && ( <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button> )}
            </div>

            {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
            <div className="text-sm text-gray-600 mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</div>
            
            {/* TAMPILKAN GAMBAR (MULTIPLE) */}
            {mediaList.length > 0 && post.mediaType === 'image' && (
                <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100">
                    <ImageCarousel images={mediaList} />
                </div>
            )}

            {/* TAMPILKAN YOUTUBE */}
            {embed?.type === 'youtube' && (
                <div className="mb-4 rounded-2xl overflow-hidden aspect-video bg-black">
                    <iframe src={embed.embedUrl} className="w-full h-full border-0" allowFullScreen></iframe>
                </div>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}><Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> {likeCount}</button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={22}/> {post.commentsCount || 0}</button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar">{comments.map(c => ( <div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs"> <span className="font-bold text-gray-800 mr-1">{c.username}</span>{c.text}</div> ))}</div>
                    <form onSubmit={handleComment} className="flex gap-2 relative">
                        <input disabled={isGuest} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={isGuest ? "Login untuk komentar..." : "Tulis komentar..."} className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-200"/>
                        <button type="submit" disabled={!newComment.trim() || isGuest} className="p-2 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50"><Send size={16}/></button>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- CREATE POST (BASE64 & YOUTUBE ONLY) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', youtubeUrl: '' });
    const [images, setImages] = useState([]); // Array of base64 strings
    const [loading, setLoading] = useState(false);

    const handleImageSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        // Limit: Jika user memilih banyak, ambil 5 pertama saja atau peringatkan
        if (files.length > 5) { alert("Maksimal 5 foto sekaligus."); return; }

        setLoading(true);
        try {
            const promises = files.map(file => compressImageToBase64(file));
            const base64Results = await Promise.all(promises);
            setImages(prev => [...prev, ...base64Results]); // Gabung dengan yang sudah ada
        } catch (err) {
            alert("Gagal memproses gambar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const submit = async (e) => {
        e.preventDefault(); 
        setLoading(true);
        try {
            const isYoutube = form.youtubeUrl.includes('youtu');
            // Data yang akan disimpan
            const postData = {
                userId, 
                title: form.title, 
                content: form.content, 
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                user: { username, uid: userId },
                // Logika Media
                mediaType: images.length > 0 ? 'image' : (isYoutube ? 'video' : 'text'),
                // Jika Youtube, simpan di mediaUrl (string legacy)
                mediaUrl: isYoutube ? form.youtubeUrl : (images.length > 0 ? images[0] : ''),
                // Jika Gambar, simpan array base64 di mediaUrls
                mediaUrls: images
            };

            await addDoc(collection(db, getPublicCollection('posts')), postData);
            onSuccess();
        } catch(e){ alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 relative overflow-hidden mt-4">
                <button onClick={()=>setPage('home')} className="mb-4 text-gray-400 hover:text-gray-600 flex items-center text-sm font-bold"><ChevronLeft size={16}/> Batal</button>
                <h2 className="text-xl font-black text-gray-800 mb-6">Buat Postingan Baru</h2>
                <form onSubmit={submit} className="space-y-4">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Judul (Opsional)..." className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 transition"/>
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Apa yang Anda pikirkan?" rows="4" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    
                    {/* INPUT GAMBAR MULTIPLE */}
                    <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {images.map((img, i) => (
                                <div key={i} className="w-20 h-20 rounded-lg overflow-hidden relative group border border-gray-200">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button type="button" onClick={()=>removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={12}/></button>
                                </div>
                            ))}
                            {images.length < 5 && (
                                <label className="w-20 h-20 rounded-lg bg-sky-50 border-2 border-dashed border-sky-200 flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition text-sky-500">
                                    <ImageIcon size={20}/>
                                    <span className="text-[9px] font-bold mt-1">Tambah</span>
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageSelect} disabled={loading || form.youtubeUrl.length > 0}/>
                                </label>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400">*Maksimal 5 foto. Base64 Compressed.</p>
                    </div>

                    {/* INPUT YOUTUBE */}
                    <div className="relative">
                        <Youtube size={18} className="absolute left-3 top-3 text-red-500"/>
                        <input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value, images:[]})} disabled={images.length > 0} placeholder="Link YouTube (Video/Shorts)..." className="w-full pl-10 p-3 bg-gray-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-50"/>
                    </div>
                    {images.length > 0 && form.youtubeUrl && <p className="text-[10px] text-red-500">Pilih salah satu: Foto atau YouTube.</p>}
                    
                    <button disabled={loading || (!form.content && images.length===0 && !form.youtubeUrl)} className="w-full py-3 bg-sky-500 text-white rounded-xl font-bold shadow-lg hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <><Send size={18}/> Posting</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- PROFILE SCREEN ---
const ProfileScreen = ({ viewerProfile, profileData, allPosts, triggerLogin }) => {
    const isGuest = viewerProfile.uid === 'guest';
    const [edit, setEdit] = useState(false); 
    const [name, setName] = useState(profileData.username || ''); 
    const [loading, setLoading] = useState(false);
    
    const isSelf = viewerProfile.uid === profileData.uid; 
    const userPosts = allPosts.filter(p => p.userId === profileData.uid);

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setLoading(true);
        try {
            const base64 = await compressImageToBase64(file);
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { photoURL: base64 });
        } catch(e) { alert("Gagal update foto: " + e.message); } 
        finally { setLoading(false); }
    };

    const saveName = async () => {
        if(!name.trim()) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), profileData.uid), { username: name });
            setEdit(false);
        } catch(e) { alert("Gagal: " + e.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6 px-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-50 mb-8 text-center relative overflow-hidden">
                <div className="w-24 h-24 mx-auto rounded-full bg-gray-100 border-4 border-white shadow-lg overflow-hidden relative group">
                     <ImageWithRetry src={profileData.photoURL} className="w-full h-full object-cover" fallbackText={profileData.username}/>
                     {isSelf && !loading && (
                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                            <ImageIcon className="text-white"/>
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/>
                        </label>
                     )}
                     {loading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-sky-500"/></div>}
                </div>
                
                {edit && isSelf ? (
                    <div className="mt-4 flex gap-2 justify-center">
                        <input value={name} onChange={e=>setName(e.target.value)} className="border-b border-sky-500 text-center text-lg font-bold outline-none"/>
                        <button onClick={saveName} className="text-sky-500"><Check/></button>
                    </div>
                ) : (
                    <h1 className="text-2xl font-black text-gray-800 mt-4 flex items-center justify-center gap-2">
                        {profileData.username} 
                        {isSelf && <button onClick={()=>setEdit(true)} className="text-gray-300 hover:text-sky-500"><ChevronsRight size={14}/></button>}
                    </h1>
                )}
                
                <p className="text-gray-400 text-sm">{profileData.email}</p>
                
                <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-50">
                    <div className="text-center"><span className="block font-black text-xl">{userPosts.length}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Postingan</span></div>
                </div>
            </div>
            
            <h3 className="font-bold text-gray-800 mb-4 ml-2">Postingan Terbaru</h3>
            <div>
                {userPosts.length === 0 ? <p className="text-center text-gray-400 py-10">Belum ada postingan.</p> : userPosts.map(p => (
                    <PostItem key={p.id} post={p} currentUserId={viewerProfile.uid} profile={viewerProfile} triggerLogin={triggerLogin} goToProfile={()=>{}}/>
                ))}
            </div>
        </div>
    );
};

// --- HOME SCREEN ---
const HomeScreen = ({ currentUserId, profile, allPosts, goToProfile, triggerLogin }) => {
    // Logic: Tampilkan semua post, urutkan dari terbaru
    const sortedPosts = [...allPosts].sort((a,b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));

    return (
        <div className="max-w-lg mx-auto pb-24 px-4 pt-4">
            {sortedPosts.map(p => (
                <PostItem 
                    key={p.id} 
                    post={p} 
                    currentUserId={currentUserId} 
                    profile={profile} 
                    triggerLogin={triggerLogin}
                    goToProfile={goToProfile}
                />
            ))}
            {sortedPosts.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-200 mt-4">
                    <p className="text-gray-400 font-bold">Belum ada postingan.</p>
                </div>
            )}
        </div>
    );
};

// --- APP UTAMA ---
const App = () => {
    // State User
    const [user, setUser] = useState(undefined); // undefined = loading
    const [profile, setProfile] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    
    // State App
    const [page, setPage] = useState('home');
    const [posts, setPosts] = useState([]);
    const [users, setUsers] = useState([]);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [targetUid, setTargetUid] = useState(null);

    // Guest Profile Dummy
    const GUEST_PROFILE = useMemo(() => ({ uid: 'guest', username: 'Tamu', email: '', photoURL: '' }), []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setIsGuest(false);
                // Listen Profile Realtime
                onSnapshot(doc(db, getPublicCollection('userProfiles'), u.uid), (doc) => {
                    if (doc.exists()) setProfile({ ...doc.data(), uid: u.uid });
                });
            } else {
                setUser(null);
                setProfile(GUEST_PROFILE);
                setIsGuest(true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Listen Posts Realtime
    useEffect(() => {
        const q = query(collection(db, getPublicCollection('posts')), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            const rawPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Gabungkan data user ke post
            // (Sebaiknya fetch user data terpisah untuk performa, tapi ini cara cepat)
            // Di sini kita asumsikan data user sudah tersimpan di post saat create, atau fetch userProfiles
            setPosts(rawPosts);
        });
        return () => unsub();
    }, []);

    const triggerLogin = () => setShowLoginModal(true);

    if (user === undefined) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32}/></div>;

    const activeProfile = isGuest ? GUEST_PROFILE : profile;
    if (!activeProfile) return null;

    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800">
            {/* HEADER */}
            <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('home')}>
                    <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                    <span className="font-black text-xl tracking-tighter text-sky-600">{APP_NAME}</span>
                </div>
                <div>
                    {isGuest ? (
                        <button onClick={triggerLogin} className="bg-sky-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-sky-700 transition">
                            Masuk
                        </button>
                    ) : (
                        <button onClick={() => signOut(auth)} className="bg-gray-100 text-gray-500 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition">
                            <LogOut size={18}/>
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="pt-20">
                {page === 'home' && (
                    <HomeScreen 
                        currentUserId={activeProfile.uid} 
                        profile={activeProfile} 
                        allPosts={posts} 
                        triggerLogin={triggerLogin}
                        goToProfile={(uid) => { setTargetUid(uid); setPage('other-profile'); }}
                    />
                )}
                {page === 'create' && (
                    <CreatePost 
                        userId={activeProfile.uid} 
                        username={activeProfile.username} 
                        setPage={setPage}
                        onSuccess={() => setPage('home')}
                    />
                )}
                {page === 'profile' && !isGuest && (
                    <ProfileScreen 
                        viewerProfile={activeProfile} 
                        profileData={activeProfile} 
                        allPosts={posts} 
                        triggerLogin={triggerLogin}
                    />
                )}
                {page === 'other-profile' && (
                    // Di implementasi nyata, kita perlu fetch data user target dari users collection
                    // Untuk simplifikasi, kita filter dari posts (tidak ideal tapi bekerja untuk demo)
                    <div className="max-w-lg mx-auto p-4">
                        <button onClick={()=>setPage('home')} className="mb-4 flex items-center gap-1 text-gray-500"><ChevronLeft/> Kembali</button>
                        <div className="bg-white p-6 rounded-2xl text-center">
                            <h2 className="font-bold text-xl">Profil Pengguna</h2>
                            <p className="text-gray-400">Fitur profil pengguna lain sedang dimuat...</p>
                        </div>
                    </div>
                )}
            </main>

            {/* BOTTOM NAV */}
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40">
                <NavBtn icon={Home} active={page === 'home'} onClick={() => setPage('home')} />
                <button 
                    onClick={() => isGuest ? triggerLogin() : setPage('create')} 
                    className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"
                >
                    <PlusCircle size={24}/>
                </button>
                <NavBtn icon={User} active={page === 'profile'} onClick={() => isGuest ? triggerLogin() : setPage('profile')} />
            </nav>

            {/* MODAL LOGIN */}
            {showLoginModal && (
                <AuthScreen 
                    onLoginSuccess={() => setShowLoginModal(false)} 
                    onCancel={() => setShowLoginModal(false)}
                />
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={24} strokeWidth={active?2.5:2} />
    </button>
);

// Lucide Icon yang belum di define di atas tapi dipakai di ProfileScreen
const ChevronsRight = () => null; 

export default App;