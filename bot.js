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
// КОНФИГ
// ════════════════════════════════════════════════════════════
const TOKEN          = process.env.TOKEN;
const CLIENT_ID      = process.env.CLIENT_ID;
const GUILD_ID       = process.env.GUILD_ID || '1151160668892975214';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OWNER_ID       = '1528109131704176822';

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

const PROFESSIONS = {
  accountant: { name: '📊 Бухгалтер', minPay: 200, maxPay: 400,  riskChance: 2,  riskLoss: 100,  cooldown: 1800000 },
  spy:        { name: '🕵️ Шпион',     minPay: 500, maxPay: 2000, riskChance: 35, riskLoss: 1200, cooldown: 7200000 },
};

const ACTIVITIES = {
  flag:   { name: '🇨🇳 Помахать флагом Партии на площади', min: 100, max: 300 },
  clean:  { name: '🧹 Убрать двор соседа',                 min: 150, max: 350 },
  poster: { name: '📢 Расклеить агитационные плакаты',     min: 200, max: 400 },
  elder:  { name: '👵 Помочь бабушке перейти дорогу',      min: 250, max: 450 },
  song:   { name: '🎤 Спеть гимн Партии перед комитетом',  min: 300, max: 500 },
};

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
  if (!response.ok) { const err = await response.text(); throw new Error(`DeepSeek API вернул ошибку ${response.status}: ${err}`); }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '🤖 Партийный советник молчит...';
}

// ════════════════════════════════════════════════════════════
// РЕГИСТРАЦИЯ КОМАНД
// ════════════════════════════════════════════════════════════
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('socialcredit').setDescription('Добавить или забрать соц. кредиты').addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Количество').setRequired(true)),
    new SlashCommandBuilder().setName('socialstats').setDescription('Показать соц. рейтинг').addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)),
    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 граждан'),
    new SlashCommandBuilder().setName('resetall').setDescription('Сбросить все данные (только Создатель)'),
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник v2.0'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Паспорт и баланс'),
    new SlashCommandBuilder().setName('buy_v2_0').setDescription('Купить предмет').addStringOption(o => o.setName('item').setDescription('Товар').setRequired(true).addChoices({ name: '🐱 Кошка-жена', value: 'cat_wife' }, { name: '🍚 Миска риса', value: 'rice_bowl' }, { name: '🎟 Лотерея', value: 'ticket' }, { name: '⛏️ Улучшить кирку', value: 'pickaxe' })),
    new SlashCommandBuilder().setName('steal_v2_0').setDescription('Украсть юани').addUserOption(o => o.setName('target').setDescription('Цель').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Количество').setRequired(true)),
    new SlashCommandBuilder().setName('daily_v2_0').setDescription('Ежедневная награда'),
    new SlashCommandBuilder().setName('wheel_v2_0').setDescription('Колесо фортуны'),
    new SlashCommandBuilder().setName('vote_v2_0').setDescription('Суд над гражданином').addUserOption(o => o.setName('target').setDescription('Кого судить').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true)),
    new SlashCommandBuilder().setName('exam_v2_0').setDescription('Партийный экзамен'),
    new SlashCommandBuilder().setName('profession_v2_0').setDescription('Выбрать профессию').addStringOption(o => o.setName('job').setDescription('Профессия').setRequired(true).addChoices({ name: '📊 Бухгалтер', value: 'accountant' }, { name: '🕵️ Шпион', value: 'spy' })),
    new SlashCommandBuilder().setName('achievements_v2_0').setDescription('Достижения'),
    new SlashCommandBuilder().setName('activity_v2_0').setDescription('Общественная деятельность').addStringOption(o => o.setName('activity').setDescription('Активность').setRequired(true).addChoices({ name: '🇨🇳 Помахать флагом', value: 'flag' }, { name: '🧹 Убрать двор', value: 'clean' }, { name: '📢 Агитация', value: 'poster' }, { name: '👵 Помочь бабушке', value: 'elder' }, { name: '🎤 Спеть гимн', value: 'song' })),
    new SlashCommandBuilder().setName('workerboard_v2_0').setDescription('Топ работников дня'),
    new SlashCommandBuilder().setName('ask_deepseek').setDescription('Вопрос советнику').addStringOption(o => o.setName('question').setDescription('Вопрос').setRequired(true).setMaxLength(500)),
    new SlashCommandBuilder().setName('mine').setDescription('⛏️ Ударить киркой'),
    new SlashCommandBuilder().setName('pickaxe').setDescription('🔧 Состояние кирки'),
    new SlashCommandBuilder().setName('case').setDescription('📦 Кейсы оборудования'),
    new SlashCommandBuilder().setName('inv').setDescription('🗂️ Инвентарь').addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(false)),
    new SlashCommandBuilder().setName('ah').setDescription('🏪 Аукцион'),
    new SlashCommandBuilder().setName('ah_sell').setDescription('📤 Выставить на аукцион').addStringOption(o => o.setName('item_id').setDescription('ID').setRequired(true)).addIntegerOption(o => o.setName('price').setDescription('Цена').setRequired(true)).addIntegerOption(o => o.setName('quantity').setDescription('Кол-во').setRequired(false)),
    new SlashCommandBuilder().setName('ah_buy').setDescription('📥 Купить с аукциона').addStringOption(o => o.setName('lot_id').setDescription('ID лота').setRequired(true)),
    new SlashCommandBuilder().setName('ah_cancel').setDescription('❌ Снять лот').addStringOption(o => o.setName('lot_id').setDescription('ID лота').setRequired(true)),
    new SlashCommandBuilder().setName('trade').setDescription('🤝 Обмен').addUserOption(o => o.setName('user').setDescription('Покупатель').setRequired(true)).addStringOption(o => o.setName('item_id').setDescription('ID предмета').setRequired(true)).addIntegerOption(o => o.setName('price').setDescription('Цена').setRequired(true)).addIntegerOption(o => o.setName('quantity').setDescription('Кол-во').setRequired(false)),
    new SlashCommandBuilder().setName('applyupgrade').setDescription('Установить улучшение').addStringOption(o => o.setName('upgrade').setDescription('ID улучшения').setRequired(true)),
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
  setInterval(() => checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(console.error), 15 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  const userId = interaction.user?.id || interaction.member?.user?.id;

  if (interaction.isChatInputCommand()) {
    // --- ВСЕ ТВОИ КОМАНДЫ (help, daily, mine и т.д.) ---
    // (Оставил всё как было)
    if (interaction.commandName === 'help_v2_0') { /* ... */ }
    
    // ... [ЗДЕСЬ ВСЕ ТВОИ ОСТАЛЬНЫЕ КОМАНДЫ] ...

    // ДОБАВЛЕННЫЙ БЛОК /applyupgrade
    if (interaction.commandName === 'applyupgrade') {
        const upgradeId = interaction.options.getString('upgrade');
        try {
            // Используем функцию из импортов. Если нужно, замени на кастомную логику.
            const result = await applyPickaxeUpgrade(userId, upgradeId); 
            return interaction.reply({ content: `✅ Улучшение **${upgradeId}** применено!`, flags: 64 });
        } catch (err) {
            return interaction.reply({ content: `❌ Ошибка: ${err.message}`, flags: 64 });
        }
    }
    
    // ... [КОНЕЦ ВСЕХ КОМАНД] ...
  }

  // --- ОБРАБОТЧИКИ КНОПОК ---
  // ... [ВСЕ ТВОИ ОБРАБОТЧИКИ (pickaxe, case_open_ и т.д.)] ...
});

async function main() {
  await connectDB();
  await registerCommands().catch(err => console.error('❌ Ошибка регистрации:', err));
  await client.login(TOKEN);
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});
