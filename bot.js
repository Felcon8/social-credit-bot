const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ========================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
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
const HEAL_COOLDOWN_MS = 60 * 60 * 1000;
const PRISON_MAX_MS = 2 * 60 * 60 * 1000;
// ========================================================

http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return emptyDB();
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const empty = emptyDB();
    for (const key of Object.keys(empty)) if (!data[key]) data[key] = empty[key];
    return data;
  } catch { return emptyDB(); }
}

function emptyDB() {
  return {
    credits: {}, limits: {}, creditCooldown: {}, economy: {},
    workCooldown: {}, dailyCooldown: {}, wheelCooldown: {}, examCooldown: {},
    voteCooldown: {}, activityCooldown: {}, achievements: {},
    profCooldown: {}, healCooldown: {}, prison: {},
    workStats: {}, bestWorkerCooldown: {},
  };
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
  if (!db.economy[userId]) { db.economy[userId] = { wallet: 0, items: { cat_wife: false, rice_bowls: 0 } }; saveDB(db); }
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
  const used = entry.used; const remaining = LIMIT_PER_30MIN - used;
  const resetIn = COOLDOWN_MS - (now - entry.startTime);
  if (used >= LIMIT_PER_30MIN) return { allowed: false, reason: 'exhausted', remaining: 0, resetIn };
  if (absAmount > remaining) return { allowed: false, reason: 'exceed', remaining, resetIn };
  db.limits[giverId].used += absAmount; saveDB(db);
  return { allowed: true, remaining: remaining - absAmount };
}

function isInPrison(userId) {
  const db = loadDB();
  const rel = db.prison[userId];
  if (!rel) return false;
  if (Date.now() >= rel) { delete db.prison[userId]; saveDB(db); return false; }
  return rel - Date.now();
}

function isHealing(userId) {
  const db = loadDB();
  const rel = db.healCooldown[userId];
  if (!rel) return false;
  if (Date.now() >= rel) { delete db.healCooldown[userId]; saveDB(db); return false; }
  return rel - Date.now();
}

// Достижения
const ACHIEVEMENTS_LIST = {
  'first_work':    { name: '🔨 Первый рабочий',      desc: 'Первый раз поработал на заводе',       reward: 500  },
  'rich':          { name: '💰 Богач',                desc: 'Накопил 50 000 юаней',                 reward: 1000 },
  'gambler':       { name: '🎰 Игрок',               desc: 'Сыграл в лотерею 5 раз',               reward: 500  },
  'thief':         { name: '🥷 Вор',                  desc: 'Успешно украл юани',                   reward: 300  },
  'patriot':       { name: '🇨🇳 Патриот',             desc: 'Получил 20 000 соц. кредитов',         reward: 2000 },
  'exam_ace':      { name: '📚 Отличник Партии',      desc: 'Правильно ответил на 3 экзамена подряд', reward: 1500 },
  'wheel_jackpot': { name: '🎡 Любимец Фортуны',     desc: 'Выбил джекпот на колесе',              reward: 1000 },
  'cat_owner':     { name: '🐱 Владелец кошки',      desc: 'Купил кошку-жену',                     reward: 500  },
  'diamond':       { name: '💎 Алмазный шахтёр',     desc: 'Нашёл алмаз в шахте',                  reward: 1000 },
  'best_worker':   { name: '🥇 Лучший работник',     desc: 'Стал лучшим работником дня',           reward: 500  },
  'good_citizen':  { name: '👵 Добрый гражданин',    desc: 'Помог кому-то 3 раза',                 reward: 800  },
};

function giveAchievement(userId, achievementId) {
  const db = loadDB();
  if (!db.achievements[userId]) db.achievements[userId] = [];
  if (db.achievements[userId].includes(achievementId)) return null;
  db.achievements[userId].push(achievementId);
  const ach = ACHIEVEMENTS_LIST[achievementId];
  if (ach) { db.credits[userId] = (db.credits[userId] || DEFAULT_CREDITS) + ach.reward; }
  saveDB(db); return ach;
}

// Шахта — предметы
const MINE_DROPS = [
  { name: '🪨 Камень',  chance: 37, yuan: 50,   credits: 0,    injury: false, diamond: false },
  { name: '🪵 Уголь',   chance: 25, yuan: 150,  credits: 0,    injury: false, diamond: false },
  { name: '⚙️ Железо', chance: 20, yuan: 300,  credits: 0,    injury: false, diamond: false },
  { name: '🥇 Золото',  chance: 15, yuan: 700,  credits: 0,    injury: false, diamond: false },
  { name: '💎 Алмаз',   chance: 3,  yuan: 2000, credits: 5000, injury: false, diamond: true  },
];

// Шанс травмы (камень/уголь падает на голову)
const MINE_INJURY_CHANCE = 20;

function rollMineDrop() {
  const total = MINE_DROPS.reduce((s, x) => s + x.chance, 0);
  let rand = Math.random() * total;
  for (const d of MINE_DROPS) { rand -= d.chance; if (rand <= 0) return d; }
  return MINE_DROPS[0];
}

// Экзамены
const EXAM_QUESTIONS = [
  { q: 'Кто основал Коммунистическую партию Китая?', answers: ['мао', 'мао цзэдун', 'мао цзедун'], hint: 'Великий Кормчий...' },
  { q: 'Сколько звёзд на флаге Китая?', answers: ['5', 'пять'], hint: 'Считай внимательно...' },
  { q: 'Как называется столица Китая?', answers: ['пекин', 'beijing'], hint: 'Это не Шанхай...' },
  { q: 'Как переводится слово "юань"?', answers: ['круглый', 'круг', 'округлый'], hint: 'Думай о форме монеты...' },
  { q: 'Сколько человек живёт в Китае? (в миллиардах)', answers: ['1.4', '1,4', 'полтора'], hint: 'Больше миллиарда...' },
  { q: 'Как называется великая стена в Китае?', answers: ['великая китайская стена', 'китайская стена', 'великая стена'], hint: 'Она очень длинная...' },
  { q: 'Назови любой китайский праздник', answers: ['новый год', 'китайский новый год', 'праздник весны', 'день труда', 'день республики'], hint: 'Их много...' },
  { q: 'Какое животное символизирует 2024 год по китайскому календарю?', answers: ['дракон'], hint: 'Оно огнедышащее...' },
];

// Активности
const ACTIVITIES = [
  { id: 'granny',   label: '👵 Помочь бабушке перейти дорогу',  credits: 300,  yuan: 0   },
  { id: 'litter',   label: '🗑️ Убрать мусор в парке',           credits: 200,  yuan: 100 },
  { id: 'flag',     label: '🚩 Повесить флаг Партии на доме',    credits: 500,  yuan: 0   },
  { id: 'study',    label: '📖 Прочитать речь Председателя',     credits: 400,  yuan: 50  },
  { id: 'report',   label: '📢 Рассказать о Партии соседям',     credits: 350,  yuan: 0   },
];

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('socialcredit')
      .setDescription('Добавить или забрать социальные кредиты у пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Количество (отрицательное = забрать)').setRequired(true)),
    new SlashCommandBuilder()
      .setName('socialstats')
      .setDescription('Показать социальный рейтинг пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true)),
    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 граждан по социальному рейтингу'),
    new SlashCommandBuilder().setName('resetall').setDescription('Сбросить все данные (только для Создателя)'),
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник по экономике Партии'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе (раз в час)'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Посмотреть свой паспорт и баланс юаней'),
    new SlashCommandBuilder()
      .setName('buy_v2_0')
      .setDescription('Купить предмет в магазине Партии')
      .addStringOption(opt => opt.setName('item').setDescription('Выберите товар').setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50 000 юаней)', value: 'cat_wife' },
          { name: '🍚 Миска риса (5 000 юаней)', value: 'rice_bowl' },
          { name: '🎟 Лотерея (1 000 юаней)', value: 'ticket' }
        )),
    new SlashCommandBuilder()
      .setName('steal_v2_0')
      .setDescription('Анонимно украсть юани у гражданина')
      .addUserOption(opt => opt.setName('target').setDescription('Цель кражи').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Сколько юаней украсть').setRequired(true)),
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
      .setDescription('Работать по профессии')
      .addStringOption(opt => opt.setName('job').setDescription('Выберите профессию').setRequired(true)
        .addChoices(
          { name: '⛏️ Шахтёр — высокий доход, риск травмы', value: 'miner' },
          { name: '📊 Бухгалтер — стабильный доход, низкий риск', value: 'accountant' },
          { name: '🕵️ Шпион — огромный доход, риск тюрьмы', value: 'spy' }
        )),
    new SlashCommandBuilder().setName('achievements_v2_0').setDescription('Посмотреть свои достижения'),
    new SlashCommandBuilder().setName('activity_v2_0').setDescription('Выполнить гражданскую активность (раз в час)'),
    new SlashCommandBuilder().setName('worktop_v2_0').setDescription('Лидерборд лучших работников'),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Команды зарегистрированы для сервера!');
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды зарегистрированы глобально!');
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on('ready', () => console.log(`🤖 Бот запущен как ${client.user.tag}`));

// ── Ежедневный лучший работник (проверяем каждые 10 минут) ──
function scheduleBestWorker() {
  setInterval(async () => {
    const db = loadDB();
    const now = Date.now();
    const lastPrize = db.bestWorkerCooldown['last'] || 0;
    if (now - lastPrize < DAILY_COOLDOWN_MS) return;

    // Находим топ работника за день
    const stats = db.workStats || {};
    let bestId = null, bestCount = 0;
    for (const [id, data] of Object.entries(stats)) {
      const todayShifts = data.todayShifts || 0;
      if (todayShifts > bestCount) { bestCount = todayShifts; bestId = id; }
    }
    if (!bestId || bestCount === 0) return;

    // Выдаём премию
    const bonus = 2000;
    addCredits(bestId, bonus);
    addYuan(bestId, 1000);
    giveAchievement(bestId, 'best_worker');

    // Сбрасываем счётчики
    for (const id of Object.keys(stats)) { db.workStats[id].todayShifts = 0; }
    db.bestWorkerCooldown['last'] = now;
    db.bestWorkerCooldown['lastWinner'] = bestId;
    db.bestWorkerCooldown['lastBonus'] = bonus;
    saveDB(db);
  }, 10 * 60 * 1000);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  // ── /help_v2_0 ──────────────────────────────────────────
  if (interaction.commandName === 'help_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('📕 Справочник Партии v2.0')
      .addFields(
        { name: '💰 Заработок', value: '`/work_v2_0` — завод (раз в час, +50–500 юаней)\n`/profession_v2_0` — специализированная работа\n`/daily_v2_0` — ежедневная награда\n`/activity_v2_0` — гражданская активность (раз в час)', inline: false },
        { name: '⛏️ Шахтёр — подробности', value: 'При работе выпадает случайный предмет:\n🪨 Камень (37%) — 50 юаней\n🪵 Уголь (25%) — 150 юаней\n⚙️ Железо (20%) — 300 юаней\n🥇 Золото (15%) — 700 юаней\n💎 Алмаз (3%) — 2000 юаней + **5000 соц. кредитов** + бесплатное лечение!\n\n⚠️ Шанс травмы 20% — лечение 1 час, работать нельзя', inline: false },
        { name: '🕵️ Шпион — подробности', value: 'Доход 500–2000 юаней, кулдаун 2 часа\n⚠️ Шанс провала 35% — **тюрьма до 2 часов!**\nВ тюрьме нельзя работать и воровать', inline: false },
        { name: '📊 Бухгалтер — подробности', value: 'Доход 200–400 юаней, кулдаун 30 минут\nРиск провала 2% — самая безопасная профессия', inline: false },
        { name: '🏆 Лучший работник дня', value: 'Каждые 24 часа — тот кто больше всех отработал получает **+2000 кредитов и 1000 юаней**!\nПосмотреть: `/worktop_v2_0`', inline: false },
        { name: '🎮 Развлечения', value: '`/wheel_v2_0` — колесо фортуны (раз в день)\n`/exam_v2_0` — партийный экзамен (раз в час)\n`/vote_v2_0` — народный суд (раз в час)', inline: false },
        { name: '🥷 Кража', value: '`/steal_v2_0` — анонимная кража юаней\nПосле кражи — голосование кто вор\nШтраф при разоблачении: **-500 соц. кредитов**', inline: false },
        { name: '🛒 Магазин', value: '`/partyshop_v2_0` — товары Партии\n`/buy_v2_0` — купить товар', inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }

  // ── /work_v2_0 ──────────────────────────────────────────
  else if (interaction.commandName === 'work_v2_0') {
    const heal = isHealing(userId);
    if (heal) return interaction.reply({ content: `🏥 Ты на лечении! Можно работать через **${formatTime(heal)}**.`, flags: 64 });
    const prison = isInPrison(userId);
    if (prison) return interaction.reply({ content: `🔒 Ты в тюрьме! Выйдешь через **${formatTime(prison)}**.`, flags: 64 });

    const db = loadDB();
    const cd = checkCooldown(db, 'workCooldown', userId, WORK_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const earn = Math.floor(Math.random() * 451) + 50;
    addYuan(userId, earn);

    // Статистика для лучшего работника
    const db2 = loadDB();
    if (!db2.workStats[userId]) db2.workStats[userId] = { totalShifts: 0, todayShifts: 0 };
    db2.workStats[userId].totalShifts++;
    db2.workStats[userId].todayShifts++;
    saveDB(db2);

    const ach = giveAchievement(userId, 'first_work');
    let achMsg = ach ? `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)` : '';

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🏭 Завод Партии')
      .setDescription(`Ты отработал смену и заработал **${earn} юаней**!\n⏳ Следующая смена через **1 час**.` + achMsg);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /profession_v2_0 ────────────────────────────────────
  else if (interaction.commandName === 'profession_v2_0') {
    const job = interaction.options.getString('job');
    const heal = isHealing(userId);
    const prison = isInPrison(userId);

    if (heal) return interaction.reply({ content: `🏥 Ты на лечении! Можно работать через **${formatTime(heal)}**.`, flags: 64 });
    if (prison) return interaction.reply({ content: `🔒 Ты в тюрьме! Выйдешь через **${formatTime(prison)}**.`, flags: 64 });

    const db = loadDB();
    const now = Date.now();
    const cdKey = `${userId}_${job}`;
    const cooldowns = { miner: 3600000, accountant: 1800000, spy: 7200000 };
    const lastWork = db.profCooldown[cdKey] || 0;
    const cdMs = cooldowns[job];

    if (now - lastWork < cdMs) {
      return interaction.reply({ content: `⏳ Следующая смена через **${formatTime(cdMs - (now - lastWork))}**.`, flags: 64 });
    }
    db.profCooldown[cdKey] = now;
    saveDB(db);

    // Статистика для лучшего работника (только шахтёр и бухгалтер)
    if (job === 'miner' || job === 'accountant') {
      const db2 = loadDB();
      if (!db2.workStats[userId]) db2.workStats[userId] = { totalShifts: 0, todayShifts: 0 };
      db2.workStats[userId].totalShifts++;
      db2.workStats[userId].todayShifts++;
      saveDB(db2);
    }

    // ── ШАХТЁР ──
    if (job === 'miner') {
      const drop = rollMineDrop();
      const injured = !drop.diamond && Math.random() * 100 < MINE_INJURY_CHANCE;

      let desc = `Ты спустился в шахту и нашёл: **${drop.name}**\n💴 +${drop.yuan} юаней`;
      if (drop.credits > 0) desc += `\n⭐ +${drop.credits} соц. кредитов`;

      let achMsg = '';
      if (drop.diamond) {
        addYuan(userId, drop.yuan);
        addCredits(userId, drop.credits);
        const ach = giveAchievement(userId, 'diamond');
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
        desc += `\n\n💎 **АЛМАЗ! Бесплатное лечение и премия от Партии!**` + achMsg;
        const embed = new EmbedBuilder().setColor(0x00FFFF).setTitle('⛏️ Шахта — АЛМАЗ!').setDescription(desc);
        return interaction.reply({ embeds: [embed] });
      }

      addYuan(userId, drop.yuan);

      if (injured) {
        const db3 = loadDB();
        db3.healCooldown[userId] = Date.now() + HEAL_COOLDOWN_MS;
        saveDB(db3);
        desc += `\n\n🤕 **Тебя придавило! Ты на лечении 1 час.**\nРаботать нельзя до выздоровления.\n💸 Лечение стоит **500 юаней**.`;
        addYuan(userId, -500);
        const embed = new EmbedBuilder().setColor(0xFF4500).setTitle('⛏️ Шахта — Травма!').setDescription(desc);
        return interaction.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder().setColor(0x888888).setTitle('⛏️ Шахта — Смена выполнена').setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    // ── БУХГАЛТЕР ──
    if (job === 'accountant') {
      const failed = Math.random() * 100 < 2;
      if (failed) {
        addYuan(userId, -100);
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('📊 Бухгалтерия — Ошибка!').setDescription('Ты допустил ошибку в отчёте...\n💴 -100 юаней');
        return interaction.reply({ embeds: [embed] });
      }
      const earn = Math.floor(Math.random() * 201) + 200;
      addYuan(userId, earn);
      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle('📊 Бухгалтерия — Отчёт сдан').setDescription(`Партия приняла твой отчёт!\n💴 +${earn} юаней\n⏳ Следующая смена через **30 минут**`);
      return interaction.reply({ embeds: [embed] });
    }

    // ── ШПИОН ──
    if (job === 'spy') {
      if (getCredits(userId) < 0) return interaction.reply({ content: '❌ Враги народа не могут быть шпионами!', flags: 64 });
      const failed = Math.random() * 100 < 35;
      if (failed) {
        const prisonMs = Math.floor(Math.random() * PRISON_MAX_MS) + 30 * 60 * 1000; // 30мин - 2часа
        const db3 = loadDB();
        db3.prison[userId] = Date.now() + prisonMs;
        saveDB(db3);
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🕵️ Провал операции — ТЮРЬМА!').setDescription(`Тебя поймали при выполнении задания!\n🔒 Ты в тюрьме на **${formatTime(prisonMs)}**.\nРаботать и воровать нельзя.`);
        return interaction.reply({ embeds: [embed] });
      }
      const earn = Math.floor(Math.random() * 1501) + 500;
      addYuan(userId, earn);
      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle('🕵️ Операция выполнена').setDescription(`Миссия завершена успешно!\n💴 +${earn} юаней\n⏳ Следующая миссия через **2 часа**`);
      return interaction.reply({ embeds: [embed] });
    }
  }

  // ── /worktop_v2_0 ───────────────────────────────────────
  else if (interaction.commandName === 'worktop_v2_0') {
    const db = loadDB();
    const stats = db.workStats || {};
    const sorted = Object.entries(stats)
      .sort((a, b) => (b[1].totalShifts || 0) - (a[1].totalShifts || 0))
      .slice(0, 10);

    if (sorted.length === 0) return interaction.reply({ content: 'Пока никто не работал!', flags: 64 });

    const lastWinner = db.bestWorkerCooldown['lastWinner'];
    const lines = sorted.map(([id, d], i) => `**${i + 1}.** <@${id}> — ${d.totalShifts || 0} смен (сегодня: ${d.todayShifts || 0})`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Лучшие работники Партии')
      .setDescription(lines)
      .setFooter({ text: lastWinner ? `Последний победитель: <@${lastWinner}>` : 'Победитель ещё не определён' });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /activity_v2_0 ──────────────────────────────────────
  else if (interaction.commandName === 'activity_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'activityCooldown', userId, ACTIVITY_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая активность через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const row = new ActionRowBuilder();
    for (const act of ACTIVITIES) {
      row.addComponents(new ButtonBuilder().setCustomId(`activity_${act.id}`).setLabel(act.label).setStyle(ButtonStyle.Primary));
    }

    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🗺️ Гражданская активность')
      .setDescription('Выбери задание для Партии:');
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    try {
      const i = await msg.awaitMessageComponent({ filter: c => c.user.id === userId, time: 30000 });
      const actId = i.customId.replace('activity_', '');
      const act = ACTIVITIES.find(a => a.id === actId);
      if (!act) return i.update({ content: 'Ошибка.', embeds: [], components: [] });

      addCredits(userId, act.credits);
      if (act.yuan > 0) addYuan(userId, act.yuan);

      // Трекаем активности для достижения
      const db2 = loadDB();
      db2.economy[`${userId}_activity_count`] = (db2.economy[`${userId}_activity_count`] || 0) + 1;
      saveDB(db2);
      let achMsg = '';
      if (db2.economy[`${userId}_activity_count`] >= 3) {
        const ach = giveAchievement(userId, 'good_citizen');
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`✅ ${act.label}`)
        .setDescription(`Партия благодарит тебя!\n⭐ +${act.credits} соц. кредитов${act.yuan > 0 ? `\n💴 +${act.yuan} юаней` : ''}` + achMsg);
      await i.update({ embeds: [resultEmbed], components: [] });
    } catch {
      await interaction.editReply({ content: '⏳ Время вышло.', embeds: [], components: [] });
    }
  }

  // ── /steal_v2_0 (анонимная с анимацией) ─────────────────
  else if (interaction.commandName === 'steal_v2_0') {
    const targetUser = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');
    const prison = isInPrison(userId);

    if (prison) return interaction.reply({ content: `🔒 Ты в тюрьме! Выйдешь через **${formatTime(prison)}**.`, flags: 64 });
    if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя воровать у самого себя!', flags: 64 });
    if (amount <= 0) return interaction.reply({ content: '❌ Укажи положительную сумму!', flags: 64 });
    if (getCredits(userId) < 0) return interaction.reply({ content: '❌ Враги народа не могут воровать!', flags: 64 });

    const targetEco = getEco(targetUser.id);
    if (targetEco.wallet < amount) return interaction.reply({ content: `❌ У цели только **${targetEco.wallet} юаней**!`, flags: 64 });

    const chance = Math.max(1, Math.floor(5000 / (amount + 150)));

    // Анимация — стрелочка и цветные квадраты
    const buildArrow = (pos) => {
      const colors = ['🟥','🟨','🟩','🟨','🟥','🟨','🟩','🟨','🟥','🟩'];
      let bar = '';
      for (let j = 0; j < colors.length; j++) {
        bar += colors[j];
      }
      let arrow = '';
      for (let j = 0; j < colors.length; j++) {
        arrow += j === pos ? '⬆️' : '　';
      }
      return `${arrow}\n${bar}`;
    };

    const msg = await interaction.reply({ content: `🥷 **Неизвестный** пытается ограбить **${targetUser.username}**...\n\n${buildArrow(0)}`, fetchReply: true });

    // Анимируем 10 секунд
    let pos = 0; let dir = 1;
    for (let step = 0; step < 12; step++) {
      await new Promise(r => setTimeout(r, 850));
      pos += dir;
      if (pos >= 9 || pos <= 0) dir *= -1;
      try { await interaction.editReply({ content: `🥷 **Неизвестный** пытается ограбить **${targetUser.username}**...\n\n${buildArrow(pos)}` }); } catch {}
    }

    // Результат кражи
    const success = Math.random() * 100 < chance;
    if (success) {
      addYuan(targetUser.id, -amount);
      addYuan(userId, amount);
      giveAchievement(userId, 'thief');

      // Голосование — кто вор
      const suspects = [interaction.user, targetUser];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accuse_${interaction.user.id}`).setLabel(`🔍 Это ${interaction.user.username}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`accuse_${targetUser.id}`).setLabel(`🔍 Это ${targetUser.username}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('accuse_unknown').setLabel('🤷 Не знаю').setStyle(ButtonStyle.Secondary)
      );

      const voteEmbed = new EmbedBuilder()
        .setColor(0xFF4500)
        .setTitle('🚨 КРАЖА! КТО ВОР?')
        .setDescription(`У **${targetUser.username}** украли **${amount} юаней**!\n\nГраждане, проголосуйте — кто это сделал? (60 секунд)`);

      await interaction.editReply({ content: '', embeds: [voteEmbed], components: [row] });

      const votes = {};
      const voters = new Set();
      const collector = msg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async i => {
        if (voters.has(i.user.id)) return i.reply({ content: '❌ Ты уже голосовал!', flags: 64 });
        voters.add(i.user.id);
        votes[i.customId] = (votes[i.customId] || 0) + 1;
        await i.reply({ content: '✅ Твой голос учтён!', flags: 64 });
      });

      collector.on('end', async () => {
        // Определяем кого обвинили
        const accuseVotes = Object.entries(votes).filter(([k]) => k.startsWith('accuse_') && k !== 'accuse_unknown');
        let topAccused = null, topVotes = 0;
        for (const [k, v] of accuseVotes) { if (v > topVotes) { topVotes = v; topAccused = k.replace('accuse_', ''); } }

        let resultText;
        if (topAccused && topAccused !== 'unknown') {
          if (topAccused === userId) {
            addCredits(userId, -500);
            resultText = `Большинство считает, что это **${interaction.user.username}** — и они **ПРАВЫ**! Штраф: **-500 соц. кредитов**.`;
          } else {
            resultText = `Большинство считает что это **${suspects.find(s => s.id === topAccused)?.username || 'неизвестный'}** — но Партия не уверена...`;
          }
        } else {
          resultText = `Вор остался **неизвестным**. Партия продолжает расследование.`;
        }

        const endEmbed = new EmbedBuilder().setColor(0xED2939).setTitle('⚖️ Результат расследования').setDescription(resultText);
        await interaction.editReply({ embeds: [endEmbed], components: [] });
      });

    } else {
      addCredits(userId, -500);
      await interaction.editReply({ content: `🚨 **Провал!** Неизвестный пойман при краже у **${targetUser.username}**! Штраф: **-500 соц. кредитов**.` });
    }
  }

  // ── /daily_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'daily_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'dailyCooldown', userId, DAILY_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая ежедневная награда через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const rewards = [
      { text: 'Партия благодарит за верность!', credits: 500, yuan: 200 },
      { text: 'Ты примерный гражданин!', credits: 300, yuan: 500 },
      { text: 'Партия отметила твой вклад!', credits: 1000, yuan: 100 },
      { text: 'Ежедневный паёк выдан!', credits: 200, yuan: 300 },
      { text: 'Партия наблюдает — и одобряет!', credits: 700, yuan: 400 },
    ];
    const r = rewards[Math.floor(Math.random() * rewards.length)];
    addCredits(userId, r.credits); addYuan(userId, r.yuan);
    const embed = new EmbedBuilder().setColor(0xED2939).setTitle('📦 Ежедневная награда от Партии')
      .setDescription(`**${r.text}**\n\n⭐ +${r.credits} соц. кредитов\n💴 +${r.yuan} юаней`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /wheel_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'wheel_v2_0') {
    const db = loadDB();
    const cd = checkCooldown(db, 'wheelCooldown', userId, WHEEL_COOLDOWN_MS);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Колесо перезарядится через **${formatTime(cd.waitMs)}**.`, flags: 64 });

    const sectors = [
      { label: '💀 ПОЗОР!',           credits: -1000, yuan: 0,    color: 0xFF0000, chance: 10 },
      { label: '😢 Не повезло',       credits: -300,  yuan: 0,    color: 0xFF4500, chance: 15 },
      { label: '😐 Пусто',            credits: 0,     yuan: 0,    color: 0x888888, chance: 20 },
      { label: '✅ Небольшой бонус',  credits: 300,   yuan: 100,  color: 0x00BFFF, chance: 25 },
      { label: '⭐ Хороший бонус',    credits: 700,   yuan: 300,  color: 0x00FF88, chance: 15 },
      { label: '🎉 Отличный бонус!',  credits: 1500,  yuan: 500,  color: 0xFFD700, chance: 10 },
      { label: '🏆 ДЖЕКПОТ ПАРТИИ!', credits: 5000,  yuan: 2000, color: 0xFF00FF, chance: 5  },
    ];
    const total = sectors.reduce((s, x) => s + x.chance, 0);
    let rand = Math.random() * total;
    let result = sectors[0];
    for (const s of sectors) { rand -= s.chance; if (rand <= 0) { result = s; break; } }

    await interaction.reply({ content: '🎡 **Колесо крутится...**' });
    for (let i = 1; i <= 3; i++) {
      await new Promise(r => setTimeout(r, 800));
      await interaction.editReply({ content: `🌀 **Колесо крутится...** [${i}/3]` });
    }
    await new Promise(r => setTimeout(r, 800));

    if (result.credits !== 0) addCredits(userId, result.credits);
    if (result.yuan !== 0) addYuan(userId, result.yuan);

    let achMsg = '';
    if (result.label.includes('ДЖЕКПОТ')) { const ach = giveAchievement(userId, 'wheel_jackpot'); if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`; }

    const embed = new EmbedBuilder().setColor(result.color)
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
    const embed = new EmbedBuilder().setColor(0xED2939).setTitle('📚 Партийный экзамен')
      .setDescription(`**Вопрос:** ${q.q}\n\n_Подсказка: ${q.hint}_\n\nУ тебя **60 секунд** — напиши ответ в чат!`);
    await interaction.reply({ embeds: [embed] });

    try {
      const filter = m => m.author.id === userId;
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
      const answer = collected.first().content.toLowerCase().trim();
      const correct = q.answers.some(a => answer.includes(a));

      if (correct) {
        const reward = Math.floor(Math.random() * 1001) + 500;
        addCredits(userId, reward); addYuan(userId, 200);
        const db2 = loadDB();
        db2.examCooldown[`${userId}_streak`] = (db2.examCooldown[`${userId}_streak`] || 0) + 1;
        saveDB(db2);
        let achMsg = '';
        if (db2.examCooldown[`${userId}_streak`] >= 3) {
          const ach = giveAchievement(userId, 'exam_ace');
          if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
          db2.examCooldown[`${userId}_streak`] = 0; saveDB(db2);
        }
        const win = new EmbedBuilder().setColor(0x00FF88).setTitle('✅ Правильно! Партия одобряет!').setDescription(`⭐ +${reward} соц. кредитов\n💴 +200 юаней` + achMsg);
        await interaction.followUp({ embeds: [win] });
      } else {
        addCredits(userId, -300);
        const db2 = loadDB(); db2.examCooldown[`${userId}_streak`] = 0; saveDB(db2);
        const lose = new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Неверно! Позор!').setDescription(`Правильный ответ: **${q.answers[0]}**\n⭐ -300 соц. кредитов`);
        await interaction.followUp({ embeds: [lose] });
      }
    } catch {
      const t = new EmbedBuilder().setColor(0x888888).setTitle('⏰ Время вышло!').setDescription(`Правильный ответ: **${q.answers[0]}**`);
      await interaction.followUp({ embeds: [t] });
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

    const embed = new EmbedBuilder().setColor(0xED2939).setTitle('⚖️ НАРОДНЫЙ СУД ПАРТИИ')
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
      if (i.customId === 'vote_guilty') votes.guilty++; else votes.innocent++;
      await i.reply({ content: `✅ Голос учтён. Счёт: 👍 ${votes.guilty} — 👎 ${votes.innocent}`, flags: 64 });
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
      const r = new EmbedBuilder().setColor(color).setTitle('⚖️ ПРИГОВОР ВЫНЕСЕН').setDescription(resultText);
      await interaction.editReply({ embeds: [r], components: [] });
    });
  }

  // ── /partyshop_v2_0 ─────────────────────────────────────
  else if (interaction.commandName === 'partyshop_v2_0') {
    const embed = new EmbedBuilder().setColor(0xED2939).setTitle('🛒 Магазин Партии')
      .addFields(
        { name: '🐱 Кошка-жена', value: '50 000 юаней\n`/buy_v2_0` → cat_wife', inline: true },
        { name: '🍚 Миска риса', value: '5 000 юаней\n`/buy_v2_0` → rice_bowl', inline: true },
        { name: '🎟 Лотерея', value: '1 000 юаней\n`/buy_v2_0` → ticket', inline: true }
      ).setFooter({ text: 'Используй /buy_v2_0 для покупки' });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /profile_v2_0 ───────────────────────────────────────
  else if (interaction.commandName === 'profile_v2_0') {
    const credits = getCredits(userId);
    const eco = getEco(userId);
    const rating = getRating(credits);
    const db = loadDB();
    const achCount = (db.achievements[userId] || []).length;
    const shifts = db.workStats[userId]?.totalShifts || 0;
    const prisonMs = isInPrison(userId);
    const healMs = isHealing(userId);

    let statusExtra = '';
    if (prisonMs) statusExtra = `\n🔒 В тюрьме ещё **${formatTime(prisonMs)}**`;
    if (healMs) statusExtra = `\n🏥 На лечении ещё **${formatTime(healMs)}**`;

    const embed = new EmbedBuilder().setColor(rating.color).setTitle(`🛂 Паспорт гражданина: ${interaction.user.username}`)
      .addFields(
        { name: '⭐ Соц. рейтинг', value: `${credits}`, inline: true },
        { name: '💴 Юани', value: `${eco.wallet}`, inline: true },
        { name: '🏅 Достижения', value: `${achCount}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true },
        { name: '🏭 Смен отработано', value: `${shifts}`, inline: true },
        { name: '🏷 Статус', value: rating.label + statusExtra, inline: false },
        { name: '🐱 Кошка-жена', value: eco.items.cat_wife ? 'Есть ✅' : 'Нет ❌', inline: true },
        { name: '🍚 Миски риса', value: `${eco.items.rice_bowls}`, inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }

  // ── /buy_v2_0 ───────────────────────────────────────────
  else if (interaction.commandName === 'buy_v2_0') {
    const item = interaction.options.getString('item');
    const eco = getEco(userId);

    if (item === 'cat_wife') {
      if (eco.wallet < 50000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **50 000**.', flags: 64 });
      if (eco.items.cat_wife) return interaction.reply({ content: '❌ У тебя уже есть кошка-жена!', flags: 64 });
      const db = loadDB(); db.economy[userId].wallet -= 50000; db.economy[userId].items.cat_wife = true; saveDB(db);
      const ach = giveAchievement(userId, 'cat_owner');
      await interaction.reply({ content: `🐱 Поздравляем! Ты купил **кошку-жену**!${ach ? `\n🏅 **Новое достижение:** ${ach.name}` : ''}` });
    } else if (item === 'rice_bowl') {
      if (eco.wallet < 5000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **5 000**.', flags: 64 });
      const db = loadDB(); db.economy[userId].wallet -= 5000; db.economy[userId].items.rice_bowls += 1; saveDB(db);
      await interaction.reply({ content: `🍚 Ты купил **миску риса**! Теперь у тебя **${db.economy[userId].items.rice_bowls}** мисок.` });
    } else if (item === 'ticket') {
      if (eco.wallet < 1000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **1 000**.', flags: 64 });
      addYuan(userId, -1000);
      const win = Math.random();
      let result;
      if (win < 0.05) { addYuan(userId, 20000); result = '🎉 ДЖЕКПОТ! +20 000 юаней!'; }
      else if (win < 0.25) { addYuan(userId, 3000); result = '🎊 Выигрыш! +3 000 юаней!'; }
      else { result = '😢 Не повезло. Лотерея забрала твои 1 000 юаней.'; }
      const db2 = loadDB();
      db2.economy[`${userId}_lottery_count`] = (db2.economy[`${userId}_lottery_count`] || 0) + 1;
      saveDB(db2);
      let achMsg = '';
      if (db2.economy[`${userId}_lottery_count`] >= 5) { const ach = giveAchievement(userId, 'gambler'); if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name}`; }
      await interaction.reply({ content: `🎟 **Лотерея:** ${result}` + achMsg });
    }
  }

  // ── /achievements_v2_0 ──────────────────────────────────
  else if (interaction.commandName === 'achievements_v2_0') {
    const db = loadDB();
    const userAchs = db.achievements[userId] || [];
    const lines = Object.entries(ACHIEVEMENTS_LIST).map(([id, ach]) =>
      `${userAchs.includes(id) ? '✅' : '🔒'} **${ach.name}** — ${ach.desc} (+${ach.reward} кред.)`
    ).join('\n');
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle(`🏅 Достижения: ${interaction.user.username}`)
      .setDescription(lines).setFooter({ text: `Получено: ${userAchs.length}/${Object.keys(ACHIEVEMENTS_LIST).length}` });
    await interaction.reply({ embeds: [embed] });
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
    if (newCredits >= 20000) giveAchievement(targetUser.id, 'patriot');
    const embed = new EmbedBuilder().setColor(verdict.color).setTitle(verdict.title)
      .setDescription(`**${interaction.user.username}** ${amount > 0 ? 'наградил' : 'наказал'} **${targetUser.username}** на **${amount} баллов**.\nНовый рейтинг: **${newCredits}** (${rating.label})\n${verdict.message}`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /socialstats ────────────────────────────────────────
  else if (interaction.commandName === 'socialstats') {
    const targetUser = interaction.options.getUser('user');
    const credits = getCredits(targetUser.id);
    const rating = getRating(credits);
    const embed = new EmbedBuilder().setColor(rating.color).setTitle(`📊 Социальный рейтинг: ${targetUser.username}`)
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
    saveDB(emptyDB());
    await interaction.reply({ content: '✅ Все данные сброшены!' });
  }
});

registerCommands().catch(err => console.error('❌ Ошибка регистрации команд:', err));
client.login(TOKEN).then(() => scheduleBestWorker());
