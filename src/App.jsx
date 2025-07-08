import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import {
    Search, Brain, BookOpen, Youtube, Lightbulb, FileText, ArrowLeft, Loader, Sparkles,
    AlertTriangle, X, School, FlaskConical, Globe, Calculator, Dna, BarChart2, Drama,
    Computer, BookHeart, Landmark, Languages, HelpCircle, Atom, CheckCircle, ChevronRight,
    BrainCircuit, History, BookMarked, Github, Instagram, CalendarDays
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- STYLING & ANIMASI ---
const motionVariants = {
    screen: { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { type: "spring", stiffness: 300, damping: 30 } },
    item: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 300, damping: 20 } },
    button: { hover: { scale: 1.05, transition: { type: 'spring', stiffness: 400, damping: 10 } }, tap: { scale: 0.95 } }
};

// --- KONFIGURASI PENTING ---
// Catatan: Sebaiknya simpan API Key di environment variable untuk keamanan.
const GEMINI_API_KEY = "AIzaSyArJ1P8HanSQ_XVWX9m4kUlsIVXrBRInik";

// --- App Context ---
const AppContext = createContext(null);

// --- Custom Hook untuk LocalStorage ---
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`[LocalStorage] Gagal mengambil data untuk key: ${key}`, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`[LocalStorage] Gagal menyimpan data untuk key: ${key}`, error);
        }
    };
    return [storedValue, setValue];
}

// --- Data Kurikulum & Ikon ---
const curriculum = {
  'SD': { subjects: [{ name: 'Matematika', iconName: 'Calculator' }, { name: 'IPAS', iconName: 'Globe' }, { name: 'Pendidikan Pancasila', iconName: 'Landmark' }, { name: 'Bahasa Indonesia', iconName: 'BookHeart' }] },
  'SMP': { subjects: [{ name: 'Matematika', iconName: 'Calculator' }, { name: 'IPA Terpadu', iconName: 'FlaskConical' }, { name: 'IPS Terpadu', iconName: 'Globe' }, { name: 'Pendidikan Pancasila', iconName: 'Landmark'}, { name: 'Bahasa Indonesia', iconName: 'BookHeart' }, { name: 'Bahasa Inggris', iconName: 'Languages' }, { name: 'Informatika', iconName: 'Computer' }] },
  'SMA': { tracks: { 'IPA': [{ name: 'Matematika Peminatan', iconName: 'Calculator' }, { name: 'Fisika', iconName: 'Atom' }, { name: 'Kimia', iconName: 'FlaskConical' }, { name: 'Biologi', iconName: 'Dna' }], 'IPS': [{ name: 'Ekonomi', iconName: 'BarChart2' }, { name: 'Geografi', iconName: 'Globe' }, { name: 'Sosiologi', iconName: 'School' }], 'Bahasa': [{ name: 'Sastra Indonesia', iconName: 'BookHeart' }, { name: 'Sastra Inggris', iconName: 'Drama' }, { name: 'Antropologi', iconName: 'Globe' }, { name: 'Bahasa Asing', iconName: 'Languages' }] } }
};
const iconMap = { School, Brain, BookOpen, Youtube, Lightbulb, FileText, ArrowLeft, Loader, Sparkles, AlertTriangle, X, FlaskConical, Globe, Calculator, Dna, BarChart2, Drama, Computer, BookHeart, Landmark, Languages, HelpCircle, Atom, CheckCircle, ChevronRight, BrainCircuit, History, BookMarked, Github, Instagram, CalendarDays };

// --- API Helper & Utilities ---
const callGeminiAPI = async (prompt, isJson = true) => {
    console.log("[API Call] Memanggil Gemini API...");
    if (!GEMINI_API_KEY) throw new Error("Kunci API Gemini belum diatur.");
    // Model yang digunakan adalah gemini-1.5-flash. Anda bisa menggantinya jika perlu.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            // Menaikkan timeout tidak bisa dilakukan di client, ini hanya contoh konfigurasi.
            // Batas waktu sesungguhnya diatur oleh server Google.
        }
    };

    if (isJson) {
        payload.generationConfig.response_mime_type = "application/json";
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Permintaan API gagal: ${errorBody.error?.message || 'Error tidak diketahui'}`);
        }

        const result = await response.json();
        console.log("[API Success] Respons diterima dari Gemini.");
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Respons API tidak valid atau kosong.");

        // Membersihkan markdown jika respons JSON terbungkus di dalamnya
        const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
        return isJson ? JSON.parse(cleanedText) : cleanedText;

    } catch (error) {
        console.error("[API Exception] Terjadi kesalahan:", error);
        throw error;
    }
};

/**
 * Mengekstrak URL tontonan YouTube standar dari kode embed HTML.
 * Ini akan digunakan untuk tombol "Tonton di YouTube" sebagai fallback.
 * @param {string} embedCode Kode embed HTML lengkap dari Gemini.
 * @returns {string|null} URL tontonan YouTube standar (misal: "https://www.youtube.com/watch?v=VIDEO_ID") atau null jika gagal.
 */
const getYouTubeWatchUrlFromEmbedCode = (embedCode) => {
    if (!embedCode || typeof embedCode !== 'string') return null;

    let videoId = null;
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
    const url = srcMatch ? srcMatch[1] : embedCode;

    // Coba ekstrak ID dari berbagai pola URL YouTube
    const idMatch = url.match(/(?:youtube\.com\/(?:embed\/|v\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (idMatch) {
        videoId = idMatch[1];
    }

    if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return null;
};


// --- App Provider ---
const AppProvider = ({ children }) => {
    const [screen, setScreen] = useState('levelSelection');
    const [level, setLevel] = useState('');
    const [track, setTrack] = useState('');
    const [subject, setSubject] = useState(null);
    const [learningData, setLearningData] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [bankSoal, setBankSoal] = useState([]);
    const [history, setHistory] = useLocalStorage('bdukasi-expert-history-v5', []); // Versi baru
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState(null);
    const [modal, setModal] = useState({ type: null, data: null });

    const contextValue = useMemo(() => ({ level, track, subject }), [level, track, subject]);

    const addHistory = useCallback((item) => setHistory(prev => [item, ...prev.filter(h => h.topic !== item.topic)].slice(0, 50)), [setHistory]);

    // --- FUNGSI FETCH MATERI (DIPERBARUI) ---
    const fetchLearningMaterial = useCallback(async (searchTopic, isFromHistory = false) => {
        console.log(`[Fetch Materi] Memulai untuk topik: "${searchTopic}"`);
        if (!searchTopic || !contextValue.level || !contextValue.subject) {
             console.error("[Fetch Materi] Gagal: Konteks tidak lengkap (level/mapel belum dipilih)."); return;
        }
        setIsLoading(true); setLoadingMessage('AI sedang menyusun materi lengkap untukmu, mohon tunggu...'); setError(null);
        setLearningData(null); setScreen('lesson');
        const { level, track, subject } = contextValue;
        if (!isFromHistory) addHistory({ topic: searchTopic, level, track, subjectName: subject.name });

        // Prompt meminta kode_embed langsung, seperti yang sudah berhasil Anda tempel manual
        const prompt = `
        Sebagai seorang ahli materi pelajaran, tolong proses permintaan berikut:
        "Buatkan saya ringkasan dan materi lengkap tentang '${searchTopic}' untuk siswa ${level} ${track ? `jurusan ${track}`: ''} mata pelajaran '${subject.name}'. Beserta video YouTube pembelajaran yang relevan, sertakan dalam bentuk kode embed HTML iframe lengkap."

        Tolong berikan respons HANYA dalam format JSON yang valid dan bersih dengan struktur berikut:
        {
          "judul_video": "Judul video YouTube yang relevan",
          "kode_embed": "<iframe width='560' height='315' src='https://www.youtube.com/embed/VIDEO_ID' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' allowFullScreen id='youtube-embed-UNIQUE_ID'></iframe>",
          "ringkasan": "Ringkasan singkat dan padat mengenai topik '${searchTopic}'.",
          "materi_lengkap": "Penjelasan materi yang komprehensif dan terstruktur dengan baik dalam format Markdown. Gunakan heading, list, dan tebal untuk keterbacaan.",
          "latihan_soal": [
            {
              "question": "Pertanyaan pertama terkait materi.",
              "options": ["A. Opsi A", "B. Opsi B", "C. Opsi C", "D. Opsi D", "E. Opsi E"],
              "correctAnswer": "A",
              "explanation": "Penjelasan mengapa jawaban A adalah yang benar."
            }
          ]
        }
        Pastikan kode embed YouTube valid (src mengarah ke youtube.com/embed/VIDEO_ID) dan materi lengkap ditulis dalam format Markdown.
        `;

        try {
            const data = await callGeminiAPI(prompt);
            // Kita akan langsung menggunakan data.kode_embed untuk dangerouslySetInnerHTML
            // Dan ekstrak URL tontonan untuk fallback link
            data.youtubeWatchUrl = getYouTubeWatchUrlFromEmbedCode(data.kode_embed);

            setLearningData({ topic: searchTopic, ...data });
            console.log("[Fetch Materi] Sukses, data materi diatur. Kode embed diterima:", data.kode_embed);
            console.log("[Fetch Materi] URL Tontonan YouTube untuk fallback:", data.youtubeWatchUrl);
        } catch (err) {
            console.error("[Fetch Materi] Error:", err);
            setError(`Gagal memuat materi: ${err.message}. Coba lagi nanti.`); setScreen('subjectDashboard');
        } finally { setIsLoading(false); }
    }, [contextValue, addHistory]);

    const fetchRecommendations = useCallback(async () => {
        console.log("[Fetch Rekomendasi] Memulai...");
        if (!contextValue.level || !contextValue.subject) return;
        const { level, track, subject } = contextValue;
        const prompt = `Berikan 5 rekomendasi topik yang menarik untuk dipelajari dalam mata pelajaran "${subject.name}" untuk siswa level ${level} ${track ? `jurusan ${track}`: ''}. Jawab HANYA dalam format JSON array berisi string. Contoh: ["Topik 1", "Topik 2"]`;
        try {
            const recs = await callGeminiAPI(prompt); setRecommendations(Array.isArray(recs) ? recs : []);
        } catch (err) { console.error("Gagal fetch rekomendasi:", err); setRecommendations([]); }
    }, [contextValue]);

    // --- FUNGSI FETCH BANK SOAL (DIPERBARUI) ---
    const fetchBankSoal = useCallback(async (topic, count) => {
        console.log(`[Fetch Bank Soal] Memulai untuk topik: "${topic}" sejumlah ${count} soal.`);
        if (!topic || !contextValue.level || !contextValue.subject || !count) {
             console.error("[Fetch Bank Soal] Gagal: Topik, jumlah soal, atau konteks pelajaran tidak lengkap.");
             setError("Harap masukkan topik dan jumlah soal yang valid.");
             return;
        }
        setIsLoading(true); setLoadingMessage(`AI sedang membuat ${count} soal untuk topik "${topic}"...`); setError(null);

        const { level, track, subject } = contextValue;

        // Prompt diperbarui untuk menerima jumlah soal
        const prompt = `
        Tolong proses permintaan berikut:
        "Buatkan saya soal tentang '${topic}' berjumlah ${count} butir untuk mata pelajaran '${subject.name}' level ${level} ${track ? `jurusan ${track}` : ''}. Setiap soal harus dalam bentuk pilihan ganda (A, B, C, D, E) beserta jawaban dan penjelasan yang jelas."

        Berikan respons HANYA dalam format JSON array dari objek, dengan struktur berikut:
        [
          {
            "question": "Isi pertanyaan di sini.",
            "options": ["A. Opsi jawaban A", "B. Opsi jawaban B", "C. Opsi jawaban C", "D. Opsi jawaban D", "E. Opsi jawaban E"],
            "correctAnswer": "A",
            "explanation": "Penjelasan detail mengapa jawaban tersebut benar dan yang lain salah."
          }
        ]
        `;
        try {
            const soal = await callGeminiAPI(prompt);
            setBankSoal(Array.isArray(soal) ? soal : []);
            setScreen('bankSoal');
        } catch(err) {
            setError(`Gagal membuat bank soal: ${err.message}`);
            setScreen('subjectDashboard');
        } finally {
            setIsLoading(false);
        }
    }, [contextValue]);

    const fetchStudyPlan = useCallback(async (goal) => {
        console.log(`[Fetch Rencana Belajar] Memulai untuk tujuan: "${goal}"`);
        if (!goal || !contextValue.subject) return;
        setModal({ type: 'loading', data: 'AI sedang membuat Rencana Belajar...' });
        const { subject, level, track } = contextValue;
        const prompt = `Buat rencana belajar mingguan untuk mencapai tujuan: "${goal}" dalam mata pelajaran ${subject.name} untuk siswa ${level} ${track}. Jawab HANYA dalam JSON: {"title": "Rencana Belajar: ${goal}", "plan": [{"week": 1, "focus": "...", "tasks": ["...", "..."]}]}`;
        try { setModal({ type: 'studyPlan', data: await callGeminiAPI(prompt) });
        } catch(err) { setModal({ type: 'error', data: err.message }); }
    }, [contextValue]);

    const value = { screen, setScreen, level, setLevel, track, setTrack, subject, setSubject, learningData, recommendations, fetchRecommendations, bankSoal, fetchBankSoal, isLoading, error, setError, history, fetchLearningMaterial, modal, setModal, fetchStudyPlan };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// --- Komponen Utama & Layout ---
export default function App() {
    return (
        <AppProvider>
            <div className="bg-gray-900 min-h-screen text-gray-200 font-sans overflow-hidden relative">
                <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20"></div>
                <ScreenContainer />
                <ModalContainer />
            </div>
        </AppProvider>
    );
}

const ScreenContainer = () => {
    const { screen, isLoading, loadingMessage } = useContext(AppContext);
    if (isLoading) return <LoadingSpinner message={loadingMessage} />;
    const screens = {
        levelSelection: <LevelSelectionScreen key="level" />,
        trackSelection: <TrackSelectionScreen key="track" />,
        subjectSelection: <SubjectSelectionScreen key="subject" />,
        subjectDashboard: <SubjectDashboardScreen key="dashboard" />,
        lesson: <LearningMaterialScreen key="lesson" />,
        bankSoal: <BankSoalScreen key="bankSoal" />,
    };
    return <div className="relative h-full w-full">{screens[screen]}</div>;
};

// --- Komponen UI, Ilustrasi, & Modal ---
const DynamicIcon = ({ name, ...props }) => { const IconComponent = iconMap[name]; return IconComponent ? <IconComponent {...props} /> : <HelpCircle {...props} />; };
const AnimatedScreen = ({ children, customKey }) => <div key={customKey} className="p-4 sm:p-8 max-w-5xl mx-auto" style={{animation: 'screenIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards'}}>{children}</div>;
const BackButton = ({ onClick }) => <button onClick={onClick} className="flex items-center gap-2 text-blue-400 font-semibold hover:underline mb-8 absolute top-8 left-8 z-10"><ArrowLeft size={20} /> Kembali</button>;
const InfoCard = ({ icon, title, children, className = '' }) => <div className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg overflow-hidden ${className}`} style={{animation: 'fadeInUp 0.5s ease-out forwards'}}><div className="p-4 border-b border-gray-700 flex items-center gap-3">{icon && <div className="text-blue-400">{React.cloneElement(icon, { size: 24 })}</div>}<h2 className="text-xl font-bold text-gray-100">{title}</h2></div><div className="p-4 sm:p-6">{children}</div></div>;
const LoadingSpinner = ({ message }) => <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900"><Loader className="w-16 h-16 text-blue-500 animate-spin" /><p className="text-xl font-semibold mt-6 text-gray-300 text-center max-w-md">{message || 'AI sedang menyusun materi...'}</p></div>;
const ErrorMessage = ({ message }) => <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 p-4 rounded-r-lg mt-4 w-full max-w-xl mx-auto flex items-center gap-4"><AlertTriangle className="h-6 w-6 text-red-500" /><p className="font-bold">{message}</p></div>;
const Illustration = ({ className }) => <div className={`absolute -bottom-12 -right-12 w-64 h-64 opacity-10 ${className}`}><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path fill="#2563EB" d="M47.8,-70.7C61.4,-62.4,71.5,-48,77.4,-32.4C83.3,-16.8,85,0.2,80.1,15.1C75.2,30,63.7,42.8,51,52.3C38.3,61.8,24.3,68.1,9.8,70.5C-4.7,73,-19.8,71.7,-33.8,66.2C-47.8,60.7,-60.6,51,-68.8,38.5C-77,26,-80.6,10.7,-79.9,-4.6C-79.2,-19.9,-74.3,-35.1,-64.7,-46.8C-55.2,-58.5,-41,-66.7,-26.9,-72C-12.8,-77.3,-6.4,-79.8,2.7,-82.2C11.8,-84.7,23.6,-87.3,34.1,-82.8C44.6,-78.3,54.2,-66.8,47.8,-70.7Z" transform="translate(100 100) scale(1.2)" /></svg></div>;

const ModalContainer = () => {
    const { modal, setModal } = useContext(AppContext);
    if (!modal.type) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal({ type: null, data: null })}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()} style={{animation: 'fadeInUp 0.3s ease-out forwards'}}>
                {modal.type === 'loading' && <div className="p-8 flex flex-col items-center gap-4"><Loader className="animate-spin" size={48} /><span>{modal.data}</span></div>}
                {modal.type === 'error' && <div className="p-8"><ErrorMessage message={modal.data} /></div>}
                {modal.type === 'studyPlan' && (
                    <div className="p-6">
                        <h3 className="text-2xl font-bold mb-4">{modal.data?.title || "Rencana Belajar"}</h3>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">{modal.data.plan?.map((week, i) => (<div key={i}><h4 className="font-bold text-lg text-blue-400">Minggu {week.week}: {week.focus}</h4><ul className="list-disc list-inside text-gray-300 mt-1">{week.tasks.map((task, j) => <li key={j}>{task}</li>)}</ul></div>))}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Screen Components ---
const LevelSelectionScreen = () => {
    const { setScreen, setLevel } = useContext(AppContext);
    return (
        <AnimatedScreen customKey="level">
            <div className="flex flex-col min-h-screen justify-center">
                <div className="text-center pt-16 relative">
                    <Illustration className="!w-96 !h-96 -top-24 -left-24" />
                    <Brain className="w-24 h-24 mx-auto text-blue-400 animate-pulse" />
                    <h1 className="text-5xl font-bold mt-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Bdukasi Expert</h1>
                    <p className="text-xl text-gray-400 mt-2 mb-12">Pilih jenjang pendidikanmu untuk memulai petualangan belajar.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Object.keys(curriculum).map((lvl, index) => <button key={lvl} onClick={() => { setLevel(lvl); setScreen(lvl === 'SMA' ? 'trackSelection' : 'subjectSelection'); }} className="p-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg hover:shadow-blue-500/20 hover:border-blue-500 hover:-translate-y-2 transition-all text-2xl font-bold flex flex-col items-center justify-center gap-4 cursor-pointer" style={{...motionVariants.item, animation: `fadeInUp 0.5s ease-out ${index * 0.1 + 0.3}s forwards`}}><School size={40} /> {lvl}</button>)}
                    </div>
                </div>
                <div className="mt-auto"><Footer/></div>
            </div>
        </AnimatedScreen>
    );
};

const TrackSelectionScreen = () => {
    const { setScreen, setTrack } = useContext(AppContext);
    return (
        <AnimatedScreen customKey="track">
            <BackButton onClick={() => setScreen('levelSelection')} />
            <div className="text-center pt-16">
                <h1 className="text-4xl font-bold mb-12">Pilih Jurusan</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {Object.keys(curriculum.SMA.tracks).map((trackName, index) => <button key={trackName} onClick={() => { setTrack(trackName); setScreen('subjectSelection'); }} className="p-8 bg-gray-800/50 border border-gray-700 rounded-2xl shadow-lg hover:shadow-blue-500/20 hover:border-blue-500 hover:-translate-y-2 transition-all text-2xl font-bold" style={{...motionVariants.item, animation: `fadeInUp 0.5s ease-out ${index * 0.1 + 0.3}s forwards`}}>{trackName}</button>)}
                </div>
            </div>
        </AnimatedScreen>
    );
};

const SubjectSelectionScreen = () => {
    const { level, track, setScreen, setSubject } = useContext(AppContext);
    const subjects = level === 'SMA' ? curriculum.SMA.tracks[track] : curriculum[level].subjects;
    const backScreen = level === 'SMA' ? 'trackSelection' : 'levelSelection';

    return (
        <AnimatedScreen customKey="subject">
             <BackButton onClick={() => setScreen(backScreen)} />
            <div className="pt-16">
                 <h1 className="text-4xl font-bold mb-12 text-center">Pilih Mata Pelajaran</h1>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {subjects.map((s, index) => <button key={s.name} onClick={() => { setSubject(s); setScreen('subjectDashboard'); }} className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col items-center justify-center text-center hover:border-blue-500 hover:-translate-y-1 transition-all aspect-square shadow-lg" style={{...motionVariants.item, animation: `fadeInUp 0.5s ease-out ${index * 0.05 + 0.3}s forwards`}}><DynamicIcon name={s.iconName} size={48} className="text-blue-400" /><span className="font-semibold text-gray-200 text-sm text-center mt-3">{s.name}</span></button>)}
                </div>
            </div>
        </AnimatedScreen>
    );
};

const SubjectDashboardScreen = () => {
    const { subject, fetchLearningMaterial, fetchRecommendations, recommendations, error, setError, history, setScreen } = useContext(AppContext);
    const [inputValue, setInputValue] = useState('');
    const [activeTab, setActiveTab] = useState('rekomendasi');

    useEffect(() => { if (subject && recommendations.length === 0) fetchRecommendations(); }, [subject, fetchRecommendations, recommendations.length]);

    if (!subject) return <div>Pilih mata pelajaran.</div>;

    const filteredHistory = history.filter(h => h.subjectName === subject.name);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if(inputValue.trim()) {
            setError(null);
            fetchLearningMaterial(inputValue);
        } else {
            setError("Topik pencarian tidak boleh kosong.");
        }
    };

    return (
        <AnimatedScreen customKey="dashboard">
            <BackButton onClick={() => setScreen('subjectSelection')} />
            <div className="text-center pt-16"><DynamicIcon name={subject.iconName} size={80} className="text-blue-400 mx-auto mb-4" /><h1 className="text-5xl font-bold">Mata Pelajaran: {subject.name}</h1></div>
            <div className="w-full max-w-2xl mx-auto my-12">
                <form onSubmit={handleSearchSubmit}>
                    <div className="relative">
                        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Ketik topik untuk dipelajari..." className="w-full pl-6 pr-16 py-4 text-lg bg-gray-700 border-2 border-gray-600 rounded-full focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"/>
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-transform active:scale-95"><Search className="w-6 h-6" /></button>
                    </div>
                     {error && <ErrorMessage message={error} />}
                </form>
            </div>
            <div className="max-w-4xl mx-auto"><div className="flex justify-center border-b border-gray-700 mb-6 flex-wrap">{['rekomendasi', 'riwayat', 'bank_soal', 'rencana'].map(tab => <TabButton key={tab} icon={{rekomendasi: <Sparkles/>, riwayat: <History/>, bank_soal: <BrainCircuit/>, rencana: <CalendarDays/>}[tab]} text={{rekomendasi: "Rekomendasi", riwayat: "Riwayat", bank_soal: "Bank Soal", rencana: "Rencana Belajar"}[tab]} isActive={activeTab===tab} onClick={() => setActiveTab(tab)}/>)}</div>
                <div style={{animation: 'fadeInUp 0.5s ease-out forwards'}}>
                    {activeTab === 'rekomendasi' && (recommendations.length > 0 ? <div className="grid md:grid-cols-2 gap-4">{recommendations.map((rec,i)=>(<ListItem key={i} text={rec} onClick={()=>fetchLearningMaterial(rec)}/>))}</div> : <p className="text-center text-gray-500">Tidak ada rekomendasi topik saat ini.</p>)}
                    {activeTab === 'riwayat' && (filteredHistory.length > 0 ? <div className="grid md:grid-cols-2 gap-4">{filteredHistory.map((h,i)=>(<ListItem key={i} text={h.topic} onClick={()=>fetchLearningMaterial(h.topic, true)}/>))}</div> : <p className="text-center text-gray-500">Anda belum memiliki riwayat belajar untuk mata pelajaran ini.</p>)}
                    {activeTab === 'bank_soal' && <BankSoalGenerator />}
                    {activeTab === 'rencana' && <StudyPlanGenerator />}
                </div>
            </div>
             <Footer />
        </AnimatedScreen>
    );
};

const StudyPlanGenerator = () => {
    const { fetchStudyPlan } = useContext(AppContext);
    const [goal, setGoal] = useState('');
    return (
        <div className="max-w-xl mx-auto bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-bold text-center mb-4">✨ Buat Rencana Belajar Kustom</h3>
            <p className="text-center text-gray-400 mb-4">Masukkan tujuan belajarmu, dan biarkan AI menyusun jadwal mingguan untukmu.</p>
            <form onSubmit={e => {e.preventDefault(); if(goal.trim()) fetchStudyPlan(goal)}}>
                <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder='Contoh: Menguasai turunan dalam 1 minggu' className='w-full p-3 bg-gray-700 rounded-lg border border-gray-600 mb-4' />
                <button type="submit" disabled={!goal.trim()} className="w-full p-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Buatkan Rencana!</button>
            </form>
        </div>
    );
};

// --- KOMPONEN BANK SOAL GENERATOR (DIPERBARUI) ---
const BankSoalGenerator = () => {
    const { fetchBankSoal, setError } = useContext(AppContext);
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(5); // State untuk jumlah soal

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!topic.trim()) {
            setError("Topik soal tidak boleh kosong.");
            return;
        }
        if (count < 1 || count > 20) {
            setError("Jumlah soal harus antara 1 dan 20.");
            return;
        }
        setError(null);
        fetchBankSoal(topic, count);
    };

    return (
        <div className="max-w-xl mx-auto bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-bold text-center mb-4">🎯 Bank Soal Berbasis Topik</h3>
            <p className="text-center text-gray-400 mb-4">Masukkan topik spesifik dan jumlah soal yang diinginkan.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder='Contoh: Perang Diponegoro'
                    className='w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500'
                />
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="number"
                        value={count}
                        onChange={e => setCount(parseInt(e.target.value, 10))}
                        min="1"
                        max="20" // Batasi agar tidak terlalu banyak
                        placeholder="Jumlah Soal"
                        className='w-full sm:w-1/3 p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500'
                    />
                    <button type="submit" className="w-full sm:w-2/3 p-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500">
                        Buatkan Soal Latihan!
                    </button>
                </div>
            </form>
        </div>
    );
}

const TabButton = ({icon, text, isActive, onClick}) => <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 sm:px-6 font-semibold border-b-2 transition-all ${isActive ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-blue-400'}`}>{React.cloneElement(icon, {size: 20})} <span className="hidden sm:inline">{text}</span></button>;
const ListItem = ({text, onClick}) => <button onClick={onClick} className="w-full text-left flex justify-between items-center p-4 bg-gray-800/50 border border-gray-700 hover:border-blue-500 rounded-lg transition-all"><span className="font-semibold">{text}</span><ChevronRight /></button>;

const LearningMaterialScreen = () => {
    const { learningData, setScreen } = useContext(AppContext);
    if (!learningData) return <div className="text-center p-8">Materi tidak ditemukan atau gagal dimuat. <button onClick={() => setScreen('subjectDashboard')} className="text-blue-500 underline">Kembali ke Dashboard</button></div>;
    const { topic, ringkasan, materi_lengkap, judul_video, kode_embed, youtubeWatchUrl, latihan_soal } = learningData;

    useEffect(() => {
        // Log kode_embed saat komponen ini dirender untuk debugging
        console.log("[LearningMaterialScreen] Kode embed yang diterima:", kode_embed);
        console.log("[LearningMaterialScreen] URL tontonan untuk fallback:", youtubeWatchUrl);
    }, [kode_embed, youtubeWatchUrl]);


    return (
        <AnimatedScreen customKey="lesson">
            <BackButton onClick={() => setScreen('subjectDashboard')} />
            <div className="space-y-8 pt-16">
                <h1 className="text-3xl sm:text-5xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">{topic}</h1>
                {judul_video && kode_embed ? (
                    <InfoCard icon={<Youtube />} title={judul_video}>
                        <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden shadow-lg">
                            {/* Render iframe langsung menggunakan dangerouslySetInnerHTML */}
                            {/* Tambahkan key unik berdasarkan kode_embed untuk memaksa React me-remount iframe */}
                            <div
                                key={kode_embed}
                                dangerouslySetInnerHTML={{ __html: kode_embed }}
                                // Pastikan iframe responsif
                                style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
                            />
                        </div>
                        {/* Tombol fallback jika video tidak bisa di-embed */}
                        <div className="text-center mt-4">
                            <p className="text-gray-400 text-sm mb-2">Jika video tidak dapat diputar di sini, coba tonton langsung di YouTube:</p>
                            {youtubeWatchUrl && (
                                <a href={youtubeWatchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold">
                                    <Youtube size={20} className="mr-2"/> Tonton di YouTube
                                </a>
                            )}
                        </div>
                    </InfoCard>
                ) : (
                    <InfoCard icon={<Youtube />} title="Video Pembelajaran">
                        <p className="text-center text-gray-400">Maaf, video pembelajaran tidak tersedia atau tidak dapat dimuat saat ini.</p>
                        <p className="text-center text-gray-500 text-sm mt-2">Ini mungkin disebabkan oleh video yang tidak ada, pembatasan geografis, atau masalah teknis dengan video yang diberikan oleh AI.</p>
                        <p className="text-center text-gray-500 text-sm mt-2">Coba topik lain atau periksa kembali koneksi internet Anda.</p>
                    </InfoCard>
                )}
                {ringkasan && <InfoCard icon={<Lightbulb />} title="Ringkasan"><p className="text-gray-300 leading-relaxed">{ringkasan}</p></InfoCard>}
                {materi_lengkap && <InfoCard icon={<BookOpen />} title="Materi Lengkap"><div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-100"><ReactMarkdown>{materi_lengkap}</ReactMarkdown></div></InfoCard>}
                {latihan_soal?.length > 0 && <InfoCard icon={<BookMarked />} title="Latihan Soal"><QuizPlayer questions={latihan_soal} /></InfoCard>}
            </div>
             <Footer />
        </AnimatedScreen>
    );
};

const BankSoalScreen = () => {
    const { bankSoal, setScreen } = useContext(AppContext);
    return (
        <AnimatedScreen customKey="bankSoal">
            <BackButton onClick={() => setScreen('subjectDashboard')} />
            <div className="pt-16"><InfoCard title="Bank Soal Latihan">{bankSoal && bankSoal.length > 0 ? <QuizPlayer questions={bankSoal} /> : <p className="text-center text-gray-400 p-4">Gagal memuat soal atau tidak ada soal tersedia untuk topik ini. Silakan coba lagi.</p>}</InfoCard></div>
            <Footer />
        </AnimatedScreen>
    );
};

// --- Komponen Interaktif: QuizPlayer & Footer ---
const QuizPlayer = ({ questions }) => {
    const [answers, setAnswers] = useState({});
    const [isSubmitted, setSubmitted] = useState(false);

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return <p className="text-gray-400">Soal latihan tidak tersedia.</p>;
    }

    const score = useMemo(() => {
        if (!isSubmitted) return 0;
        return questions.reduce((acc, q, i) => {
            const selectedAnswer = answers[i];
            if (!selectedAnswer) return acc;

            // Dapatkan huruf jawaban yang benar dari q.correctAnswer (misal "A")
            const correctLetter = q.correctAnswer.trim().toUpperCase();

            // Dapatkan huruf dari opsi yang dipilih (misal "A" dari "A. Opsi A")
            const selectedLetter = selectedAnswer.trim().toUpperCase().charAt(0);

            return acc + (selectedLetter === correctLetter ? 1 : 0);
        }, 0);
    }, [answers, questions, isSubmitted]);

    return (
        <div className="space-y-8">
            {isSubmitted && <div className="text-center p-4 rounded-lg bg-blue-900/50 border border-blue-700"><h3 className="text-2xl font-bold">Skor Kamu: {Math.round((score / questions.length) * 100)}%</h3><p>Benar {score} dari {questions.length} pertanyaan.</p></div>}
            {questions.map((q, qIndex) => (
                <div key={qIndex}>
                    <p className="font-semibold text-lg mb-3">{qIndex + 1}. {q.question}</p>
                    <div className="space-y-2">{q.options?.map((opt, oIndex) => {
                        const isSelected = answers[qIndex] === opt;
                        // Dapatkan huruf jawaban yang benar dari q.correctAnswer (misal "A")
                        const correctLetter = q.correctAnswer.trim().toUpperCase();
                        // Dapatkan huruf dari opsi saat ini (misal "A" dari "A. Opsi A")
                        const optionLetter = opt.trim().toUpperCase().charAt(0);

                        const isCorrectOption = optionLetter === correctLetter;

                        let stateClass = "border-gray-600 hover:border-blue-500 hover:bg-gray-700";
                        if (isSubmitted) {
                            if (isCorrectOption) stateClass = "bg-green-800/60 border-green-500 text-white";
                            else if (isSelected && !isCorrectOption) stateClass = "bg-red-800/60 border-red-500 text-white";
                            else stateClass = "border-gray-700 text-gray-400"
                        } else if (isSelected) {
                            stateClass = "border-blue-500 bg-blue-900/50";
                        }
                        return <button key={oIndex} onClick={() => !isSubmitted && setAnswers(p => ({ ...p, [qIndex]: opt }))} disabled={isSubmitted} className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${stateClass} disabled:cursor-not-allowed`}>{opt}</button>})}
                    </div>
                    {isSubmitted && q.explanation && (
                        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg text-sm">
                            <p className="font-bold text-gray-200 flex items-center gap-2">
                                <CheckCircle size={16}/> Penjelasan:
                            </p>
                            <p className="text-gray-300 mt-2 pl-1">{q.explanation}</p>
                            {/* Menampilkan jawaban yang benar secara eksplisit */}
                            <p className="text-gray-300 mt-2 pl-1">
                                Jawaban yang benar adalah: <span className="font-bold text-green-400">{q.correctAnswer}</span>
                            </p>
                        </div>
                    )}
                </div>
            ))}
            <div className="pt-4">
            {!isSubmitted ? <button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length !== questions.length} className="w-full p-4 mt-6 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all">Kumpulkan Jawaban</button> : <button onClick={() => { setSubmitted(false); setAnswers({}); }} className="w-full p-4 mt-6 font-bold text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-all">Coba Lagi</button>}
            </div>
        </div>
    );
};

const Footer = () => (
    <footer className="w-full text-center p-8 mt-16 text-gray-500 text-sm">
        <p className="font-semibold text-lg text-gray-400 mb-2">Sebuah Karya dari</p>
        <p className="text-xl font-bold text-white">M. Irham Andika Putra</p>
        <p>Siswa SMPN 3 Mentok, Bangka Barat</p>
        <p>Owner Bgune - Digital & YouTuber "Pernah Mikir?"</p>
        <div className="flex justify-center gap-4 mt-4">
            <a href="https://www.youtube.com/@PernahMikirChannel" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Youtube/></a>
            <a href="https://github.com/irhamp" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Github/>/></a>
            <a href="https://www.instagram.com/irham_putra07" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Instagram/></a>
        </div>
        <p className="mt-6">Dibuat dengan <Sparkles className="inline h-4 w-4 text-yellow-400"/> dan Teknologi AI</p>
    </footer>
);

// --- Inject CSS for animations ---
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes screenIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.bg-grid-pattern { background-image: linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px); background-size: 2rem 2rem; }
.prose-invert h1, .prose-invert h2, .prose-invert h3, .prose-invert h4, .prose-invert strong { color: #f3f4f6; }
.prose-invert a { color: #60a5fa; }
.aspect-w-16 { position: relative; padding-bottom: 56.25%; /* 9 / 16 = 0.5625 */ }
.aspect-h-9 { height: 0; /* Untuk kombinasi aspect-w-16 dan padding-bottom */ }
.aspect-w-16 > div { /* Target the div containing the iframe */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex; /* Untuk memastikan iframe mengisi ruang */
    justify-content: center;
    align-items: center;
}
.aspect-w-16 > div > iframe { /* Target the iframe itself */
    width: 100%;
    height: 100%;
    border: none; /* Hapus border default iframe */
}
`;
document.head.appendChild(styleSheet);