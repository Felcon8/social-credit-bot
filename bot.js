'use strict';
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const http = require('http');

const {
  connectDB,
  ACHIEVEMENTS_LIST, ITEMS_DB, RARITY_META, CASES_DB, rollCaseItem,
  getCredits, addCredits,
  getEco, addYuan,
  checkCooldown, checkProfCooldown, checkAndUseLimit,
  getJailRemaining, sendToJail,
  getInjuryRemaining, setInjury, cureInjury,
  giveAchievement,
  trackShift, checkWorkerOfDayReset,
  getLeaderboard, resetAll,
  incLotteryCount,
  getExamStreak, setExamStreak,
  getPlayer,
  getPickaxeData, damagePickaxe, repairPickaxe, applyRepairPickaxe, upgradePickaxe, applyPickaxeUpgrade,
  addHardwareItem, removeHardwareItem, getHardwareInventory,
  createAuction, getActiveAuctions, buyAuction, cancelAuction,
} = require('./database');

// ════════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ И ПАРАМЕТРЫ
// ════════════════════════════════════════════════════════════
const TOKEN          = process.env.TOKEN;
const CLIENT_ID      = process.env.CLIENT_ID;
const GUILD_ID       = process.env.GUILD_ID || '1151160668892975214';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OWNER_ID       = '1528109131704176822';

const CREDIT_CMD_COOLDOWN_MS   = 30 * 1000;
const WORK_COOLDOWN_MS         = 60 * 60 * 1000;
const DAILY_COOLDOWN_MS        = 24 * 60 * 60 * 1000;
const WHEEL_COOLDOWN_MS        = 24 * 60 * 60 * 1000;
const EXAM_COOLDOWN_MS         = 5 * 60 * 1000;
const VOTE_COOLDOWN_MS         = 60 * 60 * 1000;
const ACTIVITY_COOLDOWN_MS     = 60 * 60 * 1000;
const JAIL_MIN_MS              = 30 * 60 * 1000;
const JAIL_MAX_MS              = 2 * 60 * 60 * 1000;
const WORKER_DAY_MS            = 24 * 60 * 60 * 1000;
const WORKER_OF_DAY_BONUS_CREDITS = 2000;
const WORKER_OF_DAY_BONUS_YUAN    = 1000;
const MINE_COOLDOWN_MS         = 5 * 1000;

// Keep-alive веб-сервер
http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

// ════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ════════════════════════════════════════════════════════════
function getRating(credits) {
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700, legend: '🐱 получать **кошка жена**\n🍚 получать **миска риса**' };
  if (credits >= 10000) return { label: '⭐ Отличник',            color: 0x00FF88, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный',          color: 0x00BFFF, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением',     color: 0xFFA500, legend: null };
  return                       { label: '💀 Враг народа',         color: 0xFF0000, legend: '🐱 **отобрать кошка жена**' };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) return { title: '🏆 Образцовый гражданин', message: 'Партия гордится тобой!',    color: 0xFFD700 };
  if (credits > 100)    return { title: '🎉 Партия гордится тобой!',message: 'Продолжай служить Партии!', color: 0x00FF88 };
  if (credits >= 0)     return { title: '👍 Хорошо, но можно лучше',message: 'Партия ожидает большего!', color: 0x00BFFF };
  return                       { title: '😤 Ай ай ай! Позор!',      message: 'Исправляйся немедленно!',  color: 0xFF0000 };
}

function formatTime(ms) {
  const h    = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.ceil((ms % 60000) / 1000);
  if (h > 0) return `${h} ч. ${mins} мин.`;
  return mins > 0 ? `${mins} мин. ${secs} сек.` : `${secs} сек.`;
}

function getPickaxeName(level) {
  if (level === 1) return '🪨 Деревянная кирка';
  if (level === 2) return '🛠️ Каменная кирка';
  if (level === 3) return '⛓️ Железная кирка';
  if (level === 4) return '🥇 Золотая кирка';
  if (level >= 5)  return `💎 Алмазная кирка (+${level})`;
  return 'Кирка';
}

function durabilityBar(current, max, length = 20) {
  const filled = Math.round((current / max) * length);
  const empty  = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${max}`;
}

function buildInventoryTable(items) {
  if (items.length === 0) return '```\n  Инвентарь пуст\n```';

  const COL_ID    = 14;
  const COL_NAME  = 26;
  const COL_QTY   = 5;
  const COL_RAR   = 10;

  const pad = (str, n) => String(str).padEnd(n).slice(0, n);
  const header = `${pad('ID', COL_ID)} ${pad('Название', COL_NAME)} ${pad('Кол', COL_QTY)} ${pad('Ред-сть', COL_RAR)}`;
  const divider = '─'.repeat(header.length);

  const rows = items.map(({ itemId, qty, meta }) =>
    `${pad(itemId, COL_ID)} ${pad(meta.name.replace(/\p{Emoji}/gu, ''), COL_NAME)} ${pad(qty, COL_QTY)} ${pad(RARITY_META[meta.rarity]?.label || meta.rarity, COL_RAR)}`
  );

  return `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;
}

function buildAuctionTable(lots) {
  if (lots.length === 0) return '```\n  Активных лотов нет\n```';

  const COL_ID    = 8;
  const COL_ITEM  = 24;
  const COL_QTY   = 5;
  const COL_PRICE = 10;

  const pad = (str, n) => String(str).padEnd(n).slice(0, n);
  const header  = `${pad('Лот', COL_ID)} ${pad('Предмет', COL_ITEM)} ${pad('Кол', COL_QTY)} ${pad('Цена (¥)', COL_PRICE)}`;
  const divider = '─'.repeat(header.length);

  const rows = lots.map(lot => {
    const meta = ITEMS_DB[lot.itemId];
    const name = meta ? meta.name.replace(/\p{Emoji}/gu, '').trim() : lot.itemId;
    return `${pad(lot.lotId, COL_ID)} ${pad(name, COL_ITEM)} ${pad(lot.quantity, COL_QTY)} ${pad(lot.price, COL_PRICE)}`;
  });

  return `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;
}

// ── Профессии ────────────────────────────────────────────────
const PROFESSIONS = {
  accountant: { name: '📊 Бухгалтер', minPay: 200, maxPay: 400,  riskChance: 2,  riskLoss: 100,  cooldown: 1800000 },
  spy:        { name: '🕵️ Шпион',     minPay: 500, maxPay: 2000, riskChance: 35, riskLoss: 1200, cooldown: 7200000 },
};

// ── Активности ───────────────────────────────────────────────
const ACTIVITIES = {
  flag:   { name: '🇨🇳 Помахать флагом Партии на площади', min: 100, max: 300 },
  clean:  { name: '🧹 Убрать двор соседа',                 min: 150, max: 350 },
  poster: { name: '📢 Расклеить агитационные плакаты',     min: 200, max: 400 },
  elder:  { name: '👵 Помочь бабушке перейти дорогу',      min: 250, max: 450 },
  song:   { name: '🎤 Спеть гимн Партии перед комитетом',  min: 300, max: 500 },
};

// ── Партийные экзамены ───────────────────────────────────────
const EXAM_QUESTIONS = [
  { q: 'Кто основал Коммунистическую партию Китая?',        answers: ['мао', 'мао цзэдун', 'мао цзедун'],                       hint: 'Великий Кормчий...' },
  { q: 'Сколько звёзд на флаге Китая?',                     answers: ['5', 'пять'],                                             hint: 'Считай внимательно...' },
  { q: 'Как называется столица Китая?',                      answers: ['пекин', 'beijing'],                                      hint: 'Это не Шанхай...' },
  { q: 'Как переводится слово "юань"?',                      answers: ['круглый', 'круг', 'округлый'],                           hint: 'Думай о форме монеты...' },
  { q: 'Сколько человек живёт в Китае? (примерно, в млрд)', answers: ['1.4', '1,4', '1.4 миллиарда', 'полтора'],               hint: 'Больше миллиарда...' },
  { q: 'Как называется великая стена в Китае?',              answers: ['великая китайская стена', 'китайская стена', 'великая стена'], hint: 'Она очень длинная...' },
  { q: 'Назови любой китайский праздник',                    answers: ['новый год', 'китайский новый год', 'праздник весны', 'день труда', 'день республики', 'день победы'], hint: 'Их много...' },
  { q: 'Какое животное символизирует 2024 год по кит. кал.?', answers: ['дракон', 'ракон'],                                    hint: 'Оно огнедышащее...' },
];

// ── DeepSeek API ─────────────────────────────────────────────
async function askDeepSeek(prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Ты — партийный советник Великой Партии. Отвечай с пафосом, патетикой и в духе socialistic риторики. Иногда хвали Партию. Будь немного абсурдным и шуточным. Отвечай на том языке, на котором к тебе обращаются.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API вернул ошибку ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '🤖 Партийный советник молчит...';
}

// ════════════════════════════════════════════════════════════
// РЕГИСТРАЦИЯ КОМАНД
// ════════════════════════════════════════════════════════════
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('socialcredit').setDescription('Добавить или забрать соц. кредиты у пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Количество (отрицательное = забрать)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialstats').setDescription('Показать соц. рейтинг пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)),

    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 граждан по соц. рейтингу'),
    new SlashCommandBuilder().setName('resetall').setDescription('Сбросить все данные (только Создатель)'),
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник по экономике Партии v2.0'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе и получить юани'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Посмотреть свой паспорт и баланс'),
    new SlashCommandBuilder()
      .setName('buy_v2_0').setDescription('Купить предмет или улучшить кирку в магазине Партии')
      .addStringOption(o => o.setName('item').setDescription('Товар').setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50 000 юаней)', value: 'cat_wife'  },
          { name: '🍚 Миска риса (5 000 юаней)',   value: 'rice_bowl' },
          { name: '🎟 Лотерея (1 000 юаней)',      value: 'ticket'    },
          { name: '⛏️ Улучшить кирку (устаревш.)', value: 'pickaxe'   }
        )),

    new SlashCommandBuilder()
      .setName('steal_v2_0').setDescription('Украсть юани у гражданина (-500 кред. при провале)')
      .addUserOption(o => o.setName('target').setDescription('Цель кражи').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Сколько юаней украсть').setRequired(true)),

    new SlashCommandBuilder().setName('daily_v2_0').setDescription('Получить ежедневную награду от Партии'),
    new SlashCommandBuilder().setName('wheel_v2_0').setDescription('Покрутить колесо фортуны (раз в сутки)'),

    new SlashCommandBuilder()
      .setName('vote_v2_0').setDescription('Устроить голосование за наказание гражданина')
      .addUserOption(o => o.setName('target').setDescription('Кого судить').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Причина обвинения').setRequired(true)),

    new SlashCommandBuilder().setName('exam_v2_0').setDescription('Сдать партийный экзамен и получить кредиты'),

    new SlashCommandBuilder()
      .setName('profession_v2_0').setDescription('Выбрать профессию и работать по специальности')
      .addStringOption(o => o.setName('job').setDescription('Профессия').setRequired(true)
        .addChoices(
          { name: '📊 Бухгалтер — стабильный доход, низкий риск', value: 'accountant' },
          { name: '🕵️ Шпион — огромный доход, огромный риск',    value: 'spy'         }
        )),

    new SlashCommandBuilder().setName('achievements_v2_0').setDescription('Посмотреть свои достижения'),

    new SlashCommandBuilder()
      .setName('activity_v2_0').setDescription('Заняться общественной деятельностью (раз в час)')
      .addStringOption(o => o.setName('activity').setDescription('Активность').setRequired(true)
        .addChoices(
          { name: '🇨🇳 Помахать флагом Партии на площади', value: 'flag'   },
          { name: '🧹 Убрать двор соседа',                 value: 'clean'  },
          { name: '📢 Расклеить агитационные плакаты',     value: 'poster' },
          { name: '👵 Помочь бабушке перейти дорогу',      value: 'elder'  },
          { name: '🎤 Спеть гимн Партии перед комитетом',  value: 'song'   }
        )),

    new SlashCommandBuilder().setName('workerboard_v2_0').setDescription('Топ работников дня'),

    new SlashCommandBuilder()
      .setName('ask_deepseek').setDescription('Задать вопрос Партийному советнику (AI DeepSeek)')
      .addStringOption(o => o.setName('question').setDescription('Твой вопрос к Партии').setRequired(true).setMaxLength(500)),

    // Система Шахты, Кейсов и Аукциона
    new SlashCommandBuilder().setName('mine').setDescription('⛏️ Ударить киркой в Партийной Шахте (кулдаун 5 сек)'),
    new SlashCommandBuilder().setName('pickaxe').setDescription('🔧 Состояние кирки: починить или улучшить'),
    new SlashCommandBuilder().setName('case').setDescription('📦 Кейсы Партийного оборудования — шансы и открытие'),
    new SlashCommandBuilder().setName('inv').setDescription('🗂️ Ваш инвентарь серверного оборудования')
      .addUserOption(o => o.setName('user').setDescription('Другой пользователь (необязательно)').setRequired(false)),

    new SlashCommandBuilder().setName('ah').setDescription('🏪 Публичный аукцион — список активных лотов'),
    new SlashCommandBuilder().setName('ah_sell').setDescription('📤 Выставить предмет на аукцион')
      .addStringOption(o => o.setName('item_id').setDescription('ID предмета (из /inv)').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Цена в юанях').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Количество (по умолчанию 1)').setRequired(false)),

    new SlashCommandBuilder().setName('ah_buy').setDescription('📥 Купить предмет с аукциона по ID лота')
      .addStringOption(o => o.setName('lot_id').setDescription('ID лота (6 символов)').setRequired(true)),

    new SlashCommandBuilder().setName('ah_cancel').setDescription('❌ Снять свой лот с аукциона')
      .addStringOption(o => o.setName('lot_id').setDescription('ID лота').setRequired(true)),

    new SlashCommandBuilder().setName('trade').setDescription('🤝 Предложить прямой обмен предметом с другим игроком')
      .addUserOption(o => o.setName('user').setDescription('Покупатель').setRequired(true))
      .addStringOption(o => o.setName('item_id').setDescription('ID предмета из твоего инвентаря').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Цена в юанях').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Количество (по умолчанию 1)').setRequired(false)),

  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); } catch { }
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Команды зарегистрированы!');
}

// ════════════════════════════════════════════════════════════
// КЛИЕНТ
// ════════════════════════════════════════════════════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const mineCooldowns = new Map();
const examCooldowns = new Map();

client.on('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
  checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(console.error);
  setInterval(
    () => checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(console.error),
    15 * 60 * 1000
  );
});

// ════════════════════════════════════════════════════════════
// ОБРАБОТЧИК ВЗАИМОДЕЙСТВИЙ
// ════════════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  const userId = interaction.user?.id || interaction.member?.user?.id;

  // ── SLASH COMMANDS ───────────────────────────────────────
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'help_v2_0') {
      const mineSection = [
        '```',
        '⛏️  ШАХТА И СНАРЯЖЕНИЕ',
        '────────────────────────────────────',
        '/mine          Удар киркой (кд: 5 сек)',
        '/pickaxe       Статус, починка, апгрейд кирки',
        '/case          Кейсы оборудования (шансы / открытие)',
        '/inv           Инвентарь серверного железа',
        '',
        '🏪  ТОРГОВЛЯ',
        '────────────────────────────────────',
        '/ah            Список лотов аукциона',
        '/ah_sell       Выставить предмет на продажу',
        '/ah_buy        Купить лот по ID',
        '/ah_cancel     Снять свой лот с продажи',
        '/trade         Прямой обмен с игроком',
        '```',
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('📕 Справочник Партии v2.0')
        .addFields(
          { name: '💰 Заработок',       value: '`/work_v2_0` — завод (раз в час)\n`/mine` — шахта (кд 5 сек)\n`/profession_v2_0` — по специальности\n`/daily_v2_0` — ежедневная награда\n`/activity_v2_0` — общественная деятельность', inline: false },
          { name: '🎮 Развлечения',     value: '`/wheel_v2_0` — колесо фортуны\n`/exam_v2_0` — партийный экзамен\n`/case` — кейсы оборудования\n`/vote_v2_0` — народный суд', inline: false },
          { name: '🛒 Магазин',         value: '`/partyshop_v2_0` — товары\n`/buy_v2_0` — купить предмет', inline: false },
          { name: '🥷 Риск',            value: '`/steal_v2_0` — украсть юани', inline: false },
          { name: '👤 Профиль',         value: '`/profile_v2_0` — паспорт\n`/achievements_v2_0` — достижения\n`/workerboard_v2_0` — топ дня\n`/inv` — инвентарь', inline: false },
          { name: '⛏️⚙️ Шахта и торговля', value: mineSection, inline: false },
          { name: '🤖 AI Советник',     value: '`/ask_deepseek` — DeepSeek AI', inline: false },
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'daily_v2_0') {
      const cd = await checkCooldown(userId, 'dailyCooldown', DAILY_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая награда через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const tasks = [
        { text: 'Партия благодарит за верность!', credits: 500,  yuan: 200 },
        { text: 'Ты примерный гражданин!',        credits: 300,  yuan: 500 },
        { text: 'Партия отметила твой вклад!',    credits: 1000, yuan: 100 },
        { text: 'Ежедневный паёк выдан!',         credits: 200,  yuan: 300 },
        { text: 'Партия наблюдает — и одобряет!', credits: 700,  yuan: 400 },
      ];
      const task = tasks[Math.floor(Math.random() * tasks.length)];
      await addCredits(userId, task.credits);
      await addYuan(userId, task.yuan);

      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('📦 Ежедневная награда от Партии')
        .setDescription(`**${task.text}**\n\n⭐ +${task.credits} соц. кредитов\n💴 +${task.yuan} юаней`);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'wheel_v2_0') {
      const cd = await checkCooldown(userId, 'wheelCooldown', WHEEL_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий шанс через **${formatTime(cd.waitMs)}**.`, flags: 64 });

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

      const spinning = ['🎡', '🌀', '💫', '🎯'];
      await interaction.reply({ content: `${spinning[0]} **Колесо крутится...** `, fetchReply: true });
      for (let i = 1; i < spinning.length; i++) {
        await new Promise(r => setTimeout(r, 800));
        await interaction.editReply({ content: `${spinning[i]} **Колесо крутится...** [${i}/3]` });
      }
      await new Promise(r => setTimeout(r, 800));

      if (result.credits !== 0) await addCredits(userId, result.credits);
      if (result.yuan !== 0)    await addYuan(userId, result.yuan);

      let achMsg = '';
      if (result.label.includes('ДЖЕКПОТ')) {
        const ach = await giveAchievement(userId, 'wheel_jackpot');
        if (ach) achMsg = `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      }

      const embed = new EmbedBuilder()
        .setColor(result.color)
        .setTitle(`🎡 Колесо Фортуны — ${result.label}`)
        .setDescription(
          `${result.credits > 0 ? `⭐ +${result.credits} соц. кредитов` : result.credits < 0 ? `⭐ ${result.credits} соц. кредитов` : '⭐ Без изменений'}\n` +
          `${result.yuan > 0 ? `💴 +${result.yuan} юаней` : ''}` + achMsg
        );
      return interaction.editReply({ content: '', embeds: [embed] });
    }

    if (interaction.commandName === 'exam_v2_0') {
      const now = Date.now();
      if (examCooldowns.has(userId)) {
        const exp = examCooldowns.get(userId) + EXAM_COOLDOWN_MS;
        if (now < exp) {
          const left = Math.ceil((exp - now) / 1000);
          const embed = new EmbedBuilder().setColor(0xFFCC00).setTitle('⏳ Рано для нового экзамена!')
            .setDescription(`Подожди ещё **${Math.floor(left / 60)} мин. ${left % 60} сек.**`);
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
      examCooldowns.set(userId, now);

      const q = EXAM_QUESTIONS[Math.floor(Math.random() * EXAM_QUESTIONS.length)];
      const embed = new EmbedBuilder().setColor(0xED2939).setTitle('📚 Партийный экзамен')
        .setDescription(`**Вопрос:** ${q.q}\n\n_Подсказка: ${q.hint}_\n\nУ тебя **60 секунд** — напиши ответ в чат!`);
      await interaction.reply({ embeds: [embed] });

      try {
        const filter = m => m.author.id === userId;
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
        const answer  = collected.first().content.toLowerCase().trim();
        const correct = q.answers.some(a => answer.includes(a));

        if (correct) {
          const reward = Math.floor(Math.random() * 1001) + 500;
          await addCredits(userId, reward);
          await addYuan(userId, 200);
          let streak = await getExamStreak(userId);
          streak++;
          await setExamStreak(userId, streak);
          let achMsg = '';
          if (streak >= 3) {
            const ach = await giveAchievement(userId, 'exam_ace');
            if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
            await setExamStreak(userId, 0);
          }
          const winEmbed = new EmbedBuilder().setColor(0x00FF88).setTitle('✅ Правильно! Партия одобряет!')
            .setDescription(`⭐ +${reward} соц. кредитов\n💴 +200 юаней` + achMsg);
          return interaction.followUp({ embeds: [winEmbed] });
        } else {
          await addCredits(userId, -300);
          await setExamStreak(userId, 0);
          const loseEmbed = new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Неверно! Позор!')
            .setDescription(`Правильный ответ: **${q.answers[0]}**\n⭐ -300 соц. кредитов`);
          return interaction.followUp({ embeds: [loseEmbed] });
        }
      } catch {
        const timeEmbed = new EmbedBuilder().setColor(0x888888).setTitle('⏰ Время вышло!')
          .setDescription(`Правильный ответ: **${q.answers[0]}**`);
        return interaction.followUp({ embeds: [timeEmbed] });
      }
    }

    if (interaction.commandName === 'mine') {
      const now = Date.now();

      const jailLeft   = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**.`, flags: 64 });
      const injuryLeft = await getInjuryRemaining(userId);
      if (injuryLeft > 0) return interaction.reply({ content: `🩹 Ты травмирован! До выздоровления: **${formatTime(injuryLeft)}**.`, flags: 64 });

      if (mineCooldowns.has(userId)) {
        const exp = mineCooldowns.get(userId) + MINE_COOLDOWN_MS;
        if (now < exp) {
          const left = Math.ceil((exp - now) / 1000);
          return interaction.reply({ content: `⏳ Ещё устал! Подожди **${left} сек.**`, flags: 64 });
        }
      }
      mineCooldowns.set(userId, now);

      const pickaxe = await getPickaxeData(userId);

      if (pickaxe.durability <= 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Кирка сломана!')
          .setDescription('**Критическая прочность!** Копание невозможно.\nИспользуй `/pickaxe` → **Починить**, чтобы восстановить кирку.');
        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      const { dmg, newDurability, totalHits } = await damagePickaxe(userId);

      const baseEarn = Math.floor(Math.random() * 101) + 50;
      const earn     = baseEarn * pickaxe.level;
      await addYuan(userId, earn);
      await trackShift(userId);

      const caseChance = 3 + (pickaxe.level - 1) * 2;
      let foundCase    = null;
      if (Math.random() * 100 < caseChance) {
        const caseKeys = Object.keys(CASES_DB);
        const caseWeights = { bronze: 50, iron: 30, quantum: 15, singularity: 5 };
        const totalW = Object.values(caseWeights).reduce((s, x) => s + x, 0);
        let rng = Math.random() * totalW;
        for (const key of caseKeys) {
          rng -= caseWeights[key] || 0;
          if (rng <= 0) { foundCase = key; break; }
        }
      }

      let achMsg = '';
      if (totalHits >= 100) {
        const ach = await giveAchievement(userId, 'mine_master');
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      }

      let durWarning = '';
      if (newDurability <= 10 && newDurability > 0) durWarning = '\n⚠️ **Кирка почти сломана! Почини её в `/pickaxe`!**';
      if (newDurability <= 0) durWarning = '\n❌ **Кирка сломана! Необходимо починить в `/pickaxe`!**';

      let caseMsg = '';
      if (foundCase) {
        await addHardwareItem(userId, `case_${foundCase}`, 1);
        caseMsg = `\n📦 **Найден кейс:** ${CASES_DB[foundCase].name}! (откройте в \`/case\`)`;
      }

      const embed = new EmbedBuilder()
        .setColor(newDurability <= 10 ? 0xFF4500 : 0x507d91)
        .setTitle('⛏️ Удар в шахте!')
        .setDescription(
          `Ты ударил киркой и добыл ресурсы для Партии!\n\n` +
          `💴 **+${earn} юаней** (ур. ${pickaxe.level} × ${baseEarn})\n` +
          `🔧 Прочность кирки: **${durabilityBar(Math.max(0, newDurability), pickaxe.max_durability)}**\n` +
          `_(потеряно ${dmg} ед. прочности)_` +
          durWarning + caseMsg + achMsg
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'pickaxe') {
      const pickaxe   = await getPickaxeData(userId);
      const eco       = await getEco(userId);
      const repairInfo = await repairPickaxe(userId);
      const upgradeInfo = await upgradePickaxe(userId);

      const durBar = durabilityBar(pickaxe.durability, pickaxe.max_durability);
      const statusBlock = [
        '```',
        `Уровень      : ${pickaxe.level}  (${getPickaxeName(pickaxe.level)})`,
        `Прочность    : ${durBar}`,
        `Всего ударов : ${pickaxe.total_hits}`,
        `Баланс       : ${eco.wallet} юаней`,
        '```',
      ].join('\n');

      let repairLabel, repairDesc;
      if (repairInfo.alreadyFull) {
        repairLabel = '🔧 Починить (не нужно)';
        repairDesc  = 'Прочность и так максимальная!';
      } else {
        repairLabel = `🔧 Починить (${repairInfo.cost} ¥)`;
        repairDesc  = `Восстановит ${repairInfo.lostDurability} ед. прочности за **${repairInfo.cost} юаней**`;
      }

      const upgradeLabel = `⬆️ Улучшить ур.${pickaxe.level}→${pickaxe.level + 1} (${upgradeInfo.cost} ¥)`;
      const upgradeDesc  = `Повысит базовый доход с \`/mine\` и снизит шанс травмы`;

      const embed = new EmbedBuilder()
        .setColor(pickaxe.durability <= 10 ? 0xFF4500 : 0x507d91)
        .setTitle('🔧 Состояние кирки')
        .setDescription(statusBlock + `\n**Починка:** ${repairDesc}\n**Улучшение:** ${upgradeDesc}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pickaxe_repair_${userId}`)
          .setLabel(repairLabel)
          .setStyle(repairInfo.alreadyFull ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(repairInfo.alreadyFull),
        new ButtonBuilder()
          .setCustomId(`pickaxe_upgrade_${userId}`)
          .setLabel(upgradeLabel)
          .setStyle(ButtonStyle.Success),
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'case') {
      const eco = await getEco(userId);

      const caseList = Object.values(CASES_DB).map(c => {
        const poolDesc = c.pool.map(e => {
          const meta = ITEMS_DB[e.itemId];
          const total = c.pool.reduce((s, x) => s + x.chance, 0);
          const pct = ((e.chance / total) * 100).toFixed(1);
          return `  ${pct.padStart(5)}%  ${meta?.name || e.itemId}`;
        }).join('\n');
        return { caseData: c, poolDesc };
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📦 Кейсы Партийного Оборудования')
        .setDescription(`Твой баланс: **${eco.wallet} юаней**\nНажми кнопку, чтобы открыть кейс сразу!`);

      for (const { caseData, poolDesc } of caseList) {
        embed.addFields({
          name: `${caseData.name} — ${caseData.price} ¥`,
          value: `\`\`\`\n${poolDesc}\n\`\`\``,
          inline: false,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        ...Object.values(CASES_DB).map(c =>
          new ButtonBuilder()
            .setCustomId(`case_open_${c.id}_${userId}`)
            .setLabel(`${c.emoji} ${c.name.replace(/\p{Emoji}/gu, '').trim()} (${c.price}¥)`)
            .setStyle(ButtonStyle.Primary)
        )
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'inv') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const items = await getHardwareInventory(targetUser.id);

      const table = buildInventoryTable(items);
      const totalPower = items.reduce((s, { meta, qty }) => s + meta.power * qty, 0);

      const embed = new EmbedBuilder()
        .setColor(0x507d91)
        .setTitle(`🗂️ Инвентарь: ${targetUser.username}`)
        .setDescription(table)
        .addFields({ name: '⚡ Суммарная вычислительная мощность', value: `**${totalPower}** ед.`, inline: false })
        .setFooter({ text: `Предметов типов: ${items.length} | /ah_sell item_id price — выставить на аукцион` });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ah') {
      const lots = await getActiveAuctions();
      const table = buildAuctionTable(lots);

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏪 Партийный Аукцион')
        .setDescription(table)
        .addFields({
          name: '📖 Как пользоваться',
          value: '```\n/ah_sell item_id price   — выставить предмет\n/ah_buy lot_id           — купить (ID лота 6 символов)\n/ah_cancel lot_id        — снять свой лот\n```',
          inline: false,
        })
        .setFooter({ text: `Активных лотов: ${lots.length} | Налог продавца: 2%` });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ah_sell') {
      const itemId   = interaction.options.getString('item_id').toLowerCase().trim();
      const price    = interaction.options.getInteger('price');
      const quantity = interaction.options.getInteger('quantity') || 1;

      if (price <= 0)    return interaction.reply({ content: '❌ Цена должна быть больше 0!', flags: 64 });
      if (quantity <= 0) return interaction.reply({ content: '❌ Количество должно быть больше 0!', flags: 64 });

      const meta = ITEMS_DB[itemId];
      if (!meta) return interaction.reply({ content: `❌ Предмет \`${itemId}\` не найден в базе данных! Проверь ID в \`/inv\`.`, flags: 64 });

      const player = await getPlayer(userId);
      const have   = player.hardware_inventory.get(itemId) || 0;
      if (have < quantity) return interaction.reply({ content: `❌ У тебя только **${have}** ед. **${meta.name}**!`, flags: 64 });

      const removed = await removeHardwareItem(userId, itemId, quantity);
      if (!removed) return interaction.reply({ content: '❌ Ошибка при изъятии предмета из инвентаря.', flags: 64 });

      const lot = await createAuction(userId, itemId, quantity, price);
      const tax = Math.ceil(price * 0.02);

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('📤 Лот выставлен на аукцион!')
        .setDescription([
          '```',
          `ID лота   : ${lot.lotId}`,
          `Предмет   : ${meta.name}`,
          `Кол-во    : ${quantity}`,
          `Цена      : ${price} юаней`,
          `Налог     : ${tax} юаней (2% с продавца)`,
          `Вы получите: ${price - tax} юаней при продаже`,
          '```',
          `Другие игроки могут купить командой \`/ah_buy ${lot.lotId}\``,
        ].join('\n'));
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ah_buy') {
      const lotId = interaction.options.getString('lot_id').toUpperCase().trim();
      const result = await buyAuction(lotId, userId);

      if (result.error) return interaction.reply({ content: `❌ ${result.error}`, flags: 64 });

      const meta = ITEMS_DB[result.lot.itemId];
      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Покупка совершена!')
        .setDescription([
          '```',
          `Лот       : ${lotId}`,
          `Предмет   : ${meta?.name || result.lot.itemId}`,
          `Кол-во    : ${result.lot.quantity}`,
          `Цена      : ${result.lot.price} юаней`,
          `Налог     : ${result.tax} юаней (уплачен продавцом)`,
          '```',
          `Предмет добавлен в твой инвентарь. Проверь \`/inv\`.`,
        ].join('\n'));

      const ach = await giveAchievement(userId, 'trader');
      if (ach) embed.addFields({ name: '🏅 Новое достижение', value: `${ach.name} (+${ach.reward} кредитов)` });

      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ah_cancel') {
      const lotId  = interaction.options.getString('lot_id').toUpperCase().trim();
      const result = await cancelAuction(lotId, userId);
      if (result.error) return interaction.reply({ content: `❌ ${result.error}`, flags: 64 });
      return interaction.reply({ content: `✅ Лот **${lotId}** снят с аукциона. Предмет возвращён в инвентарь.`, flags: 64 });
    }

    if (interaction.commandName === 'trade') {
      const targetUser = interaction.options.getUser('user');
      const itemId     = interaction.options.getString('item_id').toLowerCase().trim();
      const price      = interaction.options.getInteger('price');
      const quantity   = interaction.options.getInteger('quantity') || 1;

      if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя торговать с самим собой!', flags: 64 });
      if (price <= 0) return interaction.reply({ content: '❌ Цена должна быть больше 0!', flags: 64 });

      const meta   = ITEMS_DB[itemId];
      if (!meta) return interaction.reply({ content: `❌ Предмет \`${itemId}\` не найден!`, flags: 64 });

      const seller = await getPlayer(userId);
      const have   = seller.hardware_inventory.get(itemId) || 0;
      if (have < quantity) return interaction.reply({ content: `❌ У тебя только **${have}** ед. **${meta.name}**!`, flags: 64 });

      const buyerEco = await getEco(targetUser.id);
      if (buyerEco.wallet < price) {
        return interaction.reply({ content: `❌ У **${targetUser.username}** недостаточно юаней (нужно ${price}, есть ${buyerEco.wallet})!`, flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🤝 Предложение обмена')
        .setDescription([
          `**${interaction.user.username}** предлагает **${targetUser.username}**:`,
          '```',
          `Предмет : ${meta.name}`,
          `Кол-во  : ${quantity}`,
          `Цена    : ${price} юаней`,
          '```',
          `<@${targetUser.id}>, ты принимаешь сделку? (60 секунд)`,
        ].join('\n'));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${userId}_${targetUser.id}_${itemId}_${quantity}_${price}`).setLabel('✅ Принять').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_decline_${userId}_${targetUser.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger),
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      setTimeout(async () => {
        try { await msg.edit({ components: [] }); } catch { }
      }, 60000);
    }

    if (interaction.commandName === 'vote_v2_0') {
      const cd = await checkCooldown(userId, 'voteCooldown', VOTE_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий народный суд через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const targetUser = interaction.options.getUser('target');
      const reason     = interaction.options.getString('reason');
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
        await i.reply({ content: `✅ Голос учтён. Счёт: 👍 ${votes.guilty} — 👎 ${votes.innocent}`, flags: 64 });
      });

      collector.on('end', async () => {
        let resultText, color;
        if (votes.guilty > votes.innocent) {
          await addCredits(targetUser.id, -500);
          resultText = `**Виновен!** ${targetUser.username} получает **-500 соц. кредитов**!\n👍 ${votes.guilty} — 👎 ${votes.innocent}`;
          color = 0xFF0000;
        } else if (votes.innocent > votes.guilty) {
          await addCredits(targetUser.id, 200);
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

    if (interaction.commandName === 'profession_v2_0') {
      const job  = interaction.options.getString('job');
      const prof = PROFESSIONS[job];

      const jailLeft   = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**.`, flags: 64 });
      const injuryLeft = await getInjuryRemaining(userId);
      if (injuryLeft > 0) return interaction.reply({ content: `🩹 Ты травмирован! До выздоровления: **${formatTime(injuryLeft)}**.`, flags: 64 });

      const cd = await checkProfCooldown(userId, job, prof.cooldown);
      if (!cd.allowed) return interaction.reply({ content: `⏳ ${prof.name} — следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      if (job === 'spy' && Math.random() * 100 < prof.riskChance) {
        const term = await sendToJail(userId, JAIL_MIN_MS, JAIL_MAX_MS);
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🚔 Шпиона поймали!')
          .setDescription(`Провал миссии! Тебя бросили в тюрьму!\n🚔 Срок: **${formatTime(term)}**`);
        return interaction.reply({ embeds: [embed] });
      }

      if (Math.random() * 100 < prof.riskChance) {
        await addYuan(userId, -prof.riskLoss);
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle(`${prof.name} — Провал!`)
          .setDescription(`Что-то пошло не так...\n💴 -${prof.riskLoss} юаней`);
        return interaction.reply({ embeds: [embed] });
      }

      const earn = Math.floor(Math.random() * (prof.maxPay - prof.minPay + 1)) + prof.minPay;
      await addYuan(userId, earn);
      await trackShift(userId);

      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle(`${prof.name} — Смена выполнена!`)
        .setDescription(`Отличная работа!\n💴 +${earn} юаней\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'activity_v2_0') {
      const cd = await checkCooldown(userId, 'activityCooldown', ACTIVITY_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий раз через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const key    = interaction.options.getString('activity');
      const act    = ACTIVITIES[key];
      const reward = Math.floor(Math.random() * (act.max - act.min + 1)) + act.min;
      await addCredits(userId, reward);

      const embed = new EmbedBuilder().setColor(0x00BFFF).setTitle('👵 Общественная деятельность')
        .setDescription(`${act.name}\n\n⭐ +${reward} соц. кредитов\nПартия ценит твоё усердие!`);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'workerboard_v2_0') {
      const mongoose  = require('mongoose');
      const WorkerDay = mongoose.model('WorkerDay');
      const doc = await WorkerDay.findById('singleton');
      if (!doc || !doc.shifts || doc.shifts.size === 0) {
        return interaction.reply({ content: 'Сегодня ещё никто не отработал смену.', flags: 64 });
      }
      const entries   = [...doc.shifts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const timeLeft  = WORKER_DAY_MS - (Date.now() - (doc.lastReset || Date.now()));
      const lines     = entries.map(([id, c], i) => `**${i + 1}.** <@${id}> — ${c} смен`).join('\n');
      const embed     = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Лучшие работники дня')
        .setDescription(lines).setFooter({ text: `Итоги через ${formatTime(Math.max(timeLeft, 0))}` });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'achievements_v2_0') {
      const p     = await getPlayer(userId);
      const lines = Object.entries(ACHIEVEMENTS_LIST).map(([id, ach]) => {
        const done = p.achievements.includes(id);
        return `${done ? '✅' : '🔒'} **${ach.name}** — ${ach.desc} (+${ach.reward} кред.)`;
      }).join('\n');

      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle(`🏅 Достижения: ${interaction.user.username}`)
        .setDescription(lines || 'Пока нет достижений!')
        .setFooter({ text: `Получено: ${p.achievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}` });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'work_v2_0') {
      const cd = await checkCooldown(userId, 'workCooldown', WORK_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const earn = Math.floor(Math.random() * 451) + 50;
      await addYuan(userId, earn);

      const ach = await giveAchievement(userId, 'first_work');
      let achMsg = '';
      if (ach) achMsg = `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;

      const embed = new EmbedBuilder().setColor(0xED2939).setTitle('🏭 Завод Партии')
        .setDescription(`Ты отработал смену и заработал **${earn} юаней**!\n⏳ Следующая смена через **1 час**.` + achMsg);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'partyshop_v2_0') {
      const eco    = await getEco(userId);
      const pLevel = eco.items.pickaxeLevel || 1;

      const embed = new EmbedBuilder().setColor(0xED2939).setTitle('🛒 Магазин и Мастерская Партии')
        .setDescription(`Снаряжение: **${getPickaxeName(pLevel)}**\n_Новая система кирок: используй \`/pickaxe\`_`)
        .addFields(
          { name: '🐱 Кошка-жена',  value: '50 000 юаней\n`/buy_v2_0` → cat_wife',  inline: true },
          { name: '🍚 Миска риса',  value: '5 000 юаней\n`/buy_v2_0` → rice_bowl',  inline: true },
          { name: '🎟 Лотерея',     value: '1 000 юаней\n`/buy_v2_0` → ticket',     inline: true },
          { name: '⛏️ Кирка (новая система)', value: 'Используй `/pickaxe` для починки и апгрейда!\nДоход с каждым ударом = базовая сумма × уровень', inline: false },
        )
        .setFooter({ text: '/buy_v2_0 для покупок | /case для кейсов оборудования' });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'profile_v2_0') {
      const credits    = await getCredits(userId);
      const eco        = await getEco(userId);
      const rating     = getRating(credits);
      const p          = await getPlayer(userId);
      const jailLeft   = await getJailRemaining(userId);
      const injuryLeft = await getInjuryRemaining(userId);
      const pickaxe    = await getPickaxeData(userId);
      const invItems   = await getHardwareInventory(userId);
      const totalPower = invItems.reduce((s, { meta, qty }) => s + meta.power * qty, 0);

      const embed = new EmbedBuilder().setColor(rating.color)
        .setTitle(`🛂 Паспорт гражданина: ${interaction.user.username}`)
        .addFields(
          { name: '⭐ Соц. рейтинг', value: `${credits}`, inline: true },
          { name: '💴 Юани',          value: `${eco.wallet}`, inline: true },
          { name: '🏅 Достижения',    value: `${p.achievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true },
          { name: '🏷 Статус',        value: rating.label, inline: false },
          { name: '⛏️ Кирка',         value: `${getPickaxeName(pickaxe.level)} | Прочность: ${pickaxe.durability}/${pickaxe.max_durability}`, inline: false },
          { name: '⚡ Мощь железа',   value: `${totalPower} ед. (${invItems.length} типов предметов)`, inline: true },
          { name: '🐱 Кошка-жена',    value: eco.items.cat_wife ? 'Есть ✅' : 'Нет ❌', inline: true },
          { name: '🍚 Миски риса',    value: `${eco.items.rice_bowls}`, inline: true },
        );
      if (jailLeft > 0)   embed.addFields({ name: '🚔 В тюрьме',   value: `Осталось: ${formatTime(jailLeft)}`, inline: true });
      if (injuryLeft > 0) embed.addFields({ name: '🩹 На лечении', value: `Осталось: ${formatTime(injuryLeft)}`, inline: true });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'buy_v2_0') {
      const item = interaction.options.getString('item');
      const eco  = await getEco(userId);

      if (item === 'cat_wife') {
        if (eco.wallet < 50000)  return interaction.reply({ content: '❌ Нужно **50 000 юаней**.', flags: 64 });
        if (eco.items.cat_wife)  return interaction.reply({ content: '❌ У тебя уже есть кошка-жена!', flags: 64 });
        eco.wallet -= 50000; eco.items.cat_wife = true;
        await eco.save();
        const ach = await giveAchievement(userId, 'cat_owner');
        let achMsg = ach ? `\n🏅 ${ach.name} (+${ach.reward} кредитов)` : '';
        return interaction.reply({ content: `🐱 Поздравляем! Ты купил **кошку-жену**!` + achMsg });

      } else if (item === 'rice_bowl') {
        if (eco.wallet < 5000) return interaction.reply({ content: '❌ Нужно **5 000 юаней**.', flags: 64 });
        eco.wallet -= 5000; eco.items.rice_bowls += 1;
        await eco.save();
        return interaction.reply({ content: `🍚 Куплена **миска риса**! Теперь у тебя **${eco.items.rice_bowls}** мисок.` });

      } else if (item === 'ticket') {
        if (eco.wallet < 1000) return interaction.reply({ content: '❌ Нужно **1 000 юаней**.', flags: 64 });
        eco.wallet -= 1000;
        await eco.save();
        const win = Math.random();
        let result;
        if (win < 0.05)      { await addYuan(userId, 20000); result = '🎉 ДЖЕКПОТ! +20 000 юаней!'; }
        else if (win < 0.25) { await addYuan(userId, 3000);  result = '🎊 Выигрыш! +3 000 юаней!'; }
        else                 { result = '😢 Не повезло. Лотерея забрала 1 000 юаней.'; }
        const count = await incLotteryCount(userId);
        let achMsg = '';
        if (count >= 5) { const ach = await giveAchievement(userId, 'gambler'); if (ach) achMsg = `\n🏅 ${ach.name} (+${ach.reward} кредитов)`; }
        return interaction.reply({ content: `🎟 **Лотерея:** ${result}` + achMsg });

      } else if (item === 'pickaxe') {
        return interaction.reply({ content: '🔧 Система кирок обновлена! Используй команду `/pickaxe` для починки и апгрейда.', flags: 64 });
      }
    }

    if (interaction.commandName === 'steal_v2_0') {
      const targetUser = interaction.options.getUser('target');
      const amount     = interaction.options.getInteger('amount');

      if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя воровать у самого себя!', flags: 64 });
      if (amount <= 0)              return interaction.reply({ content: '❌ Укажи положительную сумму!', flags: 64 });

      const thief    = await getPlayer(userId);
      if (thief.credits < 0) return interaction.reply({ content: '❌ Враги народа не могут воровать!', flags: 64 });

      const jailLeft = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**.`, flags: 64 });

      const targetEco = await getEco(targetUser.id);
      if (targetEco.wallet < amount) return interaction.reply({ content: `❌ У цели только **${targetEco.wallet} юаней**!`, flags: 64 });

      const chance = Math.max(1, Math.floor(5000 / (amount + 150)));
      const confirmEmbed = new EmbedBuilder().setColor(0xFF4500).setTitle('⚠️ АКТ САБОТАЖА')
        .setDescription(`Цель: **${targetUser.username}**\nСумма: **${amount} юаней**\nШанс: **${chance}%**\nПровал: **-500 соц. кредитов**`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('steal_confirm').setLabel('Рискнуть').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('steal_cancel').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

      try {
        const i = await msg.awaitMessageComponent({ filter: c => c.user.id === userId, time: 30000 });
        if (i.customId === 'steal_cancel') return i.update({ content: '❌ Кража отменена.', embeds: [], components: [] });
        await i.update({ content: '🕵️ **Кто-то крадётся во тьме...**', embeds: [], components: [] });

        const SQUARES = 8;
        for (let frame = 0; frame < 5; frame++) {
          const pos = Math.floor(Math.random() * SQUARES);
          let rowStr = '';
          for (let s = 0; s < SQUARES; s++) rowStr += s === pos ? '👆' : '⬛';
          await interaction.editReply({ content: `🕵️ **Незаметное проникновение...**\n${rowStr}` });
          await new Promise(r => setTimeout(r, 2000));
        }

        const success = Math.random() * 100 < chance;
        const channel = interaction.channel;

        if (success) {
          await addYuan(targetUser.id, -amount);
          await addYuan(userId, amount);
          const ach = await giveAchievement(userId, 'thief');
          await interaction.editReply({ content: '✅ **Кража совершена...**', embeds: [], components: [] });

          const announceEmbed = new EmbedBuilder().setColor(0x2F3136).setTitle('🕵️ ОГРАБЛЕНИЕ!')
            .setDescription(`**Неизвестный** похитил **${amount} юаней** у ${targetUser.username}!\nУ вас **10 секунд**, чтобы обвинить кого-то!`);
          await channel.send({ embeds: [announceEmbed] });

          let achMsg = '';
          if (ach) achMsg = `\n🏅 ${ach.name} (+${ach.reward} кредитов)`;
          await interaction.followUp({ content: `🎰 **УСПЕХ!** Украдено **${amount} юаней** у ${targetUser.username}!` + achMsg, flags: 64 });
        } else {
          await addCredits(userId, -500);
          await interaction.editReply({ content: `🎰 **ПРОВАЛ!** Штраф: **-500 соц. кредитов**.`, embeds: [], components: [] });
          await channel.send({ content: `🚨 ${interaction.user.username} поймали на попытке кражи у ${targetUser.username}!` });
        }
      } catch {
        interaction.editReply({ content: '⏳ Время вышло. Кража отменена.', embeds: [], components: [] }).catch(() => {});
      }
    }

    if (interaction.commandName === 'socialcredit') {
      if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец!', flags: 64 });
      const targetUser = interaction.options.getUser('user');
      const amount     = interaction.options.getInteger('amount');
      const cd         = await checkCooldown(userId, 'creditCooldown', CREDIT_CMD_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Кулдаун! Подожди **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const absAmount  = Math.abs(amount);
      const limitCheck = await checkAndUseLimit(userId, absAmount);
      if (!limitCheck.allowed) return interaction.reply({ content: `❌ Лимит! Осталось: **${limitCheck.remaining}**. Сброс через **${formatTime(limitCheck.resetIn)}**.`, flags: 64 });

      const newCredits = await addCredits(targetUser.id, amount);
      const rating     = getRating(newCredits);
      const verdict    = getPartyVerdict(newCredits);
      if (newCredits >= 20000) await giveAchievement(targetUser.id, 'patriot');

      const embed = new EmbedBuilder().setColor(verdict.color).setTitle(verdict.title)
        .setDescription(`**${interaction.user.username}** ${amount > 0 ? 'наградил' : 'наказал'} **${targetUser.username}** на **${amount} баллов**.\nНовый рейтинг: **${newCredits}** (${rating.label})\n${verdict.message}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'socialstats') {
      const targetUser = interaction.options.getUser('user');
      const credits    = await getCredits(targetUser.id);
      const rating     = getRating(credits);
      const embed      = new EmbedBuilder().setColor(rating.color).setTitle(`📊 Соц. рейтинг: ${targetUser.username}`)
        .addFields(
          { name: '⭐ Рейтинг', value: `${credits} баллов`, inline: true },
          { name: '🏷 Статус',  value: rating.label, inline: true }
        );
      if (rating.legend) embed.addFields({ name: '📜 Привилегии / Наказания', value: rating.legend });
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'socialleaderboard') {
      const top = await getLeaderboard(10);
      if (top.length === 0) return interaction.reply({ content: 'Данных пока нет.', flags: 64 });
      const lines = top.map((p, i) => `**${i + 1}.** <@${p.userId}> — ${p.credits} баллов`).join('\n');
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Топ-10 граждан').setDescription(lines);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'resetall') {
      if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец!', flags: 64 });
      await resetAll();
      return interaction.reply({ content: '✅ Все данные сброшены!' });
    }

    if (interaction.commandName === 'ask_deepseek') {
      if (!DEEPSEEK_API_KEY) {
        return interaction.reply({ content: '❌ DeepSeek API ключ не настроен (`DEEPSEEK_API_KEY`).', flags: 64 });
      }
      const question = interaction.options.getString('question');
      await interaction.deferReply();
      try {
        const answer    = await askDeepSeek(question);
        const truncated = answer.length > 4000 ? answer.slice(0, 3997) + '...' : answer;
        const embed     = new EmbedBuilder().setColor(0xED2939).setTitle('🤖 Партийный советник отвечает')
          .addFields(
            { name: '❓ Вопрос', value: question, inline: false },
            { name: '📜 Ответ',  value: truncated, inline: false }
          )
          .setFooter({ text: `Гражданин ${interaction.user.username} • Powered by DeepSeek` });
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('DeepSeek ошибка:', err);
        return interaction.editReply({ content: `❌ Партийный советник недоступен: ${err.message}` });
      }
    }

  } // конец Slash Commands

  // ── BUTTON HANDLERS ──────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id.startsWith('pickaxe_repair_')) {
      const ownerId = id.split('_')[2];
      if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ Это не твоя кирка!', flags: 64 });

      const repairInfo = await repairPickaxe(ownerId);
      if (repairInfo.alreadyFull) return interaction.reply({ content: '✅ Кирка уже в полном состоянии!', flags: 64 });

      const eco = await getEco(ownerId);
      if (eco.wallet < repairInfo.cost) {
        return interaction.reply({ content: `❌ Недостаточно юаней! Нужно **${repairInfo.cost}**, у тебя **${eco.wallet}**.`, flags: 64 });
      }

      await addYuan(ownerId, -repairInfo.cost);
      await applyRepairPickaxe(ownerId);

      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle('🔧 Кирка починена!')
        .setDescription(`Прочность восстановлена до **100/${repairInfo.maxDur}**!\n💴 -${repairInfo.cost} юаней`);
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (id.startsWith('pickaxe_upgrade_')) {
      const ownerId = id.split('_')[2];
      if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ Это не твоя кирка!', flags: 64 });

      const upgradeInfo = await upgradePickaxe(ownerId);
      const eco         = await getEco(ownerId);

      if (eco.wallet < upgradeInfo.cost) {
        return interaction.reply({ content: `❌ Недостаточно юаней! Нужно **${upgradeInfo.cost}**, у тебя **${eco.wallet}**.`, flags: 64 });
      }

      await addYuan(ownerId, -upgradeInfo.cost);
      const result = await applyPickaxeUpgrade(ownerId);

      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('⬆️ Кирка улучшена!')
        .setDescription([
          `Уровень: **${upgradeInfo.currentLevel} → ${result.newLevel}**`,
          `Новое снаряжение: **${getPickaxeName(result.newLevel)}**`,
          `💴 -${upgradeInfo.cost} юаней`,
          `\nТеперь каждый удар приносит больше юаней!`,
        ].join('\n'));
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (id.startsWith('case_open_')) {
      const parts   = id.split('_');
      const caseId  = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ Это не твой список!', flags: 64 });

      const caseData = CASES_DB[caseId];
      if (!caseData) return interaction.reply({ content: '❌ Кейс не найден!', flags: 64 });

      const eco = await getEco(ownerId);
      if (eco.wallet < caseData.price) {
        return interaction.reply({ content: `❌ Недостаточно юаней! Нужно **${caseData.price}**, у тебя **${eco.wallet}**.`, flags: 64 });
      }

      await addYuan(ownerId, -caseData.price);
      const item = rollCaseItem(caseId);
      if (!item) return interaction.reply({ content: '❌ Ошибка при открытии кейса.', flags: 64 });

      await addHardwareItem(ownerId, item.id, 1);

      let achMsg = '';
      if (item.rarity === 'legendary' || item.rarity === 'secret') {
        const ach = await giveAchievement(ownerId, 'legendary_find');
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
      }

      const rarMeta = RARITY_META[item.rarity];
      const embed   = new EmbedBuilder()
        .setColor(
          item.rarity === 'secret'    ? 0xFF0000 :
          item.rarity === 'legendary' ? 0xFFD700 :
          item.rarity === 'epic'      ? 0x9400D3 :
          item.rarity === 'rare'      ? 0x0070FF : 0x888888
        )
        .setTitle(`${caseData.name} — Открытие!`)
        .setDescription([
          `💴 -${caseData.price} юаней`,
          '',
          `${rarMeta.emoji} **${rarMeta.label}** предмет:`,
          `**${item.name}**`,
          `_${item.desc}_`,
          `⚡ Вычислительная мощность: **${item.power}**`,
          '',
          `Предмет добавлен в инвентарь (\`/inv\`)` + achMsg,
        ].join('\n'));
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (id.startsWith('trade_accept_')) {
      const parts     = id.split('_');
      const sellerId  = parts[2];
      const buyerId   = parts[3];
      const itemId    = parts[4];
      const quantity  = parseInt(parts[5], 10);
      const price     = parseInt(parts[6], 10);

      if (interaction.user.id !== buyerId) return interaction.reply({ content: '❌ Это предложение не тебе!', flags: 64 });

      const meta      = ITEMS_DB[itemId];
      const buyerEco  = await getEco(buyerId);
      const seller    = await getPlayer(sellerId);

      if (buyerEco.wallet < price) {
        return interaction.reply({ content: `❌ Недостаточно юаней! Нужно **${price}**, у тебя **${buyerEco.wallet}**.`, flags: 64 });
      }

      const have = seller.hardware_inventory.get(itemId) || 0;
      if (have < quantity) {
        return interaction.reply({ content: `❌ Продавец больше не владеет этим предметом!`, flags: 64 });
      }

      await removeHardwareItem(sellerId, itemId, quantity);
      await addHardwareItem(buyerId, itemId, quantity);
      await addYuan(buyerId, -price);
      await addYuan(sellerId, price);

      await interaction.update({ components: [] });

      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle('✅ Обмен совершён!')
        .setDescription([
          `<@${sellerId}> → <@${buyerId}>`,
          `Предмет: **${meta?.name || itemId}** × ${quantity}`,
          `Цена: **${price} юаней**`,
        ].join('\n'));
      return interaction.followUp({ embeds: [embed] });
    }

    if (id.startsWith('trade_decline_')) {
      const parts    = id.split('_');
      const sellerId = parts[2];
      const buyerId  = parts[3];

      if (interaction.user.id !== buyerId && interaction.user.id !== sellerId) {
        return interaction.reply({ content: '❌ Ты не участник этой сделки!', flags: 64 });
      }

      await interaction.update({ components: [] });
      return interaction.followUp({ content: `❌ **${interaction.user.username}** отклонил сделку.` });
    }

  } // конец Button Handlers
});

// ════════════════════════════════════════════════════════════
// ЗАПУСК БОТА
// ════════════════════════════════════════════════════════════
async function main() {
  await connectDB();
  await registerCommands().catch(err => console.error('❌ Ошибка регистрации команд:', err));
  await client.login(TOKEN);
}

main().catch(err => {
  console.error('❌ Критическая ошибка запуска:', err);
  process.exit(1);
});
