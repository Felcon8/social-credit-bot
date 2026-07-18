const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const http = require('http');

// ========================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = 'ВСТАВЬ_СЮДА_ID_СВОЕГО_СЕРВЕРА'; 
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
    new SlashCommandBuilder().setName('socialcredit').setDescription('Змінити кредити').addUserOption(opt => opt.setName('user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('socialstats').setDescription('Статистика').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('socialleaderboard').setDescription('Топ'),
    new SlashCommandBuilder().setName('resetall').setDescription('Скинути (тільки для адміна)'),
    
    new SlashCommandBuilder().setName('help_v2_0').setDescription('Допомога економіки'),
    new SlashCommandBuilder().setName('work_v2_0').setDescription('Завод'),
    new SlashCommandBuilder().setName('partyshop_v2_0').setDescription('Магазин'),
    new SlashCommandBuilder().setName('profile_v2_0').setDescription('Профіль'),
    new SlashCommandBuilder().setName('buy_v2_0').setDescription('Купити').addStringOption(opt => opt.setName('item').setRequired(true).addChoices({name: '🐱 Кошка-жена (50к)', value: 'cat_wife'}, {name: '🍚 Миска риса (5к)', value: 'rice_bowl'}, {name: '🎟 Лотерея (1к)', value: 'ticket'})),
    new SlashCommandBuilder().setName('steal_v2_0').setDescription('Вкрасти Юані (Штраф: -500 соц. рейтингу при провалі)').addUserOption(opt => opt.setName('target').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Команди v2.0 зареєстровані!');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

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

  else if (interaction.commandName === 'steal_v2_0') {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');

    if (getCredits(userId) < 0) return interaction.reply({ content: '❌ Вороги народу не можуть красти!', ephemeral: true });
    const targetEco = getEco(targetUser.id);
    if (targetEco.wallet < amount) return interaction.reply({ content: '❌ У цілі немає стільки грошей!', ephemeral: true });

    const chance = Math.max(1, Math.floor(5000 / (amount + 150)));
    const confirmEmbed = new EmbedBuilder().setTitle('⚠️ ВНИМАНИЕ: АКТ САБОТАЖА').setDescription(`Шанс успіху: ${chance}%\nШтраф при провалі: -500 соц. кредиту.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('Ризикнути').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel').setLabel('Відміна').setStyle(ButtonStyle.Secondary)
    );
    const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

    try {
      const i = await msg.awaitMessageComponent({ time: 30000 });
      if (i.customId === 'cancel') return i.update({ content: 'Відмінено.', embeds: [], components: [] });
      
      const symbols = ['💰', '🚨', '👮', '💸', '🐱', '💀'];
      for(let j=0; j<4; j++) {
        await i.update({ content: `🎰 **Злом...** [${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]} | ${symbols[Math.floor(Math.random()*6)]}]`, components: [] });
        await new Promise(r => setTimeout(r, 1000));
      }

      if (Math.random() * 100 <= chance) {
        addYuan(targetUser.id, -amount); addYuan(userId, amount);
        await interaction.editReply(`🎰 **УСПІХ!** Ти вкрав ${amount} Юанів.`);
      } else {
        addCredits(userId, -500);
        await interaction.editReply(`🎰 **ПОВАЛ!** Тебе спіймали! Штраф: -500 соц. кредиту.`);
      }
    } catch { interaction.editReply({ content: 'Час вийшов.', components: [] }); }
  }
  
  // Додай решту команд (work, buy, profile) аналогічно...
});

registerCommands().then(() => client.login(TOKEN));
