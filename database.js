'use strict';
const mongoose = require('mongoose');

// ── Подключение к БД ─────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI не задан в переменных окружения!');

  mongoose.connection.on('error', (err) => {
    console.error('❌ Ошибка соединения с MongoDB:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Соединение с MongoDB потеряно. Переподключение...');
  });

  await mongoose.connect(uri);
  console.log('✅ MongoDB успешно подключена');
}

// ════════════════════════════════════════════════════════════
// БАЗА ДАННЫХ ПРЕДМЕТОВ (30 ПРЕДМЕТОВ СЕРВЕРНОГО ЖЕЛЕЗА)
// ════════════════════════════════════════════════════════════
const ITEMS_DB = {
  // ── Обычные (10 шт.) ─────────────────────────────────────
  cat5e_cable:      { id: 'cat5e_cable',      name: '🔵 Кабель Cat5e',           rarity: 'common',    power: 5,   desc: 'Стандартный сетевой кабель Cat5e. Партия одобряет бережливость.' },
  sata_cable:       { id: 'sata_cable',       name: '🔴 SATA-кабель',            rarity: 'common',    power: 5,   desc: 'Соединяет диски с материнской платой. Базовый расходник.' },
  thermal_paste:    { id: 'thermal_paste',    name: '⚪ Термопаста КПТ-8',       rarity: 'common',    power: 8,   desc: 'Советская термопаста. Кладут везде, но в меру.' },
  hdd_500gb:        { id: 'hdd_500gb',        name: '🖤 HDD 500GB',              rarity: 'common',    power: 10,  desc: '500 гигабайт верности Партии. Медленно, но надёжно.' },
  ram_ddr3_4gb:     { id: 'ram_ddr3_4gb',     name: '🟢 RAM DDR3 4GB',           rarity: 'common',    power: 12,  desc: 'Оперативная память эпохи расцвета. Ещё держится.' },
  psu_450w:         { id: 'psu_450w',         name: '🟡 БП 450W',                rarity: 'common',    power: 10,  desc: 'Блок питания 450 ватт. Гудит, но работает.' },
  cpu_cooler_stock: { id: 'cpu_cooler_stock', name: '🌀 Боксовый кулер',         rarity: 'common',    power: 6,   desc: 'Стандартный кулер из коробки. Шумит как трактор.' },
  usb_hub:          { id: 'usb_hub',          name: '🔌 USB-хаб 4-порта',        rarity: 'common',    power: 4,   desc: 'Множитель портов. Партия одобряет эффективность.' },
  patch_panel:      { id: 'patch_panel',      name: '🟠 Патч-панель 24p',        rarity: 'common',    power: 8,   desc: '24 порта коммутации. Для малых серверных.' },
  optical_drive:    { id: 'optical_drive',    name: '💿 DVD-привод',              rarity: 'common',    power: 3,   desc: 'Читает диски. Зачем? Не важно. Пусть будет.' },

  // ── Редкие (8 шт.) ───────────────────────────────────────
  ssd_samsung:      { id: 'ssd_samsung',      name: '🔷 SSD Samsung 1TB',        rarity: 'rare',      power: 40,  desc: 'Скоростной накопитель. 3500 Mb/s чтения. Уважаемый товарищ.' },
  ram_ddr4_16gb:    { id: 'ram_ddr4_16gb',    name: '💚 RAM DDR4 16GB',           rarity: 'rare',      power: 45,  desc: 'Оперативная память нового поколения. Партия растёт.' },
  xeon_e5_v2:       { id: 'xeon_e5_v2',       name: '🔩 Intel Xeon E5 v2',       rarity: 'rare',      power: 60,  desc: '8 ядер для нужд Партии. Сервер начинает дышать.' },
  gpu_1060:         { id: 'gpu_1060',          name: '💎 NVIDIA GTX 1060 6GB',    rarity: 'rare',      power: 55,  desc: 'Графика для вычислений. И иногда игр. Шш.' },
  switch_cisco_16p: { id: 'switch_cisco_16p', name: '🌐 Cisco Switch 16p',       rarity: 'rare',      power: 50,  desc: '16-портовый управляемый коммутатор. Элита сетей.' },
  noctua_nh_d15:    { id: 'noctua_nh_d15',    name: '🦉 Noctua NH-D15',          rarity: 'rare',      power: 42,  desc: 'Тихий башенный кулер. Работает как совы — бесшумно.' },
  server_rack_12u:  { id: 'server_rack_12u',  name: '🗄️ Серверная стойка 12U',   rarity: 'rare',      power: 35,  desc: '12 юнитов для оборудования. Основа серверной комнаты.' },
  ups_650va:        { id: 'ups_650va',         name: '🔋 ИБП 650VA',              rarity: 'rare',      power: 38,  desc: 'Источник бесперебойного питания. Спасает от отключений.' },

  // ── Эпические (6 шт.) ────────────────────────────────────
  xeon_gold:        { id: 'xeon_gold',         name: '⚡ Intel Xeon Gold 6230',   rarity: 'epic',      power: 150, desc: '20 ядер серверной мощи. Партийные вычисления ускоряются.' },
  ram_ddr5_64gb:    { id: 'ram_ddr5_64gb',     name: '💠 RAM DDR5 64GB ECC',      rarity: 'epic',      power: 140, desc: 'ECC-память для критических задач. Ошибки исключены.' },
  nvme_gen4:        { id: 'nvme_gen4',         name: '🔥 NVMe Gen4 4TB',          rarity: 'epic',      power: 130, desc: '7000 Mb/s. Быстрее, чем решения Партийного комитета.' },
  gpu_a100:         { id: 'gpu_a100',          name: '🤖 NVIDIA A100 80GB',       rarity: 'epic',      power: 200, desc: 'Ускоритель для ИИ Партии. Товарищ DeepSeek одобряет.' },
  custom_wcs:       { id: 'custom_wcs',        name: '🌊 Кастомная СЖО 360мм',   rarity: 'epic',      power: 120, desc: 'Водяное охлаждение под заказ. Температура: ниже зависти.' },
  fpga_xilinx:      { id: 'fpga_xilinx',       name: '🔬 FPGA Xilinx Alveo U250', rarity: 'epic',      power: 180, desc: 'Программируемая матрица. Партия перепрограммирует всё.' },

  // ── Легендарные (4 шт.) ───────────────────────────────────
  xeon_platinum:    { id: 'xeon_platinum',     name: '👑 Intel Xeon Platinum 8380', rarity: 'legendary', power: 400, desc: '40 ядер. 80 потоков. Душа сервера Партии.' },
  quantum_chip:     { id: 'quantum_chip',      name: '⚛️ Квантовый чип прототип', rarity: 'legendary', power: 500, desc: 'Экспериментальный. Суперпозиция работы и не-работы.' },
  gold_heatsink:    { id: 'gold_heatsink',     name: '🏅 Золотой радиатор',       rarity: 'legendary', power: 350, desc: 'Радиатор из золотого сплава. Аномально эффективен.' },
  ai_tensor_unit:   { id: 'ai_tensor_unit',    name: '🧠 AI Tensor Unit v3',      rarity: 'legendary', power: 600, desc: 'Нейросетевой акселератор 3-го поколения. Разум Партии.' },

  // ── Секретные (2 шт.) ────────────────────────────────────
  mao_cpu:          { id: 'mao_cpu',           name: '🌟 Процессор Мао-9000',     rarity: 'secret',    power: 1000, desc: 'Легендарный процессор, созданный по указу Великого Кормчего. Никто не знает, как он работает.' },
  party_mainframe:  { id: 'party_mainframe',   name: '🏯 Мэйнфрейм Партии-1',    rarity: 'secret',    power: 2000, desc: 'Единственный экземпляр. Хранит все тайны Партии. Очень тёплый.' },
};

// Редкость: метаданные
const RARITY_META = {
  common:    { label: 'Обычный',    color: '⬜', emoji: '⬜' },
  rare:      { label: 'Редкий',     color: '🟦', emoji: '🟦' },
  epic:      { label: 'Эпический',  color: '🟪', emoji: '🟪' },
  legendary: { label: 'Легендарн.', color: '🟨', emoji: '🟨' },
  secret:    { label: 'Секретный',  color: '🟥', emoji: '🟥' },
};

// ════════════════════════════════════════════════════════════
// КЕЙСЫ ОБОРУДОВАНИЯ
// ════════════════════════════════════════════════════════════
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

// Функция розыгрыша из кейса
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

// ════════════════════════════════════════════════════════════
// ДОСТИЖЕНИЯ
// ════════════════════════════════════════════════════════════
const ACHIEVEMENTS_LIST = {
  first_work:    { name: '🏭 Первый рабочий',      desc: 'Поработать на заводе впервые',            reward: 500  },
  patriot:       { name: '🇨🇳 Патриот',             desc: 'Набрать 20 000 соц. кредитов',            reward: 1000 },
  wheel_jackpot: { name: '🎡 Удача Партии',         desc: 'Выбить джекпот на колесе фортуны',        reward: 2000 },
  exam_ace:      { name: '📚 Отличник ЕГЭ',         desc: 'Правильно ответить на 3 вопроса подряд',  reward: 1500 },
  cat_owner:     { name: '🐱 Муж котлеты',          desc: 'Купить кошку-жену',                       reward: 300  },
  thief:         { name: '🥷 Скрытый агент',        desc: 'Успешно украсть юани',                    reward: 800  },
  gambler:       { name: '🎰 Партийный игрок',      desc: 'Купить 5 лотерейных билетов',             reward: 500  },
  mine_master:   { name: '⛏️ Шахтёр Партии',       desc: 'Скопать 100 ударов в шахте',              reward: 2000 },
  collector:     { name: '🗂️ Коллекционер',         desc: 'Собрать 10 уникальных предметов',         reward: 3000 },
  trader:        { name: '💼 Торговец',             desc: 'Совершить первую сделку на аукционе',     reward: 1000 },
  legendary_find:{ name: '👑 Охотник за легендами', desc: 'Найти легендарный предмет',              reward: 5000 },
};

// ════════════════════════════════════════════════════════════
// СХЕМЫ MONGOOSE
// ════════════════════════════════════════════════════════════

// ── Игрок (кредиты + достижения + кирка + инвентарь) ────────
const PlayerSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true, index: true },
  credits:      { type: Number, default: 10000 },
  achievements: { type: [String], default: [] },

  // Параметры кирки
  pickaxe_level:          { type: Number, default: 1 },
  pickaxe_durability:     { type: Number, default: 100 },
  pickaxe_max_durability: { type: Number, default: 100 },
  total_mine_hits:        { type: Number, default: 0 },

  // Инвентарь предметов железа: { itemId: quantity }
  hardware_inventory: { type: Map, of: Number, default: {} },
});
const Player = mongoose.model('Player', PlayerSchema);

// ── Экономика (юани, предметы) ───────────────────────────────
const EcoSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  wallet: { type: Number, default: 0 },
  items:  {
    cat_wife:      { type: Boolean, default: false },
    rice_bowls:    { type: Number, default: 0 },
    pickaxeLevel:  { type: Number, default: 1 },
  },
});
const Eco = mongoose.model('Eco', EcoSchema);

// ── Кулдауны ────────────────────────────────────────────────
const CooldownSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  cooldownType: { type: String, required: true },
  lastUsed:     { type: Date, default: Date.now },
});
CooldownSchema.index({ userId: 1, cooldownType: 1 }, { unique: true });
const Cooldown = mongoose.model('Cooldown', CooldownSchema);

// ── Тюрьма / Травмы ─────────────────────────────────────────
const StatusSchema = new mongoose.Schema({
  userId:      { type: String, required: true, unique: true },
  jailUntil:   { type: Date, default: null },
  injuryUntil: { type: Date, default: null },
  lotteryCount:{ type: Number, default: 0 },
  examStreak:  { type: Number, default: 0 },
});
const Status = mongoose.model('Status', StatusSchema);

// ── Смены рабочего дня ──────────────────────────────────────
const WorkerDaySchema = new mongoose.Schema({
  _id:       { type: String, default: 'singleton' },
  shifts:    { type: Map, of: Number, default: {} },
  lastReset: { type: Date, default: Date.now },
});
const WorkerDay = mongoose.model('WorkerDay', WorkerDaySchema);

// ── Аукцион ─────────────────────────────────────────────────
const AuctionSchema = new mongoose.Schema({
  lotId:     { type: String, required: true, unique: true, index: true },
  sellerId:  { type: String, required: true, index: true },
  itemId:    { type: String, required: true },
  quantity:  { type: Number, default: 1 },
  price:     { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  active:    { type: Boolean, default: true, index: true },
});
const Auction = mongoose.model('Auction', AuctionSchema);

// ── Лимит кредитов ──────────────────────────────────────────
const CreditLimitSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  used:      { type: Number, default: 0 },
  resetAt:   { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) },
});
const CreditLimit = mongoose.model('CreditLimit', CreditLimitSchema);

// ════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ════════════════════════════════════════════════════════════

// Генерация ID лота
function generateLotId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Игроки / Баллы ──────────────────────────────────────────
async function getPlayer(userId) {
  return Player.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true }
  );
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
  
  // Авто-проверка патриота при пополнении
  if (p.credits >= 20000) {
    await giveAchievement(userId, 'patriot');
  }
  return p.credits;
}

// ── Кирка ────────────────────────────────────────────────────
async function getPickaxeData(userId) {
  const p = await getPlayer(userId);
  return {
    level:          p.pickaxe_level,
    durability:     p.pickaxe_durability,
    max_durability: p.pickaxe_max_durability,
    total_hits:     p.total_mine_hits,
  };
}

async function damagePickaxe(userId) {
  const dmg = Math.floor(Math.random() * 3) + 1; // 1-3
  const p = await Player.findOneAndUpdate(
    { userId },
    {
      $inc: { pickaxe_durability: -dmg, total_mine_hits: 1 },
      $setOnInsert: { userId },
    },
    { upsert: true, new: true }
  );

  if (p.total_mine_hits >= 100) {
    await giveAchievement(userId, 'mine_master');
  }

  return { dmg, newDurability: p.pickaxe_durability, totalHits: p.total_mine_hits };
}

async function repairPickaxe(userId) {
  const p = await getPlayer(userId);
  const lostDurability = p.pickaxe_max_durability - p.pickaxe_durability;
  if (lostDurability <= 0) return { alreadyFull: true, cost: 0 };

  const cost = Math.ceil(lostDurability * 15 * p.pickaxe_level);
  return { alreadyFull: false, cost, lostDurability, currentDur: p.pickaxe_durability, maxDur: p.pickaxe_max_durability };
}

async function applyRepairPickaxe(userId) {
  const info = await repairPickaxe(userId);
  if (info.alreadyFull) return info;
  const p = await Player.findOneAndUpdate(
    { userId },
    { $set: { pickaxe_durability: info.maxDur } },
    { new: true }
  );
  return { ...info, newDurability: p.pickaxe_durability };
}

async function upgradePickaxe(userId) {
  const p = await getPlayer(userId);
  const currentLevel = p.pickaxe_level;
  const cost = Math.ceil(3000 * Math.pow(currentLevel, 1.7));
  return { currentLevel, cost };
}

async function applyPickaxeUpgrade(userId) {
  const info = await upgradePickaxe(userId);
  const p = await Player.findOneAndUpdate(
    { userId },
    { $inc: { pickaxe_level: 1 }, $set: { pickaxe_durability: 100, pickaxe_max_durability: 100 } },
    { new: true }
  );
  return { ...info, newLevel: p.pickaxe_level };
}

// ── Инвентарь железа ─────────────────────────────────────────
async function addHardwareItem(userId, itemId, qty = 1) {
  const p = await getPlayer(userId);
  const current = p.hardware_inventory.get(itemId) || 0;
  p.hardware_inventory.set(itemId, current + qty);
  p.markModified('hardware_inventory');
  await p.save();

  // Автоматическая проверка коллекционера (10 уникальных предметов)
  if (p.hardware_inventory.size >= 10) {
    await giveAchievement(userId, 'collector');
  }

  // Проверка легендарки
  const meta = ITEMS_DB[itemId];
  if (meta && (meta.rarity === 'legendary' || meta.rarity === 'secret')) {
    await giveAchievement(userId, 'legendary_find');
  }

  return current + qty;
}

async function removeHardwareItem(userId, itemId, qty = 1) {
  const p = await getPlayer(userId);
  const current = p.hardware_inventory.get(itemId) || 0;
  if (current < qty) return false;
  if (current - qty === 0) p.hardware_inventory.delete(itemId);
  else p.hardware_inventory.set(itemId, current - qty);
  p.markModified('hardware_inventory');
  await p.save();
  return true;
}

async function getHardwareInventory(userId) {
  const p = await getPlayer(userId);
  const result = [];
  for (const [itemId, qty] of p.hardware_inventory.entries()) {
    const meta = ITEMS_DB[itemId];
    if (meta) result.push({ itemId, qty, meta });
  }
  return result;
}

function hasHardwareItem(playerOrInventory, itemId) {
  if (!playerOrInventory) return false;
  
  // Поддержка и объекта Player, и Map
  let inv = playerOrInventory.hardware_inventory || playerOrInventory;
  if (inv instanceof Map) {
    return (inv.get(itemId) || 0) > 0;
  }
  return (inv[itemId] || 0) > 0;
}

// ── [НАРАБОТКА] Суммарная мощность железа игрока ────────────
async function calculateTotalPower(userId) {
  const inventory = await getHardwareInventory(userId);
  return inventory.reduce((total, item) => total + (item.meta.power * item.qty), 0);
}

// ── Экономика (юани) ─────────────────────────────────────────
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

// ── Кулдауны ─────────────────────────────────────────────────
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

// ── Лимит кредитов (owner) ───────────────────────────────────
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

// ── Тюрьма ───────────────────────────────────────────────────
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

// ── Травмы ───────────────────────────────────────────────────
async function getInjuryRemaining(userId) {
  const s = await Status.findOne({ userId });
  if (!s || !s.injuryUntil) return 0;
  return Math.max(0, s.injuryUntil.getTime() - Date.now());
}

async function setInjury(userId, durationMs) {
  await Status.findOneAndUpdate(
    { userId },
    { injuryUntil: new Date(Date.now() + durationMs) },
    { upsert: true }
  );
}

async function cureInjury(userId) {
  await Status.findOneAndUpdate({ userId }, { injuryUntil: null }, { upsert: true });
}

// ── Достижения ───────────────────────────────────────────────
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

// ── Смены дня ────────────────────────────────────────────────
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

// ── Таблица лидеров ──────────────────────────────────────────
async function getLeaderboard(limit = 10) {
  return Player.find().sort({ credits: -1 }).limit(limit).select('userId credits');
}

// ── Полный сброс данных ──────────────────────────────────────
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

// ── Экзамен ──────────────────────────────────────────────────
async function getExamStreak(userId) {
  const s = await Status.findOne({ userId });
  return s?.examStreak || 0;
}

async function setExamStreak(userId, val) {
  await Status.findOneAndUpdate({ userId }, { examStreak: val }, { upsert: true });
}

// ── Лотерея ──────────────────────────────────────────────────
async function incLotteryCount(userId) {
  const s = await Status.findOneAndUpdate(
    { userId },
    { $inc: { lotteryCount: 1 } },
    { upsert: true, new: true }
  );
  if (s.lotteryCount >= 5) {
    await giveAchievement(userId, 'gambler');
  }
  return s.lotteryCount;
}

// ════════════════════════════════════════════════════════════
// АУКЦИОН
// ════════════════════════════════════════════════════════════
async function createAuction(sellerId, itemId, quantity, price) {
  const hasItem = await removeHardwareItem(sellerId, itemId, quantity);
  if (!hasItem) return { error: 'Недостаточно предметов для продажи!' };

  let lotId;
  let attempts = 0;
  while (attempts < 10) {
    lotId = generateLotId();
    const exists = await Auction.findOne({ lotId });
    if (!exists) break;
    attempts++;
  }
  
  const auction = await Auction.create({ lotId, sellerId, itemId, quantity, price });
  return { success: true, auction };
}

async function getActiveAuctions() {
  return Auction.find({ active: true }).sort({ createdAt: -1 }).lean();
}

async function getUserAuctionList(userId) {
  return Auction.find({ sellerId: userId, active: true }).sort({ createdAt: -1 }).lean();
}

// [НАРАБОТКА] Атомарная покупка без race-condition
async function buyAuction(lotId, buyerId) {
  const buyerEco = await getEco(buyerId);

  // 1. Находим лот
  const lotCheck = await Auction.findOne({ lotId, active: true });
  if (!lotCheck) return { error: 'Лот не найден или уже куплен.' };
  if (lotCheck.sellerId === buyerId) return { error: 'Нельзя купить свой лот!' };
  if (buyerEco.wallet < lotCheck.price) return { error: `Недостаточно юаней! Нужно **${lotCheck.price}** 💴` };

  // 2. Атомарно выкупаем лот (lock)
  const lot = await Auction.findOneAndUpdate(
    { lotId, active: true },
    { $set: { active: false } },
    { new: true }
  );

  if (!lot) return { error: 'Лот был куплен другим игроком доли секунды назад!' };

  // 3. Выполняем финансовые операции
  const tax = Math.ceil(lot.price * 0.02); // 2% налог
  const sellerGet = lot.price - tax;

  await addYuan(buyerId, -lot.price);
  await addYuan(lot.sellerId, sellerGet);
  await addHardwareItem(buyerId, lot.itemId, lot.quantity);

  // Выдаем ачивки участникам
  await giveAchievement(buyerId, 'trader');
  await giveAchievement(lot.sellerId, 'trader');

  return { success: true, lot, tax, sellerGet };
}

async function cancelAuction(lotId, userId) {
  const lot = await Auction.findOneAndUpdate(
    { lotId, sellerId: userId, active: true },
    { $set: { active: false } },
    { new: true }
  );

  if (!lot) return { error: 'Лот не найден или вы не являетесь его владельцем.' };

  await addHardwareItem(userId, lot.itemId, lot.quantity);
  return { success: true, lot };
}

// ════════════════════════════════════════════════════════════
// [НАРАБОТКИ] КОМПЛЕКСНЫЕ ХЕЛПЕРЫ
// ════════════════════════════════════════════════════════════

// Полный процесс открытия кейса с учётом денег и наград
async function openCase(userId, caseId) {
  const caseData = CASES_DB[caseId];
  if (!caseData) return { error: 'Кейс не найден!' };

  const eco = await getEco(userId);
  if (eco.wallet < caseData.price) {
    return { error: `Недостаточно юаней! Стоимость: **${caseData.price}** 💴 (У вас: ${eco.wallet})` };
  }

  const rolledItem = rollCaseItem(caseId);
  if (!rolledItem) return { error: 'Ошибка при генерации предмета.' };

  // Списание юаней и зачисление предмета
  await addYuan(userId, -caseData.price);
  await addHardwareItem(userId, rolledItem.id, 1);

  return { success: true, item: rolledItem, price: caseData.price };
}

// Единый агрегированный профиль пользователя
async function getUserStats(userId) {
  const [player, eco, power, inventory, jailMs, injuryMs] = await Promise.all([
    getPlayer(userId),
    getEco(userId),
    calculateTotalPower(userId),
    getHardwareInventory(userId),
    getJailRemaining(userId),
    getInjuryRemaining(userId),
  ]);

  return {
    userId,
    credits: player.credits,
    yuan: eco.wallet,
    power,
    inventoryCount: inventory.reduce((acc, item) => acc + item.qty, 0),
    uniqueHardware: inventory.length,
    achievementsCount: player.achievements.length,
    pickaxe: {
      level: player.pickaxe_level,
      durability: player.pickaxe_durability,
      maxDurability: player.pickaxe_max_durability,
    },
    status: {
      inJail: jailMs > 0,
      jailRemainingMs: jailMs,
      isInjured: injuryMs > 0,
      injuryRemainingMs: injuryMs,
    }
  };
}

// ════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ════════════════════════════════════════════════════════════
module.exports = {
  // Подключение и константы
  connectDB,
  ACHIEVEMENTS_LIST,
  ITEMS_DB,
  RARITY_META,
  CASES_DB,
  rollCaseItem,

  // Игрок / кредиты
  getPlayer,
  getCredits,
  addCredits,

  // Кирка
  getPickaxeData,
  damagePickaxe,
  repairPickaxe,
  applyRepairPickaxe,
  upgradePickaxe,
  applyPickaxeUpgrade,

  // Инвентарь железа и системные мощности
  addHardwareItem,
  removeHardwareItem,
  getHardwareInventory,
  hasHardwareItem,
  calculateTotalPower,

  // Экономика
  getEco,
  addYuan,

  // Кулдауны
  checkCooldown,
  checkProfCooldown,
  checkAndUseLimit,

  // Тюрьма / травмы
  getJailRemaining,
  sendToJail,
  getInjuryRemaining,
  setInjury,
  cureInjury,

  // Достижения
  giveAchievement,

  // Смены
  trackShift,
  checkWorkerOfDayReset,

  // Рейтинг
  getLeaderboard,
  resetAll,

  // Лотерея / экзамен
  incLotteryCount,
  getExamStreak,
  setExamStreak,

  // Аукцион
  createAuction,
  getActiveAuctions,
  getUserAuctionList,
  buyAuction,
  cancelAuction,

  // [НАРАБОТКИ] Готовые системные процессы
  openCase,
  getUserStats,
};
