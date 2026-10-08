import React, { useState, useEffect, useMemo, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
// ⚡ 修改：引入 initializeFirestore 以開啟快取功能，並引入 getDocs 取代 onSnapshot
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection, doc, setDoc, writeBatch, query, where, getDocs 
} from "firebase/firestore";

// XP 圖示網址
const xpIcon = "https://i.postimg.cc/D0T2gMK3/xp-icon.png";

// ==========================================
// 聖保祿中學 專屬雲端 Firebase 資料庫 (與主系統 100% 同步)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCH7D9uoA5l9Tsu9g9_sDvUdxj7CsTT9k0",
  authDomain: "sppe-fitness-e6391.firebaseapp.com",
  databaseURL: "https://sppe-fitness-e6391-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sppe-fitness-e6391",
  storageBucket: "sppe-fitness-e6391.firebasestorage.app",
  messagingSenderId: "725404786105",
  appId: "1:725404786105:web:f2cdc50d2c6af9f05daa68"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// ⚡ 修改：使用高階初始化，開啟強大的本機持久化快取（多頁籤管理）
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// 班級列表 (全校 36 班)
const classList = [
  "F1A", "F1B", "F1C", "F1D", "F1E", "F1F",
  "F2A", "F2B", "F2C", "F2D", "F2E", "F2F",
  "F3A", "F3B", "F3C", "F3D", "F3E", "F3F",
  "F4A", "F4B", "F4C", "F4D", "F4E", "F4F",
  "F5A", "F5B", "F5C", "F5D", "F5E", "F5F",
  "F6A", "F6B", "F6C", "F6D", "F6E", "F6F",
];

// 計算等級與頭銜
const getLvTitle = (level) => {
  const lv = Number(level) || 1;
  if (lv >= 100) return "👑 永恆冠軍";
  if (lv >= 90) return "🎖️ 榮耀王者";
  if (lv >= 80) return "⚜️ 神話至尊";
  if (lv >= 70) return "🌌 超凡大師";
  if (lv >= 60) return "☄️ 星耀傳說";
  if (lv >= 50) return "💎 鑽石英雄";
  if (lv >= 40) return "⚔️ 白金勇者";
  if (lv >= 30) return "🛡️ 黃金騎士";
  if (lv >= 20) return "🏹 白銀戰士";
  if (lv >= 10) return "🛡️ 青銅角鬥士";
  return "🌱 見習鬥士";
};

// 體適能項目資訊映射表
const abilityFieldsMap = {
  cardio: { label: "心肺耐力", icon: "❤️", color: "from-red-500 to-rose-600", textColor: "text-rose-500" },
  strength: { label: "肌肉力量", icon: "💪", color: "from-blue-500 to-indigo-600", textColor: "text-blue-500" },
  power: { label: "瞬發爆發力", icon: "⚡", color: "from-amber-500 to-yellow-600", textColor: "text-amber-500" },
  speed: { label: "直線速度", icon: "🏃", color: "from-emerald-500 to-teal-600", textColor: "text-emerald-500" },
  flexibility: { label: "關節柔軟度", icon: "🦴", color: "from-pink-500 to-rose-500", textColor: "text-pink-500" },
  agility: { label: "動態敏捷性", icon: "🔁", color: "from-purple-500 to-violet-600", textColor: "text-purple-500" },
};

// Web Audio API 音效產生器 (無須外置檔，極速回應)
const createAudioContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
};

let audioCtx = null;

const playTone = (freq, type = 'sine', duration = 0.1, volume = 0.1) => {
  try {
    if (!audioCtx) audioCtx = createAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio play blocked", e);
  }
};

const playXpChime = () => {
  playTone(523.25, 'sine', 0.12, 0.15); // C5
  setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.15), 60); // E5
  setTimeout(() => playTone(783.99, 'sine', 0.2, 0.18), 120); // G5
};

const playBatchSound = () => {
  playTone(440, 'triangle', 0.1, 0.12);
  setTimeout(() => playTone(554.37, 'triangle', 0.1, 0.12), 80);
  setTimeout(() => playTone(659.25, 'sine', 0.15, 0.15), 160);
  setTimeout(() => playTone(880, 'sine', 0.25, 0.2), 240);
};

const playLevelUpFanfare = () => {
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 'square', 0.18, 0.12), idx * 90);
  });
};

export default function App() {
  const [dbUser, setDbUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [teacherAccounts, setTeacherAccounts] = useState([]);
  
  // 🔐 教師認證與權限狀態
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  
  const [selectedClass, setSelectedClass] = useState("F1A");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("id"); // "id", "xp", "name"
  
  // 聲音開關
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ☀️ 日間 / 🌙 夜間模式開關 (預設為夜間模式)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 批量選取模式
  const [batchMode, setBatchMode] = useState(false);
  const [selectedStudentKeys, setSelectedStudentKeys] = useState({});

  // 🧩 體適能弱項針對分組 Modal 狀態
  const [groupingModalOpen, setGroupingModalOpen] = useState(false);
  const [selectedFocusFields, setSelectedFocusFields] = useState(["cardio"]); // 最多選擇 3 個項目
  const [groupingStrategy, setGroupingStrategy] = useState("weakness_station"); // "weakness_station" (專向弱項) | "balanced_mentor" (強弱互補)
  const [generatedGroups, setGeneratedGroups] = useState([]);

  // 🏃‍♂️ 體適能測驗獎勵模式狀態
  const [challengeMode, setChallengeMode] = useState(false);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeConfig, setChallengeConfig] = useState({
    type: "endurance_run", // "endurance_run", "shuttle_run", "sit_ups", "push_ups"
    title: "耐力跑測試",
    targetValue: 180,
    xpReward: 200
  });
  const [challengeTimer, setChallengeTimer] = useState({ isRunning: false, seconds: 0 });
  const [completedChallengeKeys, setCompletedChallengeKeys] = useState({});

  // 彈出自訂 XP Modal
  const [customXpModal, setCustomXpModal] = useState({ isOpen: false, student: null, amount: 100 });

  // 浮動動畫粒子 state [{ id, x, y, text, color }]
  const [particles, setParticles] = useState([]);

  // 傳音廣播 Modal & 狀態
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastStatusMsg, setBroadcastStatusMsg] = useState("");

  // 反饋訊息 Toast
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // ⏱️ 體適能測驗計時器邏輯
  useEffect(() => {
    let interval = null;
    if (challengeTimer.isRunning) {
      interval = setInterval(() => {
        setChallengeTimer(prev => ({ ...prev, seconds: prev.seconds + 1 }));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [challengeTimer.isRunning]);

  // 格式化秒數為 mm:ss
  const formatTimer = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // 🧩 智能體適能弱項分組邏輯
  const handleToggleFocusField = (fieldKey) => {
    if (selectedFocusFields.includes(fieldKey)) {
      if (selectedFocusFields.length === 1) {
        showToast("⚠️ 請至少保留 1 個訓練項目！");
        return;
      }
      setSelectedFocusFields(prev => prev.filter(k => k !== fieldKey));
    } else {
      if (selectedFocusFields.length >= 3) {
        showToast("⚠️ 最多只能選擇 3 個專向訓練項目！");
        return;
      }
      setSelectedFocusFields(prev => [...prev, fieldKey]);
    }
  };

  const handleGenerateSmartGroups = () => {
    if (selectedFocusFields.length === 0) {
      showToast("⚠️ 請至少選擇 1 個訓練項目！");
      return;
    }
    if (currentClassStudents.length === 0) {
      showToast("⚠️ 當前班級無符合條件的學生數據！");
      return;
    }

    if (groupingStrategy === "weakness_station") {
      // 專向弱項分站：找出學生在選擇的項目中分數最低者，分類至該補底站
      const groupsObj = {};
      selectedFocusFields.forEach(fKey => {
        groupsObj[fKey] = {
          fieldKey: fKey,
          title: abilityFieldsMap[fKey]?.label || fKey,
          icon: abilityFieldsMap[fKey]?.icon || "🎯",
          students: []
        };
      });

      currentClassStudents.forEach(student => {
        const latestRec = (student.scores && student.scores.length > 0) 
          ? student.scores[student.scores.length - 1] 
          : {};

        let minKey = selectedFocusFields[0];
        let minVal = Number(latestRec[minKey] ?? student[minKey] ?? 60);

        selectedFocusFields.forEach(fKey => {
          const val = Number(latestRec[fKey] ?? student[fKey] ?? 60);
          if (val < minVal) {
            minVal = val;
            minKey = fKey;
          }
        });

        groupsObj[minKey].students.push({
          ...student,
          scoreVal: minVal
        });
      });

      const groupsArr = Object.values(groupsObj).map(g => ({
        ...g,
        students: g.students.sort((a, b) => a.scoreVal - b.scoreVal)
      }));

      setGeneratedGroups(groupsArr);
    } else {
      // 強弱互補分隊模式：按總分數蛇形分組
      const stationCount = Math.max(2, selectedFocusFields.length);
      const groupsArr = Array.from({ length: stationCount }, (_, i) => ({
        fieldKey: `group_${i+1}`,
        title: `互補小隊 第 ${i + 1} 組`,
        icon: "🤝",
        students: []
      }));

      const scoredStudents = currentClassStudents.map(student => {
        const latestRec = (student.scores && student.scores.length > 0) 
          ? student.scores[student.scores.length - 1] 
          : {};
        let sum = 0;
        selectedFocusFields.forEach(fKey => {
          sum += Number(latestRec[fKey] ?? student[fKey] ?? 60);
        });
        return {
          ...student,
          focusAvg: Math.round(sum / selectedFocusFields.length)
        };
      }).sort((a, b) => b.focusAvg - a.focusAvg);

      scoredStudents.forEach((student, index) => {
        const round = Math.floor(index / stationCount);
        const groupIndex = (round % 2 === 0) ? (index % stationCount) : (stationCount - 1 - (index % stationCount));
        groupsArr[groupIndex].students.push(student);
      });

      setGeneratedGroups(groupsArr);
    }

    if (soundEnabled) playXpChime();
    showToast("🎯 已依據數據在庫中成功進行針對性分組！");
  };

  // 全組一鍵獎勵加 XP
  const handleGroupBatchXp = async (groupStudents, amount) => {
    if (!groupStudents || groupStudents.length === 0) return;
    if (soundEnabled) playBatchSound();

    try {
      const batch = writeBatch(db);
      groupStudents.forEach(s => {
        const key = `${s.className}_${s.id}`;
        const currentXp = Number(s.xp) || 0;
        const newXp = currentXp + amount;
        const docRef = doc(db, 'students', key);
        batch.set(docRef, { ...s, xp: newXp }, { merge: true });
      });
      await batch.commit();
      showToast(`⚡ 成功為全組 ${groupStudents.length} 位同學發放 +${amount} XP！`);
    } catch (err) {
      console.error("全組加分失敗:", err);
      showToast(`❌ 發放失敗: ${err.message}`);
    }
  };

  // 一鍵複製分組文字名單
  const handleCopyGroupsToClipboard = () => {
    if (!generatedGroups || generatedGroups.length === 0) return;
    let text = `【${selectedClass} 班 - 體適能針對性分組名單】\n`;
    generatedGroups.forEach(g => {
      text += `\n${g.icon} ${g.title} (${g.students.length}人):\n`;
      text += g.students.map(s => `${s.id}號 ${s.name}`).join("、 ");
      text += "\n";
    });

    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      showToast("📋 分組名單已成功複製到剪貼簿！");
    } catch (err) {
      showToast("❌ 複製失敗，請手動選取。");
    }
    document.body.removeChild(textArea);
  };

  // 啟動專案測驗
  const handleStartChallenge = (type, title, targetValue, xpReward) => {
    setChallengeConfig({ type, title, targetValue, xpReward });
    setCompletedChallengeKeys({});
    setChallengeTimer({ isRunning: true, seconds: 0 });
    setChallengeModalOpen(false);
    setChallengeMode(true);
    if (soundEnabled) playLevelUpFanfare();
    showToast(`🏃‍♂️ 已開啟【${title}】測驗！目標: ${targetValue}${type === "endurance_run" ? "秒內" : "次"}，獎勵 +${xpReward} XP`);
  };

  // 一鍵標記學生完成體適能測驗並發放 XP
  const handleMarkChallengeComplete = async (student, e) => {
    const studentKey = `${student.className}_${student.id}`;
    if (completedChallengeKeys[studentKey]) return;

    setCompletedChallengeKeys(prev => ({ ...prev, [studentKey]: true }));
    await handleAddXp(student, challengeConfig.xpReward, e);
    showToast(`🎯 ${student.name} 完成【${challengeConfig.title}】！已發放 +${challengeConfig.xpReward} XP`);
  };

  // 引發飄落 particle 函數
  const triggerParticle = (e, text, color = "#eab308") => {
    if (!e || !e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;
    const newParticle = {
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      color
    };
    setParticles((prev) => [...prev, newParticle]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 1200);
  };

  // 1. Firebase 匿名驗證
  useEffect(() => {
    const initAuth = async () => {
      try {
        const cred = await signInAnonymously(auth);
        setDbUser(cred.user);
      } catch (err) {
        console.error("Firebase auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDbUser(user);
    });
    return () => unsubscribe();
  }, []);

     // ========================================================
  // 🧑‍🏫 優化 1：教師帳號載入 (全堂課只在登入時讀取一次，切換班級不再重複觸發)
  // ========================================================
  useEffect(() => {
    if (!dbUser) return;

    const fetchTeachers = async () => {
      try {
        const teachersRef = collection(db, 'teachers');
        const snapshot = await getDocs(teachersRef);
        const teachersList = snapshot.docs.map(doc => doc.data());
        setTeacherAccounts(teachersList);

        if (currentTeacher) {
          const matchingTeacher = teachersList.find(t => 
            String(t.username || "").trim() === String(currentTeacher.username || "").trim()
          );
          if (!matchingTeacher || matchingTeacher.active === false) {
            setCurrentTeacher(null);
            showToast("⚠️ 您的教師帳號已被主系統刪除或停用，已自動安全登出。");
          } else {
            setCurrentTeacher(matchingTeacher);
          }
        }
      } catch (err) {
        console.error("載入教師資料失敗:", err);
      }
    };

    fetchTeachers();
  }, [dbUser]); 

  // ========================================================
  // 🏃‍♂️ 優化 2：學生資料載入 (改為 getDocs，優先從本地快取撈取，省電又省錢)
  // ========================================================
  useEffect(() => {
    if (!dbUser) return;

    const fetchStudentsByClass = async () => {
      try {
        const studentsQuery = query(
          collection(db, 'students'),
          where('className', '==', String(selectedClass).toUpperCase())
        );
        
        // ⚡ getDocs 會自動先看快取，若快取有資料且未變更，就不會消耗 Firebase 雲端讀取額度
        const snapshot = await getDocs(studentsQuery);
        
        const loaded = snapshot.docs
          .map(doc => doc.data())
          .filter(doc => doc.id !== "SYSTEM_CONFIG_QUESTS");
        
        setStudents(loaded);
      } catch (error) {
        console.error("Firestore 讀取學生資料失敗:", error);
        showToast("⚠️ 無法讀取學生資料，請檢查網路。");
      }
    };

    fetchStudentsByClass();
  }, [dbUser, selectedClass]); // ⚡ 只有在老師真正「切換班級」時才會去讀取資料庫

  // 計算當前登入教師獲授權的班級列表
  const authorizedClasses = useMemo(() => {
    if (!currentTeacher) return [];
    if (currentTeacher.role === 'admin') return classList;
    if (!currentTeacher.classes) return [];
    return currentTeacher.classes
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => classList.includes(c));
  }, [currentTeacher]);

  useEffect(() => {
    if (authorizedClasses.length > 0 && !authorizedClasses.includes(selectedClass)) {
      setSelectedClass(authorizedClasses[0]);
    }
  }, [authorizedClasses, selectedClass]);

  const handleTeacherLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const inputUser = loginInput.username.trim();
    const inputPass = loginInput.password.trim();

    if (!inputUser || !inputPass) {
      setLoginError("請輸入完整的教師帳號及密碼！");
      return;
    }

    const foundTeacher = teacherAccounts.find(
      t => String(t.username || "").trim() === inputUser && String(t.password || "").trim() === inputPass
    );

    if (!foundTeacher) {
      setLoginError("❌ 帳號或密碼不正確，或尚未在主系統中登記！");
      return;
    }

    if (foundTeacher.active === false) {
      setLoginError("⚠️ 此教師帳號已被主系統停用，無法登入！");
      return;
    }

    setCurrentTeacher(foundTeacher);
    const teacherAuthClasses = foundTeacher.role === 'admin' 
      ? classList 
      : (foundTeacher.classes || "").split(',').map(c => c.trim().toUpperCase()).filter(c => classList.includes(c));

    if (teacherAuthClasses.length > 0) {
      setSelectedClass(teacherAuthClasses[0]);
    }

    showToast(`歡迎回來，${foundTeacher.name}！已安全載入您的授權班級。`);
  };

  const handleLogout = () => {
    setCurrentTeacher(null);
    setLoginInput({ username: "", password: "" });
    setLoginError("");
    showToast("已安全登出體育課堂鼓勵系統。");
  };

  // 目前授權班級同學數據
  const currentClassStudents = useMemo(() => {
    if (!authorizedClasses.includes(selectedClass.toUpperCase())) return [];

    return students
      .filter(s => String(s.className || "").trim().toUpperCase() === selectedClass.toUpperCase())
      .filter(s => {
        if (!searchTerm) return true;
        const nameMatch = String(s.name || "").includes(searchTerm);
        const idMatch = String(s.id || "").includes(searchTerm);
        return nameMatch || idMatch;
      })
      .sort((a, b) => {
        if (sortBy === "xp") {
          return (Number(b.xp) || 0) - (Number(a.xp) || 0);
        }
        if (sortBy === "name") {
          return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
        }
        return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
      });
  }, [students, selectedClass, searchTerm, sortBy, authorizedClasses]);

  const classStats = useMemo(() => {
    if (!currentClassStudents.length) {
      return { count: 0, totalXp: 0, avgXp: 0, topStudent: null };
    }
    const totalXp = currentClassStudents.reduce((sum, s) => sum + (Number(s.xp) || 0), 0);
    const avgXp = Math.round(totalXp / currentClassStudents.length);
    const topStudent = [...currentClassStudents].sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0))[0];

    return {
      count: currentClassStudents.length,
      totalXp,
      avgXp,
      topStudent
    };
  }, [currentClassStudents]);

  const handleAddXp = async (student, amount, e) => {
    if (!authorizedClasses.includes(String(student.className).toUpperCase())) {
      showToast("🚫 權限不足！您未獲主系統授權管理此班級。");
      return;
    }

    if (e) triggerParticle(e, `+${amount} XP`, amount >= 500 ? "#f59e0b" : "#eab308");

    if (soundEnabled) {
      if (amount >= 500) playLevelUpFanfare();
      else playXpChime();
    }

    const currentXp = Number(student.xp) || 0;
    const newXp = currentXp + amount;
    const oldLevel = Math.min(100, Math.floor(currentXp / 1000) + 1);
    const newLevel = Math.min(100, Math.floor(newXp / 1000) + 1);

    if (newLevel > oldLevel) {
      showToast(`🎉 恭喜！${student.name} 升級至 Lv.${newLevel} ${getLvTitle(newLevel)}！`);
    }

    // ⚡ 核心優化：【第一步】立即更新 React 本地狀態（介面立刻跳分，完全不Lag）
    setStudents(prevStudents => 
      prevStudents.map(s => 
        (s.id === student.id && s.className === student.className) 
          ? { ...s, xp: newXp } 
          : s
      )
    );

    // ⚡ 核心優化：【第二步】背景異步寫入雲端庫（老師不需在畫面上等待網路轉圈圈）
    try {
      const docRef = doc(db, 'students', `${student.className}_${student.id}`);
      await setDoc(docRef, { ...student, xp: newXp }, { merge: true });
    } catch (err) {
      console.error("XP 同步失敗:", err);
      showToast(`❌ 雲端同步失敗: ${err.message}`);
      
      // 如果極端情況下寫入失敗，把分數扣回來（回滾機制）
      setStudents(prevStudents => 
        prevStudents.map(s => 
          (s.id === student.id && s.className === student.className) 
            ? { ...s, xp: currentXp } 
            : s
        )
      );
    }
  };


  // 批量全選 / 取消全選當前班級同學
  const handleToggleSelectAll = () => {
    const classKeys = currentClassStudents.map(s => `${s.className}_${s.id}`);
    const currentlySelectedCount = classKeys.filter(k => selectedStudentKeys[k]).length;
    
    if (currentlySelectedCount === classKeys.length && classKeys.length > 0) {
      setSelectedStudentKeys({});
    } else {
      const newSelected = {};
      classKeys.forEach(k => {
        newSelected[k] = true;
      });
      setSelectedStudentKeys(newSelected);
    }
  };

  const handleBatchAddXp = async (amount) => {
    const keys = Object.keys(selectedStudentKeys).filter(k => selectedStudentKeys[k]);
    if (keys.length === 0) {
      showToast("⚠️ 請先勾選要發放 XP 的同學！");
      return;
    }

    if (!authorizedClasses.includes(selectedClass.toUpperCase())) {
      showToast("🚫 權限不足！您未獲授權管理此班級。");
      return;
    }

    if (soundEnabled) playBatchSound();

    try {
      const batch = writeBatch(db);
      let count = 0;

      currentClassStudents.forEach(s => {
        const key = `${s.className}_${s.id}`;
        if (selectedStudentKeys[key]) {
          const currentXp = Number(s.xp) || 0;
          const newXp = currentXp + amount;
          const docRef = doc(db, 'students', key);
          batch.set(docRef, { ...s, xp: newXp }, { merge: true });
          count++;
        }
      });

      await batch.commit();
      showToast(`⚡ 成功為 ${count} 位同學發放 +${amount} XP 獎勵！`);
      setSelectedStudentKeys({});
      setBatchMode(false);
    } catch (err) {
      console.error("批量更新失敗:", err);
      showToast(`❌ 批量發放失敗: ${err.message}`);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) {
      setBroadcastStatusMsg("⚠️ 請填寫激勵說話內容");
      return;
    }

    try {
      const targetClass = selectedClass.toUpperCase();
      const annRef = doc(db, 'announcements', targetClass);
      await setDoc(annRef, {
        text: broadcastText.trim(),
        sender: `${currentTeacher ? currentTeacher.name : "體育科老師"}`,
        updatedAt: Date.now()
      });

      if (soundEnabled) playLevelUpFanfare();
      setBroadcastStatusMsg(`✨ 已成功向 ${targetClass} 班廣播激勵魔法信件！`);
      setTimeout(() => {
        setBroadcastModalOpen(false);
        setBroadcastText("");
        setBroadcastStatusMsg("");
      }, 1500);
    } catch (err) {
      console.error("廣播失敗:", err);
      setBroadcastStatusMsg(`❌ 發送失敗: ${err.message}`);
    }
  };

  const presetEncouragements = [
    "🔥 今天全班展現了強大的團隊體能精神，非常優秀！",
    "⚡ 恭喜突破心肺耐力極限，大家繼續保持！",
    "💪 敏捷與爆發力訓練圓滿完成，XP 已全部派發！",
    "🏃‍♂️ 守時服從，動作標準，值得表揚！"
  ];

  if (!currentTeacher) {
    return (
      <div className={`min-h-screen font-sans p-4 flex items-center justify-center relative overflow-hidden select-none transition-colors duration-300 ${
        isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-800"
      }`}>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`absolute top-4 right-4 z-20 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-md ${
            isDarkMode
              ? "bg-slate-900 text-amber-300 border-slate-800 hover:bg-slate-800"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>{isDarkMode ? "☀️ 切換日間模式" : "🌙 切換夜間模式"}</span>
        </button>

        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className={`w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6 transition-colors ${
          isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-white/95 border-slate-200 shadow-slate-200/80"
        }`}>
          <div className="text-center space-y-2">
  <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
    <img 
      src={xpIcon} 
      alt="XP Logo" 
      className="w-full h-full object-contain" 
    />
  </div>
            <h1 className={`text-xl sm:text-2xl font-black ${
              isDarkMode 
                ? "bg-gradient-to-r from-amber-300 via-white to-indigo-300 bg-clip-text text-transparent"
                : "text-indigo-950"
            }`}>
              聖保祿體育科課堂輔助系統
            </h1>
            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              與體適能主系統雲端數據庫實時同步
            </p>
          </div>

          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                🔑 教師登入帳號 (Username)
              </label>
              <input
                type="text"
                value={loginInput.username}
                onChange={(e) => setLoginInput(p => ({ ...p, username: e.target.value }))}
                placeholder="例如：teacher 或 admin"
                className={`w-full border rounded-xl p-3 text-sm outline-none transition-all ${
                  isDarkMode 
                    ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white"
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                🔒 安全密碼 (Password)
              </label>
              <input
                type="password"
                value={loginInput.password}
                onChange={(e) => setLoginInput(p => ({ ...p, password: e.target.value }))}
                placeholder="請輸入密碼..."
                className={`w-full border rounded-xl p-3 text-sm outline-none transition-all ${
                  isDarkMode 
                    ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white"
                }`}
              />
            </div>

            {loginError && (
              <div className="bg-rose-950/60 border border-rose-800/60 p-3 rounded-xl text-xs font-bold text-rose-300 animate-pulse">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              進入課堂 XP 點讚系統
            </button>
          </form>

          <div className={`pt-2 border-t text-center ${isDarkMode ? "border-slate-800/80" : "border-slate-200"}`}>
            <p className={`text-[11px] font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              登入資料與主系統同步 • 僅能存取獲授權班級
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans p-2 sm:p-4 select-none overflow-x-hidden relative transition-colors duration-300 ${
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
    }`}>
      
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translate(-50%, 0) scale(0.8); }
          50% { opacity: 1; transform: translate(-50%, -35px) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%, -70px) scale(1); }
        }
        .particle-anim {
          animation: floatUp 1.1s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
          pointer-events: none;
        }
      `}</style>

      {/* 浮動 XP Particle 動畫 */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed z-50 text-xl font-black font-mono tracking-wider particle-anim drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          style={{ left: `${p.x}px`, top: `${p.y}px`, color: p.color }}
        >
          {p.text}
        </div>
      ))}

      {/* Toast 提示 */}
      {toastMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-indigo-400 animate-bounce">
          <span>⚡</span> {toastMsg}
        </div>
      )}

      {/* 🧩 體適能弱項針對分組 Modal */}
      {groupingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4">
          <div className={`border p-5 sm:p-6 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-indigo-500/40 text-white" : "bg-white border-indigo-300 text-slate-900"
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
              <div>
                <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
                  🧩 體適能數據弱項針對分組 ({selectedClass} 班)
                </h3>
                <p className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  自動檢測學生最新六項體適能數據，按其相對弱項精準分站訓練或強弱互補
                </p>
              </div>
              <button onClick={() => setGroupingModalOpen(false)} className="font-bold text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            {/* 選擇訓練項目 (最多選 3 項) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span>1. 選擇今日課堂訓練重點項目 (最多選 3 項)</span>
                <span className="text-amber-500 font-mono">已選 {selectedFocusFields.length}/3 項</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(abilityFieldsMap).map(([fKey, info]) => {
                  const isSelected = selectedFocusFields.includes(fKey);
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => handleToggleFocusField(fKey)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-400 font-black shadow-md scale-[1.02]"
                          : isDarkMode
                            ? "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs">{info.icon} {info.label}</span>
                      {isSelected && <span className="text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 分組模式選擇 */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold block">2. 選擇分組策略</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setGroupingStrategy("weakness_station")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    groupingStrategy === "weakness_station"
                      ? "bg-purple-600/20 border-purple-500 text-purple-300 font-black"
                      : isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="font-black">🎯 專向弱項補底站</div>
                  <div className="text-[10px] opacity-75 mt-0.5">將學生派至選定項目中最弱一項進行站別特訓</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGroupingStrategy("balanced_mentor")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    groupingStrategy === "balanced_mentor"
                      ? "bg-blue-600/20 border-blue-500 text-blue-300 font-black"
                      : isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="font-black">🤝 強弱互補小隊</div>
                  <div className="text-[10px] opacity-75 mt-0.5">高分學生與低分學生混編，以強帶弱互助練習</div>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleGenerateSmartGroups}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-lg active:scale-95"
              >
                🔄 執行數據庫智能分組
              </button>

              {generatedGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyGroupsToClipboard}
                  className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  📋 複製名單文字
                </button>
              )}
            </div>

            {/* 分組結果卡片網格 */}
            {generatedGroups.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-800/60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {generatedGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-3 flex flex-col justify-between ${
                        isDarkMode ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-800/40">
                          <h4 className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                            <span>{group.icon}</span>
                            <span>{group.title}</span>
                            <span className="text-[10px] font-mono text-slate-500 font-normal">({group.students.length}人)</span>
                          </h4>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleGroupBatchXp(group.students, 50)}
                              className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-lg shadow-sm"
                            >
                              全組 +50 XP
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGroupBatchXp(group.students, 100)}
                              className="px-2 py-0.5 bg-purple-600 text-white font-black text-[10px] rounded-lg shadow-sm"
                            >
                              +100
                            </button>
                          </div>
                        </div>

                        {group.students.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {group.students.map((s) => (
                              <div
                                key={`${s.className}_${s.id}`}
                                className={`p-1.5 rounded-xl border flex items-center justify-between ${
                                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                }`}
                              >
                                <span className="font-bold text-[11px] truncate">
                                  #{s.id} {s.name}
                                </span>
                                {s.scoreVal !== undefined && (
                                  <span className="text-[10px] font-mono text-rose-400 font-bold">
                                    {s.scoreVal}分
                                  </span>
                                )}
                                {s.focusAvg !== undefined && (
                                  <span className="text-[10px] font-mono text-indigo-400 font-bold">
                                    均{s.focusAvg}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 text-center py-3">此項目無分派同學</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏃‍♂️ 體適能測驗設定 Modal */}
      {challengeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className={`border p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-emerald-500/40 text-white" : "bg-white border-emerald-400 text-slate-900"
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
              <h3 className="text-base font-black text-emerald-500 flex items-center gap-2">
                🏃‍♂️ 設定體適能測驗獎勵模式
              </h3>
              <button onClick={() => setChallengeModalOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "endurance_run", title: "耐力跑測試", target: 180, xp: 200, icon: "🏃‍♂️" },
                { type: "shuttle_run", title: "折返跑測試", target: 10, xp: 150, icon: "⚡" },
                { type: "sit_ups", title: "仰臥起坐測試", target: 30, xp: 150, icon: "💪" },
                { type: "push_ups", title: "掌上壓測試", target: 20, xp: 150, icon: "🏋️‍♂️" }
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setChallengeConfig({ type: item.type, title: item.title, targetValue: item.target, xpReward: item.xp })}
                  className={`p-3 rounded-2xl border text-left space-y-1 transition-all ${
                    challengeConfig.type === item.type
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-md"
                      : isDarkMode ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-base">{item.icon} {item.title}</div>
                  <div className="text-[11px] opacity-75">預設: {item.target}{item.type === "endurance_run" ? "秒" : "次"} (+{item.xp} XP)</div>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold mb-1">測驗名稱</label>
                <input
                  type="text"
                  value={challengeConfig.title}
                  onChange={(e) => setChallengeConfig(p => ({ ...p, title: e.target.value }))}
                  className={`w-full border rounded-xl p-2.5 text-xs outline-none ${
                    isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">目標 ({challengeConfig.type === "endurance_run" ? "秒數" : "次數"})</label>
                  <input
                    type="number"
                    value={challengeConfig.targetValue}
                    onChange={(e) => setChallengeConfig(p => ({ ...p, targetValue: Number(e.target.value) }))}
                    className={`w-full border rounded-xl p-2.5 text-xs text-center font-bold outline-none ${
                      isDarkMode ? "bg-slate-950 border-slate-800 text-amber-400" : "bg-slate-50 border-slate-200 text-amber-600"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">達標發放 XP</label>
                  <input
                    type="number"
                    step="10"
                    value={challengeConfig.xpReward}
                    onChange={(e) => setChallengeConfig(p => ({ ...p, xpReward: Number(e.target.value) }))}
                    className={`w-full border rounded-xl p-2.5 text-xs text-center font-bold outline-none ${
                      isDarkMode ? "bg-slate-950 border-slate-800 text-amber-400" : "bg-slate-50 border-slate-200 text-amber-600"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setChallengeModalOpen(false)}
                className={`px-4 py-2 font-bold text-xs rounded-xl ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
              >
                取消
              </button>
              <button
                onClick={() => handleStartChallenge(challengeConfig.type, challengeConfig.title, challengeConfig.targetValue, challengeConfig.xpReward)}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg"
              >
                🚀 開始測驗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自訂 XP Modal */}
      {customXpModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className={`border p-6 rounded-3xl max-w-xs w-full text-center space-y-4 shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <h3 className="text-base font-black">為 {customXpModal.student?.name} 自訂 XP</h3>
            <div className="space-y-2">
              <input
                type="number"
                step="10"
                className={`w-full border rounded-xl p-3 text-center text-xl font-black outline-none ${
                  isDarkMode 
                    ? "bg-slate-950 border-slate-700 text-amber-400" 
                    : "bg-slate-50 border-slate-300 text-amber-600"
                }`}
                value={customXpModal.amount}
                onChange={(e) => setCustomXpModal(p => ({ ...p, amount: Number(e.target.value) }))}
              />
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[20, 150, 300, 1000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomXpModal(p => ({ ...p, amount: val }))}
                    className={`py-1.5 rounded-lg font-bold ${
                      isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomXpModal({ isOpen: false, student: null, amount: 100 })}
                className={`flex-1 py-2.5 font-bold text-xs rounded-xl ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={(e) => {
                  if (customXpModal.student) handleAddXp(customXpModal.student, Number(customXpModal.amount) || 0, e);
                  setCustomXpModal({ isOpen: false, student: null, amount: 100 });
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg"
              >
                派發 XP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 傳音廣播 Modal */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className={`border p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-amber-500/40 text-white" : "bg-white border-amber-400 text-slate-900"
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                📜 發布【{selectedClass}班】課堂激勵傳音
              </h3>
              <button onClick={() => setBroadcastModalOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              選擇或輸入要即時傳送到該班學生看板的鼓勵信：
            </p>

            <div className="space-y-2">
              {presetEncouragements.map((msg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setBroadcastText(msg)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all leading-relaxed ${
                    isDarkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/50"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-amber-500"
                  }`}
                >
                  {msg}
                </button>
              ))}
            </div>

            <div>
              <textarea
                rows="3"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="手動輸入讚賞說話..."
                className={`w-full border rounded-xl p-3 text-xs outline-none ${
                  isDarkMode ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            {broadcastStatusMsg && (
              <p className="text-xs font-bold text-emerald-500 text-center animate-pulse">{broadcastStatusMsg}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBroadcastModalOpen(false)}
                className={`px-4 py-2 font-bold text-xs rounded-xl ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                🔮 立即廣播
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          頂部 Coach Pad 橫置列頭 (Landscape Header)
          ========================================== */}
      <header className={`rounded-2xl border p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-md transition-colors ${
        isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-white/95 border-slate-200 shadow-lg shadow-slate-200/50"
      }`}>
<div className="flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
    <img 
      src={xpIcon} 
      alt="XP Logo" 
      className="w-full h-full object-contain" 
    />
  </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-sm sm:text-base font-black ${
                isDarkMode 
                  ? "bg-gradient-to-r from-amber-300 via-white to-indigo-300 bg-clip-text text-transparent"
                  : "text-indigo-950"
              }`}>
                聖保祿體育科課堂輔助系統
              </h1>
              <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                isDarkMode 
                  ? "bg-indigo-950 text-indigo-300 border-indigo-800"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}>
                🧑‍🏫 {currentTeacher.name} ({currentTeacher.role === 'admin' ? "管理員" : "任課導師"})
              </span>
            </div>
            <p className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              授權任教班級：<b className="text-amber-500 font-bold">{authorizedClasses.join(", ") || "無配給班級"}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 日夜模式切換按鈕 */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              isDarkMode
                ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                : "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-sm"
            }`}
          >
            <span>{isDarkMode ? "☀️ 日間模式" : "🌙 夜間模式"}</span>
          </button>

          {/* 聲音切換 */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl text-xs font-bold transition-all border ${
              soundEnabled
                ? isDarkMode ? "bg-indigo-950 text-indigo-300 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                : isDarkMode ? "bg-slate-800 text-slate-500 border-slate-700" : "bg-slate-100 text-slate-400 border-slate-200"
            }`}
          >
            {soundEnabled ? "🔊 音效開啟" : "🔇 靜音"}
          </button>

          {/* 體適能測驗按鈕 */}
          <button
            onClick={() => {
              if (challengeMode) {
                setChallengeMode(false);
                setChallengeTimer({ isRunning: false, seconds: 0 });
              } else {
                setChallengeModalOpen(true);
              }
            }}
            className={`px-3 py-2 rounded-xl font-extrabold text-xs transition-all border flex items-center gap-1.5 ${
              challengeMode
                ? "bg-amber-500 text-slate-950 border-amber-300 shadow-lg animate-pulse"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500"
            }`}
          >
            <span>🏃‍♂️</span> {challengeMode ? "✕ 退出測驗" : "⏱️ 體適能測驗獎勵"}
          </button>

          {/* 智能弱項分組 */}
          <button
            onClick={() => {
              setGroupingModalOpen(true);
              if (generatedGroups.length === 0) {
                handleGenerateSmartGroups();
              }
            }}
            className={`px-3 py-2 rounded-xl font-extrabold text-xs transition-all border flex items-center gap-1.5 ${
              isDarkMode 
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 hover:from-blue-500 hover:to-indigo-500" 
                : "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700 shadow-sm"
            }`}
          >
            <span>🧩</span> 弱項針對分組
          </button>

          {/* 魔法廣播 */}
          <button
            onClick={() => setBroadcastModalOpen(true)}
            className="px-3 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>📜</span> 班級鼓勵傳音
          </button>

          {/* 批量模式 */}
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelectedStudentKeys({});
            }}
            className={`px-3 py-2 rounded-xl font-extrabold text-xs transition-all border ${
              batchMode
                ? "bg-purple-600 text-white border-purple-400 shadow-lg"
                : isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {batchMode ? "✕ 退出批量" : "☑️ 批量派發 XP"}
          </button>

          {/* 登出 */}
          <button
            onClick={handleLogout}
            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
              isDarkMode 
                ? "bg-slate-800 text-slate-400 border-slate-700 hover:bg-rose-950 hover:text-rose-300"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-100 hover:text-rose-800"
            }`}
          >
            🚪 登出
          </button>
        </div>
      </header>

      {/* 體適能測驗計時控制條 */}
      {challengeMode && (
        <div className={`rounded-2xl border p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl transition-colors ${
          isDarkMode 
            ? "bg-gradient-to-r from-slate-900 via-emerald-950/80 to-slate-900 border-emerald-500/50" 
            : "bg-gradient-to-r from-emerald-50 via-teal-100/70 to-emerald-50 border-emerald-300 text-slate-900 shadow-md"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-black ${isDarkMode ? "text-amber-300" : "text-emerald-900"}`}>
                  【{selectedClass}班】{challengeConfig.title}
                </h3>
                <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold ${
                  isDarkMode 
                    ? "bg-emerald-900/80 text-emerald-200 border-emerald-700/60"
                    : "bg-emerald-200/80 text-emerald-950 border-emerald-300"
                }`}>
                  目標: {challengeConfig.targetValue} {challengeConfig.type === "endurance_run" ? "秒" : "次"} | 獎勵 +{challengeConfig.xpReward} XP
                </span>
              </div>
              <p className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                已完成達標同學: <b className="text-emerald-600 font-bold">{Object.keys(completedChallengeKeys).length}</b> / {currentClassStudents.length} 人
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border px-4 py-1.5 rounded-xl font-mono text-xl font-black shadow-inner ${
              isDarkMode ? "bg-slate-950 border-emerald-500/50 text-emerald-400" : "bg-white border-emerald-400 text-emerald-700 shadow-sm"
            }`}>
              {formatTimer(challengeTimer.seconds)}
            </div>

            <button
              onClick={() => setChallengeTimer(p => ({ ...p, isRunning: !p.isRunning }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                challengeTimer.isRunning
                  ? isDarkMode ? "bg-amber-500/20 border border-amber-500/50 text-amber-300" : "bg-amber-100 border border-amber-300 text-amber-900"
                  : "bg-emerald-600 text-white shadow-md"
              }`}
            >
              {challengeTimer.isRunning ? "⏸️ 暫停計時" : "▶️ 開始計時"}
            </button>

            <button
              onClick={() => setChallengeTimer({ isRunning: false, seconds: 0 })}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-700"
              }`}
            >
              🔄 歸零
            </button>
          </div>
        </div>
      )}

      {/* 批量發放控制列 */}
      {batchMode && (
        <div className={`rounded-2xl border p-3 mb-3 flex items-center justify-between gap-3 ${
          isDarkMode ? "bg-purple-950/60 border-purple-800" : "bg-purple-50 border-purple-200"
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 bg-purple-600 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              全選 / 取消全選
            </button>
            <span className="text-xs font-bold text-purple-400">
              已選取 {Object.keys(selectedStudentKeys).filter(k => selectedStudentKeys[k]).length} 位同學
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[20, 50, 100, 200, 500].map(amt => (
              <button
                key={amt}
                onClick={() => handleBatchAddXp(amt)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                +{amt} XP
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 班級選擇器 & 統計橫列 */}
      <div className={`rounded-2xl border p-3 mb-3 flex flex-col md:flex-row items-center justify-between gap-3 transition-colors ${
        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white/90 border-slate-200 shadow-sm"
      }`}>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <span className={`text-xs font-black shrink-0 mr-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>授權班級:</span>
          {authorizedClasses.length > 0 ? (
            authorizedClasses.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setSelectedClass(c);
                  setSelectedStudentKeys({});
                }}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all shrink-0 ${
                  selectedClass === c
                    ? "bg-indigo-600 text-white shadow-md scale-105"
                    : isDarkMode
                      ? "bg-slate-950 text-slate-400 border border-slate-800"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {c}
              </button>
            ))
          ) : (
            <span className="text-xs font-bold text-rose-500">尚無獲授權的任教班級</span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋姓名/座號..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs w-32 sm:w-40 outline-none ${
                isDarkMode 
                  ? "bg-slate-950 border-slate-800 text-slate-200" 
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1.5 text-slate-400 text-xs font-bold">✕</button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`border rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none ${
              isDarkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <option value="id">按座號排序</option>
            <option value="xp">按 XP 高低</option>
            <option value="name">按姓名排序</option>
          </select>

          <div className={`hidden lg:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-xl border ${
            isDarkMode ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
          }`}>
            <span>學生: <b className={isDarkMode ? "text-white" : "text-slate-900"}>{classStats.count}</b>人</span>
            <span>|</span>
            <span>均分: <b className="text-amber-500">{classStats.avgXp}</b> XP</span>
            {classStats.topStudent && (
              <>
                <span>|</span>
                <span className="text-amber-600 font-sans font-bold">👑 {classStats.topStudent.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 學生卡片網格 (Landscape Students Grid) */}
      {currentClassStudents.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {currentClassStudents.map((student) => {
            const studentKey = `${student.className}_${student.id}`;
            const isSelected = !!selectedStudentKeys[studentKey];
            const currentXp = Number(student.xp) || 0;
            const level = Math.min(100, Math.floor(currentXp / 1000) + 1);
            const xpInLevel = level >= 100 ? 1000 : currentXp % 1000;
            const levelTitle = getLvTitle(level);

            return (
              <div
                key={studentKey}
                className={`rounded-2xl border p-3 flex flex-col justify-between transition-all relative overflow-hidden ${
                  batchMode && isSelected
                    ? isDarkMode
                      ? "bg-purple-950/40 border-purple-500 scale-[1.02]"
                      : "bg-purple-100/90 border-purple-400 scale-[1.02]"
                    : isDarkMode
                      ? "bg-slate-900/90 border-slate-800/80 hover:border-slate-700"
                      : "bg-white border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-300 text-slate-900"
                }`}
              >
                {batchMode && (
                  <div
                    onClick={() => setSelectedStudentKeys(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                    className="absolute top-2 right-2 cursor-pointer z-10"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded-lg border ${
                      isDarkMode ? "text-indigo-400 bg-indigo-950/80 border-indigo-800/40" : "text-indigo-700 bg-indigo-50 border-indigo-200"
                    }`}>
                      #{String(student.id).padStart(2, "0")}
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg border ${
                      isDarkMode ? "text-amber-400 bg-amber-950/50 border-amber-800/30" : "text-amber-800 bg-amber-100 border-amber-200"
                    }`}>
                      Lv.{level}
                    </span>
                  </div>

                  <div className="my-1.5">
                    <h3 className={`text-sm sm:text-base font-black truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {student.name}
                    </h3>
                    <p className={`text-[10px] font-bold truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {levelTitle}
                    </p>
                  </div>

                  <div className="space-y-1 my-2">
                    <div className={`flex justify-between text-[10px] font-mono font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <span>XP</span>
                      <span className="text-amber-500 font-bold">{currentXp}</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                        style={{ width: `${(xpInLevel / 1000) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 一鍵點讚按鈕區 */}
                {challengeMode ? (
                  <div className={`pt-2 border-t ${isDarkMode ? "border-slate-800/60" : "border-slate-100"}`}>
                    {completedChallengeKeys[studentKey] ? (
                      <div className={`w-full py-2 border font-extrabold text-xs rounded-xl text-center flex items-center justify-center gap-1 ${
                        isDarkMode ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-800"
                      }`}>
                        <span>✅ 已達標 (+{challengeConfig.xpReward} XP)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleMarkChallengeComplete(student, e)}
                        className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                      >
                        <span>🎯 完成挑戰</span>
                        <span className="text-[10px] opacity-80">(+{challengeConfig.xpReward} XP)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`pt-2 border-t grid grid-cols-4 gap-1 ${isDarkMode ? "border-slate-800/60" : "border-slate-100"}`}>
                    <button
                      type="button"
                      onClick={(e) => handleAddXp(student, 10, e)}
                      className={`font-black text-[11px] py-1.5 rounded-lg transition-all active:scale-90 ${
                        isDarkMode ? "bg-slate-800 text-amber-300" : "bg-slate-100 text-amber-800"
                      }`}
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAddXp(student, 50, e)}
                      className={`border font-black text-[11px] py-1.5 rounded-lg transition-all active:scale-90 ${
                        isDarkMode 
                          ? "bg-indigo-950/80 border-indigo-800/40 text-amber-300" 
                          : "bg-indigo-50 border-indigo-200 text-indigo-900"
                      }`}
                    >
                      +50
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAddXp(student, 100, e)}
                      className="bg-amber-500 text-slate-950 font-black text-[11px] py-1.5 rounded-lg shadow-sm transition-all active:scale-90"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomXpModal({ isOpen: true, student, amount: 200 })}
                      className={`font-bold text-[10px] py-1.5 rounded-lg transition-all active:scale-90 ${
                        isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      ⋯
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-3xl border border-dashed p-12 text-center ${
          isDarkMode ? "bg-slate-900/40 border-slate-800 text-slate-500" : "bg-white/60 border-slate-300 text-slate-400"
        }`}>
          <p className="text-3xl mb-2">🔍</p>
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            目前班級【{selectedClass}】無符合對應條件的學生資料。
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className={`mt-6 text-center text-[10px] font-mono ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
        ST. PAUL'S SCHOOL PE SYSTEM • AUTHENTICATED CLASSROOM XP COACH PAD
      </footer>
    </div>
  );
}