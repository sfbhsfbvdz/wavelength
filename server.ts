import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';

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

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const PORT = 3000;

  const rooms = new Map<string, any>();

  io.on('connection', (socket) => {
    socket.on('create_room', ({ numTeams, themes }, callback) => {
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
      rooms.set(roomId, {
        id: roomId,
        state: 'psychic_ready',
        teams: Array.from({ length: numTeams }).map((_, i) => ({ id: i, name: `队伍 ${i + 1}`, score: 0 })),
        currentTeamIndex: 0,
        selectedThemes: themes,
        targetAngle: 90,
        needleAngle: 90,
        currentPrompt: ['', ''],
        clue: '',
        psychicSocketId: null
      });
      socket.join(roomId);
      callback(roomId);
      io.to(roomId).emit('state_update', getMaskedState(rooms.get(roomId), socket.id));
    });

    socket.on('join_room', (roomId, callback) => {
      const room = rooms.get(roomId.toUpperCase());
      if (room) {
        socket.join(room.id);
        callback({ success: true, roomId: room.id });
        socket.emit('state_update', getMaskedState(room, socket.id));
      } else {
        callback({ success: false, error: '房间不存在' });
      }
    });

    socket.on('action', ({ roomId, type, payload }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      switch (type) {
        case 'BECOME_PSYCHIC':
          room.psychicSocketId = socket.id;
          room.state = 'psychic_clue';
          const availablePrompts = room.selectedThemes.flatMap((theme: string) => PROMPTS[theme as keyof typeof PROMPTS]);
          room.currentPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
          room.targetAngle = Math.floor(Math.random() * 130) + 25;
          room.needleAngle = 90;
          room.clue = '';
          break;
        case 'SUBMIT_CLUE':
          room.clue = payload;
          room.state = 'team_guess';
          break;
        case 'UPDATE_NEEDLE':
          room.needleAngle = payload;
          socket.to(roomId).emit('needle_update', payload);
          return; // Don't broadcast full state on every needle move
        case 'LOCK_GUESS':
          room.state = 'reveal';
          const diff = Math.abs(room.targetAngle - room.needleAngle);
          let points = 0;
          if (diff <= 5) points = 4;
          else if (diff <= 15) points = 3;
          else if (diff <= 25) points = 2;
          room.teams[room.currentTeamIndex].score += points;
          if (room.teams[room.currentTeamIndex].score >= 10) {
            room.state = 'gameover';
          }
          break;
        case 'NEXT_TURN':
          room.currentTeamIndex = (room.currentTeamIndex + 1) % room.teams.length;
          room.state = 'psychic_ready';
          room.psychicSocketId = null;
          break;
        case 'PLAY_AGAIN':
          room.state = 'psychic_ready';
          room.teams.forEach((t: any) => t.score = 0);
          room.currentTeamIndex = 0;
          room.psychicSocketId = null;
          break;
      }

      const sockets = io.sockets.adapter.rooms.get(roomId);
      if (sockets) {
        for (const clientId of sockets) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket) {
            clientSocket.emit('state_update', getMaskedState(room, clientId));
          }
        }
      }
    });
  });

  function getMaskedState(room: any, clientId: string) {
    const isPsychic = room.psychicSocketId === clientId;
    const hideTarget = room.state === 'psychic_clue' && !isPsychic;
    return {
      ...room,
      targetAngle: hideTarget ? null : room.targetAngle,
      currentPrompt: hideTarget ? ['', ''] : room.currentPrompt,
      isPsychic
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
