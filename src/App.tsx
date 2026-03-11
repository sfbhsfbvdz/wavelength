import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Play, Target, Brain, ArrowRight, RotateCcw, Lock, Eye, Sparkles, Wifi, Home } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const PROMPTS = {
  standard: [
    ["冷", "热"], ["粗糙", "光滑"], ["悲伤", "快乐"], ["便宜", "昂贵"],
    ["无用", "有用"], ["无聊", "刺激"], ["难闻", "好闻"],
    ["冷门", "热门"], ["干燥", "潮湿"], ["安静", "吵闹"], ["轻", "重"],
    ["脏", "干净"], ["慢", "快"], ["弱", "强"], ["危险", "安全"],
    ["困难", "简单"], ["坏习惯", "好习惯"], ["难吃", "好吃"]
  ],
  deep: [
    ["先天", "后天"], ["毫无意义", "意义非凡"], ["科学", "艺术"],
    ["短暂", "永恒"], ["身体", "灵魂"], ["混乱", "秩序"],
    ["自由", "安全"], ["传统", "创新"], ["客观", "主观"],
    ["宿命", "自由意志"], ["需要", "想要"], ["反乌托邦", "乌托邦"]
  ],
  popCulture: [
    ["被低估", "被高估"], ["演技差", "演技爆表"], ["难听的歌", "神曲"],
    ["扑街", "爆款"], ["烂片", "神作"], ["过目即忘", "影史经典"],
    ["无脑综艺", "优质节目"], ["尴尬", "酷"], ["反派", "英雄"], ["小众", "大众"]
  ],
  food: [
    ["难吃", "美味"], ["健康", "不健康"], ["零食", "正餐"],
    ["甜", "咸"], ["清淡", "辛辣"], ["软糯", "酥脆"],
    ["廉价快餐", "高级餐厅"], ["早餐", "晚餐"], ["开胃菜", "主菜"],
    ["买来的", "自己做的"]
  ]
};

const THEME_NAMES: Record<string, string> = {
  standard: "标准日常",
  deep: "深度哲理",
  popCulture: "流行文化",
  food: "吃货专属"
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const Button = ({ children, onClick, variant = 'primary', disabled = false, className = '' }: any) => {
  const base = "relative w-full py-4 rounded-full font-black text-xl transition-all flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#FF6B6B] text-white shadow-[0_6px_0_0_#D83A56] hover:bg-[#FF5252] active:shadow-[0_0px_0_0_#D83A56] active:translate-y-[6px]",
    secondary: "bg-[#4ECDC4] text-white shadow-[0_6px_0_0_#3B9B94] hover:bg-[#45B7D1] active:shadow-[0_0px_0_0_#3B9B94] active:translate-y-[6px]",
    outline: "bg-white text-[#2D3436] border-2 border-[#E2E8F0] shadow-[0_6px_0_0_#E2E8F0] hover:bg-[#F8FAFC] active:shadow-[0_0px_0_0_#E2E8F0] active:translate-y-[6px]",
    dark: "bg-[#2D3436] text-white shadow-[0_6px_0_0_#1E272E] hover:bg-[#1E272E] active:shadow-[0_0px_0_0_#1E272E] active:translate-y-[6px]"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${variants[variant as keyof typeof variants]} ${disabled ? '!bg-[#E2E8F0] !text-[#94A3B8] !shadow-[0_6px_0_0_#CBD5E1] cursor-not-allowed active:!translate-y-0 active:!shadow-[0_6px_0_0_#CBD5E1]' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Dial = ({ targetAngle, needleAngle, showTarget, interactive, onNeedleChange, onDragStart, onDragEnd }: any) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cx = 100, cy = 100, r = 90;

  const updateAngle = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = 200 / rect.width;
    const scaleY = 100 / rect.height;
    const svgX = x * scaleX;
    const svgY = y * scaleY;
    
    let angle = Math.atan2(100 - svgY, 100 - svgX) * 180 / Math.PI;
    if (angle < -90) angle = 180;
    else if (angle < 0) angle = 0;
    
    angle = clamp(angle, 0, 180);
    if (onNeedleChange) onNeedleChange(angle);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    setIsDragging(true);
    if (onDragStart) onDragStart();
    updateAngle(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateAngle(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (onDragEnd) onDragEnd();
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const Wedge = ({ startAngle, endAngle, color, score }: { startAngle: number, endAngle: number, color: string, score?: number }) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx - r * Math.cos(startRad);
    const y1 = cy - r * Math.sin(startRad);
    const x2 = cx - r * Math.cos(endRad);
    const y2 = cy - r * Math.sin(endRad);
    if (endAngle <= startAngle) return null;
    
    let textElement = null;
    if (score) {
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const textR = r - 12;
      const tx = cx - textR * Math.cos(midRad);
      const ty = cy - textR * Math.sin(midRad);
      textElement = (
        <text x={tx} y={ty} fill="rgba(0,0,0,0.4)" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="central" transform={`rotate(${midAngle - 90}, ${tx}, ${ty})`}>
          {score}
        </text>
      );
    }

    return (
      <g>
        <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`} fill={color} />
        {textElement}
      </g>
    );
  };

  return (
    <div className="relative w-full aspect-[2/1] overflow-hidden rounded-t-[1000px] bg-white border-b-[16px] border-[#F8FAFC] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.08)]">
      <svg
        ref={svgRef}
        viewBox="0 0 200 100"
        className={`w-full h-full ${interactive ? 'cursor-pointer touch-none' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Base */}
        <Wedge startAngle={0} endAngle={180} color="#F1F5F9" />
        
        {/* Target */}
        <motion.g
          initial={{ rotate: -180 }}
          animate={{ rotate: targetAngle - 90 }}
          transition={{ type: "spring", stiffness: 40, damping: 12 }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx={cx} cy={cy} r={r} fill="transparent" pointerEvents="none" />
          <Wedge startAngle={65} endAngle={75} color="#45B7D1" score={2} />
          <Wedge startAngle={75} endAngle={85} color="#06D6A0" score={3} />
          <Wedge startAngle={85} endAngle={95} color="#FFD166" score={4} />
          <Wedge startAngle={95} endAngle={105} color="#06D6A0" score={3} />
          <Wedge startAngle={105} endAngle={115} color="#45B7D1" score={2} />
        </motion.g>

        {/* Cover - Only render if showTarget is false */}
        {!showTarget && (
          <g>
            <Wedge startAngle={0} endAngle={180} color="#E2E8F0" />
            <path d={`M ${cx - r + 15} ${cy} A ${r - 15} ${r - 15} 0 0 1 ${cx + r - 15} ${cy}`} fill="none" stroke="#CBD5E1" strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" />
            <circle cx={cx} cy={cy - r/2} r="16" fill="#CBD5E1" />
            <path d={`M ${cx-6} ${cy-r/2} L ${cx+6} ${cy-r/2} M ${cx} ${cy-r/2-6} L ${cx} ${cy-r/2+6}`} stroke="#F8FAFC" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}

        {/* Needle - Rendered LAST so it's always on top */}
        <motion.g
          animate={{ rotate: needleAngle - 90 }}
          transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 250, damping: 20 }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx={cx} cy={cy} r={r} fill="transparent" pointerEvents="none" />
          {/* Needle shadow */}
          <line x1={cx} y1={cy+2} x2={cx} y2={cy - r + 12} stroke="rgba(0,0,0,0.1)" strokeWidth="8" strokeLinecap="round" />
          <circle cx={cx} cy={cy+2} r="16" fill="rgba(0,0,0,0.1)" />
          
          {/* Needle body */}
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 10} stroke="#FF6B6B" strokeWidth="8" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="16" fill="#FF6B6B" />
          <circle cx={cx} cy={cy} r="6" fill="#FFFFFF" />
        </motion.g>
      </svg>
    </div>
  );
};

const Scoreboard = ({ teams, currentTeamIndex }: { teams: any[], currentTeamIndex: number }) => (
  <div className="w-full pt-6 pb-2 px-4 flex justify-center gap-3 md:gap-6 z-10 relative mt-12">
    {teams.map((team, idx) => (
      <div 
        key={team.id} 
        className={`flex flex-col items-center px-6 py-3 rounded-[2rem] transition-all duration-300 ${
          idx === currentTeamIndex 
            ? 'bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)] scale-110 border-4 border-[#4ECDC4]' 
            : 'bg-white/60 opacity-70 scale-95 border-4 border-transparent'
        }`}
      >
        <span className={`text-sm font-extrabold tracking-wider ${idx === currentTeamIndex ? 'text-[#4ECDC4]' : 'text-[#94A3B8]'}`}>{team.name}</span>
        <span className={`text-4xl font-black ${idx === currentTeamIndex ? 'text-[#2D3436]' : 'text-[#64748B]'}`}>{team.score}</span>
      </div>
    ))}
  </div>
);

const PromptDisplay = ({ prompt, opacity = 1 }: { prompt: [string, string], opacity?: number }) => {
  if (!prompt || !prompt[0]) return null;
  return (
    <div className="flex justify-between items-end px-2 mb-6 w-full" style={{ opacity }}>
      <div className="text-left w-1/2 pr-2">
        <div className="inline-block bg-[#45B7D1] text-white px-5 py-3 rounded-2xl font-black text-2xl md:text-3xl shadow-sm transform -rotate-2">
          {prompt[0]}
        </div>
      </div>
      <div className="text-right w-1/2 pl-2">
        <div className="inline-block bg-[#FF6B6B] text-white px-5 py-3 rounded-2xl font-black text-2xl md:text-3xl shadow-sm transform rotate-2">
          {prompt[1]}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomState, setRoomState] = useState<any>(null);

  const [setupMode, setSetupMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [numTeams, setNumTeams] = useState(2);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(['standard']);

  const [liveNeedle, setLiveNeedle] = useState(90);
  const isDraggingRef = useRef(false);
  const [clueInput, setClueInput] = useState('');

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    
    newSocket.on('state_update', (state) => {
      setRoomState(state);
      if (!isDraggingRef.current) {
        setLiveNeedle(state.needleAngle);
      }
    });

    newSocket.on('needle_update', (angle) => {
      if (!isDraggingRef.current) {
        setLiveNeedle(angle);
      }
    });

    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (roomState?.state === 'psychic_ready') {
      setClueInput('');
    }
  }, [roomState?.state]);

  const createRoom = () => {
    socket?.emit('create_room', { numTeams, themes: selectedThemes }, (id: string) => {
      setRoomId(id);
    });
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) return;
    socket?.emit('join_room', joinRoomId.trim(), (res: any) => {
      if (res.success) {
        setRoomId(res.roomId);
      } else {
        alert(res.error);
      }
    });
  };

  const leaveRoom = () => {
    setRoomId(null);
    setRoomState(null);
    setSetupMode('menu');
  };

  const sendAction = (type: string, payload?: any) => {
    if (!roomId) return;
    socket?.emit('action', { roomId, type, payload });
  };

  const handleNeedleChange = (angle: number) => {
    setLiveNeedle(angle);
    sendAction('UPDATE_NEEDLE', angle);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col font-sans text-[#2D3436] selection:bg-[#FFD166] selection:text-[#2D3436]">
      {roomId && (
        <div className="absolute top-4 left-4 z-50">
          <button onClick={leaveRoom} className="p-3 bg-white rounded-full shadow-sm border-2 border-[#F1F5F9] text-[#94A3B8] hover:text-[#FF6B6B] transition-colors">
            <Home className="w-6 h-6" />
          </button>
        </div>
      )}
      {roomId && (
        <div className="absolute top-4 right-4 z-50 bg-white px-4 py-2 rounded-full shadow-sm border-2 border-[#F1F5F9] text-[#94A3B8] font-black text-sm flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#4ECDC4]" /> 房间: {roomId}
        </div>
      )}

      {roomId && roomState && roomState.state !== 'gameover' && (
        <Scoreboard teams={roomState.teams} currentTeamIndex={roomState.currentTeamIndex} />
      )}
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* LANDING MENU */}
        {!roomId && setupMode === 'menu' && (
          <div className="flex flex-col items-center w-full max-w-md">
            <div className="mb-12 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="bg-[#FF6B6B] p-3 rounded-[2rem] shadow-[0_8px_0_0_#D83A56] transform -rotate-6">
                  <Target className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[#2D3436]">心灵同步</h1>
              </div>
              <p className="text-[#94A3B8] font-extrabold text-lg mt-4">默契考验派对游戏</p>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] w-full border-4 border-[#F1F5F9] flex flex-col gap-4">
              <Button onClick={() => setSetupMode('create')} variant="primary">
                <Play className="w-6 h-6 fill-current" /> 创建房间 (联机/本地)
              </Button>
              <Button onClick={() => setSetupMode('join')} variant="outline">
                <Users className="w-6 h-6" /> 加入房间
              </Button>
            </div>
          </div>
        )}

        {/* CREATE ROOM */}
        {!roomId && setupMode === 'create' && (
          <div className="flex flex-col items-center w-full max-w-md">
            <h2 className="text-3xl font-black mb-8 text-[#2D3436]">创建房间</h2>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] w-full border-4 border-[#F1F5F9]">
              <div className="mb-8">
                <label className="block text-base font-extrabold text-[#94A3B8] mb-4 text-center">选择队伍数量</label>
                <div className="flex gap-3">
                  {[2, 3, 4].map(n => (
                    <button
                      key={n} onClick={() => setNumTeams(n)}
                      className={`flex-1 py-4 rounded-2xl font-black text-xl transition-all ${
                        numTeams === n 
                          ? 'bg-[#4ECDC4] text-white shadow-[0_6px_0_0_#3B9B94] translate-y-[-2px]' 
                          : 'bg-white text-[#2D3436] border-2 border-[#E2E8F0] shadow-[0_6px_0_0_#E2E8F0] hover:bg-[#F8FAFC]'
                      } active:translate-y-[4px] active:shadow-none`}
                    >
                      {n} 队
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-10">
                <label className="block text-base font-extrabold text-[#94A3B8] mb-4 text-center">选择词库主题</label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(PROMPTS).map(theme => (
                    <label key={theme} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedThemes.includes(theme) 
                        ? 'border-[#4ECDC4] bg-[#F0FDFB] shadow-[0_4px_0_0_#4ECDC4] translate-y-[-2px]' 
                        : 'border-[#E2E8F0] bg-white shadow-[0_4px_0_0_#E2E8F0] hover:bg-[#F8FAFC]'
                    } active:translate-y-[2px] active:shadow-none`}>
                      <input
                        type="checkbox"
                        checked={selectedThemes.includes(theme)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedThemes([...selectedThemes, theme]);
                          else setSelectedThemes(selectedThemes.filter(t => t !== theme));
                        }}
                        className="hidden"
                      />
                      <span className={`font-black text-lg ${selectedThemes.includes(theme) ? 'text-[#0D9488]' : 'text-[#64748B]'}`}>
                        {THEME_NAMES[theme]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={() => setSetupMode('menu')} variant="outline" className="w-1/3">
                  返回
                </Button>
                <Button onClick={createRoom} disabled={selectedThemes.length === 0} variant="primary" className="w-2/3">
                  开始创建
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* JOIN ROOM */}
        {!roomId && setupMode === 'join' && (
          <div className="flex flex-col items-center w-full max-w-md">
            <h2 className="text-3xl font-black mb-8 text-[#2D3436]">加入房间</h2>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] w-full border-4 border-[#F1F5F9]">
              <div className="mb-8">
                <label className="block text-base font-extrabold text-[#94A3B8] mb-4 text-center">输入房间号</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="例如：A1B2"
                  className="w-full p-5 bg-[#F8FAFC] border-4 border-[#E2E8F0] rounded-2xl font-black text-3xl text-center focus:outline-none focus:border-[#4ECDC4] focus:bg-white transition-all placeholder:text-[#CBD5E1]"
                  maxLength={4}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setSetupMode('menu')} variant="outline" className="w-1/3">
                  返回
                </Button>
                <Button onClick={joinRoom} disabled={joinRoomId.length < 4} variant="primary" className="w-2/3">
                  加入
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* GAME STATES */}
        {roomId && roomState && (
          <>
            {roomState.state === 'psychic_ready' && (
              <div className="flex flex-col items-center text-center max-w-md w-full">
                <div className="bg-white text-[#4ECDC4] px-6 py-3 rounded-full text-base font-black mb-10 shadow-sm border-2 border-[#E2E8F0] flex items-center gap-2">
                  <Users className="w-5 h-5" /> 轮到 {roomState.teams[roomState.currentTeamIndex].name}
                </div>
                <div className="bg-[#FFD166] w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-[0_8px_0_0_#E5B849]">
                  <Brain className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-5xl font-black mb-6 text-[#2D3436]">通灵者阶段</h2>
                <p className="text-[#64748B] mb-12 text-xl font-bold leading-relaxed bg-white p-6 rounded-3xl shadow-sm border-2 border-[#F1F5F9]">
                  <strong className="text-[#FF6B6B]">{roomState.teams[roomState.currentTeamIndex].name}</strong> 的一名玩家作为“通灵者”。
                  <br/><br/><span className="text-[#2D3436]">如果你是通灵者，请点击下方按钮。</span>
                </p>
                <Button onClick={() => sendAction('BECOME_PSYCHIC')} variant="primary">
                  <Eye className="w-6 h-6" /> 我是通灵者 (查看目标)
                </Button>
              </div>
            )}

            {roomState.state === 'psychic_clue' && (
              <div className="flex flex-col items-center w-full max-w-3xl">
                {roomState.isPsychic ? (
                  <>
                    <div className="bg-[#FF6B6B] text-white px-6 py-3 rounded-full text-sm font-black mb-8 shadow-sm flex items-center gap-2">
                      <Sparkles className="w-5 h-5" /> 目标已揭晓 (仅你可见)
                    </div>
                    
                    <div className="w-full mb-12">
                      <PromptDisplay prompt={roomState.currentPrompt} />
                      <Dial targetAngle={roomState.targetAngle} needleAngle={liveNeedle} showTarget={true} interactive={false} />
                    </div>
                    
                    <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border-4 border-[#F1F5F9]">
                      <h3 className="font-black text-2xl mb-3 text-[#2D3436] text-center">输入你的提示词</h3>
                      <p className="text-base text-[#94A3B8] mb-8 text-center font-bold">给出一个词语，引导队友猜出目标在光谱上的位置。</p>
                      <input
                        type="text"
                        value={clueInput}
                        onChange={(e) => setClueInput(e.target.value)}
                        placeholder="例如：咖啡"
                        className="w-full p-5 bg-[#F8FAFC] border-4 border-[#E2E8F0] rounded-2xl font-black text-3xl text-center mb-8 focus:outline-none focus:border-[#4ECDC4] focus:bg-white transition-all placeholder:text-[#CBD5E1]"
                      />
                      <Button onClick={() => sendAction('SUBMIT_CLUE', clueInput)} disabled={!clueInput.trim()} variant="primary">
                        <Lock className="w-6 h-6" /> 确认提示并隐藏目标
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center max-w-md w-full mt-10">
                    <div className="bg-[#E2E8F0] w-24 h-24 rounded-full flex items-center justify-center mb-8 animate-pulse">
                      <Eye className="w-12 h-12 text-[#94A3B8]" />
                    </div>
                    <h2 className="text-4xl font-black mb-6 text-[#2D3436]">通灵者正在思考...</h2>
                    <p className="text-[#64748B] text-xl font-bold bg-white p-6 rounded-3xl shadow-sm border-2 border-[#F1F5F9]">
                      请等待通灵者给出提示词。
                    </p>
                  </div>
                )}
              </div>
            )}

            {roomState.state === 'team_guess' && (
              <div className="flex flex-col items-center w-full max-w-3xl">
                <div className="bg-white text-[#4ECDC4] px-6 py-3 rounded-full text-base font-black mb-8 shadow-sm border-2 border-[#E2E8F0] flex items-center gap-2">
                  <Users className="w-5 h-5" /> 轮到 {roomState.teams[roomState.currentTeamIndex].name} 猜测
                </div>
                
                <div className="bg-white px-8 py-8 rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] mb-10 border-2 border-[#F1F5F9] w-full max-w-md relative overflow-hidden text-center">
                  <div className="text-sm font-extrabold text-[#94A3B8] uppercase tracking-widest mb-3">✨ 提示词 ✨</div>
                  <div className="text-5xl font-black text-[#2D3436] break-words leading-tight">"{roomState.clue}"</div>
                </div>
                
                <div className="w-full mb-10">
                  <PromptDisplay prompt={roomState.currentPrompt} />
                  <Dial 
                    targetAngle={0} 
                    needleAngle={liveNeedle} 
                    showTarget={false} 
                    interactive={true} 
                    onNeedleChange={handleNeedleChange} 
                    onDragStart={() => { isDraggingRef.current = true; }}
                    onDragEnd={() => { isDraggingRef.current = false; }}
                  />
                </div>
                
                <p className="text-[#64748B] mb-10 font-black text-xl bg-white px-6 py-3 rounded-full shadow-sm border-2 border-[#F1F5F9]">
                  👇 所有人都可以拖动指针讨论
                </p>
                
                <div className="w-full max-w-xs">
                  <Button onClick={() => sendAction('LOCK_GUESS')} variant="primary">
                    <Lock className="w-6 h-6" /> 锁定猜测
                  </Button>
                </div>
              </div>
            )}

            {roomState.state === 'reveal' && (() => {
              const diff = Math.abs(roomState.targetAngle - roomState.needleAngle);
              let points = 0;
              if (diff <= 5) points = 4;
              else if (diff <= 15) points = 3;
              else if (diff <= 25) points = 2;

              return (
                <div className="flex flex-col items-center w-full max-w-3xl">
                  <div className="text-center mb-10">
                    <div className="inline-block bg-white px-6 py-2 rounded-full shadow-sm border-2 border-[#F1F5F9] mb-4">
                      <span className="text-sm font-extrabold text-[#94A3B8] uppercase tracking-widest">本轮得分</span>
                    </div>
                    <div className={`text-8xl font-black drop-shadow-md ${points === 4 ? 'text-[#FFD166]' : points === 3 ? 'text-[#06D6A0]' : points === 2 ? 'text-[#45B7D1]' : 'text-[#CBD5E1]'}`}>
                      {points > 0 ? `+${points}` : '0'}
                    </div>
                    <div className="text-[#2D3436] font-black mt-4 text-2xl">
                      {points === 4 ? '🎯 正中靶心！' : points > 0 ? '✨ 很接近了！' : '💦 差得有点远！'}
                    </div>
                  </div>
                  
                  <div className="w-full mb-12">
                    <PromptDisplay prompt={roomState.currentPrompt} opacity={0.6} />
                    <Dial targetAngle={roomState.targetAngle} needleAngle={roomState.needleAngle} showTarget={true} interactive={false} />
                  </div>
                  
                  <div className="w-full max-w-xs">
                    <Button onClick={() => sendAction('NEXT_TURN')} variant="dark">
                      下一回合 <ArrowRight className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              );
            })()}

            {roomState.state === 'gameover' && (() => {
              const winner = [...roomState.teams].sort((a, b) => b.score - a.score)[0];
              return (
                <div className="flex flex-col items-center text-center w-full max-w-md mt-10">
                  <div className="bg-[#FFD166] p-4 rounded-[2rem] shadow-[0_8px_0_0_#E5B849] transform -rotate-6 mb-8">
                    <Target className="w-16 h-16 text-white" />
                  </div>
                  <h2 className="text-6xl font-black mb-4 text-[#2D3436] tracking-tight">游戏结束！</h2>
                  <div className="text-4xl font-black mb-12 text-[#FF6B6B]">
                    {winner.name} 获胜！
                  </div>
                  
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] w-full mb-10 border-4 border-[#F1F5F9]">
                    <h3 className="font-extrabold text-[#94A3B8] text-center mb-6 text-lg">最终得分</h3>
                    {roomState.teams.sort((a: any, b: any) => b.score - a.score).map((team: any, idx: number) => (
                      <div key={team.id} className="flex justify-between items-center py-5 border-b-4 last:border-0 border-[#F1F5F9]">
                        <span className="font-black text-2xl text-[#2D3436] flex items-center gap-4">
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${idx === 0 ? 'bg-[#FFD166] text-[#B47D00]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                            {idx + 1}
                          </span> 
                          {team.name}
                        </span>
                        <span className="font-black text-4xl text-[#4ECDC4]">{team.score}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button onClick={() => sendAction('PLAY_AGAIN')} variant="primary">
                    <RotateCcw className="w-6 h-6" /> 再玩一局
                  </Button>
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
