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
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle
} from 'lucide-react';

// Atur log level ke 'warn' agar konsol bersih
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

// --- HELPER NOTIFIKASI (Updated: Terima postId) ---
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
            postId: postId, // Penting untuk redirect
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
        console.error('Upload gagal:', error);
        throw new Error('Gagal mengunggah media. Coba lagi nanti.');
    }
};

// --- 3. UTILITY FUNCTIONS ---
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return { relative: 'Baru saja', full: '' };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const fullDate = date.toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });

    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes}m`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { relative: `${hours}j`, full: fullDate };
    return { relative: fullDate, full: fullDate };
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
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm text-red-600 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- 4. LAYAR OTENTIKASI (Updated UI & Contact Info) ---
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
                if (!username.trim()) throw new Error('Username harus diisi.');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await saveUserProfile(userCredential.user.uid, username.trim(), email);
            }
            onLoginSuccess(); 
        } catch (err) {
            let errorMessage = "Gagal. Periksa email/password.";
            if (err.code === 'auth/email-already-in-use') errorMessage = 'Email sudah terdaftar.';
            else if (err.code === 'auth/wrong-password') errorMessage = 'Password salah.';
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
                <p className="text-center text-gray-500 mb-6 text-sm">Silakan masuk untuk melanjutkan</p>
                
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm rounded flex items-center">
                        <AlertCircle size={16} className="mr-2" />
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

                {/* INFO RESET PASSWORD BARU */}
                {isLogin && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                        <div className="flex items-start space-x-2 text-gray-500 text-xs bg-gray-50 p-3 rounded-lg">
                            <HelpCircle size={24} className="text-indigo-500 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-700 mb-1">Lupa Kata Sandi?</p>
                                <p>Hubungi Admin untuk reset sandi:</p>
                                <p className="font-bold text-indigo-600 flex items-center mt-1">
                                    <Phone size={12} className="mr-1" /> 0827378
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 5. KOMPONEN POSTINGAN (Updated Notification Call) ---
const PostItem = ({ post, currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    // ... Logic post item (SAMA) ...
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
    const isFollowing = profile.following?.includes(post.userId);
    const MAX_LENGTH = 150; // Diperpendek agar UI lebih rapi
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
                // Pass postId untuk redirect
                if (post.userId !== currentUserId) sendNotification(post.userId, 'like', 'menyukai postingan anda.', profile, post.id);
            }
        } catch (error) { console.error("Like err", error); }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        try {
            await navigator.clipboard.writeText(url);
            alert("Link tersalin!");
        } catch (err) { alert("Gagal salin link."); }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await addDoc(collection(db, getPublicCollection('comments')), {
                postId: post.id, userId: currentUserId, text: newComment.trim(), username: profile.username, timestamp: serverTimestamp() 
            });
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { commentsCount: (post.commentsCount || 0) + 1 });
            if (post.userId !== currentUserId) sendNotification(post.userId, 'comment', `mengomentari: "${newComment.trim().substring(0,20)}.."`, profile, post.id);
            setNewComment('');
        } catch (error) { console.error("Comment err", error); }
    };

    const handleUpdatePost = async () => {
        try {
            await updateDoc(doc(db, getPublicCollection('posts'), post.id), { 
                title: editedTitle.trim(), content: editedContent.trim(), mediaUrl: editedMediaUrl.trim(), updatedAt: serverTimestamp() 
            });
            setIsEditing(false);
        } catch (error) { alert("Gagal update."); }
    };

    const handleDelete = async () => {
        if (!isDeleting) { setIsDeleting(true); return; }
        try { await deleteDoc(doc(db, getPublicCollection('posts'), post.id)); } 
        catch (error) { alert("Gagal hapus."); setIsDeleting(false); }
    };

    useEffect(() => {
        if (!showComments) return;
        setIsLoadingComments(true);
        const q = query(collection(db, getPublicCollection('comments')), where('postId', '==', post.id));
        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0) - (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0));
            setComments(list);
            setIsLoadingComments(false);
        });
    }, [showComments, post.id]);

    const isVideo = (post.mediaUrl && (/\.(mp4|webm|ogg|mov)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-gray-100 relative">
             {post.isShort && <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center"><Film size={10} className="mr-1" /> SHORTS</div>}
            
            {/* Header Post */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold cursor-pointer overflow-hidden" onClick={() => goToProfile(post.userId)}>
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : (post.user?.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate cursor-pointer" onClick={() => goToProfile(post.userId)}>{post.user?.username || 'Anonim'}</p>
                        <p className="text-xs text-gray-400">{formattedTime.relative}</p>
                    </div>
                </div>
                <div className='flex space-x-1'>
                    {!isOwner && post.userId !== currentUserId && (
                        <button onClick={() => handleFollowToggle(post.userId, isFollowing)} className={`px-3 py-1 text-xs rounded-full font-bold transition ${isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-600'}`}>
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}
                    {(isOwner || currentUserEmail === DEVELOPER_EMAIL) && (
                        <div className="flex">
                            <button onClick={() => { setIsEditing(true); setIsDeleting(false); }} className="p-1.5 text-gray-400 hover:text-indigo-600"><Edit size={16} /></button>
                            <button onClick={handleDelete} className={`p-1.5 ${isDeleting ? 'text-red-600 bg-red-50 rounded' : 'text-gray-400 hover:text-red-600'}`}>{isDeleting ? <Check size={16} /> : <Trash2 size={16} />}</button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Content */}
            {isEditing ? (
                <div className='space-y-2 mb-3'>
                    <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} placeholder="Judul" className="w-full p-2 border rounded-lg text-sm"/>
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} rows="3" className="w-full p-2 border rounded-lg text-sm"/>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-gray-200 rounded-lg text-xs">Batal</button>
                        <button onClick={handleUpdatePost} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs">Simpan</button>
                    </div>
                </div>
            ) : (
                <>
                    {post.title && <h3 className="font-bold text-gray-800 mb-1">{post.title}</h3>}
                    <div className="mb-3">{renderMarkdown(displayedContent)}
                        {isLongText && <button onClick={() => setShowFullContent(!showFullContent)} className="text-indigo-600 text-xs font-bold ml-1">{showFullContent ? 'Tutup' : 'Baca selengkapnya'}</button>}
                    </div>
                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-3 rounded-xl overflow-hidden bg-black/5 border border-gray-100">
                             {isImage && <img src={post.mediaUrl} className="w-full max-h-[400px] object-cover" />}
                            {isVideo && <video controls src={post.mediaUrl} className="w-full max-h-[400px] object-contain bg-black" />}
                            {mediaEmbed?.type === 'youtube' && (
                                <div className="relative pt-[56.25%]"><iframe src={mediaEmbed.embedUrl} className="absolute top-0 left-0 w-full h-full border-0" allowFullScreen></iframe></div>
                            )}
                             {mediaEmbed?.type === 'link' && <a href={mediaEmbed.displayUrl} target="_blank" className="flex items-center p-3 bg-indigo-50 text-indigo-700 text-sm font-medium hover:underline"><Link size={16} className="mr-2"/>Buka Tautan Eksternal</a>}
                        </div>
                    )}
                </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div className="flex items-center space-x-4">
                    <button onClick={handleLike} className={`flex items-center space-x-1.5 group ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>
                        <Heart size={20} className={`transition transform group-active:scale-125 ${isLiked ? 'fill-current' : ''}`} />
                        <span className="text-xs font-bold">{post.likes?.length || 0}</span>
                    </button>
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 text-gray-500 group">
                        <MessageSquare size={20} className="group-active:scale-110"/>
                        <span className="text-xs font-bold">{post.commentsCount || 0}</span>
                    </button>
                </div>
                <button onClick={handleShare} className="text-gray-400 hover:text-indigo-600"><Share2 size={18} /></button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="mt-3 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-3 max-h-48 overflow-y-auto mb-3 custom-scrollbar">
                        {isLoadingComments ? <Loader2 className="animate-spin mx-auto text-gray-400" size={16}/> : (
                            comments.length > 0 ? comments.map(c => (
                                <div key={c.id} className="flex items-start space-x-2 text-xs">
                                    <span className="font-bold text-gray-800 flex-shrink-0">{c.username}</span>
                                    <span className="text-gray-600">{c.text}</span>
                                </div>
                            )) : <p className="text-center text-xs text-gray-400">Belum ada komentar.</p>
                        )}
                    </div>
                    <form onSubmit={handleComment} className="flex items-center relative">
                        <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="w-full bg-gray-100 rounded-full pl-4 pr-10 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition" />
                        <button type="submit" className="absolute right-1 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50" disabled={!newComment.trim()}><Send size={12} /></button>
                    </form>
                </div>
            )}
        </div>
    );
};


// --- 6. KOMPONEN BUAT POSTINGAN (Simplified) ---
const CreatePost = ({ setPage, userId, username }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState('text'); 
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0); 
    const [isShort, setIsShort] = useState(false);
    const [isLargeFile, setIsLargeFile] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsLargeFile(file.size > 25 * 1024 * 1024);
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
            }

            await addDoc(collection(db, getPublicCollection('posts')), {
                userId, title: title.trim(), content: content.trim(),
                mediaUrl: finalUrl, mediaType: finalType, timestamp: serverTimestamp(),
                likes: [], commentsCount: 0, isShort: isShort, user: { username, uid: userId } 
            });
            
            setTitle(''); setContent(''); setMediaFile(null); setMediaUrl(''); setIsShort(false);
            setPage(isShort ? 'shorts' : 'home');
        } catch (error) { alert(error.message); } 
        finally { setIsLoading(false); }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-3xl shadow-lg border border-indigo-50 mt-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Buat Postingan</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (Opsional)" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-200 transition"/>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Apa yang Anda pikirkan?" rows="5" className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-200 transition resize-none"/>

                {isLoading && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                )}

                <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                    <label className={`flex items-center justify-center px-4 py-2 rounded-xl border cursor-pointer transition whitespace-nowrap flex-1 ${mediaFile ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <Image size={18} className="mr-2" />
                        <span className="text-sm">{mediaFile ? 'Ganti File' : 'Foto/Video'}</span>
                        <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" disabled={isLoading} />
                    </label>
                    
                    {(mediaType === 'video' || mediaUrl.includes('youtube')) && (
                        <div className={`flex items-center justify-center px-4 py-2 rounded-xl border cursor-pointer transition whitespace-nowrap ${isShort ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-600'}`} onClick={() => setIsShort(!isShort)}>
                            <Film size={18} className="mr-2" />
                            <span className="text-sm">{isShort ? 'Mode Shorts' : 'Jadikan Shorts'}</span>
                        </div>
                    )}
                </div>

                <input type="url" value={mediaUrl} onChange={(e) => {setMediaUrl(e.target.value); setMediaType('link'); setMediaFile(null); if(e.target.value.includes('shorts')) setIsShort(true);}} placeholder="Atau tempel link YouTube/Video..." className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm" disabled={isLoading || !!mediaFile} />

                <button type="submit" disabled={isLoading || (!content && !mediaFile && !mediaUrl)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all">
                    {isLoading ? 'Mengirim...' : 'Posting'}
                </button>
            </form>
        </div>
    );
};


// --- 7. KOMPONEN BERANDA (Algoritma Cerdas) ---
const HomeScreen = ({ currentUserId, profile, allPosts, isLoadingPosts, handleFollowToggle, goToProfile }) => {
    // ALGORITMA BERANDA CERDAS
    const feedPosts = useMemo(() => {
        let list = [...allPosts];
        
        // Filter konten Shorts agar tidak memenuhi beranda (opsional, saya keep agar user tau ada konten)
        // Tapi kita urutkan berdasarkan "SKOR"
        
        list.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            
            // Faktor 1: Recency (Semakin baru semakin tinggi skornya)
            // Kita gunakan selisih waktu dalam jam
            const hoursDiff = (timeB - timeA) / 3600000; 

            // Faktor 2: Affinity (Apakah user follow author?)
            const isFollowingA = profile.following?.includes(a.userId) ? 1 : 0;
            const isFollowingB = profile.following?.includes(b.userId) ? 1 : 0;

            // Faktor 3: Engagement (Likes + Comment)
            const engageA = (a.likes?.length || 0) + (a.commentsCount || 0);
            const engageB = (b.likes?.length || 0) + (b.commentsCount || 0);

            // RUMUS ALGORITMA: 
            // Skor = (Affinity * 5000) + (Engagement * 100) + Waktu(Milis)
            // Artinya: Postingan teman di-boost, postingan viral di-boost, tapi yang baru tetap relevan.
            
            const scoreA = (isFollowingA * 10000000) + (engageA * 50000) + timeA;
            const scoreB = (isFollowingB * 10000000) + (engageB * 50000) + timeB;

            return scoreB - scoreA;
        });

        return list.slice(0, 50); // Ambil 50 terbaik
    }, [allPosts, profile.following]);

    return (
        <div className="max-w-lg mx-auto pb-20">
            {isLoadingPosts ? (
                <div className="flex flex-col items-center pt-20"><Loader2 className="animate-spin text-indigo-600" /><p className="text-xs text-gray-400 mt-2">Memuat feed cerdas...</p></div>
            ) : feedPosts.length === 0 ? (
                <div className="text-center p-8 text-gray-400">Belum ada postingan. Jadilah yang pertama!</div>
            ) : (
                feedPosts.map(post => (
                    <PostItem key={post.id} post={post} currentUserId={currentUserId} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />
                ))
            )}
        </div>
    );
};

// --- 8. KOMPONEN SHORTS (Algoritma Cerdas & Auto-Play) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollowToggle, profile }) => {
    // ALGORITMA SHORTS CERDAS
    const shortsFeed = useMemo(() => {
        let videos = allPosts.filter(p => p.isShort === true && p.mediaUrl);
        
        // Shuffle Fisher-Yates untuk variasi, tapi weighted dengan Likes
        // Agar tidak membosankan isinya itu-itu saja
        videos = videos.sort((a, b) => {
            const likesA = a.likes?.length || 0;
            const likesB = b.likes?.length || 0;
            // Kombinasi Popularitas + Randomness
            return (likesB + Math.random() * 5) - (likesA + Math.random() * 5);
        });

        return videos;
    }, [allPosts]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center overflow-hidden pb-16 sm:pb-0">
            <div className="w-full max-w-md h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black">
                {shortsFeed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white p-8 text-center">
                        <Film size={48} className="mb-4 text-gray-500"/>
                        <p className="font-bold">Belum ada video Shorts.</p>
                    </div>
                ) : (
                    shortsFeed.map((post) => (
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
    
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                setIsPlaying(entry.isIntersecting);
                if (videoRef.current) {
                    if (entry.isIntersecting) videoRef.current.play().catch(() => {});
                    else { videoRef.current.pause(); videoRef.current.currentTime = 0; }
                }
            });
        }, { threshold: 0.6 });
        
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
        <div ref={containerRef} className="snap-start w-full h-full relative bg-gray-900 flex items-center justify-center border-b border-gray-800">
            {embedData?.type === 'youtube' ? (
                <div className="w-full h-full relative">
                    {isPlaying ? (
                        <iframe src={`${embedData.embedUrl}&autoplay=1&mute=0&controls=0&loop=1&playlist=${embedData.id}`} className="w-full h-full object-cover pointer-events-auto" allow="autoplay; encrypted-media;" allowFullScreen></iframe>
                    ) : <div className="w-full h-full bg-black flex items-center justify-center text-gray-600"><Film/></div>}
                    <div className="absolute inset-0 bg-transparent pointer-events-none"></div>
                </div>
            ) : (
                <video ref={videoRef} src={post.mediaUrl} className="w-full h-full object-cover" loop playsInline muted={muted} onClick={() => setMuted(!muted)} />
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white pt-20 pointer-events-none">
                <div className="pointer-events-auto mb-2 flex items-center space-x-2">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/50 bg-gray-700">
                        {post.user?.photoURL ? <img src={post.user.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">{post.user?.username?.[0]}</div>}
                    </div>
                    <div>
                        <p className="font-bold text-sm shadow-black drop-shadow-md">{post.user?.username}</p>
                        {!isFollowing && post.userId !== currentUserId && <button onClick={() => handleFollowToggle(post.userId, false)} className="text-[10px] bg-white text-black px-2 py-0.5 rounded font-bold">Ikuti</button>}
                    </div>
                </div>
                <p className="text-sm line-clamp-2 drop-shadow-md mb-16">{post.content}</p>
            </div>

            <div className="absolute right-2 bottom-24 flex flex-col items-center space-y-4 pointer-events-auto z-10">
                <button onClick={handleLike} className="flex flex-col items-center">
                    <div className={`p-2.5 rounded-full bg-white/10 backdrop-blur-md ${isLiked ? 'text-red-500' : 'text-white'}`}><Heart size={24} fill={isLiked ? 'currentColor' : 'none'} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.likes?.length || 0}</span>
                </button>
                <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
                    <div className="p-2.5 rounded-full bg-white/10 backdrop-blur-md text-white"><MessageSquare size={24} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">{post.commentsCount || 0}</span>
                </button>
                 <button onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`);alert('Link Shorts Disalin!');}catch(e){}}} className="flex flex-col items-center">
                    <div className="p-2.5 rounded-full bg-white/10 backdrop-blur-md text-white"><Share2 size={24} /></div>
                    <span className="text-xs font-bold mt-1 shadow-black drop-shadow-md">Share</span>
                </button>
            </div>

            {showComments && (
                <div className="absolute inset-0 z-20 flex items-end bg-black/60 backdrop-blur-sm pointer-events-auto">
                    <div className="w-full h-[60%] bg-white rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200">
                        <div className="flex justify-between items-center mb-2 border-b pb-2">
                            <p className="font-bold text-gray-800 text-sm">Komentar ({post.commentsCount})</p>
                            <button onClick={() => setShowComments(false)}><X size={20} className="text-gray-500"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 mb-2">
                            {comments.map(c => (
                                <div key={c.id} className="text-xs">
                                    <span className="font-bold mr-1">{c.username}</span>
                                    <span className="text-gray-700">{c.text}</span>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handlePostComment} className="flex space-x-2 border-t pt-2">
                            <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Tulis..." className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-xs"/>
                            <button type="submit" disabled={!newComment} className="text-indigo-600 font-bold text-xs">Kirim</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 9. NOTIFIKASI PINTAR (Redirect & Auto-Remove) ---
const NotificationScreen = ({ userId, setPage, setTargetPostId, setTargetProfileId }) => {
    const [notifications, setNotifications] = useState([]);
    
    useEffect(() => {
        const q = query(
            collection(db, getPublicCollection('notifications')), 
            where('toUserId', '==', userId),
            // Kita hanya ambil yang belum dibaca agar list bersih (sesuai request)
            // Atau ambil semua tapi diurutkan. Request user: "Kalau sudah dibaca selesai tidak ada lagi"
            // Jadi kita filter isRead == false di UI atau query
            orderBy('timestamp', 'desc'),
            limit(30)
        );
        return onSnapshot(q, (snapshot) => {
            // Filter lokal untuk isRead false agar responsif
            const unread = snapshot.docs.map(d => ({id: d.id, ...d.data()})).filter(n => !n.isRead);
            setNotifications(unread);
        });
    }, [userId]);

    const handleNotificationClick = async (notif) => {
        // 1. Tandai sudah dibaca (akan hilang dari list karena filter di atas)
        try {
            await updateDoc(doc(db, getPublicCollection('notifications'), notif.id), { isRead: true });
        } catch (e) { console.error(e); }

        // 2. Redirect Cerdas
        if (notif.type === 'follow') {
            setTargetProfileId(notif.fromUserId);
            setPage('other-profile');
        } else if ((notif.type === 'like' || notif.type === 'comment') && notif.postId) {
            setTargetPostId(notif.postId);
            setPage('view_post');
        }
    };

    return (
        <div className="max-w-lg mx-auto p-4 pb-20">
            <h1 className="text-xl font-bold mb-4">Notifikasi Baru</h1>
            {notifications.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                    <Bell size={48} className="mx-auto mb-2 opacity-20"/>
                    <p>Tidak ada notifikasi baru.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map(notif => (
                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="flex items-center p-3 bg-white rounded-xl border border-indigo-50 shadow-sm active:scale-95 transition cursor-pointer hover:bg-gray-50">
                            <div className="mr-3 relative">
                                {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-10 h-10 rounded-full object-cover"/> : <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">{notif.fromUsername?.[0]}</div>}
                                {notif.type === 'like' && <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-white"><Heart size={10} fill="white"/></div>}
                                {notif.type === 'comment' && <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white"><MessageSquare size={10} fill="white"/></div>}
                                {notif.type === 'follow' && <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white"><UserPlus size={10}/></div>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-800 leading-tight">
                                    <span className="font-bold">{notif.fromUsername}</span> {notif.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(notif.timestamp).relative}</p>
                            </div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- 10. KOMPONEN LAIN (Profile, Search, SingleView) - Disederhanakan untuk Layout Baru ---
const ProfileScreen = ({ currentUserId, username, email, allPosts, currentUserEmail, photoURL, isSelf, handleFollowToggle, profile }) => {
    // ... (Isi logic sama, hanya adjustment padding bottom untuk nav bar) ...
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
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-6 mx-4">
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-3">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-50">
                            {photoURL ? <img src={photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-3xl">{username?.[0]}</div>}
                        </div>
                        {isSelf && <button onClick={() => setIsEditingPFP(!isEditingPFP)} className="absolute bottom-0 right-0 p-1.5 bg-white text-indigo-600 rounded-full shadow border border-gray-100"><Edit size={14}/></button>}
                    </div>
                    
                    {isEditingUsername ? (
                        <div className="flex items-center space-x-2 mb-1">
                            <input value={newUsername} onChange={e=>setNewUsername(e.target.value)} className="border-b border-indigo-500 text-center font-bold text-xl focus:outline-none"/>
                            <button onClick={handleSaveUsername}><Check size={20} className="text-green-500"/></button>
                        </div>
                    ) : (
                        <h1 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
                            {username} 
                            {isSelf && <Edit size={14} className="text-gray-400 cursor-pointer" onClick={()=>setIsEditingUsername(true)}/>}
                        </h1>
                    )}
                    <p className="text-gray-500 text-xs mb-4">{email}</p>

                    {!isSelf && (
                        <button onClick={() => handleFollowToggle(currentUserId, isFollowing)} className={`px-6 py-2 rounded-full font-bold text-sm transition ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}

                    <div className="flex w-full justify-center space-x-8 mt-6 pt-6 border-t border-gray-50">
                        <div><span className="block font-bold text-lg text-gray-800">{profile.followers?.length || 0}</span><span className="text-xs text-gray-400">Pengikut</span></div>
                        <div><span className="block font-bold text-lg text-gray-800">{profile.following?.length || 0}</span><span className="text-xs text-gray-400">Mengikuti</span></div>
                        <div><span className="block font-bold text-lg text-gray-800">{userPosts.length}</span><span className="text-xs text-gray-400">Post</span></div>
                    </div>
                </div>
                
                {isEditingPFP && isSelf && (
                    <div className="mt-4 p-3 bg-indigo-50 rounded-xl flex items-center gap-2 animate-in fade-in">
                        <input type="file" className="text-xs w-full" onChange={e=>setPfpFile(e.target.files[0])}/>
                        <button onClick={handleSavePFP} disabled={isLoadingPFP} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{isLoadingPFP ? '...' : 'Simpan'}</button>
                    </div>
                )}
            </div>
            
            <div className="px-4 space-y-4">
                <h3 className="font-bold text-gray-800">Postingan</h3>
                {userPosts.map(p => <PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={()=>{}} />)}
            </div>
        </div>
    );
};

const SearchScreen = ({ allPosts, allUsers, profile, handleFollowToggle, goToProfile }) => {
    const [term, setTerm] = useState('');
    const [tab, setTab] = useState('posts');
    
    const resPosts = allPosts.filter(p => p.content?.toLowerCase().includes(term.toLowerCase()));
    const resUsers = allUsers.filter(u => u.username?.toLowerCase().includes(term.toLowerCase()) && u.uid !== profile.uid);

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-3 text-gray-400" size={20}/>
                <input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari sesuatu..." className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"/>
            </div>
            
            <div className="flex mb-4 bg-gray-100 p-1 rounded-xl">
                <button onClick={()=>setTab('posts')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${tab==='posts' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Postingan</button>
                <button onClick={()=>setTab('users')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${tab==='users' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Orang</button>
            </div>

            {term.length < 2 ? <div className="text-center text-gray-400 mt-10">Ketik minimal 2 huruf</div> : (
                tab === 'posts' ? (
                    resPosts.map(p => <PostItem key={p.id} post={p} currentUserId={profile.uid} currentUserEmail={profile.email} profile={profile} handleFollowToggle={handleFollowToggle} goToProfile={goToProfile} />)
                ) : (
                    resUsers.map(u => (
                        <div key={u.uid} className="flex justify-between items-center bg-white p-3 rounded-xl mb-2 shadow-sm">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={()=>goToProfile(u.uid)}>
                                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">{u.username[0]}</div>
                                <span className="font-bold text-gray-800">{u.username}</span>
                            </div>
                            <button onClick={()=>handleFollowToggle(u.uid, profile.following?.includes(u.uid))} className="text-xs bg-gray-100 px-3 py-1.5 rounded-full font-bold">{profile.following?.includes(u.uid) ? 'Followed' : 'Follow'}</button>
                        </div>
                    ))
                )
            )}
        </div>
    );
};

const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return <div className="p-10 text-center">Post tidak ditemukan <button onClick={goBack} className="text-indigo-600 block mx-auto mt-4">Kembali</button></div>;
    return <div className="max-w-lg mx-auto p-4 pb-20"><button onClick={goBack} className="mb-4 flex items-center font-bold text-gray-600"><ArrowLeft size={18} className="mr-2"/> Kembali</button><PostItem post={post} {...props}/></div>;
};

// --- 11. STRUKTUR APLIKASI UTAMA (NAVBAR TERPISAH) ---
const App = () => {
    const [currentUser, setCurrentUser] = useState(undefined); // Undefined = Loading awal
    const [profile, setProfile] = useState(null); 
    const [targetProfileId, setTargetProfileId] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [allPosts, setAllPosts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [targetPostId, setTargetPostId] = useState(null); 
    const [notifCount, setNotifCount] = useState(0);

    // CEGAH LOADING LOOPING: Gunakan flag init
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) setCurrentUser(user);
            else { setCurrentUser(null); setProfile(null); }
        });
        return unsubscribe; 
    }, []);

    // Load Profile
    useEffect(() => {
        if (!currentUser) return;
        return onSnapshot(doc(db, getPublicCollection('userProfiles'), currentUser.uid), (snap) => {
            if (snap.exists()) setProfile({ ...snap.data(), email: currentUser.email, uid: currentUser.uid });
            else {
                // Auto create profile if missing
                setDoc(doc(db, getPublicCollection('userProfiles'), currentUser.uid), {
                    username: currentUser.email.split('@')[0], email: currentUser.email, uid: currentUser.uid,
                    following: [], followers: [], photoURL: ''
                });
            }
        });
    }, [currentUser]);

    // Load Data (Posts & Users)
    useEffect(() => {
        if (!currentUser) return;
        
        // Notif Count
        const unsubNotif = onSnapshot(query(collection(db, getPublicCollection('notifications')), where('toUserId', '==', currentUser.uid), where('isRead', '==', false)), 
            (snap) => setNotifCount(snap.size));

        // Posts
        const unsubPosts = onSnapshot(query(collection(db, getPublicCollection('posts'))), async (snapshot) => {
            const rawPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Fetch User Data for each post efficiently
            const uids = [...new Set(rawPosts.map(p => p.userId))];
            const userSnaps = await Promise.all(uids.map(uid => getDoc(doc(db, getPublicCollection('userProfiles'), uid))));
            const userMap = {};
            userSnaps.forEach(s => { if(s.exists()) userMap[s.id] = s.data(); });
            
            setAllPosts(rawPosts.map(p => ({ ...p, user: userMap[p.userId] || p.user })));
        });

        // Users (For Search)
        const unsubUsers = onSnapshot(collection(db, getPublicCollection('userProfiles')), (snap) => {
            setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
        });

        return () => { unsubNotif(); unsubPosts(); unsubUsers(); };
    }, [currentUser]);

    // Notifikasi Rutin
    useEffect(() => {
        if (!currentUser) return;
        const now = new Date();
        const key = `dailyPrompt_${now.getDate()}`;
        if (now.getHours() === 5 && !localStorage.getItem(key)) {
            sendNotification(currentUser.uid, 'system', 'Selamat pagi! Sudah posting hari ini?', {uid:'sys', username:'System'});
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

    if (currentUser === undefined) return <div className="h-screen flex items-center justify-center text-indigo-600"><Loader2 className="animate-spin" size={40}/></div>;
    if (!currentUser) return <AuthScreen onLoginSuccess={() => {}} />;
    if (!profile) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin"/></div>;

    // --- UI LAYOUT (SPLIT NAVBAR) ---
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* 1. TOP NAVBAR (Fixed Top) - Hilang di mode Shorts agar immersive */}
            {page !== 'shorts' && (
                <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-40 border-b border-gray-200 px-4 h-14 flex items-center justify-between shadow-sm max-w-lg mx-auto">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setPage('home')}>
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic">E</div>
                        <span className="font-extrabold text-lg text-indigo-900 tracking-tight">Eduku</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setPage('notifications')} className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                            <Bell size={22} />
                            {notifCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                        </button>
                        <button onClick={handleLogout} className="p-2 text-red-400 hover:bg-red-50 rounded-full"><LogOut size={20}/></button>
                    </div>
                </header>
            )}

            {/* 2. MAIN CONTENT (Padding menyesuaikan navbar) */}
            <main className={`min-h-screen max-w-lg mx-auto ${page !== 'shorts' ? 'pt-16' : ''}`}>
                {page === 'home' && <HomeScreen currentUserId={currentUser.uid} profile={profile} allPosts={allPosts} isLoadingPosts={false} handleFollowToggle={handleFollow} goToProfile={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} />}
                {page === 'shorts' && (
                    <>
                        <button onClick={()=>setPage('home')} className="fixed top-4 left-4 z-[60] bg-white/20 backdrop-blur p-2 rounded-full text-white"><ArrowLeft/></button>
                        <ShortsScreen allPosts={allPosts} currentUserId={currentUser.uid} handleFollowToggle={handleFollow} profile={profile} />
                    </>
                )}
                {page === 'create' && <CreatePost setPage={setPage} userId={currentUser.uid} username={profile.username} />}
                {page === 'search' && <SearchScreen allPosts={allPosts} allUsers={allUsers} profile={profile} handleFollowToggle={handleFollow} goToProfile={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} />}
                {page === 'notifications' && <NotificationScreen userId={currentUser.uid} setPage={setPage} setTargetPostId={setTargetPostId} setTargetProfileId={(uid)=>{setTargetProfileId(uid); setPage('other-profile');}} />}
                {page === 'profile' && <ProfileScreen currentUserId={currentUser.uid} username={profile.username} email={profile.email} allPosts={allPosts} photoURL={profile.photoURL} isSelf={true} handleFollowToggle={handleFollow} profile={profile} />}
                {page === 'other-profile' && <ProfileScreen currentUserId={targetProfileId} username={allUsers.find(u=>u.uid===targetProfileId)?.username} email={''} allPosts={allPosts} photoURL={allUsers.find(u=>u.uid===targetProfileId)?.photoURL} isSelf={false} handleFollowToggle={handleFollow} profile={profile} />}
                {page === 'view_post' && <SinglePostView postId={targetPostId} allPosts={allPosts} currentUserId={currentUser.uid} profile={profile} handleFollowToggle={handleFollow} goToProfile={()=>{}} goBack={()=>setPage('home')} />}
            </main>

            {/* 3. BOTTOM NAVBAR (Fixed Bottom) - Navigasi Utama */}
            {page !== 'shorts' && (
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 z-40 max-w-lg mx-auto flex justify-around items-center px-2 pb-1">
                    <NavBtn icon={Home} label="Home" isActive={page === 'home'} onClick={() => setPage('home')} />
                    <NavBtn icon={Search} label="Cari" isActive={page === 'search'} onClick={() => setPage('search')} />
                    
                    {/* Tombol Plus Tengah Menonjol */}
                    <div className="relative -top-5">
                        <button onClick={() => setPage('create')} className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-300 transform active:scale-90 transition">
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

// Helper Nav Button
const NavBtn = ({ icon: Icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-full transition ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'fill-indigo-50' : ''} />
        <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
);

export default App;