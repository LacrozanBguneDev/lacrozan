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
    Link, 
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
    Zap
} from 'lucide-react';

// Atur log level ke 'warn' agar konsol bersih
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png";
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";
// Link Reset Password Baru
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

// --- UTILS: SHUFFLE ARRAY ---
// Algoritma untuk mengacak postingan (Fisher-Yates Shuffle)
const shuffleArray = (array) => {
    const newArray = [...array]; // Buat salinan array agar tidak merusak data asli
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
    // Jangan kirim notifikasi ke diri sendiri
    if (!toUserId || !fromUser || toUserId === fromUser.uid) return; 
    
    try {
        await addDoc(collection(db, getPublicCollection('notifications')), {
            toUserId: toUserId,
            fromUserId: fromUser.uid,
            fromUsername: fromUser.username,
            fromPhoto: fromUser.photoURL || '',
            type: type, // 'like', 'comment', 'follow', 'system'
            message: message,
            postId: postId, // ID Postingan untuk redirect saat diklik
            isRead: false,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Gagal mengirim notifikasi:", error);
    }
};

// --- 2. FUNGSI UNGGAH API EKSTERNAL ---
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    
    // Reset progress
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        // Simulasi progress bar agar terlihat berjalan
        for (let i = 0; i <= 30; i += 5) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        const response = await fetch(apiUrl, { 
            method: 'POST', 
            body: formData 
        });
        
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
        console.error('Upload gagal:', error);
        throw new Error('Gagal mengunggah media. File mungkin terlalu besar atau server sedang sibuk.');
    }
};

// --- 3. UTILITY FUNCTIONS ---
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const fullDate = date.toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (seconds > 86400) { 
        return { relative: fullDate, full: fullDate };
    }
    
    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes} menit yang lalu`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam yang lalu`, full: fullDate };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    
    // Cek YouTube
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { 
            type: 'youtube', 
            embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`,
            id: youtubeMatch[1]
        };
    }
    
    // Cek TikTok atau Instagram
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
    // Format sederhana: Bold, Italic, Code
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-sky-100 px-1 rounded text-sm text-sky-700 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- 4. LANDING PAGE (Modern UI & Developer Info) ---
const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center px-6 py-12 font-sans relative overflow-hidden">
            {/* Background Blobs untuk estetika modern */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-20 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            <div className="relative z-10 text-center w-full max-w-md">
                {/* Main Card Glassmorphism */}
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl rounded-[2.5rem] p-8 transform hover:scale-[1.01] transition duration-500">
                    <img src={APP_LOGO} alt="Logo" className="w-28 h-28 mx-auto mb-6 drop-shadow-md object-contain" />
                    
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-purple-600 mb-3 tracking-tight">
                        {APP_NAME}
                    </h1>
                    
                    <p className="text-gray-600 font-medium mb-8 leading-relaxed">
                        Jejaring sosial masa depan yang aman, modern, dan interaktif untuk semua kalangan. 🌍✨
                    </p>

                    {/* Fitur Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50">
                            <Gamepad2 size={22} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Gamers</span>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50">
                            <BookOpen size={22} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Edukasi</span>
                        </div>
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50">
                            <Users size={22} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Sosial</span>
                        </div>
                        <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border border-white/50">
                            <Sparkles size={22} className="mb-1"/>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Kreatif</span>
                        </div>
                    </div>

                    <button onClick={onGetStarted} className="w-full py-4 bg-gradient-to-r from-sky-500 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-200 hover:shadow-xl transform active:scale-95 transition-all flex items-center justify-center group">
                        Jelajahi Sekarang <ChevronRight className="ml-2 group-hover:translate-x-1 transition"/>
                    </button>
                </div>

                {/* Info Developer */}
                <div className="mt-8 bg-white/40 backdrop-blur-md border border-white/40 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/60 transition shadow-sm cursor-default">
                    <div className="relative">
                        <img src={DEV_PHOTO} className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover" alt="Dev"/>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5">Developed By</p>
                        <h3 className="font-bold text-gray-800 text-sm">M. Irham Andika Putra</h3>
                        <p className="text-xs text-gray-500">Siswa SMP Negeri 3 Mentok • 14 Tahun</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 5. LAYAR OTENTIKASI (Login & Register) ---
const AuthScreen = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                // Proses Login
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Pastikan profil ada (untuk user lama)
                const profileRef = doc(db, getPublicCollection('userProfiles'), userCredential.user.uid);
                const docSnap = await getDoc(profileRef);
                
                if (!docSnap.exists()) {
                     await setDoc(profileRef, {
                        username: email.split('@')[0],
                        email: email,
                        createdAt: serverTimestamp(),
                        uid: userCredential.user.uid,
                        photoURL: '',
                        following: [],
                        followers: []
                    });
                }
                
                onLoginSuccess(); 
            } else {
                // Proses Register
                if (!username.trim()) {
                    throw new Error('Username harus diisi.');
                }
                
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Buat profil user baru
                await setDoc(doc(db, getPublicCollection('userProfiles'), userCredential.user.uid), {
                    username: username.trim(),
                    email: email,
                    createdAt: serverTimestamp(),
                    uid: userCredential.user.uid,
                    photoURL: '',
                    following: [],
                    followers: []
                });
                
                onLoginSuccess();
            }
        } catch (err) {
            console.error("Authentication Error:", err); 
            let errorMessage = "Gagal. Periksa koneksi atau data Anda.";
            if (err.code === 'auth/email-already-in-use') errorMessage = 'Email sudah terdaftar.';
            else if (err.code === 'auth/wrong-password') errorMessage = 'Password salah.';
            else if (err.code === 'auth/user-not-found') errorMessage = 'Akun tidak ditemukan.';
            else if (err.code === 'auth/weak-password') errorMessage = 'Password terlalu lemah.';
            else if (err.message) errorMessage = err.message;
            
            setError(errorMessage); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-white p-8 relative overflow-hidden">
                {/* Header Warna */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400"></div>
                
                <div className="text-center mb-8 mt-2">
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight mb-1">
                        {isLogin ? 'Selamat Datang' : 'Buat Akun'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Masuk ke dunia {APP_NAME}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 flex items-center font-medium border border-red-100">
                        <AlertTriangle size={14} className="mr-2 flex-shrink-0"/>
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && (
                        <div className="group relative">
                            <User size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                placeholder="Username Unik" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 focus:bg-white focus:border-sky-300 outline-none transition-all"
                            />
                        </div>
                    )}
                    <div className="group relative">
                        <Mail size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="Alamat Email" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 focus:bg-white focus:border-sky-300 outline-none transition-all"
                        />
                    </div>
                    <div className="group relative">
                        <Lock size={18} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-sky-500 transition"/>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="Kata Sandi" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 text-sm font-medium focus:ring-2 focus:ring-sky-200 focus:bg-white focus:border-sky-300 outline-none transition-all"
                        />
                    </div>
                    
                    <button type="submit" disabled={isLoading} className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-800 shadow-lg shadow-gray-200 transition transform active:scale-95 disabled:opacity-70">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk Akun' : 'Daftar Gratis')}
                    </button>
                </form>

                <div className="mt-6 text-center pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-4">
                        {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} 
                        <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="font-bold text-sky-600 hover:underline ml-1">
                            {isLogin ? 'Daftar' : 'Masuk'}
                        </button>
                    </p>
                    
                    {/* Link Reset Password Google Form */}
                    {isLogin && (
                        <a 
                            href={PASSWORD_RESET_LINK} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-xs font-bold hover:bg-sky-100 transition"
                        >
                            <HelpCircle size={14} className="mr-2"/> Lupa Kata Sandi?
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 6. KOMPONEN POSTINGAN (FIX BUG LIKE LONCAT) ---
const PostItem = ({ post, currentUserId, profile, handleFollow, goToProfile }) => {
    // --- LOGIKA STABILISASI UI UNTUK LIKE ---
    // Kita simpan status like di state lokal dulu agar UI responsif instant
    // dan tidak menunggu server refresh yang menyebabkan feed loncat.
    const [liked, setLiked] = useState(post.likes?.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    
    // Sinkronisasi jika props berubah dari server (tapi tidak mereset jika user baru klik)
    useEffect(() => {
        setLiked(post.likes?.includes(currentUserId));
        setLikeCount(post.likes?.length || 0);
    }, [post.likes, currentUserId]);

    // State Komentar
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    
    // State Editing
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');

    const isOwner = post.userId === currentUserId;
    const isFollowing = profile.following?.includes(post.userId);

    // --- HANDLERS ---
    const handleLike = async () => {
        if (!currentUserId) return;

        // 1. Optimistic Update (Update UI duluan biar cepat & stabil)
        const isCurrentlyLiked = liked;
        const newLikedStatus = !isCurrentlyLiked;
        
        setLiked(newLikedStatus);
        setLikeCount(prev => newLikedStatus ? prev + 1 : prev - 1);

        // 2. Update ke Firebase di background
        const postRef = doc(db, getPublicCollection('posts'), post.id);
        try {
            if (newLikedStatus) {
                await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
                // Kirim notifikasi jika bukan punya sendiri
                if (post.userId !== currentUserId) {
                    sendNotification(post.userId, 'like', 'menyukai postingan Anda.', profile, post.id);
                }
            } else {
                await updateDoc(postRef, { likes: arrayRemove(currentUserId) });
            }
        } catch (error) {
            console.error("Like error:", error);
            // Revert UI jika gagal
            setLiked(isCurrentlyLiked);
            setLikeCount(prev => isCurrentlyLiked ? prev + 1 : prev - 1);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await addDoc(collection(db, getPublicCollection('comments')), {
                postId: post.id, 
                userId: currentUserId, 
                text: newComment, 
                username: profile.username, 
                timestamp: serverTimestamp() 
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { 
                commentsCount: (post.commentsCount || 0) + 1 
            });
            
            if (post.userId !== currentUserId) {
                sendNotification(post.userId, 'comment', `komentar: "${newComment.substring(0, 15)}.."`, profile, post.id);
            }
            setNewComment('');
        } catch (error) {
            console.error("Comment error:", error);
        }
    };

    const handleUpdatePost = async () => {
        try {
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { 
                title: editedTitle, 
                content: editedContent 
            });
            setIsEditing(false);
        } catch (error) {
            alert("Gagal update postingan");
        }
    };

    const handleDelete = async () => {
        if (confirm("Yakin ingin menghapus postingan ini?")) {
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
        }
    };

    const handleShare = async () => {
        try { 
            await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); 
            alert('Link Disalin! Orang lain akan diarahkan langsung ke postingan ini.'); 
        } catch (e) {
            alert('Gagal menyalin link');
        }
    };

    // Load komentar hanya saat dibuka (Hemat Bandwidth)
    useEffect(() => {
        if (!showComments) return;
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort di client side
            fetchedComments.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
            setComments(fetchedComments);
        });
        return unsubscribe;
    }, [showComments, post.id]);

    // Media Rendering Logic
    const mediaEmbed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const isVideo = (post.mediaUrl && (/\.(mp4|webm|ogg|mov)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white rounded-[2rem] p-5 mb-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden group transition hover:shadow-lg">
             
             {/* Label Shorts jika kebetulan masuk feed biasa */}
             {post.isShort && (
                 <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md z-10 flex items-center">
                     <Zap size={10} className="mr-1 text-yellow-400"/> SHORT
                 </div>
             )}

            {/* Header Postingan */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => goToProfile(post.userId)}>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-200 to-purple-200 p-[2px]">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            {post.user?.photoURL ? (
                                <img src={post.user.photoURL} className="w-full h-full object-cover"/>
                            ) : (
                                <span className="font-bold text-sky-600">{post.user?.username?.[0]}</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm leading-tight hover:text-sky-600 transition">
                            {post.user?.username || "User"}
                        </h4>
                        <span className="text-xs text-gray-400">
                            {formatTimeAgo(post.timestamp).relative}
                        </span>
                    </div>
                </div>
                
                {/* Tombol Aksi Header */}
                <div className="flex items-center gap-2">
                    {!isOwner && post.userId !== currentUserId && (
                        <button 
                            onClick={() => handleFollow(post.userId, isFollowing)} 
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
                        >
                            {isFollowing ? 'Teman' : 'Ikuti'}
                        </button>
                    )}
                    {isOwner && (
                        <>
                            <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-full transition"><Edit size={16}/></button>
                            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"><Trash2 size={16}/></button>
                        </>
                    )}
                </div>
            </div>

            {/* Mode Edit */}
            {isEditing ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <input 
                        value={editedTitle} 
                        onChange={(e) => setEditedTitle(e.target.value)} 
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold text-sm"
                        placeholder="Judul"
                    />
                    <textarea 
                        value={editedContent} 
                        onChange={(e) => setEditedContent(e.target.value)} 
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm resize-none"
                        rows="3"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-1">Batal</button>
                        <button onClick={handleUpdatePost} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-lg">Simpan</button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Judul & Konten */}
                    {post.title && <h3 className="font-bold text-gray-900 mb-2 text-lg">{post.title}</h3>}
                    <div className="text-sm text-gray-600 mb-4 leading-relaxed">
                        {renderMarkdown(post.content)}
                    </div>

                    {/* Media Display */}
                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4 rounded-2xl overflow-hidden bg-black/5 border border-gray-100 relative">
                            {isImage && <img src={post.mediaUrl} className="w-full max-h-[500px] object-cover"/>}
                            {isVideo && <video src={post.mediaUrl} controls className="w-full max-h-[500px] bg-black"/>}
                            {mediaEmbed?.type === 'youtube' && (
                                <div className="relative pt-[56.25%]">
                                    <iframe src={mediaEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe>
                                </div>
                            )}
                            {mediaEmbed?.type === 'link' && (
                                <a href={mediaEmbed.displayUrl} target="_blank" rel="noreferrer" className="block p-6 text-center bg-sky-50 text-sky-600 font-bold text-sm hover:underline group">
                                    <ExternalLink size={20} className="mx-auto mb-2 group-hover:scale-110 transition"/>
                                    Buka Tautan Eksternal
                                </a>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Tombol Interaksi Bawah */}
            <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                <button 
                    onClick={handleLike} 
                    className={`flex items-center gap-2 text-sm font-bold transition-all ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <Heart size={22} fill={liked ? 'currentColor' : 'none'} className={liked ? 'scale-110' : ''}/> 
                    {likeCount}
                </button>
                
                <button 
                    onClick={() => setShowComments(!showComments)} 
                    className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-sky-500 transition"
                >
                    <MessageSquare size={22}/> 
                    {post.commentsCount || 0}
                </button>
                
                <button 
                    onClick={handleShare} 
                    className="ml-auto text-gray-400 hover:text-sky-500 transition p-2 hover:bg-sky-50 rounded-full"
                >
                    <Share2 size={22}/>
                </button>
            </div>

            {/* Bagian Komentar */}
            {showComments && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">
                        {comments.length === 0 ? (
                            <p className="text-xs text-center text-gray-400 py-2">Belum ada komentar.</p>
                        ) : (
                            comments.map(c => (
                                <div key={c.id} className="bg-gray-50 p-3 rounded-xl text-xs">
                                    <span className="font-bold text-gray-800 mr-1">{c.username}</span>
                                    <span className="text-gray-600">{c.text}</span>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <form onSubmit={handleComment} className="flex gap-2 relative">
                        <input 
                            value={newComment} 
                            onChange={(e) => setNewComment(e.target.value)} 
                            placeholder="Tulis komentar..." 
                            className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-sky-200 focus:ring-2 focus:ring-sky-100 rounded-xl px-4 py-2.5 text-xs transition outline-none"
                        />
                        <button 
                            type="submit" 
                            disabled={!newComment.trim()} 
                            className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 bg-sky-500 text-white rounded-lg shadow-md hover:bg-sky-600 disabled:opacity-50 transition"
                        >
                            <Send size={14}/>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- 7. HOME SCREEN (STABLE FEED ALGORITHM) ---
const HomeScreen = ({ currentUserId, profile, allPosts, handleFollow, goToProfile, newPostId, clearNewPost }) => {
    const [sortType, setSortType] = useState('random'); 
    // State ini menyimpan urutan postingan yang sudah diacak agar tidak berubah saat like
    const [stableFeed, setStableFeed] = useState([]);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [loadingFeed, setLoadingFeed] = useState(true);

    // --- LOGIKA STABILISASI FEED ---
    useEffect(() => {
        if (allPosts.length === 0) {
            setLoadingFeed(false);
            return;
        }

        // Ambil base postingan (filter shorts)
        let basePosts = allPosts.filter(p => !p.isShort);
        
        // Cek apakah ada postingan baru yang harus dipin di atas
        let pinnedPost = null;
        if (newPostId) {
            const idx = basePosts.findIndex(p => p.id === newPostId);
            if (idx > -1) {
                pinnedPost = basePosts[idx];
                basePosts.splice(idx, 1); // Keluarkan dari array biasa
            }
        }

        let processedPosts = [];

        // Logika Sortir
        if (sortType === 'latest') {
            processedPosts = basePosts.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        } else if (sortType === 'popular') {
            processedPosts = basePosts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        } else {
            // --- RANDOM SORT ---
            // Kunci perbaikan: HANYA acak jika ini load pertama kali, atau user minta refresh, atau feed kosong.
            // Jika stableFeed sudah ada isinya, kita PERTAHANKAN urutannya, tapi update isinya (misal jumlah like).
            
            if (isFirstLoad || stableFeed.length === 0) {
                // Acak baru
                processedPosts = shuffleArray([...basePosts]);
            } else {
                // Pertahankan urutan lama, update data baru
                // Kita map stableFeed yang lama ke data terbaru dari basePosts
                processedPosts = stableFeed.map(oldPost => {
                    const updatedPostData = basePosts.find(p => p.id === oldPost.id);
                    // Jika postingan masih ada di data baru, pakai data baru (update like). 
                    // Jika dihapus, akan undefined (nanti difilter).
                    return updatedPostData; 
                }).filter(p => p !== undefined);
                
                // Tambahkan postingan baru yang mungkin masuk realtime (tapi bukan pinned post) di bawah
                // (Opsional, agar tidak mengganggu urutan atas)
            }
        }

        // Masukkan Pinned Post (postingan sendiri yang baru dibuat) selalu di paling atas
        if (pinnedPost) {
            processedPosts.unshift(pinnedPost);
        }

        setStableFeed(processedPosts);
        setIsFirstLoad(false); // Tandai sudah load pertama
        setLoadingFeed(false);

    }, [allPosts, sortType, newPostId]); 
    // Note: Dependency 'allPosts' tetap diperlukan agar data (jumlah like) terupdate, 
    // tapi logika 'isFirstLoad' di dalam mencegah pengacakan ulang.

    // Fungsi Refresh Manual
    const manualRefresh = () => {
        setLoadingFeed(true);
        // Reset state agar logika pengacakan jalan lagi
        setStableFeed([]); 
        setIsFirstLoad(true); 
        setSortType('random');
        clearNewPost(); // Hapus status pin post baru agar membaur
        
        // Simulasi delay sedikit agar terasa refresh
        setTimeout(() => setLoadingFeed(false), 500);
    };

    return (
        <div className="max-w-lg mx-auto pb-24 px-4">
            {/* Filter Bar Modern */}
            <div className="flex items-center justify-between mb-6 pt-4 sticky top-16 z-30 bg-[#F0F4F8]/90 backdrop-blur-md py-2 -mx-4 px-4">
                <div className="flex gap-2">
                     <button 
                        onClick={() => setSortType('latest')} 
                        className={`px-4 py-2 rounded-full text-xs font-bold transition border ${sortType==='latest' ? 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-200' : 'bg-white text-gray-500 border-white shadow-sm'}`}
                    >
                        Terbaru
                     </button>
                     <button 
                        onClick={() => setSortType('popular')} 
                        className={`px-4 py-2 rounded-full text-xs font-bold transition border ${sortType==='popular' ? 'bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-200' : 'bg-white text-gray-500 border-white shadow-sm'}`}
                    >
                        Populer
                     </button>
                </div>
                
                <button 
                    onClick={manualRefresh} 
                    className="p-2 bg-white text-gray-500 rounded-full shadow-sm hover:rotate-180 transition duration-500 hover:text-sky-500 active:scale-90"
                    title="Acak Ulang Beranda"
                >
                    <RefreshCw size={20}/>
                </button>
            </div>

            {/* Feed Content */}
            {loadingFeed ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <Loader2 className="animate-spin mb-2 text-sky-500"/> 
                    <span>Menyiapkan Feed...</span>
                </div>
            ) : stableFeed.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">Belum ada postingan.</p>
                    <p className="text-xs text-gray-400 mt-1">Mulai buat cerita pertamamu!</p>
                </div>
            ) : (
                stableFeed.map(p => (
                    <div key={p.id} className={p.id === newPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                        {/* Banner sukses posting */}
                        {p.id === newPostId && (
                            <div className="bg-emerald-100 text-emerald-700 text-xs font-bold text-center py-2 mb-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm mx-1">
                                <CheckCircle size={14}/> Postingan Berhasil Terkirim
                            </div>
                        )}
                        
                        <PostItem 
                            post={p} 
                            currentUserId={currentUserId} 
                            profile={profile} 
                            handleFollow={handleFollow} 
                            goToProfile={goToProfile}
                        />
                    </div>
                ))
            )}
        </div>
    );
};

// --- 8. SHORTS SCREEN (Full Screen, Fix Scroll, Random) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollow, profile }) => {
    const [feed, setFeed] = useState([]);

    // Randomize Shorts SEKALI SAJA saat mount
    useEffect(() => {
        const shortsOnly = allPosts.filter(p => p.isShort && p.mediaUrl);
        // Kita acak di awal
        setFeed(shuffleArray([...shortsOnly]));
    }, [allPosts]); // Dependensi allPosts agar jika ada shorts baru, masuk (walau diacak ulang)

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center">
             {/* Container Utama - Fix Scroll Snap */}
             <div className="w-full max-w-md h-[100dvh] overflow-y-scroll snap-y snap-mandatory snap-always no-scrollbar bg-black">
                {feed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 font-bold">
                        <Film size={48} className="mb-4 opacity-50"/>
                        <p>Belum ada video Shorts</p>
                    </div>
                ) : (
                    feed.map(p => (
                        <ShortItem 
                            key={p.id} 
                            post={p} 
                            currentUserId={currentUserId} 
                            handleFollow={handleFollow} 
                            profile={profile}
                        />
                    ))
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
    const embed = useMemo(()=>getMediaEmbed(post.mediaUrl),[post.mediaUrl]);

    // Intersection Observer untuk Auto Play/Pause
    useEffect(() => {
        const obs = new IntersectionObserver(e => {
            e.forEach(en => {
                setPlaying(en.isIntersecting);
                if(vidRef.current) {
                    if(en.isIntersecting) vidRef.current.play().catch(()=>{});
                    else { vidRef.current.pause(); vidRef.current.currentTime = 0; }
                }
            });
        }, {threshold: 0.6}); // 60% terlihat baru play
        
        if(ref.current) obs.observe(ref.current);
        return () => ref.current && obs.unobserve(ref.current);
    }, []);

    const toggleLike = async () => {
        const r = doc(db, getPublicCollection('posts'), post.id);
        if(isLiked) updateDoc(r, {likes:arrayRemove(currentUserId)});
        else { 
            updateDoc(r, {likes:arrayUnion(currentUserId)}); 
            if(post.userId!==currentUserId) sendNotification(post.userId, 'like', 'menyukai shorts Anda', profile, post.id); 
        }
    };
    
    // Load Comments Realtime
    useEffect(() => {
        if(showCom) {
            const q = query(collection(db,getPublicCollection('comments')), where('postId','==',post.id));
            return onSnapshot(q, s => setComments(s.docs.map(d=>d.data())));
        }
    }, [showCom, post.id]);

    return (
        <div ref={ref} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center overflow-hidden border-b border-gray-800">
             {/* Video Player */}
             {embed?.type==='youtube' ? (
                 <div className="w-full h-full pointer-events-auto relative">
                     {playing ? <iframe src={`${embed.embedUrl}&autoplay=1&controls=0&loop=1`} className="w-full h-full pointer-events-auto"/> : <div className="w-full h-full bg-black"/>}
                     <div className="absolute inset-0 bg-transparent pointer-events-none"/>
                 </div>
             ) : (
                 <video ref={vidRef} src={post.mediaUrl} className="w-full h-full object-cover" loop muted={muted} playsInline onClick={()=>setMuted(!muted)}/>
             )}
             
             {/* Overlay UI */}
             <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none flex flex-col justify-end p-5 pb-24">
                <div className="pointer-events-auto flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-white/50 p-0.5 overflow-hidden">
                        <img src={post.user?.photoURL||APP_LOGO} className="w-full h-full rounded-full object-cover"/>
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm drop-shadow-md">@{post.user?.username}</p>
                        {!isFollowing && post.userId !== currentUserId && (
                            <button onClick={()=>handleFollow(post.userId, false)} className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-0.5 rounded-full mt-1 hover:bg-white/40 transition">Ikuti</button>
                        )}
                    </div>
                </div>
                <p className="text-white text-sm drop-shadow-md line-clamp-2 mb-2 leading-relaxed">{post.content}</p>
             </div>

             {/* Tombol Kanan */}
             <div className="absolute right-3 bottom-28 flex flex-col gap-6 pointer-events-auto z-20">
                <button onClick={toggleLike} className="flex flex-col items-center group">
                    <div className={`p-3 rounded-full backdrop-blur-md transition ${isLiked?'bg-rose-500/80 text-white':'bg-black/30 text-white border border-white/20'}`}>
                        <Heart size={24} fill={isLiked?'currentColor':'none'}/>
                    </div>
                    <span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.likes?.length||0}</span>
                </button>
                <button onClick={()=>setShowCom(true)} className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20">
                        <MessageSquare size={24}/>
                    </div>
                    <span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.commentsCount||0}</span>
                </button>
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`); alert('Link Disalin')}} className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20">
                        <Share2 size={24}/>
                    </div>
                    <span className="text-white text-xs font-bold mt-1 drop-shadow-md">Share</span>
                </button>
             </div>

             {/* Modal Komentar Shorts */}
             {showCom && (
                 <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end pointer-events-auto">
                     <div className="w-full h-[60%] bg-white rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Komentar</h3>
                            <button onClick={()=>setShowCom(false)} className="bg-gray-100 p-1 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {comments.map((c,i)=>(
                                <div key={i} className="text-xs text-gray-800 border-b border-gray-50 pb-2">
                                    <span className="font-bold text-sky-600 mr-2">{c.username}</span> 
                                    {c.text}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2 pt-2 border-t">
                            <input value={txt} onChange={e=>setTxt(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-xs outline-none" placeholder="Ketik..."/>
                            <button onClick={async()=>{
                                if(!txt.trim()) return;
                                await addDoc(collection(db,getPublicCollection('comments')),{postId:post.id,userId:currentUserId,text:txt,username:profile.username});
                                await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount || 0) + 1 });
                                setTxt('');
                            }} className="text-sky-600 font-bold text-xs px-2">Kirim</button>
                        </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

// --- 9. CREATE POST (Upload Lengkap dengan Peringatan) ---
const CreatePost = ({ setPage, userId, username, onSuccess }) => {
    const [form, setForm] = useState({ title: '', content: '', file: null, url: '', isShort: false });
    const [loading, setLoading] = useState(false);
    const [prog, setProg] = useState(0);
    const [isLarge, setIsLarge] = useState(false);

    const submit = async (e) => {
        e.preventDefault(); 
        setLoading(true); 
        setProg(0);
        
        try {
            let finalUrl = form.url, type = 'text';
            if(form.file) { 
                finalUrl = await uploadToFaaAPI(form.file, setProg); 
                type = form.file.type.startsWith('image')?'image':'video'; 
            } else if(form.url) {
                type='link';
            }

            const ref = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, 
                title: form.title, 
                content: form.content, 
                mediaUrl: finalUrl, 
                mediaType: type,
                timestamp: serverTimestamp(), 
                likes: [], 
                commentsCount: 0, 
                isShort: form.isShort, 
                user: {username, uid: userId}
            });
            
            setProg(100); 
            setTimeout(()=>onSuccess(ref.id, form.isShort), 500);
        } catch(e){ 
            alert(e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-sky-50 relative overflow-hidden mt-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-purple-400"></div>
                <h2 className="text-xl font-black text-gray-800 mb-6">Buat Postingan Baru</h2>
                
                <form onSubmit={submit} className="space-y-4">
                    {loading && (
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                            <div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${prog}%`}}/>
                        </div>
                    )}
                    
                    <input 
                        value={form.title} 
                        onChange={e=>setForm({...form, title:e.target.value})} 
                        placeholder="Judul Menarik..." 
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 transition"
                        disabled={loading}
                    />
                    <textarea 
                        value={form.content} 
                        onChange={e=>setForm({...form, content:e.target.value})} 
                        placeholder="Ceritakan sesuatu hari ini..." 
                        rows="4" 
                        className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-200 transition resize-none"
                        disabled={loading}
                    />
                    
                    {isLarge && (
                        <div className="bg-orange-50 text-orange-600 text-xs p-3 rounded-xl flex items-center font-medium">
                            <AlertTriangle size={14} className="mr-2"/> File besar detected. Upload mungkin sedikit lama.
                        </div>
                    )}

                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <label className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer flex-1 whitespace-nowrap transition ${form.file?'bg-sky-50 border-sky-200 text-sky-600':'border-gray-200 text-gray-500'}`}>
                            <Image size={18} className="mr-2"/>
                            <span className="text-xs font-bold">{form.file?'Ganti File':'Foto/Video'}</span>
                            <input type="file" className="hidden" accept="image/*,video/*" onChange={e=>{
                                const f=e.target.files[0]; 
                                if(f) {
                                    setForm({...form, file:f, isShort: f.type.startsWith('video')});
                                    setIsLarge(f.size > 25*1024*1024);
                                }
                            }} disabled={loading}/>
                        </label>
                        
                        <div onClick={()=>setForm({...form, isShort:!form.isShort})} className={`flex items-center px-4 py-3 rounded-xl border cursor-pointer whitespace-nowrap transition ${form.isShort?'bg-black text-white border-black':'border-gray-200 text-gray-500'}`}>
                            <Zap size={18} className="mr-2"/>
                            <span className="text-xs font-bold">Mode Shorts</span>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <Link size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                        <input 
                            value={form.url} 
                            onChange={e=>setForm({...form, url:e.target.value, file:null, isShort: e.target.value.includes('shorts')})} 
                            placeholder="Atau Link Video (YouTube)..." 
                            className="w-full pl-10 py-3 bg-gray-50 rounded-xl text-xs outline-none"
                            disabled={loading}
                        />
                    </div>
                    
                    <button disabled={loading || (!form.content && !form.file && !form.url)} className="w-full py-4 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 transform active:scale-95 transition disabled:opacity-50">
                        {loading ? 'Sedang Mengunggah...' : 'Posting Sekarang'}
                    </button>
                </form>

                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                    <p className="text-xs font-bold text-gray-400 mb-2 flex items-center"><Info size={12} className="mr-1"/> TIPS FORMAT TEKS</p>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500">
                        <span className="bg-gray-50 px-2 py-1 rounded border">**Tebal**</span>
                        <span className="bg-gray-50 px-2 py-1 rounded border">*Miring*</span>
                        <span className="bg-gray-50 px-2 py-1 rounded border">`Kode`</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 10. PROFILE & SEARCH & NOTIFICATION SCREENS ---
const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifs, setNotifs] = useState([]);
    
    useEffect(() => {
        const q = query(collection(db, getPublicCollection('notifications')), where('toUserId','==',userId), orderBy('timestamp','desc'), limit(50));
        return onSnapshot(q, s => setNotifs(s.docs.map(d=>({id:d.id,...d.data()})).filter(n=>!n.isRead)));
    }, [userId]);

    const handleClick = async (n) => {
        await updateDoc(doc(db, getPublicCollection('notifications'), n.id), {isRead:true});
        if(n.type==='follow') { setTargetProfileId(n.fromUserId); setPage('other-profile'); }
        else if(n.postId) { setTargetPostId(n.postId); setPage('view_post'); }
    };

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <h1 className="text-xl font-black text-gray-800 mb-6">Notifikasi</h1>
            {notifs.length===0 ? <div className="text-center py-20 text-gray-400">Tidak ada notifikasi baru.</div> : 
            <div className="space-y-3">{notifs.map(n => <div key={n.id} onClick={()=>handleClick(n)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4 cursor-pointer hover:bg-sky-50 transition"><div className="relative"><img src={n.fromPhoto||APP_LOGO} className="w-12 h-12 rounded-full bg-gray-200 object-cover"/><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${n.type==='like'?'bg-rose-500':n.type==='comment'?'bg-blue-500':'bg-sky-500'}`}>{n.type==='like'?<Heart size={10} fill="white"/>:n.type==='comment'?<MessageSquare size={10} fill="white"/>:<UserPlus size={10}/>}</div></div><div className="flex-1"><p className="text-sm text-gray-800"><span className="font-bold">{n.fromUsername}</span> {n.message}</p><p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(n.timestamp).relative}</p></div></div>)}</div>}
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollow, goToProfile }) => {
    const [term, setTerm] = useState(''); const [tab, setTab] = useState('posts');
    const posts = allPosts.filter(p=>p.content?.toLowerCase().includes(term.toLowerCase()) || p.title?.toLowerCase().includes(term.toLowerCase()));
    const users = allUsers.filter(u=>u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid!==profile.uid);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="relative mb-4"><Search className="absolute left-4 top-3.5 text-gray-400" size={20}/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari..." className="w-full pl-12 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none"/></div>
            <div className="flex mb-6 bg-gray-100 p-1 rounded-xl"><button onClick={()=>setTab('posts')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${tab==='posts'?'bg-white shadow text-sky-600':'text-gray-500'}`}>Postingan</button><button onClick={()=>setTab('users')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${tab==='users'?'bg-white shadow text-sky-600':'text-gray-500'}`}>Pengguna</button></div>
            {term.length<2 ? <div className="text-center py-20 text-gray-400">Ketik minimal 2 huruf</div> : (tab==='posts' ? posts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} goToProfile={goToProfile}/>) : users.map(u=><div key={u.uid} className="flex justify-between items-center bg-white p-4 rounded-2xl mb-3 shadow-sm"><div className="flex gap-3 items-center font-bold cursor-pointer" onClick={()=>goToProfile(u.uid)}><div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center text-sky-600">{u.username[0]}</div>{u.username}</div><button onClick={()=>handleFollow(u.uid, profile.following?.includes(u.uid))} className="text-xs bg-sky-50 text-sky-600 px-3 py-1.5 rounded-lg font-bold">{profile.following?.includes(u.uid)?'Teman':'Ikuti'}</button></div>))}
        </div>
    );
};

const ProfileScreen = ({ currentUserId, username, email, allPosts, photoURL, isSelf, handleFollow, profile }) => {
    const [edit, setEdit] = useState(false); const [name, setName] = useState(username); const [file, setFile] = useState(null); const [load, setLoad] = useState(false);
    const userPosts = allPosts.filter(p=>p.userId===currentUserId).sort((a,b)=>(b.timestamp?.toMillis||0)-(a.timestamp?.toMillis||0));
    
    const save = async () => {
        setLoad(true);
        try {
            const url = file ? await uploadToFaaAPI(file, ()=>{}) : photoURL;
            await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), {photoURL:url, username:name});
            setEdit(false);
        } catch(e){alert(e.message)} finally{setLoad(false)};
    };

    return (
        <div className="max-w-lg mx-auto pb-24 pt-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-50 mb-8 mx-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-r from-sky-200 to-purple-200 opacity-30"></div>
                <div className="relative inline-block mb-4 mt-6">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100">{photoURL?<img src={photoURL} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-sky-500 text-3xl font-bold">{username?.[0]}</div>}</div>
                    {isSelf && <button onClick={()=>setEdit(!edit)} className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow text-sky-600"><Edit size={14}/></button>}
                </div>
                {edit ? <div className="space-y-3 bg-gray-50 p-4 rounded-xl animate-in fade-in"><input value={name} onChange={e=>setName(e.target.value)} className="border-b-2 border-sky-500 w-full text-center font-bold"/><input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs"/><button onClick={save} disabled={load} className="bg-sky-500 text-white px-4 py-1 rounded-full text-xs">{load?'...':'Simpan'}</button></div> : <h1 className="text-2xl font-black text-gray-800">{username}</h1>}
                <p className="text-gray-400 text-xs mb-6">{email}</p>
                {!isSelf && <button onClick={()=>handleFollow(currentUserId, profile.following?.includes(currentUserId))} className={`px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition ${profile.following?.includes(currentUserId)?'bg-gray-100 text-gray-600':'bg-sky-500 text-white shadow-sky-200'}`}>{profile.following?.includes(currentUserId)?'Berteman':'Ikuti'}</button>}
                <div className="flex justify-center gap-8 mt-6 border-t pt-6"><div><span className="font-bold text-xl block">{profile.followers?.length||0}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Pengikut</span></div><div><span className="font-bold text-xl block">{profile.following?.length||0}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Mengikuti</span></div><div><span className="font-bold text-xl block">{userPosts.length}</span><span className="text-[10px] text-gray-400 font-bold uppercase">Post</span></div></div>
            </div>
            <div className="px-4 space-y-6">{userPosts.map(p=><PostItem key={p.id} post={p} currentUserId={profile.uid} profile={profile} handleFollow={handleFollow} goToProfile={()=>{}}/>)}</div>
        </div>
    );
};

// --- 11. APP UTAMA (ROUTING & REDIRECT SHARE) ---
const App = () => {
    const [user, setUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [page, setPage] = useState('landing'); 
    const [posts, setPosts] = useState([]); 
    const [users, setUsers] = useState([]);
    const [targetUid, setTargetUid] = useState(null); 
    const [targetPid, setTargetPid] = useState(null); // ID Post untuk Redirect
    const [notifCount, setNotifCount] = useState(0);
    const [newPostId, setNewPostId] = useState(null);

    // Redirect Listener
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedPostId = params.get('post');
        if (sharedPostId) setTargetPid(sharedPostId);
    }, []);

    // Auth Listener
    useEffect(() => onAuthStateChanged(auth, u => { if(u) setUser(u); else {setUser(null); setProfile(null);} }), []);
    
    // Data Loader
    useEffect(() => {
        if(!user) return;
        
        // Logic Pindah Halaman setelah Login
        if(page==='landing' || page==='auth') setPage(targetPid ? 'view_post' : 'home');

        const unsubP = onSnapshot(doc(db, getPublicCollection('userProfiles'), user.uid), s => s.exists() ? setProfile({...s.data(), uid:user.uid, email:user.email}) : setDoc(doc(db, getPublicCollection('userProfiles'), user.uid), {username:user.email.split('@')[0], email:user.email, uid:user.uid, following:[], followers:[], photoURL:''}));
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async s => {
            const raw = s.docs.map(d=>({id:d.id,...d.data()}));
            const uids = [...new Set(raw.map(r=>r.userId))];
            const snaps = await Promise.all(uids.map(u=>getDoc(doc(db, getPublicCollection('userProfiles'), u))));
            const map = {}; snaps.forEach(sn=>{if(sn.exists()) map[sn.id]=sn.data()});
            setPosts(raw.map(r=>({...r, user: map[r.userId]||r.user})));
        });
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), s => setUsers(s.docs.map(d=>({id:d.id,...d.data(), uid:d.id}))));
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId','==',user.uid), where('isRead','==',false)), s=>setNotifCount(s.size));
        
        return () => { unsubP(); unsubPosts(); unsubUsers(); unsubNotif(); };
    }, [user]);

    const handleFollow = async (uid, isFollowing) => {
        const me = doc(db, getPublicCollection('userProfiles'), profile.uid);
        const target = doc(db, getPublicCollection('userProfiles'), uid);
        if(isFollowing) { await updateDoc(me, {following:arrayRemove(uid)}); await updateDoc(target, {followers:arrayRemove(profile.uid)}); }
        else { await updateDoc(me, {following:arrayUnion(uid)}); await updateDoc(target, {followers:arrayUnion(profile.uid)}); sendNotification(uid, 'follow', 'mulai mengikuti Anda', profile); }
    };

    if(user===undefined) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;

    if(!user) {
        if(page==='auth') return <AuthScreen onLoginSuccess={()=>{/*Redirect handled in useEffect*/}}/>;
        return <LandingPage onGetStarted={()=>setPage('auth')}/>;
    }

    if(!profile) return <div className="h-screen flex items-center justify-center bg-[#F0F4F8]"><Loader2 className="animate-spin text-sky-500"/></div>;

    return (
        <div className="min-h-screen bg-[#F0F4F8] font-sans text-gray-800">
            {page!=='shorts' && (
                <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-4 z-40 border-b border-white/50 shadow-sm">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setPage('home')}>
                        <img src={APP_LOGO} className="w-8 h-8 object-contain"/>
                        <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-purple-600">{APP_NAME}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={()=>setPage('notifications')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-sky-600 transition relative">
                            <Bell size={20}/>
                            {notifCount>0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>
                        <button onClick={async()=>{await signOut(auth); setPage('landing')}} className="p-2 bg-white rounded-full shadow-sm text-rose-400 hover:text-rose-600 transition"><LogOut size={20}/></button>
                    </div>
                </header>
            )}

            <main className={page!=='shorts'?'pt-16':''}>
                {page==='home' && <HomeScreen currentUserId={user.uid} profile={profile} allPosts={posts} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}} newPostId={newPostId} clearNewPost={()=>setNewPostId(null)}/>}
                {page==='shorts' && <><button onClick={()=>setPage('home')} className="fixed top-6 left-6 z-[60] bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition"><ArrowLeft/></button><ShortsScreen allPosts={posts} currentUserId={user.uid} handleFollow={handleFollow} profile={profile}/></>}
                {page==='create' && <CreatePost setPage={setPage} userId={user.uid} username={profile.username} onSuccess={(id,short)=>{if(!short)setNewPostId(id); setPage(short?'shorts':'home')}}/>}
                {page==='search' && <SearchScreen allPosts={posts} allUsers={users} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                {page==='notifications' && <NotificationScreen userId={user.uid} setPage={setPage} setTargetPostId={setTargetPid} setTargetProfileId={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/>}
                {page==='profile' && <ProfileScreen currentUserId={user.uid} username={profile.username} email={profile.email} allPosts={posts} photoURL={profile.photoURL} isSelf={true} handleFollow={handleFollow} profile={profile}/>}
                {page==='other-profile' && <ProfileScreen currentUserId={targetUid} username={users.find(u=>u.uid===targetUid)?.username} email={''} allPosts={posts} photoURL={users.find(u=>u.uid===targetUid)?.photoURL} isSelf={false} handleFollow={handleFollow} profile={profile}/>}
                {page==='view_post' && <div className="max-w-lg mx-auto pt-6 px-4"><button onClick={()=>setPage('home')} className="mb-4 flex items-center font-bold text-gray-500 hover:text-sky-600"><ArrowLeft size={18} className="mr-2"/> Kembali</button>{posts.find(p=>p.id===targetPid) ? <PostItem post={posts.find(p=>p.id===targetPid)} currentUserId={user.uid} profile={profile} handleFollow={handleFollow} goToProfile={(uid)=>{setTargetUid(uid); setPage('other-profile')}}/> : <div className="text-center p-10 text-gray-400">Postingan tidak ditemukan.</div>}</div>}
            </main>

            {page!=='shorts' && (
                <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-6 py-3 shadow-2xl shadow-sky-100/50 flex items-center gap-6 z-40">
                    <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                    <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                    <button onClick={()=>setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                    <NavBtn icon={Film} active={page==='shorts'} onClick={()=>setPage('shorts')}/>
                    <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/>
                </nav>
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={24} strokeWidth={active?2.5:2} />
    </button>
);

export default App;