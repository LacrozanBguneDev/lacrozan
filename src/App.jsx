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
    LogOut, Home, User, Send, Heart, MessageSquare, Image, Loader2, Link, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
    RefreshCw, Info, Clock, Star, ExternalLink, Gamepad2, BookOpen, Users, Globe,
    CheckCircle
} from 'lucide-react';

// Atur log level ke 'warn' agar konsol bersih dari pesan debug standar Firebase
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";

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
// Fungsi ini penting agar urutan beranda dan shorts selalu acak/beda tiap user
const shuffleArray = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
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
            postId: postId, // ID Postingan disertakan untuk fitur redirect
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
        // Simulasi progress bar agar UX lebih halus
        for (let i = 0; i <= 30; i += 5) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        onProgress(90);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        onProgress(100);
        if (data && data.status) {
            return data.url;
        } else {
            throw new Error(data.message || 'Gagal mengunggah file. Respon API tidak valid.');
        }
    } catch (error) {
        onProgress(0); 
        console.error('Upload error:', error);
        throw new Error('Gagal mengunggah media. File mungkin terlalu besar atau server sedang sibuk.');
    }
};

// --- 3. UTILITY FUNCTIONS ---
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const fullDate = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    if (seconds > 86400) return { relative: fullDate, full: fullDate };
    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes} menit yang lalu`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam yang lalu`, full: fullDate };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { 
            type: 'youtube', 
            embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`, 
            id: youtubeMatch[1] 
        };
    }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) {
        return { 
            type: 'link', 
            embedUrl: url, 
            displayUrl: url, 
            platform: url.includes('tiktok.com') ? 'TikTok' : 'Instagram' 
        };
    }
    return null;
};

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-500 italic">Tidak ada konten teks.</p>;
    let html = text;
    // Mengubah format MD ke HTML sederhana
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-sky-100 px-1 rounded text-sm text-sky-700 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- 4. LANDING PAGE (FITUR BARU: Tampilan Awal & Developer Info) ---
const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col items-center px-4 py-10 font-sans">
            {/* Bagian Hero & Logo */}
            <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="relative inline-block">
                     <img src={APP_LOGO} alt="Logo BguneNet" className="w-32 h-32 object-contain mx-auto mb-4 drop-shadow-xl hover:scale-105 transition-transform duration-300" />
                     <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white text-xs font-bold px-2 py-1 rounded-full">V1.0</div>
                </div>
                <h1 className="text-4xl font-extrabold text-sky-600 mb-2 tracking-tight">{APP_NAME}</h1>
                <p className="text-gray-500 text-lg max-w-md mx-auto font-medium">Jejaring sosial serbaguna untuk semua orang. 🌍✨</p>
            </div>

            {/* Deskripsi Aplikasi */}
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-sky-100 max-w-md w-full mb-8 border border-sky-50">
                <p className="text-gray-700 mb-6 text-center leading-relaxed">
                    <strong>{APP_NAME}</strong> adalah platform media sosial yang dirancang untuk menjadi ruang aman, modern, dan interaktif bagi pengguna dari berbagai kalangan.
                </p>
                
                {/* Grid Fitur */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-sky-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-sky-100 transition">
                        <Gamepad2 className="text-sky-500 mb-2" size={28}/>
                        <span className="text-xs font-bold text-gray-700">Komunitas Game</span>
                    </div>
                    <div className="bg-sky-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-sky-100 transition">
                        <BookOpen className="text-sky-500 mb-2" size={28}/>
                        <span className="text-xs font-bold text-gray-700">Berbagi Ilmu</span>
                    </div>
                    <div className="bg-sky-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-sky-100 transition">
                        <Users className="text-sky-500 mb-2" size={28}/>
                        <span className="text-xs font-bold text-gray-700">Interaksi Sehat</span>
                    </div>
                    <div className="bg-sky-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-sky-100 transition">
                        <Globe className="text-sky-500 mb-2" size={28}/>
                        <span className="text-xs font-bold text-gray-700">Semua Kalangan</span>
                    </div>
                </div>

                <button onClick={onGetStarted} className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-200 transition transform active:scale-95 flex items-center justify-center group">
                    Mulai Sekarang <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition"/>
                </button>
            </div>

            {/* Info Developer (Sesuai Permintaan) */}
            <div className="max-w-md w-full bg-gradient-to-br from-white to-sky-50 p-5 rounded-3xl border border-sky-100 shadow-md flex items-center space-x-5 transform hover:scale-[1.02] transition duration-300">
                <div className="relative">
                    <img src={DEV_PHOTO} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg" alt="Developer Photo"/>
                    <div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                </div>
                <div>
                    <p className="text-[10px] text-sky-500 font-bold uppercase tracking-widest mb-1">Developed By</p>
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">M. Irham Andika Putra</h3>
                    <p className="text-xs text-gray-500 mt-1">Siswa SMP Negeri 3 Mentok • 14 Tahun</p>
                </div>
            </div>
            
            <p className="text-center text-gray-400 text-xs mt-10">© 2024 {APP_NAME} • Aman & Nyaman</p>
        </div>
    );
};

// --- 5. AUTH SCREEN (Tema Soft Blue) ---
const AuthScreen = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const saveUserProfile = async (uid, uname, uemail) => {
        const profileRef = doc(db, getPublicCollection('userProfiles'), uid);
        const docSnap = await getDoc(profileRef);
        if (docSnap.exists()) {
            const updateData = { email: uemail };
            if (uname) updateData.username = uname;
            await updateDoc(profileRef, updateData);
        } else {
            await setDoc(profileRef, {
                username: uname || uemail.split('@')[0],
                email: uemail,
                createdAt: serverTimestamp(),
                uid: uid,
                photoURL: '',
                following: [],
                followers: []
            });
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError(''); 
        setIsLoading(true);

        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await saveUserProfile(userCredential.user.uid, null, email);
            } else {
                if (!username.trim()) throw new Error('Username wajib diisi.');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await saveUserProfile(userCredential.user.uid, username.trim(), email);
            }
            onLoginSuccess();
        } catch (err) {
            let msg = "Gagal. Periksa data Anda.";
            if (err.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar.';
            else if (err.code === 'auth/wrong-password') msg = 'Password salah.';
            else if (err.message) msg = err.message;
            setError(msg);
        } finally { 
            setIsLoading(false); 
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4 font-sans">
            <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-sky-100">
                <div className="text-center mb-6">
                    <img src={APP_LOGO} className="w-16 mx-auto mb-3"/>
                    <h2 className="text-2xl font-extrabold text-gray-900">{isLogin ? 'Masuk ke BguneNet' : 'Buat Akun Baru'}</h2>
                    <p className="text-gray-400 text-sm mt-1">Bergabunglah dengan komunitas positif.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 mb-5 text-sm rounded-xl border border-red-100 flex items-start">
                        <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0"/>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && (
                        <div className="relative group">
                            <UserPlus size={20} className="absolute left-4 top-3.5 text-sky-300 group-focus-within:text-sky-500 transition"/>
                            <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full pl-12 py-3 rounded-xl border border-sky-100 focus:ring-2 focus:ring-sky-400 outline-none bg-sky-50/30 transition-all font-medium text-gray-700"/>
                        </div>
                    )}
                    <div className="relative group">
                        <Mail size={20} className="absolute left-4 top-3.5 text-sky-300 group-focus-within:text-sky-500 transition"/>
                        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full pl-12 py-3 rounded-xl border border-sky-100 focus:ring-2 focus:ring-sky-400 outline-none bg-sky-50/30 transition-all font-medium text-gray-700"/>
                    </div>
                    <div className="relative group">
                        <Lock size={20} className="absolute left-4 top-3.5 text-sky-300 group-focus-within:text-sky-500 transition"/>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full pl-12 py-3 rounded-xl border border-sky-100 focus:ring-2 focus:ring-sky-400 outline-none bg-sky-50/30 transition-all font-medium text-gray-700"/>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-sky-500 text-white py-3.5 rounded-xl font-bold hover:bg-sky-600 shadow-lg shadow-sky-200 transition transform active:scale-95 disabled:opacity-70 disabled:shadow-none">
                        {isLoading ? <Loader2 className="animate-spin mx-auto"/> : (isLogin ? 'Masuk Sekarang' : 'Daftar Gratis')}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500">
                        {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '} 
                        <button onClick={()=>setIsLogin(!isLogin)} className="text-sky-600 font-bold hover:underline ml-1">
                            {isLogin ? 'Daftar' : 'Masuk'}
                        </button>
                    </p>
                </div>

                {/* Kontak Reset Password */}
                {isLogin && (
                    <div className="mt-6 pt-5 border-t border-dashed border-gray-200 text-center">
                        <div className="inline-flex items-center justify-center space-x-2 bg-sky-50 px-4 py-2 rounded-lg">
                            <HelpCircle size={16} className="text-sky-500"/>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-400 font-semibold uppercase">Lupa Kata Sandi?</p>
                                <p className="text-sky-700 font-bold text-sm flex items-center">
                                    <Phone size={12} className="mr-1"/> Hubungi: 0827378
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 6. POST ITEM (Tampilan Postingan - Soft Blue) ---
const PostItem = ({ post, currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [showFull, setShowFull] = useState(false);

    const isLiked = post.likes?.includes(currentUserId);
    const mediaEmbed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const timeAgo = useMemo(() => formatTimeAgo(post.timestamp), [post.timestamp]);
    const isOwner = post.userId === currentUserId;
    const isFollowing = profile.following?.includes(post.userId);
    const isLong = post.content && post.content.length > 150;

    const handleLike = async () => {
        if(!currentUserId) return;
        const ref = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) {
            await updateDoc(ref, { likes: arrayRemove(currentUserId) });
        } else {
            await updateDoc(ref, { likes: arrayUnion(currentUserId) });
            if(!isOwner) sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if(!newComment.trim()) return;
        await addDoc(collection(db, getPublicCollection('comments')), { 
            postId: post.id, 
            userId: currentUserId, 
            text: newComment, 
            username: profile.username, 
            timestamp: serverTimestamp() 
        });
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount||0)+1 });
        if(!isOwner) sendNotification(post.userId, 'comment', `mengomentari: "${newComment.substring(0,15)}.."`, profile, post.id);
        setNewComment('');
    };

    const handleUpdate = async () => {
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), { title: editedTitle, content: editedContent });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if(confirm("Apakah Anda yakin ingin menghapus postingan ini?")) {
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
        }
    };
    
    const handleShare = async () => {
        try { 
            // Link share akan mengandung ID post untuk redirect
            await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); 
            alert('Link disalin! Orang lain akan langsung diarahkan ke postingan ini.'); 
        } catch(e){}
    };

    // Load Comments
    useEffect(() => {
        if(!showComments) return;
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        return onSnapshot(q, s => {
            setComments(s.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0)));
        });
    }, [showComments, post.id]);

    const isVideo = (post.mediaUrl && (/\.(mp4|webm)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|png|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-100 mb-5 hover:shadow-md transition-shadow duration-300 relative">
            {/* Tag Shorts (jika lolos filter) */}
            {post.isShort && (
                <div className="absolute top-5 right-5 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center shadow-sm z-10">
                    <Film size={12} className="mr-1"/> SHORT
                </div>
            )}

            {/* Header User */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={()=>goToProfile(post.userId)}>
                    <div className="w-12 h-12 bg-sky-200 rounded-full overflow-hidden border-2 border-white shadow-md group-hover:border-sky-300 transition">
                        {post.user?.photoURL ? (
                            <img src={post.user.photoURL} className="w-full h-full object-cover"/>
                        ) : (
                            <div className="flex items-center justify-center h-full text-sky-600 font-bold text-lg">{post.user?.username?.[0].toUpperCase()}</div>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm group-hover:text-sky-600 transition">{post.user?.username || 'Pengguna'}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10}/> {timeAgo.relative}</p>
                    </div>
                </div>
                
                {/* Tombol Follow / Edit */}
                {!isOwner && (
                    <button onClick={()=>handleFollowToggle(post.userId, isFollowing)} className={`px-4 py-1.5 text-xs rounded-full font-bold transition transform active:scale-95 ${isFollowing ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}>
                        {isFollowing ? 'Teman' : 'Ikuti'}
                    </button>
                )}
                {isOwner && (
                    <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button onClick={()=>setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-sky-500 rounded-md hover:bg-white transition"><Edit size={16}/></button>
                        <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-white transition"><Trash2 size={16}/></button>
                    </div>
                )}
            </div>

            {/* Konten Post */}
            {isEditing ? (
                <div className="bg-sky-50 p-4 rounded-2xl space-y-3 mb-4 border border-sky-100 animate-in fade-in">
                    <input value={editedTitle} onChange={e=>setEditedTitle(e.target.value)} className="w-full p-3 text-sm rounded-xl border border-sky-200 font-bold focus:ring-2 focus:ring-sky-300 outline-none"/>
                    <textarea value={editedContent} onChange={e=>setEditedContent(e.target.value)} className="w-full p-3 text-sm rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-300 outline-none resize-none" rows={3}/>
                    <div className="flex justify-end gap-3">
                        <button onClick={()=>setIsEditing(false)} className="text-xs font-bold text-gray-500 hover:bg-gray-200 px-3 py-1 rounded-lg transition">Batal</button>
                        <button onClick={handleUpdate} className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1 rounded-lg transition">Simpan Perubahan</button>
                    </div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg tracking-tight">{post.title}</h3>}
                    <div className="mb-4 text-sm text-gray-700">
                        {renderMarkdown(isLong && !showFull ? post.content.substring(0, 150)+'...' : post.content)}
                        {isLong && <button onClick={()=>setShowFull(!showFull)} className="text-sky-500 font-bold text-xs ml-1 hover:underline">{showFull?'Tutup':'Baca Selengkapnya'}</button>}
                    </div>
                    
                    {/* Media Display */}
                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 relative group">
                            {isImage && <img src={post.mediaUrl} className="w-full max-h-[500px] object-cover"/>}
                            {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black"/>}
                            {mediaEmbed?.type === 'youtube' && <div className="aspect-video"><iframe src={mediaEmbed.embedUrl} className="w-full h-full" allowFullScreen></iframe></div>}
                            {mediaEmbed?.type === 'link' && (
                                <a href={mediaEmbed.displayUrl} target="_blank" className="flex flex-col items-center justify-center p-6 bg-sky-50 text-sky-700 hover:bg-sky-100 transition">
                                    <ExternalLink size={32} className="mb-2 opacity-50"/>
                                    <span className="font-bold text-sm">Buka Link Eksternal</span>
                                    <span className="text-xs text-sky-400 mt-1 truncate max-w-xs">{mediaEmbed.displayUrl}</span>
                                </a>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex gap-6">
                    <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold transition group ${isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
                        <div className={`p-2 rounded-full transition group-hover:bg-rose-50 ${isLiked ? 'bg-rose-50' : ''}`}>
                            <Heart size={20} fill={isLiked?'currentColor':'none'} className={isLiked ? 'scale-110' : ''}/>
                        </div>
                        {post.likes?.length||0}
                    </button>
                    <button onClick={()=>setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-sky-600 group">
                        <div className="p-2 rounded-full group-hover:bg-sky-50 transition">
                            <MessageSquare size={20}/>
                        </div>
                        {post.commentsCount||0}
                    </button>
                </div>
                <button onClick={handleShare} className="text-gray-400 hover:text-sky-500 p-2 hover:bg-sky-50 rounded-full transition" title="Bagikan">
                    <Share2 size={20}/>
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-52 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar">
                        {comments.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">Belum ada komentar.</p> : comments.map(c=>(
                            <div key={c.id} className="text-xs flex gap-3 items-start group">
                                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center font-bold text-sky-600 flex-shrink-0 text-[10px]">
                                    {c.username?.[0]}
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-r-xl rounded-bl-xl flex-1 group-hover:bg-gray-100 transition">
                                    <span className="font-bold text-gray-800 block mb-0.5">{c.username}</span>
                                    <span className="text-gray-600 leading-relaxed">{c.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleComment} className="flex gap-2 items-center relative">
                        <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis komentar sopan..." className="flex-1 bg-gray-100 rounded-full pl-4 pr-12 py-3 text-xs outline-none focus:ring-2 focus:ring-sky-200 transition"/>
                        <button type="submit" disabled={!newComment} className="absolute right-1.5 p-1.5 bg-sky-500 text-white rounded-full disabled:opacity-50 hover:bg-sky-600 transition">
                            <Send size={14}/>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- 7. HOME SCREEN (Algoritma Acak, Filter Shorts & Pin Post) ---
const HomeScreen = ({ currentUserId, profile, allPosts, isLoading, handleFollow, goToProfile, newPostId, clearNewPost }) => {
    const [sort, setSort] = useState('random');
    const [refresh, setRefresh] = useState(0);

    // Algoritma Feed
    const feed = useMemo(() => {
        // 1. Filter agar video shorts TIDAK muncul di beranda (Hanya post biasa)
        let list = allPosts.filter(p => !p.isShort); 
        
        // 2. Handle Postingan Baru (Pin di atas)
        let pinned = null;
        if(newPostId) {
            const idx = list.findIndex(p=>p.id===newPostId);
            if(idx>-1) { pinned = list[idx]; list.splice(idx, 1); }
        }
        
        // 3. Sorting
        if(sort === 'latest') {
            list.sort((a,b) => (b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
        } else if(sort === 'popular') {
            list.sort((a,b) => (b.likes?.length||0)-(a.likes?.length||0));
        } else {
            // Random Shuffle (Default)
            list = shuffleArray([...list]);
        }

        // 4. Gabungkan
        if(pinned) list.unshift(pinned);
        return list;
    }, [allPosts, sort, refresh, newPostId]);

    const doRefresh = () => { 
        setSort('random'); 
        setRefresh(r=>r+1); // Trigger re-shuffle
        clearNewPost(); // Hapus status pinned
    };

    return (
        <div className="max-w-lg mx-auto pb-24">
            {/* Feed Controls */}
            <div className="flex gap-3 mb-6 px-4 sticky top-16 pt-3 pb-2 bg-gray-50/95 backdrop-blur z-30 overflow-x-auto no-scrollbar items-center">
                <button onClick={doRefresh} className="p-2.5 bg-white border border-sky-100 rounded-full text-sky-600 shadow-sm active:scale-90 transition hover:rotate-180 duration-500" title="Acak Ulang">
                    <RefreshCw size={20}/>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <button onClick={()=>setSort('latest')} className={`px-5 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm flex items-center gap-2 ${sort==='latest'?'bg-sky-500 text-white border-sky-500':'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                    <Clock size={14}/> Terbaru
                </button>
                <button onClick={()=>setSort('popular')} className={`px-5 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm flex items-center gap-2 ${sort==='popular'?'bg-sky-500 text-white border-sky-500':'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                    <Flame size={14}/> Populer
                </button>
            </div>

            {/* Loading & Empty States */}
            {isLoading ? (
                <div className="text-center pt-20 text-sky-500 flex flex-col items-center">
                    <Loader2 className="animate-spin mb-2" size={32}/>
                    <span className="text-xs font-bold text-sky-300">Menyiapkan Feed...</span>
                </div>
            ) : feed.length===0 ? (
                <div className="text-center p-10 text-gray-400 flex flex-col items-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-3"><MessageSquare size={32} className="opacity-30"/></div>
                    <p className="font-bold">Belum ada postingan.</p>
                </div>
            ) : (
                feed.map(p => (
                    <div key={p.id} className={p.id===newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                        {p.id===newPostId && (
                            <div className="bg-green-50 text-green-600 text-xs font-bold text-center py-2 mb-3 mx-4 rounded-xl border border-green-100 flex items-center justify-center gap-2 shadow-sm">
                                <CheckCircle size={14}/> Postingan Berhasil Diunggah
                            </div>
                        )}
                        <PostItem post={p} currentUserId={currentUserId} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollow} goToProfile={goToProfile}/>
                    </div>
                ))
            )}
        </div>
    );
};

// --- 8. SHORTS SCREEN (Full Screen, Acak, Fix Scroll, Redirect) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollow, profile }) => {
    const [feed, setFeed] = useState([]);
    
    // Gunakan useEffect untuk mengacak shorts HANYA saat komponen dimuat pertama kali
    // Agar urutan tidak berubah aneh saat user berinteraksi
    useEffect(() => {
        const shortsOnly = allPosts.filter(p => p.isShort && p.mediaUrl);
        setFeed(shuffleArray([...shortsOnly]));
    }, [allPosts]); 

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center">
            {/* Container Scroll: Wajib 100dvh dan Snap Mandatory */}
            <div className="w-full max-w-md h-[100dvh] overflow-y-scroll snap-y snap-mandatory snap-always no-scrollbar bg-black">
                {feed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 font-bold">
                        <Film size={48} className="mb-4 opacity-50"/>
                        <p>Belum ada Shorts</p>
                    </div>
                ) : (
                    feed.map(p => <ShortItem key={p.id} post={p} currentUserId={currentUserId} handleFollow={handleFollow} profile={profile}/>)
                )}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollow, profile }) => {
    const ref = useRef();
    const vidRef = useRef();
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [showCom, setShowCom] = useState(false);
    const [comments, setComments] = useState([]);
    const [txt, setTxt] = useState('');
    const isLiked = post.likes?.includes(currentUserId);
    const isFollowing = profile.following?.includes(post.userId);
    const embed = useMemo(()=>getMediaEmbed(post.mediaUrl), [post.mediaUrl]);

    // Auto Play/Pause saat Scroll (Intersection Observer)
    useEffect(() => {
        const obs = new IntersectionObserver(e => {
            e.forEach(en => {
                setPlaying(en.isIntersecting);
                if(vidRef.current) {
                    if(en.isIntersecting) vidRef.current.play().catch(()=>{});
                    else { vidRef.current.pause(); vidRef.current.currentTime = 0; }
                }
            });
        }, {threshold: 0.6});
        if(ref.current) obs.observe(ref.current);
        return () => ref.current && obs.unobserve(ref.current);
    }, []);

    const toggleLike = async () => {
        const r = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) updateDoc(r, { likes: arrayRemove(currentUserId)});
        else { 
            updateDoc(r, { likes: arrayUnion(currentUserId)}); 
            if(!isFollowing) sendNotification(post.userId, 'like', 'menyukai shorts Anda', profile, post.id); 
        }
    };

    useEffect(()=>{
        if(showCom) return onSnapshot(query(collection(db, getPublicCollection('comments')), where('postId','==',post.id)), s=>setComments(s.docs.map(d=>d.data())));
    },[showCom, post.id]);

    return (
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center border-b border-gray-800 overflow-hidden">
            {/* Media Player */}
            {embed?.type==='youtube' ? 
                <div className="w-full h-full relative">
                    {playing ? <iframe src={`${embed.embedUrl}&autoplay=1&controls=0&loop=1&playlist=${embed.id}`} className="w-full h-full pointer-events-auto"/> : <div className="w-full h-full bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>}
                    <div className="absolute inset-0 bg-transparent pointer-events-none"></div>
                </div> 
                : 
                <video ref={vidRef} src={post.mediaUrl} className="w-full h-full object-cover" loop muted={muted} playsInline onClick={()=>setMuted(!muted)}/>
            }
            
            {/* Overlay Info */}
            <div className="absolute bottom-0 inset-x-0 p-4 pt-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white pointer-events-none pb-20">
                <div className="pointer-events-auto flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-700 overflow-hidden">
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : <div className="text-center h-full flex items-center justify-center font-bold text-xs">{post.user?.username?.[0]}</div>}
                    </div>
                    <div>
                        <p className="font-bold shadow-black drop-shadow-md text-sm">{post.user?.username}</p>
                        {!isFollowing && post.userId !== currentUserId && <button onClick={()=>handleFollow(post.userId, false)} className="text-[10px] bg-white text-black px-3 py-0.5 rounded-full font-bold mt-1 hover:bg-gray-200 transition">Ikuti</button>}
                    </div>
                </div>
                <p className="text-sm line-clamp-3 text-gray-100 drop-shadow-md mb-4 leading-relaxed">{post.content}</p>
            </div>

            {/* Side Buttons */}
            <div className="absolute right-2 bottom-28 flex flex-col gap-6 pointer-events-auto z-10 pb-8">
                <button onClick={toggleLike} className="flex flex-col items-center group">
                    <div className={`p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition group-active:scale-90 ${isLiked?'text-rose-500 bg-white/20':'text-white'}`}>
                        <Heart size={28} fill={isLiked?'currentColor':'none'}/>
                    </div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.likes?.length||0}</span>
                </button>
                <button onClick={()=>setShowCom(true)} className="flex flex-col items-center group">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 transition group-active:scale-90">
                        <MessageSquare size={28}/>
                    </div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.commentsCount||0}</span>
                </button>
                <button onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`);alert('Link Shorts Disalin!');}catch(e){}}} className="flex flex-col items-center group">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 transition group-active:scale-90">
                        <Share2 size={28}/>
                    </div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">Share</span>
                </button>
            </div>

            {/* Comment Modal */}
            {showCom && (
                <div className="absolute inset-0 z-20 bg-black/60 flex items-end pointer-events-auto backdrop-blur-sm">
                    <div className="w-full h-[65%] bg-white rounded-t-3xl p-4 flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between mb-4 border-b pb-2 items-center">
                            <p className="font-bold text-black text-sm">Komentar</p>
                            <button onClick={()=>setShowCom(false)} className="bg-gray-100 rounded-full p-1"><X className="text-black" size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 mb-2 custom-scrollbar">
                            {comments.map((c,i)=>(
                                <div key={i} className="text-xs text-black flex gap-2">
                                    <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center font-bold text-[10px] text-sky-600">{c.username[0]}</div>
                                    <div>
                                        <span className="font-bold mr-1">{c.username}</span> 
                                        <span className="text-gray-600">{c.text}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 border-t pt-2">
                            <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Tulis..." className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-xs text-black outline-none"/>
                            <button onClick={async()=>{
                                if(!txt.trim()) return;
                                await addDoc(collection(db, getPublicCollection('comments')), {postId:post.id, userId:currentUserId, text:txt, username:profile.username}); 
                                await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount||0)+1 });
                                setTxt('');
                            }} className="text-sky-600 font-bold text-xs px-2">Kirim</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 9. CREATE POST & NOTIFICATIONS & SEARCH & PROFILE ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [file, setFile] = useState(null); 
    const [url, setUrl] = useState('');
    const [isShort, setIsShort] = useState(false); 
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0); 
    const [isLarge, setIsLarge] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        if(!content && !file && !url) return;
        
        setLoading(true); 
        setProgress(0);
        try {
            let finalUrl = url, type = 'text';
            if(file) { 
                finalUrl = await uploadToFaaAPI(file, setProgress); 
                type = file.type.startsWith('image') ? 'image' : 'video'; 
            } else if(url) {
                type = 'link';
            }
            
            const ref = await addDoc(collection(db, getPublicCollection('posts')), { 
                userId, 
                title, 
                content, 
                mediaUrl: finalUrl, 
                mediaType: type, 
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                isShort, 
                user: { username, uid: userId } 
            });
            
            setProgress(100); 
            setTimeout(()=> { 
                setTitle(''); setContent(''); setFile(null); setUrl(''); 
                onSuccess(ref.id, isShort); 
            }, 500);
        } catch(e) { 
            alert(e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-3xl shadow-lg border border-sky-50 mt-4 mb-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Buat Postingan</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
                {loading && (
                    <div className="text-xs font-bold text-sky-600 mb-1">
                        <div className="flex justify-between mb-1"><span>Mengunggah...</span><span>{Math.round(progress)}%</span></div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${progress}%`}}></div></div>
                    </div>
                )}

                <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul (Opsional)" className="w-full px-4 py-3 bg-sky-50/50 border-none rounded-xl focus:ring-2 focus:ring-sky-200 font-bold text-sm transition"/>
                <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Apa yang Anda pikirkan?" rows="4" className="w-full px-4 py-3 bg-sky-50/50 border-none rounded-xl focus:ring-2 focus:ring-sky-200 resize-none text-sm transition"/>
                
                {isLarge && (
                    <div className="bg-orange-50 text-orange-600 text-xs p-3 rounded-xl flex items-center border border-orange-100">
                        <AlertTriangle size={16} className="mr-2 flex-shrink-0"/> 
                        <span className="font-medium">File >25MB. Proses mungkin sedikit lama.</span>
                    </div>
                )}
                
                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                    <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer transition whitespace-nowrap flex-1 ${file?'bg-sky-100 text-sky-700 border-sky-200':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <Image size={18} className="mr-2"/>
                        <span className="text-xs font-bold">{file?'Ganti File':'Foto/Video'}</span>
                        <input type="file" accept="image/*,video/*" onChange={e=>{
                            const f=e.target.files[0]; 
                            if(f){setFile(f); setIsLarge(f.size>25*1024*1024); if(f.type.startsWith('image')) setIsShort(false);}
                        }} className="hidden" disabled={loading}/>
                    </label>
                    
                    {(file?.type?.startsWith('video') || url.includes('youtu')) && (
                        <div onClick={()=>setIsShort(!isShort)} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer transition whitespace-nowrap ${isShort?'bg-rose-100 text-rose-600 border-rose-200':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                            <Film size={18} className="mr-2"/>
                            <span className="text-xs font-bold">Mode Shorts</span>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <Link size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                    <input type="url" value={url} onChange={e=>{setUrl(e.target.value); setFile(null); if(e.target.value.includes('shorts')) setIsShort(true);}} placeholder="Atau link YouTube/Video..." className="w-full pl-9 pr-3 py-3 bg-sky-50/50 border-none rounded-xl text-xs focus:ring-2 focus:ring-sky-200 transition"/>
                </div>

                <button type="submit" disabled={loading||(!content&&!file&&!url)} className="w-full bg-sky-500 text-white py-3.5 rounded-xl font-bold hover:bg-sky-600 shadow-lg shadow-sky-200 transition disabled:opacity-50 transform active:scale-95">
                    {loading?'Sedang Mengirim...':'Posting Sekarang'}
                </button>
            </form>

            {/* Instruksi Teks */}
            <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-100">
                <div className="flex items-center text-sky-600 mb-2">
                    <Info size={16}/>
                    <span className="text-xs font-bold ml-2 uppercase tracking-wider">Format Teks Tersedia</span>
                </div>
                <div className="text-[10px] text-gray-600 grid grid-cols-2 gap-2 font-medium">
                    <div><code>**Tebal**</code> &rarr; <strong>Tebal</strong></div>
                    <div><code>*Miring*</code> &rarr; <em>Miring</em></div>
                    <div><code>`Kode`</code> &rarr; <code className="bg-sky-200 px-1">Kode</code></div>
                </div>
            </div>
        </div>
    );
};

const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifs, setNotifs] = useState([]);
    
    // Load notifikasi yg belum dibaca dulu
    useEffect(() => {
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50));
        return onSnapshot(q, s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead)));
    }, [userId]);

    const handleClick = async (n) => {
        // Tandai baca dan redirect
        await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true});
        if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); }
        else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); }
    };

    return (
        <div className="max-w-lg mx-auto p-4 pb-20">
            <h1 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><Bell size={24} className="text-sky-500"/> Notifikasi Baru</h1>
            {notifs.length===0 ? (
                <div className="text-center py-16 text-gray-400 flex flex-col items-center bg-white rounded-3xl border border-gray-50">
                    <Bell size={48} className="opacity-20 mb-3"/>
                    <p className="font-medium">Tidak ada notifikasi baru.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifs.map(n => (
                        <div key={n.id} onClick={()=>handleClick(n)} className="flex items-center p-4 bg-white rounded-2xl border border-sky-100 shadow-sm hover:bg-sky-50 transition cursor-pointer group">
                            <div className="mr-4 relative">
                                <img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full object-cover bg-gray-200 border border-gray-200"/>
                                <div className={`absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white text-white ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>
                                    {n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-800 leading-snug">
                                    <span className="font-bold text-gray-900">{n.fromUsername}</span> {n.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1 font-medium group-hover:text-sky-500">{formatTimeAgo(n.timestamp).relative}</p>
                            </div>
                            <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile }) => {
    const [term, setTerm] = useState(''); const [tab, setTab] = useState('posts');
    const posts = allPosts.filter(p=>p.content?.toLowerCase().includes(term.toLowerCase()));
    const users = allUsers.filter(u=>u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid!==profile.uid);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                <input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari postingan atau pengguna..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none shadow-sm font-medium"/>
            </div>
            <div className="flex mb-6 bg-gray-100 p-1 rounded-xl">
                <button onClick={()=>setTab('posts')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition ${tab==='posts'?'bg-white shadow-sm text-sky-600':'text-gray-500 hover:text-gray-700'}`}>Postingan</button>
                <button onClick={()=>setTab('users')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition ${tab==='users'?'bg-white shadow-sm text-sky-600':'text-gray-500 hover:text-gray-700'}`}>Pengguna</button>
            </div>
            {term.length<2 ? (
                <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
                    <Search size={48} className="opacity-10 mb-4"/>
                    <p>Ketik minimal 2 huruf untuk mulai mencari.</p>
                </div>
            ) : (tab==='posts' ? posts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollow} goToProfile={goToProfile}/>) : users.map(u=>(
                <div key={u.uid} className="flex justify-between items-center bg-white p-4 rounded-2xl mb-3 border border-gray-50 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={()=>goToProfile(u.uid)}>
                        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center font-bold text-sky-600 border border-sky-200">{u.username[0]}</div>
                        <span className="font-bold text-gray-800">{u.username}</span>
                    </div>
                    <button onClick={()=>handleFollow(u.uid, profile.following?.includes(u.uid))} className={`text-xs px-4 py-2 rounded-full font-bold transition ${profile.following?.includes(u.uid)?'bg-gray-100 text-gray-600':'bg-sky-600 text-white shadow-md shadow-sky-200'}`}>
                        {profile.following?.includes(u.uid)?'Teman':'Ikuti'}
                    </button>
                </div>
            )))}
        </div>
    );
};

const ProfileScreen = ({ currentUserId, username, email, allPosts, photoURL, isSelf, handleFollow, profile }) => {
    const [isEdit, setIsEdit] = useState(false); const [newName, setNewName] = useState(username);
    const [file, setFile] = useState(null); const [loading, setLoading] = useState(false);
    const userPosts = allPosts.filter(p=>p.userId===currentUserId).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    const isFollowing = profile.following?.includes(currentUserId);

    const save = async () => {
        setLoading(true);
        try {
            const url = file ? await uploadToFaaAPI(file, ()=>{}) : photoURL;
            await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), { photoURL: url, username: newName });
            setIsEdit(false);
        } catch(e){alert(e.message)} finally{setLoading(false)};
    };

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-100 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-400 to-blue-400 opacity-10"></div>
                <div className="relative inline-block mb-4 mt-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-sky-100">
                        {photoURL?<img src={photoURL} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-sky-600 text-3xl font-bold">{username?.[0]}</div>}
                    </div>
                    {isSelf && <button onClick={()=>setIsEdit(!isEdit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-gray-100 text-sky-600 hover:scale-110 transition"><Edit size={14}/></button>}
                </div>
                
                {isEdit ? (
                    <div className="space-y-3 animate-in fade-in bg-sky-50 p-4 rounded-2xl">
                        <input value={newName} onChange={e=>setNewName(e.target.value)} className="border-b-2 border-sky-500 text-center font-bold text-xl outline-none w-full bg-transparent pb-1"/>
                        <input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs w-full"/>
                        <button onClick={save} disabled={loading} className="bg-sky-600 text-white text-xs px-6 py-2 rounded-full font-bold shadow-lg shadow-sky-200">{loading?'Menyimpan...':'Simpan Perubahan'}</button>
                    </div>
                ) : (
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{username}</h1>
                )}
                <p className="text-gray-400 text-xs mb-6 font-medium tracking-wide">{email}</p>

                {!isSelf && (
                    <button onClick={()=>handleFollow(currentUserId, isFollowing)} className={`px-8 py-3 rounded-full font-bold text-sm transition transform active:scale-95 ${isFollowing?'bg-gray-100 text-gray-600 border border-gray-200':'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-xl shadow-sky-200'}`}>
                        {isFollowing?'Berteman':'Ikuti Sekarang'}
                    </button>
                )}

                <div className="flex justify-center gap-8 mt-8 pt-6 border-t border-sky-50">
                    <div className="flex flex-col"><span className="font-bold text-xl text-gray-800">{profile.followers?.length||0}</span><span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pengikut</span></div>
                    <div className="flex flex-col"><span className="font-bold text-xl text-gray-800">{profile.following?.length||0}</span><span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mengikuti</span></div>
                    <div className="flex flex-col"><span className="font-bold text-xl text-gray-800">{userPosts.length}</span><span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Post</span></div>
                </div>
            </div>

            <div className="px-5 space-y-4">
                <div className="flex items-center space-x-2 mb-2">
                    <div className="w-1 h-5 bg-sky-500 rounded-full"></div>
                    <h3 className="font-bold text-gray-800 text-lg">Postingan</h3>
                </div>
                {userPosts.length === 0 ? <div className="text-center text-gray-400 py-10 bg-white rounded-2xl border border-dashed border-gray-200">Belum ada postingan.</div> : userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollow} goToProfile={()=>{}}/>)}
            </div>
        </div>
    );
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return <div className="p-10 text-center text-gray-400 mt-20">Postingan ini tidak ditemukan atau telah dihapus.<br/><button onClick={goBack} className="text-sky-600 font-bold mt-4 hover:underline">Kembali ke Beranda</button></div>;
    return <div className="max-w-lg mx-auto p-4 pb-20 pt-6"><button onClick={goBack} className="mb-6 flex items-center font-bold text-gray-600 hover:text-sky-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 w-fit transition hover:shadow-md"><ArrowLeft size={18} className="mr-2"/> Kembali</button><PostItem post={post} {...props}/></div>;
};

// --- 10. APP UTAMA (Routing & Global State) ---
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('landing'); // Default ke Landing Page
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]);
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null);
    const [notifCount, setNotifCount] = useState(0);
    const [newPostId, setNewPostId] = useState(null);
    
    // --- SISTEM REDIRECT SHARE LINK (PENTING) ---
    useEffect(() => {
        // Cek URL parameter saat pertama kali buka
        const params = new URLSearchParams(window.location.search);
        const sharedPostId = params.get('post');

        if (sharedPostId) {
            // Jika ada ID post di link, simpan di state dan siap-siap redirect
            setTargetPid(sharedPostId);
            // Set page view_post nanti setelah login cek selesai
        }
    }, []);

    // Listener Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => {
            if(u) setUser(u); 
            else { 
                setUser(null); 
                setProfile(null); 
                // Jika logout/belum login, tetap di landing (kecuali ada redirect link)
            }
        });
        return unsub; 
    }, []);

    // Data Loading
    useEffect(() => {
        if(!user) return;

        // Jika user sudah login dan masih di landing page, pindahkan ke home atau target post
        if(page === 'landing') {
             if(targetPid) setPage('view_post');
             else setPage('home');
        } else if (page === 'auth') {
            if(targetPid) setPage('view_post');
            else setPage('home');
        }

        // Load Profil Sendiri
        const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => {
            if(s.exists()) setProfile({...s.data(), email: user.email, uid: user.uid});
            else setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {username: user.email.split('@')[0], email: user.email, uid: user.uid, following: [], followers: [], photoURL: ''});
        });

        // Load Semua Postingan
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            // Optimasi: Fetch user data hanya untuk user yang ada di post
            const uids = [...new Set(raw.map(p=>p.userId))];
            const snaps = await Promise.all(uids.map(id=>getDoc(doc(db, getPublicCollection('userProfiles'), id))));
            const map = {}; snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            
            setPosts(raw.map(p=>({...p, user: map[p.userId]||p.user})));
        });

        // Load User Lain (Untuk Search)
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        
        // Load Notifikasi Count
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));

        return () => { unsubP(); unsubPosts(); unsubUsers(); unsubNotif(); };
    }, [user]);

    // Global Handlers
    const handleLogout = async () => { await signOut(auth); setPage('landing'); };
    
    const handleFollow = async (uid, isFollowing) => {
        const myRef = doc(db, getPublicCollection('userProfiles'), profile.uid);
        const targetRef = doc(db, getPublicCollection('userProfiles'), uid);
        if(isFollowing) { 
            await updateDoc(myRef, {following: arrayRemove(uid)}); 
            await updateDoc(targetRef, {followers: arrayRemove(profile.uid)}); 
        } else { 
            await updateDoc(myRef, {following: arrayUnion(uid)}); 
            await updateDoc(targetRef, {followers: arrayUnion(profile.uid)}); 
            sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); 
        }
    };

    // --- RENDER LOGIC ---
    
    // 1. Loading Screen Awal
    if(user === undefined) return <div className="h-screen flex items-center justify-center bg-sky-50"><Loader2 className="animate-spin text-sky-600" size={40}/></div>;

    // 2. Mode Belum Login (Landing Page -> Auth)
    if (!user) {
        if (page === 'auth') return <AuthScreen onLoginSuccess={() => {
            // Logika redirect setelah login sukses
            if(targetPid) setPage('view_post');
            else setPage('home');
        }} />;
        return <LandingPage onGetStarted={() => setPage('auth')} />;
    }

    // 3. Loading Profil User
    if (!profile) return <div className="h-screen flex items-center justify-center bg-sky-50"><div className="text-center"><Loader2 className="animate-spin text-sky-600 mx-auto mb-2"/><p className="text-sky-800 font-bold">Memuat Profil...</p></div></div>;

    // 4. Tampilan Utama Aplikasi (Sudah Login)
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Navbar Atas (Hilang di mode Shorts) */}
            {page !== 'shorts' && (
                <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between shadow-sm max-w-lg mx-auto transition-all">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={()=>setPage('home')}>
                        <img src={APP_LOGO} className="w-8 h-8 object-contain group-hover:rotate-12 transition duration-300"/>
                        <span className="font-extrabold text-xl text-sky-600 tracking-tight">{APP_NAME}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setPage('notifications')} className="relative p-2.5 text-gray-500 hover:bg-sky-50 rounded-full transition hover:text-sky-600">
                            <Bell size={24} strokeWidth={2} />
                            {notifCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>
                        <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 rounded-full transition" title="Keluar">
                            <LogOut size={22}/>
                        </button>
                    </div>
                </header>
            )}

            {/* Konten Utama */}
            <main className={`min-h-screen max-w-lg mx-auto ${page !== 'shorts' ? 'pt-16' : ''} transition-all`}>
                
                {page === 'home' && <HomeScreen currentUserId={user.uid} profile={profile} allPosts={posts} isLoading={false} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile');}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)} />}
                
                {page === 'shorts' && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-black/30 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/50 transition border border-white/10 shadow-lg">
                            <ArrowLeft size={24}/>
                        </button>
                        <ShortsScreen allPosts={posts} currentUserId={user.uid} handleFollow={handleFollow} profile={profile} />
                    </>
                )}
                
                {page === 'create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={(id, short)=>{ if(!short) setNewPostId(id); setPage(short?'shorts':'home'); }} />}
                
                {page === 'search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile');}} />}
                
                {page === 'notifications' && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile');}} />}
                
                {page === 'profile' && <ProfileScreen currentUserId={user.uid} username={profile.username} email={profile.email} allPosts={posts} photoURL={profile.photoURL} isSelf={true} handleFollow={handleFollow} profile={profile} />}
                
                {page === 'other-profile' && <ProfileScreen currentUserId={targetUid} username={users.find(u=>u.uid===targetUid)?.username} email={''} allPosts={posts} photoURL={users.find(u=>u.uid===targetUid)?.photoURL} isSelf={false} handleFollow={handleFollow} profile={profile} />}
                
                {page === 'view_post' && <SinglePostView postId={targetPid} allPosts={posts} currentUserId={user.uid} profile={profile} handleFollowToggle={handleFollow} goToProfile={()=>{}} goBack={()=>setPage('home')} />}
            
            </main>

            {/* Navbar Bawah (Hilang di mode Shorts) */}
            {page !== 'shorts' && (
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-20 z-40 max-w-lg mx-auto flex justify-around items-center px-2 pb-4 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
                    <NavBtn icon={Home} label="Beranda" isActive={page === 'home'} onClick={() => setPage('home')} />
                    <NavBtn icon={Search} label="Cari" isActive={page === 'search'} onClick={() => setPage('search')} />
                    
                    {/* Tombol Create Menonjol */}
                    <div className="relative -top-8 group">
                        <button onClick={() => setPage('create')} className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-sky-300 transform group-active:scale-90 transition hover:shadow-sky-400/50 border-4 border-white">
                            <PlusCircle size={32} />
                        </button>
                    </div>
                    
                    <NavBtn icon={Film} label="Shorts" isActive={page === 'shorts'} onClick={() => setPage('shorts')} />
                    <NavBtn icon={User} label="Profil" isActive={page === 'profile'} onClick={() => setPage('profile')} />
                </nav>
            )}
        </div>
    );
};

// Helper Button Navigasi Bawah
const NavBtn = ({ icon: Icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-full transition duration-300 group ${isActive ? 'text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <div className={`p-1.5 rounded-2xl transition duration-300 ${isActive ? 'bg-sky-50 translate-y-[-2px]' : 'group-hover:bg-gray-50'}`}>
            <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'fill-sky-100' : ''} />
        </div>
        <span className={`text-[10px] font-bold mt-1 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);

export default App;