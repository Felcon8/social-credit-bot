const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ================================
// НАСТРОЙКИ
// ================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DB_FILE = './credits.json';
const DEFAULT_CREDITS = 0;          // все стартуют с 0 (сброс)
const OWNER_USERNAME = 'felc0n';    // только этот юзер может начислять себе
const LIMIT_PER_30MIN = 10000;      // макс сумма за 30 минут
const COOLDOWN_MS = 30 * 60 * 1000; // 30 минут в миллисекундах
const CMD_COOLDOWN_MS = 5000;       // 5 секунд между командами (антиспам)
// ================================

// --- Веб-сервер чтобы Render не засыпал ---
http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

// --- База данных ---
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { credits: {}, limits: {}, cmdCooldown: {} };
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { credits: {}, limits: {}, cmdCooldown: {} };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getCredits(userId) {
  const db = loadDB();
  if (!db.credits) db.credits = {};
  if (db.credits[userId] === undefined) db.credits[userId] = DEFAULT_CREDITS;
  return db.credits[userId];
}

// --- Проверка лимита 10000 за 30 минут ---
// Возвращает { allowed: true/false, used: число, remaining: число, resetIn: мс }
function checkLimit(giverId) {
  const db = loadDB();
  if (!db.limits) db.limits = {};
  const now = Date.now();
  const entry = db.limits[giverId];

  if (!entry || now - entry.startTime >= COOLDOWN_MS) {
    // Окно сбросилось или первый раз
    return { allowed: true, used: 0, remaining: LIMIT_PER_30MIN, resetIn: 0, fresh: true };
  }

  return {
    allowed: entry.used < LIMIT_PER_30MIN,
    used: entry.used,
    remaining: LIMIT_PER_30MIN - entry.used,
    resetIn: COOLDOWN_MS - (now - entry.startTime),
    fresh: false
  };
}

function useLimit(giverId, amount) {
  const db = loadDB();
  if (!db.limits) db.limits = {};
  const now = Date.now();
  const entry = db.limits[giverId];

  if (!entry || now - entry.startTime >= COOLDOWN_MS) {
    db.limits[giverId] = { startTime: now, used: amount };
  } else {
    db.limits[giverId].used += amount;
  }
  saveDB(db);
}

// --- Антиспам для команд ---
function checkCmdCooldown(userId) {
  const db = loadDB();
  if (!db.cmdCooldown) db.cmdCooldown = {};
  const now = Date.now();
  const last = db.cmdCooldown[userId] || 0;
  if (now - last < CMD_COOLDOWN_MS) {
    return { allowed: false, waitMs: CMD_COOLDOWN_MS - (now - last) };
  }
  db.cmdCooldown[userId] = now;
  saveDB(db);
  return { allowed: true };
}

// --- Добавить кредиты ---
function addCredits(userId, amount) {
  const db = loadDB();
  if (!db.credits) db.credits = {};
  if (db.credits[userId] === undefined) db.credits[userId] = DEFAULT_CREDITS;
  db.credits[userId] += amount;
  saveDB(db);
  return db.credits[userId];
}

// --- Вердикт партии ---
function getPartyVerdict(credits) {
  if (credits > 100) {
    return {
      title: '🎉 Партия гордиться тобой!',
      message: '🍚 Партия дарить тебе **миска рис**\n🐱 Партия дарить тебе **кошка жена**\n\nТы достойный гражданин! Продолжать служить Партии!',
      color: 0xFFD700,
    };
  } else if (credits >= 0) {
    return {
      title: '👍 Хорошо, но можно лучше',
      message: 'Партия видеть твои старания...\nНо Партия ожидать большего от тебя!\n\nПродолжать работать усердно!',
      color: 0x00BFFF,
    };
  } else {
    return {
      title: '😤 Ай ай ай! Партия не гордиться тобой!',
      message: '🍚 Партия **забирать миска рис**\n🐱 Партия **забирать кошка жена**\n\nПозор! Исправляться немедленно!',
      color: 0xFF0000,
    };
  }
}

// --- Статус ---
function getRating(credits) {
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700 };
  if (credits >= 10000) return { label: '⭐ Отличник',             color: 0x00FF88 };
  if (credits >= 1000)  return { label: '✅ Нормальный',           color: 0x00BFFF };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением',     color: 0xFFA500 };
  if (credits >= -5000) return { label: '🚨 Неблагонадёжный',     color: 0xFF4500 };
  return                       { label: '💀 Враг народа',          color: 0xFF0000 };
}

function formatTime(ms) {
  const mins = Math.ceil(ms / 60000);
  return `${mins} мин.`;
}

// --- Регистрация команд ---
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('socialcredit')
      .setDescription('Добавить или забрать социальные кредиты у пользователя')
      .addUserOption(opt =>
        opt.setName('user').setDescription('Кому изменить кредиты').setRequired(true))
      .addIntegerOption(opt =>
        opt.setName('amount').setDescription('Сумма (например: -1000 или +500)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialstats')
      .setDescription('Посмотреть сколько у кого-то социальных кредитов')
      .addUserOption(opt =>
        opt.setName('user').setDescription('Пользователь').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialleaderboard')
      .setDescription('Топ-10 по социальным кредитам на сервере'),

  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  console.log('⏳ Регистрирую команды...');
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('✅ Команды зарегистрированы!');
}

// --- Бот ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // --- Антиспам ---
  const spam = checkCmdCooldown(interaction.user.id);
  if (!spam.allowed) {
    return interaction.reply({
      content: `⏳ Не так быстро! Подожди ещё **${Math.ceil(spam.waitMs / 1000)} сек.**`,
      ephemeral: true
    });
  }

  // ======= /socialcredit =======
  if (interaction.commandName === 'socialcredit') {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const giver = interaction.user;

    // Нельзя начислять себе (кроме владельца)
    if (targetUser.id === giver.id) {
      const isOwner = giver.username.toLowerCase() === OWNER_USERNAME.toLowerCase();
      if (!isOwner) {
        return interaction.reply({
          content: '❌ Нельзя начислять кредиты самому себе!',
          ephemeral: true
        });
      }
    }

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Нельзя менять кредиты ботам!', ephemeral: true });
    }

    // Проверка суммы
    const absAmount = Math.abs(amount);
    if (absAmount === 0) {
      return interaction.reply({ content: '❌ Сумма не может быть 0!', ephemeral: true });
    }

    // Проверка лимита (не применяем к владельцу)
    const isOwner = giver.username.toLowerCase() === OWNER_USERNAME.toLowerCase();
    if (!isOwner) {
      const limit = checkLimit(giver.id);

      if (!limit.allowed) {
        return interaction.reply({
          content: `⛔ Ты исчерпал лимит **10 000 кредитов** за 30 минут!\nПодожди ещё **${formatTime(limit.resetIn)}**`,
          ephemeral: true
        });
      }

      if (absAmount > limit.remaining) {
        return interaction.reply({
          content: `⛔ Превышение лимита! Ты можешь перевести ещё максимум **${limit.remaining}** кредитов.\nЛимит сбросится через **${formatTime(limit.resetIn || COOLDOWN_MS)}**`,
          ephemeral: true
        });
      }

      useLimit(giver.id, absAmount);
    }

    const newTotal = addCredits(targetUser.id, amount);
    const { label, color } = getRating(newTotal);
    const sign = amount >= 0 ? '+' : '';
    const emoji = amount >= 0 ? '📈' : '📉';

    // Считаем остаток лимита для отображения
    const limitAfter = isOwner ? null : checkLimit(giver.id);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} Социальные кредиты изменены`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Пользователь', value: `<@${targetUser.id}>`, inline: true },
        { name: '💱 Изменение',    value: `**${sign}${amount}**`, inline: true },
        { name: '💳 Баланс',       value: `**${newTotal}** кредитов`, inline: true },
        { name: '🎖 Статус',       value: label, inline: false },
      )
      .setFooter({ text: isOwner ? `Изменил: ${giver.username} 👑` : `Изменил: ${giver.username} | Осталось лимита: ${limitAfter.remaining}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ======= /socialstats =======
  else if (interaction.commandName === 'socialstats') {
    const targetUser = interaction.options.getUser('user');
    const credits = getCredits(targetUser.id);
    const { label } = getRating(credits);
    const verdict = getPartyVerdict(credits);

    const embed = new EmbedBuilder()
      .setColor(verdict.color)
      .setTitle(verdict.title)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Гражданин',      value: `<@${targetUser.id}>`, inline: true },
        { name: '💳 Кредиты',        value: `**${credits}**`, inline: true },
        { name: '🎖 Статус',         value: label, inline: false },
        { name: '📜 Решение Партии', value: verdict.message, inline: false },
      )
      .setFooter({ text: '🇨🇳 Социальный кредит — это серьёзно' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ======= /socialleaderboard =======
  else if (interaction.commandName === 'socialleaderboard') {
    const db = loadDB();
    if (!db.credits) return interaction.reply('❌ Пока нет данных!');

    const sorted = Object.entries(db.credits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sorted.length === 0) {
      return interaction.reply('❌ Пока нет данных!');
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([id, credits], i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} <@${id}> — **${credits}** кредитов`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏛 Таблица социальных кредитов')
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// --- Старт ---
registerCommands().then(() => client.login(TOKEN));
