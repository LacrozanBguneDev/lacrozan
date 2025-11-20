import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    limit
} from 'firebase/firestore';
import { 
    LogOut, 
    Home, 
    User, 
    Send, 
    Heart, 
    MessageSquare, 
    Image, 
    Loader2, 
    Link as LinkIcon, 
    ListOrdered, 
    Shuffle, 
    Code, 
    Calendar, 
    Lock, 
    Mail, 
    UserPlus, 
    LogIn, 
    AlertCircle, 
    Edit, 
    Trash2, 
    X, 
    Check, 
    Save, 
    PlusCircle, 
    Search, 
    UserCheck, 
    ChevronRight,
    Share2, 
    Film, 
    TrendingUp, 
    Flame, 
    ArrowLeft, 
    AlertTriangle, 
    Bell, 
    Phone, 
    HelpCircle,
    RefreshCw, 
    Info, 
    Clock, 
    Star, 
    ExternalLink, 
    Gamepad2, 
    BookOpen, 
    Users, 
    Globe,
    CheckCircle,
    Sparkles,
    Zap,
    MoreHorizontal,
    ShieldCheck
} from 'lucide-react';

// Atur log level ke 'warn' agar konsol bersih
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
const PASSWORD_RESET_LINK = "https://forms.gle/cAWaoPMDkffg6fa89";

// --- 1. KONFIGURASI DAN INISIALISASI FIREBASE ---
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
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const getPublicCollection = (collectionName) => 
    `artifacts/${appId}/public/data/${collectionName}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UTILS: SHUFFLE ARRAY (Algoritma Acak Fisher-Yates) ---
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

// --- HELPER NOTIFIKASI ---
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
    } catch (error) {
        console.error("Gagal kirim notifikasi:", error);
    }
};

// --- 2. FUNGSI UNGGAH API ---
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        for (let i = 0; i <= 30; i += 5) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }
        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        onProgress(90);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        onProgress(100);
        if (data && data.status) return data.url;
        else throw new Error(data.message || 'Gagal mengunggah file.');
    } catch (error) {
        onProgress(0); 
        console.error('Upload error:', error);
        throw new Error('Gagal mengunggah media. Coba lagi.');
    }
};

// --- 3. UTILITY FUNCTIONS ---
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds > 86400) { 
        return { 
            relative: date.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}), 
            full: date.toLocaleDateString() 
        };
    }
    if (seconds < 60) return { relative: 'Baru saja', full: '' };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes}m`, full: '' };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours}j`, full: '' };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, id: youtubeMatch[1] };
    }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) {
        return { type: 'link', embedUrl: url, displayUrl: url, platform: url.includes('tiktok.com') ? 'TikTok' : 'Instagram' };
    }
    return null;
};

// --- FITUR BARU: ADVANCED MARKDOWN RENDERER ---
const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-500 italic">Tidak ada konten.</p>;
    let html = text;

    // 1. Sanitasi HTML dasar (mencegah XSS sederhana)
    html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 2. Format Tautan [Teks](URL) - INOVASI BARU
    html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g, 
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-600 font-bold hover:underline inline-flex items-center gap-1">$1 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>'
    );

    // 3. Auto-Link (http/https tanpa bracket)
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g, 
        (match) => {
            // Hindari double replace jika sudah kena regex di atas
            if (match.includes('href="')) return match;
            return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-sky-600 hover:underline break-all">${match}</a>`;
        }
    );

    // 4. Format Standar
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    html = html.replace(/`(.*?)`/g, '<code class="bg-sky-100 px-1 rounded text-sm text-sky-700 font-mono border border-sky-200">$1</code>'); // Code Block

    // 5. Newline
    html = html.replace(/\n/g, '<br>');

    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- 4. LANDING PAGE (Modern UI) ---
const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center px-6 py-12 font-sans relative overflow-hidden">
            {/* Dekorasi Background Modern */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            <div className="relative z-10 text-center w-full max-w-md">
                <div className="bg-white/60 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-[2.5rem] p-8 transform hover:scale-[1.01] transition duration-500">
                    <div className="relative inline-block mb-6">
                        <img src={APP_LOGO} alt="Logo" className="w-28 h-28 mx-auto drop-shadow-md object-contain" />
                        <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white">2025</div>
                    </div>
                    
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-purple-600 mb-3 tracking-tight">{APP_NAME}</h1>
                    <p className="text-gray-600 font-medium mb-8 leading-relaxed">
                        Jejaring sosial serbaguna yang aman, modern, dan interaktif untuk semua kalangan. 🌍✨
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-indigo-100 transition">
                            <Gamepad2 size={24} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Gamers</span>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-emerald-100 transition">
                            <BookOpen size={24} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Edukasi</span>
                        </div>
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-rose-100 transition">
                            <Users size={24} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Sosial</span>
                        </div>
                        <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50 hover:bg-amber-100 transition">
                            <Globe size={24} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Global</span>
                        </div>
                    </div>

                    <button onClick={onGetStarted} className="w-full py-4 bg-gradient-to-r from-sky-500 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-200 hover:shadow-xl transform active:scale-95 transition-all flex items-center justify-center group">
                        Mulai Sekarang <ChevronRight className="ml-2 group-hover:translate-x-1 transition"/>
                    </button>
                </div>

                {/* Developer Card */}
                <div className="mt-8 bg-white/40 backdrop-blur-md border border-white/40 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/60 transition shadow-sm cursor-default">
                    <div className="relative">
                        <img src={DEV_PHOTO} className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover" alt="Developer"/>
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5">Developed By</p>
                        <h3 className="font-bold text-gray-800 text-sm">M. Irham Andika Putra</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck size={10}/> SMP Negeri 3 Mentok</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 5. AUTH SCREEN ---
const AuthScreen = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [username, setUsername] = useState('');
    const [err, setErr] = useState('');
    const [load, setLoad] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setErr(''); setLoad(true);
        try {
            if(isLogin) {
                const uc = await signInWithEmailAndPassword(auth, email, pass);
                // Sync user profile
                const ref = doc(db, getPublicCollection('userProfiles'), uc.user.uid);
                const snap = await getDoc(ref);
                if(!snap.exists()) {
                    await setDoc(ref, {
                        username: email.split('@')[0], email, createdAt: serverTimestamp(), 
                        uid: uc.user.uid, photoURL: '', following: [], followers: []
                    });
                }
            } else {
                if(!username.trim()) throw new Error("Username wajib diisi");
                const uc = await createUserWithEmailAndPassword(auth, email, pass);
                await setDoc(doc(db, getPublicCollection('userProfiles'), uc.user.uid), {
                    username: username.trim(), email, createdAt: serverTimestamp(), 
                    uid: uc.user.uid, photoURL: '', following: [], followers: []
                });
            }
            onLoginSuccess();
        } catch (e) {
            setErr(e.message.replace('Firebase: ', ''));
        } finally { setLoad(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-white p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400"></div>
                <div className="text-center mb-8 mt-2">
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight mb-1">{isLogin?'Selamat Datang':'Mulai Petualangan'}</h2>
                    <p className="text-gray-400 text-sm">Masuk ke dunia {APP_NAME}</p>
                </div>
                {err && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center border border-red-100"><AlertTriangle size={14} className="mr-2 flex-shrink-0"/>{err}</div>}
                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && <div className="group relative"><User size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>}
                    <div className="group relative"><Mail size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>
                    <div className="group relative"><Lock size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm focus:ring-2 focus:ring-sky-200 outline-none transition-all"/></div>
                    <button disabled={load} className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-800 shadow-lg shadow-gray-200 transition transform active:scale-95">{load?<Loader2 className="animate-spin mx-auto"/>:(isLogin?'Masuk':'Daftar')}</button>
                </form>
                <div className="mt-6 text-center pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-4">{isLogin?'Belum punya akun?':'Sudah punya akun?'} <button onClick={()=>setIsLogin(!isLogin)} className="font-bold text-sky-600 hover:underline">{isLogin?'Daftar':'Masuk'}</button></p>
                    {isLogin && <a href={PASSWORD_RESET_LINK} target="_blank" className="inline-flex items-center px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-xs font-bold hover:bg-sky-100 transition"><HelpCircle size={14} className="mr-2"/> Lupa Kata Sandi?</a>}
                </div>
            </div>
        </div>
    );
};

// --- 6. POST ITEM (FIX READ MORE & LINKS) ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile }) => {
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    
    // STATE BARU: Kontrol Baca Selengkapnya
    const [isExpanded, setIsExpanded] = useState(false);

    const isOwner = post.userId === currentUserId;
    const isFollowing = profile.following?.includes(post.userId);
    const isDeveloper = post.user?.email === DEVELOPER_EMAIL; // Cek dev untuk centang biru
    
    // LOGIKA BACA SELENGKAPNYA
    const MAX_LENGTH = 200;
    const isLongContent = post.content && post.content.length > MAX_LENGTH;
    const contentToDisplay = isExpanded || !isLongContent ? post.content : post.content.slice(0, MAX_LENGTH) + "...";

    // Update UI Optimistic untuk Like
    useEffect(() => {
        setLiked(post.likes?.includes(currentUserId));
        setLikeCount(post.likes?.length || 0);
    }, [post.likes, currentUserId]);

    const handleLike = async () => {
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
        const ref = doc(db, getPublicCollection('posts'), post.id);
        if(newLiked) {
            await updateDoc(ref, {likes: arrayUnion(currentUserId)});
            if(!isOwner) sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
        } else {
            await updateDoc(ref, {likes: arrayRemove(currentUserId)});
        }
    };

    const handleComment = async (e) => {
        e.preventDefault(); if(!newComment.trim()) return;
        await addDoc(collection(db, getPublicCollection('comments')), {postId: post.id, userId: currentUserId, text: newComment, username: profile.username, timestamp: serverTimestamp()});
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), {commentsCount: (post.commentsCount||0)+1});
        if(!isOwner) sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0,15)}.."`, profile, post.id);
        setNewComment('');
    };

    const handleUpdate = async () => {
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if(confirm("Hapus postingan?")) await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
    };

    const sharePost = async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin! Orang lain akan diarahkan ke postingan ini.'); } catch(e){}
    };

    // Load Comments only when requested
    useEffect(() => {
        if(!showComments) return;
        return onSnapshot(query(collection(db, getPublicCollection('comments')), where('postId','==',post.id)), s => {
            setComments(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0)));
        });
    }, [showComments, post.id]);

    const embed = useMemo(()=>getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !embed;
    const isImage = (post.mediaUrl && (/\.(jpg|png|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !embed;

    return (
        <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden group transition hover:shadow-lg">
            {post.isShort && <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md z-10 flex items-center"><Zap size={10} className="mr-1 text-yellow-400"/> SHORT</div>}
            
            {/* INOVASI: Badge Trending jika like > 10 */}
            {likeCount > 10 && !post.isShort && <div className="absolute top-4 right-4 bg-orange-100 text-orange-600 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-200 flex items-center"><Flame size={10} className="mr-1"/> TRENDING</div>}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={()=>goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : <span className="font-bold text-sky-600">{post.user?.username?.[0]}</span>}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1">
                            {post.user?.username}
                            {/* INOVASI: Centang Biru untuk Developer */}
                            {isDeveloper && <ShieldCheck size={14} className="text-blue-500 fill-blue-100"/>}
                        </h4>
                        <span className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!isOwner && post.userId!==currentUserId && <button onClick={()=>handleFollow(post.userId, isFollowing)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${isFollowing?'bg-gray-100 text-gray-600':'bg-sky-50 text-sky-600'}`}>{isFollowing?'Teman':'Ikuti'}</button>}
                    {isOwner && <><button onClick={()=>setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-sky-600 rounded-full"><Edit size={16}/></button><button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 rounded-full"><Trash2 size={16}/></button></>}
                </div>
            </div>

            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <input value={editedTitle} onChange={e=>setEditedTitle(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold text-sm"/>
                    <textarea value={editedContent} onChange={e=>setEditedContent(e.target.value)} className="w-full p-2 bg-white border rounded-lg text-sm" rows="3"/>
                    <div className="flex justify-end gap-2"><button onClick={()=>setIsEditing(false)} className="text-xs font-bold text-gray-500">Batal</button><button onClick={handleUpdate} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button></div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
                    <div className="text-sm text-gray-600 mb-4 leading-relaxed">
                        {renderMarkdown(contentToDisplay)}
                        
                        {/* TOMBOL BACA SELENGKAPNYA */}
                        {isLongContent && (
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="text-sky-600 font-bold text-xs ml-1 hover:underline bg-sky-50 px-2 py-0.5 rounded"
                            >
                                {isExpanded ? 'Tutup' : 'Baca Selengkapnya'}
                            </button>
                        )}
                    </div>

                    {(isImage || isVideo || embed) && (
                        <div className="mb-4 rounded-2xl overflow-hidden bg-black/5 border border-gray-100 relative">
                            {isImage && <img src={post.mediaUrl} className="w-full max-h-[500px] object-cover"/>}
                            {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black"/>}
                            {embed?.type==='youtube' && <div className="aspect-video"><iframe src={embed.embedUrl} className="w-full h-full border-0" allowFullScreen/></div>}
                            {embed?.type==='link' && <a href={embed.displayUrl} target="_blank" className="block p-6 text-center bg-sky-50 text-sky-600 font-bold text-sm hover:underline">Buka Tautan Eksternal <ExternalLink size={14} className="inline ml-1"/></a>}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition ${liked?'text-rose-500':'text-gray-400'}`}><Heart size={22} fill={liked?'currentColor':'none'} className={liked?'animate-pulse':''}/> {likeCount}</button>
                <button onClick={()=>setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500"><MessageSquare size={22}/> {post.commentsCount||0}</button>
                <button onClick={sharePost} className="ml-auto text-gray-400 hover:text-sky-500"><Share2 size={22}/></button>
            </div>

            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">
                        {comments.map(c=><div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs"><span className="font-bold text-gray-800 mr-1">{c.username}</span><span className="text-gray-600">{c.text}</span></div>)}
                    </div>
                    <form onSubmit={handleComment} className="flex gap-2 relative"><input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-xs outline-none"/><button type="submit" disabled={!newComment.trim()} className="absolute right-1.5 top-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md"><Send size={14}/></button></form>
                </div>
            )}
        </div>
    );
};

// --- 7. HOME SCREEN (Stable Feed) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost }) => {
    const [sortType, setSortType] = useState('random'); 
    const [stableFeed, setStableFeed] = useState([]);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    useEffect(() => {
        if(allPosts.length === 0) return;
        let basePosts = allPosts.filter(p => !p.isShort);
        let pinnedPost = null;

        if(newPostId) {
            const idx = basePosts.findIndex(p => p.id === newPostId);
            if(idx > -1) { pinnedPost = basePosts[idx]; basePosts.splice(idx, 1); }
        }

        let processedPosts = [];
        if (sortType === 'latest') processedPosts = basePosts.sort((a,b) => (b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
        else if (sortType === 'popular') processedPosts = basePosts.sort((a,b) => (b.likes?.length||0)-(a.likes?.length||0));
        else {
            if (isFirstLoad || stableFeed.length === 0) processedPosts = shuffleArray([...basePosts]);
            else processedPosts = stableFeed.map(old => basePosts.find(p => p.id === old.id)).filter(p => p);
        }

        if (pinnedPost) processedPosts.unshift(pinnedPost);
        setStableFeed(processedPosts);
        setIsFirstLoad(false);
    }, [allPosts, sortType, newPostId]);

    const manualRefresh = () => { setStableFeed([]); setIsFirstLoad(true); setSortType('random'); clearNewPost(); };

    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            <div className="flex items-center justify-between mb-6 pt-4 sticky top-16 z-30 bg-[#F0F4F8]/90 backdrop-blur-md py-2 -mx-4 px-4">
                <div className="flex gap-2">
                     <button onClick={()=>setSortType('latest')} className={`px-4 py-2 rounded-full text-xs font-bold transition border ${sortType==='latest'?'bg-sky-500 text-white border-sky-500':'bg-white text-gray-500 border-white'}`}>Terbaru</button>
                     <button onClick={()=>setSortType('popular')} className={`px-4 py-2 rounded-full text-xs font-bold transition border ${sortType==='popular'?'bg-purple-500 text-white border-purple-500':'bg-white text-gray-500 border-white'}`}>Populer</button>
                </div>
                <button onClick={manualRefresh} className="p-2 bg-white text-gray-500 rounded-full shadow-sm hover:rotate-180 transition duration-500"><RefreshCw size={20}/></button>
            </div>

            {stableFeed.length===0 ? <div className="text-center py-20 opacity-50"><Loader2 className="animate-spin mx-auto mb-2"/> Feed Kosong...</div> : 
            stableFeed.map(p => <div key={p.id} className={p.id===newPostId?"animate-in slide-in-from-top-10":""}>{p.id===newPostId && <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2"><CheckCircle size={14}/> Postingan Terkirim</div>}<PostItem post={p} currentUserId={currentUserId} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile}/></div>)}
        </div>
    );
};

// --- 8. SHORTS SCREEN ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollow, profile }) => {
    const [feed, setFeed] = useState([]);
    useEffect(() => setFeed(shuffleArray(allPosts.filter(p=>p.isShort && p.mediaUrl))), [allPosts]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center">
             <div className="w-full max-w-md h-[100dvh] overflow-y-scroll snap-y snap-mandatory snap-always no-scrollbar bg-black">
                {feed.length===0 ? <div className="h-full flex items-center justify-center text-gray-500 font-bold">Belum ada Shorts</div> : feed.map(p => <ShortItem key={p.id} post={p} currentUserId={currentUserId} handleFollow={handleFollow} profile={profile}/>)}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollow, profile }) => {
    const [playing, setPlaying] = useState(false); const [muted, setMuted] = useState(false);
    const [showCom, setShowCom] = useState(false); const [comments, setComments] = useState([]); const [txt, setTxt] = useState('');
    const ref = useRef(); const vidRef = useRef();
    const isLiked = post.likes?.includes(currentUserId); const embed = useMemo(()=>getMediaEmbed(post.mediaUrl),[post.mediaUrl]);

    useEffect(() => {
        const obs = new IntersectionObserver(e => { e.forEach(en => { setPlaying(en.isIntersecting); if(vidRef.current) en.isIntersecting ? vidRef.current.play().catch(()=>{}) : vidRef.current.pause(); }); }, {threshold: 0.6});
        if(ref.current) obs.observe(ref.current); return () => ref.current && obs.unobserve(ref.current);
    }, []);

    const toggleLike = async () => {
        const r = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) updateDoc(r, {likes:arrayRemove(currentUserId)});
        else { updateDoc(r, {likes:arrayUnion(currentUserId)}); if(post.userId!==currentUserId) sendNotification(post.userId, 'like', 'menyukai shorts Anda', profile, post.id); }
    };

    useEffect(()=>{if(showCom) return onSnapshot(query(collection(db,getPublicCollection('comments')),where('postId','==',post.id)),s=>setComments(s.docs.map(d=>d.data())))},[showCom,post.id]);

    return (
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center overflow-hidden border-b border-gray-800">
             {embed?.type==='youtube' ? <div className="w-full h-full relative">{playing?<iframe src={`${embed.embedUrl}&autoplay=1&controls=0&loop=1`} className="w-full h-full pointer-events-auto"/>:<div className="w-full h-full bg-black"/>}<div className="absolute inset-0 bg-transparent pointer-events-none"/></div> : <video ref={vidRef} src={post.mediaUrl} className="w-full h-full object-cover" loop muted={muted} playsInline onClick={()=>setMuted(!muted)}/>}
             
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
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Shorts Disalin')}} className="flex flex-col items-center"><div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20"><Share2 size={24}/></div><span className="text-white text-xs font-bold mt-1 drop-shadow-md">Share</span></button>
             </div>

             {showCom && <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end pointer-events-auto"><div className="w-full h-[60%] bg-white rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom duration-300"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">Komentar</h3><button onClick={()=>setShowCom(false)} className="bg-gray-100 p-1 rounded-full"><X size={20}/></button></div><div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">{comments.map((c,i)=><div key={i} className="text-xs text-gray-800 border-b border-gray-50 pb-2"><span className="font-bold text-sky-600 mr-2">{c.username}</span>{c.text}</div>)}</div><div className="flex gap-2 mt-2 pt-2 border-t"><input value={txt} onChange={e=>setTxt(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-xs outline-none" placeholder="Ketik..."/><button onClick={async()=>{if(!txt.trim())return;await addDoc(collection(db,getPublicCollection('comments')),{postId:post.id,userId:currentUserId,text:txt,username:profile.username});await updateDoc(doc(db,getPublicCollection('posts'),post.id),{commentsCount:(post.commentsCount||0)+1});setTxt('')}} className="text-sky-600 font-bold text-xs px-2">Kirim</button></div></div></div>}
        </div>
    );
};

// --- 9. CREATE POST (Dengan Format Link) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null, url: '', isShort: false });
    const [loading, setLoading] = useState(false); const [prog, setProg] = useState(0); const [isLarge, setIsLarge] = useState(false);

    const insertLinkFormat = () => { setForm({...form, content: form.content + " [Teks Link](https://...)"}); };

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setProg(0);
        try {
            let finalUrl = form.url, type = 'text';
            if(form.file) { finalUrl = await uploadToFaaAPI(form.file, setProg); type = form.file.type.startsWith('image')?'image':'video'; }
            else if(form.url) type='link';
            const ref = await addDoc(collection(db, getPublicCollection('posts')), {userId, title: form.title, content: form.content, mediaUrl: finalUrl, mediaType: type, timestamp: serverTimestamp(), likes: [], commentsCount: 0, isShort: form.isShort, user: {username, uid: userId}});
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
                    <textarea value={form.content} onChange={e=>setForm({...form, content:e.target.value})} placeholder="Ceritakan sesuatu..." rows="4" className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"/>
                    
                    {/* Toolbar Format Teks */}
                    <div className="flex gap-2 text-xs overflow-x-auto no-scrollbar pb-2">
                         <button type="button" onClick={()=>setForm({...form, content: form.content + "**tebal**"})} className="bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">B Bold</button>
                         <button type="button" onClick={()=>setForm({...form, content: form.content + "*miring*"})} className="bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">I Italic</button>
                         <button type="button" onClick={insertLinkFormat} className="bg-sky-100 text-sky-600 px-2 py-1 rounded hover:bg-sky-200 flex items-center gap-1"><LinkIcon size={10}/> Link</button>
                    </div>

                    {isLarge && <div className="bg-orange-50 text-orange-600 text-xs p-3 rounded-xl flex items-center font-medium"><AlertTriangle size={14} className="mr-2"/> File besar detected. Upload lama.</div>}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.file?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 text-gray-500'}`}><Image size={18} className="mr-2"/><span className="text-xs font-bold">{form.file?'Ganti File':'Foto/Video'}</span><input type="file" className="hidden" accept="image/*,video/*" onChange={e=>{const f=e.target.files[0]; if(f) {setForm({...form, file:f, isShort: f.type.startsWith('video')}); setIsLarge(f.size > 25*1024*1024);}}}/></label>
                        <div onClick={()=>setForm({...form, isShort:!form.isShort})} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap transition ${form.isShort?'bg-black text-white border-black':'border-gray-200 text-gray-500'}`}><Zap size={18} className="mr-2"/><span className="text-xs font-bold">Mode Shorts</span></div>
                    </div>
                    <div className="relative"><LinkIcon size={16} className="absolute left-3 top-3.5 text-gray-400"/><input value={form.url} onChange={e=>setForm({...form, url:e.target.value, file:null, isShort: e.target.value.includes('shorts')})} placeholder="Atau Link Video (YouTube)..." className="w-full pl-10 py-3 bg-gray-50 rounded-xl text-xs outline-none"/></div>
                    <button disabled={loading} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">{loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}</button>
                </form>
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 text-[10px] text-gray-500 grid grid-cols-2 gap-2"><span>Gunakan format <b>[Judul](https://...)</b> untuk link rapi.</span><span>Gunakan <b>`kode`</b> untuk teks coding.</span></div>
            </div>
        </div>
    );
};

// --- 10. LAYAR LAIN (Profil, Search, Notif) ---
const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifs, setNotifs] = useState([]);
    useEffect(() => onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50)), s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead))), [userId]);
    const handleClick = async (n) => { await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true}); if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); } else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); } };
    return <div className="max-w-lg mx-auto p-4 pb-24"><h1 className="text-xl font-black text-gray-800 mb-6">Notifikasi</h1>{notifs.length===0?<div className="text-center py-20 text-gray-400">Tidak ada notifikasi.</div>:<div className="space-y-3">{notifs.map(n=><div key={n.id} onClick={()=>handleClick(n)} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-sky-50"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover"/><div className="absolute -bottom-1 -right-1 bg-sky-500 p-1 rounded-full border-2 border-white"></div></div><div className="flex-1"><p className="text-sm font-bold">{n.fromUsername}</p><p className="text-xs text-gray-600">{n.message}</p></div></div>)}</div>}</div>;
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile }) => {
    const [term, setTerm] = useState(''); const [tab, setTab] = useState('posts');
    const posts = allPosts.filter(p=>p.content?.toLowerCase().includes(term.toLowerCase()));
    const users = allUsers.filter(u=>u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid!==profile.uid);
    return <div className="max-w-lg mx-auto p-4 pb-24"><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari..." className="w-full p-3 bg-white rounded-xl border mb-4"/><div className="flex gap-2 mb-4"><button onClick={()=>setTab('posts')} className={`flex-1 py-2 rounded-lg font-bold ${tab==='posts'?'bg-sky-500 text-white':'bg-white'}`}>Postingan</button><button onClick={()=>setTab('users')} className={`flex-1 py-2 rounded-lg font-bold ${tab==='users'?'bg-sky-500 text-white':'bg-white'}`}>Orang</button></div>{term.length<2?<div className="text-center text-gray-400 py-10">Ketik 2 huruf...</div>:(tab==='posts'?posts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile}/>):users.map(u=><div key={u.uid} className="flex justify-between p-4 bg-white rounded-xl mb-2"><div onClick={()=>goToProfile(u.uid)} className="font-bold cursor-pointer">{u.username}</div><button onClick={()=>handleFollow(u.uid, profile.following?.includes(u.uid))} className="text-xs bg-sky-100 px-3 py-1 rounded-full text-sky-600 font-bold">{profile.following?.includes(u.uid)?'Teman':'Ikuti'}</button></div>))}</div>;
};

const ProfileScreen = ({ currentUserId, username, email, allPosts, photoURL, isSelf, handleFollow, profile }) => {
    const [edit, setEdit] = useState(false); const [name, setName] = useState(username); const [file, setFile] = useState(null);
    const userPosts = allPosts.filter(p=>p.userId===currentUserId);
    const save = async () => { const url = file?await uploadToFaaAPI(file,()=>{}) : photoURL; await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), {photoURL:url, username:name}); setEdit(false); };
    return <div className="max-w-lg mx-auto pb-24 pt-6"><div className="bg-white p-8 rounded-[2rem] shadow-sm mb-8 mx-4 text-center"><div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-sky-100 mb-4 relative">{photoURL?<img src={photoURL} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-sky-200 flex items-center justify-center text-3xl font-bold text-sky-600">{username?.[0]}</div>}{isSelf && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow"><Edit size={12}/></button>}</div>{edit?<div className="space-y-2"><input value={name} onChange={e=>setName(e.target.value)} className="border-b w-full text-center"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs"/><button onClick={save} className="bg-sky-500 text-white px-4 py-1 rounded text-xs">Simpan</button></div>:<h1 className="text-2xl font-black">{username}</h1>}<p className="text-gray-400 text-xs mb-4">{email}</p>{!isSelf && <button onClick={()=>handleFollow(currentUserId, profile.following?.includes(currentUserId))} className="bg-sky-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg">{profile.following?.includes(currentUserId)?'Berteman':'Ikuti'}</button>}<div className="flex justify-center gap-8 mt-6 border-t pt-4"><div><span className="font-bold text-xl block">{profile.followers?.length||0}</span><span className="text-xs text-gray-400">Pengikut</span></div><div><span className="font-bold text-xl block">{userPosts.length}</span><span className="text-xs text-gray-400">Post</span></div></div></div><div className="px-4 space-y-6">{userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}</div></div>;
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return <div className="p-10 text-center text-gray-400 mt-20">Postingan hilang.<br/><button onClick={goBack} className="text-sky-600 font-bold mt-4">Kembali</button></div>;
    return <div className="max-w-lg mx-auto p-4 pb-20 pt-6"><button onClick={goBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white px-4 py-2 rounded-xl shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button><PostItem post={post} {...props}/></div>;
};

// --- 11. APP UTAMA ---
const App = () => {
    const [user, setUser] = useState(undefined); const [profile, setProfile] = useState(null); const [page, setPage] = useState('landing'); const [posts, setPosts] = useState([]); const [users, setUsers] = useState([]); const [targetUid, setTargetUid] = useState(null); const [targetPid, setTargetPid] = useState(null); const [notifCount, setNotifCount] = useState(0); const [newPostId, setNewPostId] = useState(null);
    useEffect(() => { const p = new URLSearchParams(window.location.search).get('post'); if (p) setTargetPid(p); }, []);
    useEffect(() => onAuthStateChanged(auth, u => { if(u) setUser(u); else {setUser(null); setProfile(null);} }), []);
    useEffect(() => { if(!user) return; if(page==='landing' || page==='auth') setPage(targetPid ? 'view_post' : 'home'); const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => s.exists() ? setProfile({...s.data(), uid:user.uid, email:user.email}) : setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {username:user.email.split('@')[0], email:user.email, uid:user.uid, following:[], followers:[], photoURL:''})); const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => { const raw = s.docs.map(d=>({id:d.id,...d.data()})); const uids = [...new Set(raw.map(r=>r.userId))]; const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u)))); const map = {}; snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()}); setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user}))); }); const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id})))); const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size)); return () => { unsubP(); unsubPosts(); unsubUsers(); unsubNotif(); }; }, [user]);
    const handleFollow = async (uid, isFollowing) => { const me = doc(db, getPublicCollection('userProfiles'), profile.uid); const target = doc(db, getPublicCollection('userProfiles'), uid); if(isFollowing) { await updateDoc(me, {following:arrayRemove(uid)}); await updateDoc(target, {followers:arrayRemove(profile.uid)}); } else { await updateDoc(me, {following:arrayUnion(uid)}); await updateDoc(target, {followers:arrayUnion(profile.uid)}); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); } };
    if(user===undefined) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;
    if(!user) { if(page==='auth') return <AuthScreen onLoginSuccess={()=>{/*Redirect*/}}/>; return <LandingPage onGetStarted={()=>setPage('auth')}/>; }
    if(!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500"/></div>;
    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800">
            {page!=='shorts' && <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-white/50 shadow-sm"><div className="flex items-center gap-2" onClick={()=>setPage('home')}><img src={APP_LOGO} className="w-8 h-8 object-contain"/><span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span></div><div className="flex gap-3"><button onClick={()=>setPage('notifications')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative"><Bell size={20}/>{notifCount>0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}</button><button onClick={async()=>{await signOut(auth); setPage('landing')}} className="p-2 bg-white rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition"><LogOut size={20}/></button></div></header>}
            <main className={page!=='shorts'?'pt-16':''}>
                {page==='home' && <HomeScreen currentUserId={user.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)}/>}
                {page==='shorts' && <><button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition"><ArrowLeft/></button><ShortsScreen allPosts={posts} currentUserId={user.uid} handleFollow={handleFollow} profile={profile}/></>}
                {page==='create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage(short?'shorts':'home')}}/>}
                {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                {page==='notifications' && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                {page==='profile' && <ProfileScreen currentUserId={user.uid} username={profile.username} email={profile.email} allPosts={posts} photoURL={profile.photoURL} isSelf={true} handleFollow={handleFollow} profile={profile}/>}
                {page==='other-profile' && <ProfileScreen currentUserId={targetUid} username={users.find(u=>u.uid===targetUid)?.username} email={''} allPosts={posts} photoURL={users.find(u=>u.uid===targetUid)?.photoURL} isSelf={false} handleFollow={handleFollow} profile={profile}/>}
                {page==='view_post' && <SinglePostView postId={targetPid} allPosts={posts} currentUserId={user.uid} profile={profile} handleFollowToggle={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
            </main>
            {page!=='shorts' && <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40"><NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/><NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/><button onClick={()=>setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button><NavBtn icon={Film} active={page==='shorts'} onClick={()=>setPage('shorts')}/><NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/></nav>}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (<button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}><Icon size={24} strokeWidth={active?2.5:2} /></button>);

export default App;