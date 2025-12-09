import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ===========================================
// BAGIAN 1: IMPORT LIBRARIES & KONFIGURASI
// ===========================================

import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    GoogleAuthProvider,
    signInWithPopup,
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
    limit,
    increment,
    writeBatch
} from 'firebase/firestore';

// IMPORT KHUSUS NOTIFIKASI
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image as ImageIcon, Loader2, Link as LinkIcon, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft, AlertTriangle, Bell, Phone, HelpCircle,
    RefreshCw, Info, Clock, Star, ExternalLink, Gamepad2, BookOpen, Users, Globe,
    Settings, Shield, Zap, TrendingDown, Eye, MinusCircle, UserX, Ban, UserCog,
    Moon
} from 'lucide-react';


// ===========================================
// BAGIAN 2: KONSTANTA GLOBAL DAN SETUP FIREBASE
// ===========================================

// VARIABEL GLOBAL WAJIB DARI ENV CANVAS
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let firebaseApp;
let db;
let auth;
let messaging;

// Inisialisasi Firebase dilakukan di dalam komponen App.
// Agar kode tetap berada dalam satu file.

// Daftar Admin ID untuk akses Developer Dashboard
// Gantilah dengan UID Developer yang sebenarnya
const DEVELOPER_ADMIN_IDS = [
    'uL4PqR7sT9yX2aB5cE8fG1hJ3kM6nO0p' // Contoh Placeholder UID
    // Tambahkan UID developer lain di sini
];

// ===========================================
// BAGIAN 3: UTILITAS (FUNGSI PEMBANTU)
// ===========================================

// Fungsi utilitas untuk format tanggal
const formatTimeAgo = (timestamp) => {
    if (!timestamp?.seconds) return 'Baru saja';
    const now = new Date();
    const past = new Date(timestamp.seconds * 1000);
    const diff = now - past;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return past.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    if (days > 0) return `${days} hari lalu`;
    if (hours > 0) return `${hours} jam lalu`;
    if (minutes > 0) return `${minutes} menit lalu`;
    return 'Baru saja';
};

// Fungsi utilitas untuk format angka
const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
};

// Fungsi untuk mengekstrak ID media dari URL (YouTube, Instagram, TikTok)
const extractMediaId = (url) => {
    // 1. YouTube
    let match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
    if (match) return { type: 'youtube', id: match[1] };

    // 2. Instagram (Asumsi link postingan biasa)
    // Cukup sulit mendapatkan embed ID dari link biasa tanpa API,
    // tapi kita ambil slug sebagai identifikasi.
    match = url.match(/(?:instagram\.com\/p\/|instagram\.com\/reel\/)([\w-]+)/);
    if (match) return { type: 'instagram', id: match[1] };

    // 3. TikTok (Asumsi link postingan biasa)
    // Ambil ID video numerik atau username/video_id slug
    match = url.match(/(?:tiktok\.com\/@[\w-]+\/video\/|vm\.tiktok\.com\/)(\d+)/);
    if (match) return { type: 'tiktok', id: match[1] };
    
    match = url.match(/(?:tiktok\.com\/t\/)([\w-]+)/);
    if (match) return { type: 'tiktok', id: match[1] };

    return null;
};

// ===========================================
// BAGIAN 4: KOMPONEN UI DASAR & MODAL
// ===========================================

// Komponen Input Kustom
const Input = ({ label, type = 'text', value, onChange, placeholder, icon: Icon, disabled = false }) => (
    <div className="relative mb-4">
        {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
        <div className="relative rounded-lg shadow-sm">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
            )}
            <input
                type={type}
                className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-800 dark:text-white transition ${Icon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
        </div>
    </div>
);

// Komponen Tombol Utama
const Button = ({ children, onClick, disabled = false, loading = false, variant = 'primary', icon: Icon }) => {
    let baseStyle = "flex items-center justify-center space-x-2 px-4 py-2 rounded-full font-semibold transition duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2";
    let colorStyle = "";

    switch (variant) {
        case 'primary':
            colorStyle = "bg-sky-500 text-white hover:bg-sky-600 focus:ring-sky-500";
            break;
        case 'secondary':
            colorStyle = "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600";
            break;
        case 'danger':
            colorStyle = "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500";
            break;
        case 'outline':
            colorStyle = "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700";
            break;
        default:
            colorStyle = "bg-sky-500 text-white hover:bg-sky-600 focus:ring-sky-500";
    }

    if (disabled || loading) {
        colorStyle = "bg-gray-400 text-gray-100 cursor-not-allowed";
    }

    return (
        <button
            className={`${baseStyle} ${colorStyle}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon && <Icon className="w-5 h-5" />}
            {children}
        </button>
    );
};

// Komponen Modal Kustom
const Modal = ({ title, isOpen, onClose, children, size = 'md' }) => {
    if (!isOpen) return null;

    let maxWidth = 'max-w-md';
    if (size === 'lg') maxWidth = 'max-w-lg';
    if (size === 'xl') maxWidth = 'max-w-xl';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full ${maxWidth} transform transition-all duration-300 scale-100 opacity-100`}
                onClick={e => e.stopPropagation()} // Mencegah klik modal menutup
            >
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-5">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Komponen Pesan Notifikasi/Toast
const Toast = ({ message, type = 'info', onClose }) => {
    const iconMap = {
        info: <Info className="w-5 h-5 text-sky-400" />,
        success: <Check className="w-5 h-5 text-green-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    };

    const colorMap = {
        info: 'bg-sky-50 border-sky-400 dark:bg-sky-900/30',
        success: 'bg-green-50 border-green-400 dark:bg-green-900/30',
        error: 'bg-red-50 border-red-400 dark:bg-red-900/30',
        warning: 'bg-yellow-50 border-yellow-400 dark:bg-yellow-900/30',
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (onClose) onClose();
        }, 5000); // Tutup otomatis setelah 5 detik
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 z-50 p-4 border-l-4 rounded-lg shadow-xl max-w-sm transition-all duration-300 transform translate-y-0 opacity-100 ${colorMap[type]} dark:border-opacity-60`}>
            <div className="flex items-start space-x-3">
                {iconMap[type]}
                <div className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {message}
                </div>
                <button onClick={onClose} className="p-1 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};


// ===========================================
// BAGIAN 5: KOMPONEN KHUSUS APLIKASI
// ===========================================

// --- Komponen Media Embed (Diperbarui untuk 3 platform) ---
const MediaEmbed = ({ url }) => {
    const media = useMemo(() => extractMediaId(url), [url]);

    if (!media) {
        return (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
                <AlertTriangle size={20} className="inline mr-2" />
                URL media tidak valid atau tidak didukung: {url}
            </div>
        );
    }

    // Embed URL standar untuk YouTube
    if (media.type === 'youtube') {
        const embedUrl = `https://www.youtube.com/embed/${media.id}?rel=0`;
        return (
            <div className="relative pt-[56.25%] overflow-hidden rounded-lg shadow-xl">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={embedUrl}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Embedded YouTube Video"
                ></iframe>
            </div>
        );
    }

    // Embed URL untuk TikTok
    if (media.type === 'tiktok') {
        // TikTok membutuhkan embedding melalui skrip atau iframe yang lebih kompleks.
        // Untuk penyederhanaan dalam 1-file React, kita pakai iframe dasar.
        // Catatan: Ini mungkin tidak selalu berfungsi dengan baik tanpa skrip eksternal TikTok.
        const embedUrl = `https://www.tiktok.com/embed/v2/${media.id}`;
        return (
             <div className="relative pt-[120%] overflow-hidden rounded-lg shadow-xl max-w-md mx-auto">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={embedUrl}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Embedded TikTok Video"
                ></iframe>
            </div>
        );
    }

    // Embed URL untuk Instagram
    if (media.type === 'instagram') {
        // Sama seperti TikTok, Instagram membutuhkan skrip eksternal.
        // Kita gunakan iframe dengan link yang meniru tampilan embed.
        const embedUrl = `https://www.instagram.com/p/${media.id}/embed/captioned/`;
        return (
            <div className="relative pt-[100%] overflow-hidden rounded-lg shadow-xl max-w-md mx-auto">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={embedUrl}
                    frameBorder="0"
                    allowTransparency="true"
                    allowFullScreen
                    title="Embedded Instagram Post"
                ></iframe>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
            <AlertCircle size={20} className="inline mr-2" />
            Format URL tidak didukung untuk embedding.
        </div>
    );
};

// --- Komponen Postingan ---
const PostCard = ({ post, user, db, onShare, showToast }) => {
    const isOwner = user && user.uid === post.userId;
    const [isLiking, setIsLiking] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Cek apakah user sudah like
    const isLiked = user && post.likes.includes(user.uid);
    
    // Ambil data user dari post
    const postUser = post.userInfo || { displayName: 'Pengguna Anonim', photoURL: 'https://placehold.co/150x150/cccccc/333333?text=A', userId: 'unknown' };

    const handleLike = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);
        try {
            const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
            if (isLiked) {
                // Unlike
                await updateDoc(postRef, {
                    likes: arrayRemove(user.uid),
                    likeCount: increment(-1)
                });
            } else {
                // Like
                await updateDoc(postRef, {
                    likes: arrayUnion(user.uid),
                    likeCount: increment(1)
                });
            }
        } catch (error) {
            console.error("Gagal update like:", error);
            showToast('Gagal mengubah status suka.', 'error');
        } finally {
            setIsLiking(false);
        }
    };

    const handleDelete = async () => {
        if (!isOwner || isDeleting) return;
        if (!window.confirm("Apakah Anda yakin ingin menghapus postingan ini?")) return;

        setIsDeleting(true);
        try {
            // Gunakan batch untuk menghapus post dan komentarnya
            const batch = writeBatch(db);
            const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
            batch.delete(postRef);

            // Opsional: Hapus semua komentar terkait (lebih efisien dengan Cloud Functions,
            // tapi kita lakukan di klien di sini)
            const commentsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), where('postId', '==', post.id));
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            showToast('Postingan berhasil dihapus!', 'success');
        } catch (error) {
            console.error("Gagal menghapus postingan:", error);
            showToast('Gagal menghapus postingan. Coba lagi.', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 transition-all duration-300">
            {/* Header Post */}
            <div className="flex items-center p-4">
                <img 
                    src={postUser.photoURL} 
                    alt={postUser.displayName} 
                    className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-sky-400"
                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
                />
                <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">{postUser.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        @{postUser.userId.substring(0, 8)} • {formatTimeAgo(post.timestamp)}
                    </p>
                </div>
                {isOwner && (
                    <Button variant="danger" icon={Trash2} onClick={handleDelete} loading={isDeleting}>
                        Hapus
                    </Button>
                )}
            </div>

            {/* Konten Post */}
            <div className="px-4 pb-4">
                <p className="text-gray-800 dark:text-gray-200 mb-4 whitespace-pre-wrap">
                    {post.content}
                </p>

                {/* Media Embed/Image */}
                {post.mediaUrl && (
                    <div className="my-4">
                        <MediaEmbed url={post.mediaUrl} />
                    </div>
                )}
                {post.imageUrl && (
                    <img 
                        src={post.imageUrl} 
                        alt="Post Media" 
                        className="w-full object-cover rounded-lg shadow-md max-h-96"
                        onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/dddddd/555555?text=Gambar+Gagal+Dimuat" }}
                    />
                )}
            </div>

            {/* Aksi Post */}
            <div className="flex justify-around items-center border-t border-gray-200 dark:border-gray-700 p-3">
                {/* Tombol Like */}
                <button 
                    onClick={handleLike} 
                    disabled={isLiking || !user}
                    className={`flex items-center space-x-2 p-2 rounded-full transition duration-300 ${isLiked ? 'text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/30' : 'text-gray-500 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    {isLiking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />}
                    <span className="font-medium text-sm">{formatNumber(post.likeCount)}</span>
                </button>

                {/* Tombol Komentar */}
                <button 
                    onClick={() => onShare(post)} 
                    className="flex items-center space-x-2 text-gray-500 hover:text-sky-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-full transition duration-300"
                >
                    <MessageSquare size={20} />
                    <span className="font-medium text-sm">{formatNumber(post.commentCount || 0)}</span>
                </button>

                {/* Tombol Bagikan */}
                <button 
                    onClick={() => onShare(post)} 
                    className="flex items-center space-x-2 text-gray-500 hover:text-purple-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-full transition duration-300"
                >
                    <Share2 size={20} />
                </button>
            </div>
        </div>
    );
};

// --- Komponen Detail Postingan/Share Modal ---
const ShareModal = ({ post, user, db, onClose, showToast }) => {
    const [commentContent, setCommentContent] = useState('');
    const [comments, setComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const postUser = post.userInfo || { displayName: 'Pengguna Anonim', photoURL: 'https://placehold.co/150x150/cccccc/333333?text=A', userId: 'unknown' };
    
    // Ambil komentar real-time
    useEffect(() => {
        if (!post?.id) return;
        setIsLoading(true);
        const commentsCol = collection(db, 'artifacts', appId, 'public', 'data', 'comments');
        const q = query(
            commentsCol,
            where('postId', '==', post.id),
            orderBy('timestamp', 'asc') // Urutkan berdasarkan waktu
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setComments(fetchedComments);
            setIsLoading(false);
        }, (error) => {
            console.error("Gagal mendapatkan komentar:", error);
            showToast('Gagal memuat komentar.', 'error');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, post.id, showToast]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!user || !commentContent.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const commentData = {
                postId: post.id,
                userId: user.uid,
                content: commentContent.trim(),
                timestamp: serverTimestamp(),
                userInfo: {
                    displayName: user.displayName || 'Anonim',
                    photoURL: user.photoURL || 'https://placehold.co/150x150/cccccc/333333?text=A',
                    userId: user.uid
                }
            };

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), commentData);
            
            // Tambahkan hitungan komentar di postingan
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), {
                commentCount: increment(1)
            });

            setCommentContent('');
            showToast('Komentar berhasil ditambahkan!', 'success');
        } catch (error) {
            console.error("Gagal submit komentar:", error);
            showToast('Gagal mengirim komentar.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCopyLink = () => {
        const link = `${window.location.origin}?post=${post.id}`;
        navigator.clipboard.writeText(link)
            .then(() => showToast('Link postingan disalin!', 'success'))
            .catch(() => showToast('Gagal menyalin link.', 'error'));
    };

    const CommentItem = ({ comment }) => (
        // PERBAIKAN: Tambahkan background dan kontras teks yang jelas
        <div className="flex space-x-3 p-3 mb-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <img 
                src={comment.userInfo?.photoURL || 'https://placehold.co/150x150/cccccc/333333?text=A'} 
                alt={comment.userInfo?.displayName || 'Anonim'} 
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
            />
            <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {comment.userInfo?.displayName || 'Anonim'}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                        {formatTimeAgo(comment.timestamp)}
                    </span>
                </p>
                {/* PERBAIKAN: Pastikan teks konten memiliki kontras yang baik */}
                <p className="text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-wrap">{comment.content}</p>
            </div>
        </div>
    );

    return (
        <Modal 
            title="Detail Postingan & Komentar" 
            isOpen={!!post} 
            onClose={onClose} 
            size="lg"
        >
            <div className="max-h-[80vh] overflow-y-auto">
                {/* Postingan Utama (Mini Card) */}
                <div className="bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700 rounded-xl mb-4 shadow-inner">
                    <div className="flex items-start mb-3">
                        <img 
                            src={postUser.photoURL} 
                            alt={postUser.displayName} 
                            className="w-10 h-10 rounded-full object-cover mr-3"
                            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
                        />
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">{postUser.displayName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimeAgo(post.timestamp)}
                            </p>
                        </div>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{post.content}</p>
                    {post.mediaUrl && (
                        <div className="my-3">
                            <MediaEmbed url={post.mediaUrl} />
                        </div>
                    )}
                    {post.imageUrl && (
                        <img 
                            src={post.imageUrl} 
                            alt="Post Media" 
                            className="w-full object-cover rounded-lg mt-2 max-h-64"
                            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/dddddd/555555?text=Gambar+Gagal+Dimuat" }}
                        />
                    )}
                    <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t dark:border-gray-700">
                        <span>{formatNumber(post.likeCount || 0)} Suka</span>
                        <span>{formatNumber(post.commentCount || 0)} Komentar</span>
                        <Button variant="outline" icon={LinkIcon} onClick={handleCopyLink} size="sm">
                            Salin Link
                        </Button>
                    </div>
                </div>

                {/* Bagian Komentar */}
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Komentar ({comments.length})</h4>
                
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Memuat komentar...
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4 border rounded-lg dark:border-gray-700">
                        Belum ada komentar. Jadilah yang pertama!
                    </p>
                ) : (
                    <div>
                        {comments.map(comment => (
                            <CommentItem key={comment.id} comment={comment} />
                        ))}
                    </div>
                )}
            </div>

            {/* Form Komentar */}
            {user ? (
                <div className="mt-4 border-t pt-4 border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 p-0">
                    <form onSubmit={handleCommentSubmit} className="flex space-x-3">
                        <textarea
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            placeholder="Tulis komentar Anda..."
                            rows="2"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-800 dark:text-white transition"
                            disabled={isSubmitting}
                        />
                        <Button 
                            type="submit" 
                            variant="primary" 
                            icon={Send} 
                            loading={isSubmitting} 
                            disabled={!commentContent.trim()}
                        >
                            Kirim
                        </Button>
                    </form>
                </div>
            ) : (
                 <p className="text-center mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg">
                    <LogIn size={16} className="inline mr-2"/>
                    Silakan masuk untuk berkomentar.
                </p>
            )}
        </Modal>
    );
};

// --- Komponen Auth Modal ---
const AuthModal = ({ onClose, initialMode = 'login' }) => {
    const [mode, setMode] = useState(initialMode); // 'login' atau 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            onClose();
        } catch (err) {
            setError(err.message.includes('popup-closed') ? 'Pop-up ditutup.' : `Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('Fitur ini belum diimplementasikan. Silakan gunakan Login Google.');
        // Logika Sign In Email/Password akan ada di sini
    };
    
    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('Fitur ini belum diimplementasikan. Silakan gunakan Login Google.');
        // Logika Sign Up Email/Password akan ada di sini
    };

    const isLogin = mode === 'login';

    return (
        <Modal 
            title={isLogin ? 'Masuk ke Aplikasi' : 'Daftar Akun Baru'} 
            isOpen={true} 
            onClose={onClose}
        >
            <form onSubmit={isLogin ? handleSignIn : handleSignUp}>
                {error && (
                    <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/30 dark:border-red-600 dark:text-red-300 flex items-center">
                        <AlertCircle size={20} className="mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}
                
                {/* <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" icon={Mail} disabled={isLoading}/>
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" icon={Lock} disabled={isLoading}/>

                <Button type="submit" variant="primary" loading={isLoading} icon={isLogin ? LogIn : UserPlus} disabled={isLoading}>
                    {isLogin ? 'Masuk' : 'Daftar'}
                </Button> */}
                
                {/* <div className="my-4 flex items-center before:flex-1 before:border-t before:border-gray-300 after:flex-1 after:border-t after:border-gray-300 dark:before:border-gray-700 dark:after:border-gray-700">
                    <p className="text-center font-semibold mx-4 text-gray-500 dark:text-gray-400">ATAU</p>
                </div> */}

                <Button onClick={handleGoogleSignIn} variant="secondary" loading={isLoading} icon={Globe}>
                    {isLogin ? 'Masuk dengan Google' : 'Daftar dengan Google'}
                </Button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                <button 
                    onClick={() => setMode(isLogin ? 'register' : 'login')} 
                    className="text-sky-600 hover:text-sky-500 font-medium dark:text-sky-400 dark:hover:text-sky-300 transition"
                >
                    {isLogin ? 'Daftar Sekarang' : 'Masuk'}
                </button>
            </p>
        </Modal>
    );
};

// --- Komponen Onboarding ---
const OnboardingScreen = ({ user, onComplete }) => {
    const [username, setUsername] = useState(user?.displayName || '');
    const [bio, setBio] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!username.trim()) {
            setError('Nama tampilan tidak boleh kosong.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
            
            // Cek apakah dokumen user sudah ada, jika tidak buat baru
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                 await setDoc(userRef, {
                    uid: user.uid,
                    displayName: username.trim(),
                    photoURL: user.photoURL || 'https://placehold.co/150x150/cccccc/333333?text=A',
                    bio: bio,
                    createdAt: serverTimestamp(),
                    isBanned: false, // Default: tidak dilarang
                    role: 'user', // Default: user
                });
            } else {
                 await updateDoc(userRef, {
                    displayName: username.trim(),
                    bio: bio,
                    // photoURL tidak diupdate di sini agar user bisa mengganti di profil
                });
            }

            // Update display name di Firebase Auth
            // await updateProfile(auth.currentUser, { displayName: username.trim() });

            onComplete();
        } catch (e) {
            console.error("Error setting up user profile:", e);
            setError(`Gagal menyimpan: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal 
            title="Selesaikan Profil Anda" 
            isOpen={true} 
            onClose={() => {}} // Tidak bisa ditutup
            size="sm"
        >
            <div className="text-center mb-6">
                <img 
                    src={user?.photoURL || 'https://placehold.co/150x150/cccccc/333333?text=A'} 
                    alt="Foto Profil" 
                    className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-sky-400"
                />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Selamat Datang, {user?.email}!</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Satu langkah lagi untuk memulai.</p>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/30 dark:border-red-600 dark:text-red-300 flex items-center">
                    <AlertCircle size={20} className="mr-2 flex-shrink-0" />
                    {error}
                </div>
            )}

            <Input 
                label="Nama Tampilan (Username)" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Nama yang akan dilihat orang lain" 
                icon={User}
                disabled={isLoading}
            />
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio Singkat</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tentang diri Anda (maks 150 karakter)"
                    maxLength={150}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-800 dark:text-white transition"
                    disabled={isLoading}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right">{bio.length}/150</p>
            </div>

            <Button onClick={handleSave} variant="primary" loading={isLoading} icon={Save}>
                Simpan dan Lanjutkan
            </Button>
        </Modal>
    );
};

// ===========================================
// BAGIAN 6: HALAMAN APLIKASI
// ===========================================

// --- Halaman Beranda ---
const HomePage = ({ user, db, userProfile, onShare, showToast }) => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        const postsCol = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
        const q = query(postsCol, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPosts(fetchedPosts);
            setIsLoading(false);
        }, (error) => {
            console.error("Gagal mendapatkan postingan:", error);
            showToast('Gagal memuat postingan.', 'error');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, showToast]);

    if (isLoading) {
        return (
            <div className="text-center py-20 text-sky-500 dark:text-sky-400">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
                <p className="text-lg">Memuat Beranda...</p>
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Film className="w-10 h-10 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Belum Ada Postingan</h2>
                <p className="mt-2">Jadilah yang pertama untuk berbagi!</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Beranda <Flame className="inline w-6 h-6 text-orange-500"/></h1>
            <div className="space-y-6">
                {posts.map(post => (
                    <PostCard 
                        key={post.id} 
                        post={post} 
                        user={user} 
                        db={db} 
                        onShare={onShare} 
                        showToast={showToast}
                    />
                ))}
            </div>
        </div>
    );
};

// --- Halaman Buat Postingan ---
const CreatePostPage = ({ user, db, userProfile, setPage, showToast }) => {
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || (!content.trim() && !mediaUrl.trim() && !imageUrl.trim())) {
            showToast('Postingan harus memiliki konten, media URL, atau gambar URL.', 'warning');
            return;
        }

        setIsLoading(true);

        try {
            const postData = {
                userId: user.uid,
                content: content.trim(),
                mediaUrl: mediaUrl.trim() || null,
                imageUrl: imageUrl.trim() || null,
                timestamp: serverTimestamp(),
                userInfo: userProfile,
                likes: [],
                likeCount: 0,
                commentCount: 0,
            };

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), postData);
            
            showToast('Postingan berhasil diterbitkan!', 'success');
            setPage('home'); // Kembali ke beranda
            setContent('');
            setMediaUrl('');
            setImageUrl('');
        } catch (error) {
            console.error("Gagal membuat postingan:", error);
            showToast('Gagal menerbitkan postingan. Coba lagi.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Buat Postingan Baru <PlusCircle className="inline w-6 h-6 text-sky-500"/></h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apa yang Anda pikirkan?</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Tulis pesan Anda di sini..."
                            rows="5"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-800 dark:text-white transition"
                            disabled={isLoading}
                        />
                    </div>

                    <Input 
                        label="URL Media (YouTube, Instagram, TikTok)"
                        value={mediaUrl}
                        onChange={(e) => {
                            setMediaUrl(e.target.value);
                            // Clear imageUrl if mediaUrl is set
                            if (e.target.value) setImageUrl('');
                        }}
                        placeholder="Contoh: https://www.youtube.com/watch?v=..."
                        icon={Film}
                        disabled={isLoading}
                    />

                    <Input 
                        label="URL Gambar"
                        value={imageUrl}
                        onChange={(e) => {
                            setImageUrl(e.target.value);
                            // Clear mediaUrl if imageUrl is set
                            if (e.target.value) setMediaUrl('');
                        }}
                        placeholder="Contoh: https://mysite.com/gambar.jpg"
                        icon={ImageIcon}
                        disabled={isLoading}
                    />

                    {/* Pratinjau Media */}
                    {(mediaUrl || imageUrl) && (
                        <div className="my-6 p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center"><Eye size={18} className="mr-2"/> Pratinjau Media</h3>
                            {mediaUrl && <MediaEmbed url={mediaUrl} />}
                            {imageUrl && !mediaUrl && (
                                <img 
                                    src={imageUrl} 
                                    alt="Pratinjau Gambar" 
                                    className="w-full object-cover rounded-lg shadow-md max-h-72"
                                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/dddddd/555555?text=Gambar+Gagal+Dimuat"; e.target.alt="Gambar Gagal Dimuat" }}
                                />
                            )}
                        </div>
                    )}
                    

                    <Button type="submit" variant="primary" loading={isLoading} icon={Send}>
                        Terbitkan Postingan
                    </Button>
                </form>
            </div>
        </div>
    );
};

// --- Halaman Profil ---
const ProfilePage = ({ user, db, userProfile, setPage, showToast }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState(userProfile?.displayName || '');
    const [newBio, setNewBio] = useState(userProfile?.bio || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!newDisplayName.trim()) {
            showToast('Nama tampilan tidak boleh kosong.', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
            await updateDoc(userRef, {
                displayName: newDisplayName.trim(),
                bio: newBio,
            });
            showToast('Profil berhasil diperbarui!', 'success');
            setIsEditing(false);
        } catch (error) {
            console.error("Gagal update profil:", error);
            showToast('Gagal memperbarui profil. Coba lagi.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm("Apakah Anda yakin ingin keluar?")) {
            try {
                await signOut(auth);
                showToast('Berhasil keluar!', 'success');
                setPage('home');
            } catch (error) {
                console.error("Gagal logout:", error);
                showToast('Gagal keluar. Coba lagi.', 'error');
            }
        }
    };

    if (userProfile?.isBanned) {
        return (
             <div className="text-center py-20 p-4">
                <Ban className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-3xl font-extrabold text-red-600 dark:text-red-400">AKUN DILARANG</h2>
                <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
                    Akun Anda telah dilarang (banned) karena melanggar aturan komunitas.
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Silakan hubungi administrator untuk informasi lebih lanjut.
                </p>
                <div className="mt-8">
                     <Button onClick={handleLogout} variant="danger" icon={LogOut}>
                        Logout
                    </Button>
                </div>
            </div>
        );
    }
    
    const isAdmin = DEVELOPER_ADMIN_IDS.includes(user?.uid);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Profil Saya <UserCheck className="inline w-6 h-6 text-green-500"/></h1>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-xl mx-auto">
                <div className="text-center mb-6">
                    <img 
                        src={userProfile?.photoURL || 'https://placehold.co/150x150/cccccc/333333?text=A'} 
                        alt={userProfile?.displayName || 'Anonim'} 
                        className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-4 border-sky-400"
                    />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{userProfile?.displayName || 'Nama Tampilan'}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">UID: {user?.uid || 'Tidak Diketahui'}</p>
                    {isAdmin && (
                        <span className="inline-flex items-center mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                            <Shield className="w-4 h-4 mr-1" /> DEVELOPER ADMIN
                        </span>
                    )}
                </div>

                {isEditing ? (
                    <div>
                        <Input 
                            label="Nama Tampilan" 
                            value={newDisplayName} 
                            onChange={(e) => setNewDisplayName(e.target.value)} 
                            icon={User}
                            disabled={isLoading}
                        />
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                            <textarea
                                value={newBio}
                                onChange={(e) => setNewBio(e.target.value)}
                                rows="3"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-800 dark:text-white transition"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="flex space-x-3">
                            <Button onClick={handleSave} variant="primary" loading={isLoading} icon={Save}>
                                Simpan Perubahan
                            </Button>
                            <Button onClick={() => setIsEditing(false)} variant="secondary" icon={X}>
                                Batal
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><BookOpen size={18} className="mr-2"/> Bio</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{userProfile?.bio || 'Belum ada bio.'}</p>
                        </div>
                        <div className="flex justify-between space-x-3">
                            <Button onClick={() => setIsEditing(true)} variant="secondary" icon={Edit}>
                                Edit Profil
                            </Button>
                            <Button onClick={handleLogout} variant="danger" icon={LogOut}>
                                Logout
                            </Button>
                        </div>
                    </div>
                )}
            </div>

             {/* Link ke Developer Dashboard (Hanya untuk Admin) */}
            {isAdmin && (
                <div className="mt-8 text-center">
                    <Button onClick={() => setPage('developer-dashboard')} variant="outline" icon={UserCog}>
                        Developer Dashboard
                    </Button>
                </div>
            )}
        </div>
    );
};

// --- Halaman Pencarian ---
const SearchPage = ({ user, db, onShare, showToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            setResults([]);
            setSearchPerformed(true);
            return;
        }

        setIsLoading(true);
        setSearchPerformed(true);
        try {
            const postsCol = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
            
            // Mencari berdasarkan konten yang mengandung kata kunci (perlu indeks)
            // Di Firestore, pencarian substring sangat terbatas, jadi kita ambil 
            // semua data dan filter di sisi klien atau hanya mencari match awal.
            // Untuk contoh ini, kita gunakan filter sisi klien yang kurang efisien
            // untuk data besar, tapi berfungsi tanpa indeks khusus.

            // Query sederhana untuk demonstrasi (limit 50 postingan terbaru)
            const q = query(postsCol, orderBy('timestamp', 'desc'), limit(50));
            const snapshot = await getDocs(q);

            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter sisi klien
            const filteredResults = fetchedPosts.filter(post => 
                post.content.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                post.userInfo?.displayName?.toLowerCase().includes(searchTerm.toLowerCase().trim())
            );

            setResults(filteredResults);
        } catch (error) {
            console.error("Gagal melakukan pencarian:", error);
            showToast('Gagal melakukan pencarian. Coba lagi.', 'error');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Komponen Hasil Pencarian Sederhana
    const SearchResultItem = ({ post }) => {
        const postUser = post.userInfo || { displayName: 'Pengguna Anonim', photoURL: 'https://placehold.co/150x150/cccccc/333333?text=A', userId: 'unknown' };
        
        // PERBAIKAN: Klik pada hasil pencarian akan membuka ShareModal (Detail Postingan)
        const handleClick = () => {
            onShare(post);
        };

        return (
            <div 
                onClick={handleClick}
                className="flex items-start p-4 mb-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition duration-200 cursor-pointer"
            >
                <img 
                    src={postUser.photoURL} 
                    alt={postUser.displayName} 
                    className="w-10 h-10 rounded-full object-cover mr-3 flex-shrink-0"
                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
                />
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{postUser.displayName}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mt-1">
                        {post.content}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <Heart size={12} className="inline mr-1"/> {formatNumber(post.likeCount)} · 
                        <MessageSquare size={12} className="inline ml-2 mr-1"/> {formatNumber(post.commentCount || 0)}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Pencarian <Search className="inline w-6 h-6 text-purple-500"/></h1>
            
            <form onSubmit={handleSearch} className="mb-6 sticky top-0 bg-white dark:bg-gray-900 z-10 py-2 -mt-2">
                <Input 
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari konten atau pengguna..."
                    icon={Search}
                />
                <Button type="submit" variant="primary" loading={isLoading} disabled={isLoading} icon={Search}>
                    Cari
                </Button>
            </form>

            <div className="mt-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Hasil Pencarian ({results.length})</h2>
                {isLoading ? (
                    <div className="text-center py-10 text-sky-500 dark:text-sky-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Mencari...
                    </div>
                ) : searchPerformed && results.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-6 border rounded-lg dark:border-gray-700">
                        Tidak ada hasil untuk "{searchTerm}".
                    </p>
                ) : (
                    <div className="space-y-4">
                        {results.map(post => (
                            <SearchResultItem key={post.id} post={post} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Halaman Leaderboard ---
const LeaderboardPage = ({ db, showToast }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        // Mendapatkan data user berdasarkan jumlah like/post (asumsi kita ingin user dengan like terbanyak)
        // Catatan: Ini membutuhkan field 'totalLikes' atau 'postCount' di dokumen user yang diupdate 
        // secara berkala, yang biasanya dilakukan oleh Cloud Functions.
        // Untuk contoh ini, kita akan mengurutkan user berdasarkan 'createdAt' sebagai placeholder 
        // untuk skor/aktivitas jika total skor tidak tersedia.

        // Jika Anda punya field skor (misalnya 'totalScore'), ganti 'createdAt' dengan 'totalScore' dan 'desc'.
        const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const q = query(
            usersCol, 
            where('isBanned', '!=', true), // Tidak tampilkan user yang dilarang
            orderBy('isBanned'), 
            orderBy('createdAt', 'desc'), // Placeholder order: user tertua
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedUsers = snapshot.docs.map((doc, index) => ({
                rank: index + 1,
                id: doc.id,
                ...doc.data()
            }));
            setLeaderboard(fetchedUsers);
            setIsLoading(false);
        }, (error) => {
            console.error("Gagal mendapatkan leaderboard:", error);
            showToast('Gagal memuat leaderboard.', 'error');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, showToast]);

    const getRankStyle = (rank) => {
        switch (rank) {
            case 1: return 'bg-yellow-400 text-yellow-900 ring-4 ring-yellow-200 dark:bg-yellow-600 dark:text-white';
            case 2: return 'bg-gray-300 text-gray-800 ring-4 ring-gray-100 dark:bg-gray-500 dark:text-white';
            case 3: return 'bg-amber-700 text-white ring-4 ring-amber-500 dark:bg-amber-800';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const LeaderboardItem = ({ user }) => (
        <div className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md transition hover:shadow-lg">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0 ${getRankStyle(user.rank)}`}>
                {user.rank}
            </div>
            <img 
                src={user.photoURL} 
                alt={user.displayName} 
                className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-sky-400"
                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
            />
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{user.displayName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">@{user.id.substring(0, 8)}</p>
            </div>
            {/* Skor Placeholder (Ganti dengan skor aktual jika ada) */}
            <div className="text-right flex-shrink-0">
                <p className="text-lg font-extrabold text-sky-600 dark:text-sky-400">{user.score || 'N/A'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Poin/Like</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Papan Peringkat <Trophy className="inline w-6 h-6 text-amber-500"/></h1>
            
            {isLoading ? (
                <div className="text-center py-20 text-sky-500 dark:text-sky-400">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
                    <p className="text-lg">Memuat Peringkat...</p>
                </div>
            ) : leaderboard.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-6 border rounded-lg dark:border-gray-700">
                    Tidak ada data peringkat.
                </p>
            ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                    {leaderboard.map(user => (
                        <LeaderboardItem key={user.id} user={user} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Developer Dashboard (Fitur Baru: Ban/Delete Account) ---
const DeveloperDashboard = ({ user, db, setPage, showToast }) => {
    const [allUsers, setAllUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const isAdmin = DEVELOPER_ADMIN_IDS.includes(user?.uid);

    useEffect(() => {
        if (!db || !isAdmin) return;

        setIsLoading(true);
        // Ambil semua user (untuk tujuan admin)
        const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const q = query(usersCol, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllUsers(fetchedUsers);
            setIsLoading(false);
        }, (error) => {
            console.error("Gagal mendapatkan daftar user:", error);
            showToast('Gagal memuat daftar pengguna.', 'error');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAdmin, showToast]);

    // Handle Ban/Unban
    const handleBan = async (targetUser) => {
        if (isProcessing) return;
        
        // Developer tidak bisa membanned sesama developer
        if (DEVELOPER_ADMIN_IDS.includes(targetUser.id)) {
            showToast('Tidak bisa mengubah status developer lain.', 'error');
            return;
        }

        const action = targetUser.isBanned ? 'Unban' : 'Ban';
        if (!window.confirm(`Apakah Anda yakin ingin ${action} akun ${targetUser.displayName} (${targetUser.id.substring(0, 8)})?`)) return;

        setIsProcessing(true);
        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.id);
            await updateDoc(userRef, {
                isBanned: !targetUser.isBanned,
                bannedBy: !targetUser.isBanned ? user.uid : null,
                bannedAt: !targetUser.isBanned ? serverTimestamp() : null,
            });
            showToast(`Akun ${targetUser.displayName} berhasil di${!targetUser.isBanned ? 'larang' : 'aktifkan kembali'}.`, 'success');
        } catch (error) {
            console.error(`Gagal ${action} user:`, error);
            showToast(`Gagal ${action} akun. Coba lagi.`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle Delete Account (Hapus Dokumen User)
    const handleDeleteAccount = async (targetUser) => {
        if (isProcessing) return;
        
        // Developer tidak bisa menghapus sesama developer
        if (DEVELOPER_ADMIN_IDS.includes(targetUser.id)) {
            showToast('Tidak bisa menghapus akun developer lain.', 'error');
            return;
        }

        if (!window.confirm(`PERINGATAN! Anda akan menghapus permanen akun ${targetUser.displayName} (${targetUser.id.substring(0, 8)}). Postingan dan komentar mereka TIDAK akan ikut terhapus. Lanjutkan?`)) return;

        setIsProcessing(true);
        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.id);
            await deleteDoc(userRef);
            // Catatan: Menghapus user dari Firebase Auth TIDAK bisa dilakukan dari klien.
            // Di sini kita hanya menghapus dokumen profilnya di Firestore.
            showToast(`Akun ${targetUser.displayName} (Dokumen Firestore) berhasil dihapus.`, 'success');
        } catch (error) {
            console.error(`Gagal menghapus user:`, error);
            showToast(`Gagal menghapus akun. Coba lagi.`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredUsers = allUsers.filter(u => 
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const UserListItem = ({ targetUser }) => (
        <div className={`flex items-center p-4 rounded-lg shadow-sm border mb-3 ${targetUser.isBanned ? 'bg-red-50 dark:bg-red-900/50 border-red-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <img 
                src={targetUser.photoURL} 
                alt={targetUser.displayName} 
                className="w-10 h-10 rounded-full object-cover mr-4 flex-shrink-0"
                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/333333?text=A" }}
            />
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">
                    {targetUser.displayName} 
                    {targetUser.isBanned && <span className="ml-2 text-red-500 font-semibold">(DILARANG)</span>}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">UID: {targetUser.id}</p>
                {DEVELOPER_ADMIN_IDS.includes(targetUser.id) && (
                     <span className="inline-flex items-center mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        DEV
                    </span>
                )}
            </div>
            <div className="flex space-x-2 flex-shrink-0 ml-4">
                <Button 
                    onClick={() => handleBan(targetUser)} 
                    variant={targetUser.isBanned ? 'secondary' : 'warning'} 
                    icon={targetUser.isBanned ? UserCheck : Ban}
                    loading={isProcessing}
                    disabled={isProcessing || targetUser.id === user.uid || DEVELOPER_ADMIN_IDS.includes(targetUser.id)}
                >
                    {targetUser.isBanned ? 'Unban' : 'Ban'}
                </Button>
                <Button 
                    onClick={() => handleDeleteAccount(targetUser)} 
                    variant="danger" 
                    icon={Trash2}
                    loading={isProcessing}
                    disabled={isProcessing || targetUser.id === user.uid || DEVELOPER_ADMIN_IDS.includes(targetUser.id)}
                >
                    Hapus
                </Button>
            </div>
        </div>
    );

    if (!isAdmin) {
        return (
             <div className="text-center py-20 p-4">
                <Lock className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-3xl font-extrabold text-red-600 dark:text-red-400">Akses Ditolak</h2>
                <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
                    Halaman ini hanya untuk Developer.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 border-b pb-3 dark:border-gray-700">Developer Dashboard <UserCog className="inline w-6 h-6 text-red-500"/></h1>
            
            <Button onClick={() => setPage('profile')} variant="outline" icon={ArrowLeft} className="mb-4">
                Kembali ke Profil
            </Button>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center"><Users size={24} className="mr-2"/> Manajemen Pengguna ({allUsers.length})</h2>

                <Input 
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari berdasarkan nama atau UID..."
                    icon={Search}
                    className="mb-4"
                />

                {isLoading ? (
                    <div className="text-center py-10 text-sky-500 dark:text-sky-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Memuat daftar pengguna...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-6 border rounded-lg dark:border-gray-700">
                        Tidak ada pengguna yang cocok.
                    </p>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {filteredUsers.map(u => (
                            <UserListItem key={u.id} targetUser={u} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


// ===========================================
// BAGIAN 7: KOMPONEN UTAMA (APP)
// ===========================================

// Komponen Pembungkus PWA Install Prompt
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                setDeferredPrompt(null);
                setIsVisible(false);
            });
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 p-3 bg-sky-500 text-white rounded-xl shadow-2xl flex items-center space-x-3 max-w-sm">
            <Info size={24} />
            <p className="text-sm font-medium">Pasang aplikasi ini ke perangkat Anda!</p>
            <button onClick={handleInstall} className="bg-white text-sky-500 px-3 py-1 rounded-full font-semibold text-sm hover:opacity-90 transition">
                Pasang
            </button>
            <button onClick={() => setIsVisible(false)} className="text-white hover:text-gray-200">
                <X size={16} />
            </button>
        </div>
    );
};

// Komponen Tombol Navigasi Bawah
const NavBtn = ({ icon: Icon, active, onClick }) => (
    <button 
        onClick={onClick} 
        className={`p-2 rounded-full transition duration-300 ${active ? 'text-sky-600 bg-sky-50 dark:bg-sky-900 dark:text-sky-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
    >
        <Icon size={24}/>
    </button>
);


// Komponen Utama Aplikasi
const App = () => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [page, setPage] = useState('home'); // home, create, profile, search, leaderboard, developer-dashboard
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [toast, setToast] = useState(null);

    // Status User
    const isGuest = !user;
    const isDeveloperAdmin = DEVELOPER_ADMIN_IDS.includes(user?.uid);
    const isBanned = userProfile?.isBanned;

    // --- SETUP FIREBASE ---
    useEffect(() => {
        try {
            // Inisialisasi App
            if (!firebaseApp) {
                firebaseApp = initializeApp(firebaseConfig);
                db = getFirestore(firebaseApp);
                auth = getAuth(firebaseApp);
                // setLogLevel('debug'); // Aktifkan logging jika perlu
            }

            // 1. Auth Listener
            const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
                setUser(currentUser);
                setIsLoadingAuth(false);

                if (currentUser) {
                    // Cek dan login dengan custom token jika tersedia (Canvas Auth)
                    if (initialAuthToken) {
                         // Catatan: signInWithCustomToken hanya bisa dilakukan sekali
                         // setelah itu, onAuthStateChanged akan menangani sesi
                        // Jika sudah ada currentUser, tidak perlu signInWithCustomToken lagi
                    }

                    // Lanjutkan dengan fetch profil
                    const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
                    
                    // Gunakan onSnapshot untuk real-time update profil
                    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
                        const profileData = docSnap.data();
                        setUserProfile(profileData);

                        if (profileData?.isBanned) {
                            // Jika user di-ban, paksa logout (opsional) atau tampilkan layar banned
                            // setPage('profile'); // Arahkan ke halaman profile/banned screen
                        } else if (!docSnap.exists() || !profileData.displayName) {
                            // Jika profil belum lengkap, arahkan ke onboarding
                            setShowOnboarding(true);
                        } else {
                            setShowOnboarding(false);
                        }
                    }, (error) => {
                         console.error("Error fetching user profile:", error);
                    });
                    
                    return () => unsubscribeProfile();

                } else {
                    setUserProfile(null);
                }
            });

            // 2. Notifikasi (Messaging) Setup
            // try {
            //     messaging = getMessaging(firebaseApp);
            //     const token = await getToken(messaging, { vapidKey: 'GANTI_DENGAN_VAPID_KEY_ANDA' });
            //     console.log('FCM Token:', token);

            //     onMessage(messaging, (payload) => {
            //         console.log('Message received. ', payload);
            //         showToast(`Notifikasi: ${payload.notification.title}`, 'info');
            //     });
            // } catch (err) {
            //     console.warn('Gagal inisialisasi notifikasi:', err);
            // }

            return () => {
                unsubscribeAuth();
            };

        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            showToast('Gagal menginisialisasi Firebase.', 'error');
            setIsLoadingAuth(false);
        }
    }, []);
    
    // --- UTILS TOAST ---
    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type, key: Date.now() });
    }, []);

    // --- NAVIGASI DAN MODAL ---
    const handleShare = (post) => {
        setSelectedPost(post);
    };

    const handleCloseShare = () => {
        setSelectedPost(null);
    };

    // Pengecekan URL untuk membuka ShareModal secara langsung
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('post');
        if (postId && db && !isLoadingAuth) {
            const fetchPost = async () => {
                try {
                    const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
                    const docSnap = await getDoc(postRef);
                    if (docSnap.exists()) {
                        setSelectedPost({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        showToast('Postingan tidak ditemukan.', 'error');
                    }
                } catch (error) {
                    console.error("Error fetching post from URL:", error);
                    showToast('Gagal memuat detail postingan.', 'error');
                }
            };
            fetchPost();
        }
    }, [db, isLoadingAuth, showToast]);


    // Tentukan konten utama
    const renderPage = () => {
        if (isLoadingAuth) {
            return (
                <div className="text-center py-20 text-sky-500 dark:text-sky-400">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                    <p className="text-xl font-semibold">Memuat Aplikasi...</p>
                </div>
            );
        }

        // Tampilkan halaman dilarang jika user di-ban
        if (isBanned && page !== 'profile') {
             // Paksa ke halaman profile untuk melihat status banned
             setPage('profile');
        }


        switch (page) {
            case 'home':
                return <HomePage user={user} db={db} userProfile={userProfile} onShare={handleShare} showToast={showToast} />;
            case 'create':
                return isGuest ? (
                     <div className="text-center py-20 p-4">
                        <LogIn className="w-12 h-12 mx-auto mb-4 text-sky-500" />
                        <p className="text-lg text-gray-700 dark:text-gray-300">Anda harus masuk untuk membuat postingan.</p>
                        <Button onClick={() => setShowAuthModal(true)} variant="primary" icon={LogIn} className="mt-4">
                            Masuk / Daftar
                        </Button>
                    </div>
                ) : <CreatePostPage user={user} db={db} userProfile={userProfile} setPage={setPage} showToast={showToast} />;
            case 'profile':
                return isGuest ? (
                     <div className="text-center py-20 p-4">
                        <LogIn className="w-12 h-12 mx-auto mb-4 text-sky-500" />
                        <p className="text-lg text-gray-700 dark:text-gray-300">Anda harus masuk untuk melihat profil.</p>
                        <Button onClick={() => setShowAuthModal(true)} variant="primary" icon={LogIn} className="mt-4">
                            Masuk / Daftar
                        </Button>
                    </div>
                ) : <ProfilePage user={user} db={db} userProfile={userProfile} setPage={setPage} showToast={showToast} />;
            case 'search':
                return <SearchPage user={user} db={db} onShare={handleShare} showToast={showToast} />;
            case 'leaderboard':
                return <LeaderboardPage db={db} showToast={showToast} />;
            case 'developer-dashboard':
                return <DeveloperDashboard user={user} db={db} setPage={setPage} showToast={showToast} />;
            default:
                return <HomePage user={user} db={db} userProfile={userProfile} onShare={handleShare} showToast={showToast} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans antialiased text-gray-800 dark:text-gray-200">
            <style>
                {`
                /* Styling dasar untuk tampilan yang lebih baik dan mobile-friendly */
                .container-app {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    padding-bottom: 80px; /* Ruang untuk Navigasi Bawah */
                }
                
                /* Mengatasi masalah warna teks di Dark Mode */
                .group-text-fix {
                     /* Ini adalah perbaikan utamanya: pastikan teks selalu putih/cerah di dark mode */
                    color: #1f2937; /* Gray-800 default */
                }

                .dark .group-text-fix {
                    color: #f3f4f6; /* Gray-100 default */
                }

                .dark .bg-white {
                    background-color: #1f2937; /* Gray-800 */
                }
                .dark .bg-gray-50 {
                    background-color: #111827; /* Gray-900 */
                }
                
                /* Styling khusus untuk input dan button agar terlihat modern */
                input:focus, textarea:focus, button:focus {
                    outline: none;
                }
                `}
            </style>
            
            <div className="container-app mx-auto max-w-2xl">
                {/* Header (Top Bar - Opsional) */}
                <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md p-4 flex justify-between items-center border-b dark:border-gray-700">
                    <h1 className="text-2xl font-black text-sky-600 dark:text-sky-400 flex items-center">
                        <Zap className="w-6 h-6 mr-2 text-purple-500" />
                        MediaApp
                    </h1>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={() => {
                                const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                                document.documentElement.classList.toggle('dark');
                                localStorage.setItem('theme', newTheme);
                            }} 
                            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 transition"
                            title="Toggle Theme"
                        >
                            {document.documentElement.classList.contains('dark') ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </header>

                {/* Konten Utama */}
                <main className="flex-1">
                    {renderPage()}
                </main>

                {/* Toast Notifikasi */}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                
                {/* Share Modal (Detail Postingan) */}
                {selectedPost && (
                    <ShareModal 
                        post={selectedPost} 
                        user={user} 
                        db={db} 
                        onClose={handleCloseShare} 
                        showToast={showToast}
                    />
                )}

                {/* Navigasi Bawah */}
                {!isLoadingAuth && (
                    <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 shadow-2xl shadow-sky-300/30 dark:shadow-none mx-auto max-w-2xl">
                        <NavBtn icon={Home} active={page==='home'} onClick={()=>setPage('home')}/>
                        <NavBtn icon={Search} active={page==='search'} onClick={()=>setPage('search')}/>
                        <button onClick={()=> isGuest ? setShowAuthModal(true) : setPage('create')} className="bg-gradient-to-tr from-sky-500 to-purple-500 text-white p-3 rounded-full shadow-lg shadow-sky-300 hover:scale-110 transition"><PlusCircle size={24}/></button>
                        <NavBtn icon={Trophy} active={page==='leaderboard'} onClick={()=>setPage('leaderboard')}/>
                        {isGuest ? (
                             <NavBtn icon={LogIn} active={false} onClick={()=>setShowAuthModal(true)}/>
                        ) : (
                             <NavBtn icon={User} active={page==='profile'} onClick={()=>setPage('profile')}/>
                        )}
                    </nav>
                )}

                {showAuthModal && <AuthModal onClose={()=>setShowAuthModal(false)}/>}\
                {/* Pastikan Onboarding tidak muncul jika user di-banned */}
                {showOnboarding && user && !isBanned && <OnboardingScreen user={user} onComplete={()=>setShowOnboarding(false)}/>}\
                <PWAInstallPrompt />
            </div>
        </div>
    );
};

export default App;