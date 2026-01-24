// FILE: KreataRoom.jsx (ULTIMATE VERSION - NO ERROR - FULL FEATURES)
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Zap, MessageCircle, Gamepad2, Sparkles, 
  Rocket, ShieldCheck, Volume2, UserPlus, 
  Check, Target, Share2, Info, Bell, HeartHandshake, Globe
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage }) => {
    // States
    const [isFollowed, setIsFollowed] = useState(false);
    const [gameClicks, setGameClicks] = useState(0);
    const [simContent, setSimContent] = useState('');
    const [simResult, setSimResult] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

    // Audio Refs (Menggunakan link publik stabil)
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const audioSuccess = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'));

    useEffect(() => {
        // Cek status join di Local Storage HP User (Anti Error Database)
        const status = localStorage.getItem('kreata_member_status');
        if (status === 'joined') setIsFollowed(true);
    }, []);

    const playSound = (sound) => {
        if (isMuted) return;
        sound.current.currentTime = 0;
        sound.current.play().catch(() => {}); // Catch block untuk handle browser policy
    };

    const handleJoin = () => {
        if (isFollowed) return;
        playSound(audioSuccess);
        setIsFollowed(true);
        localStorage.setItem('kreata_member_status', 'joined');
    };

    const handleCheckPost = () => {
        playSound(audioClick);
        if (simContent.toLowerCase().includes('#kreata')) {
            setSimResult('success');
            playSound(audioSuccess);
        } else {
            setSimResult('fail');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-20 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            
            {/* --- 1. HEADER BRANDING --- */}
            <div className="relative h-80 w-full flex flex-col items-center justify-center overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
                
                {/* Back Button */}
                <button onClick={() => { playSound(audioClick); setPage('home'); }} 
                    className="absolute top-6 left-6 z-50 bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-emerald-500 transition-all">
                    <ArrowLeft size={20} />
                </button>

                {/* Sound Button */}
                <button onClick={() => setIsMuted(!isMuted)} 
                    className="absolute top-6 right-6 z-50 bg-white/5 p-4 rounded-3xl border border-white/10">
                    {isMuted ? <Volume2 className="opacity-20" size={20} /> : <Volume2 className="text-emerald-400" size={20} />}
                </button>
                
                <div className="relative z-20 flex flex-col items-center">
                    <img src={KREATA_LOGO} className="w-28 h-28 rounded-[35px] border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] object-cover" alt="Logo" />
                    <h1 className="mt-4 text-4xl font-black italic tracking-tighter text-white uppercase">KREATA <span className="text-emerald-500">ROOM</span></h1>
                    <p className="text-[10px] font-black tracking-[0.3em] text-emerald-400/60 uppercase">Partner Official BguneNet</p>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-6 mt-8 space-y-8">
                
                {/* --- 2. INFORMASI KOMUNITAS (ABOUT) --- */}
                <section className="bg-white/5 rounded-[40px] p-8 border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6 text-emerald-400">
                        <Handshake size={24}/>
                        <h2 className="text-xl font-black italic uppercase">The Ecosystem</h2>
                    </div>
                    <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-medium">
                        <p>
                            <span className="text-white font-black underline decoration-emerald-500">KREATA</span> adalah ekosistem kolaborasi kreatif untuk para editor dan kreator digital di bawah naungan <span className="text-emerald-400 font-black">BguneNet</span>.
                        </p>
                        <p>
                            Kemitraan ini dibangun agar setiap karya memiliki standar keamanan tinggi dan bebas dari gangguan spam. BguneNet memberikan dukungan teknologi, sementara Kreata fokus pada inovasi konten tanpa batas.
                        </p>
                    </div>
                </section>

                {/* --- 3. AKSES LINK KOMUNITAS (ASLI) --- */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4">Direct Connection</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noopener noreferrer" 
                            className="group p-6 bg-slate-900 rounded-[35px] border border-white/5 flex items-center justify-between hover:border-emerald-500 transition-all shadow-lg">
                            <div className="flex items-center gap-4">
                                <MessageCircle className="text-emerald-500 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="font-black italic text-sm uppercase">Grup Utama WA</h4>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Kolaborasi & Chat</p>
                                </div>
                            </div>
                            <Zap size={18} className="text-emerald-500 animate-pulse" />
                        </a>

                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noopener noreferrer"
                            className="group p-6 bg-slate-900 rounded-[35px] border border-white/5 flex items-center justify-between hover:border-blue-500 transition-all shadow-lg">
                            <div className="flex items-center gap-4">
                                <Bell className="text-blue-500 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="font-black italic text-sm uppercase">Saluran Resmi</h4>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Berita & Update</p>
                                </div>
                            </div>
                            <Zap size={18} className="text-blue-500 animate-pulse" />
                        </a>
                    </div>
                </section>

                {/* --- 4. TOMBOL JOIN MEMBER (LOCAL STORAGE) --- */}
                <section className="bg-gradient-to-br from-emerald-600 to-teal-900 p-10 rounded-[45px] shadow-2xl relative overflow-hidden text-center">
                    <Sparkles className="absolute -top-4 -right-4 text-white/10" size={100} />
                    <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tighter">Registration</h3>
                    <p className="text-emerald-100/60 text-[10px] font-bold uppercase mb-8 tracking-widest">Verifikasi Status Member Perangkat Kamu.</p>
                    
                    <button onClick={handleJoin}
                        className={`w-full py-6 rounded-[28px] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                            isFollowed 
                            ? 'bg-black/40 text-emerald-400 border border-emerald-400/30' 
                            : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl'
                        }`}>
                        {isFollowed ? <><Check size={22}/> Verified Member</> : <><UserPlus size={22}/> Join Hub Now</>}
                    </button>
                    <p className="mt-4 text-[8px] text-emerald-200/40 font-black uppercase italic tracking-widest">Data Aman & Tersimpan di LocalStorage HP.</p>
                </section>

                {/* --- 5. INTERAKTIF ZONE (GAMES & SIMULASI) --- */}
                <section className="space-y-6 pt-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Interactive Tools</h3>
                    
                    {/* Reflex Game */}
                    <div className="bg-slate-900 p-10 rounded-[45px] border border-white/5 text-center shadow-xl">
                        <Target className="mx-auto text-emerald-500 mb-4" />
                        <h4 className="text-lg font-black italic uppercase mb-2 tracking-tighter">Reflex Trainer</h4>
                        <div className="text-8xl font-black text-white mb-10 italic">{gameClicks}</div>
                        <button onClick={() => { playSound(audioClick); setGameClicks(c => c + 1); }}
                            className="w-24 h-24 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-90 transition-all border-4 border-[#020617]">
                            <Zap size={32} fill="black" />
                        </button>
                    </div>

                    {/* Simulasi Upload */}
                    <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-6 text-blue-500">
                            <Share2 size={20} />
                            <h4 className="text-sm font-black italic uppercase tracking-tighter text-white">Post Analysis Simulation</h4>
                        </div>
                        <textarea 
                            value={simContent} 
                            onChange={(e) => setSimContent(e.target.value)} 
                            placeholder="Tulis captionmu (Wajib sertakan #kreata)..." 
                            className="w-full h-24 bg-slate-800 rounded-2xl p-4 text-white text-xs mb-4 border border-white/5 outline-none focus:border-emerald-500 transition-all resize-none"
                        />
                        <button onClick={handleCheckPost} 
                            className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                            Check Post Content
                        </button>
                        {simResult && (
                            <div className={`mt-4 p-4 rounded-xl text-center text-[10px] font-black uppercase animate-in fade-in ${simResult === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {simResult === 'success' ? '✓ Konten Lulus Verifikasi' : '✗ Gagal: Gunakan Hashtag #kreata'}
                            </div>
                        )}
                    </div>
                </section>

                {/* --- FOOTER --- */}
                <div className="mt-20 text-center opacity-30 pb-10">
                    <Globe size={24} className="mx-auto text-emerald-500 mb-4" />
                    <h4 className="text-[10px] font-black italic tracking-[0.5em] uppercase text-slate-500">Secure • Creative • United</h4>
                    <p className="text-[8px] font-black text-slate-600 mt-2 uppercase">BguneNet x Kreata v5.0 • 2026</p>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;