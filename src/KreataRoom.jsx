import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Sparkles, Volume2, VolumeX, 
    Bell, Loader2, Play, Pause,
    MessageCircle, Share2, ExternalLink, ChevronDown, ChevronUp, Youtube, Heart
} from 'lucide-react';

// --- KONFIGURASI SESUAI DOKUMENTASI ---
const API_CONFIG = {
    URL: 'https://app.bgunenet.my.id/api/feed',
    MODE: 'search',
    QUERY: '#kreata',
    LIMIT: 10
};

const ASSETS = {
    LOGO: "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg",
    BGM: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3",
    SFX_CLICK: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
};

// --- HELPER ---
const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
    const match = url.match(regExp);
    return match ? match[2] : null;
};

const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

// --- RICH TEXT ---
const RichText = ({ text }) => {
    if (!text) return null;
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    const parts = text.split(regex).filter(Boolean);

    return (
        <span className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                           className="text-emerald-400 font-bold hover:underline mx-1"
                           onClick={e => e.stopPropagation()}>
                            [LINK]
                        </a>
                    );
                }
                if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
                if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

// ================== MAIN ==================
const KreataFeedUltimate = () => {
    const [posts, setPosts] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const [isEntered, setIsEntered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [expandMap, setExpandMap] = useState({});

    const observer = useRef(null);

    // 🔧 FIX 1: Audio TIDAK BOLEH di-init di render
    const audioRef = useRef(null);
    const sfxRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        audioRef.current = new Audio(ASSETS.BGM);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.4;

        sfxRef.current = new Audio(ASSETS.SFX_CLICK);

        return () => {
            audioRef.current?.pause();
            audioRef.current = null;
            sfxRef.current = null;
        };
    }, []);

    const playSfx = () => {
        if (!sfxRef.current) return;
        sfxRef.current.currentTime = 0;
        sfxRef.current.play().catch(() => {});
    };

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play().catch(() => {});
        setIsPlaying(!isPlaying);
    };

    const handleEnterRoom = () => {
        playSfx();
        setIsEntered(true);
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
        fetchFeed();
    };

    const fetchFeed = async (cursor = null) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            const params = new URLSearchParams({
                mode: API_CONFIG.MODE,
                q: API_CONFIG.QUERY,
                limit: API_CONFIG.LIMIT
            });
            if (cursor) params.append('cursor', cursor);

            const res = await fetch(`${API_CONFIG.URL}?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error('API Error');

            const newPosts = (data.posts || []).map(p => {
                const content = p.content || p.text || "";
                const ytId = getYoutubeId(content || p.mediaUrl);
                return {
                    id: p.id,
                    title: p.title || "Tanpa Judul",
                    author: p.user?.username || p.userName || "Admin",
                    avatar: p.user?.photoURL || p.userAvatar,
                    content,
                    image: !ytId ? p.mediaUrl : null,
                    youtube: ytId ? `https://www.youtube.com/watch?v=${ytId}` : null,
                    timestamp: p.timestamp,
                    likes: p.likes || 0
                };
            });

            setPosts(prev => cursor ? [...prev, ...newPosts] : newPosts);
            setNextCursor(data.nextCursor || null);
            setHasMore(!!data.nextCursor);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // 🔧 FIX 2: IntersectionObserver guard
    const lastPostRef = useCallback(node => {
        if (isLoading) return;
        if (typeof IntersectionObserver === 'undefined') return;

        observer.current?.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && nextCursor) {
                fetchFeed(nextCursor);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore, nextCursor]);

    // ================== RENDER ==================
    if (!isEntered) {
        return (
            <div className="fixed inset-0 bg-[#020617] flex items-center justify-center z-50">
                <button onClick={handleEnterRoom}
                    className="bg-white px-8 py-3 rounded-full font-black">
                    <Play size={18} /> Masuk Sekarang
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-20">
            <nav className="fixed top-0 inset-x-0 h-16 bg-black/80 z-40 flex items-center justify-between px-4">
                <span className="font-bold">KREATA</span>
                <button onClick={toggleAudio}>
                    {isPlaying ? <Volume2 /> : <VolumeX />}
                </button>
            </nav>

            <div className="max-w-md mx-auto pt-20 px-4 space-y-6">
                {posts.map((post, i) => {
                    const isLast = i === posts.length - 1;
                    const isLong = (post.content || "").length > 150;
                    const isExpanded = expandMap[post.id];

                    return (
                        <article key={post.id} ref={isLast ? lastPostRef : null}
                            className="bg-[#0f111a] rounded-2xl overflow-hidden">

                            <div className="p-4">
                                <h3 className="font-bold">{post.author}</h3>
                                <span className="text-xs">{formatTime(post.timestamp)}</span>
                            </div>

                            {post.youtube && (
                                <iframe
                                    className="w-full aspect-video"
                                    src={`https://www.youtube.com/embed/${getYoutubeId(post.youtube)}`}
                                    allowFullScreen
                                />
                            )}

                            <div className="p-4">
                                <div className={!isExpanded && isLong ? "line-clamp-3" : ""}>
                                    <RichText text={post.content} />
                                </div>
                                {isLong && (
                                    <button onClick={() => setExpandMap(p => ({...p, [post.id]: !p[post.id]}))}
                                        className="text-emerald-400 text-xs mt-2">
                                        {isExpanded ? "TUTUP" : "BACA SELENGKAPNYA"}
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

export default KreataRoom;