import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Play, Pause, RotateCcw, Flame, Target, ListTodo, BarChart2, Medal, Check, Trophy, Plus, CheckCircle2, Sun, Moon, Search, MoreVertical, Brain, Clock, Swords, Shield, Star, Crown, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabaseClient';

// Mengambil API Key dari file .env (Aman dari crawler GitHub)
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Ganti string di dalam model: "..." sesuai dengan model yang ingin Ketua pakai
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const XP_PER_TASK = 20;
const XP_PER_LEVEL = 100;

const RANKS = ['Warrior', 'Elite', 'Master', 'Grandmaster', 'Epic', 'Legend', 'Mythic'];
const getRankDetails = (level) => {
  if (level > 35) return { name: 'Mythic', stage: level - 30, className: 'mythic' };
  const index = Math.floor((level - 1) / 5);
  const stage = ((level - 1) % 5) + 1;
  return { name: RANKS[index], stage, className: RANKS[index].toLowerCase() };
};
const toRoman = (num) => ['I', 'II', 'III', 'IV', 'V'][num - 1] || num;

const getRankIcon = (rankName, size = 16) => {
  switch (rankName) {
    case 'Warrior': return <Swords size={size} />;
    case 'Elite': return <Shield size={size} />;
    case 'Master': return <Target size={size} />;
    case 'Grandmaster': return <Medal size={size} />;
    case 'Epic': return <Star size={size} />;
    case 'Legend': return <Trophy size={size} />;
    case 'Mythic': return <Crown size={size} />;
    default: return <Shield size={size} />;
  }
};

const getRankColor = (rankName) => {
  switch (rankName) {
    case 'Warrior': return '#CD7F32';
    case 'Elite': return '#9CA3AF';
    case 'Master': return '#10B981';
    case 'Grandmaster': return '#3B82F6';
    case 'Epic': return '#8B5CF6';
    case 'Legend': return '#EC4899';
    case 'Mythic': return '#EF4444';
    default: return '#3B82F6';
  }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('focus');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('focusflow_theme');
    return saved ? saved === 'dark' : true;
  });

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('focusflow_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState('');
  const [xp, setXp] = useState(() => Number(localStorage.getItem('focusflow_xp')) || 0);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem('focusflow_streak')) || 0);
  const [tasksCompleted, setTasksCompleted] = useState(() => Number(localStorage.getItem('focusflow_completed')) || 0);
  const [floatingTexts, setFloatingTexts] = useState([]);

  const [duration, setDuration] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTaskText, setModalTaskText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(() => localStorage.getItem('focusflow_username') || '');
  const [showSplash, setShowSplash] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const timerRef = useRef(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoadingPremium, setIsLoadingPremium] = useState(true);

  const fetchProfile = async (uid) => {
    setIsLoadingPremium(true);
    const { data, error } = await supabase.from('profiles').select('is_premium').eq('id', uid).single();
    if (data) setIsPremium(data.is_premium || false);
    setIsLoadingPremium(false);
  };

  useEffect(() => {
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '';
    const isProd = clientKey.startsWith('Mid-client-');
    const script = document.createElement('script');
    script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); }
  }, []);

  const handlePayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-snap-token', {
        body: { user_id: user.id, email: user.email, name: username, amount: 15000 }
      });
      if (error) throw error;
      
      window.snap.pay(data.token, {
        onSuccess: function(result) {
          setIsPremium(true);
          alert("Pembayaran berhasil! Akses Premium terbuka.");
        },
        onPending: function(result) { alert("Menunggu pembayaran Anda!"); },
        onError: function(result) { alert("Pembayaran gagal!"); },
        onClose: function() { console.log('User closed popup'); }
      });
    } catch (err) {
      console.error(err);
      alert("Gagal memanggil API Pembayaran.");
    }
  };

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const levelProgress = ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const currentRank = getRankDetails(level);

  useEffect(() => {
    localStorage.setItem('focusflow_tasks', JSON.stringify(tasks));
    localStorage.setItem('focusflow_xp', xp.toString());
    localStorage.setItem('focusflow_streak', streak.toString());
    localStorage.setItem('focusflow_completed', tasksCompleted.toString());
    localStorage.setItem('focusflow_username', username);
  }, [tasks, xp, streak, tasksCompleted, username]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        if (session.user.user_metadata?.full_name) setUsername(session.user.user_metadata.full_name);
        setIsLoggedIn(true);
        fetchProfile(session.user.id);
      } else {
        setIsLoadingPremium(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        if (session.user.user_metadata?.full_name) setUsername(session.user.user_metadata.full_name);
        setIsLoggedIn(true);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setIsLoadingPremium(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && xp >= 0) {
      supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        display_name: username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Warrior',
        xp: xp,
        avatar_url: user.user_metadata?.avatar_url
      }).then(({ error }) => {
        if (error) console.error("Error syncing XP:", error);
      });
    }
  }, [xp, user, username]);

  useEffect(() => {
    if (activeTab === 'badges') {
      const fetchLeaderboard = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, xp, avatar_url')
          .order('xp', { ascending: false })
          .limit(10);

        if (data) setLeaderboardData(data);
      };

      fetchLeaderboard();

      const channel = supabase.channel('realtime_leaderboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchLeaderboard)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('focusflow_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) document.body.classList.remove('light-mode');
    else document.body.classList.add('light-mode');
  }, [isDarkMode]);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) setTimerActive(false);
    return () => clearInterval(timerRef.current);
  }, [timerActive, timeLeft]);

  const toggleTimer = () => setTimerActive(!timerActive);
  const resetTimer = () => { setTimerActive(false); setTimeLeft(duration); };
  const handleDurationChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      setShowCustomTime(true);
    } else {
      setShowCustomTime(false);
      const newDuration = Number(val) * 60;
      setDuration(newDuration);
      setTimeLeft(newDuration);
      setTimerActive(false);
    }
  };

  const handleCustomTimeSubmit = (e) => {
    e.preventDefault();
    const newDuration = Number(customMinutes) * 60;
    if (newDuration > 0) {
      setDuration(newDuration);
      setTimeLeft(newDuration);
      setTimerActive(false);
      setShowCustomTime(false);
    }
  };
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const addTask = async () => {
    if (!newTaskText.trim()) return;

    setIsGenerating(true);
    try {
      const prompt = `Lo adalah AI assistant untuk aplikasi produktivitas. User akan ngasih sebuah tugas besar atau tujuan. Tugas lu adalah mem-breakdown tugas tersebut menjadi 3 sampai 5 micro-tasks yang sangat actionable, spesifik, dan mudah dilakukan.\n\nAturan:\n- Return HANYA list micro-tasks.\n- Setiap baris diawali dengan tanda strip "-" dan spasi.\n- Jangan ada teks pengantar, penutup, atau bold markdown.\n\nTugas besar: ${newTaskText}`;

      const result = await aiModel.generateContent(prompt);
      const responseText = result.response.text();

      const generatedTasks = responseText
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').replace(/^\*\s*/, '').trim())
        .filter(line => line.length > 0);

      const newTasks = generatedTasks.map((text, i) => ({
        id: Date.now() + i,
        text: text,
        completed: false
      }));

      setTasks(prev => [...newTasks, ...prev]);
      setNewTaskText('');
    } catch (error) {
      console.error("AI Breakdown failed:", error);
      alert("Gagal menggunakan AI. Pastikan koneksi aman.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModalAddTask = () => {
    if (!modalTaskText.trim()) return;
    const newTasks = modalTaskText.split('\n').filter(t => t.trim() !== '').map((text, i) => ({
      id: Date.now() + i, text: text.trim(), completed: false
    }));
    setTasks([...newTasks, ...tasks]);
    setModalTaskText('');
    setShowAddModal(false);
  };

  const toggleTask = (id, event) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const isCompleting = !t.completed;
        if (isCompleting) {
          triggerConfetti(event);
          setXp(prev => prev + XP_PER_TASK);
          setTasksCompleted(prev => prev + 1);
        }
        return { ...t, completed: isCompleting };
      }
      return t;
    }));
  };

  const triggerConfetti = (e) => {
    if (!e || !e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({ particleCount: 50, spread: 60, origin: { x, y }, colors: ['#3B82F6', '#10B981', '#F59E0B'] });
    const floatingId = Date.now();
    setFloatingTexts(prev => [...prev, { id: floatingId, x: e.clientX, y: e.clientY }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(f => f.id !== floatingId)), 1000);
  };

  const renderFocusTab = () => (
    <div className="tab-content">
      <div style={{ marginBottom: '4px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Hello, {username || 'Warrior'}! 👋</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ready to crush your goals today?</p>
      </div>

      <div className="input-section">
        <textarea className="task-input" placeholder="Ketik tugas besar lo di sini..." rows={2} value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} disabled={isGenerating} />
        <button className="btn-primary" onClick={addTask} disabled={isGenerating} style={{ opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}>
          {isGenerating ? <><Loader2 size={16} className="spin" /> Thinking...</> : 'Breakdown!'}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}><Flame size={20} color="var(--gold)" /></div>
          <div className="stat-info">
            <h3>Streak</h3>
            <p>{streak} Days</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Level UP</h3>
            <p>{Math.round(levelProgress)}%</p>
          </div>
          <div className="circle-progress-small" style={{ '--progress': `${levelProgress}%` }}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getRankColor(currentRank.name) }}>
              {getRankIcon(currentRank.name, 18)}
              <span style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                fontSize: '0.55rem',
                fontWeight: 'bold',
                backgroundColor: 'var(--app-bg)',
                color: 'var(--text-primary)',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}>
                {toRoman(currentRank.stage)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="timer-card">
        <div className="timer-row">
          <div className="timer-display">{formatTime(timeLeft)}</div>
          {showCustomTime ? (
            <form onSubmit={handleCustomTimeSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--text-primary)' }}
                min="1"
                autoFocus
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>min</span>
              <button type="submit" className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Set</button>
              <button type="button" onClick={() => setShowCustomTime(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </form>
          ) : (
            <select className="timer-select-pill" value={duration / 60} onChange={handleDurationChange}>
              <option value={15}>15 Minutes ▾</option>
              <option value={25}>25 Minutes ▾</option>
              <option value={50}>50 Minutes ▾</option>
              <option value="custom">Custom... ▾</option>
            </select>
          )}
        </div>
        <div className="timer-actions">
          <button className="btn-start" onClick={toggleTimer}>
            {timerActive ? <Pause size={20} /> : <Play size={20} />} {timerActive ? 'Pause' : 'Start Focus'}
          </button>
          <button className="btn-reset" onClick={resetTimer}><RotateCcw size={20} /></button>
        </div>
      </div>

      <div>
        <div className="checklist-header">
          <div className="vertical-pill"></div>
          <h3>Current Tasks</h3>
        </div>
        <div className="task-list">
          {tasks.slice(0, 3).map(task => (
            <div key={task.id} className={clsx('task-item', task.completed && 'completed')} onClick={(e) => toggleTask(task.id, e)}>
              <div className="checkbox">{task.completed && <Check size={16} color="white" />}</div>
              <span className="task-text">{task.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTasksTab = () => (
    <div className="tab-content">
      <div className="search-bar">
        <Search size={18} color="var(--text-secondary)" />
        <input type="text" placeholder="Search tasks..." />
      </div>

      <div className="filter-pills">
        <button className="filter-pill active">All Tasks</button>
        <button className="filter-pill">High Priority</button>
        <button className="filter-pill">Work</button>
        <button className="filter-pill">Personal</button>
      </div>

      <div className="section-header">
        Active Focus <div className="badge-count">{tasks.filter(t => !t.completed).length}</div>
      </div>

      <div className="task-list">
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 20px' }}>No tasks yet. Break down a big task in the Focus tab!</div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="task-card-full">
              <div className="task-card-full-top">
                <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-secondary)' : 'inherit' }}>{task.text}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  ✕
                </button>
              </div>
              <div className="task-card-full-actions" style={{ marginTop: '12px', justifyContent: 'flex-start' }}>
                <button className="btn-focus-small" onClick={() => { setActiveTab('focus'); }}><Play size={16} /> Focus</button>
                <button className={clsx("filter-pill", task.completed && 'active')} onClick={(e) => toggleTask(task.id, e)} style={{ marginLeft: 'auto' }}>
                  {task.completed ? 'Completed' : 'Mark Done'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => setShowAddModal(true)}><Plus size={24} /></button>

      {showAddModal && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', width: '100%', borderRadius: '16px', padding: '20px',
            border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Add New Task</h3>
            <textarea
              className="task-input"
              placeholder="What do you need to do?"
              rows={3}
              value={modalTaskText}
              onChange={(e) => setModalTaskText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >Cancel</button>
              <button
                className="btn-primary"
                onClick={handleModalAddTask}
              >Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatsTab = () => (
    <div className="tab-content">
      <div>
        <h1 className="page-title">Your Progress</h1>
        <p className="page-subtitle">Stay consistent, one focus session at a time.</p>
      </div>

      <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px' }}>
        <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Your Identity</h3>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your hero name..."
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '2px solid var(--border-color)', color: 'var(--primary)',
            fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', padding: '4px 0'
          }}
        />
      </div>

      <div className="circle-progress-card">
        <div className="circle-progress" style={{ '--progress': `${levelProgress}%` }}>
          <div className="circle-content">
            <h2>{xp}</h2>
            <p>DAILY XP</p>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{XP_PER_LEVEL - (xp % XP_PER_LEVEL)} XP to Next Rank ✨</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--gold)' }}><Flame size={20} /></div>
          <div className="stat-info" style={{ marginTop: '8px' }}>
            <p>{streak} Days</p>
            <h3>Current Streak</h3>
          </div>
        </div>
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}><CheckCircle2 size={20} /></div>
          <div className="stat-info" style={{ marginTop: '8px' }}>
            <p>{tasksCompleted}</p>
            <h3>Tasks Completed</h3>
          </div>
        </div>
      </div>

      <div className="deep-focus-card">
        <div className="deep-focus-icon"><Brain size={24} /></div>
        <div className="deep-focus-info">
          <div style={{ fontWeight: 700 }}>Deep Focus</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Average Depth Level</div>
        </div>
        <div className="deep-focus-value">85%</div>
      </div>

      <div>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Activity (Last 7 Days)</h3>
        <div className="chart-card">
          <div className="chart-bars">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="chart-bar-container">
                <div className={clsx("chart-bar", day === 'F' && 'today')} style={{ height: `${Math.random() * 60 + 20}px` }}></div>
                <div className="chart-label">{day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderBadgesTab = () => (
    <div className="tab-content">
      <div className="rank-card">
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Rank</div>
        <div className={clsx('hexagon', currentRank.className)}>{toRoman(currentRank.stage)}</div>
        <div>
          <div className="rank-title">{currentRank.name} {toRoman(currentRank.stage)}</div>
          <div className="rank-xp">{xp.toLocaleString()} XP</div>
        </div>
        <div style={{ width: '100%', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>{currentRank.name} {toRoman(currentRank.stage)}</span>
            <span>{currentRank.stage === 5 ? getRankDetails(level + 1).name + ' I' : currentRank.name + ' ' + toRoman(currentRank.stage + 1)}</span>
          </div>
          <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${levelProgress}%` }}></div></div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Keep the streak alive!</div>
      </div>

      <div className="leaderboard">
        <h3><Trophy size={18} color="var(--gold)" /> Global Leaderboard</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Compete with focus warriors worldwide.</p>

        {leaderboardData.length > 0 ? (
          leaderboardData.map((lbUser, idx) => {
            const userLevel = Math.floor((lbUser.xp || 0) / XP_PER_LEVEL) + 1;
            const userRankInfo = getRankDetails(userLevel);
            return (
              <div key={idx} className="leaderboard-item">
                <span className="lb-rank">{idx + 1}</span>
                {lbUser.avatar_url && <img src={lbUser.avatar_url} alt="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />}
                <div className="lb-info">
                  <div className="lb-name">{lbUser.display_name}</div>
                  <div className="lb-level">{userRankInfo.name} {toRoman(userRankInfo.stage)}</div>
                </div>
                <span className="lb-xp">{(lbUser.xp || 0).toLocaleString()} XP</span>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Loader2 className="spin" size={20} style={{ margin: '0 auto 8px' }} />
            Loading live leaderboard...
          </div>
        )}

        <div className="leaderboard-item you" style={{ marginTop: '12px' }}>
          <span className="lb-rank" style={{ color: 'var(--primary)' }}>-</span>
          <div className="lb-info">
            <div className="lb-name">You</div>
            <div className="lb-level">{currentRank.name} {toRoman(currentRank.stage)}</div>
          </div>
          <span className="lb-xp">{xp.toLocaleString()} XP</span>
        </div>
      </div>
    </div>
  );

  if (showSplash) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--app-bg)', color: 'var(--primary)' }}>
        <Target size={72} className="pulse-anim" />
        <h1 style={{ marginTop: '20px', fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }} className="fade-up-anim">FocusFlow</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }} className="fade-up-anim">Stay focused. Get rewarded.</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center', backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
        <div className="logo" style={{ marginBottom: '24px', fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}><Target size={40} color="var(--primary)" /> FocusFlow</div>
        <h1 style={{ marginBottom: '12px' }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '300px', lineHeight: '1.5' }}>Log in to continue your focus journey and save your progress securely.</p>

        <button
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin }
            });
            if (error) alert("Gagal login: " + error.message);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 28px', borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)',
            fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: '24px', height: '24px' }} />
          Continue with Google
        </button>
      </div>
    );
  }

  if (isLoadingPremium) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--app-bg)', color: 'var(--primary)'}}>
        <Loader2 size={48} className="spin" />
        <p style={{marginTop: '16px', color: 'var(--text-secondary)'}}>Memuat data profil...</p>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)', padding: '20px', textAlign: 'center'}}>
        <Target size={60} color="var(--primary)" style={{marginBottom: '20px'}}/>
        <h2>Upgrade to Premium</h2>
        <p style={{color: 'var(--text-secondary)', marginBottom: '30px', maxWidth: '300px'}}>Dapatkan akses tak terbatas ke FocusFlow dan AI Breakdown hanya dengan sekali bayar.</p>
        
        <div style={{backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '320px', marginBottom: '24px'}}>
          <h1 style={{fontSize: '2.5rem', marginBottom: '8px'}}>Rp 15.000</h1>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Lifetime Access</p>
          <ul style={{listStyle: 'none', padding: 0, marginTop: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}><CheckCircle2 size={16} color="var(--primary)"/> AI Task Breakdown</li>
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}><CheckCircle2 size={16} color="var(--primary)"/> Global Leaderboard</li>
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}><CheckCircle2 size={16} color="var(--primary)"/> Cloud Sync</li>
          </ul>
        </div>
        
        <button className="btn-primary" style={{width: '100%', maxWidth: '320px', padding: '16px', fontSize: '1.1rem'}} onClick={handlePayment}>
          Bayar Sekarang
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); setIsLoggedIn(false); }} style={{marginTop: '16px', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold'}}>Ganti Akun</button>
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <div className="logo"><Target size={24} color="var(--primary)" /> FocusFlow</div>
        <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} style={{ width: '36px', height: '36px', borderRadius: '50%' }}>
          {isDarkMode ? <Sun size={18} color="var(--text-primary)" /> : <Moon size={18} color="var(--text-primary)" />}
        </button>
      </header>
      <main className="content">
        {activeTab === 'focus' && renderFocusTab()}
        {activeTab === 'tasks' && renderTasksTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'badges' && renderBadgesTab()}
      </main>
      <nav className="bottom-nav">
        <button className={clsx('nav-item', activeTab === 'focus' && 'active')} onClick={() => setActiveTab('focus')}>
          <Clock size={22} /><span>Focus</span>
        </button>
        <button className={clsx('nav-item', activeTab === 'tasks' && 'active')} onClick={() => setActiveTab('tasks')}>
          <ListTodo size={22} /><span>Tasks</span>
        </button>
        <button className={clsx('nav-item', activeTab === 'stats' && 'active')} onClick={() => setActiveTab('stats')}>
          <BarChart2 size={22} /><span>Stats</span>
        </button>
        <button className={clsx('nav-item', activeTab === 'badges' && 'active')} onClick={() => setActiveTab('badges')}>
          <Medal size={22} /><span>Badges</span>
        </button>
      </nav>
      {floatingTexts.map(f => (
        <div key={f.id} className="floating-xp" style={{ left: f.x - 20, top: f.y - 40 }}>+{XP_PER_TASK} XP</div>
      ))}
    </>
  );
}

export default App;