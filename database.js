'use strict';
const mongoose = require('mongoose');

// ── Подключение к БД ─────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('❌ MONGO_URI / MONGODB_URI не задан в переменных окружения!');
  await mongoose.connect(uri);
  console.log('✅ MongoDB подключена');
}

// ════════════════════════════════════════════════════════════
// БАЗА ДАННЫХ ПРЕДМЕТОВ (30 ПРЕДМЕТОВ СЕРВЕРНОГО ЖЕЛЕЗА)
// ════════════════════════════════════════════════════════════
const ITEMS_DB = {
  // ── Обычные ──────────────────────────────────────────────
  cat5e_cable:      { id: 'cat5e_cable',      name: '🔵 Кабель Cat5e',           rarity: 'common',    power: 5,   desc: 'Стандартный сетевой кабель Cat5e.' },
  sata_cable:       { id: 'sata_cable',       name: '🔴 SATA-кабель',            rarity: 'common',    power: 5,   desc: 'Соединяет диски с материнской платой.' },
  thermal_paste:    { id: 'thermal_paste',    name: '⚪ Термопаста КПТ-8',       rarity: 'common',    power: 8,   desc: 'Советская термопаста.' },
  hdd_500gb:        { id: 'hdd_500gb',        name: '🖤 HDD 500GB',              rarity: 'common',    power: 10,  desc: '500 гигабайт верности Партии.' },
  ram_ddr3_4gb:     { id: 'ram_ddr3_4gb',     name: '🟢 RAM DDR3 4GB',           rarity: 'common',    power: 12,  desc: 'Оперативная память эпохи расцвета.' },
  psu_450w:         { id: 'psu_450w',         name: '🟡 БП 450W',                rarity: 'common',    power: 10,  desc: 'Блок питания 450 ватт.' },
  cpu_cooler_stock: { id: 'cpu_cooler_stock', name: '🌀 Боксовый кулер',         rarity: 'common',    power: 6,   desc: 'Стандартный кулер из коробки.' },
  usb_hub:          { id: 'usb_hub',          name: '🔌 USB-хаб 4-порта',        rarity: 'common',    power: 4,   desc: 'Множитель портов.' },
  patch_panel:      { id: 'patch_panel',      name: '🟠 Патч-панель 24p',        rarity: 'common',    power: 8,   desc: '24 порта коммутации.' },
  optical_drive:    { id: 'optical_drive',    name: '💿 DVD-привод',              rarity: 'common',    power: 3,   desc: 'Читает диски.' },

  // ── Редкие ───────────────────────────────────────────────
  ssd_samsung:      { id: 'ssd_samsung',      name: '🔷 SSD Samsung 1TB',        rarity: 'rare',      power: 40,  desc: 'Скоростной накопитель.' },
  ram_ddr4_16gb:    { id: 'ram_ddr4_16gb',    name: '💚 RAM DDR4 16GB',           rarity: 'rare',      power: 45,  desc: 'Оперативная память нового поколения.' },
  xeon_e5_v2:       { id: 'xeon_e5_v2',       name: '🔩 Intel Xeon E5 v2',       rarity: 'rare',      power: 60,  desc: '8 ядер для нужд Партии.' },
  gpu_1060:         { id: 'gpu_1060',          name: '💎 NVIDIA GTX 1060 6GB',    rarity: 'rare',      power: 55,  desc: 'Графика для вычислений.' },
  switch_cisco_16p: { id: 'switch_cisco_16p', name: '🌐 Cisco Switch 16p',       rarity: 'rare',      power: 50,  desc: '16-портовый управляемый коммутатор.' },
  noctua_nh_d15:    { id: 'noctua_nh_d15',    name: '🦉 Noctua NH-D15',          rarity: 'rare',      power: 42,  desc: 'Тихий башенный кулер.' },
  server_rack_12u:  { id: 'server_rack_12u',  name: '🗄️ Серверная стойка 12U',   rarity: 'rare',      power: 35,  desc: '12 юнитов для оборудования.' },
  ups_650va:        { id: 'ups_650va',         name: '🔋 ИБП 650VA',              rarity: 'rare',      power: 38,  desc: 'Источник бесперебойного питания.' },

  // ── Эпические ────────────────────────────────────────────
  xeon_gold:        { id: 'xeon_gold',         name: '⚡ Intel Xeon Gold 6230',   rarity: 'epic',      power: 150, desc: '20 ядер серверной мощи.' },
  ram_ddr5_64gb:    { id: 'ram_ddr5_64gb',     name: '💠 RAM DDR5 64GB ECC',      rarity: 'epic',      power: 140, desc: 'ECC-память для критических задач.' },
  nvme_gen4:        { id: 'nvme_gen4',         name: '🔥 NVMe Gen4 4TB',          rarity: 'epic',      power: 130, desc: '7000 Mb/s.' },
  gpu_a100:         { id: 'gpu_a100',          name: '🤖 NVIDIA A100 80GB',       rarity: 'epic',      power: 200, desc: 'Ускоритель для ИИ Партии.' },
  custom_wcs:       { id: 'custom_wcs',        name: '🌊 Кастомная СЖО 360мм',   rarity: 'epic',      power: 120, desc: 'Водяное охлаждение под заказ.' },
  fpga_xilinx:      { id: 'fpga_xilinx',       name: '🔬 FPGA Xilinx Alveo U250', rarity: 'epic',      power: 180, desc: 'Программируемая матрица.' },

  // ── Легендарные ──────────────────────────────────────────
  xeon_platinum:    { id: 'xeon_platinum',     name: '👑 Intel Xeon Platinum 8380', rarity: 'legendary', power: 400, desc: '40 ядер. 80 потоков.' },
  quantum_chip:     { id: 'quantum_chip',      name: '⚛️ Квантовый чип прототип', rarity: 'legendary', power: 500, desc: 'Экспериментальный чип.' },
  gold_heatsink:    { id: 'gold_heatsink',     name: '🏅 Золотой радиатор',       rarity: 'legendary', power: 350, desc: 'Радиатор из золотого сплава.' },
  ai_tensor_unit:   { id: 'ai_tensor_unit',    name: '🧠 AI Tensor Unit v3',      rarity: 'legendary', power: 600, desc: 'Нейросетевой акселератор.' },

  // ── Секретные ────────────────────────────────────────────
  mao_cpu:          { id: 'mao_cpu',           name: '🌟 Процессор Мао-9000',     rarity: 'secret',    power: 1000, desc: 'Легендарный процессор.' },
  party_mainframe:  { id: 'party_mainframe',   name: '🏯 Мэйнфрейм Партии-1',    rarity: 'secret',    power: 2000, desc: 'Единственный экземпляр.' },
};

const RARITY_META = {
  common:    { label: 'Обычный',    color: '⬜', emoji: '⬜' },
  rare:      { label: 'Редкий',     color: '🟦', emoji: '🟦' },
  epic:      { label: 'Эпический',  color: '🟪', emoji: '🟪' },
  legendary: { label: 'Легендарн.', color: '🟨', emoji: '🟨' },
  secret:    { label: 'Секретный',  color: '🟥', emoji: '🟥' },
};

const CASES_DB = {
  bronze: {
    id: 'bronze',
    name: '📦 Бронзовый кейс',
    price: 1000,
    emoji: '📦',
    pool: [
      { itemId: 'cat5e_cable',      chance: 30 },
      { itemId: 'sata_cable',       chance: 25 },
      { itemId: 'thermal_paste',    chance: 20 },
      { itemId: 'usb_hub',          chance: 10 },
      { itemId: 'optical_drive',    chance: 8  },
      { itemId: 'hdd_500gb',        chance: 5  },
      { itemId: 'cpu_cooler_stock', chance: 2  },
    ],
  },
  iron: {
    id: 'iron',
    name: '🔩 Железный кейс',
    price: 5000,
    emoji: '🔩',
    pool: [
      { itemId: 'ram_ddr3_4gb',    chance: 25 },
      { itemId: 'psu_450w',        chance: 20 },
      { itemId: 'patch_panel',     chance: 15 },
      { itemId: 'ssd_samsung',     chance: 15 },
      { itemId: 'ram_ddr4_16gb',   chance: 10 },
      { itemId: 'ups_650va',       chance: 8  },
      { itemId: 'noctua_nh_d15',   chance: 5  },
      { itemId: 'xeon_e5_v2',      chance: 2  },
    ],
  },
  quantum: {
    id: 'quantum',
    name: '⚛️ Квантовый кейс',
    price: 20000,
    emoji: '⚛️',
    pool: [
      { itemId: 'switch_cisco_16p', chance: 20 },
      { itemId: 'server_rack_12u',  chance: 15 },
      { itemId: 'gpu_1060',         chance: 15 },
      { itemId: 'xeon_e5_v2',       chance: 12 },
      { itemId: 'noctua_nh_d15',    chance: 10 },
      { itemId: 'xeon_gold',        chance: 10 },
      { itemId: 'ram_ddr5_64gb',    chance: 8  },
      { itemId: 'nvme_gen4',        chance: 6  },
      { itemId: 'custom_wcs',       chance: 3  },
      { itemId: 'fpga_xilinx',      chance: 1  },
    ],
  },
  singularity: {
    id: 'singularity',
    name: '🌌 Сингулярность',
    price: 100000,
    emoji: '🌌',
    pool: [
      { itemId: 'gpu_a100',         chance: 20 },
      { itemId: 'fpga_xilinx',      chance: 18 },
      { itemId: 'custom_wcs',       chance: 15 },
      { itemId: 'nvme_gen4',        chance: 12 },
      { itemId: 'xeon_platinum',    chance: 10 },
      { itemId: 'gold_heatsink',    chance: 8  },
      { itemId: 'ai_tensor_unit',   chance: 7  },
      { itemId: 'quantum_chip',     chance: 5  },
      { itemId: 'mao_cpu',          chance: 3  },
      { itemId: 'party_mainframe',  chance: 2  },
    ],
  },
};

function rollCaseItem(caseId) {
  const caseData = CASES_DB[caseId];
  if (!caseData) return null;
  const total = caseData.pool.reduce((s, x) => s + x.chance, 0);
  let rand = Math.random() * total;
  for (const entry of caseData.pool) {
    rand -= entry.chance;
    if (rand <= 0) return ITEMS_DB[entry.itemId] || null;
  }
  return ITEMS_DB[caseData.pool[0].itemId];
}

const ACHIEVEMENTS_LIST = {
  'first_work':    { name: '🔨 Первый рабочий',      desc: 'Первый раз поработал на заводе',    reward: 500  },
  'rich':          { name: '💰 Богач',               desc: 'Накопил 50 000 юаней',              reward: 1000 },
  'gambler':       { name: '🎰 Игрок',               desc: 'Сыграл в лотерею 5 раз',            reward: 500  },
  'thief':         { name: '🥷 Вор',                 desc: 'Успешно украл юани',                reward: 300  },
  'patriot':       { name: '🇨🇳 Патриот',            desc: 'Получил 20 000 соц. кредитов',      reward: 2000 },
  'exam_ace':      { name: '📚 Отличник Партии',     desc: 'Правильно ответил на 3 экзамена',   reward: 1500 },
  'wheel_jackpot': { name: '🎡 Любимец Фортуны',     desc: 'Выбил джекпот на колесе',           reward: 1000 },
  'cat_owner':     { name: '🐱 Владелец кошки',      desc: 'Купил кошку-жену',                  reward: 500  },
  'mine_master':   { name: '⛏️ Шахтёр Партии',       desc: 'Скопать 100 ударов в шахте',              reward: 2000 },
  'collector':     { name: '🗂️ Коллекционер',         desc: 'Собрать 10 уникальных предметов',         reward: 3000 },
  'trader':        { name: '💼 Торговец',             desc: 'Совершить первую сделку на аукционе',     reward: 1000 },
  'legendary_find':{ name: '👑 Охотник за легендами', desc: 'Найти легендарный предмет',              reward: 5000 },
};

// ════════════════════════════════════════════════════════════
// СХЕМЫ MONGOOSE
// ════════════════════════════════════════════════════════════
const DEFAULT_CREDITS = 10000;

const playerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  credits: { type: Number, default: DEFAULT_CREDITS },
  wallet: { type: Number, default: 0 },
  items: {
    cat_wife:     { type: Boolean, default: false },
    rice_bowls:   { type: Number,  default: 0 },
    pickaxeLevel: { type: Number,  default: 1 },
  },
  achievements: { type: [String], default: [] },
  workCooldowns: { type: Map, of: Number, default: {} },
  creditCooldown:   { type: Number, default: 0 },
  workCooldown:     { type: Number, default: 0 },
  dailyCooldown:    { type: Number, default: 0 },
  wheelCooldown:    { type: Number, default: 0 },
  examCooldown:     { type: Number, default: 0 },
  voteCooldown:     { type: Number, default: 0 },
  activityCooldown: { type: Number, default: 0 },
  examStreak:  { type: Number, default: 0 },
  jailUntil:   { type: Number, default: 0 },
  injuryUntil: { type: Number, default: 0 },
  lotteryCount: { type: Number, default: 0 },

  // Новые параметры из версии 2
  pickaxe_durability:     { type: Number, default: 100 },
  pickaxe_max_durability: { type: Number, default: 100 },
  total_mine_hits:        { type: Number, default: 0 },
  hardware_inventory:     { type: Map, of: Number, default: {} },
});
const Player = mongoose.model('Player', playerSchema);

const limitSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  startTime: { type: Number, default: 0 },
  used:      { type: Number, default: 0 },
});
const Limit = mongoose.model('Limit', limitSchema);

const workerDaySchema = new mongoose.Schema({
  _id:       { type: String, default: 'singleton' },
  shifts:    { type: Map, of: Number, default: {} },
  lastReset: { type: Number, default: () => Date.now() },
});
const WorkerDay = mongoose.model('WorkerDay', workerDaySchema);

const auctionSchema = new mongoose.Schema({
  lotId:     { type: String, required: true, unique: true, index: true },
  sellerId:  { type: String, required: true },
  itemId:    { type: String, required: true },
  quantity:  { type: Number, default: 1 },
  price:     { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  active:    { type: Boolean, default: true },
});
const Auction = mongoose.model('Auction', auctionSchema);

// ── Вспомогательные функции взаимодействия ─────────────────
async function getPlayer(userId) {
  let p = await Player.findOne({ userId });
  if (!p) {
    p = await Player.create({ userId });
  }
  return p;
}

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

async function getEco(userId) {
  const p = await getPlayer(userId);
  return { 
    wallet: p.wallet, 
    items: p.items, 
    save: async () => await p.save() 
  };
}

async function addYuan(userId, amount) {
  const p = await getPlayer(userId);
  p.wallet += amount;
  await p.save();
  return p.wallet;
}

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

async function giveAchievement(userId, achievementId) {
  const p = await getPlayer(userId);
  if (p.achievements.includes(achievementId)) return null;
  p.achievements.push(achievementId);
  const ach = ACHIEVEMENTS_LIST[achievementId];
  if (ach) p.credits += ach.reward;
  await p.save();
  return ach;
}

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

async function getLeaderboard(limit = 10) {
  return Player.find().sort({ credits: -1 }).limit(limit).select('userId credits');
}

async function resetAll() {
  await Player.deleteMany({});
  await Limit.deleteMany({});
  await WorkerDay.findByIdAndDelete('singleton');
  await Auction.deleteMany({});
}

async function incLotteryCount(userId) {
  const p = await getPlayer(userId);
  p.lotteryCount = (p.lotteryCount || 0) + 1;
  await p.save();
  return p.lotteryCount;
}

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
  ITEMS_DB,
  CASES_DB,
  RARITY_META,
  rollCaseItem,
  ACHIEVEMENTS_LIST,

  getCredits, addCredits,
  getEco, addYuan,
  checkCooldown, checkProfCooldown,
  checkAndUseLimit,
  getJailRemaining, sendToJail,
  getInjuryRemaining, setInjury, cureInjury,
  giveAchievement,
  trackShift, checkWorkerOfDayReset,
  getLeaderboard, resetAll,
  incLotteryCount,
  getExamStreak, setExamStreak,
  Auction,
};
