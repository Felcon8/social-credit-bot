const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ========================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА';
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

function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

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
  if (credits >= 20000) return { label: '🏆 Образцовый гражданин', color: 0xFFD700, enemy: false, legend: '🐱 получать **кошка жена**\n🍚 получать **миска рис**' };
  if (credits >= 10000) return { label: '⭐ Отличник', color: 0x00FF88, enemy: false, legend: null };
  if (credits >= 1000)  return { label: '✅ Нормальный', color: 0x00BFFF, enemy: false, legend: null };
  if (credits >= 0)     return { label: '⚠️ Под наблюдением', color: 0xFFA500, enemy: false, legend: null };
  return { label: '💀 Враг народа', color: 0xFF0000, enemy: true, legend: '🐱 **отобрать кошка жена**' };
}

function getPartyVerdict(credits) {
  if (credits >= 20000) return { title: '🏆 Образцовый гражданин', message: 'Партия гордится тобой!', color: 0xFFD700 };
  if (credits > 100) return { title: '🎉 Партия гордится тобой!', message: 'Продолжай служить Партии!', color: 0x00FF88 };
  if (credits >= 0) return { title: '👍 Хорошо, но можно лучше', message: 'Партия ожидает большего!', color: 0x00BFFF };
  return { title: '😤 Ай ай ай! Позор!', message: 'Исправляйся немедленно!', color: 0xFF0000 };
}

function formatTime(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.ceil((ms % 60000) / 1000);
  return mins > 0 ? `${mins} мин. ${secs} сек.` : `${secs} сек.`;
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
    // ✅ ИСПРАВЛЕНО: добавлен .setDescription() для всех опций
    new SlashCommandBuilder()
      .setName('socialcredit')
      .setDescription('Змінити кредити')
      .addUserOption(opt => opt.setName('user').setDescription('Користувач').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Кількість кредитів').setRequired(true)),

    new SlashCommandBuilder()
      .setName('socialstats')
      .setDescription('Статистика')
      .addUserOption(opt => opt.setName('user').setDescription('Користувач').setRequired(true)),

    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ'),
    new SlashCommandBuilder().setName('resetall').setDescription('Скинути (тільки для адміна)'),

    new SlashCommandBuilder().setName('help_v2_0').setDescription('Допомога економіки'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Завод'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Магазин'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Профіль'),

    new SlashCommandBuilder()
      .setName('buy_v2_0')
      .setDescription('Купити')
      .addStringOption(opt => opt
        .setName('item')
        .setDescription('Оберіть товар')
        .setRequired(true)
        .addChoices(
          { name: '🐱 Кошка-жена (50к)', value: 'cat_wife' },
          { name: '🍚 Миска риса (5к)', value: 'rice_bowl' },
          { name: '🎟 Лотерея (1к)', value: 'ticket' }
        )),

    new SlashCommandBuilder()
      .setName('steal_v2_0')
      .setDescription('Вкрасти Юані (Штраф: -500 соц. рейтингу при провалі)')
      .addUserOption(opt => opt.setName('target').setDescription('Ціль').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Кількість юанів').setRequired(true)),

  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Команди v2.0 зареєстровані!');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
  console.log(`🤖 Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ── /help_v2_0 ──────────────────────────────────────────
  if (interaction.commandName === 'help_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('📕 Справочник Партии v2.0 (Экономика)')
      .addFields(
        { name: '🛠 /work_v2_0', value: 'Робота на заводі (раз на годину).', inline: false },
        { name: '🛒 /partyshop_v2_0', value: 'Магазин товарів.', inline: false },
        { name: '🛍 /buy_v2_0', value: 'Купівля товарів.', inline: false },
        { name: '🥷 /steal_v2_0', value: 'Спроба крадіжки (Штраф при провалі: -500 соц. кредиту).', inline: false },
        { name: '🛂 /profile_v2_0', value: 'Мій паспорт.', inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }

  // ── /work_v2_0 ──────────────────────────────────────────
  else if (interaction.commandName === 'work_v2_0') {
    const userId = interaction.user.id;
    const cd = checkWorkCooldown(userId);
    if (!cd.allowed) {
      return interaction.reply({ content: `⏳ Ти вже працював! Наступна зміна через **${formatTime(cd.waitMs)}**.`, flags: 64 });
    }
    const earn = Math.floor(Math.random() * 451) + 50; // 50–500 юанів
    addYuan(userId, earn);
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🏭 Завод Партії')
      .setDescription(`Ти відробив зміну і заробив **${earn} Юанів**!\nНаступна зміна доступна через **1 годину**.`);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /partyshop_v2_0 ─────────────────────────────────────
  else if (interaction.commandName === 'partyshop_v2_0') {
    const embed = new EmbedBuilder()
      .setColor(0xED2939)
      .setTitle('🛒 Магазин Партії')
      .addFields(
        { name: '🐱 Кошка-жена', value: '50 000 Юанів\n`/buy_v2_0 cat_wife`', inline: true },
        { name: '🍚 Миска риса', value: '5 000 Юанів\n`/buy_v2_0 rice_bowl`', inline: true },
        { name: '🎟 Лотерея', value: '1 000 Юанів\n`/buy_v2_0 ticket`', inline: true }
      )
      .setFooter({ text: 'Використай /buy_v2_0 для купівлі' });
    await interaction.reply({ embeds: [embed] });
  }

  // ── /profile_v2_0 ───────────────────────────────────────
  else if (interaction.commandName === 'profile_v2_0') {
    const userId = interaction.user.id;
    const credits = getCredits(userId);
    const eco = getEco(userId);
    const rating = getRating(credits);
    const embed = new EmbedBuilder()
      .setColor(rating.color)
      .setTitle(`🛂 Паспорт: ${interaction.user.username}`)
      .addFields(
        { name: '⭐ Соц. рейтинг', value: `${credits}`, inline: true },
        { name: '💴 Юані', value: `${eco.wallet}`, inline: true },
        { name: '🏷 Статус', value: rating.label, inline: false },
        { name: '🐱 Кошка-жена', value: eco.items.cat_wife ? 'Є ✅' : 'Немає ❌', inline: true },
        { name: '🍚 Миски рису', value: `${eco.items.rice_bowls}`, inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }

  // ── /buy_v2_0 ───────────────────────────────────────────
  else if (interaction.commandName === 'buy_v2_0') {
    const userId = interaction.user.id;
    const item = interaction.options.getString('item');
    const eco = getEco(userId);

    if (item === 'cat_wife') {
      if (eco.wallet < 50000) return interaction.reply({ content: '❌ Недостатньо Юанів! Потрібно **50 000**.', flags: 64 });
      if (eco.items.cat_wife) return interaction.reply({ content: '❌ У тебе вже є кошка-жена!', flags: 64 });
      const db = loadDB();
      db.economy[userId].wallet -= 50000;
      db.economy[userId].items.cat_wife = true;
      saveDB(db);
      await interaction.reply({ content: '🐱 Вітаємо! Ти купив **кошку-жену**! Партія схвалює!' });
    } else if (item === 'rice_bowl') {
      if (eco.wallet < 5000) return interaction.reply({ content: '❌ Недостатньо Юанів! Потрібно **5 000**.', flags: 64 });
      const db = loadDB();
      db.economy[userId].wallet -= 5000;
      db.economy[userId].items.rice_bowls += 1;
      saveDB(db);
      await interaction.reply({ content: `🍚 Ти купив **миску рису**! У тебе тепер **${db.economy[userId].items.rice_bowls}** мисок.` });
    } else if (item === 'ticket') {
      if (eco.wallet < 1000) return interaction.reply({ content: '❌ Недостатньо Юанів! Потрібно **1 000**.', flags: 64 });
      addYuan(userId, -1000);
      const win = Math.random();
      let result;
      if (win < 0.05) { addYuan(userId, 20000); result = '🎉 ДЖЕКПОТ! +20 000 Юанів!'; }
      else if (win < 0.25) { addYuan(userId, 3000); result = '🎊 Виграш! +3 000 Юанів!'; }
      else { result = '😢 Не пощастило. Лотерея забрала твої 1 000 Юанів.'; }
      await interaction.reply({ content: `🎟 **Лотерея:** ${result}` });
    }
  }

  // ── /steal_v2_0 ─────────────────────────────────────────
  else if (interaction.commandName === 'steal_v2_0') {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');

    if (targetUser.id === userId) return interaction.reply({ content: '❌ Не можна красти у себе!', flags: 64 });
    if (amount <= 0) return interaction.reply({ content: '❌ Вкажи позитивну суму!', flags: 64 });
    if (getCredits(userId) < 0) return interaction.reply({ content: '❌ Вороги народу не можуть красти!', flags: 64 });

    const targetEco = getEco(targetUser.id);
    if (targetEco.wallet < amount) return interaction.reply({ content: `❌ У цілі тільки **${targetEco.wallet} Юанів**!`, flags: 64 });

    const chance = Math.max(1, Math.floor(5000 / (amount + 150)));
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle('⚠️ ВНИМАНИЕ: АКТ САБОТАЖА')
      .setDescription(`Ціль: **${targetUser.username}**\nСума: **${amount} Юанів**\nШанс успіху: **${chance}%**\nШтраф при провалі: **-500 соц. кредиту**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('steal_confirm').setLabel('Ризикнути').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('steal_cancel').setLabel('Відміна').setStyle(ButtonStyle.Secondary)
    );
    const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

    try {
      const i = await msg.awaitMessageComponent({ filter: c => c.user.id === userId, time: 30000 });
      if (i.customId === 'steal_cancel') return i.update({ content: '❌ Крадіжку скасовано.', embeds: [], components: [] });

      const symbols = ['💰', '🚨', '👮', '💸', '🐱', '💀'];
      await i.update({ content: `🎰 **Злом...** [${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]}]`, embeds: [], components: [] });
      await new Promise(r => setTimeout(r, 1000));
      await interaction.editReply({ content: `🎰 **Злом...** [${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]}]` });
      await new Promise(r => setTimeout(r, 1000));
      await interaction.editReply({ content: `🎰 **Злом...** [${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]}]` });
      await new Promise(r => setTimeout(r, 1000));

      if (Math.random() * 100 < chance) {
        addYuan(targetUser.id, -amount);
        addYuan(userId, amount);
        await interaction.editReply({ content: `🎰 **УСПІХ!** Ти вкрав **${amount} Юанів** у ${targetUser.username}!` });
      } else {
        addCredits(userId, -500);
        await interaction.editReply({ content: `🎰 **ПРОВАЛ!** Тебе спіймали! Штраф: **-500 соц. кредиту**.` });
      }
    } catch {
      interaction.editReply({ content: '⏳ Час вийшов. Крадіжку скасовано.', embeds: [], components: [] });
    }
  }

  // ── Старые команды ──────────────────────────────────────
  else if (interaction.commandName === 'socialcredit') {
    const userId = interaction.user.id;
    if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Тільки власник може змінювати кредити!', flags: 64 });
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const cd = checkCreditCooldown(userId);
    if (!cd.allowed) return interaction.reply({ content: `⏳ Кулдаун! Почекай **${formatTime(cd.waitMs)}**.`, flags: 64 });
    const absAmount = Math.abs(amount);
    const limitCheck = checkAndUseLimit(userId, absAmount);
    if (!limitCheck.allowed) return interaction.reply({ content: `❌ Ліміт! Залишилось: **${limitCheck.remaining}**. Скидання через **${formatTime(limitCheck.resetIn)}**.`, flags: 64 });
    const newCredits = addCredits(targetUser.id, amount);
    const rating = getRating(newCredits);
    const verdict = getPartyVerdict(newCredits);
    const embed = new EmbedBuilder()
      .setColor(verdict.color)
      .setTitle(verdict.title)
      .setDescription(`**${interaction.user.username}** ${amount > 0 ? 'нагородив' : 'покарав'} **${targetUser.username}** на **${amount} балів**.\nНовий рейтинг: **${newCredits}** (${rating.label})\n${verdict.message}`);
    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'socialstats') {
    const targetUser = interaction.options.getUser('user');
    const credits = getCredits(targetUser.id);
    const rating = getRating(credits);
    const embed = new EmbedBuilder()
      .setColor(rating.color)
      .setTitle(`📊 Соціальний рейтинг: ${targetUser.username}`)
      .addFields(
        { name: '⭐ Рейтинг', value: `${credits} балів`, inline: true },
        { name: '🏷 Статус', value: rating.label, inline: true }
      );
    if (rating.legend) embed.addFields({ name: '📜 Привілеї/Покарання', value: rating.legend, inline: false });
    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'socialleaderboard') {
    const db = loadDB();
    const sorted = Object.entries(db.credits).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return interaction.reply({ content: 'Поки що немає даних.', flags: 64 });
    const lines = sorted.map(([id, c], i) => `**${i + 1}.** <@${id}> — ${c} балів`).join('\n');
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Топ-10 громадян').setDescription(lines);
    await interaction.reply({ embeds: [embed] });
  }

  else if (interaction.commandName === 'resetall') {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Тільки власник!', flags: 64 });
    const db = loadDB();
    db.credits = {};
    db.limits = {};
    db.creditCooldown = {};
    db.economy = {};
    db.workCooldown = {};
    saveDB(db);
    await interaction.reply({ content: '✅ Всі дані скинуті!' });
  }
});

registerCommands()
  .catch(err => console.error('❌ Помилка реєстрації команд:', err))
  .then(() => client.login(TOKEN));
