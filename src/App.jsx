import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, onAuthStateChanged, signOut, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, doc, collection, query, onSnapshot, 
    updateDoc, arrayUnion, arrayRemove, setDoc, 
    serverTimestamp, addDoc, getDoc, setLogLevel, deleteDoc, where, orderBy, limit
} from 'firebase/firestore';
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image, Loader2, Link, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
    RefreshCw, Info, Clock, Star, ExternalLink
} from 'lucide-react';

// Atur log level ke 'warn' agar konsol bersih dari pesan debug standar Firebase
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 

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

// --- UTILS: SHUFFLE ARRAY (Algoritma Acak Paling Efektif: Fisher-Yates) ---
// Ini memastikan beranda benar-benar acak setiap kali di-refresh
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
            postId: postId, // Disimpan untuk redirect
            isRead: false,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Gagal kirim notifikasi:", error);
    }
};

// --- 2. FUNGSI UNGGAH API (Dipertahankan Logic Aslinya) ---
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        // Simulasi progress awal agar UX lebih smooth
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
        console.error('Upload ke API Faa gagal:', error);
        throw new Error('Gagal mengunggah media. File mungkin terlalu besar atau server sibuk.');
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
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { 
            type: 'youtube', 
            embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`,
            id: youtubeMatch[1]
        };
    }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) {
        return { type: 'link', embedUrl: url, displayUrl: url, platform: url.includes('tiktok.com') ? 'TikTok' : 'Instagram' };
    }
    return null;
};

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-500 italic">Tidak ada konten teks.</p>;
    let html = text;
    // Basic Markdown replacements
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm text-red-600 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- 4. LAYAR OTENTIKASI (Lengkap dengan Kontak Admin) ---
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
                onLoginSuccess(); 
            } else {
                if (!username.trim()) {
                    throw new Error('Username harus diisi.');
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await saveUserProfile(userCredential.user.uid, username.trim(), email);
                onLoginSuccess();
            }
        } catch (err) {
            console.error("Autentikasi Gagal:", err); 
            let errorMessage = "Gagal. Periksa email/password.";
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
        <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-4">
            <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-indigo-100">
                <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-2">
                    {isLogin ? 'Selamat Datang' : 'Buat Akun'}
                </h2>
                <p className="text-center text-gray-500 mb-6 text-sm">
                    Silakan masuk untuk melanjutkan ke Eduku
                </p>
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm rounded-r flex items-center">
                        <AlertCircle size={18} className="mr-2 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-3">
                        {!isLogin && (
                             <div className="relative">
                                <UserPlus size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" disabled={isLoading}/>
                            </div>
                        )}
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" disabled={isLoading}/>
                        </div>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" disabled={isLoading}/>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition transform active:scale-95 disabled:bg-indigo-300 shadow-lg shadow-indigo-200">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk Sekarang' : 'Daftar Akun')}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                        <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="text-indigo-600 font-bold hover:underline">
                            {isLogin ? 'Daftar' : 'Masuk'}
                        </button>
                    </p>
                </div>

                {/* INFO KONTAK ADMIN JIKA LUPA PASSWORD */}
                {isLogin && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                        <div className="flex items-start space-x-3 text-gray-600 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <HelpCircle size={24} className="text-indigo-500 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-800 mb-1">Lupa Kata Sandi?</p>
                                <p>Silakan hubungi Admin kami untuk melakukan reset sandi manual:</p>
                                <p className="font-bold text-indigo-600 flex items-center mt-2 text-sm bg-white px-2 py-1 rounded border border-indigo-100 w-fit">
                                    <Phone size={14} className="mr-1" /> 0827378
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 5. KOMPONEN POSTINGAN ---
const PostItem = ({ post, currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [showFullContent, setShowFullContent] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [editedMediaUrl, setEditedMediaUrl] = useState(post.mediaUrl || '');
    const [isDeleting, setIsDeleting] = useState(false);

    const isLiked = post.likes && post.likes.includes(currentUserId);
    const mediaEmbed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const formattedTime = useMemo(() => formatTimeAgo(post.timestamp), [post.timestamp]);
    const isOwner = post.userId === currentUserId;
    const isDeveloper = currentUserEmail === DEVELOPER_EMAIL;
    const canEditOrDelete = isOwner || isDeveloper;
    const isFollowing = profile.following?.includes(post.userId);
    const MAX_LENGTH = 200;
    const isLongText = post.content && post.content.length > MAX_LENGTH && !isEditing;
    
    const displayedContent = useMemo(() => {
        if (!post.content) return '';
        if (!isLongText || showFullContent || isEditing) return post.content;
        return post.content.substring(0, MAX_LENGTH) + '...';
    }, [post.content, isLongText, showFullContent, isEditing]);
    
    const handleLike = async () => {
        if (!currentUserId) return;
        const postRef = doc(db, getPublicCollection('posts'), post.id);
        try {
            if (isLiked) await updateDoc(postRef, { likes: arrayRemove(currentUserId) });
            else {
                await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
                if (post.userId !== currentUserId) {
                    sendNotification(post.userId, 'like', 'menyukai postingan anda.', profile, post.id);
                }
            }
        } catch (error) { console.error("Gagal like:", error); }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        try {
            await navigator.clipboard.writeText(url);
            alert("Link postingan berhasil disalin!");
        } catch (err) {
            alert("Gagal menyalin link.");
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        const username = profile.username || 'Pengguna Tidak Dikenal';
        try {
            await addDoc(collection(db, getPublicCollection('comments')), {
                postId: post.id, userId: currentUserId, text: newComment.trim(), username: username, timestamp: serverTimestamp() 
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount || 0) + 1 });
            if (post.userId !== currentUserId) {
                sendNotification(post.userId, 'comment', `mengomentari: "${newComment.trim().substring(0,20)}.."`, profile, post.id);
            }
            setNewComment('');
        } catch (error) { console.error("Gagal komen:", error); }
    };

    const handleUpdatePost = async () => {
        try {
            const postRef = doc(db, getPublicCollection('posts'), post.id);
            await updateDoc(postRef, { title: editedTitle.trim(), content: editedContent.trim(), mediaUrl: editedMediaUrl.trim(), updatedAt: serverTimestamp() });
            setIsEditing(false);
        } catch (error) { alert("Gagal update."); }
    };

    const handleDelete = async () => {
        if (!isDeleting) { setIsDeleting(true); return; }
        try {
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
            setIsDeleting(false);
        } catch (error) { alert("Gagal hapus."); setIsDeleting(false); }
    };

    useEffect(() => {
        if (!showComments) return;
        setIsLoadingComments(true);
        const commentsQuery = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const fetchedComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            fetchedComments.sort((a, b) => (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0) - (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0));
            setComments(fetchedComments);
            setIsLoadingComments(false);
        });
        return unsubscribe;
    }, [showComments, post.id]);

    const isVideo = (post.mediaUrl && (/\.(mp4|webm|ogg|mov)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 border border-gray-100 relative transition hover:shadow-md">
             {/* Tag Shorts di Postingan Biasa (Jika ada yang lolos filter) */}
             {post.isShort && <div className="absolute top-5 right-5 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center"><Film size={10} className="mr-1" /> SHORTS</div>}
            
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-11 h-11 bg-indigo-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold cursor-pointer overflow-hidden border-2 border-indigo-50" onClick={() => goToProfile(post.userId)}>
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : (post.user?.username || 'Anonim').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate cursor-pointer hover:text-indigo-600" onClick={() => goToProfile(post.userId)}>{post.user?.username || 'Pengguna Dihapus'}</p>
                        <p className="text-xs text-gray-400">{formattedTime.relative}</p>
                    </div>
                </div>
                <div className='flex space-x-2'>
                    {!isOwner && post.userId !== currentUserId && (
                        <button onClick={() => handleFollowToggle(post.userId, isFollowing)} className={`px-3 py-1.5 text-xs rounded-full font-bold transition ${isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}
                    {canEditOrDelete && (
                        <div className="flex bg-gray-50 rounded-lg p-0.5">
                            <button onClick={() => { setIsEditing(true); setIsDeleting(false); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"><Edit size={16} /></button>
                            <button onClick={handleDelete} className={`p-1.5 rounded transition ${isDeleting ? 'text-white bg-red-500' : 'text-gray-400 hover:text-red-600'}`}>{isDeleting ? <Check size={16} /> : <Trash2 size={16} />}</button>
                        </div>
                    )}
                </div>
            </div>
            
            {isEditing ? (
                <div className='space-y-3 mb-4 bg-gray-50 p-3 rounded-xl'>
                    <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} placeholder="Judul Postingan" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold"/>
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} rows="4" className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none"/>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-600">Batal</button>
                        <button onClick={handleUpdatePost} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Simpan Perubahan</button>
                    </div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{post.title}</h3>}
                    <div className="mb-4 text-sm">{renderMarkdown(displayedContent)}
                        {isLongText && <button onClick={() => setShowFullContent(!showFullContent)} className="text-indigo-600 text-xs font-bold ml-1 hover:underline">{showFullContent ? 'Tutup' : 'Baca selengkapnya'}</button>}
                    </div>
                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4 rounded-xl overflow-hidden bg-black/5 border border-gray-100 relative group">
                             {isImage && <img src={post.mediaUrl} className="w-full max-h-[500px] object-cover" />}
                            {isVideo && <video controls src={post.mediaUrl} className="w-full max-h-[500px] object-contain bg-black" />}
                            {mediaEmbed?.type === 'youtube' && (
                                <div className="relative pt-[56.25%]"><iframe src={mediaEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>
                            )}
                             {mediaEmbed?.type === 'link' && <a href={mediaEmbed.displayUrl} target="_blank" className="flex items-center justify-center p-4 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition"><ExternalLink size={18} className="mr-2"/>Buka Tautan Eksternal</a>}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-6">
                    <button onClick={handleLike} className={`flex items-center space-x-1.5 group ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-gray-700'}`}>
                        <div className={`p-1.5 rounded-full transition group-hover:bg-red-50 ${isLiked ? 'bg-red-50' : ''}`}><Heart size={20} className={`transition transform group-active:scale-125 ${isLiked ? 'fill-current' : ''}`} /></div>
                        <span className="text-xs font-bold">{post.likes?.length || 0}</span>
                    </button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 text-gray-500 hover:text-indigo-600 group">
                        <div className="p-1.5 rounded-full group-hover:bg-indigo-50"><MessageSquare size={20} className="group-active:scale-110"/></div>
                        <span className="text-xs font-bold">{post.commentsCount || 0}</span>
                    </button>
                </div>
                <button onClick={handleShare} className="text-gray-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-full transition"><Share2 size={20} /></button>
            </div>

            {showComments && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-4 max-h-64 overflow-y-auto mb-4 custom-scrollbar pr-1">
                        {isLoadingComments ? <Loader2 className="animate-spin mx-auto text-gray-400" size={20}/> : (
                            comments.length > 0 ? comments.map(c => (
                                <div key={c.id} className="flex items-start space-x-2.5 text-sm group">
                                    <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center font-bold text-[10px] text-gray-600 flex-shrink-0">{c.username?.charAt(0).toUpperCase()}</div>
                                    <div className="bg-gray-50 p-2.5 rounded-r-xl rounded-bl-xl flex-1 group-hover:bg-gray-100 transition">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-gray-800 text-xs">{c.username}</span>
                                            <span className="text-[10px] text-gray-400">{formatTimeAgo(c.timestamp).relative}</span>
                                        </div>
                                        <span className="text-gray-700 block leading-relaxed">{c.text}</span>
                                    </div>
                                </div>
                            )) : <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p className="text-xs">Belum ada komentar. Jadilah yang pertama!</p></div>
                        )}
                    </div>
                    <form onSubmit={handleComment} className="flex items-center relative">
                        <div className="relative flex-1">
                            <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar yang sopan..." className="w-full bg-gray-100 border-transparent rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-transparent transition outline-none" />
                            <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition shadow-sm" disabled={!newComment.trim()}><Send size={14} /></button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- 6. KOMPONEN BUAT POSTINGAN (Kode Kembali Lengkap) ---
const CreatePost = ({ setPage, userId, username, onPostSuccess }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState('text'); 
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0); 
    const [isShort, setIsShort] = useState(false);
    // DIKEMBALIKAN: State untuk file besar
    const [isLargeFile, setIsLargeFile] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Deteksi file besar (>25MB)
            if (file.size > 25 * 1024 * 1024) {
                setIsLargeFile(true);
            } else {
                setIsLargeFile(false);
            }

            setMediaFile(file);
            setMediaUrl(''); 
            if (file.type.startsWith('image/')) { setMediaType('image'); setIsShort(false); }
            else if (file.type.startsWith('video/')) { setMediaType('video'); }
            else { setMediaType('media'); setIsShort(false); }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && !mediaFile && !mediaUrl) return;

        setIsLoading(true);
        setProgress(0);
        let finalUrl = mediaUrl;
        let finalType = mediaType;

        try {
            if (mediaFile) {
                finalUrl = await uploadToFaaAPI(mediaFile, setProgress);
                finalType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
            } else if (mediaUrl) {
                finalType = 'link';
            } else {
                finalType = 'text';
                setProgress(100);
            }

            const docRef = await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: title.trim(), content: content.trim(),
                mediaUrl: finalUrl, mediaType: finalType, timestamp: serverTimestamp(),
                likes: [], commentsCount: 0, isShort: isShort, user: { username, uid: userId } 
            });
            
            setProgress(100);
            // Delay sedikit agar user lihat 100%
            await new Promise(r => setTimeout(r, 500));

            setTitle(''); setContent(''); setMediaFile(null); setMediaUrl(''); setIsShort(false); setIsLargeFile(false);
            
            // Panggil Callback untuk memberi tahu App ada post baru (Fitur PIN Postingan Baru)
            if(onPostSuccess) onPostSuccess(docRef.id, isShort); 
        } catch (error) { 
            alert("Gagal posting: " + error.message); 
        } finally { 
            setIsLoading(false); 
        }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-3xl shadow-lg border border-indigo-50 mt-4 mb-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-3">Buat Postingan</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                {isLoading && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-indigo-600 mb-1">
                            <span>{isLargeFile ? 'Memproses File Besar...' : 'Mengunggah...'}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}

                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (Opsional)" className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-200 transition text-sm font-bold" disabled={isLoading}/>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Apa yang Anda pikirkan hari ini?" rows="5" className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-200 transition resize-none text-sm" disabled={isLoading}/>

                {/* DIKEMBALIKAN: Peringatan File Besar */}
                {isLargeFile && (
                    <div className="flex items-start space-x-2 bg-orange-50 p-3 rounded-lg border border-orange-200 text-orange-800 text-xs">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0"/>
                        <p>File yang Anda pilih berukuran besar (>25MB). Proses upload mungkin membutuhkan waktu lebih lama. Mohon jangan tutup halaman ini.</p>
                    </div>
                )}

                <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                    <label className={`flex items-center justify-center px-4 py-2.5 rounded-xl border cursor-pointer transition whitespace-nowrap flex-1 ${mediaFile ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <Image size={18} className="mr-2" /><span className="text-sm font-medium">{mediaFile ? 'Ganti File' : 'Foto/Video'}</span>
                        <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" disabled={isLoading} />
                    </label>
                    
                    {(mediaType === 'video' || mediaUrl.includes('youtube')) && (
                        <div className={`flex items-center justify-center px-4 py-2.5 rounded-xl border cursor-pointer transition whitespace-nowrap ${isShort ? 'bg-red-50 border-red-200 text-red-600 ring-2 ring-red-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`} onClick={() => setIsShort(!isShort)}>
                            <Film size={18} className="mr-2" /><span className="text-sm font-medium">{isShort ? 'Mode Shorts' : 'Jadikan Shorts'}</span>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <Link size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                    <input type="url" value={mediaUrl} onChange={(e) => {setMediaUrl(e.target.value); setMediaType('link'); setMediaFile(null); if(e.target.value.includes('shorts')) setIsShort(true);}} placeholder="Atau tempel link YouTube/Video..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 transition" disabled={isLoading || !!mediaFile} />
                </div>

                <button type="submit" disabled={isLoading || (!content && !mediaFile && !mediaUrl)} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95">
                    {isLoading ? 'Sedang Mengirim...' : 'Posting Sekarang'}
                </button>
            </form>
            
            {/* Instruksi Format Teks (Diminta di prompt sebelumnya) */}
            <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                    <Info size={16}/>
                    <span className="text-xs font-bold uppercase tracking-wide">Tips Format Teks</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="flex items-center space-x-2"><span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[10px]">**Teks**</span> <span>&rarr; <strong>Tebal</strong></span></div>
                    <div className="flex items-center space-x-2"><span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[10px]">*Teks*</span> <span>&rarr; <em>Miring</em></span></div>
                    <div className="flex items-center space-x-2"><span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[10px]">`Kode`</span> <span>&rarr; <code className="bg-gray-200 px-1 rounded text-red-500">Kode</code></span></div>
                </div>
            </div>
        </div>
    );
};

// --- 7. KOMPONEN BERANDA (Logic Sortir Lengkap & Pin Post) ---
const HomeScreen = ({ currentUserId, profile, allPosts, isLoadingPosts, handleFollowToggle, goToProfile, newlyCreatedPostId, clearNewPost }) => {
    const [sortType, setSortType] = useState('random'); // random, latest, popular
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Untuk trigger re-shuffle

    const displayedPosts = useMemo(() => {
        // 1. Filter Shorts agar TIDAK muncul di beranda (Sesuai request)
        let list = allPosts.filter(p => !p.isShort);

        // 2. Logika Pin Postingan Baru (Sesuai request)
        let pinnedPost = null;
        if (newlyCreatedPostId) {
            const idx = list.findIndex(p => p.id === newlyCreatedPostId);
            if (idx > -1) {
                pinnedPost = list[idx];
                list.splice(idx, 1); // Hapus sementara dari list utama
            }
        }

        // 3. Algoritma Sortir
        if (sortType === 'latest') {
            list.sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0));
        } else if (sortType === 'popular') {
            list.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        } else {
            // Random (Default) - Menggunakan Fisher-Yates Shuffle
            list = shuffleArray([...list]); 
        }

        // 4. Masukkan Pinned Post ke Paling Atas
        if (pinnedPost) {
            list.unshift(pinnedPost);
        }

        return list;
    }, [allPosts, sortType, refreshTrigger, newlyCreatedPostId]);

    const handleRefresh = () => {
        setSortType('random');
        setRefreshTrigger(prev => prev + 1); // Trigger useMemo untuk mengacak ulang
        clearNewPost(); // Hapus status pin (kembali ke urutan normal)
    };

    return (
        <div className="max-w-lg mx-auto pb-20">
            {/* Kontrol Feed */}
            <div className="flex items-center space-x-3 mb-6 px-4 overflow-x-auto no-scrollbar py-2 sticky top-14 bg-gray-50 z-30 backdrop-blur-sm bg-opacity-90">
                <button onClick={handleRefresh} className="p-2.5 bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 active:scale-90 transition hover:bg-gray-50 hover:text-indigo-600" title="Acak Ulang"><RefreshCw size={18}/></button>
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <button onClick={() => setSortType('latest')} className={`flex items-center px-4 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm ${sortType === 'latest' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    <Clock size={14} className="mr-2"/> Terbaru
                </button>
                <button onClick={() => setSortType('popular')} className={`flex items-center px-4 py-2 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm ${sortType === 'popular' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    <Flame size={14} className="mr-2"/> Terpopuler
                </button>
            </div>

            {isLoadingPosts ? (
                <div className="flex flex-col items-center pt-20">
                    <Loader2 className="animate-spin text-indigo-600" size={32}/>
                    <p className="text-xs text-gray-400 mt-3 font-medium tracking-wide">Menyiapkan feed untukmu...</p>
                </div>
            ) : displayedPosts.length === 0 ? (
                <div className="text-center p-10">
                    <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 text-gray-400"><MessageSquare size={32}/></div>
                    <h3 className="text-gray-800 font-bold">Belum ada postingan</h3>
                    <p className="text-gray-500 text-sm mt-2">Jadilah orang pertama yang memposting sesuatu!</p>
                </div>
            ) : (
                displayedPosts.map(post => (
                    <div key={post.id} className={post.id === newlyCreatedPostId ? "animate-in slide-in-from-top-10 duration-700" : ""}>
                        {post.id === newlyCreatedPostId && (
                            <div className="flex items-center justify-center space-x-2 text-green-600 text-xs font-bold mb-2 bg-green-50 py-1 rounded-lg mx-4 border border-green-100">
                                <Check size={12}/> <span>Berhasil Diposting</span>
                            </div>
                        )}
                        <PostItem post={post} currentUserId={currentUserId} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />
                    </div>
                ))
            )}
        </div>
    );
};

// --- 8. KOMPONEN SHORTS (Fix Scroll & Random Order) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollowToggle, profile }) => {
    const [feed, setFeed] = useState([]);

    // Randomize Shorts on Mount Only (Supaya urutan tidak berubah saat user nonton/like)
    useEffect(() => {
        let videos = allPosts.filter(p => p.isShort === true && p.mediaUrl);
        // Acak-acak aja sesuai request
        setFeed(shuffleArray([...videos]));
    }, [allPosts]); 

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center overflow-hidden">
            {/* PERBAIKAN SCROLL: h-[100dvh], snap-mandatory, snap-always */}
            <div className="w-full max-w-md h-[100dvh] overflow-y-scroll snap-y snap-mandatory snap-always no-scrollbar bg-black">
                {feed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white p-8 text-center">
                        <Film size={48} className="mb-4 text-gray-500 opacity-50"/>
                        <p className="font-bold text-lg">Belum ada video Shorts.</p>
                        <p className="text-sm text-gray-400 mt-2">Upload video vertikal atau gunakan link YouTube Shorts.</p>
                    </div>
                ) : (
                    feed.map((post) => (
                        <ShortItem key={post.id} post={post} currentUserId={currentUserId} handleFollowToggle={handleFollowToggle} profile={profile} />
                    ))
                )}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollowToggle, profile }) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    
    const isLiked = post.likes && post.likes.includes(currentUserId);
    const isFollowing = profile.following?.includes(post.userId);
    const embedData = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    
    // Intersection Observer untuk Auto Play/Pause
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                setIsPlaying(entry.isIntersecting);
                if (videoRef.current) {
                    if (entry.isIntersecting) videoRef.current.play().catch(() => {});
                    else { videoRef.current.pause(); videoRef.current.currentTime = 0; }
                }
            });
        }, { threshold: 0.6 }); // Threshold 60% terlihat
        
        if (containerRef.current) observer.observe(containerRef.current);
        return () => { if (containerRef.current) observer.unobserve(containerRef.current); };
    }, []);

    const handleLike = async (e) => {
        e.stopPropagation();
        if (!currentUserId) return;
        const postRef = doc(db, getPublicCollection('posts'), post.id);
        if (isLiked) updateDoc(postRef, { likes: arrayRemove(currentUserId) });
        else {
            updateDoc(postRef, { likes: arrayUnion(currentUserId) });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'like', 'menyukai shorts anda.', profile, post.id);
        }
    };

    useEffect(() => {
        if (!showComments) return;
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        return onSnapshot(q, (snap) => {
            setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0)));
        });
    }, [showComments, post.id]);

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        await addDoc(collection(db, getPublicCollection('comments')), {
            postId: post.id, userId: currentUserId, text: newComment.trim(), username: profile.username, timestamp: serverTimestamp() 
        });
        await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount || 0) + 1 });
        if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `komen di shorts: "${newComment.substring(0,10)}.."`, profile, post.id);
        setNewComment('');
    };

    return (
        // H-[100dvh] untuk Mobile Safari/Chrome support
        <div ref={containerRef} className="snap-start w-full h-[100dvh] relative bg-gray-900 flex items-center justify-center border-b border-gray-800 overflow-hidden">
            {embedData?.type === 'youtube' ? (
                <div className="w-full h-full relative">
                    {isPlaying ? (
                        <iframe src={`${embedData.embedUrl}&autoplay=1&mute=0&controls=0&loop=1&playlist=${embedData.id}`} className="w-full h-full object-cover pointer-events-auto" allow="autoplay; encrypted-media;" allowFullScreen></iframe>
                    ) : <div className="w-full h-full bg-black flex items-center justify-center text-gray-600"><Film className="animate-pulse"/></div>}
                    <div className="absolute inset-0 bg-transparent pointer-events-none"></div>
                </div>
            ) : (
                <video ref={videoRef} src={post.mediaUrl} className="w-full h-full object-cover" loop playsInline muted={muted} onClick={() => setMuted(!muted)} />
            )}
            
            {/* UI Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white pt-32 pointer-events-none pb-12">
                <div className="pointer-events-auto mb-3 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-gray-700 shadow-lg">
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-sm font-bold">{post.user?.username?.[0]}</div>}
                    </div>
                    <div>
                        <p className="font-bold text-base shadow-black drop-shadow-md">{post.user?.username}</p>
                        {!isFollowing && post.userId !== currentUserId && <button onClick={() => handleFollowToggle(post.userId, false)} className="text-[10px] bg-white text-black px-3 py-1 rounded-full font-bold mt-1 hover:bg-gray-200 transition">Ikuti</button>}
                    </div>
                </div>
                <p className="text-sm line-clamp-3 drop-shadow-md mb-2 text-gray-100">{post.content}</p>
            </div>

            {/* Side Action Buttons */}
            <div className="absolute right-2 bottom-28 flex flex-col items-center space-y-6 pointer-events-auto z-10 pb-8">
                <button onClick={handleLike} className="flex flex-col items-center group">
                    <div className={`p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 transition group-active:scale-90 ${isLiked ? 'text-red-500 bg-white/20' : 'text-white'}`}><Heart size={28} fill={isLiked ? 'currentColor' : 'none'} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.likes?.length || 0}</span>
                </button>
                <button onClick={() => setShowComments(true)} className="flex flex-col items-center group">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white transition group-active:scale-90"><MessageSquare size={28} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.commentsCount || 0}</span>
                </button>
                 <button onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`);alert('Link Shorts Disalin!');}catch(e){}}} className="flex flex-col items-center group">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white transition group-active:scale-90"><Share2 size={28} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">Share</span>
                </button>
            </div>

            {/* Comment Modal */}
            {showComments && (
                <div className="absolute inset-0 z-20 flex items-end bg-black/60 backdrop-blur-sm pointer-events-auto">
                    <div className="w-full h-[65%] bg-white rounded-t-3xl p-4 flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <p className="font-bold text-gray-800 text-sm">Komentar ({post.commentsCount})</p>
                            <button onClick={() => setShowComments(false)} className="p-1 bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 mb-2 custom-scrollbar">
                            {comments.map(c => (
                                <div key={c.id} className="text-xs flex items-start space-x-2">
                                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600 flex-shrink-0">{c.username?.[0]}</div>
                                    <div>
                                        <span className="font-bold mr-1 text-gray-900">{c.username}</span>
                                        <span className="text-gray-600 block mt-0.5">{c.text}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handlePostComment} className="flex space-x-2 border-t pt-3">
                            <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"/>
                            <button type="submit" disabled={!newComment} className="text-indigo-600 font-bold text-xs px-2">Kirim</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 9. NOTIFIKASI ---
const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifications, setNotifications] = useState([]);
    useEffect(() => {
        const q = query(
            collection(db, getPublicCollection('notifications')), 
            where('toUserId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(50) // Tambah limit biar lebih banyak history
        );
        return onSnapshot(q, (snapshot) => {
            // Filter isRead di client side sesuai permintaan "hilang kalau sudah dibaca"
            const unread = snapshot.docs.map(d => ({id: d.id, ...d.data()})).filter(n => !n.isRead);
            setNotifications(unread);
        });
    }, [userId]);

    const handleNotificationClick = async (notif) => {
        try { await updateDoc(doc(db, getPublicCollection('notifications'), notif.id), { isRead: true }); } catch (e) { }
        if (notif.type === 'follow') { setTargetProfileId(notif.fromUserId); setPage('other-profile'); } 
        else if ((notif.type === 'like' || notif.type === 'comment') && notif.postId) { setTargetPostId(notif.postId); setPage('view_post'); }
    };

    return (
        <div className="max-w-lg mx-auto p-4 pb-20">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Notifikasi</h1>
            {notifications.length === 0 ? (
                <div className="text-center text-gray-400 py-12 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Bell size={32} className="text-gray-300"/></div>
                    <p className="font-medium">Tidak ada notifikasi baru.</p>
                    <p className="text-sm text-gray-400 mt-1">Interaksi baru akan muncul di sini.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map(notif => (
                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="flex items-center p-4 bg-white rounded-2xl border border-indigo-50 shadow-sm active:scale-95 transition cursor-pointer hover:bg-gray-50 hover:border-indigo-200 relative overflow-hidden">
                             {/* Indikator belum dibaca */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                            <div className="mr-4 relative">
                                {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-12 h-12 rounded-full object-cover border border-gray-200"/> : <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500 text-lg">{notif.fromUsername?.[0]}</div>}
                                {notif.type === 'like' && <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-1 border-2 border-white"><Heart size={12} fill="white"/></div>}
                                {notif.type === 'comment' && <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1 border-2 border-white"><MessageSquare size={12} fill="white"/></div>}
                                {notif.type === 'follow' && <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-1 border-2 border-white"><UserPlus size={12}/></div>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-800 leading-snug">
                                    <span className="font-bold text-gray-900">{notif.fromUsername}</span> {notif.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 font-medium">{formatTimeAgo(notif.timestamp).relative}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- 10. PROFILE, SEARCH, SINGLE POST (Lengkap) ---
const ProfileScreen = ({ currentUserId, username, email, allPosts, photoURL, isSelf, handleFollowToggle, profile }) => {
    const [userPosts, setUserPosts] = useState([]);
    const [isEditingPFP, setIsEditingPFP] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState(username);
    const [pfpFile, setPfpFile] = useState(null);
    const [isLoadingPFP, setIsLoadingPFP] = useState(false);

    useEffect(() => {
        setUserPosts(allPosts.filter(p => p.userId === currentUserId).sort((a, b) => (b.timestamp?.toMillis || 0) - (a.timestamp?.toMillis || 0)));
    }, [allPosts, currentUserId]);

    const handleSavePFP = async () => {
        setIsLoadingPFP(true);
        try {
            const url = pfpFile ? await uploadToFaaAPI(pfpFile, () => {}) : photoURL;
            await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), { photoURL: url });
            setIsEditingPFP(false);
        } catch (e) { alert(e.message); } finally { setIsLoadingPFP(false); }
    };
    const handleSaveUsername = async () => {
        if(newUsername.length<3) return;
        await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), { username: newUsername });
        setIsEditingUsername(false);
    }
    const isFollowing = profile.following?.includes(currentUserId);

    return (
        <div className="max-w-lg mx-auto pb-24 pt-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 mx-4">
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-50 shadow-inner">
                            {photoURL ? <img src={photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">{username?.[0]}</div>}
                        </div>
                        {isSelf && <button onClick={() => setIsEditingPFP(!isEditingPFP)} className="absolute bottom-0 right-0 p-2 bg-white text-indigo-600 rounded-full shadow-md border border-gray-100 hover:bg-gray-50"><Edit size={16}/></button>}
                    </div>
                    
                    {isEditingUsername ? (
                        <div className="flex items-center space-x-2 mb-1"><input value={newUsername} onChange={e=>setNewUsername(e.target.value)} className="border-b-2 border-indigo-500 text-center font-bold text-xl focus:outline-none pb-1"/><button onClick={handleSaveUsername} className="p-1 bg-green-100 text-green-600 rounded-full"><Check size={20}/></button></div>
                    ) : (
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">{username} {isSelf && <Edit size={16} className="text-gray-400 cursor-pointer hover:text-indigo-600" onClick={()=>setIsEditingUsername(true)}/>}</h1>
                    )}
                    <p className="text-gray-500 text-xs mb-5 font-medium">{email}</p>
                    {!isSelf && <button onClick={() => handleFollowToggle(currentUserId, isFollowing)} className={`px-8 py-2.5 rounded-full font-bold text-sm transition transform active:scale-95 ${isFollowing ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>{isFollowing ? 'Mengikuti' : 'Ikuti'}</button>}
                    <div className="flex w-full justify-center space-x-8 mt-6 pt-6 border-t border-gray-50">
                        <div className="flex flex-col"><span className="font-bold text-xl text-gray-900">{profile.followers?.length || 0}</span><span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Pengikut</span></div>
                        <div className="flex flex-col"><span className="font-bold text-xl text-gray-900">{profile.following?.length || 0}</span><span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Mengikuti</span></div>
                        <div className="flex flex-col"><span className="font-bold text-xl text-gray-900">{userPosts.length}</span><span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Post</span></div>
                    </div>
                </div>
                {isEditingPFP && isSelf && <div className="mt-4 p-3 bg-indigo-50 rounded-xl flex items-center gap-2 animate-in fade-in border border-indigo-100"><input type="file" className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" onChange={e=>setPfpFile(e.target.files[0])}/><button onClick={handleSavePFP} disabled={isLoadingPFP} className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-full font-bold hover:bg-indigo-700 disabled:opacity-50">{isLoadingPFP ? '...' : 'Simpan'}</button></div>}
            </div>
            <div className="px-4 space-y-4">
                <h3 className="font-bold text-gray-800 text-lg ml-1">Postingan</h3>
                {userPosts.length === 0 ? <div className="text-center text-gray-400 py-10">Belum ada postingan.</div> : userPosts.map(p => <PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={()=>{}} />)}
            </div>
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollowToggle, goToProfile }) => {
    const [term, setTerm] = useState('');
    const [tab, setTab] = useState('posts');
    const resPosts = allPosts.filter(p => p.content?.toLowerCase().includes(term.toLowerCase()) || p.title?.toLowerCase().includes(term.toLowerCase()));
    const resUsers = allUsers.filter(u => u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid !== profile.uid);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="relative mb-6"><Search className="absolute left-4 top-3.5 text-gray-400" size={20}/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari postingan atau teman..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-medium"/></div>
            <div className="flex mb-6 bg-gray-100 p-1 rounded-xl">
                <button onClick={()=>setTab('posts')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition ${tab==='posts' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Postingan</button>
                <button onClick={()=>setTab('users')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition ${tab==='users' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Orang</button>
            </div>
            {term.length < 2 ? <div className="text-center text-gray-400 mt-20 flex flex-col items-center"><Search size={40} className="opacity-20 mb-4"/><p>Ketik minimal 2 huruf untuk mencari.</p></div> : (tab === 'posts' ? resPosts.map(p => <PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />) : resUsers.map(u => <div key={u.uid} className="flex justify-between items-center bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-50"><div className="flex items-center gap-3 cursor-pointer" onClick={()=>goToProfile(u.uid)}><div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">{u.username[0]}</div><span className="font-bold text-gray-800">{u.username}</span></div><button onClick={()=>handleFollowToggle(u.uid, profile.following?.includes(u.uid))} className={`text-xs px-4 py-2 rounded-full font-bold transition ${profile.following?.includes(u.uid) ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white shadow-md shadow-indigo-200'}`}>{profile.following?.includes(u.uid) ? 'Mengikuti' : 'Ikuti'}</button></div>))}
        </div>
    );
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return <div className="p-10 text-center pt-20"><p className="text-gray-400 mb-4">Postingan ini mungkin telah dihapus.</p><button onClick={goBack} className="text-indigo-600 font-bold hover:underline">Kembali ke Beranda</button></div>;
    return <div className="max-w-lg mx-auto p-4 pb-20 pt-6"><button onClick={goBack} className="mb-4 flex items-center font-bold text-gray-600 hover:text-indigo-600 transition bg-white px-3 py-2 rounded-lg shadow-sm w-fit"><ArrowLeft size={18} className="mr-2"/> Kembali</button><PostItem post={post} {...props}/></div>;
};

// --- 11. STRUKTUR APLIKASI UTAMA ---
const App = () => {
    const [currentUser, setCurrentUser] = useState(undefined); 
    const [profile, setProfile] = useState(null); 
    const [targetProfileId, setTargetProfileId] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [allPosts, setAllPosts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [targetPostId, setTargetPostId] = useState(null); 
    const [notifCount, setNotifCount] = useState(0);
    
    // STATE BARU: Untuk Fitur Pin Postingan Baru
    const [newlyCreatedPostId, setNewlyCreatedPostId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) setCurrentUser(user);
            else { setCurrentUser(null); setProfile(null); }
        });
        return unsubscribe; 
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        return onSnapshot(doc(db, getPublicCollection('userProfiles'), currentUser.uid), (snap) => {
            if (snap.exists()) setProfile({ ...snap.data(), email: currentUser.email, uid: currentUser.uid });
            else setDoc(doc(db, getPublicCollection('userProfiles'), currentUser.uid), { username: currentUser.email.split('@')[0], email: currentUser.email, uid: currentUser.uid, following: [], followers: [], photoURL: '' });
        });
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', currentUser.uid), where('isRead', '==', false)), (snap) => setNotifCount(snap.size));
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async (snapshot) => {
            const rawPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const uids = [...new Set(rawPosts.map(p => p.userId))];
            const userSnaps = await Promise.all(uids.map(uid => getDoc(doc(db, getPublicCollection('userProfiles'), uid))));
            const userMap = {};
            userSnaps.forEach(s => { if(s.exists()) userMap[s.id] = s.data(); });
            setAllPosts(rawPosts.map(p => ({ ...p, user: userMap[p.userId] || p.user })));
        });
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id }))));
        return () => { unsubNotif(); unsubPosts(); unsubUsers(); };
    }, [currentUser]);

    // Notifikasi Jam 5 Pagi
    useEffect(() => {
        if (!currentUser) return;
        const now = new Date();
        const key = `dailyPrompt_${now.getDate()}`;
        if (now.getHours() === 5 && !localStorage.getItem(key)) {
            sendNotification(currentUser.uid, 'system', 'Selamat pagi! Waktunya berbagi cerita hari ini.', {uid:'sys', username:'Eduku System'});
            localStorage.setItem(key, 'true');
        }
    }, [currentUser]);

    const handleLogout = async () => { await signOut(auth); setPage('home'); };
    
    const handleFollow = async (targetUid, isFollowing) => {
        const myRef = doc(db, getPublicCollection('userProfiles'), profile.uid);
        const targetRef = doc(db, getPublicCollection('userProfiles'), targetUid);
        if(isFollowing) {
            await updateDoc(myRef, { following: arrayRemove(targetUid) });
            await updateDoc(targetRef, { followers: arrayRemove(profile.uid) });
        } else {
            await updateDoc(myRef, { following: arrayUnion(targetUid) });
            await updateDoc(targetRef, { followers: arrayUnion(profile.uid) });
            sendNotification(targetUid, 'follow', 'mulai mengikuti anda.', profile);
        }
    };
    
    // Callback saat berhasil posting
    const handlePostCreated = (newId, isShort) => {
        if(!isShort) {
            setNewlyCreatedPostId(newId); // Set ID postingan baru
        }
        setPage(isShort ? 'shorts' : 'home');
    };

    if (currentUser === undefined) return <div className="h-screen flex items-center justify-center text-indigo-600 bg-gray-50"><Loader2 className="animate-spin" size={40}/></div>;
    if (!currentUser) return <AuthScreen onLoginSuccess={() => {}} />;
    if (!profile) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-indigo-600"/></div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {page !== 'shorts' && (
                <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between shadow-sm max-w-lg mx-auto transition-all">
                    <div className="flex items-center gap-2.5 cursor-pointer group" onClick={()=>setPage('home')}>
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold italic shadow-indigo-200 shadow-lg group-hover:scale-105 transition">E</div>
                        <span className="font-extrabold text-xl text-gray-800 tracking-tight group-hover:text-indigo-600 transition">Eduku</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage('notifications')} className="relative p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition hover:text-indigo-600">
                            <Bell size={22} strokeWidth={2} />
                            {notifCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>
                        <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition" title="Keluar"><LogOut size={20}/></button>
                    </div>
                </header>
            )}
            <main className={`min-h-screen max-w-lg mx-auto ${page !== 'shorts' ? 'pt-16' : ''} transition-all`}>
                {page === 'home' && <HomeScreen currentUserId={currentUser.uid} profile={profile} allPosts={allPosts} isLoadingPosts={false} handleFollowToggle={handleFollow} goToProfile={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} newlyCreatedPostId={newlyCreatedPostId} clearNewPost={() => setNewlyCreatedPostId(null)} />}
                {page === 'shorts' && <><button onClick={()=>setPage('home')} className="fixed top-5 left-5 z-[60] bg-black/30 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-black/50 transition border border-white/10"><ArrowLeft size={24}/></button><ShortsScreen allPosts={allPosts} currentUserId={currentUser.uid} handleFollowToggle={handleFollow} profile={profile} /></>}
                {page === 'create' && <CreatePost setPage={setPage} userId={currentUser.uid} username={profile.username} onPostSuccess={handlePostCreated} />}
                {page === 'search' && <SearchScreen allPosts={allPosts} allUsers={allUsers} profile={profile} handleFollowToggle={handleFollow} goToProfile={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} />}
                {page === 'notifications' && <NotificationScreen userId={currentUser.uid} setPage={setPage} setTargetPostId={setTargetPostId} setTargetProfileId={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} />}
                {page === 'profile' && <ProfileScreen currentUserId={currentUser.uid} username={profile.username} email={profile.email} allPosts={allPosts} photoURL={profile.photoURL} isSelf={true} handleFollowToggle={handleFollow} profile={profile} />}
                {page === 'other-profile' && <ProfileScreen currentUserId={targetProfileId} username={allUsers.find(u=>u.uid===targetProfileId)?.username} email={''} allPosts={allPosts} photoURL={allUsers.find(u=>u.uid===targetProfileId)?.photoURL} isSelf={false} handleFollowToggle={handleFollow} profile={profile} />}
                {page === 'view_post' && <SinglePostView postId={targetPostId} allPosts={allPosts} currentUserId={currentUser.uid} profile={profile} handleFollowToggle={handleFollow} goToProfile={()=>{}} goBack={()=>setPage('home')} />}
            </main>
            {page !== 'shorts' && (
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 z-40 max-w-lg mx-auto flex justify-around items-center px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <NavBtn icon={Home} label="Home" isActive={page === 'home'} onClick={() => setPage('home')} />
                    <NavBtn icon={Search} label="Cari" isActive={page === 'search'} onClick={() => setPage('search')} />
                    <div className="relative -top-6">
                        <button onClick={() => setPage('create')} className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-300 transform active:scale-90 transition hover:shadow-indigo-400/50 border-4 border-white">
                            <PlusCircle size={28} />
                        </button>
                    </div>
                    <NavBtn icon={Film} label="Shorts" isActive={page === 'shorts'} onClick={() => setPage('shorts')} />
                    <NavBtn icon={User} label="Profil" isActive={page === 'profile'} onClick={() => setPage('profile')} />
                </nav>
            )}
        </div>
    );
};

const NavBtn = ({ icon: Icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-full transition duration-200 group ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <div className={`p-1 rounded-xl transition ${isActive ? 'bg-indigo-50' : 'group-hover:bg-gray-50'}`}>
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'fill-indigo-100' : ''} />
        </div>
        <span className={`text-[10px] font-bold mt-0.5 transition ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);

export default App;