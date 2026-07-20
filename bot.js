const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  Collection,
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  connectDB, ACHIEVEMENTS_LIST,
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
  getPlayer,
} = require('./database');

// ========================================================
const TOKEN     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID  = process.env.GUILD_ID  || '1151160668892975214';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; 

const DEFAULT_CREDITS = 10000;
const OWNER_ID = '1528109131704176822';

const LIMIT_PER_30MIN       = 10000;
const COOLDOWN_MS           = 30 * 60 * 1000;
const CREDIT_CMD_COOLDOWN_MS = 30 * 1000;
const WORK_COOLDOWN_MS      = 60 * 60 * 1000;
const DAILY_COOLDOWN_MS     = 24 * 60 * 60 * 1000;
const WHEEL_COOLDOWN_MS     = 24 * 60 * 60 * 1000;
const EXAM_COOLDOWN_MS      = 60 * 60 * 1000;
const VOTE_COOLDOWN_MS      = 60 * 60 * 1000;
const ACTIVITY_COOLDOWN_MS  = 60 * 60 * 1000;
const INJURY_MS             = 60 * 60 * 1000;
const JAIL_MIN_MS           = 30 * 60 * 1000;
const JAIL_MAX_MS           = 2 * 60 * 60 * 1000;
const WORKER_DAY_MS         = 24 * 60 * 60 * 1000;
const WORKER_OF_DAY_BONUS_CREDITS = 2000;
const WORKER_OF_DAY_BONUS_YUAN    = 1000;
// ========================================================

// Keep-alive сервер для Render
http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

// Инициализация Discord клиента
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ── Функция загрузки команд из папки commands ───────────────
function loadCommandFiles() {
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      if (command && 'data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Загружен файл команды из папки commands: /${command.data.name}`);
      } else {
        console.warn(`⚠️ В файле ${file} отсутствует "data" или "execute".`);
      }
    }
  }
}

// ── Вспомогательные функции ──────────────────────────────────
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

// Названия кирок в зависимости от уровня
function getPickaxeName(level) {
  if (level === 1) return '🪨 Деревянная кирка';
  if (level === 2) return '🛠️ Каменная кирка';
  if (level === 3) return '⛓️ Железная кирка';
  if (level === 4) return '🥇 Золотая кирка';
  if (level >= 5)  return `💎 Алмазная кирка (+${level})`;
  return 'Кирка';
}

// ── Профессии ──────────────────────────────────────────────
const PROFESSIONS = {
  accountant: { name: '📊 Бухгалтер', minPay: 200, maxPay: 400,  riskChance: 2,  riskLoss: 100,  cooldown: 1800000 },
  spy:        { name: '🕵️ Шпион',     minPay: 500, maxPay: 2000, riskChance: 35, riskLoss: 1200, cooldown: 7200000 },
};

// ── Предметы партийной шахты ──────────────────────────────────
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
  for (const item of MINE_ITEMS) { rand -= item.chance; if (rand <= 0) return item; }
  return MINE_ITEMS[0];
}

// ── Активности ───────────────────────────────────────────────
const ACTIVITIES = {
  flag:   { name: '🇨🇳 Помахать флагом Партии на площади',    min: 100, max: 300 },
  clean:  { name: '🧹 Убрать двор соседа',                    min: 150, max: 350 },
  poster: { name: '📢 Расклеить агитационные плакаты',        min: 200, max: 400 },
  elder:  { name: '👵 Помочь бабушке перейти дорогу',         min: 250, max: 450 },
  song:   { name: '🎤 Спеть гимн Партии перед комитетом',     min: 300, max: 500 },
};

// ── Партийные экзамены ───────────────────────────────────────
const EXAM_QUESTIONS = [
  { q: 'Кто основал Коммунистическую партию Китая?',          answers: ['мао', 'мао цзэдун', 'мао цзедун'],           hint: 'Великий Кормчий...' },
  { q: 'Сколько звёзд на флаге Китая?',                       answers: ['5', 'пять'],                                 hint: 'Считай внимательно...' },
  { q: 'Как называется столица Китая?',                        answers: ['пекин', 'beijing'],                          hint: 'Это не Шанхай...' },
  { q: 'Как переводится слово "юань"?',                        answers: ['круглый', 'круг', 'округлый'],               hint: 'Думай о форме монеты...' },
  { q: 'Сколько человек живёт в Китае? (примерно, в млрд)',    answers: ['1.4', '1,4', '1.4 миллиарда', 'полтора'],   hint: 'Больше миллиарда...' },
  { q: 'Как называется великая стена в Китае?',                answers: ['великая китайская стена', 'китайская стена', 'великая стена'], hint: 'Она очень длинная...' },
  { q: 'Назови любой китайский праздник',                      answers: ['новый год', 'китайский новый год', 'праздник весны', 'день труда', 'день республики', 'день победы'], hint: 'Их много...' },
  { q: 'Какое животное символизирует 2024 год по кит. кал.?', answers: ['дракон', 'ракон'],                           hint: 'Оно огнедышащее...' },
];

// ── DeepSeek API ─────────────────────────────────────────────
async function askDeepSeek(prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Ты — партийный советник Великой Партии. Отвечай с пафосом, патетикой и в духе socialistic риторики. Иногда хвали Партию. Будь немного абсурдным и шуточным. Отвечай на том языке, на котором к тебе обращаются.',
        },
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

// ── Регистрация команд ───────────────────────────────────────
async function registerCommands() {
  loadCommandFiles();

  const builtInCommands = [
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

    new SlashCommandBuilder().setName('help_v2_0').setDescription('Справочник по экономике Партии'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Работать на заводе и получить юани'),
    new SlashCommandBuilder().setName('mine').setDescription('⛏️ Отправиться в забой на Партийную Шахту'),
    new SlashCommandBuilder().setName('case').setDescription('📦 Открыть секретный Партийный Кейс'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Посмотреть свой паспорт и баланс юаней'),

    new SlashCommandBuilder()
      .setName('buy_v2_0')
      .setDescription('Купить предмет или улучшить кирку в магазине Партии')
      .addStringOption(opt => opt
        .setName('item')
        .setDescription('Выберите товар')
        .setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50 000 юаней)',  value: 'cat_wife'  },
          { name: '🍚 Миска риса (5 000 юаней)',    value: 'rice_bowl' },
          { name: '🎟 Лотерея (1 000 юаней)',       value: 'ticket'    },
          { name: '⛏️ Улучшить кирку (Уровень * 5 000 юаней)', value: 'pickaxe' }
        )),

    new SlashCommandBuilder()
      .setName('steal_v2_0')
      .setDescription('Украсть юани у гражданина (штраф -500 соц. кредитов при провале)')
      .addUserOption(opt => opt.setName('target').setDescription('Цель кражи').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Сколько юаней украсть').setRequired(true)),

    new SlashCommandBuilder().setName('daily_v2_0').setDescription('Получить ежедневную награду от Партии'),
    new SlashCommandBuilder().setName('wheel_v2_0').setDescription('Покрутить колесо фортуны (раз в сутки)'),

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
          { name: '📊 Бухгалтер — стабильный доход, низкий риск', value: 'accountant' },
          { name: '🕵️ Шпион — огромный доход, огромный риск',    value: 'spy'        }
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
          { name: '🇨🇳 Помахать флагом Партии на площади', value: 'flag'   },
          { name: '🧹 Убрать двор соседа',                 value: 'clean'  },
          { name: '📢 Расклеить агитационные плакаты',     value: 'poster' },
          { name: '👵 Помочь бабушке перейти дорогу',      value: 'elder'  },
          { name: '🎤 Спеть гимн Партии перед комитетом',  value: 'song'   }
        )),

    new SlashCommandBuilder().setName('workerboard_v2_0').setDescription('Топ работников дня'),

    new SlashCommandBuilder()
      .setName('ask_deepseek')
      .setDescription('Задать вопрос Партийному советнику (AI DeepSeek)')
      .addStringOption(opt => opt
        .setName('question')
        .setDescription('Твой вопрос к Партии')
        .setRequired(true)
        .setMaxLength(500)),
  ].map(cmd => cmd.toJSON());

  // Автоматически добавляем все файлы из client.commands к регистрации
  const fileCommands = [];
  for (const command of client.commands.values()) {
    if (command.data) {
      fileCommands.push(command.data.toJSON());
    }
  }

  const allCommands = [...builtInCommands, ...fileCommands];

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  } catch (e) {
    console.error('⚠️ Не удалось очистить глобальные команды:', e.message);
  }
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: allCommands });
  console.log('✅ Команды зарегистрированы!');
}

const examCooldowns = new Map();
const mineCooldowns = new Map();

client.on('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
  checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(e => console.error(e));
  setInterval(
    () => checkWorkerOfDayReset(client, GUILD_ID, WORKER_DAY_MS, WORKER_OF_DAY_BONUS_CREDITS, WORKER_OF_DAY_BONUS_YUAN).catch(e => console.error(e)),
    15 * 60 * 1000
  );
});

// ── Главный обработчик взаимодействия (Slash Commands) ─────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  console.log(`👉 Вызвана команда: /${interaction.commandName} пользователем ${interaction.user.tag}`);

  // 1. Проверяем, есть ли команда в отдельном файле из папки commands
  const externalCommand = client.commands.get(interaction.commandName);
  if (externalCommand) {
    try {
      await externalCommand.execute(interaction);
      return;
    } catch (error) {
      console.error(`❌ ОШИБКА в файле команды /${interaction.commandName}:`, error);
      const errorPayload = { content: 'Произошла ошибка при выполнении команды!', flags: 64 };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorPayload).catch(() => {});
      } else {
        await interaction.reply(errorPayload).catch(() => {});
      }
      return;
    }
  }

  // 2. Выполнение старых команд, написанных прямо в bot.js
  try {
    // ── /help_v2_0 ──────────────────────────────────────────
    if (interaction.commandName === 'help_v2_0') {
      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('📕 Справочник Партии v2.0')
        .addFields(
          { name: '💰 Заработок',      value: '`/work_v2_0` — завод (раз в час)\n`/mine` — партийная шахта (раз в 30 мин)\n`/profession_v2_0` — работа по специальности\n`/daily_v2_0` — ежедневная награда\n`/activity_v2_0` — общественная деятельность (раз в час)', inline: false },
          { name: '🎮 Развлечения',    value: '`/wheel_v2_0` — колесо фортуны\n`/exam_v2_0` — партийный экзамен\n`/case` — партийный кейс\n`/vote_v2_0` — narodny суд', inline: false },
          { name: '🛒 Магазин',        value: '`/partyshop_v2_0` — товары и кирки\n`/buy_v2_0` — купить / улучшить', inline: false },
          { name: '🥷 Риск',           value: '`/steal_v2_0` — украсть юани', inline: false },
          { name: '👤 Профиль',        value: '`/profile_v2_0` — паспорт\n`/achievements_v2_0` — достижения\n`/workerboard_v2_0` — топ работников дня', inline: false },
          { name: '🤖 AI Советник',    value: '`/ask_deepseek` — задать вопрос Партийному советнику (DeepSeek AI)', inline: false },
        );
      await interaction.reply({ embeds: [embed] });
    }

    // ── /daily_v2_0 ─────────────────────────────────────────
    else if (interaction.commandName === 'daily_v2_0') {
      const cd = await checkCooldown(userId, 'dailyCooldown', DAILY_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Ты уже получил сегодняшнюю награду! Следующая через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const tasks = [
        { text: 'Партия благодарит за верность!',   credits: 500,  yuan: 200 },
        { text: 'Ты примерный гражданин!',           credits: 300,  yuan: 500 },
        { text: 'Партия отметила твой вклад!',       credits: 1000, yuan: 100 },
        { text: 'Ежедневный паёк выдан!',            credits: 200,  yuan: 300 },
        { text: 'Партия наблюдает — и одобряет!',    credits: 700,  yuan: 400 },
      ];
      const task = tasks[Math.floor(Math.random() * tasks.length)];
      await addCredits(userId, task.credits);
      await addYuan(userId, task.yuan);

      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('📦 Ежедневная награда от Партии')
        .setDescription(`**${task.text}**\n\n⭐ +${task.credits} соц. кредитов\n💴 +${task.yuan} юаней`);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /wheel_v2_0 ─────────────────────────────────────────
    else if (interaction.commandName === 'wheel_v2_0') {
      const cd = await checkCooldown(userId, 'wheelCooldown', WHEEL_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Колесо ещё крутится! Следующий шанс через **${formatTime(cd.waitMs)}**.`, flags: 64 });

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
      await interaction.reply({ content: `${spinning[0]} **Колесо крутится...**`, fetchReply: true });
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
      await interaction.editReply({ content: '', embeds: [embed] });
    }

    // ── /exam_v2_0 ──────────────────────────────────────────
    else if (interaction.commandName === 'exam_v2_0') {
      const cooldownTime = 5 * 60 * 1000; 
      const now = Date.now();
      
      if (examCooldowns.has(userId)) {
        const expirationTime = examCooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
          const timeLeft = Math.ceil((expirationTime - now) / 1000); 
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          const cooldownEmbed = new EmbedBuilder()
            .setColor(0xFFCC00)
            .setTitle('⏳ Рано для нового экзамена!')
            .setDescription(`Партия требует времени на подготовку вопросов. Подожди ещё **${minutes} мин. ${seconds} сек.** перед следующей попыткой.`);
          return await interaction.reply({ embeds: [cooldownEmbed], flags: 64 });
        }
      }

      examCooldowns.set(userId, now);

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

          const winEmbed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✅ Правильно! Партия одобряет!')
            .setDescription(`Ответ принят!\n⭐ +${reward} соц. кредитов\n💴 +200 юаней` + achMsg);
          await interaction.followUp({ embeds: [winEmbed] });
        } else {
          await addCredits(userId, -300);
          await setExamStreak(userId, 0);
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

    // ── /mine (Партийная Шахта) ─────────────────────────────
    else if (interaction.commandName === 'mine') {
      const cooldownTime = 30 * 60 * 1000; 
      const now = Date.now();

      const jailLeft = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**. Работать нельзя.`, flags: 64 });

      const injuryLeft = await getInjuryRemaining(userId);
      if (injuryLeft > 0) return interaction.reply({ content: `🩹 Ты травмирован! До выздоровления: **${formatTime(injuryLeft)}**. Работать нельзя.`, flags: 64 });

      if (mineCooldowns.has(userId)) {
        const expirationTime = mineCooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
          const timeLeft = Math.ceil((expirationTime - now) / 1000);
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          const cdEmbed = new EmbedBuilder()
            .setColor(0xFFCC00)
            .setTitle('⏳ Спина болит!')
            .setDescription(`Ты совсем недавно работал на благо Партии. Отдохни ещё **${minutes} мин. ${seconds} сек.** перед новой сменой.`);
          return await interaction.reply({ embeds: [cdEmbed], flags: 64 });
        }
      }

      mineCooldowns.set(userId, now);

      const eco = await getEco(userId);
      const pLevel = eco.items.pickaxeLevel || 1;

      const item = rollMineItem();
      
      let earn = Math.floor(Math.random() * (item.yuanMax - item.yuanMin + 1)) + item.yuanMin;
      const bonusYuan = (pLevel - 1) * 150;
      earn += bonusYuan;

      if (item.id === 'diamond') {
        await addCredits(userId, 5000);
        await addYuan(userId, earn);
        await cureInjury(userId);
        await trackShift(userId);
        const embed = new EmbedBuilder()
          .setColor(0xFF00FF)
          .setTitle('💎 ДЖЕКПОТ ШАХТЫ — Алмаз!')
          .setDescription(`<@${userId}> добыл чудо Партии, используя **${getPickaxeName(pLevel)}**!\n💎 **Находка:** ${item.name}\n💴 +${earn} юаней ${bonusYuan > 0 ? `(_включая бонус кирок: +${bonusYuan}_)` : ''}\n⭐ +5000 соц. кредитов\n🩹 Все прошлые травмы мгновенно залечены!`);
        return interaction.reply({ embeds: [embed] });
      }

      await addYuan(userId, earn);
      await trackShift(userId);

      const reducedInjuryChance = Math.max(0, item.injuryChance - (pLevel - 1) * 5);

      if (reducedInjuryChance > 0 && Math.random() * 100 < reducedInjuryChance) {
        await setInjury(userId, INJURY_MS);
        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle(`⛏️ Шахтёр — ${item.name} (Травма кровью)`)
          .setDescription(`<@${userId}> махал киркой и добыл ${item.name}, но обвалился потолок!\n💴 +${earn} юаней\n🩹 Отправлен в медпункт на: **${formatTime(INJURY_MS)}**\n_Подсказка: Улучшай кирку, чтобы снизить шанс обвала!_`);
        return interaction.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x507d91)
        .setTitle('⛏️ Результаты выработки на Шахте')
        .setDescription(`<@${userId}> усердно трудился в забое с помощью **${getPickaxeName(pLevel)}**!\n📦 **Ресурс:** ${item.name}\n💴 +${earn} юаней ${bonusYuan > 0 ? `(_Бонус кирок: +${bonusYuan}_)` : ''}`);
      return interaction.reply({ embeds: [embed] });
    }

    // ── /case (Партийный Кейс) ──────────────────────────────
    else if (interaction.commandName === 'case') {
      const casePrice = 500; 
      const eco = await getEco(userId);

      if (eco.wallet < casePrice) {
        return await interaction.reply({ 
          content: `❌ У тебя недостаточно юаней для покупки кейса! Нужно **${casePrice} 💴**, а у тебя только **${eco.wallet} 💴**.`, 
          flags: 64 
        });
      }

      await addYuan(userId, -casePrice);

      const drops = [
        { name: '📉 Минус-коробка (Упс!)', chance: 0.15, action: async () => { await addCredits(userId, -200); return 'Партия разочарована! **-200 соц. кредитов**'; } },
        { name: '🌾 Пачка риса', chance: 0.45, action: async () => { await addCredits(userId, 150); await addYuan(userId, 50); return 'Обычный обед рабочего. **+150 соц. кредитов** и **+50 юаней**'; } },
        { name: '🐱 Кошко-жена', chance: 0.25, action: async () => { await addCredits(userId, 600); return 'Партия выдала тебе кошко-жену! **+600 соц. кредитов**'; } },
        { name: '🏎️ Новенький Чанъа́нь Циюа́нь', chance: 0.12, action: async () => { await addCredits(userId, 1500); await addYuan(userId, 300); return 'Ударный труд вознагражден! **+1500 соц. кредитов** и **+300 юаней**'; } },
        { name: '👑 Фотография Мао Цзэдуна', chance: 0.03, action: async () => { await addCredits(userId, 5000); return 'ВЕЛИЧАЙШАЯ НАГРАДА! Вы нашли портрет Вождя! **+5000 соц. кредитов!**'; } }
      ];

      const roll = Math.random();
      let selectedDrop = drops[0];
      let currentWeight = 0;

      for (const drop of drops) {
        currentWeight += drop.chance;
        if (roll <= currentWeight) { selectedDrop = drop; break; }
      }

      const resultText = await selectedDrop.action();
      const caseEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📦 Открытие Секретного Ящика')
        .setDescription(`<@${userId}> инвестировал **${casePrice} юаней** в Партийный Кейс...\n\n🎁 **Предмет:** ${selectedDrop.name}\n\n**Эффект:** ${resultText}`);
      await interaction.reply({ embeds: [caseEmbed] });
    }

    // ── /vote_v2_0 ──────────────────────────────────────────
    else if (interaction.commandName === 'vote_v2_0') {
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
        await i.reply({ content: `✅ Твой голос учтён. Счёт: 👍 ${votes.guilty} — 👎 ${votes.innocent}`, flags: 64 });
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

    // ── /profession_v2_0 ────────────────────────────────────
    else if (interaction.commandName === 'profession_v2_0') {
      const job  = interaction.options.getString('job');
      const prof = PROFESSIONS[job];

      const jailLeft   = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**. Работать нельзя.`, flags: 64 });

      const injuryLeft = await getInjuryRemaining(userId);
      if (injuryLeft > 0) return interaction.reply({ content: `🩹 Ты травмирован! До выздоровления: **${formatTime(injuryLeft)}**. Работать нельзя.`, flags: 64 });

      const cd = await checkProfCooldown(userId, `prof_${job}`, prof.cooldown);
      if (!cd.allowed) return interaction.reply({ content: `⏳ ${prof.name} — следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      if (job === 'spy' && Math.random() * 100 < prof.riskChance) {
        const term = await sendToJail(userId, JAIL_MIN_MS, JAIL_MAX_MS);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🚔 Шпиона поймали!')
          .setDescription(`Провал миссии! Тебя поймали и бросили в тюрьму!\n🚔 Срок: **${formatTime(term)}**`);
        return interaction.reply({ embeds: [embed] });
      }

      if (Math.random() * 100 < prof.riskChance) {
        await addYuan(userId, -prof.riskLoss);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`${prof.name} — Провал!`)
          .setDescription(`Что-то пошло не так...\n💴 -${prof.riskLoss} юаней`);
        return interaction.reply({ embeds: [embed] });
      }

      const earn = Math.floor(Math.random() * (prof.maxPay - prof.minPay + 1)) + prof.minPay;
      await addYuan(userId, earn);
      await trackShift(userId);

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`${prof.name} — Смена выполнена!`)
        .setDescription(`Отличная работа, гражданин!\n💴 +${earn} юаней\n⏳ Следующая смена через **${formatTime(prof.cooldown)}**`);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /activity_v2_0 ───────────────────────────────────────
    else if (interaction.commandName === 'activity_v2_0') {
      const cd = await checkCooldown(userId, 'activityCooldown', ACTIVITY_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Следующий раз через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const key    = interaction.options.getString('activity');
      const act    = ACTIVITIES[key];
      const reward = Math.floor(Math.random() * (act.max - act.min + 1)) + act.min;
      await addCredits(userId, reward);

      const embed = new EmbedBuilder()
        .setColor(0x00BFFF)
        .setTitle('👵 Общественная деятельность')
        .setDescription(`${act.name}\n\n⭐ +${reward} соц. кредитов\nПартия ценит твоё усердие!`);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /workerboard_v2_0 ────────────────────────────────────
    else if (interaction.commandName === 'workerboard_v2_0') {
      const WorkerDay = require('mongoose').model('WorkerDay');
      const doc = await WorkerDay.findById('singleton');
      if (!doc || !doc.shifts || doc.shifts.size === 0) {
        return interaction.reply({ content: 'Сегодня ещё никто не отработал смену.', flags: 64 });
      }
      const entries = [...doc.shifts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const timeLeft = WORKER_DAY_MS - (Date.now() - (doc.lastReset || Date.now()));
      const lines = entries.map(([id, c], i) => `**${i + 1}.** <@${id}> — ${c} смен`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Лучшие работники дня')
        .setDescription(lines)
        .setFooter({ text: `Итоги и премия через ${formatTime(Math.max(timeLeft, 0))}` });
      await interaction.reply({ embeds: [embed] });
    }

    // ── /achievements_v2_0 ──────────────────────────────────
    else if (interaction.commandName === 'achievements_v2_0') {
      const p = await getPlayer(userId);
      const lines = Object.entries(ACHIEVEMENTS_LIST).map(([id, ach]) => {
        const done = p.achievements.includes(id);
        return `${done ? '✅' : '🔒'} **${ach.name}** — ${ach.desc} (+${ach.reward} кред.)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🏅 Достижения: ${interaction.user.username}`)
        .setDescription(lines || 'Пока нет достижений!')
        .setFooter({ text: `Получено: ${p.achievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}` });
      await interaction.reply({ embeds: [embed] });
    }

    // ── /work_v2_0 ──────────────────────────────────────────
    else if (interaction.commandName === 'work_v2_0') {
      const cd = await checkCooldown(userId, 'workCooldown', WORK_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Ты уже работал! Следующая смена через **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const earn = Math.floor(Math.random() * 451) + 50;
      await addYuan(userId, earn);

      const ach = await giveAchievement(userId, 'first_work');
      let achMsg = '';
      if (ach) achMsg = `\n\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;

      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('🏭 Завод Партии')
        .setDescription(`Ты отработал смену и заработал **${earn} юаней**!\n⏳ Следующая смена через **1 час**.` + achMsg);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /partyshop_v2_0 ─────────────────────────────────────
    else if (interaction.commandName === 'partyshop_v2_0') {
      const eco = await getEco(userId);
      const pLevel = eco.items.pickaxeLevel || 1;
      const upgradePrice = pLevel * 5000;

      const embed = new EmbedBuilder()
        .setColor(0xED2939)
        .setTitle('🛒 Магазин и Мастерская Партии')
        .setDescription(`Твоё текущее снаряжение: **${getPickaxeName(pLevel)}**`)
        .addFields(
          { name: '🐱 Кошка-жена',  value: '50 000 юаней\n`/buy_v2_0` → cat_wife',  inline: true },
          { name: '🍚 Миска риса',  value: '5 000 юаней\n`/buy_v2_0` → rice_bowl',   inline: true },
          { name: '🎟 Лотерея',     value: '1 000 юаней\n`/buy_v2_0` → ticket',      inline: true },
          { name: '⛏️ Улучшение кирки', value: `Цена: **${upgradePrice} юаней**\nДает бонус к юаням в \`/mine\` и защищает от травм!\n\n\`/buy_v2_0\` → pickaxe`, inline: false }
        )
        .setFooter({ text: 'Используй /buy_v2_0 для совершения покупок' });
      await interaction.reply({ embeds: [embed] });
    }

    // ── /profile_v2_0 ───────────────────────────────────────
    else if (interaction.commandName === 'profile_v2_0') {
      const credits    = await getCredits(userId);
      const eco        = await getEco(userId);
      const rating     = getRating(credits);
      const p          = await getPlayer(userId);
      const jailLeft   = await getJailRemaining(userId);
      const injuryLeft = await getInjuryRemaining(userId);
      const pLevel     = eco.items.pickaxeLevel || 1;

      const embed = new EmbedBuilder()
        .setColor(rating.color)
        .setTitle(`🛂 Паспорт гражданина: ${interaction.user.username}`)
        .addFields(
          { name: '⭐ Соц. рейтинг',  value: `${credits}`,                                          inline: true },
          { name: '💴 Юани',           value: `${eco.wallet}`,                                        inline: true },
          { name: '🏅 Достижения',     value: `${p.achievements.length}/${Object.keys(ACHIEVEMENTS_LIST).length}`, inline: true },
          { name: '🏷 Статус',         value: rating.label,                                           inline: false },
          { name: '⛏️ Снаряжение',     value: getPickaxeName(pLevel),                                 inline: true },
          { name: '🐱 Кошка-жена',     value: eco.items.cat_wife ? 'Есть ✅' : 'Нет ❌',             inline: true },
          { name: '🍚 Миски риса',     value: `${eco.items.rice_bowls}`,                              inline: true }
        );
      if (jailLeft > 0)   embed.addFields({ name: '🚔 В тюрьме',    value: `Осталось: ${formatTime(jailLeft)}`,   inline: true });
      if (injuryLeft > 0) embed.addFields({ name: '🩹 На лечении',  value: `Осталось: ${formatTime(injuryLeft)}`, inline: true });
      await interaction.reply({ embeds: [embed] });
    }

    // ── /buy_v2_0 ───────────────────────────────────────────
    else if (interaction.commandName === 'buy_v2_0') {
      const item = interaction.options.getString('item');
      const eco  = await getEco(userId);

      if (item === 'cat_wife') {
        if (eco.wallet < 50000)    return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **50 000**.', flags: 64 });
        if (eco.items.cat_wife)    return interaction.reply({ content: '❌ У тебя уже есть кошка-жена!', flags: 64 });
        
        eco.wallet -= 50000;
        eco.items.cat_wife = true;
        await eco.save();

        const ach = await giveAchievement(userId, 'cat_owner');
        let achMsg = '';
        if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
        await interaction.reply({ content: `🐱 Поздравляем! Ты купил **кошку-жену**! Партия одобряет!` + achMsg });

      } else if (item === 'rice_bowl') {
        if (eco.wallet < 5000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **5 000**.', flags: 64 });
        
        eco.wallet -= 5000;
        eco.items.rice_bowls += 1;
        await eco.save();
        await interaction.reply({ content: `🍚 Ты купил **миску риса**! Теперь у тебя **${eco.items.rice_bowls}** мисок.` });

      } else if (item === 'ticket') {
        if (eco.wallet < 1000) return interaction.reply({ content: '❌ Недостаточно юаней! Нужно **1 000**.', flags: 64 });
        
        eco.wallet -= 1000;
        await eco.save();

        const win = Math.random();
        let result;
        if (win < 0.05)       { await addYuan(userId, 20000); result = '🎉 ДЖЕКПОТ! +20 000 юаней!'; }
        else if (win < 0.25)  { await addYuan(userId, 3000);  result = '🎊 Выигрыш! +3 000 юаней!'; }
        else                  { result = '😢 Не повезло. Лотерея забрала твои 1 000 юаней.'; }

        const count = await incLotteryCount(userId);
        let achMsg = '';
        if (count >= 5) {
          const ach = await giveAchievement(userId, 'gambler');
          if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
        }
        await interaction.reply({ content: `🎟 **Лотерея:** ${result}` + achMsg });

      } else if (item === 'pickaxe') {
        const currentLevel = eco.items.pickaxeLevel || 1;
        const upgradePrice = currentLevel * 5000;

        if (eco.wallet < upgradePrice) {
          return interaction.reply({ content: `❌ У тебя недостаточно средств! Модернизация стоит **${upgradePrice} юаней**, а твой баланс — **${eco.wallet}**.`, flags: 64 });
        }

        eco.wallet -= upgradePrice;
        eco.items.pickaxeLevel = currentLevel + 1;
        await eco.save();

        const newName = getPickaxeName(eco.items.pickaxeLevel);
        await interaction.reply({ content: `⛏️ **Успешная модернизация!** Ты обновил инструмент до уровня **${eco.items.pickaxeLevel}** за **${upgradePrice} юаней**.\nНовое снаряжение: **${newName}**! Партия ценит технический прогресс рабочих!` });
      }
    }

    // ── /steal_v2_0 ─────────────────────────────────────────
    else if (interaction.commandName === 'steal_v2_0') {
      const targetUser = interaction.options.getUser('target');
      const amount     = interaction.options.getInteger('amount');

      if (targetUser.id === userId) return interaction.reply({ content: '❌ Нельзя воровать у самого себя!', flags: 64 });
      if (amount <= 0)              return interaction.reply({ content: '❌ Укажи положительную сумму!', flags: 64 });

      const thief = await getPlayer(userId);
      if (thief.credits < 0) return interaction.reply({ content: '❌ Враги народа не могут воровать!', flags: 64 });

      const jailLeft = await getJailRemaining(userId);
      if (jailLeft > 0) return interaction.reply({ content: `🚔 Ты в тюрьме! До освобождения: **${formatTime(jailLeft)}**.`, flags: 64 });

      const targetEco = await getEco(targetUser.id);
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

          const announceEmbed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle('🕵️ ОГРАБЛЕНИЕ!')
            .setDescription(`**Неизвестный** похитил **${amount} юаней** у ${targetUser.username}!\n\nЛичность вора неизвестна. У вас есть **10 секунд**, чтобы обвинить кого-то!`);
          await channel.send({ embeds: [announceEmbed] });

          const accusations = new Map();
          try {
            const collector = channel.createMessageCollector({ filter: m => m.author.bot && m.mentions.users.size > 0, time: 10000 });
            collector.on('collect', m => {
              const accused = m.mentions.users.first();
              if (accused.id !== m.author.id) accusations.set(m.author.id, accused.id);
            });
            await new Promise(resolve => collector.on('end', resolve));
          } catch { }

          let voteText = 'Никто никого не обвинил. Вор гуляет на свободе...';
          if (accusations.size > 0) {
            const tally = {};
            for (const accusedId of accusations.values()) tally[accusedId] = (tally[accusedId] || 0) + 1;
            const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
            const [suspectId, votes] = sorted[0];
            const isRight = suspectId === userId;
            voteText = `Народ считает вором: <@${suspectId}> (${votes} голос${votes === 1 ? '' : 'ов'})\n${isRight ? '🎯 Народ не ошибся!' : '🤷 Но правду никто не узнает.'}`;
          }

          const voteEmbed = new EmbedBuilder().setColor(0x888888).setTitle('🗳️ Итоги народного расследования').setDescription(voteText);
          await channel.send({ embeds: [voteEmbed] });

          let achMsg = '';
          if (ach) achMsg = `\n🏅 **Новое достижение:** ${ach.name} (+${ach.reward} кредитов)`;
          await interaction.followUp({ content: `🎰 **УСПЕХ!** Ты анонимно украл **${amount} юаней** у ${targetUser.username}!` + achMsg, flags: 64 });
        } else {
          await addCredits(userId, -500);
          await interaction.editReply({ content: `🎰 **ПРОВАЛ!** Тебя поймали! Штраф: **-500 соц. кредитов**.`, embeds: [], components: [] });
          await channel.send({ content: `🚨 ${interaction.user.username} попался на попытке кражи у ${targetUser.username}!` });
        }
      } catch {
        interaction.editReply({ content: '⏳ Время вышло. Кража отменена.', embeds: [], components: [] }).catch(() => {});
      }
    }

    // ── /socialcredit ───────────────────────────────────────
    else if (interaction.commandName === 'socialcredit') {
      if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец может изменять кредиты!', flags: 64 });
      const targetUser = interaction.options.getUser('user');
      const amount     = interaction.options.getInteger('amount');

      const cd = await checkCooldown(userId, 'creditCooldown', CREDIT_CMD_COOLDOWN_MS);
      if (!cd.allowed) return interaction.reply({ content: `⏳ Кулдаун! Подожди **${formatTime(cd.waitMs)}**.`, flags: 64 });

      const absAmount = Math.abs(amount);
      const limitCheck = await checkAndUseLimit(userId, absAmount);
      if (!limitCheck.allowed) return interaction.reply({ content: `❌ Лимит! Осталось: **${limitCheck.remaining}**. Сброс через **${formatTime(limitCheck.resetIn)}**.`, flags: 64 });

      const newCredits = await addCredits(targetUser.id, amount);
      const rating  = getRating(newCredits);
      const verdict = getPartyVerdict(newCredits);

      if (newCredits >= 20000) await giveAchievement(targetUser.id, 'patriot');

      const embed = new EmbedBuilder()
        .setColor(verdict.color)
        .setTitle(verdict.title)
        .setDescription(`**${interaction.user.username}** ${amount > 0 ? 'наградил' : 'наказал'} **${targetUser.username}** на **${amount} баллов**.\nНовый рейтинг: **${newCredits}** (${rating.label})\n${verdict.message}`);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /socialstats ────────────────────────────────────────
    else if (interaction.commandName === 'socialstats') {
      const targetUser = interaction.options.getUser('user');
      const credits    = await getCredits(targetUser.id);
      const rating     = getRating(credits);

      const embed = new EmbedBuilder()
        .setColor(rating.color)
        .setTitle(`📊 Социальный рейтинг: ${targetUser.username}`)
        .addFields(
          { name: '⭐ Рейтинг', value: `${credits} баллов`, inline: true },
          { name: '🏷 Статус',  value: rating.label,         inline: true }
        );
      if (rating.legend) embed.addFields({ name: '📜 Привилегии / Наказания', value: rating.legend, inline: false });
      await interaction.reply({ embeds: [embed] });
    }

    // ── /socialleaderboard ──────────────────────────────────
    else if (interaction.commandName === 'socialleaderboard') {
      const top = await getLeaderboard(10);
      if (top.length === 0) return interaction.reply({ content: 'Данных пока нет.', flags: 64 });
      const lines = top.map((p, i) => `**${i + 1}.** <@${p.userId}> — ${p.credits} баллов`).join('\n');
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Топ-10 граждан').setDescription(lines);
      await interaction.reply({ embeds: [embed] });
    }

    // ── /resetall ───────────────────────────────────────────
    else if (interaction.commandName === 'resetall') {
      if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только владелец!', flags: 64 });
      await resetAll();
      await interaction.reply({ content: '✅ Все данные сброшены!' });
    }

    // ── /ask_deepseek (DeepSeek AI) ─────────────────────────────
    else if (interaction.commandName === 'ask_deepseek') {
      if (!DEEPSEEK_API_KEY) {
        return interaction.reply({ content: '❌ DeepSeek API ключ не настроен! Добавь `DEEPSEEK_API_KEY` в Environment Variables на Render.', flags: 64 });
      }

      const question = interaction.options.getString('question');
      await interaction.deferReply(); 

      try {
        const answer = await askDeepSeek(question);
        const truncated = answer.length > 4000 ? answer.slice(0, 3997) + '...' : answer;

        const embed = new EmbedBuilder()
          .setColor(0xED2939)
          .setTitle('🤖 Партийный советник отвечает')
          .addFields(
            { name: '❓ Вопрос',  value: question, inline: false },
            { name: '📜 Ответ',   value: truncated, inline: false }
          )
          .setFooter({ text: `Гражданин ${interaction.user.username} обратился к советнику • Powered by DeepSeek` });

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('DeepSeek ошибка:', err);
        await interaction.editReply({ content: `❌ Партийный советник недоступен: ${err.message}` });
      }
    }
    
    // Если команда нигде не обработана:
    else {
      console.warn(`⚠️ Вызвана неизвесная команда: /${interaction.commandName}`);
      await interaction.reply({ content: '❌ Ошибка: Код для этой команды не найден на сервере!', flags: 64 });
    }

  } catch (error) {
    console.error(`❌ ОШИБКА во встроенной команде /${interaction.commandName}:`, error);
    const errorPayload = { content: 'Произошла ошибка при выполнении команды!', flags: 64 };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorPayload).catch(() => {});
    } else {
      await interaction.reply(errorPayload).catch(() => {});
    }
  }
});

// ── Запуск ───────────────────────────────────────────────────
async function main() {
  await connectDB();
  await registerCommands().catch(err => console.error('❌ Ошибка регистрации команд:', err));
  await client.login(TOKEN);
}

main().catch(err => {
  console.error('❌ Критическая ошибка запуска:', err);
  process.exit(1);
});
