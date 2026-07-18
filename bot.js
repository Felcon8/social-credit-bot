const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ========================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА'; // <-- Твой ID сервера
const DB_FILE = './credits.json';

const DEFAULT_CREDITS = 10000; 
const OWNER_USERNAME = 'felc0n'; 
const OWNER_ID = '1528109131704176822'; 

const LIMIT_PER_30MIN = 10000;
const COOLDOWN_MS = 30 * 60 * 1000;
const CREDIT_CMD_COOLDOWN_MS = 30 * 1000; 
const WORK_COOLDOWN_MS = 60 * 60 * 1000; 
// ========================================================

http.createServer((req, res) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { credits: {}, limits: {}, creditCooldown: {}, economy: {}, workCooldown: {} };
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.credits) data.credits = {};
    if (!data.limits) data.limits = {};
    if (!data.creditCooldown) data.creditCooldown = {};
    if (!data.economy) data.economy = {};
    if (!data.workCooldown) data.workCooldown = {};
    return data;
  } catch {
    return { credits: {}, limits: {}, creditCooldown: {}, economy: {}, workCooldown: {} };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function checkCreditCooldown(userId) {
  const db = loadDB();
  const now = Date.now();
  const last = db.creditCooldown[userId] || 0;
  if (now - last < CREDIT_CMD_COOLDOWN_MS) return { allowed: false, waitMs: CREDIT_CMD_COOLDOWN_MS - (now - last) };
  db.creditCooldown[userId] = now;
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
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700, enemy: false, legend: '🐱 получать **кошка жена**\n🍚 получать **миска рис**\n\n**Партия гордиться тобой!**' };
  if (credits >= 10000) return { label: '⭐ Отличник', color: 0x00FF88, enemy: false, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный', color: 0x00BFFF, enemy: false, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением', color: 0xFFA500, enemy: false, legend: null };
  if (credits >= -5000) return { label: '🚨 Неблагонадёжный', color: 0xFF4500, enemy: false, legend: null };
  return { label: '💀 Враг народа', color: 0xFF0000, enemy: true, legend: '🐱 **отобрать кошка жена**\n🍚 **не давать миска рис**\n\n**Партия не гордиться тобой!**' };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) return { title: '🏆 Образцовый гражданин', message: '🐱 получать **кошка жена**\n🍚 получать **миска рис**\n\n**Партия гордиться тобой!**', color: 0xFFD700, enemy: false };
  if (credits > 100) return { title: '🎉 Партия гордится тобой!', message: '🍚 Партия дарить тебе **миска рис**\n🐱 Партия дарить тебе **кошка жена**\n\nТы достойный гражданин! Продолжать служить Партии!', color: 0x00FF88, enemy: false };
  if (credits >= 0) return { title: '👍 Хорошо, но можно лучше', message: 'Партия видеть твои старания...\nНо Партия ожидать большего от тебя!\n\nПродолжать работать усердно!', color: 0x00BFFF, enemy: false };
  return { title: '😤 Ай ай ай! Партия не гордится тобой!', message: '🍚 Партия **забирать миска рис**\n🐱 Партия **забирать кошка жена**\n\nПозор! Исправляться немедленно!', color: 0xFF0000, enemy: true };
}

function formatTime(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.ceil((ms % 60000) / 1000);
  if (mins > 0) return `${mins} мин. ${secs} сек.`;
  return `${secs} сек.`;
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

function checkWorkCooldown(userId) {
  const db = loadDB();
  const now = Date.now();
  const last = db.workCooldown[userId] || 0;
  if (now - last < WORK_COOLDOWN_MS) return { allowed: false, waitMs: WORK_COOLDOWN_MS - (now - last) };
  db.workCooldown[userId] = now;
  saveDB(db);
  return { allowed: true };
}

async function registerCommands() {
  const commands = [
    // --- СТАРЫЕ КОМАНДЫ (КЛАССИКА) ---
    new SlashCommandBuilder()
      .setName('socialcredit')
      .setDescription('Добавить или забрать социальные кредиты у пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Кому изменить кредиты').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Сумма кредитов').setRequired(true)),
    new SlashCommandBuilder().setName('socialstats').setDescription('Посмотреть сколько у кого-то социальных кредитов')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true)),
    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ-10 по социальным кредитам на сервере'),
    new SlashCommandBuilder().setName('resetall').setDescription('⚠️ Обнулить очки всех пользователей до 10000 (Только для Создателя)'),

    // --- НОВЫЕ КОМАНДЫ v2.0 ---
    new SlashCommandBuilder().setName('help_v2_0').setDescription('📕 Руководство по новой экономике Партии'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('🏭 Отработать смену на заводе (Раз в час)'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('🛒 Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('🛂 Посмотреть свой паспорт и баланс Юаней'),
    new SlashCommandBuilder()
      .setName('buy_v2_0')
      .setDescription('🛍️ Купить предмет в магазине Партии')
      .addStringOption(opt => 
        opt.setName('item')
        .setDescription('Что покупаем?')
        .setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50,000 ¥)', value: 'cat_wife' },
          { name: '🍚 Миска риса (5,000 ¥)', value: 'rice_bowl' },
          { name: '🎟 Лотерейный билет Удача Си (1,000 ¥)', value: 'ticket' }
        )
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ Регистрирую смешанные команды...');
    if (GUILD_ID && GUILD_ID !== 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА') {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Команды зарегистрированы локально!');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Команды зарегистрированы глобально!');
    }
  } catch (error) {
    console.error('❌ Ошибка при регистрации:', error);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const isOwner = interaction.user.id === OWNER_ID || interaction.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

  // ==========================================
  //         КЛАССИЧЕСКИЕ КОМАНДЫ
  // ==========================================
  
  if (interaction.commandName === 'socialcredit') {
    const spam = checkCreditCooldown(interaction.user.id);
    if (!spam.allowed) return interaction.reply({ content: `⏳ Партия просит снизить темп! Жди: **${formatTime(spam.waitMs)}**!`, ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const giver = interaction.user;

    if (targetUser.bot) return interaction.reply({ content: '❌ Нельзя менять кредиты ботам!', ephemeral: true });
    if (targetUser.id === giver.id && !isOwner) return interaction.reply({ content: '❌ Нельзя начислять кредиты самому себе!', ephemeral: true });
    if (Math.abs(amount) === 0) return interaction.reply({ content: '❌ Сумма не может быть 0!', ephemeral: true });

    let remainingAfter = null;
    if (!isOwner) {
      const limitCheck = checkAndUseLimit(giver.id, Math.abs(amount));
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'exhausted') return interaction.reply({ content: `⛔ Ты исчерпал лимит **10 000** за 30 минут!`, ephemeral: true });
        return interaction.reply({ content: `⛔ Превышение лимита! Максимум ещё **${limitCheck.remaining}**.`, ephemeral: true });
      }
      remainingAfter = limitCheck.remaining;
    }

    const newTotal = addCredits(targetUser.id, amount);
    const { label, color, enemy, legend } = getRating(newTotal);
    const sign = amount >= 0 ? '+' : '';
    const footerText = isOwner ? `Изменил: ${giver.username} 👑` : `Изменил: ${giver.username} | Осталось: ${remainingAfter} / ${LIMIT_PER_30MIN}`;

    const embed = new EmbedBuilder().setColor(color).setTitle(`${amount >= 0 ? '📈' : '📉'} Социальные кредиты изменены`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Пользователь', value: `<@${targetUser.id}>`, inline: true },
        { name: '💱 Изменение', value: `**${sign}${amount}**`, inline: true },
        { name: '💳 Баланс', value: `**${newTotal}** кредитов`, inline: true },
        { name: '🎖 Статус', value: label, inline: false },
      ).setFooter({ text: footerText }).setTimestamp();

    if (legend) embed.addFields({ name: '📜 Решение Партии', value: legend, inline: false });
    await interaction.reply({ embeds: [embed] });
    if (enemy) await interaction.channel.send(`# 💀 ВРАГ НАРОДА\n# 🐱 ОТОБРАТЬ КОШКА ЖЕНА\n# 🍚 НЕ ДАВАТЬ РИС`);
  }

  else if (interaction.commandName === 'socialstats') {
    const targetUser = interaction.options.getUser('user');
    const credits = getCredits(targetUser.id);
    const verdict = getPartyVerdict(credits);

    const embed = new EmbedBuilder().setColor(verdict.color).setTitle(verdict.title)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Гражданин', value: `<@${targetUser.id}>`, inline: true },
        { name: '💳 Кредиты', value: `**${credits}**`, inline: true },
        { name: '📜 Решение Партии', value: verdict.message, inline: false },
      ).setFooter({ text: '🇨🇳 Социальный кредит — это серьёзно' }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'socialleaderboard') {
    const db = loadDB();
    if (!db.credits) return interaction.reply('❌ Пока нет данных!');
    const sorted = Object.entries(db.credits).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return interaction.reply('❌ Пока нет данных!');

    const lines = sorted.map(([id, cr], i) => `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${id}> — **${cr}** кредитов`);
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏛 Таблица социальных кредитов').setDescription(lines.join('\n')).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'resetall') {
    if (!isOwner) return interaction.reply({ content: '❌ Только Верховный Лидер!', ephemeral: true });
    const db = loadDB();
    for (const userId in db.credits) db.credits[userId] = 10000;
    db.limits = {}; db.creditCooldown = {}; 
    saveDB(db);

    const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🔄 Великое Обнуление Кредитов')
      .setDescription('Кредиты всех граждан возвращены к базовым **10 000**.')
      .setFooter({ text: `Приказ утвердил: ${interaction.user.username} 👑` }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  // ==========================================
  //         НОВЫЕ КОМАНДЫ (ЭКОНОМИКА v2.0)
  // ==========================================

  else if (interaction.commandName === 'help_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939) // Красный Партийный
      .setTitle('📕 Справочник Партии v2.0 (Экономика)')
      .setDescription('Товарищ! Партия ввела новую систему экономики. Теперь ты можешь трудиться на благо общества и покупать привилегии за **Юани (¥)**.')
      .addFields(
        { name: '🛠 `/work_v2_0`', value: 'Отправиться на завод. Зарплата зависит от твоего соц. рейтинга! Можно работать раз в час.', inline: false },
        { name: '🛒 `/partyshop_v2_0`', value: 'Открыть витрину Государственного Магазина Партии.', inline: false },
        { name: '🛍 `/buy_v2_0 [предмет]`', value: 'Приобрести товар из магазина (Кошка-жена, Миска риса, Лотерейный билет).', inline: false },
        { name: '🛂 `/profile_v2_0`', value: 'Посмотреть свой гражданский паспорт: баланс Юаней, рейтинг и имущество.', inline: false }
      )
      .setFooter({ text: 'Слава Великой Партии! Усердно трудись и не задавай лишних вопросов.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'work_v2_0') {
    const userId = interaction.user.id;
    const userCredits = getCredits(userId);

    if (userCredits < 0) {
      return interaction.reply({ 
        content: '🏭 **ГУЛАГ:** Партия отправила тебя на принудительные работы. Ты отработал смену, но Врагам Народа не платят!',
        ephemeral: false 
      });
    }

    const spam = checkWorkCooldown(userId);
    if (!spam.allowed) {
      return interaction.reply({ 
        content: `⏳ Смена еще не началась! Жди **${formatTime(spam.waitMs)}** перед тем как снова пойти на завод.`, 
        ephemeral: true 
      });
    }

    let salary = Math.floor(Math.random() * 401) + 100;
    let bonusText = "";
    if (userCredits >= 10000) {
      salary = Math.floor(salary * 1.5);
      bonusText = "\n*(Включая надбавку 50% за высокий социальный рейтинг!)*";
    }

    const newBalance = addYuan(userId, salary);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏭 Смена на заводе окончена!')
      .setDescription(`Ты усердно трудился 12 часов. Партия довольна тобой.\n\nЗаработано: **+${salary} ¥** ${bonusText}\nТвой баланс: **${newBalance} ¥**`)
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'partyshop_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939) 
      .setTitle('🛒 Государственный Магазин Партии v2.0')
      .setDescription('Трать свои Юани (¥) с умом. На благо общества!')
      .addFields(
        { name: '🐱 Кошка-жена', value: 'Стоимость: **50,000 ¥**\nЭлитный статус в профиле.', inline: false },
        { name: '🍚 Миска риса', value: 'Стоимость: **5,000 ¥**\nПокажи всем, что ты не голодаешь. Можно иметь бесконечно много.', inline: false },
        { name: '🎟 Лотерейный билет "Удача Си"', value: 'Стоимость: **1,000 ¥**\n50% шанс получить +2000 социального кредита, 50% шанс потерять -2000.', inline: false }
      )
      .setFooter({ text: 'Используй /buy_v2_0 для покупки' });
    
    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'buy_v2_0') {
    const item = interaction.options.getString('item');
    const userId = interaction.user.id;
    const eco = getEco(userId);

    const prices = {
      'cat_wife': 50000,
      'rice_bowl': 5000,
      'ticket': 1000
    };

    if (eco.wallet < prices[item]) {
      return interaction.reply({ content: `❌ У тебя не хватает Юаней! Нужно **${prices[item]} ¥**, а у тебя **${eco.wallet} ¥**. Марш на завод!`, ephemeral: true });
    }

    const db = loadDB(); 
    db.economy[userId] = db.economy[userId] || { wallet: 0, items: { cat_wife: false, rice_bowls: 0 } };

    if (item === 'cat_wife') {
      if (db.economy[userId].items.cat_wife) {
        return interaction.reply({ content: '❌ У тебя уже есть Кошка-жена! Партия запрещает многоженство.', ephemeral: true });
      }
      db.economy[userId].wallet -= prices[item];
      db.economy[userId].items.cat_wife = true;
      saveDB(db);
      await interaction.reply(`🎉 Поздравляем! <@${userId}> приобрел **Кошка-жена**! Партия гордится тобой! 🐱`);
    }

    else if (item === 'rice_bowl') {
      db.economy[userId].wallet -= prices[item];
      db.economy[userId].items.rice_bowls = (db.economy[userId].items.rice_bowls || 0) + 1;
      saveDB(db);
      await interaction.reply(`🍚 <@${userId}> купил **Миску риса**. Теперь у него их: **${db.economy[userId].items.rice_bowls} шт.** Сытый гражданин - хороший гражданин!`);
    }

    else if (item === 'ticket') {
      db.economy[userId].wallet -= prices[item];
      saveDB(db); 

      const win = Math.random() > 0.5;
      if (win) {
        const newCreds = addCredits(userId, 2000);
        await interaction.reply(`🎟 Лотерея! <@${userId}> стер защитный слой... **ПОБЕДА!** Партия начисляет тебе **+2000 социального кредита**! (Баланс: ${newCreds})`);
      } else {
        const newCreds = addCredits(userId, -2000);
        await interaction.reply(`🎟 Лотерея! <@${userId}> стер защитный слой... **ПОРАЖЕНИЕ!** Партия недовольна твоим азартом. **-2000 социального кредита**! (Баланс: ${newCreds})`);
      }
    }
  }

  else if (interaction.commandName === 'profile_v2_0') {
    const userId = interaction.user.id;
    const credits = getCredits(userId);
    const eco = getEco(userId);
    
    const wifeText = eco.items.cat_wife ? '✅ Присутствует' : '❌ Нету (Грустно)';
    const riceText = eco.items.rice_bowls > 0 ? `🍚 ${eco.items.rice_bowls} шт.` : '❌ Пусто';

    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle(`🛂 Паспорт гражданина ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '🎖 Социальный кредит', value: `**${credits}**`, inline: true },
        { name: '💴 Юани (Кошелек)', value: `**${eco.wallet} ¥**`, inline: true },
        { name: '\u200B', value: '\u200B' }, 
        { name: 'ИМУЩЕСТВО', value: '----------------', inline: false },
        { name: '🐱 Кошка-жена', value: wifeText, inline: true },
        { name: '🍚 Запасы риса', value: riceText, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

});

registerCommands().then(() => client.login(TOKEN));
