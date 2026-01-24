// FILE: KreataRoom.jsx (KREATA CYBER-HUB v5.0 - THE ECOSYSTEM PLAYGROUND)
import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Users, Zap, MessageCircle, ChevronDown, ChevronUp, 
    Gamepad2, Trophy, Sparkles, Rocket, Star, Heart, ShieldCheck, 
    ShieldAlert, Fingerprint, Volume2, UserPlus, Check, Activity, Target,
    Share2, Lightbulb, TrendingUp, Atom, Layers, Globe, XCircle, CheckCircle
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';

const KREATA_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";
const WA_GROUP_LINK = "https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss";
const WA_CHANNEL_LINK = "https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j";

const KreataRoom = ({ setPage, db, currentUser }) => {
    const [isFollowed, setIsFollowed] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [activeTab, setActiveTab] = useState('hub');
    const [isMuted, setIsMuted] = useState(false);

    // Game States
    const [gameClicks, setGameClicks] = useState(0); // For Reflex Trainer
    const [hashHuntScore, setHashHuntScore] = useState(0);
    const [currentHash, setCurrentHash] = useState('');
    const [hashInput, setHashInput] = useState('');
    const [hashGameMsg, setHashGameMsg] = useState('');
    const [correctHashes, setCorrectHashes] = useState(['#kreata', '#koloxe', '#amethyst', '#mccreata']);

    // Simulasi Upload State
    const [simulatedPostContent, setSimulatedPostContent] = useState('');
    const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);
    const [simulationResult, setSimulationResult] = useState(null); // 'success', 'fail'

    // Audio Engine
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const audioSuccess = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'));
    const audioError = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2068/2068-preview.mp3'));
    const audioPop = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2650/2650-preview.mp3')); // New distinct pop sound

    useEffect(() => {
        if (!db) return;

        // Auto-Initialize & Listen Global Member Count
        const globalRef = doc(db, "artifacts/default-app-id/public/data/stats", "kreata_room");
        const unsub = onSnapshot(globalRef, (docSnap) => {
            if (docSnap.exists()) {
                setMemberCount(docSnap.data().totalMembers || 0);
            } else {
                setDoc(globalRef, { totalMembers: 500, lastUpdate: Date.now() }); 
            }
        });

        // Check User Status for Membership
        if (currentUser) {
            const userRef = doc(db, `artifacts/default-app-id/public/data/userProfiles/${currentUser.uid}/private/kreata_status`);
            getDoc(userRef).then(snap => {
                if (snap.exists()) setIsFollowed(true);
            });
        }

        // Initialize Hash-Hunt Game
        startHashHunt();

        return () => unsub();
    }, [db, currentUser]);

    const playSound = (sound) => {
        if (isMuted) return;
        sound.current.currentTime = 0;
        sound.current.play().catch(() => {});
    };

    // --- Membership Logic ---
    const handleJoin = async () => {
        if (!currentUser) {
            playSound(audioError);
            alert("⚠️ Kamu harus Login dulu untuk bergabung!");
            return;
        }
        if (isFollowed) return;

        playSound(audioSuccess);
        setIsFollowed(true);

        try {
            const userRef = doc(db, `artifacts/default-app-id/public/data/userProfiles/${currentUser.uid}/private/kreata_status`);
            await setDoc(userRef, { joinedAt: Date.now(), verified: true });
            const globalRef = doc(db, "artifacts/default-app-id/public/data/stats", "kreata_room");
            await updateDoc(globalRef, { totalMembers: increment(1) });
        } catch (e) {
            console.error("Join Room Failed:", e);
        }
    };

    // --- Hash-Hunt Game Logic ---
    const startHashHunt = () => {
        const randomIndex = Math.floor(Math.random() * correctHashes.length);
        setCurrentHash(correctHashes[randomIndex]);
        setHashInput('');
        setHashGameMsg('');
    };

    const submitHash = () => {
        playSound(audioPop);
        if (hashInput.toLowerCase().trim() === currentHash.toLowerCase()) {
            setHashHuntScore(prev => prev + 100);
            setHashGameMsg('✅ Tepat! Kamu Hebat!');
            setTimeout(startHashHunt, 1000);
        } else {
            setHashGameMsg('❌ Salah! Coba lagi.');
            setHashHuntScore(prev => Math.max(0, prev - 50));
        }
        setHashInput('');
    };

    // --- Simulasi Upload Logic ---
    const simulatePost = () => {
        playSound(audioClick);
        setIsSimulatingUpload(true);
        setSimulationResult(null);

        setTimeout(() => {
            const hasKreata = simulatedPostContent.toLowerCase().includes('#kreata');
            const isSpammy = simulatedPostContent.length < 20 || simulatedPostContent.includes('free money'); // Simple spam check

            if (hasKreata && !isSpammy) {
                setSimulationResult('success');
                playSound(audioSuccess);
            } else {
                setSimulationResult('fail');
                playSound(audioError);
            }
            setIsSimulatingUpload(false);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-24 overflow-x-hidden font-sans relative">
            
            {/* --- BACKGROUND ANIMATION: PARTICLES --- */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
                {[...Array(30)].map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute bg-emerald-400 rounded-full mix-blend-screen animate-particle-float" 
                        style={{
                            width: `${Math.random() * 5 + 2}px`,
                            height: `${Math.random() * 5 + 2}px`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDuration: `${10 + Math.random() * 15}s`,
                            animationDelay: `${Math.random() * 5}s`,
                            boxShadow: `0 0 ${Math.random() * 10 + 5}px rgba(16, 185, 129, 0.7)`
                        }}
                    ></div>
                ))}
            </div>

            {/* --- CYBER HEADER --- */}
            <div className="relative h-[450px] w-full">
                <div className="absolute inset-0 bg-emerald-500/10 z-10 animate-pulse" />
                <img src={KREATA_IMG} className="w-full h-full object-cover brightness-[0.2] contrast-125" alt="Banner" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent z-20" />
                
                <button onClick={() => { playSound(audioClick); setPage('home'); }} className="absolute top-8 left-6 z-50 bg-white/5 backdrop-blur-xl p-4 rounded-[24px] border border-white/10 hover:bg-emerald-500 hover:text-black transition-all shadow-2xl">
                    <ArrowLeft size={24} />
                </button>
                <button onClick={() => setIsMuted(!isMuted)} className="absolute top-8 right-6 z-50 bg-white/5 backdrop-blur-xl p-4 rounded-[24px] border border-white/10 text-emerald-400">
                    {isMuted ? <Volume2 className="opacity-30" size={24} /> : <Volume2 size={24} className="animate-bounce" />}
                </button>

                <div className="absolute bottom-12 left-8 right-8 z-30">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="bg-emerald-500 text-black text-[10px] font-black px-4 py-1.5 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] tracking-[0.2em]">
                            OFFICIAL PARTNER
                        </span>
                        <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                            <Activity size={12} className="text-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-black">{memberCount} MEMBERS</span>
                        </div>
                    </div>
                    <h1 className="text-7xl font-black italic tracking-tighter leading-[0.8] mb-4">KREATA<br/><span className="text-emerald-500">ROOM</span></h1>
                    <p className="text-slate-400 text-sm max-w-xs font-medium leading-relaxed italic border-l-2 border-emerald-500 pl-4">
                        Wadah kolaborasi aman, terverifikasi, dan anti-spam.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 -mt-10 relative z-40">
                
                {/* --- CYBER NAV --- */}
                <div className="flex gap-2 p-2 bg-slate-900/80 backdrop-blur-3xl rounded-[32px] border border-white/5 mb-10 shadow-2xl">
                    {['hub', 'games', 'collab', 'security'].map((t) => (
                        <button key={t} onClick={() => { playSound(audioClick); setActiveTab(t); }}
                            className={`flex-1 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                                activeTab === t ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-white/5'
                            }`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* --- HUB SECTION --- */}
                {activeTab === 'hub' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-700">
                        {/* JOIN CARD */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-900 p-10 rounded-[48px] shadow-2xl relative overflow-hidden group">
                            <Sparkles className="absolute top-4 right-4 text-white/10 group-hover:animate-spin" size={60} />
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black italic mb-2 tracking-tight">THE MEMBERSHIP</h2>
                                <p className="text-emerald-100/60 text-[10px] mb-10 font-bold uppercase tracking-widest leading-loose">
                                    Klik sekali untuk verifikasi permanen di dalam Room.
                                </p>
                                
                                <button onClick={handleJoin}
                                    className={`w-full py-6 rounded-[28px] font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${
                                        isFollowed ? 'bg-black/30 text-emerald-400 border border-emerald-400/30' : 'bg-white text-black hover:shadow-2xl active:scale-95'
                                    }`}>
                                    {isFollowed ? <><Check size={20}/> Verified Member</> : <><UserPlus size={20}/> Gabung Room</>}
                                </button>
                            </div>
                        </div>

                        {/* WA LINKS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <a href={WA_GROUP_LINK} target="_blank" rel="noopener noreferrer" className="p-8 bg-slate-900/50 rounded-[40px] border border-white/5 hover:border-emerald-500/50 transition-all group">
                                <MessageCircle className="text-emerald-500 mb-4 group-hover:scale-110 transition-transform" size={40} />
                                <h4 className="text-lg font-black italic uppercase">Chat Group</h4>
                                <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-widest">Ruang diskusi kreator</p>
                            </a>
                            <a href={WA_CHANNEL_LINK} target="_blank" rel="noopener noreferrer" className="p-8 bg-slate-900/50 rounded-[40px] border border-white/5 hover:border-emerald-500/50 transition-all group">
                                <Zap className="text-yellow-500 mb-4 group-hover:scale-110 transition-transform" size={40} />
                                <h4 className="text-lg font-black italic uppercase">News Hub</h4>
                                <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-widest">Informasi Terkini</p>
                            </a>
                        </div>
                    </div>
                )}

                {/* --- GAMES SECTION --- */}
                {activeTab === 'games' && (
                    <div className="space-y-8 animate-in zoom-in duration-500">
                        {/* Reflex Trainer */}
                        <div className="bg-slate-900/50 p-12 rounded-[50px] border border-white/5 text-center">
                            <Target className="mx-auto text-emerald-500 mb-6 animate-pulse" size={50} />
                            <h2 className="text-3xl font-black italic uppercase mb-2">Reflex Training</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase mb-10 tracking-widest">Uji kecepatan tanganmu di markas</p>
                            <div className="text-8xl font-black text-white mb-10 italic drop-shadow-2xl">{gameClicks}</div>
                            <button onClick={() => { playSound(audioPop); setGameClicks(c => c + 1); }}
                                className="w-32 h-32 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-90 transition-all">
                                <Zap size={40} fill="black" />
                            </button>
                        </div>

                        {/* Hash-Hunt Game */}
                        <div className="bg-slate-900/50 p-12 rounded-[50px] border border-white/5 text-center">
                            <Lightbulb className="mx-auto text-yellow-400 mb-6 animate-bounce" size={50} />
                            <h2 className="text-3xl font-black italic uppercase mb-2">Hash-Hunt Challenge</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase mb-6 tracking-widest">Ketik hashtag yang benar!</p>
                            
                            <div className="mb-8 p-6 bg-white/5 rounded-3xl flex flex-col items-center">
                                <p className="text-slate-400 text-sm font-bold uppercase mb-4">Temukan ini:</p>
                                <span className="text-4xl font-black text-emerald-400 italic mb-4">{currentHash}</span>
                                <input 
                                    type="text"
                                    value={hashInput}
                                    onChange={(e) => setHashInput(e.target.value)}
                                    placeholder="Ketik hashtag di sini..."
                                    className="w-full max-w-xs bg-slate-800 border border-emerald-500/50 rounded-xl py-3 px-4 text-white text-sm focus:ring-2 focus:ring-emerald-500 transition"
                                />
                                <button onClick={submitHash} className="mt-4 bg-emerald-500 text-black py-3 px-6 rounded-xl font-bold text-xs uppercase hover:bg-emerald-400 transition">
                                    Submit
                                </button>
                                {hashGameMsg && (
                                    <p className={`mt-4 text-sm font-bold ${hashGameMsg.includes('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {hashGameMsg}
                                    </p>
                                )}
                            </div>
                            <p className="text-xl font-black text-white italic">SKOR: {hashHuntScore}</p>
                        </div>
                    </div>
                )}

                {/* --- COLLABORATION SECTION --- */}
                {activeTab === 'collab' && (
                    <div className="space-y-8 animate-in slide-in-from-left-10 duration-700">
                        {/* Simulasi Upload Sehat */}
                        <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
                            <Share2 className="absolute top-6 right-6 text-white/10" size={60} />
                            <h3 className="text-3xl font-black italic mb-2 tracking-tight">Simulasi Post Sehat</h3>
                            <p className="text-blue-100/60 text-[10px] mb-8 font-bold uppercase tracking-widest">Pelajari cara posting yang benar & aman.</p>
                            
                            <textarea 
                                value={simulatedPostContent}
                                onChange={(e) => setSimulatedPostContent(e.target.value)}
                                placeholder="Tulis konten postinganmu di sini... (wajib #kreata!)"
                                className="w-full h-32 bg-blue-900/50 border border-blue-500/50 rounded-2xl p-5 text-white text-sm focus:ring-2 focus:ring-blue-500 transition resize-none mb-4"
                            ></textarea>
                            
                            <button onClick={simulatePost} disabled={isSimulatingUpload}
                                className="w-full py-5 rounded-[28px] font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 bg-white text-blue-950 hover:shadow-2xl active:scale-95">
                                {isSimulatingUpload ? <><Atom className="animate-spin"/> Menganalisis...</> : <><Share2 size={20}/> Simulasi Upload</>}
                            </button>

                            {simulationResult && (
                                <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 ${
                                    simulationResult === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                } animate-in fade-in`}>
                                    {simulationResult === 'success' ? <CheckCircle size={24}/> : <XCircle size={24}/>}
                                    <span className="text-sm font-bold">
                                        {simulationResult === 'success' 
                                            ? 'Berhasil! Postinganmu terverifikasi #kreata dan bersih.' 
                                            : 'Gagal! Pastikan ada #kreata dan bukan spam.'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Kolaborator Aktif (Dummy) */}
                        <div className="bg-slate-900/50 p-10 rounded-[48px] border border-white/5">
                            <Layers className="text-purple-500 mb-4" size={40} />
                            <h3 className="text-2xl font-black italic uppercase mb-6 tracking-tight">Ecosystem Growth</h3>
                            
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-2xl flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-300">Total Projects</span>
                                    <span className="text-emerald-400 text-xl font-black">150+</span>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-300">Active Collaborators</span>
                                    <span className="text-blue-400 text-xl font-black">75</span>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-300">Community Reach</span>
                                    <span className="text-yellow-400 text-xl font-black"><Globe size={20} className="inline-block mr-2" /> Global</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SECURITY SECTION --- */}
                {activeTab === 'security' && (
                    <div className="space-y-4 animate-in slide-in-from-right-10 duration-700">
                        <div className="bg-emerald-500/5 p-10 rounded-[48px] border border-emerald-500/10 relative overflow-hidden">
                            <ShieldCheck className="text-emerald-500 mb-6 animate-bounce" size={40} />
                            <h3 className="text-2xl font-black italic uppercase mb-8">System Analysis</h3>
                            
                            <div className="space-y-6">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden">
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                                        <span>Spam Protection</span>
                                        <span className="text-emerald-400">Online</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[99%]"></div>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-4 leading-relaxed font-bold uppercase tracking-widest">
                                        Seluruh postingan wajib menggunakan hashtag <span className="text-emerald-400">#kreata</span> untuk verifikasi keamanan real-time.
                                    </p>
                                </div>
                                <div className="p-5 bg-white/5 rounded-3xl flex items-center gap-4">
                                    <Fingerprint size={24} className="text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Authentication Required</span>
                                </div>
                                <div className="p-5 bg-white/5 rounded-3xl flex items-center gap-4">
                                    <TrendingUp size={24} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Threat Monitoring</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-24 text-center">
                    <h4 className="text-slate-600 font-black italic tracking-[0.6em] text-[10px] uppercase">
                        Secure • Creative • United
                    </h4>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;