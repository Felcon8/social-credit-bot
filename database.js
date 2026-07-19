// ============================================================
//  database.js — MongoDB-хранилище для бота Партии
//  Подключи MONGO_URI в Environment Variables на Render:
//    MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/partybot
//  Бесплатный кластер: https://www.mongodb.com/cloud/atlas/register
// ============================================================

const mongoose = require('mongoose');

const DEFAULT_CREDITS = 10000;

// ── Схема одного игрока ─────────────────────────────────────
const playerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  // Социальные кредиты
  credits: { type: Number, default: DEFAULT_CREDITS },

  // Экономика
  wallet: { type: Number, default: 0 },
  items: {
    cat_wife:   { type: Boolean, default: false },
    rice_bowls: { type: Number,  default: 0 },
  },

  // Достижения
  achievements: { type: [String], default: [] },

  // Профессиональные кулдауны (хранятся как пары ключ→timestamp)
  workCooldowns: { type: Map, of: Number, default: {} },

  // Общие кулдауны (timestamp последнего использования)
  creditCooldown:   { type: Number, default: 0 },
  workCooldown:     { type: Number, default: 0 },
  dailyCooldown:    { type: Number, default: 0 },
  wheelCooldown:    { type: Number, default: 0 },
  examCooldown:     { type: Number, default: 0 },
  voteCooldown:     { type: Number, default: 0 },
  activityCooldown: { type: Number, default: 0 },

  // Серия экзаменов
  examStreak: { type: Number, default: 0 },

  // Тюрьма: timestamp до которого сидит
  jailUntil: { type: Number, default: 0 },

  // Травма: timestamp до которого лечится
  injuryUntil: { type: Number, default: 0 },

  // Трекер лотерей для достижения
  lotteryCount: { type: Number, default: 0 },
});

const Player = mongoose.model('Player', playerSchema);

// ── Схема лимитов выдачи кредитов (отдельная коллекция) ─────
const limitSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  startTime: { type: Number, default: 0 },
  used:      { type: Number, default: 0 },
});
const Limit = mongoose.model('Limit', limitSchema);

// ── Схема лучшего работника дня ─────────────────────────────
const workerDaySchema = new mongoose.Schema({
  _id:       { type: String, default: 'singleton' },
  shifts:    { type: Map, of: Number, default: {} },
  lastReset: { type: Number, default: () => Date.now() },
});
const WorkerDay = mongoose.model('WorkerDay', workerDaySchema);

// ── Подключение ─────────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('❌ MONGO_URI не задан в переменных окружения!');
  await mongoose.connect(uri);
  console.log('✅ MongoDB подключена');
}

// ── Получить или создать игрока ──────────────────────────────
async function getPlayer(userId) {
  let p = await Player.findOne({ userId });
  if (!p) {
    p = await Player.create({ userId });
  }
  return p;
}

// ── Кредиты ─────────────────────────────────────────────────
async function getCredits(userId) {
  const p = await getPlayer(userId);
  return p.credits;
}

async function addCredits(userId, amount) {
  const p = await getPlayer(userId);
  p.credits += amount;
  await p.save();
  return p.credits;
}

// ── Юани ────────────────────────────────────────────────────
async function getEco(userId) {
  const p = await getPlayer(userId);
  return { wallet: p.wallet, items: p.items };
}

async function addYuan(userId, amount) {
  const p = await getPlayer(userId);
  p.wallet += amount;
  await p.save();
  return p.wallet;
}

// ── Кулдауны ────────────────────────────────────────────────
// field — название поля в схеме Player (workCooldown, dailyCooldown и т.д.)
async function checkCooldown(userId, field, cooldownMs) {
  const p = await getPlayer(userId);
  const now = Date.now();
  const last = p[field] || 0;
  if (now - last < cooldownMs) {
    return { allowed: false, waitMs: cooldownMs - (now - last) };
  }
  p[field] = now;
  await p.save();
  return { allowed: true };
}

// Профессиональные кулдауны хранятся в Map (workCooldowns)
async function checkProfCooldown(userId, jobKey, cooldownMs) {
  const p = await getPlayer(userId);
  const now = Date.now();
  const last = p.workCooldowns.get(jobKey) || 0;
  if (now - last < cooldownMs) {
    return { allowed: false, waitMs: cooldownMs - (now - last) };
  }
  p.workCooldowns.set(jobKey, now);
  await p.save();
  return { allowed: true };
}

// ── Лимит выдачи кредитов (30 мин) ─────────────────────────
const LIMIT_PER_30MIN = 10000;
const COOLDOWN_MS     = 30 * 60 * 1000;

async function checkAndUseLimit(giverId, absAmount) {
  const now = Date.now();
  let entry = await Limit.findOne({ userId: giverId });

  if (!entry || now - entry.startTime >= COOLDOWN_MS) {
    if (absAmount > LIMIT_PER_30MIN) {
      return { allowed: false, reason: 'exceed', remaining: LIMIT_PER_30MIN, resetIn: COOLDOWN_MS };
    }
    await Limit.findOneAndUpdate(
      { userId: giverId },
      { startTime: now, used: absAmount },
      { upsert: true }
    );
    return { allowed: true, remaining: LIMIT_PER_30MIN - absAmount };
  }

  const remaining = LIMIT_PER_30MIN - entry.used;
  const resetIn   = COOLDOWN_MS - (now - entry.startTime);

  if (entry.used >= LIMIT_PER_30MIN) return { allowed: false, reason: 'exhausted', remaining: 0, resetIn };
  if (absAmount > remaining)         return { allowed: false, reason: 'exceed', remaining, resetIn };

  entry.used += absAmount;
  await entry.save();
  return { allowed: true, remaining: remaining - absAmount };
}

// ── Тюрьма ──────────────────────────────────────────────────
async function getJailRemaining(userId) {
  const p = await getPlayer(userId);
  const until = p.jailUntil || 0;
  return Math.max(0, until - Date.now());
}

async function sendToJail(userId, minMs, maxMs) {
  const term = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  const p = await getPlayer(userId);
  p.jailUntil = Date.now() + term;
  await p.save();
  return term;
}

// ── Травма ──────────────────────────────────────────────────
async function getInjuryRemaining(userId) {
  const p = await getPlayer(userId);
  return Math.max(0, (p.injuryUntil || 0) - Date.now());
}

async function setInjury(userId, ms) {
  const p = await getPlayer(userId);
  p.injuryUntil = Date.now() + ms;
  await p.save();
}

async function cureInjury(userId) {
  const p = await getPlayer(userId);
  p.injuryUntil = 0;
  await p.save();
}

// ── Достижения ──────────────────────────────────────────────
const ACHIEVEMENTS_LIST = {
  'first_work':    { name: '🔨 Первый рабочий',      desc: 'Первый раз поработал на заводе',    reward: 500  },
  'rich':          { name: '💰 Богач',               desc: 'Накопил 50 000 юаней',              reward: 1000 },
  'gambler':       { name: '🎰 Игрок',               desc: 'Сыграл в лотерею 5 раз',            reward: 500  },
  'thief':         { name: '🥷 Вор',                 desc: 'Успешно украл юани',                reward: 300  },
  'patriot':       { name: '🇨🇳 Патриот',            desc: 'Получил 20 000 соц. кредитов',      reward: 2000 },
  'exam_ace':      { name: '📚 Отличник Партии',     desc: 'Правильно ответил на 3 экзамена',   reward: 1500 },
  'wheel_jackpot': { name: '🎡 Любимец Фортуны',     desc: 'Выбил джекпот на колесе',           reward: 1000 },
  'cat_owner':     { name: '🐱 Владелец кошки',      desc: 'Купил кошку-жену',                  reward: 500  },
};

async function giveAchievement(userId, achievementId) {
  const p = await getPlayer(userId);
  if (p.achievements.includes(achievementId)) return null;
  p.achievements.push(achievementId);
  const ach = ACHIEVEMENTS_LIST[achievementId];
  if (ach) p.credits += ach.reward;
  await p.save();
  return ach;
}

// ── Лучший работник дня ─────────────────────────────────────
async function getWorkerDay() {
  let doc = await WorkerDay.findById('singleton');
  if (!doc) doc = await WorkerDay.create({ _id: 'singleton' });
  return doc;
}

async function trackShift(userId) {
  const doc = await getWorkerDay();
  doc.shifts.set(userId, (doc.shifts.get(userId) || 0) + 1);
  await doc.save();
}

async function checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, BONUS_CREDITS, BONUS_YUAN) {
  const doc = await getWorkerDay();
  const now = Date.now();
  if (now - doc.lastReset < WORKER_DAY_MS) return;

  const entries = [...doc.shifts.entries()];
  doc.lastReset = now;
  doc.shifts = new Map();

  if (entries.length === 0) { await doc.save(); return; }

  entries.sort((a, b) => b[1] - a[1]);
  const [winnerId, shifts] = entries[0];
  await doc.save();

  const p = await getPlayer(winnerId);
  p.credits += BONUS_CREDITS;
  p.wallet  += BONUS_YUAN;
  await p.save();

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    const channel = guild.systemChannel
      || guild.channels.cache.find(c => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
    if (!channel) return;

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Лучший работник дня')
      .setDescription(`Партия отмечает <@${winnerId}>!\nОтработано смен за сутки: **${shifts}**\n\n⭐ +${BONUS_CREDITS} соц. кредитов\n💴 +${BONUS_YUAN} юаней`);
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Не удалось объявить лучшего работника дня:', e.message);
  }
}

// ── Лидерборд ───────────────────────────────────────────────
async function getLeaderboard(limit = 10) {
  return Player.find().sort({ credits: -1 }).limit(limit).select('userId credits');
}

// ── Покупка предметов ────────────────────────────────────────
async function buyItem(userId, item) {
  const p = await getPlayer(userId);
  return { p, save: () => p.save() };
}

// ── Сброс всех данных ────────────────────────────────────────
async function resetAll() {
  await Player.deleteMany({});
  await Limit.deleteMany({});
  await WorkerDay.findByIdAndDelete('singleton');
}

// ── Трекер лотерей ───────────────────────────────────────────
async function incLotteryCount(userId) {
  const p = await getPlayer(userId);
  p.lotteryCount = (p.lotteryCount || 0) + 1;
  await p.save();
  return p.lotteryCount;
}

// ── Экзаменационная серия ────────────────────────────────────
async function getExamStreak(userId) {
  const p = await getPlayer(userId);
  return p.examStreak || 0;
}

async function setExamStreak(userId, val) {
  const p = await getPlayer(userId);
  p.examStreak = val;
  await p.save();
}

module.exports = {
  connectDB,
  getPlayer,
  ACHIEVEMENTS_LIST,

  // Кредиты
  getCredits, addCredits,

  // Юани
  getEco, addYuan,

  // Кулдауны
  checkCooldown, checkProfCooldown,

  // Лимиты
  checkAndUseLimit,

  // Тюрьма / Травма
  getJailRemaining, sendToJail,
  getInjuryRemaining, setInjury, cureInjury,

  // Достижения
  giveAchievement,

  // Работник дня
  trackShift, checkWorkerOfDayReset,

  // Прочее
  getLeaderboard, resetAll,
  incLotteryCount,
  getExamStreak, setExamStreak,
  buyItem,
};
