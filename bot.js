const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ========================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА';
const DB_FILE = './credits.json';

const DEFAULT_CREDITS = 10000;
const OWNER_ID = '1528109131704176822';

const LIMIT_PER_30MIN = 10000;
const COOLDOWN_MS = 30 * 60 * 1000;
const CREDIT_CMD_COOLDOWN_MS = 30 * 1000;
const WORK_COOLDOWN_MS = 60 * 60 * 1000;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const EXAM_COOLDOWN_MS = 60 * 60 * 1000;
const VOTE_COOLDOWN_MS = 60 * 60 * 1000;
const ACTIVITY_COOLDOWN_MS = 60 * 60 * 1000;
const INJURY_MS = 60 * 60 * 1000;         // лечение после травмы в шахте
const JAIL_MIN_MS = 30 * 60 * 1000;       // тюрьма шпиона: от 30 мин
const JAIL_MAX_MS = 2 * 60 * 60 * 1000;   // тюрьма шпиона: до 2 часов
const WORKER_DAY_MS = 24 * 60 * 60 * 1000;
const WORKER_OF_DAY_BONUS_CREDITS = 2000;
const WORKER_OF_DAY_BONUS_YUAN = 1000;
// ========================================================

http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

function freshDB() {
  return {
    credits: {}, limits: {}, creditCooldown: {}, economy: {}, workCooldown: {},
    dailyCooldown: {}, wheelCooldown: {}, examCooldown: {}, voteCooldown: {},
    achievements: {}, professions: {}, activityCooldown: {},
    jail: {}, injury: {},
    workerOfDay: { shifts: {}, lastReset: Date.now() }
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return freshDB();
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const fresh = freshDB();
    for (const key of Object.keys(fresh)) {
      if (data[key] === undefined) data[key] = fresh[key];
    }
    if (!data.workerOfDay.shifts) data.workerOfDay.shifts = {};
    if (!data.workerOfDay.lastReset) data.workerOfDay.lastReset = Date.now();
    return data;
  } catch {
    return freshDB();
  }
}

function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function getCredits(userId) {
  const db = loadDB();
  if (db.credits[userId] === undefined) db.credits[userId] = DEFAULT_CREDITS;
  return db.credits[userId];
}

function addCredits(userId, amount) {
  const db = loadDB();
  if (db.credits[userId] === undefined) db.credits[userId] = DEFAULT_CREDITS;
  db.credits[userId] += amount;
  saveDB(db);
  return db.credits[userId];
}

function getEco(userId) {
  const db = loadDB();
  if (!db.economy[userId]) {
    db.economy[userId] = { wallet: 0, items: { cat_wife: false, rice_bowls: 0 } };
    saveDB(db);
  }
  return db.economy[userId];
}

function addYuan(userId, amount) {
  const db = loadDB();
  if (!db.economy[userId]) db.economy[userId] = { wallet: 0, items: { cat_wife: false, rice_bowls: 0 } };
  db.economy[userId].wallet += amount;
  saveDB(db);
  return db.economy[userId].wallet;
}

function getRating(credits) {
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700, legend: '🐱 получать **кошка жена**\n🍚 получать **миска риса**' };
  if (credits >= 10000) return { label: '⭐ Отличник', color: 0x00FF88, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный', color: 0x00BFFF, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением', color: 0xFFA500, legend: null };
  return { label: '💀 Враг народа', color: 0xFF0000, legend: '🐱 **отобрать кошка жена**' };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) return { title: '🏆 Образцовый гражданин', message: 'Партия гордится тобой!', color: 0xFFD700 };
  if (credits > 100)   return { title: '🎉 Партия гордится тобой!', message: 'Продолжай служить Партии!', color: 0x00FF88 };
  if (credits >= 0)    return { title: '👍 Хорошо, но можно лучше', message: 'Партия ожидает большего!', color: 0x00BFFF };
  return { title: '😤 Ай ай ай! Позор!', message: 'Исправляйся немедленно!', color: 0xFF0000 };
}

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.ceil((ms % 60000) / 1000);
  if (h > 0) return `${h} ч. ${mins} мин.`;
  return mins > 0 ? `${mins} мин. ${secs} сек.` : `${secs} сек.`;
}

function checkCooldown(db, field, userId, cooldownMs) {
  const now = Date.now();
  const last = db[field][userId] || 0;
  if (now - last < cooldownMs) return { allowed: false, waitMs: cooldownMs - (now - last) };
  db[field][userId] = now;
  saveDB(db);
  return { allowed: true };
}

function checkAndUseLimit(giverId, absAmount) {
  const db = loadDB();
  const now = Date.now();
  const entry = db.limits[giverId];
  if (!entry || now - entry.startTime >= COOLDOWN_MS) {
    if (absAmount > LIMIT_PER_30MIN) return { allowed: false, reason: 'exceed', remaining: LIMIT_PER_30MIN, resetIn: COOLDOWN_MS };
    db.limits[giverId] = { startTime: now, used: absAmount };
    saveDB(db);
    return { allowed: true, remaining: LIMIT_PER_30MIN - absAmount };
  }
  const used = entry.used;
  const remaining = LIMIT_PER_30MIN - used;
  const resetIn = COOLDOWN_MS - (now - entry.startTime);
  if (used >= LIMIT_PER_30MIN) return { allowed: false, reason: 'exhausted', remaining: 0, resetIn };
  if (absAmount > remaining) return { allowed: false, reason: 'exceed', remaining, resetIn };
  db.limits[giverId].used += absAmount;
  saveDB(db);
  return { allowed: true, remaining: remaining - absAmount };
}

// ── Тюрьма (шпион) ──────────────────────────────────────────
function getJailRemaining(db, userId) {
  const until = db.jail[userId] || 0;
  const now = Date.now();
  if (until <= now) return 0;
  return until - now;
}

function sendToJail(db, userId) {
  const term = JAIL_MIN_MS + Math.floor(Math.random() * (JAIL_MAX_MS - JAIL_MIN_MS + 1));
  db.jail[userId] = Date.now() + term;
  saveDB(db);
  return term;
}

// ── Травмы (шахта) ──────────────────────────────────────────
function getInjuryRemaining(db, userId) {
  const until = db.injury[userId] || 0;
  const now = Date.now();
  if (until <= now) return 0;
  return until - now;
}

function setInjury(db, userId, ms = INJURY_MS) {
  db.injury[userId] = Date.now() + ms;
  saveDB(db);
}

function cureInjury(db, userId) {
  delete db.injury[userId];
  saveDB(db);
}

// ── Лучший работник дня ─────────────────────────────────────
function trackShift(userId) {
  const db = loadDB();
  if (!db.workerOfDay.shifts) db.workerOfDay.shifts = {};
  db.workerOfDay.shifts[userId] = (db.workerOfDay.shifts[userId] || 0) + 1;
  saveDB(db);
}

async function checkWorkerOfDayReset(client) {
  const db = loadDB();
  const now = Date.now();
  if (!db.workerOfDay.lastReset) db.workerOfDay.lastReset = now;
  if (now - db.workerOfDay.lastReset < WORKER_DAY_MS) return;

  const entries = Object.entries(db.workerOfDay.shifts || {});
  db.workerOfDay.lastReset = now;

  if (entries.length === 0) { db.workerOfDay.shifts = {}; saveDB(db); return; }

  entries.sort((a, b) => b[1] - a[1]);
  const [winnerId, shifts] = entries[0];
  db.workerOfDay.shifts = {};

  if (db.credits[winnerId] === undefined) db.credits[winnerId] = DEFAULT_CREDITS;
  db.credits[winnerId] += WORKER_OF_DAY_BONUS_CREDITS;
  if (!db.economy[winnerId]) db.economy[winnerId] = { wallet: 0, items: { cat_wife: false, rice_bowls: 0 } };
  db.economy[winnerId].wallet += WORKER_OF_DAY_BONUS_YUAN;
  saveDB(db);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    const channel = guild.systemChannel
      || guild.channels.cache.find(c => c.isTextBased && c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Лучший работник дня')
      .setDescription(`Партия отмечает <@${winnerId}>!\nОтработано смен за сутки: **${shifts}**\n\n⭐ +${WORKER_OF_DAY_BONUS_CREDITS} соц. кредитов\n💴 +${WORKER_OF_DAY_BONUS_YUAN} юаней`);
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Не удалось объявить лучшего работника дня:', e.message);
  }
}

// Достижения
const ACHIEVEMENTS_LIST = {
  'first_work':    { name: '🔨 Первый рабочий', desc: 'Первый раз поработал на заводе', reward: 500 },
  'rich':          { name: '💰 Богач', desc: 'Накопил 50 000 юаней', reward: 1000 },
  'gambler':       { name: '🎰 Игрок', desc: 'Сыграл в лотерею 5 раз', reward: 500 },
  'thief':         { name: '🥷 Вор', desc: 'Успешно украл юани', reward: 300 },
  'patriot':       { name: '🇨🇳 Патриот', desc: 'Получил 20 000 соц. кредитов', reward: 2000 },
  'exam_ace':      { name: '📚 Отличник Партии', desc: 'Правильно ответил на 3 экзамена подряд', reward: 1500 },
  'wheel_jackpot': { name: '🎡 Любимец Фортуны', desc: 'Выбил джекпот на колесе', reward: 1000 },
  'cat_owner':     { name: '🐱 Владелец кошки', desc: 'Купил кошку-жену', reward: 500 },
};

function giveAchievement(userId, achievementId) {
  const db = loadDB();
  if (!db.achievements[userId]) db.achievements[userId] = [];
  if (db.achievements[userId].includes(achievementId)) return null;
  db.achievements[userId].push(achievementId);
  const ach = ACHIEVEMENTS_LIST[achievementId];
  if (ach) {
    db.credits[userId] = (db.credits[userId] || DEFAULT_CREDITS) + ach.reward;
  }
  saveDB(db);
  return ach;
}

// Профессии
const PROFESSIONS = {
  miner:      { name: '⛏️ Шахтёр',    minPay: 300, maxPay: 1500, riskChance: 20, riskLoss: 800,  cooldown: 3600000 },
  accountant: { name: '📊 Бухгалтер', minPay: 200, maxPay: 400,  riskChance: 2,  riskLoss: 100,  cooldown: 1800000 },
  spy:        { name: '🕵️ Шпион',     minPay: 500, maxPay: 2000, riskChance: 35, riskLoss: 1200, cooldown: 7200000 },
};

// ⛏️ Шахта — выпадающие предметы (шанс в %, награда в юанях, шанс травмы в %)
const MINE_ITEMS = [
  { id: 'stone',   name: '🪨 Камень',  chance: 50, yuanMin: 50,   yuanMax: 150,  injuryChance: 25 },
  { id: 'coal',    name: '⚫ Уголь',   chance: 25, yuanMin: 150,  yuanMax: 350,  injuryChance: 35 },
  { id: 'iron',    name: '⛓️ Железо',  chance: 15, yuanMin: 400,  yuanMax: 800,  injuryChance: 0  },
  { id: 'gold',    name: '🥇 Золото',  chance: 7,  yuanMin: 900,  yuanMax: 1500, injuryChance: 0  },
  { id: 'diamond', name: '💎 Алмаз',   chance: 3,  yuanMin: 1500, yuanMax: 2500, injuryChance: 0  },
];

function rollMineItem() {
  const total = MINE_ITEMS.reduce((s, x) => s + x.chance, 0);
  let rand = Math.random() * total;
  for (const item of MINE_ITEMS) {
    rand -= item.chance;
    if (rand <= 0) return item;
  }
  return MINE_ITEMS[0];
}

// 👵 Активности — раз в час, поднимают соц. рейтинг
const ACTIVITIES = {
  flag:   { name: '🇨🇳 Помахать флагом Партии на площади',    min: 100, max: 300 },
  clean:  { name: '🧹 Убрать двор соседа',                      min: 150, max: 350 },
  poster: { name: '📢 Расклеить агитационные плакаты',          min: 200, max: 400 },
  elder:  { name: '👵 Помочь бабушке перейти дорогу',           min: 250, max: 450 },
  song:   { name: '🎤 Спеть гимн Партии перед комитетом',       min: 300, max: 500 },
};

// Партийные экзамены
const EXAM_QUESTIONS = [
  { q: 'Кто основал Коммунистическую партию Китая?', answers: ['мао', 'мао цзэдун', 'мао цзедун'], hint: 'Великий Кормчий...' },
  { q: 'Сколько звёзд на флаге Китая?', answers: ['5', 'пять'], hint: 'Считай внимательно...' },
  { q: 'Как называется столица Китая?', answers: ['пекин', 'beijing'], hint: 'Это не Шанхай...' },
  { q: 'Как переводится слово "юань"?', answers: ['круглый', 'круг', 'округлый'], hint: 'Думай о форме монеты...' },
  { q: 'Сколько человек живёт в Китае? (примерно, в миллиардах)', answers: ['1.4', '1,4', '1.4 миллиарда', 'полтора'], hint: 'Больше миллиарда...' },
  { q: 'Как называется великая стена в Китае?', answers: ['великая китайская стена', 'китайская стена', 'великая стена'], hint: 'Она очень длинная...' },
  { q: 'Назови любой китайский праздник', answers: ['новый год', 'китайский новый год', 'праздник весны', 'день труда', 'день республики', 'день победы'], hint: 'Их много...' },
  { q: 'Какое животное символизирует 2024 год по китайскому календарю?', answers: ['дракон', 'ракон'], hint: 'Оно огнедышащее...' },
];

async function registerCommands() {
  const commands = [
    // Основные
    new SlashCommandBuilder()
      .setName('socialcredit')
      .setDescription('Добавить или забрать социальные кредиты у пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Количество кредитов (отрицательное = забрать)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialstats')
      .setDescription('Показать социальный рейтинг пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true)),

    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 граждан по социальному рейтингу'),
    new SlashCommandBuilder().setName('resetall').setDescription('Сбросить все данные (только для Создателя)'),

    // v2.0 Экономика
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник по экономике Партии'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе и получить юани'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Посмотреть свой паспорт и баланс юаней'),

    new SlashCommandBuilder()
      .setName('buy_v2_0')
      .setDescription('Купить предмет в магазине Партии')
      .addStringOption(opt => opt
        .setName('item')
        .setDescription('Выберите товар')
        .setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50 000 юаней)', value: 'cat_wife' },
          { name: '🍚 Миска риса (5 000 юаней)', value: 'rice_bowl' },
          { name: '🎟 Лотерея (1 000 юаней)', value: 'ticket' }
        )),

    new SlashCommandBuilder()
      .setName('steal_v2_0')
      .setDescription('Украсть юани у гражданина (штраф -500 соц. кредитов при провале)')
      .addUserOption(opt => opt.setName('target').setDescription('Цель кражи').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Сколько юаней украсть').setRequired(true)),

    // Новые фичи
    new SlashCommandBuilder().setName('daily_v2_0').setDescription('Получить ежедневную награду от Партии'),

    new SlashCommandBuilder().setName('wheel_v2_0').setDescription('Крутануть Колесо Фортуны (раз в день)'),

    new SlashCommandBuilder()
      .setName('vote_v2_0')
      .setDescription('Устроить голосование за наказание гражданина')
      .addUserOption(opt => opt.setName('target').setDescription('Кого судить').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Причина обвинения').setRequired(true)),

    new SlashCommandBuilder().setName('exam_v2_0').setDescription('Сдать партийный экзамен и получить кредиты'),

    new SlashCommandBuilder()
      .setName('profession_v2_0')
      .setDescription('Выбрать профессию и работать по специальности')
      .addStringOption(opt => opt
        .setName('job')
        .setDescription('Выберите профессию')
        .setRequired(true)
        .addChoices(
          { name: '⛏️ Шахтёр — высокий доход, высокий риск', value: 'miner' },
          { name: '📊 Бухгалтер — стабильный доход, низкий риск', value: 'accountant' },
          { name: '🕵️ Шпион — огромный доход, огромный риск', value: 'spy' }
        )),

    new SlashCommandBuilder().setName('achievements_v2_0').setDescription('Посмотреть свои достижения'),

    new SlashCommandBuilder()
      .setName('activity_v2_0')
      .setDescription('Заняться общественной деятельностью (раз в час)')
      .addStringOption(opt => opt
        .setName('activity')
        .setDescription('Выберите активность')
        .setRequired(true)
        .addChoices(
          { name: '🇨🇳 Помахать флагом Партии на площади', value: 'flag' },
          { name: '🧹 Убрать двор соседа', value: 'clean' },
          { name: '📢 Расклеить агитационные плакаты', value: 'poster' },
          { name: '👵 Помочь бабушке перейти дорогу', value: 'elder' },
          { name: '🎤 Спеть гимн Партии перед комитетом', value: 'song' }
        )),

    new SlashCommandBuilder().setName('workerboard_v2_0').setDescription('Топ работников дня (шахта + бухгалтерия)'),

  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  // Чистим глобальные команды — если бот когда-то регистрировал команды и глобально,
  // и на сервере (guild), Discord показывает их ДВАЖДЫ в списке. Убираем глобальные,
  // оставляем только гильдийные (они обновляются мгновенно).
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  } catch (e) {
    console.error('⚠️ Не удалось очистить глобальные команды:', e.message);
  }

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Команды зарегистрированы (дубли глобальных команд очищены)!');
}

// GuildMessages + MessageContent нужны для /exam_v2_0 (ожидание ответа в чат)
// и для голосования "кто вор" в /steal_v2_0 (сбор сообщений с упоминаниями).
// MessageContent — привилегированный intent, включи его в Discord Developer Portal → Bot → Privileged Gateway Intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.on('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
  checkWorkerOfDayReset(client).catch(e => console.error(e));
  setInterval(() => checkWorkerOfDayReset(client).catch(e => console.error(e)), 15 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  // ── /help_v2_0 ──────────────────────────────────────────
  if (interaction.commandName === 'help_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('📕 Справочник Партии v2.0')
      .addFields(
        { name: '💰 Заработок', value: '`/work_v2_0` — завод (раз в час)\n`/profession_v2_0` — работа по специальности (⛏️ шахта, 📊 бухгалтерия, 🕵️ шпион)\n`/daily_v2_0` — ежедневная награда\n`/activity_v2_0` — общественная деятельность (раз в час, +соц. рейтинг)', inline: false },
        { name: '🎮 Развлечения', value: '`/wheel_v2_0` — колесо фортуны\n`/exam_v2_0` — партийный экзамен\n`/vote_v2_0` — народный суд', inline: false },
        { name: '🛒 Магазин', value: '`/partyshop_v2_0` — товары\n`/buy_v2_0` — купить', inline: false },
        { name: '🥷 Риск', value: '`/steal_v2_0` — украсть юани (анимация + штраф при провале)', inline: false },
        { name: '👤 Профиль', value: '`/profile_v2_0` — паспорт\n`/achievements_v2_0` — достижения\n`/workerboard_v2_0` — топ работников дня', inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }

  // ── /daily_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'daily_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'dailyCooldown', userId, DAILY_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Ты уже получил сегодняшнюю награду! Следующая через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const tasks = [
      { text: 'Партия благодарит за верность!', credits: 500, yuan: 200 },
      { text: 'Ты примерный гражданин!', credits: 300, yuan: 500 },
      { text: 'Партия отметила твой вклад!', credits: 1000, yuan: 100 },
      { text: 'Ежедневный паёк выдан!', credits: 200, yuan: 300 },
      { text: 'Партия наблюдает — и одобряет!', credits: 700, yuan: 400 },
    ];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    addCredits(userId, task.credits);
    addYuan(userId, task.yuan);

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('📦 Ежедневная награда от Партии')
      .setDescription(`**${task.text}**\n\n⭐ +${task.credits} соц. кредитов\n💴 +${task.yuan} юаней`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /wheel_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'wheel_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'wheelCooldown', userId, WHEEL_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Колесо ещё крутится! Следующий шанс через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const sectors = [
      { label: '💀 ПОЗОР!',            credits: -1000, yuan: 0,     color: 0xFF0000, chance: 10 },
      { label: '😢 Не повезло',        credits: -300,  yuan: 0,     color: 0xFF4500, chance: 15 },
      { label: '😐 Пусто',             credits: 0,     yuan: 0,     color: 0x888888, chance: 20 },
      { label: '✅ Небольшой бонус',   credits: 300,   yuan: 100,   color: 0x00BFFF, chance: 25 },
      { label: '⭐ Хороший бонус',     credits: 700,   yuan: 300,   color: 0x00FF88, chance: 15 },
      { label: '🎉 Отличный бонус!',   credits: 1500,  yuan: 500,   color: 0xFFD700, chance: 10 },
      { label: '🏆 ДЖЕКПОТ ПАРТИИ!',  credits: 5000,  yuan: 2000,  color: 0xFF00FF, chance: 5  },
    ];

    // Взвешенный рандом
    const total = sectors.reduce((s, x) => s + x.chance, 0);
    let rand = Math.random() * total;
    let result = sectors[0];
    for (const s of sectors) { rand -= s.chance; if (rand <= 0) { result = s; break; } }

    const spinning = ['🎡', '🌀', '💫', '🎯'];
    const msg = await interaction.reply({ content: `${spinning[0]} **Колесо крутится...**`, fetchReply: true });
    for (let i = 1; i < spinning.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      await interaction.editReply({ content: `${spinning[i]} **Колесо крутится...** [${i}/3]` });
    }
    await new Promise(r => setTimeout(r, 800));

    if (result.credits !== 0) addCredits(userId, result.credits);
    if (result.yuan !== 0) addYuan(userId, result.yuan);

    // Достижение за джекпот
    let achMsg = '';
    if (result.label.includes('ДЖЕКПОТ')) {
      const ach = giveAchievement(userId, 'wheel_jackpot');
      if (ach) achMsg = `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
    }

    const embed = new EmbedBuilder()
      .setColor(result.color)
      .setTitle(`🎡 Колесо Фортуны — ${result.label}`)
      .setDescription(
        `${result.credits > 0 ? `⭐ +${result.credits} соц. кредитов` : result.credits < 0 ? `⭐ ${result.credits} соц. кредитов` : '⭐ Без изменений'}\n` +
        `${result.yuan > 0 ? `💴 +${result.yuan} юаней` : ''}` + achMsg
      );
    await interaction.editReply({ content: '', embeds: [embed] });
  }

  // ── /exam_v2_0 ──────────────────────────────────────────
  else if (interaction.commandName === 'exam_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'examCooldown', userId, EXAM_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий экзамен через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const q = EXAM_QUESTIONS[Math.floor(Math.random() * EXAM_QUESTIONS.length)];

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('📚 Партийный экзамен')
      .setDescription(`**Вопрос:** ${q.q}\n\n_Подсказка: ${q.hint}_\n\nУ тебя **60 секунд** — напиши ответ в чат!`);
    await interaction.reply({ embeds: [embed] });

    try {
      const filter = m => m.author.id === userId;
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
      const answer = collected.first().content.toLowerCase().trim();
      const correct = q.answers.some(a => answer.includes(a));

      if (correct) {
        const reward = Math.floor(Math.random() * 1001) + 500; // 500-1500
        addCredits(userId, reward);
        addYuan(userId, 200);

        // Трекаем серию правильных ответов
        if (!db.examCooldown[`${userId}_streak`]) db.examCooldown[`${userId}_streak`] = 0;
        db.examCooldown[`${userId}_streak`]++;
        saveDB(db);

        let achMsg = '';
        if (db.examCooldown[`${userId}_streak`] >= 3) {
          const ach = giveAchievement(userId, 'exam_ace');
          if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
          db.examCooldown[`${userId}_streak`] = 0;
          saveDB(db);
        }

        const winEmbed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('✅ Правильно! Партия одобряет!')
          .setDescription(`Ответ принят!\n⭐ +${reward} соц. кредитов\n💴 +200 юаней` + achMsg);
        await interaction.followUp({ embeds: [winEmbed] });
      } else {
        addCredits(userId, -300);
        db.examCooldown[`${userId}_streak`] = 0;
        saveDB(db);

        const loseEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Неверно! Позор!')
          .setDescription(`Правильный ответ: **${q.answers[0]}**\n⭐ -300 соц. кредитов`);
        await interaction.followUp({ embeds: [loseEmbed] });
      }
    } catch {
      const timeEmbed = new EmbedBuilder().setColor(0x888888).setTitle('⏰ Время вышло!').setDescription(`Правильный ответ: **${q.answers[0]}**`);
      await interaction.followUp({ embeds: [timeEmbed] });
    }
  }

  // ── /vote_v2_0 ──────────────────────────────────────────
  else if (interaction.commandName === 'vote_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'voteCooldown', userId, VOTE_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий народный суд через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя судить самого себя!', flags: 64 });

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('⚖️ НАРОДНЫЙ СУД ПАРТИИ')
      .setDescription(`**Обвиняемый:** ${targetUser.username}\n**Обвинение:** ${reason}\n\nГраждане, ваш вердикт? (60 секунд)`)
      .setFooter({ text: '👍 Виновен (-500 кредитов) | 👎 Оправдать (+200 кредитов)' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vote_guilty').setLabel('👍 Виновен').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('vote_innocent').setLabel('👎 Оправдать').setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const votes = { guilty: 0, innocent: 0, voters: new Set() };
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.user.id === targetUser.id) return i.reply({ content: '❌ Обвиняемый не может голосовать!', flags: 64 });
      if (votes.voters.has(i.user.id)) return i.reply({ content: '❌ Ты уже голосовал!', flags: 64 });
      votes.voters.add(i.user.id);
      if (i.customId === 'vote_guilty') votes.guilty++;
      else votes.innocent++;
      await i.reply({ content: `✅ Твой голос учтён. Счёт: 👍 ${votes.guilty} — 👎 ${votes.innocent}`, flags: 64 });
    });

    collector.on('end', async () => {
      let resultText, color;
      if (votes.guilty > votes.innocent) {
        addCredits(targetUser.id, -500);
        resultText = `**Виновен!** ${targetUser.username} получает **-500 соц. кредитов**!\n👍 ${votes.guilty} — 👎 ${votes.innocent}`;
        color = 0xFF0000;
      } else if (votes.innocent > votes.guilty) {
        addCredits(targetUser.id, 200);
        resultText = `**Оправдан!** ${targetUser.username} получает **+200 соц. кредитов**!\n👍 ${votes.guilty} — 👎 ${votes.innocent}`;
        color = 0x00FF88;
      } else {
        resultText = `**Ничья!** Партия воздерживается.\n👍 ${votes.guilty} — 👎 ${votes.innocent}`;
        color = 0x888888;
      }
      const resultEmbed = new EmbedBuilder().setColor(color).setTitle('⚖️ ПРИГОВОР ВЫНЕСЕН').setDescription(resultText);
      await interaction.editReply({ embeds: [resultEmbed], components: [] });
    });
  }

  // ── /profession_v2_0 ────────────────────────────────────
  else if (interaction.commandName === 'profession_v2_0') {
    const job = interaction.options.getString('job');
    const prof = PROFESSIONS[job];
    const db = loadDB();

    // Тюрьма — нельзя работать, пока не отсидел
    const jailLeft = getJailRemaining(db, userId);
    if (jailLeft > 0) {
      return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**. Работать нельзя.`, flags: 64 });
    }

    // Травма в шахте — нельзя работать, пока не вылечился
    const injuryLeft = getInjuryRemaining(db, userId);
    if (injuryLeft > 0) {
      return interaction.reply({ content: `🩹 Ты травмирован и лечишься! До выздоровления: **${formatTime(injuryLeft)}**. Работать нельзя.`, flags: 64 });
    }

    const cdKey = `prof_${job}`;
    const now = Date.now();
    if (!db.workCooldown[userId]) db.workCooldown[userId] = {};
    const lastWork = db.workCooldown[`${userId}_${cdKey}`] || 0;
    if (now - lastWork < prof.cooldown) {
      return interaction.reply({ content: `⏳ ${prof.name} — следующая смена через **${formatTime(prof.cooldown - (now - lastWork))}**.`, flags: 64 });
    }
    db.workCooldown[`${userId}_${cdKey}`] = now;
    saveDB(db);

    // ── ⛏️ Шахтёр: выпадение предметов ────────────────────
    if (job === 'miner') {
      const item = rollMineItem();
      const earn = Math.floor(Math.random() * (item.yuanMax - item.yuanMin + 1)) + item.yuanMin;

      if (item.id === 'diamond') {
        // Алмаз = +5000 соц. кредитов + бесплатное лечение + премия
        addCredits(userId, 5000);
        addYuan(userId, earn);
        const db2 = loadDB();
        const wasInjured = getInjuryRemaining(db2, userId) > 0;
        cureInjury(db2, userId);
        trackShift(userId);
        const embed = new EmbedBuilder()
          .setColor(0xFF00FF)
          .setTitle('💎 ДЖЕКПОТ ШАХТЫ — Алмаз!')
          .setDescription(`Ты нашёл **алмаз**! Партия щедро награждает!\n\n⭐ +5000 соц. кредитов\n💴 +${earn} юаней (премия)${wasInjured ? '\n🩹 Бесплатное лечение — травма снята!' : ''}\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
        return interaction.reply({ embeds: [embed] });
      }

      const gotInjured = item.injuryChance > 0 && Math.random() * 100 < item.injuryChance;
      addYuan(userId, earn);
      trackShift(userId);

      if (gotInjured) {
        const db2 = loadDB();
        setInjury(db2, userId);
        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle(`${item.name} — Травма на смене!`)
          .setDescription(`Ты добыл ${item.name.toLowerCase()}, но он упал тебе на голову!\n💴 +${earn} юаней\n🩹 Требуется лечение: **${formatTime(INJURY_MS)}** — работать нельзя.`);
        return interaction.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`${item.name} — Смена выполнена!`)
        .setDescription(`Ты добыл: ${item.name}\n💴 +${earn} юаней\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
      return interaction.reply({ embeds: [embed] });
    }

    // ── 🕵️ Шпион: провал = тюрьма ─────────────────────────
    if (job === 'spy') {
      const failed = Math.random() * 100 < prof.riskChance;
      if (failed) {
        const db2 = loadDB();
        const term = sendToJail(db2, userId);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🕵️ Шпион — Провал! Ты арестован!')
          .setDescription(`Тебя раскрыли и бросили в тюрьму!\n🚔 Срок: **${formatTime(term)}**\nПока сидишь — нельзя работать и воровать.`);
        return interaction.reply({ embeds: [embed] });
      }
      const earn = Math.floor(Math.random() * (prof.maxPay - prof.minPay + 1)) + prof.minPay;
      addYuan(userId, earn);
      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`${prof.name} — Смена выполнена!`)
        .setDescription(`Операция прошла успешно!\n💴 +${earn} юаней\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
      return interaction.reply({ embeds: [embed] });
    }

    // ── 📊 Бухгалтер и остальные — обычная логика ─────────
    const failed = Math.random() * 100 < prof.riskChance;
    if (failed) {
      addYuan(userId, -prof.riskLoss);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`${prof.name} — Провал!`)
        .setDescription(`Что-то пошло не так на работе...\n💴 -${prof.riskLoss} юаней`);
      return interaction.reply({ embeds: [embed] });
    }

    const earn = Math.floor(Math.random() * (prof.maxPay - prof.minPay + 1)) + prof.minPay;
    addYuan(userId, earn);
    trackShift(userId);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle(`${prof.name} — Смена выполнена!`)
      .setDescription(`Отличная работа, гражданин!\n💴 +${earn} юаней\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /activity_v2_0 ───────────────────────────────────────
  else if (interaction.commandName === 'activity_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'activityCooldown', userId, ACTIVITY_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Ты уже занимался общественной деятельностью! Следующий раз через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const key = interaction.options.getString('activity');
    const act = ACTIVITIES[key];
    const reward = Math.floor(Math.random() * (act.max - act.min + 1)) + act.min;
    addCredits(userId, reward);

    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('👵 Общественная деятельность')
      .setDescription(`${act.name}\n\n⭐ +${reward} соц. кредитов\nПартия ценит твоё усердие!`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /workerboard_v2_0 ────────────────────────────────────
  else if (interaction.commandName === 'workerboard_v2_0') {
    const db = loadDB();
    const entries = Object.entries(db.workerOfDay.shifts || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const timeLeft = WORKER_DAY_MS - (Date.now() - (db.workerOfDay.lastReset || Date.now()));
    if (entries.length === 0) {
      return interaction.reply({ content: `Сегодня ещё никто не отработал смену в шахте или бухгалтерии.\n⏳ Подведение итогов через **${formatTime(Math.max(timeLeft, 0))}**.`, flags: 64 });
    }
    const lines = entries.map(([id, c], i) => `**${i + 1}.** <@${id}> — ${c} смен`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Лучшие работники дня (шахта + бухгалтерия)')
      .setDescription(lines)
      .setFooter({ text: `Итоги и премия лидеру через ${formatTime(Math.max(timeLeft, 0))}` });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /achievements_v2_0 ──────────────────────────────────
  else if (interaction.commandName === 'achievements_v2_0') {
    const db = loadDB();
    const userAchs = db.achievements[userId] || [];
    const lines = Object.entries(ACHIEVEMENTS_LIST).map(([id, ach]) => {
      const done = userAchs.includes(id);
      return `${done ? '✅' : '🔒'} **${ach.name}** — ${ach.desc} (+${ach.reward} кред.)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`🏅 Достижения: ${interaction.user.username}`)
      .setDescription(lines || 'Пока нет достижений!')
      .setFooter({ text: `Получено: ${userAchs.length}/${Object.keys(ACHIEVEMENTS_LIST).length}` });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /work_v2_0 ──────────────────────────────────────────
  else if (interaction.commandName === 'work_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'workCooldown', userId, WORK_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Ты уже работал! Следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const earn = Math.floor(Math.random() * 451) + 50;
    addYuan(userId, earn);

    // Достижение первой работы
    const ach = giveAchievement(userId, 'first_work');
    let achMsg = '';
    if (ach) achMsg = `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🏭 Завод Партии')
      .setDescription(`Ты отработал смену и заработал **${earn} Юаней**!\n⏳ Следующая смена через **1 час**.` + achMsg);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /partyshop_v2_0 ─────────────────────────────────────
  else if (interaction.commandName === 'partyshop_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🛒 Магазин Партии')
      .addFields(
        { name: '🐱 Кошка-жена', value: '50 000 юаней\n`/buy_v2_0` → cat_wife', inline: true },
        { name: '🍚 Миска риса', value: '5 000 юаней\n`/buy_v2_0` → rice_bowl', inline: true },
        { name: '🎟 Лотерея', value: '1 000 юаней\n`/buy_v2_0` → ticket', inline: true }
      )
      .setFooter({ text: 'Используй /buy_v2_0 для покупки' });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /profile_v2_0 ───────────────────────────────────────
  else if (interaction.commandName === 'profile_v2_0') {
    const credits = getCredits(userId);
    const eco = getEco(userId);
    const rating = getRating(credits);
    const db = loadDB();
    const achCount = (db.achievements[userId] || []).length;

    const jailLeft = getJailRemaining(db, userId);
    const injuryLeft = getInjuryRemaining(db, userId);

    const embed = new EmbedBuilder()
      .setColor(rating.color)
      .setTitle(`🛂 Паспорт гражданина: ${interaction.user.username}`)
      .addFields(
        { name: '⭐ Соц. рейтинг', value: `${credits}`, inline: true },
        { name: '💴 Юани', value: `${eco.wallet}`, inline: true },
        { name: '🏅 Достижения', value: `${achCount}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true },
        { name: '🏷 Статус', value: rating.label, inline: false },
        { name: '🐱 Кошка-жена', value: eco.items.cat_wife ? 'Есть ✅' : 'Нет ❌', inline: true },
        { name: '🍚 Миски риса', value: `${eco.items.rice_bowls}`, inline: true }
      );
    if (jailLeft > 0) embed.addFields({ name: '🚔 В тюрьме', value: `Осталось: ${formatTime(jailLeft)}`, inline: true });
    if (injuryLeft > 0) embed.addFields({ name: '🩹 На лечении', value: `Осталось: ${formatTime(injuryLeft)}`, inline: true });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /buy_v2_0 ───────────────────────────────────────────
  else if (interaction.commandName === 'buy_v2_0') {
    const item = interaction.options.getString('item');
    const eco = getEco(userId);

    if (item === 'cat_wife') {
      if (eco.wallet < 50000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **50 000**.', flags: 64 });
      if (eco.items.cat_wife) return interaction.reply({ content: '❌ У тебя уже есть кошка-жена!', flags: 64 });
      const db = loadDB();
      db.economy[userId].wallet -= 50000;
      db.economy[userId].items.cat_wife = true;
      saveDB(db);
      const ach = giveAchievement(userId, 'cat_owner');
      let achMsg = '';
      if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      await interaction.reply({ content: `🐱 Поздравляем! Ты купил **кошку-жену**! Партия одобряет!` + achMsg });
    } else if (item === 'rice_bowl') {
      if (eco.wallet < 5000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **5 000**.', flags: 64 });
      const db = loadDB();
      db.economy[userId].wallet -= 5000;
      db.economy[userId].items.rice_bowls += 1;
      saveDB(db);
      await interaction.reply({ content: `🍚 Ты купил **миску риса**! Теперь у тебя **${db.economy[userId].items.rice_bowls}** мисок.` });
    } else if (item === 'ticket') {
      if (eco.wallet < 1000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **1 000**.', flags: 64 });
      addYuan(userId, -1000);
      const win = Math.random();
      let result;
      if (win < 0.05) { addYuan(userId, 20000); result = '🎉 ДЖЕКПОТ! +20 000 юаней!'; }
      else if (win < 0.25) { addYuan(userId, 3000); result = '🎊 Выигрыш! +3 000 юаней!'; }
      else { result = '😢 Не повезло. Лотерея забрала твои 1 000 юаней.'; }

      // Трекаем лотереи для достижения
      const db = loadDB();
      db.economy[`${userId}_lottery_count`] = (db.economy[`${userId}_lottery_count`] || 0) + 1;
      saveDB(db);
      let achMsg = '';
      if (db.economy[`${userId}_lottery_count`] >= 5) {
        const ach = giveAchievement(userId, 'gambler');
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      }
      await interaction.reply({ content: `🎟 **Лотерея:** ${result}` + achMsg });
    }
  }

  // ── /steal_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'steal_v2_0') {
    const targetUser = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');

    if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя воровать у самого себя!', flags: 64 });
    if (amount <= 0) return interaction.reply({ content: '❌ Укажи положительную сумму!', flags: 64 });
    if (getCredits(userId) < 0) return interaction.reply({ content: '❌ Враги народа не могут воровать!', flags: 64 });

    const dbCheck = loadDB();
    const jailLeft = getJailRemaining(dbCheck, userId);
    if (jailLeft > 0) {
      return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**. Воровать нельзя.`, flags: 64 });
    }

    const targetEco = getEco(targetUser.id);
    if (targetEco.wallet < amount) return interaction.reply({ content: `❌ У цели только **${targetEco.wallet} юаней**!`, flags: 64 });

    const chance = Math.max(1, Math.floor(5000 / (amount + 150)));
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle('⚠️ ВНИМАНИЕ: АКТ САБОТАЖА')
      .setDescription(`Цель: **${targetUser.username}**\nСумма: **${amount} юаней**\nШанс успеха: **${chance}%**\nШтраф при провале: **-500 соц. кредитов**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('steal_confirm').setLabel('Рискнуть').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('steal_cancel').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
    );
    const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

    try {
      const i = await msg.awaitMessageComponent({ filter: c => c.user.id === userId, time: 30000 });
      if (i.customId === 'steal_cancel') return i.update({ content: '❌ Кража отменена.', embeds: [], components: [] });
      await i.update({ content: '🕵️ **Кто-то крадётся во тьме...**', embeds: [], components: [] });

      // Анимация: стрелочка ходит по квадратикам 10 секунд (5 кадров по 2 сек)
      const SQUARES = 8;
      const FRAMES = 5;
      for (let frame = 0; frame < FRAMES; frame++) {
        const pos = Math.floor(Math.random() * SQUARES);
        let row = '';
        for (let s = 0; s < SQUARES; s++) row += s === pos ? '👆' : '⬛';
        await interaction.editReply({ content: `🕵️ **Незаметное проникновение...**\n${row}` });
        await new Promise(r => setTimeout(r, 2000));
      }

      const success = Math.random() * 100 < chance;
      const channel = interaction.channel;

      if (success) {
        addYuan(targetUser.id, -amount);
        addYuan(userId, amount);
        const ach = giveAchievement(userId, 'thief');

        await interaction.editReply({ content: '✅ **Кража совершена...**', embeds: [], components: [] });

        // Публичное объявление — вор остаётся анонимным
        const announceEmbed = new EmbedBuilder()
          .setColor(0x2F3136)
          .setTitle('🕵️ ОГРАБЛЕНИЕ!')
          .setDescription(`**Неизвестный** похитил **${amount} юаней** у ${targetUser.username}!\n\nЛичность вора неизвестна. У вас есть **10 секунд**, чтобы обвинить кого-то — упомяните подозреваемого (@ник) в чате!`);
        const announceMsg = await channel.send({ embeds: [announceEmbed] });

        const accusations = new Map(); // voterId -> accusedId
        try {
          const collector = channel.createMessageCollector({ filter: m => !m.author.bot && m.mentions.users.size > 0, time: 10000 });
          collector.on('collect', m => {
            const accused = m.mentions.users.first();
            if (accused.id === m.author.id) return;
            accusations.set(m.author.id, accused.id);
          });
          await new Promise(resolve => collector.on('end', resolve));
        } catch { /* игнорируем ошибки сборщика */ }

        let voteText = 'Никто никого не обвинил. Вор гуляет на свободе...';
        if (accusations.size > 0) {
          const tally = {};
          for (const accusedId of accusations.values()) tally[accusedId] = (tally[accusedId] || 0) + 1;
          const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
          const [suspectId, votes] = sorted[0];
          const isRight = suspectId === userId;
          voteText = `Народ считает вором: <@${suspectId}> (${votes} голос${votes === 1 ? '' : 'ов'})\n${isRight ? '🎯 Народ не ошибся... или это просто совпадение?' : '🤷 Но правду, конечно, никто не узнает наверняка.'}`;
        }

        const voteEmbed = new EmbedBuilder()
          .setColor(0x888888)
          .setTitle('🗳️ Итоги народного расследования')
          .setDescription(voteText);
        await channel.send({ embeds: [voteEmbed] });

        let achMsg = '';
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
        await interaction.followUp({ content: `🎰 **УСПЕХ!** Ты анонимно украл **${amount} юаней** у ${targetUser.username}!` + achMsg, flags: 64 });
      } else {
        addCredits(userId, -500);
        await interaction.editReply({ content: `🎰 **ПРОВАЛ!** Тебя поймали с поличным! Штраф: **-500 соц. кредитов**.`, embeds: [], components: [] });
        await channel.send({ content: `🚨 ${interaction.user.username} попался на попытке кражи у ${targetUser.username} и получил штраф!` });
      }
    } catch {
      interaction.editReply({ content: '⏳ Время вышло. Кража отменена.', embeds: [], components: [] });
    }
  }

  // ── /socialcredit ───────────────────────────────────────
  else if (interaction.commandName === 'socialcredit') {
    if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец может изменять кредиты!', flags: 64 });
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const db = loadDB();
    const cd = checkCooldown(db, 'creditCooldown', userId, CREDIT_CMD_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Кулдаун! Подожди **${formatTime(cd.waitMs)}**.`, flags: 64 });
    const absAmount = Math.abs(amount);
    const limitCheck = checkAndUseLimit(userId, absAmount);
    if (!limitCheck.allowed) return interaction.reply({ content: `❌ Лимит! Осталось: **${limitCheck.remaining}**. Сброс через **${formatTime(limitCheck.resetIn)}**.`, flags: 64 });
    const newCredits = addCredits(targetUser.id, amount);
    const rating = getRating(newCredits);
    const verdict = getPartyVerdict(newCredits);

    // Проверяем достижение патриота
    if (newCredits >= 20000) giveAchievement(targetUser.id, 'patriot');

    const embed = new EmbedBuilder()
      .setColor(verdict.color)
      .setTitle(verdict.title)
      .setDescription(`**${interaction.user.username}** ${amount > 0 ? 'наградил' : 'наказал'} **${targetUser.username}** на **${amount} баллов**.\nНовый рейтинг: **${newCredits}** (${rating.label})\n${verdict.message}`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /socialstats ────────────────────────────────────────
  else if (interaction.commandName === 'socialstats') {
    const targetUser = interaction.options.getUser('user');
    const credits = getCredits(targetUser.id);
    const rating = getRating(credits);
    const embed = new EmbedBuilder()
      .setColor(rating.color)
      .setTitle(`📊 Социальный рейтинг: ${targetUser.username}`)
      .addFields(
        { name: '⭐ Рейтинг', value: `${credits} баллов`, inline: true },
        { name: '🏷 Статус', value: rating.label, inline: true }
      );
    if (rating.legend) embed.addFields({ name: '📜 Привилегии / Наказания', value: rating.legend, inline: false });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /socialleaderboard ──────────────────────────────────
  else if (interaction.commandName === 'socialleaderboard') {
    const db = loadDB();
    const sorted = Object.entries(db.credits).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return interaction.reply({ content: 'Данных пока нет.', flags: 64 });
    const lines = sorted.map(([id, c], i) => `**${i + 1}.** <@${id}> — ${c} баллов`).join('\n');
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Топ-10 граждан').setDescription(lines);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /resetall ───────────────────────────────────────────
  else if (interaction.commandName === 'resetall') {
    if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец!', flags: 64 });
    saveDB(freshDB());
    await interaction.reply({ content: '✅ Все данные сброшены!' });
  }
});

registerCommands()
  .catch(err => console.error('❌ Ошибка регистрации команд:', err))
  .then(() => client.login(TOKEN));
