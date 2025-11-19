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
    serverTimestamp, addDoc, getDoc, setLogLevel, deleteDoc, where
} from 'firebase/firestore';
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image, Loader2, Link, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle
} from 'lucide-react';

// Atur log level ke 'warn' atau 'error' agar tidak terlalu berisik di konsol
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

// --- 2. FUNGSI UNGGAH API EKSTERNAL (Modified) ---
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        // Simulasi progress awal
        for (let i = 0; i <= 30; i += 5) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        // Fetch yang sebenarnya
        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        
        // Lompat ke 90% saat respon diterima
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
        console.error('Upload ke API Faa2 gagal:', error);
        throw new Error('Gagal mengunggah media. File mungkin terlalu besar atau server sibuk.');
    }
};

// --- 3. UTILITY FUNCTIONS (Sama + Update detection) ---
const formatTimeAgo = (timestamp) => {
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
    // Mendeteksi YouTube standar dan Shorts
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
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm text-red-600 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
};


// --- 4. LAYAR OTENTIKASI FIREBASE (AuthScreen) ---
// ... (Kode AuthScreen SAMA PERSIS tidak diubah logic intinya) ...
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
                    setError('Username harus diisi.');
                    setIsLoading(false); 
                    return;
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
            
            setError(errorMessage); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100">
                <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
                    {isLogin ? 'Masuk' : 'Daftar'}
                </h2>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start space-x-2">
                        <AlertCircle size={20} className="mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="relative">
                        <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl" disabled={isLoading}/>
                    </div>
                    {!isLogin && (
                         <div className="relative">
                            <UserPlus size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl" disabled={isLoading}/>
                        </div>
                    )}
                    <div className="relative">
                        <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl" disabled={isLoading}/>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-300">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? 'Masuk' : 'Daftar')}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-gray-600">
                    {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                    <button onClick={() => {setIsLogin(!isLogin); setError('');}} className="text-indigo-600 font-semibold hover:text-indigo-800">
                        {isLogin ? 'Daftar Sekarang' : 'Masuk'}
                    </button>
                </p>
            </div>
        </div>
    );
};


// --- 5. KOMPONEN POSTINGAN (PostItem) ---
const PostItem = ({ post, currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    // ... (Logic PostItem SAMA, tidak diubah) ...
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
            else await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
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
        const commentsRef = collection(db, getPublicCollection('comments'));
        try {
            await addDoc(commentsRef, {
                postId: post.id, userId: currentUserId, text: newComment.trim(), username: username, timestamp: serverTimestamp() 
            });
            const postRef = doc(db, getPublicCollection('posts'), post.id);
            await updateDoc(postRef, { commentsCount: (post.commentsCount || 0) + 1 });
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

    const displayedUsername = post.user?.username || 'Pengguna Dihapus';
    const isVideo = (post.mediaUrl && (/\.(mp4|webm|ogg|mov)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-6 border border-gray-100 relative">
             {post.isShort && <div className="absolute top-6 right-6 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center"><Film size={12} className="mr-1" /> SHORTS</div>}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer" onClick={() => goToProfile(post.userId)}>
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-10 h-10 rounded-full object-cover"/> : displayedUsername.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800 cursor-pointer" onClick={() => goToProfile(post.userId)}>{displayedUsername}</p>
                        <p className="text-xs text-gray-500">{formattedTime.relative}</p>
                    </div>
                </div>
                <div className='flex space-x-2'>
                    {!isOwner && post.userId !== currentUserId && (
                        <button onClick={() => handleFollowToggle(post.userId, isFollowing)} className={`px-3 py-1 text-sm rounded-full font-medium ${isFollowing ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white'}`}>
                            {isFollowing ? <UserCheck size={16}/> : <UserPlus size={16}/>}
                        </button>
                    )}
                    {canEditOrDelete && (
                        <>
                            <button onClick={() => { setIsEditing(true); setIsDeleting(false); }} className="p-2 text-indigo-600"><Edit size={20} /></button>
                            <button onClick={handleDelete} className={`p-2 ${isDeleting ? 'bg-red-500 text-white rounded-full' : 'text-red-500'}`}>{isDeleting ? <Check size={20} /> : <Trash2 size={20} />}</button>
                        </>
                    )}
                </div>
            </div>
            
            {isEditing ? (
                <div className='space-y-4 pt-2 pb-4'>
                    <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} placeholder="Judul" className="w-full p-2 border rounded"/>
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} rows="4" className="w-full p-2 border rounded"/>
                    <input value={editedMediaUrl} onChange={(e) => setEditedMediaUrl(e.target.value)} placeholder="URL Media" className="w-full p-2 border rounded"/>
                    <div className="flex justify-end space-x-2">
                         <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                        <button onClick={handleUpdatePost} className="px-4 py-2 bg-indigo-600 text-white rounded">Simpan</button>
                    </div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="text-xl font-bold mb-3">{post.title}</h3>}
                    <div className="mb-4">{renderMarkdown(displayedContent)}
                        {isLongText && <button onClick={() => setShowFullContent(!showFullContent)} className="text-indigo-600 text-sm ml-1">{showFullContent ? 'Sembunyikan' : 'Selengkapnya'}</button>}
                    </div>
                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4">
                             {isImage && <img src={post.mediaUrl} className="w-full max-h-[50vh] object-cover rounded-lg" />}
                            {isVideo && <video controls src={post.mediaUrl} className="w-full max-h-[50vh] object-cover rounded-lg" />}
                            {mediaEmbed?.type === 'youtube' && (
                                <div className="relative pt-[56.25%] rounded-lg overflow-hidden"><iframe src={mediaEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>
                            )}
                             {mediaEmbed?.type === 'link' && <a href={mediaEmbed.displayUrl} target="_blank" className="text-indigo-600 block p-3 bg-indigo-50 rounded border"><Link size={18} className="inline mr-2"/>Buka Link</a>}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center justify-between text-gray-600 border-t pt-3">
                <div className="flex items-center space-x-4">
                    <button onClick={handleLike} className={`flex items-center space-x-1 ${isLiked ? 'text-red-500' : ''}`}><Heart size={20} fill={isLiked ? 'currentColor' : 'none'} /><span>{post.likes?.length || 0}</span></button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1"><MessageSquare size={20} /><span>{post.commentsCount || 0}</span></button>
                    <button onClick={handleShare} className="flex items-center space-x-1 hover:text-green-600"><Share2 size={20} /></button>
                </div>
            </div>

            {showComments && (
                <div className="mt-4 border-t pt-4">
                    <form onSubmit={handleComment} className="flex space-x-2 mb-4">
                        <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-grow p-2 border rounded-xl" />
                        <button type="submit" className="bg-indigo-600 text-white px-4 rounded-xl"><Send size={20} /></button>
                    </form>
                    {isLoadingComments ? <Loader2 className="animate-spin mx-auto" /> : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {comments.map((c) => (
                                <div key={c.id} className="bg-gray-50 p-2 rounded-xl text-sm"><p className="font-bold">{c.username}</p><p>{c.text}</p></div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// --- 6. KOMPONEN BUAT POSTINGAN (CreatePost) ---
const CreatePost = ({ setPage, userId, username }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState('text'); 
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 
    const [isShort, setIsShort] = useState(false);
    // State baru untuk handling file besar
    const [isLargeFile, setIsLargeFile] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Cek ukuran file (misal > 25MB dianggap besar)
            if (file.size > 25 * 1024 * 1024) {
                setIsLargeFile(true);
            } else {
                setIsLargeFile(false);
            }

            setMediaFile(file);
            setMediaUrl(''); 
            if (file.type.startsWith('image/')) {
                setMediaType('image');
                setIsShort(false);
            } else if (file.type.startsWith('video/')) {
                 setMediaType('video');
            } else {
                setMediaType('media');
                setIsShort(false);
            }
        }
    };

    const handleUrlChange = (e) => {
        const val = e.target.value;
        setMediaUrl(val);
        setMediaFile(null); 
        setMediaType('link');
        setIsLargeFile(false);

        // LOGIKA BARU: Deteksi YouTube Shorts Link otomatis
        if (val.includes('youtube.com/shorts/')) {
            setIsShort(true);
        } else {
            setIsShort(false);
        }
    };

    const handleProgressUpdate = useCallback((newProgress) => {
        setProgress(newProgress);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploadError(''); 
        if (!content.trim() && !mediaFile && !mediaUrl) {
            setUploadError('Konten kosong!');
            return;
        }

        setIsLoading(true);
        setProgress(0);
        let finalMediaUrl = '';
        let finalMediaType = mediaType;

        try {
            if (mediaFile) {
                finalMediaUrl = await uploadToFaaAPI(mediaFile, handleProgressUpdate);
                finalMediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
            } else if (mediaUrl) {
                finalMediaUrl = mediaUrl;
                finalMediaType = 'link';
            } else {
                finalMediaType = 'text';
                setProgress(100); 
            }

            // Tambahan logic: Jika Link tapi isShort dicentang, anggap sebagai 'video' untuk Shorts Screen
            // Tapi di sini kita simpan mediaType tetap 'link' agar renderer tahu itu embed, 
            // tapi isShort=true akan membuatnya muncul di menu Shorts.

            const postsRef = collection(db, getPublicCollection('posts'));
            await addDoc(postsRef, {
                userId,
                title: title.trim(), 
                content: content.trim(),
                mediaUrl: finalMediaUrl,
                mediaType: finalMediaType,
                timestamp: serverTimestamp(),
                likes: [],
                commentsCount: 0,
                // Modifikasi: isShort bisa true untuk video upload ATAU link YouTube Shorts
                isShort: isShort, 
                user: { username: username, uid: userId } 
            });
            
            setProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Reset
            setTitle(''); setContent(''); setMediaFile(null); setMediaUrl(''); setIsShort(false);
            // Arahkan ke Shorts jika isShort
            setPage(isShort ? 'shorts' : 'home');
        } catch (error) {
            console.error("Gagal memposting:", error);
            setUploadError(`${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-2xl border border-indigo-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Buat Postingan Baru</h2>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4 text-sm text-indigo-700 font-medium">
                Anda memposting sebagai: **{username}**
            </div>
            {uploadError && <div className="p-3 mb-4 rounded-lg text-sm bg-red-100 text-red-700 border border-red-300">{uploadError}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Progress Bar yang Diperbaiki UX nya */}
                {isLoading && (
                    <div className="mt-4">
                        <div className="text-sm font-semibold text-indigo-600 mb-1 flex justify-between">
                            <span>{isLargeFile ? "Memproses File Besar (Mohon Tunggu)..." : "Mengunggah Media..."}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                        {isLargeFile && progress < 90 && (
                            <p className="text-xs text-orange-600 mt-1 animate-pulse">
                                File berukuran besar sedang diproses. Jangan tutup halaman ini.
                            </p>
                        )}
                    </div>
                )}
                
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (Opsional)" className="w-full p-3 border rounded-lg" disabled={isLoading}/>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Apa yang Anda pikirkan?" rows="6" className="w-full p-3 border rounded-lg" disabled={isLoading}/>

                {/* Alert jika file besar */}
                {isLargeFile && (
                    <div className="flex items-start space-x-2 bg-orange-50 p-3 rounded-lg border border-orange-200 text-orange-800 text-sm">
                        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0"/>
                        <p>Ukuran file cukup besar. Proses upload mungkin membutuhkan waktu lebih lama tergantung koneksi internet Anda.</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <label className={`flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 rounded-lg border border-indigo-200 transition flex-1 w-full ${isLoading ? 'bg-gray-100' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
                        <Image size={20} />
                        <span>{mediaFile ? (mediaFile.name.length > 20 ? mediaFile.name.substring(0,20)+'...' : mediaFile.name) : 'Unggah File'}</span>
                        <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" disabled={isLoading || !!mediaUrl} />
                    </label>
                    <div className="flex-1 w-full">
                        <div className={`flex items-center space-x-2 text-green-600 p-3 rounded-lg border ${isLoading ? 'bg-gray-100' : 'bg-green-50'}`}>
                            <Link size={20} />
                            <input type="url" value={mediaUrl} onChange={handleUrlChange} placeholder="Link YouTube/Video" className="w-full bg-transparent outline-none" disabled={isLoading || !!mediaFile} />
                        </div>
                    </div>
                </div>
                
                {/* Checkbox Shorts: Muncul untuk Video Upload ATAU Link YouTube */}
                {(mediaType === 'video' || (mediaType === 'link' && mediaUrl.includes('youtube'))) && (
                    <div className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition ${isShort ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`} onClick={() => setIsShort(!isShort)}>
                        <div className={`w-6 h-6 rounded border flex items-center justify-center ${isShort ? 'bg-red-600 border-red-600' : 'bg-white border-gray-400'}`}>
                            {isShort && <Check size={16} className="text-white" />}
                        </div>
                        <div className="flex items-center">
                            <Film size={18} className="mr-2" />
                            <span className="font-semibold">Posting sebagai Shorts</span>
                        </div>
                    </div>
                )}

                <button type="submit" disabled={isLoading || (!content.trim() && !mediaFile && !mediaUrl)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 shadow-lg">
                    {isLoading ? 'Memproses...' : 'Posting Sekarang'}
                </button>
            </form>
        </div>
    );
};


// --- 7. KOMPONEN BERANDA (HomeScreen) ---
const HomeScreen = ({ currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile, allPosts, isLoadingPosts }) => {
    const [feedType, setFeedType] = useState('foryou'); 

    const processedPosts = useMemo(() => {
        let list = [...allPosts];
        if (feedType === 'foryou') {
             list = list.sort((a, b) => {
                const scoreA = (a.likes?.length || 0) * 2 + (a.commentsCount || 0) * 3 + Math.random() * 5;
                const scoreB = (b.likes?.length || 0) * 2 + (b.commentsCount || 0) * 3 + Math.random() * 5;
                return scoreB - scoreA;
             });
             return list.slice(0, 50);
        }
        if (feedType === 'popular') {
            list.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
            return list;
        }
        if (feedType === 'latest') {
            list.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                return timeB - timeA; 
            });
            return list;
        }
        return list;
    }, [allPosts, feedType]);

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Beranda Untuk Anda</h1>
            <div className="flex space-x-2 border-b pb-3 mb-6 overflow-x-auto no-scrollbar">
                <button onClick={() => setFeedType('foryou')} className={`flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'foryou' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}><Shuffle size={18} /><span>Untuk Anda</span></button>
                <button onClick={() => setFeedType('popular')} className={`flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'popular' ? 'bg-red-500 text-white' : 'bg-white border'}`}><Flame size={18} /><span>Terpopuler</span></button>
                <button onClick={() => setFeedType('latest')} className={`flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'latest' ? 'bg-green-600 text-white' : 'bg-white border'}`}><TrendingUp size={18} /><span>Terbaru</span></button>
            </div>

            {isLoadingPosts ? (
                <div className="flex flex-col items-center justify-center h-48 text-indigo-600"><Loader2 className="animate-spin" size={32} /><p>Memuat...</p></div>
            ) : processedPosts.length === 0 ? (
                <div className="text-center p-8 text-gray-500">Tidak ada postingan.</div>
            ) : (
                <div className="space-y-6">
                    {processedPosts.map(post => (
                        <PostItem key={post.id} post={post} currentUserId={currentUserId} currentUserEmail={currentUserEmail} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- 8. KOMPONEN SHORTS (DIPERBAIKI) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollowToggle, profile }) => {
    // Filter video shorts ATAU link youtube shorts yang ditandai
    const shortVideos = useMemo(() => {
        return allPosts.filter(p => 
            p.isShort === true && p.mediaUrl
        );
    }, [allPosts]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center overflow-hidden pt-16 sm:pt-0">
            <div className="w-full max-w-md h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
                {shortVideos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white p-8 text-center">
                        <Film size={48} className="mb-4 text-gray-500"/>
                        <p className="text-xl font-bold">Belum ada video Shorts.</p>
                    </div>
                ) : (
                    shortVideos.map((post) => (
                        <ShortItem key={post.id} post={post} currentUserId={currentUserId} handleFollowToggle={handleFollowToggle} profile={profile} />
                    ))
                )}
            </div>
        </div>
    );
};

// Komponen Item Shorts yang sudah DIPERBAIKI
const ShortItem = ({ post, currentUserId, handleFollowToggle, profile }) => {
    const isLiked = post.likes && post.likes.includes(currentUserId);
    const isFollowing = profile.following?.includes(post.userId);
    
    // State untuk komentar di shorts
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    // Cek apakah ini YouTube Embed
    const embedData = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    
    const handleLike = async (e) => {
        e.stopPropagation();
        if (!currentUserId) return;
        const postRef = doc(db, getPublicCollection('posts'), post.id);
        try {
            if (isLiked) await updateDoc(postRef, { likes: arrayRemove(currentUserId) });
            else await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
        } catch (error) { console.error("Like Error:", error); }
    };

    // LOGIKA BARU: Handle Share dengan Feedback
    const handleShareShort = async () => {
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        try {
            await navigator.clipboard.writeText(url);
            alert("Link Shorts berhasil disalin ke clipboard!");
        } catch (err) {
            alert("Gagal menyalin link.");
        }
    };

    // LOGIKA BARU: Fetch Comment untuk Shorts
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

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), {
                postId: post.id, userId: currentUserId, text: newComment.trim(), username: profile.username, timestamp: serverTimestamp() 
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount || 0) + 1 });
            setNewComment('');
        } catch (error) { console.error("Gagal komen:", error); }
    };

    return (
        <div className="snap-start w-full h-full relative bg-gray-900 flex items-center justify-center border-b border-gray-800">
            {/* Video Container: Support Native Video & YouTube Iframe */}
            {embedData && embedData.type === 'youtube' ? (
                <div className="w-full h-full pointer-events-auto">
                     <iframe
                        src={`${embedData.embedUrl}&controls=0&showinfo=0&loop=1`}
                        title="YouTube Shorts"
                        className="w-full h-full object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                    {/* Layer transparan agar gesture swipe tetap jalan jika perlu, tapi ini akan blokir kontrol youtube */}
                    <div className="absolute inset-0 bg-transparent pointer-events-none"></div>
                </div>
            ) : (
                <video 
                    src={post.mediaUrl} 
                    className="w-full h-full object-contain bg-black" 
                    controls={false}
                    autoPlay 
                    muted 
                    loop 
                    playsInline
                    onClick={(e) => e.target.muted = !e.target.muted} 
                />
            )}
            
            {/* Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent text-white pointer-events-none">
                <div className="flex items-center justify-between mb-2 pointer-events-auto">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold">
                             {post.user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-shadow-sm">{post.user?.username}</p>
                            {!isFollowing && post.userId !== currentUserId && (
                                <button onClick={() => handleFollowToggle(post.userId, false)} className="text-xs bg-red-600 px-2 py-1 rounded text-white font-bold mt-1">Ikuti</button>
                            )}
                        </div>
                    </div>
                </div>
                <p className="text-sm line-clamp-2 mb-2">{post.content}</p>
            </div>

            {/* Action Buttons (Right Side) */}
            <div className="absolute right-2 bottom-20 flex flex-col items-center space-y-6 z-10 pointer-events-auto">
                <button onClick={handleLike} className="flex flex-col items-center">
                    <div className={`p-3 rounded-full bg-black/40 backdrop-blur-sm ${isLiked ? 'text-red-500' : 'text-white'}`}>
                        <Heart size={28} fill={isLiked ? 'currentColor' : 'none'} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">{post.likes?.length || 0}</span>
                </button>
                
                {/* Tombol Komentar yang FIX */}
                <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white">
                        <MessageSquare size={28} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">{post.commentsCount || 0}</span>
                </button>

                {/* Tombol Share yang FIX */}
                <button onClick={handleShareShort} className="flex flex-col items-center">
                     <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white">
                        <Share2 size={28} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">Share</span>
                </button>
            </div>

            {/* MODAL KOMENTAR SHORTS (BARU) */}
            {showComments && (
                <div className="absolute inset-0 z-20 flex items-end bg-black/50 backdrop-blur-sm">
                    <div className="w-full h-[70%] bg-white rounded-t-3xl p-4 flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-gray-800">Komentar ({post.commentsCount || 0})</h3>
                            <button onClick={() => setShowComments(false)} className="p-1 bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                            {isLoadingComments ? <div className="text-center py-4"><Loader2 className="animate-spin inline text-indigo-600"/></div> : (
                                comments.length > 0 ? comments.map(c => (
                                    <div key={c.id} className="flex space-x-2">
                                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">
                                            {c.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="bg-gray-100 p-2 rounded-xl text-sm flex-1">
                                            <p className="font-bold text-xs text-gray-700">{c.username} <span className="text-gray-400 font-normal ml-1">{formatTimeAgo(c.timestamp).relative}</span></p>
                                            <p className="text-gray-800">{c.text}</p>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-gray-400 mt-10">Belum ada komentar.</p>
                            )}
                        </div>

                        <form onSubmit={handlePostComment} className="flex items-center space-x-2 pt-2 border-t">
                            <input 
                                type="text" 
                                value={newComment} 
                                onChange={(e) => setNewComment(e.target.value)} 
                                placeholder="Tambahkan komentar..." 
                                className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                            />
                            <button type="submit" disabled={!newComment.trim()} className="p-2 bg-indigo-600 text-white rounded-full disabled:bg-gray-300">
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 9. KOMPONEN SINGLE POST (Tampilan Dari Share Link) ---
const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-gray-600">Mencari postingan...</p>
                <button onClick={goBack} className="mt-4 text-indigo-600 font-bold hover:underline">Kembali ke Beranda</button>
            </div>
        );
    }
    return (
        <div className="max-w-2xl mx-auto pt-4">
            <button onClick={goBack} className="flex items-center text-indigo-600 font-semibold mb-4 hover:bg-indigo-50 p-2 rounded-lg w-fit transition"><ArrowLeft size={20} className="mr-2" /> Kembali</button>
            <PostItem post={post} {...props} />
        </div>
    );
}

// --- 10. KOMPONEN AKUN (ProfileScreen) ---
const ProfileScreen = ({ currentUserId, username, email, allPosts, currentUserEmail, photoURL, isSelf, handleFollowToggle, profile }) => {
    const [userPosts, setUserPosts] = useState([]);
    const [isEditingPFP, setIsEditingPFP] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState(username);
    const [newPhotoUrl, setNewPhotoUrl] = useState(photoURL || '');
    const [pfpFile, setPfpFile] = useState(null);
    const [isLoadingPFP, setIsLoadingPFP] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 
    const [usernameError, setUsernameError] = useState('');

    useEffect(() => {
        const filteredPosts = allPosts
            .filter(post => post.userId === currentUserId)
            .sort((a, b) => (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0) - (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0));
        setUserPosts(filteredPosts);
    }, [allPosts, currentUserId]);

    const handleSavePFP = async () => {
        setIsLoadingPFP(true); setUploadError(''); setProgress(0);
        let finalUrl = newPhotoUrl.trim();
        try {
            if (pfpFile) finalUrl = await uploadToFaaAPI(pfpFile, setProgress);
            const profileRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
            await updateDoc(profileRef, { photoURL: finalUrl });
            setIsEditingPFP(false); setNewPhotoUrl(finalUrl);
        } catch (error) { setUploadError(error.message); } finally { setIsLoadingPFP(false); }
    };

    const handleUpdateUsername = async () => {
        if (newUsername.trim().length < 3) { setUsernameError('Minimal 3 karakter'); return; }
        try {
            await updateDoc(doc(db, getPublicCollection('userProfiles'), currentUserId), { username: newUsername.trim() });
            // Update nama di postingan lama (opsional/batch)
            setIsEditingUsername(false);
        } catch (error) { setUsernameError('Gagal update'); }
    };

    const isFollowing = profile.following?.includes(currentUserId);

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-2xl mb-8 border border-indigo-100">
                <div className="flex items-start space-x-4">
                    <div className="relative">
                        {photoURL ? <img src={photoURL} className="w-20 h-20 rounded-full object-cover border-4 border-indigo-200"/> : <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-indigo-200">{username.charAt(0).toUpperCase()}</div>}
                        {isSelf && <button onClick={() => setIsEditingPFP(!isEditingPFP)} className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full text-indigo-600 shadow-md"><Edit size={16} /></button>}
                    </div>
                    <div className='flex-grow'>
                         <div className='flex items-center space-x-2'>
                            {isEditingUsername ? <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="text-2xl font-bold border-b"/> : <h1 className="text-3xl font-extrabold">{username}</h1>}
                            {isSelf && <button onClick={() => isEditingUsername ? handleUpdateUsername() : setIsEditingUsername(true)} className="text-gray-500">{isEditingUsername ? <Check size={20}/> : <Edit size={20}/>}</button>}
                        </div>
                        {usernameError && <p className="text-red-500 text-sm">{usernameError}</p>}
                        <p className="text-gray-500 text-sm mt-1">{email}</p>
                    </div>
                    {!isSelf && <button onClick={() => handleFollowToggle(currentUserId, isFollowing)} className={`px-4 py-2 rounded-full font-semibold ${isFollowing ? 'bg-gray-200' : 'bg-indigo-600 text-white'}`}>{isFollowing ? 'Mengikuti' : 'Ikuti'}</button>}
                </div>
                
                {isEditingPFP && isSelf && (
                     <div className="mt-6 pt-4 border-t bg-gray-50 p-4 rounded-xl">
                        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-x-2">
                            <label className="flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 bg-indigo-100 rounded-lg flex-1 w-full"><Image size={20} /><span>{pfpFile ? pfpFile.name : 'Unggah File'}</span><input type="file" accept="image/*" onChange={(e) => {setPfpFile(e.target.files[0]); setUploadError('')}} className="hidden" /></label>
                            <button onClick={handleSavePFP} disabled={isLoadingPFP} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">{isLoadingPFP ? 'Upload...' : 'Simpan'}</button>
                        </div>
                        {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
                    </div>
                )}

                <div className="flex justify-around text-center mt-6 border-t pt-4">
                    <div><p className="text-2xl font-bold">{profile.followers?.length || 0}</p><p className="text-sm">Pengikut</p></div>
                    <div><p className="text-2xl font-bold">{profile.following?.length || 0}</p><p className="text-sm">Mengikuti</p></div>
                    <div><p className="text-2xl font-bold">{userPosts.length}</p><p className="text-sm">Postingan</p></div>
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{isSelf ? 'Postingan Anda' : `Postingan ${username}`}</h2>
            <div className="space-y-6">
                {userPosts.map(post => (
                    <PostItem key={post.id} post={post} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={() => {}} />
                ))}
            </div>
        </div>
    );
};

// --- 11. KOMPONEN PENCARIAN (SearchScreen) ---
const SearchScreen = ({ allPosts, allUsers, profile, handleFollowToggle, goToProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('posts'); 
    const isSearchable = searchTerm.length >= 2;

    const filteredPosts = useMemo(() => {
        if (!isSearchable) return [];
        const term = searchTerm.toLowerCase();
        return allPosts.filter(p => p.title?.toLowerCase().includes(term) || p.content?.toLowerCase().includes(term));
    }, [searchTerm, allPosts, isSearchable]);

    const filteredUsers = useMemo(() => {
        if (!isSearchable) return [];
        const term = searchTerm.toLowerCase();
        return allUsers.filter(u => u.username?.toLowerCase().includes(term) && u.uid !== profile.uid);
    }, [searchTerm, allUsers, profile.uid, isSearchable]);

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Pencarian</h1>
            <div className="relative mb-6">
                <Search size={24} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cari..." className="w-full pl-12 p-3 border rounded-xl shadow-md" />
            </div>
            <div className="flex space-x-4 border-b pb-1 mb-6">
                <button onClick={() => setActiveTab('posts')} className={`pb-2 font-semibold ${activeTab === 'posts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Postingan</button>
                <button onClick={() => setActiveTab('users')} className={`pb-2 font-semibold ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Pengguna</button>
            </div>
            {activeTab === 'posts' ? (
                <div className="space-y-6">{filteredPosts.map(p => <PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />)}</div>
            ) : (
                <div className="space-y-4">{filteredUsers.map(u => (
                    <div key={u.uid} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-md">
                        <div className='flex items-center space-x-3 cursor-pointer' onClick={() => goToProfile(u.uid)}><div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">{u.username.charAt(0).toUpperCase()}</div><p className="font-bold">{u.username}</p></div>
                        <button onClick={() => handleFollowToggle(u.uid, profile.following?.includes(u.uid))} className={`px-3 py-1 rounded-full text-sm ${profile.following?.includes(u.uid) ? 'bg-gray-200' : 'bg-indigo-600 text-white'}`}>{profile.following?.includes(u.uid) ? 'Mengikuti' : 'Ikuti'}</button>
                    </div>
                ))}</div>
            )}
        </div>
    );
};

// --- 12. KOMPONEN UTAMA (App) ---
const App = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null); 
    const [targetProfileId, setTargetProfileId] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [allPosts, setAllPosts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [targetPostId, setTargetPostId] = useState(null); 

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('post');
        if (postId) { setTargetPostId(postId); setPage('view_post'); }
    }, []);

    useEffect(() => {
        const handleInitialAuth = async () => {
            if (initialAuthToken) {
                try { await signInWithCustomToken(auth, initialAuthToken); } catch (error) { console.warn("Auth custom gagal"); }
            } 
        };
        if (!auth.currentUser) handleInitialAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) setCurrentUser(user);
            else { setCurrentUser(null); setProfile(null); }
            setIsAuthChecking(false);
        });
        return unsubscribe; 
    }, []);
    
    useEffect(() => {
        if (!currentUser?.uid) { setProfile(null); return; }
        const unsubscribe = onSnapshot(doc(db, getPublicCollection('userProfiles'), currentUser.uid), (snap) => {
            if (snap.exists()) setProfile({ ...snap.data(), email: currentUser.email, uid: currentUser.uid });
            else setProfile({ username: currentUser.email?.split('@')[0], email: currentUser.email, uid: currentUser.uid, photoURL: '', following: [], followers: [] });
        });
        return unsubscribe;
    }, [currentUser]); 

    useEffect(() => {
        if (isAuthChecking || !currentUser) { setAllPosts([]); setIsLoadingPosts(false); return; } 
        setIsLoadingPosts(true);
        const unsubscribe = onSnapshot(query(collection(db, getPublicCollection('posts'))), async (snapshot) => {
            const fetchedPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp || new Date(0) }));
            const uniqueUserIds = [...new Set(fetchedPosts.map(p => p.userId))];
            if (uniqueUserIds.length === 0) { setAllPosts([]); setIsLoadingPosts(false); return; }
            
            const profileSnaps = await Promise.all(uniqueUserIds.map(uid => uid ? getDoc(doc(db, getPublicCollection('userProfiles'), uid)) : Promise.resolve(null)));
            const profilesMap = profileSnaps.reduce((acc, snap) => { if (snap?.exists()) acc[snap.id] = snap.data(); return acc; }, {});

            setAllPosts(fetchedPosts.map(p => ({ ...p, user: profilesMap[p.userId] || p.user })));
            setIsLoadingPosts(false);
        });
        return unsubscribe;
    }, [isAuthChecking, currentUser]); 
    
     useEffect(() => {
        if (isAuthChecking || !currentUser) return;
        const unsubscribe = onSnapshot(query(collection(db, getPublicCollection('userProfiles'))), (snap) => {
            setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
        });
        return unsubscribe;
    }, [isAuthChecking, currentUser]);

    const handleFollowToggle = async (targetUid, isFollowing) => {
        if (!profile?.uid || targetUid === profile.uid) return;
        try {
            const batch = [
                updateDoc(doc(db, getPublicCollection('userProfiles'), profile.uid), { following: isFollowing ? arrayRemove(targetUid) : arrayUnion(targetUid) }),
                updateDoc(doc(db, getPublicCollection('userProfiles'), targetUid), { followers: isFollowing ? arrayRemove(profile.uid) : arrayUnion(profile.uid) })
            ];
            await Promise.all(batch);
        } catch (error) { console.error("Follow error"); }
    };
    
    const goToProfile = (uid) => {
        if (uid === profile?.uid) { setPage('profile'); setTargetProfileId(null); } 
        else { setTargetProfileId(uid); setPage('other-profile'); }
    };

    const handleLogout = async () => { await signOut(auth); setPage('home'); };

    if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!currentUser) return <AuthScreen onLoginSuccess={() => { setPage(targetPostId ? 'view_post' : 'home'); setIsAuthChecking(true); }} />;
    if (!profile) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const renderPage = () => {
        if (page === 'other-profile' && targetProfileId) {
            const u = allUsers.find(u => u.uid === targetProfileId);
            return u ? <ProfileScreen currentUserId={u.uid} username={u.username} email={u.email} allPosts={allPosts} currentUserEmail={currentUser.email} photoURL={u.photoURL} isSelf={false} handleFollowToggle={handleFollowToggle} profile={profile} /> : <p>User not found</p>;
        }
        if (page === 'view_post' && targetPostId) return <SinglePostView postId={targetPostId} allPosts={allPosts} currentUserId={currentUser.uid} currentUserEmail={currentUser.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} goBack={() => {setPage('home'); setTargetPostId(null);}} />;
        if (page === 'shorts') return <ShortsScreen allPosts={allPosts} currentUserId={currentUser.uid} handleFollowToggle={handleFollowToggle} profile={profile} />;
        if (page === 'create') return <CreatePost setPage={setPage} userId={currentUser.uid} username={profile.username} />;
        if (page === 'profile') return <ProfileScreen currentUserId={currentUser.uid} username={profile.username} email={profile.email} allPosts={allPosts} currentUserEmail={currentUser.email} photoURL={profile.photoURL} isSelf={true} handleFollowToggle={handleFollowToggle} profile={profile} />;
        if (page === 'search') return <SearchScreen allPosts={allPosts} allUsers={allUsers} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />;
        return <HomeScreen currentUserId={currentUser.uid} currentUserEmail={currentUser.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} allPosts={allPosts} isLoadingPosts={isLoadingPosts} />;
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {page !== 'shorts' && (
                <header className="sticky top-0 z-40 bg-white shadow-lg border-b border-gray-200">
                    <div className="max-w-4xl mx-auto px-4 flex justify-between items-center py-3">
                        <h1 className="text-2xl font-bold text-indigo-600 cursor-pointer" onClick={() => setPage('home')}>Sosial Komunitas</h1>
                        <nav className="flex items-center space-x-2 sm:space-x-4">
                            <button onClick={() => setPage('home')} className={`p-2 rounded-full ${page === 'home' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}><Home size={24} /></button>
                            <button onClick={() => setPage('shorts')} className={`p-2 rounded-full ${page === 'shorts' ? 'bg-red-100 text-red-600' : 'text-gray-600'}`}><Film size={24} /></button>
                            <button onClick={() => setPage('search')} className={`p-2 rounded-full ${page === 'search' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}><Search size={24} /></button>
                            <button onClick={() => setPage('create')} className={`p-2 rounded-full ${page === 'create' ? 'bg-green-100 text-green-600' : 'text-gray-600'}`}><PlusCircle size={24} /></button>
                            <button onClick={() => setPage('profile')} className={`p-1 rounded-full ${page === 'profile' ? 'ring-2 ring-indigo-500' : ''}`}>{profile.photoURL ? <img src={profile.photoURL} className="w-8 h-8 rounded-full object-cover"/> : <div className='w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center'>{profile.username.charAt(0).toUpperCase()}</div>}</button>
                        </nav>
                        <button onClick={handleLogout} className="p-2 text-red-500"><LogOut size={24} /></button>
                    </div>
                </header>
            )}
            {page === 'shorts' && <button onClick={() => setPage('home')} className="fixed top-4 left-4 z-[60] bg-white/20 backdrop-blur-md text-white p-2 rounded-full"><ArrowLeft size={28} /></button>}
            <main className={page === 'shorts' ? '' : "max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"}>{renderPage()}</main>
        </div>
    );
};

export default App;