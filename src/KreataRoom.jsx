import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Sparkles, Volume2, VolumeX, 
    Bell, Loader2, Play, Share2, ExternalLink, 
    ChevronDown, ChevronUp, MessageCircle
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

// --- AUDIO GLOBAL (Ditaruh di luar komponen agar stabil) ---
// Ini trik supaya audio tidak putus/reset saat React render ulang
const GLOBAL_AUDIO = new Audio('https://cdn.pixabay.com/audio/2021/08/08/audio_c1c73a0c0e.mp3');
GLOBAL_AUDIO.loop = true;
GLOBAL_AUDIO.volume = 0.5;

const GLOBAL_SFX = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');

// --- HELPER FUNCTIONS ---
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- COMPONENTS ---
const YouTubeEmbed = ({ url }) => {
    const videoId = getYoutubeId(url);
    if (!videoId) return null;
    return (
        <div className="relative w-full aspect-video bg-black border-y border-white/5">
            <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
        </div>
    );
};

const RichTextRenderer = ({ text }) => {
    if (!text) return null;
    const parts = text.split(/(\bhttps?:\/\/[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    return (
        <span>
            {parts.map((part, index) => {
                if (part.match(/^https?:\/\//)) return <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={(e)=>e.stopPropagation()} className="text-emerald-400 font-bold hover:underline decoration-dotted truncate inline-block max-w-full align-bottom">LINK TAUTAN ↗</a>;
                if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-white font-black tracking-wide">{part.slice(2, -2)}</strong>;
                if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-emerald-200 not-italic bg-emerald-500/10 px-1 rounded">{part.slice(1, -1)}</em>;
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

const ExpandableText = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const limit = 150; 
    const isLong = content.length > limit;
    const textToShow = isExpanded || !isLong ? content : content.slice(0, limit) + "...";
    return (
        <div className="text-slate-300 text-[13px] leading-6 font-light">
            <div className="whitespace-pre-wrap break-words"><RichTextRenderer text={textToShow} /></div>
            {isLong && (
                <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    {isExpanded ? <>Tutup <ChevronUp size={12} /></> : <>Baca Selengkapnya <ChevronDown size={12} /></>}
                </button>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const KreataRoom = ({ setPage }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    // Refs untuk state management yang tidak memicu render
    const isFetchingRef = useRef(false); 
    const seenIds = useRef(new Set()); // Untuk cek duplikat instan

    // --- AUDIO CONTROL ---
    const playClick = () => {
        GLOBAL_SFX.currentTime = 0;
        GLOBAL_SFX.play().catch(() => {});
    };

    const toggleMusic = () => {
        if (isMuted) {
            GLOBAL_AUDIO.play().catch(console.error);
        } else {
            GLOBAL_AUDIO.pause();
        }
        setIsMuted(!isMuted);
    };

    // --- FETCH LOGIC (RECURSIVE & AGGRESSIVE) ---
    const fetchKreataPosts = async (cursorToUse = null) => {
        if (isFetchingRef.current) return; // Cegah tabrakan request
        
        isFetchingRef.current = true;
        setLoading(true);

        try {
            // Kita naikkan limit jadi 20 biar sekali ambil langsung banyak
            let url = 'https://app.bgunenet.my.id/api/feed?mode=search&q=#kreata&limit=20';
            if (cursorToUse) url += `&cursor=${cursorToUse}`;

            console.log("Fetching:", cursorToUse || "First Page");

            const res = await fetch(url);
            const data = await res.json();
            const rawPosts = data.posts || [];

            // Jika API benar-benar kosong dan tidak ada cursor lagi
            if (rawPosts.length === 0 && !data.nextCursor) {
                setHasMore(false);
                setLoading(false);
                isFetchingRef.current = false;
                return;
            }

            // Proses Data
            const processedPosts = rawPosts.map(post => {
                let finalImage = null, isVideo = false, videoUrl = null;
                // Logika deteksi media
                const mediaCandidates = [post.mediaUrl, ...(post.mediaUrls || [])].filter(Boolean);
                
                // Prioritas Video
                const videoCandidate = mediaCandidates.find(url => getYoutubeId(url));
                if (videoCandidate) {
                    isVideo = true; videoUrl = videoCandidate;
                } else if (mediaCandidates.length > 0) {
                    finalImage = mediaCandidates[0];
                } else {
                    // Cek text body
                    const ytInText = getYoutubeId(post.content || post.text || "");
                    if (ytInText) { isVideo = true; videoUrl = `https://www.youtube.com/watch?v=${ytInText}`; }
                }

                return {
                    id: post.id || Math.random().toString(36),
                    title: post.title,
                    content: post.content || post.text || "",
                    author: post.user?.username || post.authorName || "Anonymous",
                    avatar: post.user?.photoURL || post.authorAvatar,
                    image: finalImage,
                    isVideo, videoUrl,
                    timestamp: post.timestamp
                };
            });

            // Filter Duplikat Menggunakan Ref (Lebih akurat dari state)
            const newUniquePosts = processedPosts.filter(p => {
                if (seenIds.current.has(p.id)) return false;
                seenIds.current.add(p.id);
                return true;
            });

            // Update State Data
            if (newUniquePosts.length > 0) {
                setPosts(prev => [...prev, ...newUniquePosts]);
            }

            // Update Cursor
            if (data.nextCursor) {
                setNextCursor(data.nextCursor);
                setHasMore(true);

                // --- LOGIKA KRUSIAL: AUTO SKIP JIKA HASIL KOSONG ---
                // Jika setelah difilter hasilnya 0 (semua duplikat), tapi API bilang masih ada nextCursor,
                // Kita panggil ulang fungsi ini SECARA OTOMATIS (Recursive)
                if (newUniquePosts.length === 0) {
                    console.log("Data duplikat semua, auto-fetch next page...");
                    isFetchingRef.current = false; // Reset lock
                    return fetchKreataPosts(data.nextCursor); // <--- INI KUNCINYA
                }
            } else {
                setNextCursor(null);
                setHasMore(false);
            }

        } catch (e) {
            console.error("Fetch Error:", e);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    };

    // --- INFINITE SCROLL OBSERVER ---
    const observer = useRef();
    const lastElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchKreataPosts(nextCursor);
            }
        }, { threshold: 0.1 }); // Lebih sensitif
        if (node) observer.current.observe(node);
    }, [loading, hasMore, nextCursor]);

    // --- START ROOM & AUDIO HANDLER ---
    const startRoom = () => {
        playClick();
        // Memulai audio langsung saat interaksi user (Wajib untuk browser modern)
        GLOBAL_AUDIO.play().then(() => {
            setIsMuted(false);
        }).catch((e) => {
            console.warn("Autoplay blocked, user need to unmute manually", e);
            setIsMuted(true);
        });
        
        setHasStarted(true);
        fetchKreataPosts(); // Load data pertama
    };

    // --- RENDER ---
    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                <div className="absolute w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="relative z-10 animate-fade-in">
                    <div className="relative mb-8 inline-block cursor-pointer group" onClick={startRoom}>
                        <div className="absolute inset-0 bg-emerald-500 rounded-[35px] blur-xl opacity-40 group-hover:opacity-60 transition duration-500"></div>
                        <img src={KREATA_LOGO} className="relative w-36 h-36 rounded-[35px] border-4 border-[#020617] shadow-2xl object-cover transform group-hover:scale-105 transition duration-500" alt="Logo" />
                    </div>
                    <h1 className="text-5xl font-black text-white italic mb-3 tracking-tighter drop-shadow-2xl">
                        KREATA <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">ROOM</span>
                    </h1>
                    <button onClick={startRoom} className="mt-8 relative group bg-white text-black pl-8 pr-10 py-4 rounded-full font-black uppercase text-sm tracking-[0.2em] transition-all hover:bg-emerald-400 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center gap-3 mx-auto overflow-hidden">
                        <Play size={20} fill="black" /> MASUK SEKARANG
                    </button>
                    <p className="mt-4 text-[10px] text-slate-500">Klik tombol di atas untuk memutar musik & memuat data</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/40 pb-32">
            {/* Navbar */}
            <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between">
                <button onClick={() => setPage && setPage('home')} className="p-2 rounded-xl active:scale-95 hover:bg-white/5"><ArrowLeft size={24} className="text-slate-100" /></button>
                <span className="font-black italic text-xl text-white uppercase tracking-tighter">KREATA</span>
                <button onClick={toggleMusic} className={`p-2 rounded-xl hover:bg-white/5 ${isMuted ? 'text-slate-500' : 'text-emerald-400'}`}>
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-md mx-auto px-4 pt-24 space-y-8">
                {/* Header Banner */}
                <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-[24px] p-5 border border-white/10 relative overflow-hidden shadow-2xl">
                    <div className="flex items-center gap-4 relative z-10">
                        <img src={KREATA_LOGO} className="w-14 h-14 rounded-2xl shadow-lg ring-2 ring-white/10" alt="Icon" />
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wide mb-1">Official Feed</h2>
                            <div className="text-[10px] text-slate-400 font-medium">Postingan dengan hashtag <span className="text-emerald-300">#kreata</span></div>
                        </div>
                    </div>
                </div>

                {/* Posts List */}
                <div className="space-y-8">
                    {posts.map((post, index) => (
                        <div key={`${post.id}-${index}`} className="group bg-[#0f111a] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl hover:border-white/10 transition-colors">
                            <div className="p-4 flex items-center gap-3 bg-[#131620]/50 backdrop-blur-sm">
                                <img src={post.avatar || `https://ui-avatars.com/api/?name=${post.author}&background=10b981&color=fff`} className="w-10 h-10 rounded-full bg-slate-800 object-cover" alt="Ava" onError={(e)=>{e.target.onerror=null; e.target.src=`https://ui-avatars.com/api/?name=User&background=random`}} />
                                <div><h4 className="text-sm font-bold text-white truncate">{post.author}</h4><p className="text-[10px] text-emerald-500/80 uppercase font-bold">Creator</p></div>
                            </div>
                            
                            <div>
                                {post.isVideo ? <YouTubeEmbed url={post.videoUrl} /> : post.image && (
                                    <div className="w-full bg-black border-y border-white/5"><img src={post.image} className="w-full h-auto max-h-[500px] object-contain mx-auto" alt="Content" loading="lazy" /></div>
                                )}
                                <div className="p-5 bg-gradient-to-b from-[#0f111a] to-[#0a0c12]">
                                    <ExpandableText content={post.content} />
                                </div>
                            </div>

                            <div className="p-4 pt-0 flex gap-3">
                                <button onClick={() => { playClick(); navigator.clipboard.writeText(`https://app.bgunenet.my.id/?post=${post.id}`); alert('Link Copied!'); }} className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-bold text-[11px] uppercase flex items-center justify-center gap-2 border border-white/5"><Share2 size={16} /> Share</button>
                                <button onClick={() => { playClick(); window.location.href=`/?post=${post.id}`; }} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-bold text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"><ExternalLink size={16} /> Buka Postingan</button>
                            </div>
                        </div>
                    ))}

                    {/* Loading & Sentinel */}
                    <div ref={lastElementRef} className="py-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[100px]">
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin text-emerald-500" size={28} />
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">Sedang mengambil data baru...</span>
                            </>
                        ) : hasMore ? (
                            // Jika tidak loading tapi masih ada 'hasMore', berarti sentinel belum terlihat
                            // Tombol manual untuk jaga-jaga kalau scroll macet
                            <button onClick={() => fetchKreataPosts(nextCursor)} className="text-[10px] text-emerald-500 underline uppercase tracking-widest opacity-50 hover:opacity-100">
                                Muat Lebih Banyak (Manual)
                            </button>
                        ) : (
                            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest border-t border-white/5 pt-4 w-full text-center">
                                — Semua karya telah ditampilkan —
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;