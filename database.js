'use strict';
const mongoose = require('mongoose');

// ── Подключение к БД ─────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI не задан в переменных окружения!');
  await mongoose.connect(uri);
  console.log('✅ MongoDB подключена');
}

// ════════════════════════════════════════════════════════════
// БАЗА ДАННЫХ КИРОК И СЛОТОВ
// ════════════════════════════════════════════════════════════
const PICKAXE_TYPES = {
  wood: {
    id: 'wood',
    name: '🪵 Деревянная кирка',
    rarity: 'common',
    maxDurability: 100,
    slots: 1,
    multiplier: 1.0,
    emoji: '🪵',
  },
  stone: {
    id: 'stone',
    name: '🪨 Каменная кирка',
    rarity: 'common',
    maxDurability: 200,
    slots: 1,
    multiplier: 1.5,
    emoji: '🪨',
  },
  iron: {
    id: 'iron',
    name: '⛓️ Железная кирка',
    rarity: 'rare',
    maxDurability: 400,
    slots: 2,
    multiplier: 2.5,
    emoji: '⛓️',
  },
  diamond: {
    id: 'diamond',
    name: '💎 Алмазная кирка',
    rarity: 'epic',
    maxDurability: 800,
    slots: 3,
    multiplier: 4.5,
    emoji: '💎',
  },
  quantum: {
    id: 'quantum',
    name: '⚛️ Квантовая кирка',
    rarity: 'legendary',
    maxDurability: 1800,
    slots: 4,
    multiplier: 8.0,
    emoji: '⚛️',
  },
  singularity: {
    id: 'singularity',
    name: '🌌 Сингулярность',
    rarity: 'secret',
    maxDurability: 4000,
    slots: 5,
    multiplier: 15.0,
    emoji: '🌌',
  },
};

// ════════════════════════════════════════════════════════════
// БАЗА ДАННЫХ УЛУЧШЕНИЙ (UPGRADES)
// ════════════════════════════════════════════════════════════
const UPGRADES_DB = {
  x3_payout: {
    id: 'x3_payout',
    name: '💰 Шанс x3 зарплаты',
    rarity: 'legendary',
    desc: '12% шанс утроить весь полученный доход за удар.',
    emoji: '💰',
  },
  yield_boost: {
    id: 'yield_boost',
    name: '📈 Увеличение добычи',
    rarity: 'common',
    desc: '+35% к базовой добыче ресурсов.',
    emoji: '📈',
  },
  crit_strike: {
    id: 'crit_strike',
    name: '⚡ Критический удар',
    rarity: 'rare',
    desc: '25% шанс нанести критический удар и удвоить доход.',
    emoji: '⚡',
  },
  auto_repair: {
    id: 'auto_repair',
    name: '🔧 Авто-восстановление прочности',
    rarity: 'rare',
    desc: '15% шанс восстановить +3 ед. прочности при ударе.',
    emoji: '🔧',
  },
  wear_reduction: {
    id: 'wear_reduction',
    name: '🛡️ Уменьшение износа',
    rarity: 'common',
    desc: '40% шанс не потратить прочность при копании.',
    emoji: '🛡️',
  },
  free_case_chance: {
    id: 'free_case_chance',
    name: '📦 Шанс бесплатного кейса',
    rarity: 'epic',
    desc: '5% шанс выбить кейс улучшений прямо в шахте.',
    emoji: '📦',
  },
  xp_boost: {
    id: 'xp_boost',
    name: '🎓 Увеличение опыта кирки',
    rarity: 'common',
    desc: '+100% к получаемому опыту кирки.',
    emoji: '🎓',
  },
  bonus_money: {
    id: 'bonus_money',
    name: '💵 Дополнительные деньги',
    rarity: 'rare',
    desc: 'Гарантированные +250 юаней к каждому удару.',
    emoji: '💵',
  },
  cooldown_reduction: {
    id: 'cooldown_reduction',
    name: '⏱️ Ускорение майнинга',
    rarity: 'epic',
    desc: 'Снижает кулдаун команды /mine с 5 до 3 секунд.',
    emoji: '⏱️',
  },
};

// Метаданные редкости
const RARITY_META = {
  common:    { label: 'Обычный',    color: '⬜', hex: 0xB0C4DE },
  rare:      { label: 'Редкий',     color: '🟦', hex: 0x1E90FF },
  epic:      { label: 'Эпический',  color: '🟪', hex: 0x9370DB },
  legendary: { label: 'Легендарн.', color: '🟨', hex: 0xFFD700 },
  secret:    { label: 'Секретный',  color: '🟥', hex: 0xFF4500 },
};

// ════════════════════════════════════════════════════════════
// КЕЙСЫ 2.0 (5 НОВЫХ КЕЙСОВ)
// ════════════════════════════════════════════════════════════
const CASES_DB = {
  bronze: {
    id: 'bronze',
    name: '📦 Бронзовый кейс',
    price: 3000,
    emoji: '📦',
    type: 'pickaxe',
    pool: [
      { itemId: 'wood',  chance: 70 },
      { itemId: 'stone', chance: 30 },
    ],
  },
  iron: {
    id: 'iron',
    name: '🔩 Железный кейс',
    price: 15000,
    emoji: '🔩',
    type: 'pickaxe',
    pool: [
      { itemId: 'stone',   chance: 60 },
      { itemId: 'iron',    chance: 35 },
      { itemId: 'diamond', chance: 5 },
    ],
  },
  upgrade_common: {
    id: 'upgrade_common',
    name: '⚙️ Кейс улучшений',
    price: 10000,
    emoji: '⚙️',
    type: 'upgrade',
    pool: [
      { itemId: 'yield_boost',    chance: 35 },
      { itemId: 'wear_reduction', chance: 35 },
      { itemId: 'xp_boost',       chance: 30 },
    ],
  },
  upgrade_rare: {
    id: 'upgrade_rare',
    name: '💎 Редкий кейс улучшений',
    price: 45000,
    emoji: '💎',
    type: 'upgrade',
    pool: [
      { itemId: 'crit_strike',         chance: 30 },
      { itemId: 'auto_repair',         chance: 25 },
      { itemId: 'bonus_money',         chance: 25 },
      { itemId: 'free_case_chance',    chance: 10 },
      { itemId: 'cooldown_reduction',  chance: 7  },
      { itemId: 'x3_payout',           chance: 3  },
    ],
  },
  singularity: {
    id: 'singularity',
    name: '🌌 Сингулярность',
    price: 250000,
    emoji: '🌌',
    type: 'pickaxe',
    pool: [
      { itemId: 'iron',        chance: 50 },
      { itemId: 'diamond',     chance: 35 },
      { itemId: 'quantum',     chance: 12 },
      { itemId: 'singularity', chance: 3  },
    ],
  },
};

// Функция розыгрыша из кейса
function rollCaseItem(caseId) {
  const caseData = CASES_DB[caseId];
  if (!caseData) return null;
  const total = caseData.pool.reduce((s, x) => s + x.chance, 0);
  let rand = Math.random() * total;
  for (const entry of caseData.pool) {
    rand -= entry.chance;
    if (rand <= 0) {
      return caseData.type === 'pickaxe' 
        ? PICKAXE_TYPES[entry.itemId] 
        : UPGRADES_DB[entry.itemId];
    }
  }
  const first = caseData.pool[0].itemId;
  return caseData.type === 'pickaxe' ? PICKAXE_TYPES[first] : UPGRADES_DB[first];
}

// ════════════════════════════════════════════════════════════
// ДОСТИЖЕНИЯ
// ════════════════════════════════════════════════════════════
const ACHIEVEMENTS_LIST = {
  first_work:    { name: '🏭 Первый рабочий',      desc: 'Поработать на заводе впервые', reward: 500  },
  patriot:       { name: '🇨🇳 Патриот',             desc: 'Набрать 20 000 соц. кредитов', reward: 1000 },
  wheel_jackpot: { name: '🎡 Удача Партии',         desc: 'Выбить джекпот на колесе фортуны', reward: 2000 },
  exam_ace:      { name: '📚 Отличник ЕГЭ',         desc: 'Правильно ответить на 3 вопроса подряд', reward: 1500 },
  cat_owner:     { name: '🐱 Муж котлеты',          desc: 'Купить кошку-жену', reward: 300  },
  thief:         { name: '🥷 Скрытый агент',        desc: 'Успешно украсть юани', reward: 800  },
  gambler:       { name: '🎰 Партийный игрок',      desc: 'Купить 5 лотерейных билетов', reward: 500  },
  mine_master:   { name: '⛏️ Шахтёр Партии',       desc: 'Скопать 100 ударов в шахте', reward: 2000 },
  collector:     { name: '🗂️ Коллекционер',         desc: 'Собрать 3 уникальные кирки', reward: 3000 },
  trader:        { name: '💼 Торговец',             desc: 'Совершить первую сделку на аукционе', reward: 1000 },
  max_upgrades:  { name: '⚙️ Инженер Партии',      desc: 'Заполнить все слоты улучшений на кирке', reward: 5000 },
};

// ════════════════════════════════════════════════════════════
// СХЕМЫ MONGOOSE (С ПОДДЕРЖКОЙ V2.0)
// ════════════════════════════════════════════════════════════

// Схема отдельной кирки
const PickaxeInstanceSchema = new mongoose.Schema({
  instanceId:    { type: String, required: true },
  typeKey:       { type: String, required: true },
  durability:    { type: Number, required: true },
  maxDurability: { type: Number, required: true },
  level:         { type: Number, default: 1 },
  xp:            { type: Number, default: 0 },
  upgrades:      { type: [String], default: [] },
});

const PlayerSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true, index: true },
  credits:      { type: Number, default: 10000 },
  achievements: { type: [String], default: [] },

  // Системы кирок V2.0
  pickaxes:          [PickaxeInstanceSchema],
  activePickaxeId:   { type: String, default: null },
  upgradesInventory: { type: Map, of: Number, default: {} },

  // Сохранено для обратной совместимости
  total_mine_hits:   { type: Number, default: 0 },
  hardware_inventory: { type: Map, of: Number, default: {} },
});

const Player = mongoose.model('Player', PlayerSchema);

const EcoSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  wallet: { type: Number, default: 0 },
  items:  {
    cat_wife:   { type: Boolean, default: false },
    rice_bowls: { type: Number, default: 0 },
  },
});
const Eco = mongoose.model('Eco', EcoSchema);

const CooldownSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  cooldownType: { type: String, required: true },
  lastUsed:     { type: Date, default: Date.now },
});
CooldownSchema.index({ userId: 1, cooldownType: 1 }, { unique: true });
const Cooldown = mongoose.model('Cooldown', CooldownSchema);

const StatusSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true },
  jailUntil:    { type: Date, default: null },
  injuryUntil:  { type: Date, default: null },
  lotteryCount: { type: Number, default: 0 },
  examStreak:   { type: Number, default: 0 },
});
const Status = mongoose.model('Status', StatusSchema);

const WorkerDaySchema = new mongoose.Schema({
  _id:       { type: String, default: 'singleton' },
  shifts:    { type: Map, of: Number, default: {} },
  lastReset: { type: Date, default: Date.now },
});
const WorkerDay = mongoose.model('WorkerDay', WorkerDaySchema);

const AuctionSchema = new mongoose.Schema({
  lotId:     { type: String, required: true, unique: true, index: true },
  sellerId:  { type: String, required: true },
  itemId:    { type: String, required: true },
  quantity:  { type: Number, default: 1 },
  price:     { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  active:    { type: Boolean, default: true },
});
const Auction = mongoose.model('Auction', AuctionSchema);

const CreditLimitSchema = new mongoose.Schema({
  userId:  { type: String, required: true, unique: true },
  used:    { type: Number, default: 0 },
  resetAt: { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) },
});
const CreditLimit = mongoose.model('CreditLimit', CreditLimitSchema);

// ════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И АВТО-МИГРАЦИЯ
// ════════════════════════════════════════════════════════════

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Получение игрока с АВТОМАТИЧЕСКИМ созданием стартовой деревянной кирки
async function getPlayer(userId) {
  let player = await Player.findOne({ userId });
  if (!player) {
    player = new Player({ userId });
  }

  // Если у игрока ещё нет кирок — выдаём стартовую деревянную
  if (!player.pickaxes || player.pickaxes.length === 0) {
    const starterId = 'px_' + generateId();
    const woodType  = PICKAXE_TYPES.wood;
    player.pickaxes.push({
      instanceId: starterId,
      typeKey: 'wood',
      durability: woodType.maxDurability,
      maxDurability: woodType.maxDurability,
      level: 1,
      xp: 0,
      upgrades: [],
    });
    player.activePickaxeId = starterId;
    await player.save();
  }

  return player;
}

async function getCredits(userId) {
  const p = await getPlayer(userId);
  return p.credits;
}

async function addCredits(userId, amount) {
  const p = await Player.findOneAndUpdate(
    { userId },
    { $inc: { credits: amount }, $setOnInsert: { userId } },
    { upsert: true, new: true }
  );
  return p.credits;
}

async function getEco(userId) {
  return Eco.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true }
  );
}

async function addYuan(userId, amount) {
  const eco = await Eco.findOneAndUpdate(
    { userId },
    { $inc: { wallet: amount }, $setOnInsert: { userId } },
    { upsert: true, new: true }
  );
  return eco.wallet;
}

// ── МЕНЕДЖМЕНТ КИРОК И УЛУЧШЕНИЙ ─────────────────────────────

// Добавление кирки в инвентарь игрока
async function givePickaxe(userId, typeKey) {
  const p = await getPlayer(userId);
  const typeMeta = PICKAXE_TYPES[typeKey];
  if (!typeMeta) return null;

  const newId = 'px_' + generateId();
  const pickaxeObj = {
    instanceId: newId,
    typeKey,
    durability: typeMeta.maxDurability,
    maxDurability: typeMeta.maxDurability,
    level: 1,
    xp: 0,
    upgrades: [],
  };

  p.pickaxes.push(pickaxeObj);
  if (!p.activePickaxeId) p.activePickaxeId = newId;
  await p.save();
  return pickaxeObj;
}

// Добавление улучшения в инвентарь
async function addUpgradeToInventory(userId, upgradeId, qty = 1) {
  const p = await getPlayer(userId);
  const current = p.upgradesInventory.get(upgradeId) || 0;
  p.upgradesInventory.set(upgradeId, current + qty);
  p.markModified('upgradesInventory');
  await p.save();
  return current + qty;
}

// Экипировка кирки
async function equipPickaxe(userId, instanceId) {
  const p = await getPlayer(userId);
  const exists = p.pickaxes.find(x => x.instanceId === instanceId);
  if (!exists) return false;
  p.activePickaxeId = instanceId;
  await p.save();
  return exists;
}

// Починка активной кирки за юани
async function repairActivePickaxe(userId) {
  const p = await getPlayer(userId);
  const active = p.pickaxes.find(x => x.instanceId === p.activePickaxeId);
  if (!active) return { error: 'Активная кирка не найдена.' };

  const lostDur = active.maxDurability - active.durability;
  if (lostDur <= 0) return { alreadyFull: true };

  const typeMeta = PICKAXE_TYPES[active.typeKey] || PICKAXE_TYPES.wood;
  const cost = Math.ceil(lostDur * 12 * (active.level * 0.5 + 0.5));

  const eco = await getEco(userId);
  if (eco.wallet < cost) return { error: `Недостаточно юаней! Нужно **${cost} ¥**.` };

  eco.wallet -= cost;
  active.durability = active.maxDurability;
  await eco.save();
  await p.save();

  return { success: true, cost, restored: lostDur };
}

// Надевание улучшения на кирку
async function applyUpgrade(userId, instanceId, upgradeId) {
  const p = await getPlayer(userId);
  const pickaxe = p.pickaxes.find(x => x.instanceId === instanceId);
  if (!pickaxe) return { error: 'Кирка не найдена.' };

  const typeMeta = PICKAXE_TYPES[pickaxe.typeKey];
  if (pickaxe.upgrades.length >= typeMeta.slots) {
    return { error: `На этой кирке нет свободных слотов! (Макс: ${typeMeta.slots})` };
  }

  const count = p.upgradesInventory.get(upgradeId) || 0;
  if (count <= 0) return { error: 'У вас нет этого улучшения в инвентаре!' };

  // Изъятие улучшения
  if (count - 1 === 0) p.upgradesInventory.delete(upgradeId);
  else p.upgradesInventory.set(upgradeId, count - 1);
  p.markModified('upgradesInventory');

  // Установка
  pickaxe.upgrades.push(upgradeId);
  await p.save();

  if (pickaxe.upgrades.length >= typeMeta.slots) {
    await giveAchievement(userId, 'max_upgrades');
  }

  return { success: true, pickaxe, upgrade: UPGRADES_DB[upgradeId] };
}

// Снятие улучшений (уничтожение без возврата)
async function removeUpgrade(userId, instanceId, slotIndex) {
  const p = await getPlayer(userId);
  const pickaxe = p.pickaxes.find(x => x.instanceId === instanceId);
  if (!pickaxe) return { error: 'Кирка не найдена.' };

  if (slotIndex < 0 || slotIndex >= pickaxe.upgrades.length) {
    return { error: 'Неверный слот улучшения.' };
  }

  const removedUpgradeId = pickaxe.upgrades.splice(slotIndex, 1)[0];
  await p.save();

  return { success: true, destroyedUpgrade: UPGRADES_DB[removedUpgradeId] };
}

// ── КУЛДАУНЫ И ОГРАНИЧЕНИЯ ──────────────────────────────────
async function checkCooldown(userId, type, durationMs) {
  const doc = await Cooldown.findOne({ userId, cooldownType: type });
  const now = Date.now();
  if (!doc) {
    await Cooldown.create({ userId, cooldownType: type, lastUsed: new Date() });
    return { allowed: true, waitMs: 0 };
  }
  const elapsed = now - doc.lastUsed.getTime();
  if (elapsed < durationMs) return { allowed: false, waitMs: durationMs - elapsed };
  doc.lastUsed = new Date();
  await doc.save();
  return { allowed: true, waitMs: 0 };
}

async function checkProfCooldown(userId, type, durationMs) {
  return checkCooldown(userId, `prof_${type}`, durationMs);
}

const LIMIT_PER_30MIN = 10000;
async function checkAndUseLimit(userId, amount) {
  const now = new Date();
  let doc = await CreditLimit.findOne({ userId });
  if (!doc || doc.resetAt <= now) {
    doc = await CreditLimit.findOneAndUpdate(
      { userId },
      { used: 0, resetAt: new Date(Date.now() + 30 * 60 * 1000) },
      { upsert: true, new: true }
    );
  }
  const remaining = LIMIT_PER_30MIN - doc.used;
  if (amount > remaining) {
    return { allowed: false, remaining, resetIn: doc.resetAt - now };
  }
  doc.used += amount;
  await doc.save();
  return { allowed: true, remaining: LIMIT_PER_30MIN - doc.used, resetIn: doc.resetAt - now };
}

// ── ТЮРЬМА И ТРАВМЫ ─────────────────────────────────────────
async function getJailRemaining(userId) {
  const s = await Status.findOne({ userId });
  if (!s || !s.jailUntil) return 0;
  return Math.max(0, s.jailUntil.getTime() - Date.now());
}

async function sendToJail(userId, minMs, maxMs) {
  const term = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await Status.findOneAndUpdate(
    { userId },
    { jailUntil: new Date(Date.now() + term) },
    { upsert: true }
  );
  return term;
}

async function getInjuryRemaining(userId) {
  const s = await Status.findOne({ userId });
  if (!s || !s.injuryUntil) return 0;
  return Math.max(0, s.injuryUntil.getTime() - Date.now());
}

// ── ДОСТИЖЕНИЯ ───────────────────────────────────────────────
async function giveAchievement(userId, achievementId) {
  const ach = ACHIEVEMENTS_LIST[achievementId];
  if (!ach) return null;
  const p = await getPlayer(userId);
  if (p.achievements.includes(achievementId)) return null;
  p.achievements.push(achievementId);
  await p.save();
  await addCredits(userId, ach.reward);
  return ach;
}

// ── СМЕНЫ / РЕЙТИНГ ──────────────────────────────────────────
async function trackShift(userId) {
  let doc = await WorkerDay.findById('singleton');
  if (!doc) doc = await WorkerDay.create({ _id: 'singleton' });
  const current = doc.shifts.get(userId) || 0;
  doc.shifts.set(userId, current + 1);
  doc.markModified('shifts');
  await doc.save();
}

async function checkWorkerOfDayReset(client, guildId, workerDayMs, bonusCredits, bonusYuan) {
  let doc = await WorkerDay.findById('singleton');
  if (!doc) return;
  const now = Date.now();
  if (!doc.lastReset || now - doc.lastReset.getTime() >= workerDayMs) {
    if (doc.shifts && doc.shifts.size > 0) {
      const sorted = [...doc.shifts.entries()].sort((a, b) => b[1] - a[1]);
      const [winnerId, shifts] = sorted[0];
      await addCredits(winnerId, bonusCredits);
      await addYuan(winnerId, bonusYuan);
      try {
        const guild   = await client.guilds.fetch(guildId);
        const channel = guild.channels.cache.find(c => c.isTextBased?.());
        if (channel) {
          channel.send(`🏆 **Работник дня:** <@${winnerId}> с **${shifts}** сменами!\n⭐ +${bonusCredits} соц. кредитов | 💴 +${bonusYuan} юаней`);
        }
      } catch { }
    }
    await WorkerDay.findByIdAndUpdate('singleton', { shifts: {}, lastReset: new Date() }, { upsert: true });
  }
}

async function getLeaderboard(limit = 10) {
  return Player.find().sort({ credits: -1 }).limit(limit).select('userId credits');
}

async function resetAll() {
  await Promise.all([
    Player.deleteMany({}),
    Eco.deleteMany({}),
    Cooldown.deleteMany({}),
    Status.deleteMany({}),
    WorkerDay.deleteMany({}),
    CreditLimit.deleteMany({}),
    Auction.deleteMany({}),
  ]);
}

async function getExamStreak(userId) {
  const s = await Status.findOne({ userId });
  return s?.examStreak || 0;
}

async function setExamStreak(userId, val) {
  await Status.findOneAndUpdate({ userId }, { examStreak: val }, { upsert: true });
}

async function incLotteryCount(userId) {
  const s = await Status.findOneAndUpdate(
    { userId },
    { $inc: { lotteryCount: 1 } },
    { upsert: true, new: true }
  );
  return s.lotteryCount;
}

// ════════════════════════════════════════════════════════════
// ЭКСПОРТ МОДУЛЯ
// ════════════════════════════════════════════════════════════
module.exports = {
  connectDB,
  ACHIEVEMENTS_LIST,
  PICKAXE_TYPES,
  UPGRADES_DB,
  RARITY_META,
  CASES_DB,
  rollCaseItem,

  getPlayer,
  getCredits,
  addCredits,
  getEco,
  addYuan,

  givePickaxe,
  addUpgradeToInventory,
  equipPickaxe,
  repairActivePickaxe,
  applyUpgrade,
  removeUpgrade,

  checkCooldown,
  checkProfCooldown,
  checkAndUseLimit,

  getJailRemaining,
  sendToJail,
  getInjuryRemaining,

  giveAchievement,
  trackShift,
  checkWorkerOfDayReset,
  getLeaderboard,
  resetAll,

  incLotteryCount,
  getExamStreak,
  setExamStreak,
};
