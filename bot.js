const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА'; // <-- Для моментального обновления команд в Discord
const DB_FILE = './credits.json';
const DEFAULT_CREDITS = 10000; 
const OWNER_USERNAME = 'felc0n';
const OWNER_ID = '1528109131704176822'; 
const LIMIT_PER_30MIN = 10000;
const COOLDOWN_MS = 30 * 60 * 1000;
const CREDIT_CMD_COOLDOWN_MS = 30 * 1000; // 30 секунд лимита для /socialcredit
// ================================

http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { credits: {}, limits: {}, creditCooldown: {} };
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.credits) data.credits = {};
    if (!data.limits) data.limits = {};
    if (!data.creditCooldown) data.creditCooldown = {};
    return data;
  } catch {
    return { credits: {}, limits: {}, creditCooldown: {} };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Проверка кулдауна именно для /socialcredit
function checkCreditCooldown(userId, isOwner) {
  if (isOwner) return { allowed: true };
  const db = loadDB();
  const now = Date.now();
  const last = db.creditCooldown[userId] || 0;
  
  if (now - last < CREDIT_CMD_COOLDOWN_MS) {
    return { allowed: false, waitMs: CREDIT_CMD_COOLDOWN_MS - (now - last) };
  }
  
  db.creditCooldown[userId] = now;
  saveDB(db);
  return { allowed: true };
}

function checkAndUseLimit(giverId, absAmount) {
  const db = loadDB();
  const now = Date.now();
  const entry = db.limits[giverId];

  if (!entry || now - entry.startTime >= COOLDOWN_MS) {
    if (absAmount > LIMIT_PER_30MIN) {
      return { allowed: false, reason: 'exceed', remaining: LIMIT_PER_30MIN, resetIn: COOLDOWN_MS };
    }
    db.limits[giverId] = { startTime: now, used: absAmount };
    saveDB(db);
    return { allowed: true, remaining: LIMIT_PER_30MIN - absAmount };
  }

  const used = entry.used;
  const remaining = LIMIT_PER_30MIN - used;
  const resetIn = COOLDOWN_MS - (now - entry.startTime);

  if (used >= LIMIT_PER_30MIN) {
    return { allowed: false, reason: 'exhausted', remaining: 0, resetIn };
  }
  if (absAmount > remaining) {
    return { allowed: false, reason: 'exceed', remaining, resetIn };
  }

  db.limits[giverId].used += absAmount;
  saveDB(db);
  return { allowed: true, remaining: remaining - absAmount };
}

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

function getRating(credits) {
  if (credits >= 20000) return {
    label: '🏆 Образцовый гражданин',
    color: 0xFFD700,
    enemy: false,
    legend: '🐱 получать **кошка жена**\n🍚 получать **миска рис**\n\n**Партия гордиться тобой!**'
  };
  if (credits >= 10000) return { label: '⭐ Отличник',         color: 0x00FF88, enemy: false, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный',       color: 0x00BFFF, enemy: false, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением', color: 0xFFA500, enemy: false, legend: null };
  if (credits >= -5000) return { label: '🚨 Неблагонадёжный', color: 0xFF4500, enemy: false, legend: null };
  return {
    label: '💀 Враг народа',
    color: 0xFF0000,
    enemy: true,
    legend: '🐱 **отобрать кошка жена**\n🍚 **не давать миска рис**\n\n**Партия не гордиться тобой!**'
  };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) {
    return {
      title: '🏆 Образцовый гражданин',
      message: '🐱 получать **кошка жена**\n🍚 получать **миска рис**\n\n**Партия гордиться тобой!**',
      color: 0xFFD700,
      enemy: false,
    };
  } else if (credits > 100) {
    return {
      title: '🎉 Партия гордится тобой!',
      message: '🍚 Партия дарить тебе **миска рис**\n🐱 Партия дарить тебе **кошка жена**\n\nТы достойный гражданин! Продолжать служить Партии!',
      color: 0x00FF88,
      enemy: false,
    };
  } else if (credits >= 0) {
    return {
      title: '👍 Хорошо, но можно лучше',
      message: 'Партия видеть твои старания...\nНо Партия ожидать большего от тебя!\n\nПродолжать работать усердно!',
      color: 0x00BFFF,
      enemy: false,
    };
  } else {
    return {
      title: '😤 Ай ай ай! Партия не гордится тобой!',
      message: '🍚 Партия **забирать миска рис**\n🐱 Партия **забирать кошка жена**\n\nПозор! Исправляться немедленно!',
      color: 0xFF0000,
      enemy: true,
    };
  }
}

function formatTime(ms) {
  const secs = Math.ceil(ms / 1000);
  return `${secs} сек.`;
}

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

    new SlashCommandBuilder()
      .setName('resetall')
      .setDescription('⚠️ Обнулить очки всех пользователей до 10000 (Только для Создателя)'),

  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  console.log('⏳ Регистрирую команды...');
  
  // Если ID сервера указан, регистрируем локально (обновление мгновенное)
  if (GUILD_ID && GUILD_ID !== 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА') {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Команды зарегистрированы локально для сервера!');
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды зарегистрированы глобально! (Может потребоваться время для обновления)');
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const isOwner = interaction.user.id === OWNER_ID || interaction.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

  // ======= /socialcredit =======
  if (interaction.commandName === 'socialcredit') {
    // Проверяем 30-секундный лимит между командами
    const spam = checkCreditCooldown(interaction.user.id, isOwner);
    if (!spam.allowed) {
      return interaction.reply({
        content: `⏳ Партия просит снизить темп! Подожди ещё **${formatTime(spam.waitMs)}** перед использованием /socialcredit!`,
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const giver = interaction.user;

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Нельзя менять кредиты ботам!', ephemeral: true });
    }
    if (targetUser.id === giver.id && !isOwner) {
      return interaction.reply({ content: '❌ Нельзя начислять кредиты самому себе!', ephemeral: true });
    }

    const absAmount = Math.abs(amount);
    if (absAmount === 0) {
      return interaction.reply({ content: '❌ Сумма не может быть 0!', ephemeral: true });
    }

    let remainingAfter = null;
    if (!isOwner) {
      const limitCheck = checkAndUseLimit(giver.id, absAmount);
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'exhausted') {
          return interaction.reply({
            content: `⛔ Ты исчерпал лимит **10 000 кредитов** за 30 минут!\nПодожди еще немного.`,
            ephemeral: true
          });
        }
        return interaction.reply({
          content: `⛔ Превышение лимита!\nМожно перевести максимум ещё **${limitCheck.remaining}** кредитов.`,
          ephemeral: true
        });
      }
      remainingAfter = limitCheck.remaining;
    }

    const newTotal = addCredits(targetUser.id, amount);
    const { label, color, enemy, legend } = getRating(newTotal);
    const sign = amount >= 0 ? '+' : '';
    const emoji = amount >= 0 ? '📈' : '📉';
    const footerText = isOwner
      ? `Изменил: ${giver.username} 👑`
      : `Изменил: ${giver.username} | Осталось лимита: ${remainingAfter} / ${LIMIT_PER_30MIN}`;

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
      .setFooter({ text: footerText })
      .setTimestamp();

    if (legend) {
      embed.addFields({ name: '📜 Решение Партии', value: legend, inline: false });
    }

    await interaction.reply({ embeds: [embed] });

    if (enemy) {
      await interaction.channel.send(`# 💀 ВРАГ НАРОДА`);
      await interaction.channel.send(`# 🐱 ОТОБРАТЬ КОШКА ЖЕНА`);
      await interaction.channel.send(`# 🍚 НЕ ДАВАТЬ РИС`);
    }
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

    if (verdict.enemy) {
      await interaction.channel.send(`# 💀 ВРАГ НАРОДА`);
      await interaction.channel.send(`# 🐱 ОТОБРАТЬ КОШКА ЖЕНА`);
      await interaction.channel.send(`# 🍚 НЕ ДАВАТЬ РИС`);
    }
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

  // ======= /resetall =======
  else if (interaction.commandName === 'resetall') {
    if (!isOwner) {
      return interaction.reply({ content: '❌ Только Верховный Лидер имеет право обнулять историю!', ephemeral: true });
    }

    const db = loadDB();
    for (const userId in db.credits) {
      db.credits[userId] = 10000;
    }
    db.limits = {};
    db.creditCooldown = {}; // Очищаем кулдауны при сбросе
    saveDB(db);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔄 Великое Обнуление Кредитов')
      .setDescription('Партия обнулила прошлые проступки и достижения! Кредиты всех граждан возвращены к базовым **10 000**.')
      .setFooter({ text: `Приказ утвердил: ${interaction.user.username} 👑` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

registerCommands().then(() => client.login(TOKEN));
