const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ================================
// НАСТРОЙКИ
// ================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DB_FILE = './credits.json';
const DEFAULT_CREDITS = 10000;
// ================================

// --- Веб-сервер чтобы Render не засыпал ---
http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

// --- База данных ---
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getCredits(userId) {
  const db = loadDB();
  if (db[userId] === undefined) db[userId] = DEFAULT_CREDITS;
  return db[userId];
}

function addCredits(userId, amount) {
  const db = loadDB();
  if (db[userId] === undefined) db[userId] = DEFAULT_CREDITS;
  db[userId] += amount;
  saveDB(db);
  return db[userId];
}

// --- Вердикт партии для /socialstats ---
function getPartyVerdict(credits) {
  const diff = credits - DEFAULT_CREDITS;

  if (diff > 100) {
    return {
      title: '🎉 Партия гордиться тобой!',
      message: '🍚 Партия дарить тебе **миска рис**\n🐱 Партия дарить тебе **кошка жена**\n\nТы достойный гражданин! Продолжать служить Партии!',
      color: 0xFFD700,
    };
  } else if (diff >= 0) {
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

// --- Статус по количеству кредитов ---
function getRating(credits) {
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700 };
  if (credits >= 15000) return { label: '⭐ Отличник',             color: 0x00FF88 };
  if (credits >= 10000) return { label: '✅ Нормальный',           color: 0x00BFFF };
  if (credits >= 5000)  return { label: '⚠️ Под наблюдением',     color: 0xFFA500 };
  if (credits >= 1000)  return { label: '🚨 Неблагонадёжный',     color: 0xFF4500 };
  return                       { label: '💀 Враг народа',          color: 0xFF0000 };
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

  // ======= /socialcredit =======
  if (interaction.commandName === 'socialcredit') {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Нельзя менять кредиты ботам!', ephemeral: true });
    }

    const newTotal = addCredits(targetUser.id, amount);
    const { label, color } = getRating(newTotal);
    const sign = amount >= 0 ? '+' : '';
    const emoji = amount >= 0 ? '📈' : '📉';

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
      .setFooter({ text: `Изменил: ${interaction.user.username}` })
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
    const sorted = Object.entries(db)
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
