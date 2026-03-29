import React, { useState, useEffect } from 'react';
import { 
  auth, db, handleFirestoreError, OperationType 
} from './firebase';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot, where, Timestamp, limit 
} from 'firebase/firestore';
import { analyzeEmotion, EmotionAnalysis } from './geminiService';
import { 
  Thermometer, Heart, MessageCircle, LogOut, Bell, User, Calendar, Send, AlertTriangle, CheckCircle2, ChevronRight, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface AppUser {
  uid: string;
  name: string;
  role: 'student' | 'teacher';
  studentNumber?: string;
  email: string;
}

interface EmotionEntry extends EmotionAnalysis {
  id: string;
  studentUid: string;
  studentName: string;
  studentNumber?: string;
  inputText: string;
  createdAt: Timestamp;
}

interface CounselingRequest {
  id: string;
  studentUid: string;
  studentName: string;
  status: 'pending' | 'approved' | 'completed';
  requestDate: Timestamp;
  message?: string;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as AppUser);
          } else {
            // New user, need role selection
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '익명',
              role: 'student', // Default, will be updated in setup
              email: firebaseUser.email || '',
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthError("로그인에 실패했습니다. 다시 시도해주세요.");
      console.error(error);
    }
  };

  const handleLogout = () => signOut(auth);

  const updateRole = async (role: 'student' | 'teacher', studentNumber?: string) => {
    if (!user) return;
    const updatedUser: AppUser = { ...user, role, studentNumber };
    try {
      await setDoc(doc(db, 'users', user.uid), updatedUser);
      setUser(updatedUser);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-blue-600"
        >
          <Thermometer size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} error={authError} />;
  }

  // If user exists but role is not saved in DB (first time)
  // We check if the doc exists in the useEffect, but for safety:
  if (!user.role) {
    return <RoleSelectionView onSelect={updateRole} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#333]">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Thermometer size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AI 감정 온도계</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user.name} {user.role === 'teacher' ? '선생님' : '학생'}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {user.role === 'student' ? (
          <StudentDashboard user={user} />
        ) : (
          <TeacherDashboard user={user} />
        )}
      </main>
    </div>
  );
}

// --- Sub-Views ---

function LoginView({ onLogin, error }: { onLogin: () => void, error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-white/20"
      >
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-200">
          <Thermometer size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">AI 감정 온도계</h1>
        <p className="text-gray-500 mb-8">우리 반 친구들의 마음을 이어주는 따뜻한 공간</p>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        <button 
          onClick={onLogin}
          className="w-full bg-white border border-gray-300 py-3 px-4 rounded-xl flex items-center justify-center gap-3 font-semibold hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google 계정으로 시작하기
        </button>
        
        <p className="mt-8 text-xs text-gray-400">
          초등학교 6학년 학생들의 정서 케어를 위한 서비스입니다.
        </p>
      </motion.div>
    </div>
  );
}

function RoleSelectionView({ onSelect }: { onSelect: (role: 'student' | 'teacher', studentNumber?: string) => void }) {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [studentNumber, setStudentNumber] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">역할을 선택해주세요</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button 
            onClick={() => setRole('student')}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'student' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <User size={32} />
            <span className="font-bold">학생</span>
          </button>
          <button 
            onClick={() => setRole('teacher')}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'teacher' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <User size={32} />
            <span className="font-bold">선생님</span>
          </button>
        </div>

        {role === 'student' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">학생 번호</label>
            <input 
              type="text" 
              placeholder="예: 6학년 1반 15번"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        )}

        <button 
          onClick={() => onSelect(role, studentNumber)}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
        >
          시작하기
        </button>
      </motion.div>
    </div>
  );
}

// --- Student Dashboard ---

function StudentDashboard({ user }: { user: AppUser }) {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<EmotionAnalysis | null>(null);
  const [history, setHistory] = useState<EmotionEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'daily_emotions'),
      where('studentUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmotionEntry));
      setHistory(entries);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeEmotion(inputText);
      setAnalysisResult(result);

      // Save to Firestore
      await addDoc(collection(db, 'daily_emotions'), {
        studentUid: user.uid,
        studentName: user.name,
        studentNumber: user.studentNumber,
        inputText,
        ...result,
        createdAt: Timestamp.now()
      });

      setInputText('');
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const requestCounseling = async () => {
    try {
      await addDoc(collection(db, 'counseling_requests'), {
        studentUid: user.uid,
        studentName: user.name,
        status: 'pending',
        requestDate: Timestamp.now(),
        message: "상담을 신청하고 싶어요."
      });
      alert("상담 요청이 선생님께 전달되었습니다.");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          오늘 기분은 어때요? <Heart className="text-red-400 fill-red-400" size={24} />
        </h2>
        <p className="text-gray-500 mb-6">지금 느끼는 감정을 자유롭게 적어보세요. 이모티콘도 좋아요!</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="예: 오늘 친구랑 싸워서 조금 속상해요... 😭"
            className="w-full h-32 p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-lg"
          />
          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={!inputText.trim() || isAnalyzing}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
            >
              {isAnalyzing ? "분석 중..." : "마음 전달하기"}
              <Send size={18} />
            </button>
          </div>
        </form>
      </section>

      <AnimatePresence>
        {analysisResult && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 p-8 rounded-3xl border border-blue-100 relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">AI 분석 결과</span>
                {analysisResult.requires_attention && (
                  <span className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                    <AlertTriangle size={16} /> 선생님께 알림이 전송되었습니다
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-bold mb-2">
                오늘의 감정은 <span className="text-blue-600">'{analysisResult.dominant_emotion}'</span> 이군요!
              </h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 bg-gray-200 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysisResult.intensity * 10}%` }}
                    className="bg-blue-500 h-full"
                  />
                </div>
                <span className="font-bold text-blue-600">강도 {analysisResult.intensity}/10</span>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white">
                <p className="text-lg leading-relaxed text-gray-800 italic">"{analysisResult.summary}"</p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 text-blue-100 opacity-50">
              <Heart size={200} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <History size={24} />
            </div>
            <div className="text-left">
              <h4 className="font-bold">나의 감정 기록</h4>
              <p className="text-sm text-gray-500">최근 10개의 기록을 볼 수 있어요</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300" />
        </button>

        <button 
          onClick={requestCounseling}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-2xl text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all">
              <MessageCircle size={24} />
            </div>
            <div className="text-left">
              <h4 className="font-bold">선생님과 상담하기</h4>
              <p className="text-sm text-gray-500">도움이 필요할 때 언제든 요청하세요</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300" />
        </button>
      </div>

      {showHistory && (
        <motion.section 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-xl font-bold mb-6">최근 감정 기록</h3>
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-center py-8 text-gray-400">아직 기록이 없어요.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="p-4 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl shadow-sm text-blue-600 font-bold">
                      {entry.dominant_emotion}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 truncate max-w-[200px] sm:max-w-md">{entry.inputText}</p>
                      <p className="text-xs text-gray-400">{entry.createdAt.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-400">강도 {entry.intensity}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}

// --- Teacher Dashboard ---

function TeacherDashboard({ user }: { user: AppUser }) {
  const [emotions, setEmotions] = useState<EmotionEntry[]>([]);
  const [requests, setRequests] = useState<CounselingRequest[]>([]);
  const [filterAttention, setFilterAttention] = useState(false);

  useEffect(() => {
    // Real-time emotions
    const qEmotions = query(
      collection(db, 'daily_emotions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubEmotions = onSnapshot(qEmotions, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmotionEntry));
      setEmotions(entries);
    });

    // Real-time counseling requests
    const qRequests = query(
      collection(db, 'counseling_requests'),
      where('status', '==', 'pending'),
      orderBy('requestDate', 'desc')
    );

    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CounselingRequest));
      setRequests(entries);
    });

    return () => {
      unsubEmotions();
      unsubRequests();
    };
  }, []);

  const filteredEmotions = filterAttention 
    ? emotions.filter(e => e.requires_attention) 
    : emotions;

  const attentionCount = emotions.filter(e => e.requires_attention).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
              <User size={24} />
            </div>
            <span className="text-xs font-bold text-gray-400">오늘 참여</span>
          </div>
          <p className="text-3xl font-bold">{emotions.length}명</p>
          <p className="text-sm text-gray-500 mt-1">전체 학생 중 참여 인원</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
              <AlertTriangle size={24} />
            </div>
            <span className="text-xs font-bold text-gray-400">주의 필요</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{attentionCount}명</p>
          <p className="text-sm text-gray-500 mt-1">즉각적인 관심이 필요합니다</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
              <MessageCircle size={24} />
            </div>
            <span className="text-xs font-bold text-gray-400">상담 대기</span>
          </div>
          <p className="text-3xl font-bold text-rose-600">{requests.length}건</p>
          <p className="text-sm text-gray-500 mt-1">학생들의 상담 요청입니다</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">실시간 감정 현황</h3>
            <button 
              onClick={() => setFilterAttention(!filterAttention)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterAttention ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {filterAttention ? "전체 보기" : "주의 학생만 보기"}
            </button>
          </div>

          <div className="space-y-4">
            {filteredEmotions.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                <p className="text-gray-400">데이터가 없습니다.</p>
              </div>
            ) : (
              filteredEmotions.map((entry) => (
                <motion.div 
                  layout
                  key={entry.id} 
                  className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${entry.requires_attention ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                        {entry.studentNumber?.slice(-2) || entry.studentName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold">{entry.studentName} <span className="text-sm font-normal text-gray-400 ml-1">{entry.studentNumber}</span></h4>
                        <p className="text-xs text-gray-400">{entry.createdAt.toDate().toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${entry.intensity > 7 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {entry.dominant_emotion} (강도 {entry.intensity})
                      </span>
                      {entry.requires_attention && (
                        <span className="bg-amber-100 text-amber-600 p-1 rounded-lg">
                          <AlertTriangle size={16} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white/50 p-4 rounded-2xl border border-gray-100 mb-3">
                    <p className="text-gray-800 font-medium">"{entry.inputText}"</p>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-500">
                    <div className="bg-blue-600 w-1 h-full min-h-[20px] rounded-full mt-1" />
                    <p className="italic">AI 요약: {entry.summary}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            상담 요청 <Bell className="text-rose-500" size={20} />
          </h3>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl text-center border border-gray-100">
                <p className="text-gray-400 text-sm">대기 중인 요청이 없습니다.</p>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="bg-white p-5 rounded-3xl shadow-sm border border-rose-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold">{req.studentName}</h4>
                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter">{req.requestDate.toDate().toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 bg-rose-50 p-3 rounded-xl">"{req.message}"</p>
                  <button 
                    onClick={async () => {
                      await setDoc(doc(db, 'counseling_requests', req.id), { ...req, status: 'approved' });
                    }}
                    className="w-full bg-rose-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all"
                  >
                    확인 완료
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
