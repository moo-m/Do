const express = require(‘express’);
const http = require(‘http’);
const { Server } = require(‘socket.io’);
const path = require(‘path’);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ‘*’ } });

app.use(express.static(path.join(__dirname)));
app.get(’/host’, (req, res) => res.sendFile(path.join(__dirname, ‘host.html’)));
app.get(’/player’, (req, res) => res.sendFile(path.join(__dirname, ‘player.html’)));
app.get(’/spectator’, (req, res) => res.sendFile(path.join(__dirname, ‘spectator.html’)));

// ─── In-Memory State ─────────────────────────────────────────────────────────
const tournaments = {}; // code => tournament object
const matches = {};     // matchId => match object
const players = {};     // socketId => player info

// ─── Arabic Grammar Question Database ────────────────────────────────────────
const QUESTIONS = [
{
q: ‘ما نوع الفعل: قَالَ؟’,
options: [‘صحيح سالم’, ‘معتل أجوف’, ‘معتل ناقص’, ‘صحيح مهموز’],
answer: 1
},
{
q: ‘ما نوع الفعل: كَتَبَ؟’,
options: [‘معتل مثال’, ‘صحيح سالم’, ‘صحيح مضعف’, ‘معتل أجوف’],
answer: 1
},
{
q: ‘ما نوع الفعل: وَعَدَ؟’,
options: [‘معتل مثال’, ‘صحيح سالم’, ‘معتل أجوف’, ‘معتل لفيف’],
answer: 0
},
{
q: ‘ما نوع الفعل: سَأَلَ؟’,
options: [‘صحيح مهموز’, ‘صحيح سالم’, ‘معتل مثال’, ‘صحيح مضعف’],
answer: 0
},
{
q: ‘ما نوع الفعل: مَدَّ؟’,
options: [‘صحيح سالم’, ‘معتل أجوف’, ‘صحيح مضعف’, ‘معتل ناقص’],
answer: 2
},
{
q: ‘ما نوع الفعل: رَمَى؟’,
options: [‘معتل أجوف’, ‘معتل ناقص’, ‘صحيح سالم’, ‘معتل مثال’],
answer: 1
},
{
q: ‘ما نوع الفعل: أَكَلَ؟’,
options: [‘صحيح مهموز’, ‘صحيح سالم’, ‘معتل مثال’, ‘معتل لفيف’],
answer: 0
},
{
q: ‘ما نوع الفعل: عَاشَ؟’,
options: [‘معتل ناقص’, ‘صحيح سالم’, ‘معتل أجوف’, ‘صحيح مضعف’],
answer: 2
},
{
q: ‘الاسم المعرفة هو الذي يبدأ بـ؟’,
options: [‘تنوين’, ‘أل التعريف’, ‘همزة’, ‘تاء مربوطة’],
answer: 1
},
{
q: ‘ما علامة رفع الاسم المفرد؟’,
options: [‘الفتحة’, ‘الكسرة’, ‘الضمة’, ‘السكون’],
answer: 2
},
{
q: ‘ما علامة نصب الاسم المفرد؟’,
options: [‘الضمة’, ‘الفتحة’, ‘الكسرة’, ‘الواو’],
answer: 1
},
{
q: ‘ما علامة جر الاسم المفرد؟’,
options: [‘الكسرة’, ‘الضمة’, ‘الفتحة’, ‘الياء’],
answer: 0
},
{
q: ‘الفاعل في الجملة يكون دائماً؟’,
options: [‘منصوباً’, ‘مجروراً’, ‘مرفوعاً’, ‘مجزوماً’],
answer: 2
},
{
q: ‘المفعول به في الجملة يكون دائماً؟’,
options: [‘مرفوعاً’, ‘مجروراً’, ‘منصوباً’, ‘مجزوماً’],
answer: 2
},
{
q: ‘المبتدأ في الجملة الاسمية يكون؟’,
options: [‘منصوباً’, ‘مرفوعاً’, ‘مجروراً’, ‘مجزوماً’],
answer: 1
},
{
q: ‘الخبر في الجملة الاسمية يكون؟’,
options: [‘مجروراً’, ‘منصوباً’, ‘مجزوماً’, ‘مرفوعاً’],
answer: 3
},
{
q: ‘ما نوع الفعل: يَذْهَبُ؟’,
options: [‘ماضٍ’, ‘أمر’, ‘مضارع’, ‘شرط’],
answer: 2
},
{
q: ‘ما نوع الفعل: اذْهَبْ؟’,
options: [‘مضارع’, ‘ماضٍ’, ‘أمر’, ‘نهي’],
answer: 2
},
{
q: ‘كم حرف الجر الأصلية؟’,
options: [‘١٠’, ‘١٢’, ‘١٥’, ‘٨’],
answer: 1
},
{
q: ‘الضمير “هُمْ” يعود إلى؟’,
options: [‘مفرد مذكر’, ‘جمع مذكر’, ‘مثنى’, ‘جمع مؤنث’],
answer: 1
},
{
q: ‘جمع كلمة “كِتَاب” هو؟’,
options: [‘كتابون’, ‘كُتُب’, ‘كتابات’, ‘أكتاب’],
answer: 1
},
{
q: ‘مثنى كلمة “مُعَلِّم” هو؟’,
options: [‘مُعَلِّمون’, ‘مُعَلِّمَان’, ‘مُعَلِّمين’, ‘مُعَلِّمات’],
answer: 1
},
{
q: ‘كلمة “الذي” اسم موصول يستخدم لـ؟’,
options: [‘جمع مذكر’, ‘مفرد مؤنث’, ‘مفرد مذكر’, ‘جمع مؤنث’],
answer: 2
},
{
q: ‘ما نوع الفعل: وَصَلَ؟’,
options: [‘معتل أجوف’, ‘صحيح سالم’, ‘معتل مثال’, ‘صحيح مهموز’],
answer: 2
},
{
q: ‘الفعل المبني للمجهول يُحذف منه؟’,
options: [‘المفعول به’, ‘الفاعل’, ‘المبتدأ’, ‘الخبر’],
answer: 1
},
{
q: ‘نائب الفاعل يكون دائماً؟’,
options: [‘منصوباً’, ‘مجروراً’, ‘مجزوماً’, ‘مرفوعاً’],
answer: 3
},
{
q: ‘الاسم الممنوع من الصرف لا يقبل؟’,
options: [‘الجمع’, ‘التنوين والكسرة’, ‘الإضافة’, ‘أل التعريف’],
answer: 1
},
{
q: ‘ما نوع الفعل: سَارَ؟’,
options: [‘صحيح سالم’, ‘معتل ناقص’, ‘معتل أجوف’, ‘صحيح مضعف’],
answer: 2
},
{
q: ‘ما نوع الفعل: دَعَا؟’,
options: [‘معتل أجوف’, ‘صحيح سالم’, ‘معتل ناقص’, ‘معتل مثال’],
answer: 2
},
{
q: ‘الحروف الشمسية تعدادها؟’,
options: [‘١٤’, ‘١٠’, ‘١٦’, ‘١٢’],
answer: 0
}
];

function getRandomQuestions(count, usedIndices = []) {
const available = QUESTIONS.map((*, i) => i).filter(i => !usedIndices.includes(i));
const selected = [];
while (selected.length < count && available.length > 0) {
const idx = Math.floor(Math.random() * available.length);
selected.push(available.splice(idx, 1)[0]);
}
if (selected.length < count) {
// refill from all if exhausted
const remaining = QUESTIONS.map((*, i) => i).filter(i => !selected.includes(i));
while (selected.length < count && remaining.length > 0) {
const idx = Math.floor(Math.random() * remaining.length);
selected.push(remaining.splice(idx, 1)[0]);
}
}
return selected.map(i => ({ …QUESTIONS[i], index: i }));
}

function generateCode() {
return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateMatchId() {
return ‘M’ + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function checkWinner(board) {
const lines = [
[0,1,2],[3,4,5],[6,7,8],
[0,3,6],[1,4,7],[2,5,8],
[0,4,8],[2,4,6]
];
for (const [a,b,c] of lines) {
if (board[a] && board[a] === board[b] && board[a] === board[c]) {
return { winner: board[a], line: [a,b,c] };
}
}
if (board.every(c => c)) return { winner: ‘draw’ };
return null;
}

function broadcastTournament(code) {
const t = tournaments[code];
if (!t) return;
io.to(‘tournament:’ + code).emit(‘tournament-update’, sanitizeTournament(t));
}

function sanitizeTournament(t) {
return {
code: t.code,
status: t.status,
players: t.players.map(p => ({
id: p.id, name: p.name, online: p.online, ready: p.ready
})),
rounds: t.rounds,
currentRound: t.currentRound,
bracket: t.bracket,
eventFeed: t.eventFeed.slice(-30)
};
}

function addEvent(code, text, type = ‘info’) {
const t = tournaments[code];
if (!t) return;
const ev = { text, type, time: Date.now() };
t.eventFeed.push(ev);
if (t.eventFeed.length > 100) t.eventFeed.shift();
io.to(‘tournament:’ + code).emit(‘event-feed-update’, ev);
}

function createBracket(tournament) {
const playerList = […tournament.players];
// Shuffle
for (let i = playerList.length - 1; i > 0; i–) {
const j = Math.floor(Math.random() * (i + 1));
[playerList[i], playerList[j]] = [playerList[j], playerList[i]];
}

// Pad to power of 2
let size = 2;
while (size < playerList.length) size *= 2;
while (playerList.length < size) playerList.push(null); // bye

const rounds = [];
let currentPlayers = playerList;
let roundNum = 1;
const roundNames = [’’, ‘دور 16’, ‘ربع النهائي’, ‘نصف النهائي’, ‘النهائي’];

while (currentPlayers.length > 1) {
const roundMatches = [];
for (let i = 0; i < currentPlayers.length; i += 2) {
const p1 = currentPlayers[i];
const p2 = currentPlayers[i + 1];
const mId = generateMatchId();
const matchObj = {
id: mId,
player1: p1,
player2: p2,
winner: null,
status: ‘pending’, // pending | active | finished
roundNum
};

```
  // Handle byes
  if (!p1) {
    matchObj.winner = p2;
    matchObj.status = 'finished';
  } else if (!p2) {
    matchObj.winner = p1;
    matchObj.status = 'finished';
  } else {
    matches[mId] = createMatchState(mId, p1, p2, tournament.code);
  }

  roundMatches.push(matchObj);
}
rounds.push({
  number: roundNum,
  name: roundNames[Math.min(roundNum, 4)] || `جولة ${roundNum}`,
  matches: roundMatches,
  status: 'pending'
});
currentPlayers = roundMatches.map(m => m.winner || { placeholder: true });
roundNum++;
```

}

return rounds;
}

function createMatchState(matchId, p1, p2, tournamentCode) {
const qs = getRandomQuestions(18);
return {
id: matchId,
tournamentCode,
player1: { id: p1.id, name: p1.name, symbol: ‘X’ },
player2: { id: p2.id, name: p2.name, symbol: ‘O’ },
board: Array(9).fill(null),
currentTurn: p1.id,
status: ‘active’,
questions: qs,
questionIndex: 0,
pendingMove: null, // playerId who answered correctly and can move
usedQIndices: qs.map(q => q.index),
events: [],
startTime: Date.now()
};
}

function broadcastMatch(matchId) {
const m = matches[matchId];
if (!m) return;
io.to(‘match:’ + matchId).emit(‘match-update’, sanitizeMatch(m));
}

function sanitizeMatch(m) {
return {
id: m.id,
player1: m.player1,
player2: m.player2,
board: m.board,
currentTurn: m.currentTurn,
status: m.status,
pendingMove: m.pendingMove,
currentQuestion: m.questions[m.questionIndex] || null,
questionIndex: m.questionIndex,
startTime: m.startTime
};
}

function activateRound(tournament, roundIdx) {
const round = tournament.rounds[roundIdx];
if (!round) return;
round.status = ‘active’;
tournament.currentRound = roundIdx;

round.matches.forEach(bm => {
if (bm.status === ‘finished’) return;
const m = matches[bm.id];
if (!m) return;
m.status = ‘active’;
// Notify players
[m.player1, m.player2].forEach(p => {
const sock = io.sockets.sockets.get(p.id);
if (sock) {
sock.join(‘match:’ + m.id);
sock.emit(‘match-started’, sanitizeMatch(m));
}
});
broadcastMatch(m.id);
io.to(‘tournament:’ + tournament.code).emit(‘match-viewer’, { matchId: m.id, match: sanitizeMatch(m) });
});

addEvent(tournament.code, `بدأت ${round.name}`, ‘round’);
broadcastTournament(tournament.code);
}

function checkRoundComplete(tournament) {
const round = tournament.rounds[tournament.currentRound];
if (!round) return false;
return round.matches.every(m => m.status === ‘finished’);
}

function advanceRound(tournament) {
const currentRound = tournament.rounds[tournament.currentRound];
const nextRoundIdx = tournament.currentRound + 1;

if (!tournament.rounds[nextRoundIdx]) {
// Tournament over
const winner = currentRound.matches[0]?.winner;
tournament.status = ‘finished’;
addEvent(tournament.code, `🏆 انتهت البطولة! الفائز: ${winner?.name || 'غير محدد'}`, ‘champion’);
io.to(‘tournament:’ + tournament.code).emit(‘tournament-finished’, { winner });
broadcastTournament(tournament.code);
return;
}

// Populate next round with winners
const winners = currentRound.matches.map(m => m.winner).filter(Boolean);
const nextRound = tournament.rounds[nextRoundIdx];

// Assign winners to next round matches
let wi = 0;
nextRound.matches.forEach(bm => {
if (wi < winners.length) {
bm.player1 = winners[wi++] || null;
}
if (wi < winners.length) {
bm.player2 = winners[wi++] || null;
}
if (bm.player1 && bm.player2) {
const mId = generateMatchId();
bm.id = mId;
bm.status = ‘pending’;
matches[mId] = createMatchState(mId, bm.player1, bm.player2, tournament.code);
} else if (bm.player1 && !bm.player2) {
bm.winner = bm.player1;
bm.status = ‘finished’;
} else if (!bm.player1 && bm.player2) {
bm.winner = bm.player2;
bm.status = ‘finished’;
}
});

activateRound(tournament, nextRoundIdx);
}

function finishMatch(tournament, bracketMatch, winnerId) {
const m = matches[bracketMatch.id];
let winner;

if (winnerId === ‘draw’) {
// Restart
addEvent(tournament.code, `تعادل في المباراة بين ${bracketMatch.player1?.name} و ${bracketMatch.player2?.name}، تُعاد المباراة!`, ‘draw’);
restartMatch(tournament, bracketMatch);
return;
}

if (m) {
winner = winnerId === m.player1.id ? m.player1 : m.player2;
m.status = ‘finished’;
broadcastMatch(bracketMatch.id);
} else {
winner = bracketMatch.player1?.id === winnerId ? bracketMatch.player1 : bracketMatch.player2;
}

bracketMatch.winner = winner;
bracketMatch.status = ‘finished’;

addEvent(tournament.code, `🏅 ${winner.name} تأهل من المباراة!`, ‘qualify’);

// Notify players
if (m) {
[m.player1, m.player2].forEach(p => {
const sock = io.sockets.sockets.get(p.id);
if (sock) {
sock.emit(‘match-result’, {
winner,
isWinner: p.id === winner.id
});
}
});
}

broadcastTournament(tournament.code);

if (checkRoundComplete(tournament)) {
setTimeout(() => advanceRound(tournament), 3000);
}
}

function restartMatch(tournament, bracketMatch) {
const oldId = bracketMatch.id;
const p1 = bracketMatch.player1;
const p2 = bracketMatch.player2;

const mId = generateMatchId();
bracketMatch.id = mId;
bracketMatch.status = ‘pending’;
bracketMatch.winner = null;

delete matches[oldId];

const newMatch = createMatchState(mId, p1, p2, tournament.code);
matches[mId] = newMatch;

// Join players to new match room
[p1, p2].forEach(p => {
const sock = io.sockets.sockets.get(p.id);
if (sock) {
sock.leave(‘match:’ + oldId);
sock.join(‘match:’ + mId);
sock.emit(‘match-started’, sanitizeMatch(newMatch));
}
});

broadcastMatch(mId);
broadcastTournament(tournament.code);
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on(‘connection’, (socket) => {

// HOST: Create tournament
socket.on(‘create-tournament’, ({ hostName }) => {
const code = generateCode();
tournaments[code] = {
code,
hostId: socket.id,
hostName: hostName || ‘المضيف’,
status: ‘lobby’,
players: [],
rounds: [],
currentRound: 0,
bracket: [],
eventFeed: []
};
socket.join(‘tournament:’ + code);
socket.emit(‘tournament-created’, { code, inviteLink: `/player?code=${code}` });
addEvent(code, `تم إنشاء البطولة بواسطة ${hostName}`, ‘info’);
});

// HOST: Join as host (reconnect)
socket.on(‘host-join’, ({ code }) => {
const t = tournaments[code];
if (!t) return socket.emit(‘error’, ‘البطولة غير موجودة’);
t.hostId = socket.id;
socket.join(‘tournament:’ + code);
socket.emit(‘tournament-update’, sanitizeTournament(t));
});

// PLAYER: Join tournament
socket.on(‘join-tournament’, ({ code, name }) => {
const t = tournaments[code];
if (!t) return socket.emit(‘join-error’, ‘رمز البطولة غير صحيح’);
if (t.status !== ‘lobby’) return socket.emit(‘join-error’, ‘البطولة بدأت بالفعل’);

```
const existing = t.players.find(p => p.id === socket.id);
if (!existing) {
  t.players.push({ id: socket.id, name, online: true, ready: true });
  players[socket.id] = { code, name };
}

socket.join('tournament:' + code);
socket.emit('join-success', { code, name, playerId: socket.id });
addEvent(code, `${name} انضم إلى البطولة`, 'join');
broadcastTournament(code);
```

});

// SPECTATOR: Join tournament
socket.on(‘join-spectator’, ({ code }) => {
const t = tournaments[code];
if (!t) return socket.emit(‘join-error’, ‘رمز البطولة غير صحيح’);
socket.join(‘tournament:’ + code);
socket.emit(‘spectator-joined’, sanitizeTournament(t));
// Join all active match rooms
t.rounds.forEach(r => r.matches.forEach(bm => {
if (bm.status === ‘active’ && matches[bm.id]) {
socket.join(‘match:’ + bm.id);
}
}));
});

// HOST: Start tournament
socket.on(‘start-tournament’, ({ code }) => {
const t = tournaments[code];
if (!t || t.hostId !== socket.id) return;
if (t.players.length < 2) return socket.emit(‘error’, ‘يجب أن يكون هناك لاعبان على الأقل’);

```
t.status = 'active';
t.rounds = createBracket(t);
addEvent(code, 'انطلقت البطولة! 🚀', 'start');
broadcastTournament(code);
activateRound(t, 0);
```

});

// SPECTATOR / HOST: Watch specific match
socket.on(‘watch-match’, ({ matchId }) => {
socket.join(‘match:’ + matchId);
const m = matches[matchId];
if (m) socket.emit(‘match-update’, sanitizeMatch(m));
});

// PLAYER: Answer question
socket.on(‘answer-question’, ({ matchId, answerIndex }) => {
const m = matches[matchId];
if (!m || m.status !== ‘active’) return;

```
const isP1 = m.player1.id === socket.id;
const isP2 = m.player2.id === socket.id;
if (!isP1 && !isP2) return;

const playerName = isP1 ? m.player1.name : m.player2.name;
const q = m.questions[m.questionIndex];
if (!q) return;

if (answerIndex === q.answer) {
  m.pendingMove = socket.id;
  m.questionIndex = (m.questionIndex + 1) % m.questions.length;
  addEvent(m.tournamentCode, `✅ ${playerName} أجاب بشكل صحيح`, 'correct');
  socket.emit('answer-result', { correct: true, canMove: true });
} else {
  addEvent(m.tournamentCode, `❌ ${playerName} أجاب بشكل خاطئ`, 'wrong');
  socket.emit('answer-result', { correct: false, canMove: false });
}

broadcastMatch(matchId);
```

});

// PLAYER: Make move
socket.on(‘make-move’, ({ matchId, cellIndex }) => {
const m = matches[matchId];
if (!m || m.status !== ‘active’) return;
if (m.pendingMove !== socket.id) return socket.emit(‘move-error’, ‘ليس دورك للعب أو لم تجب بشكل صحيح’);
if (m.board[cellIndex]) return socket.emit(‘move-error’, ‘الخانة مشغولة’);

```
const isP1 = m.player1.id === socket.id;
const symbol = isP1 ? 'X' : 'O';
const playerName = isP1 ? m.player1.name : m.player2.name;

m.board[cellIndex] = symbol;
m.pendingMove = null;
m.currentTurn = isP1 ? m.player2.id : m.player1.id;

addEvent(m.tournamentCode, `${playerName} وضع ${symbol} في الخانة ${cellIndex + 1}`, 'move');

const result = checkWinner(m.board);
if (result) {
  m.status = 'finished';
  broadcastMatch(matchId);

  const t = tournaments[m.tournamentCode];
  if (t) {
    const bm = findBracketMatch(t, matchId);
    if (bm) {
      if (result.winner === 'draw') {
        finishMatch(t, bm, 'draw');
      } else {
        const winPlayer = result.winner === 'X' ? m.player1 : m.player2;
        io.to('match:' + matchId).emit('match-ended', { winner: winPlayer, line: result.line });
        finishMatch(t, bm, winPlayer.id);
      }
    }
  }
} else {
  broadcastMatch(matchId);
}
```

});

// HOST: Qualify player manually
socket.on(‘qualify-player’, ({ code, playerId }) => {
const t = tournaments[code];
if (!t || t.hostId !== socket.id) return;

```
const round = t.rounds[t.currentRound];
if (!round) return;

const bm = round.matches.find(m =>
  m.status !== 'finished' &&
  (m.player1?.id === playerId || m.player2?.id === playerId)
);

if (!bm) return;

const winner = bm.player1?.id === playerId ? bm.player1 : bm.player2;
const m = matches[bm.id];
if (m) m.status = 'finished';

bm.winner = winner;
bm.status = 'finished';

addEvent(code, `👑 ${winner.name} تأهل بقرار المضيف`, 'qualify');
broadcastTournament(code);

if (checkRoundComplete(t)) {
  setTimeout(() => advanceRound(t), 2000);
}
```

});

// HOST: Restart match
socket.on(‘restart-match’, ({ code, matchId }) => {
const t = tournaments[code];
if (!t || t.hostId !== socket.id) return;

```
const round = t.rounds[t.currentRound];
const bm = round?.matches.find(m => m.id === matchId);
if (!bm) return;

bm.status = 'pending';
bm.winner = null;
addEvent(code, `🔄 أُعيدت المباراة`, 'restart');
restartMatch(t, bm);
```

});

// HOST: Force end match
socket.on(‘force-end-match’, ({ code, matchId, winnerId }) => {
const t = tournaments[code];
if (!t || t.hostId !== socket.id) return;

```
const round = t.rounds[t.currentRound];
const bm = round?.matches.find(m => m.id === matchId);
if (!bm) return;

finishMatch(t, bm, winnerId);
```

});

// Disconnect
socket.on(‘disconnect’, () => {
const p = players[socket.id];
if (p) {
const t = tournaments[p.code];
if (t) {
const pl = t.players.find(pl => pl.id === socket.id);
if (pl) {
pl.online = false;
addEvent(p.code, `${p.name} غادر`, ‘leave’);
broadcastTournament(p.code);
}
}
delete players[socket.id];
}
});
});

function findBracketMatch(tournament, matchId) {
for (const round of tournament.rounds) {
const bm = round.matches.find(m => m.id === matchId);
if (bm) return bm;
}
return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`\n🎮 Arabic XO Tournament Platform`);
console.log(`🚀 Server running at http://localhost:${PORT}`);
console.log(`📋 Host:      http://localhost:${PORT}/host`);
console.log(`🎯 Player:    http://localhost:${PORT}/player`);
console.log(`👁  Spectator: http://localhost:${PORT}/spectator\n`);
});
