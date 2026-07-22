'use strict';
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const http = require('http');
const https = require('https');

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
// КОНФИГУРАЦИЯ И СТАТУСЫ
// ════════════════════════════════════════════════════════════
const TOKEN          = process.env.TOKEN;
const CLIENT_ID      = process.env.CLIENT_ID;
const GUILD_ID       = process.env.GUILD_ID || '1151160668892975214';
const OWNER_ID       = '1528109131704176822';

// Флаги тихого режима
const SILENT_FLAG      = MessageFlags.SuppressNotifications;
const EPHEMERAL_SILENT = MessageFlags.Ephemeral | MessageFlags.SuppressNotifications;

// Хранилище активных званий пользователей (userId -> Title Name)
const equippedTitles = new Map();

// ── Три ключа для AI API ────────────────────────────────────
const QWEN_API_KEYS = [
  process.env.QWEN_API_KEY_1 || process.env.QWEN_API_KEY,
  process.env.QWEN_API_KEY_2,
  process.env.QWEN_API_KEY_3,
].filter(Boolean);

const AI_MODELS = [
  { name: 'Qwen2.5-7B (быстрая, по умолчанию)',     value: 'Qwen/Qwen2.5-7B-Instruct-Turbo'           },
  { name: 'DeepSeek-R1-Distill-Qwen-7B (легкая R1)', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'  },
  { name: 'DeepSeek-R1-Distill-Llama-8B (легкая R1)',value: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B' },
];
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct-Turbo';

const LIMIT_PER_30MIN          = 10000;
const CREDIT_CMD_COOLDOWN_MS   = 30 * 1000;
const WORK_COOLDOWN_MS         = 60 * 60 * 1000;
const DAILY_COOLDOWN_MS        = 24 * 60 * 60 * 1000;
const WHEEL_COOLDOWN_MS        = 24 * 60 * 60 * 1000;
const EXAM_COOLDOWN_MS         = 5 * 60 * 1000;
const VOTE_COOLDOWN_MS         = 60 * 60 * 1000;
const ACTIVITY_COOLDOWN_MS     = 60 * 60 * 1000;
const INJURY_MS                = 60 * 60 * 1000;
const JAIL_MIN_MS              = 30 * 60 * 1000;
const JAIL_MAX_MS              = 2 * 60 * 60 * 1000;
const WORKER_DAY_MS            = 24 * 60 * 60 * 1000;
const WORKER_OF_DAY_BONUS_CREDITS = 2000;
const WORKER_OF_DAY_BONUS_YUAN    = 1000;
const MINE_COOLDOWN_MS         = 5 * 1000;

// Keep-alive
http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

// ════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ════════════════════════════════════════════════════════════
function getDisplayName(user, customUsername) {
  const uId = user?.id || user;
  const name = customUsername || user?.username || 'Гражданин';
  const title = equippedTitles.get(uId);
  return title ? `${name} [ ${title} ]` : name;
}

function getRating(credits) {
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700, legend: '🐱 получить **кошка-жена**\n🍚 получить **миска рис**' };
  if (credits >= 10000) return { label: '⭐ Отличник',             color: 0x00FF88, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный',           color: 0x00BFFF, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением',      color: 0xFFA500, legend: null };
  return                       { label: '💀 Враг народа',          color: 0xFF0000, legend: '🐱 **забрать кошка-жена**' };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) return { title: '🏆 Образцовый гражданин', message: 'Партия гордится тобой!',    color: 0xFFD700 };
  if (credits > 100)    return { title: '🎉 Партия гордится тобой!', message: 'Продолжай служить Партии!', color: 0x00FF88 };
  if (credits >= 0)     return { title: '👍 Хорошо, но можно лучше', message: 'Партия ждет большего!',    color: 0x00BFFF };
  return                       { title: '😤 Ай ай ай! Позор!',       message: 'Исправляйся немедленно!', color: 0xFF0000 };
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
  if (items.length === 0) return '```\n  Гардероб званий пуст\n```';
  const COL_ID = 14, COL_NAME = 26, COL_QTY = 5, COL_RAR = 12;
  const pad = (str, n) => String(str).padEnd(n).slice(0, n);
  const header  = `${pad('ID', COL_ID)} ${pad('Звание', COL_NAME)} ${pad('Кол-во', COL_QTY)} ${pad('Редкость', COL_RAR)}`;
  const divider = '─'.repeat(header.length);
  const rows    = items.map(({ itemId, qty, meta }) =>
    `${pad(itemId, COL_ID)} ${pad(meta.name.replace(/\p{Emoji}/gu, ''), COL_NAME)} ${pad(qty, COL_QTY)} ${pad(RARITY_META[meta.rarity]?.label || meta.rarity, COL_RAR)}`
  );
  return `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;
}

function buildAuctionTable(lots) {
  if (lots.length === 0) return '```\n  Активных лотов нет\n```';
  const COL_ID = 8, COL_ITEM = 24, COL_QTY = 5, COL_PRICE = 10;
  const pad = (str, n) => String(str).padEnd(n).slice(0, n);
  const header  = `${pad('Лот', COL_ID)} ${pad('Звание', COL_ITEM)} ${pad('Кол-во', COL_QTY)} ${pad('Цена (¥)', COL_PRICE)}`;
  const divider = '─'.repeat(header.length);
  const rows    = lots.map(lot => {
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
  clean:  { name: '🧹 Убрать двор соседа',               min: 150, max: 350 },
  poster: { name: '📢 Расклеить агитационные плакаты',     min: 200, max: 400 },
  elder:  { name: '👵 Помочь бабушке перейти дорогу',      min: 250, max: 450 },
  song:   { name: '🎤 Споть гимн Партии',                 min: 300, max: 500 },
};

// ── Партийные экзамены ───────────────────────────────────────
const EXAM_QUESTIONS = [
  { q: 'Кто основал Коммунистическую партию Китая?',        answers: ['мао', 'мао цзэдун'],                                     hint: 'Великий Кормчий...' },
  { q: 'Сколько звезд на флаге Китая?',                     answers: ['5', 'пять'],                                             hint: 'Считай внимательно...' },
  { q: 'Как называется столица Китая?',                     answers: ['пекин', 'beijing'],                                      hint: 'Это не Шанхай...' },
  { q: 'Как переводится слово "юань"?',                     answers: ['круглый', 'круг'],                                       hint: 'Думай о форме монеты...' },
  { q: 'Сколько людей живет в Китае? (приблизительно, в млрд)', answers: ['1.4', '1,4', '1.4 миллиарда'],                       hint: 'Больше миллиарда...' },
  { q: 'Как называется великая стена в Китае?',             answers: ['великая китайская стена', 'китайская стена'],            hint: 'Она очень длинная...' },
];

// ════════════════════════════════════════════════════════════
// AI API
// ════════════════════════════════════════════════════════════
async function askAI(prompt, model = DEFAULT_MODEL) {
  if (QWEN_API_KEYS.length === 0) {
    throw new Error('🔑 **Ни один API ключ не настроен!**');
  }

  const errors = [];
  for (let i = 0; i < QWEN_API_KEYS.length; i++) {
    const key = QWEN_API_KEYS[i];
    try {
      const response = await fetch('https://router.huggingface.co/together/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Ты — партийный советник Великой Партии. Отвечай на русском языке с пафосом и юмором.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        errors.push(`Ключ #${i + 1}: Ошибка ${response.status}`);
        continue;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return { text: content, keyIndex: i + 1 };
    } catch (err) {
      errors.push(`Ключ #${i + 1}: ${err.message}`);
    }
  }
  throw new Error(`🤖 **Советник недоступен!**\n${errors.join('\n')}`);
}

// ════════════════════════════════════════════════════════════
// РЕГИСТРАЦИЯ КОМАНД
// ════════════════════════════════════════════════════════════
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('socialcredit').setDescription('Добавить или забрать соц. кредиты у пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Количество').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialstats').setDescription('Показать соц. рейтинг пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)),

    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 граждан по соц. рейтингу'),
    new SlashCommandBuilder().setName('resetall').setDescription('Сбросить все данные (Только Владелец)'),
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник по экономике Партии v2.0'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе и получить юани'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Посмотреть свой паспорт и баланс'),

    new SlashCommandBuilder()
      .setName('buy_v2_0').setDescription('Купить предмет в магазине')
      .addStringOption(o => o.setName('item').setDescription('Товар').setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50 000 юаней)', value: 'cat_wife'  },
          { name: '🍚 Миска рис (5 000 юаней)',    value: 'rice_bowl' },
          { name: '🎟 Лотерея (1 000 юаней)',       value: 'ticket'    }
        )),

    new SlashCommandBuilder()
      .setName('steal_v2_0').setDescription('Украсть юани у гражданина')
      .addUserOption(o => o.setName('target').setDescription('Цель').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Сколько украсть').setRequired(true)),

    new SlashCommandBuilder().setName('daily_v2_0').setDescription('Получить ежедневную награду'),
    new SlashCommandBuilder().setName('wheel_v2_0').setDescription('Покрутить колесо фортуны'),

    new SlashCommandBuilder()
      .setName('vote_v2_0').setDescription('Устроить суд над гражданином')
      .addUserOption(o => o.setName('target').setDescription('Кого судить').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true)),

    new SlashCommandBuilder().setName('exam_v2_0').setDescription('Сдать партийный экзамен'),

    new SlashCommandBuilder()
      .setName('profession_v2_0').setDescription('Работать по специальности')
      .addStringOption(o => o.setName('job').setDescription('Профессия').setRequired(true)
        .addChoices(
          { name: '📊 Бухгалтер — стабильный доход',     value: 'accountant' },
          { name: '🕵️ Шпион — высокий риск и доход', value: 'spy' }
        )),

    new SlashCommandBuilder().setName('achievements_v2_0').setDescription('Посмотреть свои достижения'),

    new SlashCommandBuilder()
      .setName('activity_v2_0').setDescription('Общественная деятельность')
      .addStringOption(o => o.setName('activity').setDescription('Деятельность').setRequired(true)
        .addChoices(
          { name: '🇨🇳 Помахать флагом Партии', value: 'flag'   },
          { name: '🧹 Убрать двор соседа',       value: 'clean'  },
          { name: '📢 Расклеить плакаты',       value: 'poster' },
          { name: '👵 Помочь бабушке',           value: 'elder'  },
          { name: '🎤 Споть гимн',             value: 'song'   }
        )),

    new SlashCommandBuilder().setName('workerboard_v2_0').setDescription('Топ работников дня'),

    new SlashCommandBuilder()
      .setName('ask_ai')
      .setDescription('🤖 Задать вопрос Партийному советнику (AI)')
      .addStringOption(o => o.setName('question').setDescription('Твой вопрос').setRequired(true).setMaxLength(500))
      .addStringOption(o => o.setName('model').setDescription('Модель AI').setRequired(false).setAutocomplete(true)),

    new SlashCommandBuilder().setName('mine').setDescription('⛏️ Удар киркой в Шахте (кд 5 сек)'),
    new SlashCommandBuilder().setName('pickaxe').setDescription('🔧 Состояние кирки: чинить или улучшать'),
    new SlashCommandBuilder().setName('case').setDescription('📦 Кейсы Партийных Званий — шансы и открытие'),

    new SlashCommandBuilder().setName('inv').setDescription('🗂️ Ваш гардероб имеющихся званий')
      .addUserOption(o => o.setName('user').setDescription('Другой пользователь').setRequired(false)),

    new SlashCommandBuilder().setName('ah').setDescription('🏪 Публичный аукцион званий'),

    new SlashCommandBuilder().setName('ah_sell').setDescription('📤 Выставить звание на аукцион')
      .addStringOption(o => o.setName('item_id').setDescription('ID звания (из /inv)').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Цена в юанях').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Количество').setRequired(false)),

    new SlashCommandBuilder().setName('ah_buy').setDescription('📥 Купить звание с аукциона')
      .addStringOption(o => o.setName('lot_id').setDescription('ID лота').setRequired(true)),

    new SlashCommandBuilder().setName('ah_cancel').setDescription('❌ Снять свой лот с аукциона')
      .addStringOption(o => o.setName('lot_id').setDescription('ID лота').setRequired(true)),

    new SlashCommandBuilder().setName('trade').setDescription('🤝 Прямой обмен званием с игроком')
      .addUserOption(o => o.setName('user').setDescription('Покупатель').setRequired(true))
      .addStringOption(o => o.setName('item_id').setDescription('ID звания из вашего инвентаря').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Цена в юанях').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Количество').setRequired(false)),

    new SlashCommandBuilder()
      .setName('to_gif')
      .setDescription('🎞️ Превратить изображение в GIF')
      .addAttachmentOption(o => o.setName('image').setDescription('Изображение').setRequired(true)),

  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); } catch { }
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Команды успешно зарегистрированы!');
}

// ════════════════════════════════════════════════════════════
// КЛИЕНТ
// ════════════════════════════════════════════════════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const mineCooldowns = new Map();

client.on('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
  checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(console.error);
  setInterval(
    () => checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(console.error),
    15 * 60 * 1000
  );
});

// ════════════════════════════════════════════════════════════
// ОБРАБОТКА ВЗАИМОДЕЙСТВИЙ
// ════════════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {

  // Autocomplete для /ask_ai
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'ask_ai') {
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = AI_MODELS.filter(m =>
        m.name.toLowerCase().includes(focused) || m.value.toLowerCase().includes(focused)
      ).slice(0, 25);
      return interaction.respond(filtered.map(m => ({ name: m.name, value: m.value })));
    }
    return;
  }

  // Обработчик выбора звания в /inv
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('select_title_')) {
      const ownerId = interaction.customId.split('_')[2];
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: '❌ Это не ваш гардероб!', flags: EPHEMERAL_SILENT });
      }

      const selectedValue = interaction.values[0];
      if (selectedValue === 'none') {
        equippedTitles.delete(ownerId);
        return interaction.reply({ content: '✅ Активное звание снято!', flags: EPHEMERAL_SILENT });
      }

      const meta = ITEMS_DB[selectedValue];
      const titleName = meta ? meta.name : selectedValue;
      equippedTitles.set(ownerId, titleName);

      const nameWithTitle = getDisplayName(interaction.user);
      return interaction.reply({
        content: `👑 Вы успешно надели звание: **${titleName}**!\nТеперь ваше имя: **${nameWithTitle}**`,
        flags: EPHEMERAL_SILENT
      });
    }
    return;
  }

  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  const userId = interaction.user?.id || interaction.member?.user?.id;

  // ════════════════════════════════════════════════════════
  // SLASH COMMANDS
  // ════════════════════════════════════════════════════════
  if (interaction.isChatInputCommand()) {

    // ── /help_v2_0 ──────────────────────────────────────────
    if (interaction.commandName === 'help_v2_0') {
      const mineSection = [
        '```',
        '⛏️  ШАХТА И ЗВАНИЯ',
        '────────────────────────────────────',
        '/mine          Удар киркой (кд: 5 сек)',
        '/pickaxe       Состояние кирки',
        '/case          Кейсы званий (шансы / открытие)',
        '/inv           Гардероб званий (выбор и надевание)',
        '',
        '🏪  ТОРГОВЛЯ ЗВАНИЯМИ',
        '────────────────────────────────────',
        '/ah            Список лотов аукциона',
        '/ah_sell       Выставить звание на продажу',
        '/ah_buy        Купить звание по ID',
        '/ah_cancel     Снять свой лот',
        '/trade         Прямой обмен званием (громкое)',
        '
