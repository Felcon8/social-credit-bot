'use strict';
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const http = require('http');

const {
  connectDB,
  ACHIEVEMENTS_LIST, PICKAXE_TYPES, UPGRADES_DB, RARITY_META, CASES_DB, rollCaseItem,
  getCredits, addCredits,
  getEco, addYuan,
  checkCooldown, checkProfCooldown, checkAndUseLimit,
  getJailRemaining, sendToJail,
  getInjuryRemaining,
  giveAchievement,
  trackShift, checkWorkerOfDayReset,
  getLeaderboard, resetAll,
  incLotteryCount, getExamStreak, setExamStreak,
  getPlayer,
  givePickaxe, addUpgradeToInventory, equipPickaxe, repairActivePickaxe, applyUpgrade, removeUpgrade,
} = require('./database');

// ════════════════════════════════════════════════════════════
// КОНФИГ
// ════════════════════════════════════════════════════════════
const TOKEN            = process.env.TOKEN;
const CLIENT_ID        = process.env.CLIENT_ID;
const GUILD_ID         = process.env.GUILD_ID || '1151160668892975214';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OWNER_ID         = '1528109131704176822';

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

// Keep-alive сервер
http.createServer((req, res) => res.end('Bot v2.0 is alive!')).listen(process.env.PORT || 3000);

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

function formatTime(ms) {
  const h    = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.ceil((ms % 60000) / 1000);
  if (h > 0) return `${h} ч. ${mins} мин.`;
  return mins > 0 ? `${mins} мин. ${secs} сек.` : `${secs} сек.`;
}

function progressBar(current, max, length = 12) {
  const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
  const empty  = length - filled;
  return `[\`${'█'.repeat(filled)}${'░'.repeat(empty)}\`] ${current}/${max}`;
}

// ════════════════════════════════════════════════════════════
// РЕГИСТРАЦИЯ КОМАНД DISCORD V2.0
// ════════════════════════════════════════════════════════════
async function registerCommands() {
  const commands = [
    // ── Сохранённые команды ─────────────────────────────────
    new SlashCommandBuilder().setName('work').setDescription('Работать на заводе Партии'),
    new SlashCommandBuilder().setName('mine').setDescription('⛏️ Использовать активную кирку в шахте'),
    new SlashCommandBuilder().setName('shop').setDescription('Посмотреть магазин Партии'),
    new SlashCommandBuilder().setName('daily').setDescription('Получить ежедневную награду'),
    new SlashCommandBuilder().setName('balance').setDescription('Посмотреть баланс юаней и рейтинг'),
    new SlashCommandBuilder().setName('inventory').setDescription('Посмотреть ваш инвентарь улучшений и кирок'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Топ-10 граждан по соц. рейтингу'),
    new SlashCommandBuilder().setName('case').setDescription('📦 Магазин и открытие кейсов v2.0'),

    new SlashCommandBuilder()
      .setName('pay').setDescription('Передать юани другому гражданину')
      .addUserOption(o => o.setName('target').setDescription('Получатель').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Сумма').setRequired(true)),

    // ── Новые команды кирок ─────────────────────────────────
    new SlashCommandBuilder().setName('pickaxes').setDescription('🔍 Показать все ваши кирки и их слоты'),

    new SlashCommandBuilder()
      .setName('equip').setDescription('🎯 Выбрать активную кирку для работы')
      .addStringOption(o => o.setName('id').setDescription('ID кирки').setRequired(true)),

    new SlashCommandBuilder()
      .setName('applyupgrade').setDescription('⚡ Надеть улучшение на кирку')
      .addStringOption(o => o.setName('pickaxe_id').setDescription('ID кирки').setRequired(true))
      .addStringOption(o => o.setName('upgrade_id').setDescription('ID улучшения из инвентаря').setRequired(true)),

    new SlashCommandBuilder()
      .setName('removeupgrade').setDescription('❌ Снять и уничтожить улучшение с кирки')
      .addStringOption(o => o.setName('pickaxe_id').setDescription('ID кирки').setRequired(true))
      .addIntegerOption(o => o.setName('slot').setDescription('Номер слота (начиная с 1)').setRequired(true)),

    // Админские и дополнительные команды
    new SlashCommandBuilder()
      .setName('socialcredit').setDescription('Админ: изменить соц. рейтинг')
      .addUserOption(o => o.setName('user').setDescription('Игрок').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Количество').setRequired(true)),

    new SlashCommandBuilder().setName('resetall').setDescription('Админ: полный сброс данных'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Все команды V2.0 успешно зарегистрированы!');
  } catch (err) {
    console.error(' Ошибка регистрации команд:', err);
  }
}

// ════════════════════════════════════════════════════════════
// КЛИЕНТ БОТА
// ════════════════════════════════════════════════════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const mineCooldowns = new Map();

client.on('ready', async () => {
  await connectDB();
  await registerCommands();
  console.log(`🤖 Бот v2.0 запущен под именем ${client.user.tag}`);
});

// ════════════════════════════════════════════════════════════
// ОБРАБОТКА ВЗАИМОДЕЙСТВИЙ (INTERACTIONS)
// ════════════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  const userId = interaction.user.id;

  try {
    // ════════════════════════════════════════════════════════
    // ⛏️ КОМАНДА /MINE (ПОЛНОСТЬЮ ОБНОВЛЕНА V2.0)
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'mine') {
      const player = await getPlayer(userId);
      const activePickaxe = player.pickaxes.find(p => p.instanceId === player.activePickaxeId);

      if (!activePickaxe) {
        return interaction.reply({ content: '❌ У вас нет активной кирки! Используйте `/pickaxes` и `/equip`.', flags: 64 });
      }

      if (activePickaxe.durability <= 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Кирка полностью сломана!')
          .setDescription(`Ваша **${PICKAXE_TYPES[activePickaxe.typeKey].name}** нуждается в починке!\nИспользуйте кнопку ниже или почините её.`);

        const repairBtn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('repair_active_pickaxe').setLabel('🔧 Починить за юани').setStyle(ButtonStyle.Success)
        );
        return interaction.reply({ embeds: [embed], components: [repairBtn] });
      }

      // Проверка эффекта "Ускорение майнинга"
      const hasCooldownUpgrade = activePickaxe.upgrades.includes('cooldown_reduction');
      const cooldownMs = hasCooldownUpgrade ? 3000 : 5000;

      const now = Date.now();
      if (mineCooldowns.has(userId)) {
        const exp = mineCooldowns.get(userId) + cooldownMs;
        if (now < exp) {
          const left = Math.ceil((exp - now) / 1000);
          return interaction.reply({ content: `⏳ Кирка ещё остывает! Подождите **${left} сек.**`, flags: 64 });
        }
      }
      mineCooldowns.set(userId, now);

      // Расчёт бонусов и эффектов
      const typeMeta = PICKAXE_TYPES[activePickaxe.typeKey];
      let baseEarnings = Math.floor((Math.random() * 80 + 50) * typeMeta.multiplier * (1 + (activePickaxe.level - 1) * 0.15));
      
      const logs = [];

      // Эффекты улучшений
      if (activePickaxe.upgrades.includes('yield_boost')) {
        baseEarnings = Math.floor(baseEarnings * 1.35);
        logs.push('📈 +35% к добыче');
      }

      if (activePickaxe.upgrades.includes('bonus_money')) {
        baseEarnings += 250;
        logs.push('💵 +250 ¥ богатое месторождение');
      }

      // Критический удар x2
      let isCrit = false;
      if (activePickaxe.upgrades.includes('crit_strike') && Math.random() < 0.25) {
        baseEarnings *= 2;
        isCrit = true;
        logs.push('⚡ **КРИТИЧЕСКИЙ УДАР (x2)!**');
      }

      // Шанс x3 зарплаты
      if (activePickaxe.upgrades.includes('x3_payout') && Math.random() < 0.12) {
        baseEarnings *= 3;
        logs.push('💰 **СВЕРХДОХОД ПАРТИИ (x3)!**');
      }

      // Расчёт износа прочности
      let durLoss = Math.floor(Math.random() * 3) + 1; // 1-3
      if (activePickaxe.upgrades.includes('wear_reduction') && Math.random() < 0.40) {
        durLoss = 0;
        logs.push('🛡️ Прочность сохранена!');
      }

      // Авто-восстановление прочности
      if (activePickaxe.upgrades.includes('auto_repair') && Math.random() < 0.15) {
        activePickaxe.durability = Math.min(activePickaxe.maxDurability, activePickaxe.durability + 3);
        logs.push('🔧 Авто-починка: +3 прочности!');
      } else {
        activePickaxe.durability = Math.max(0, activePickaxe.durability - durLoss);
      }

      // Расчёт опыта кирки
      let xpGained = Math.floor(Math.random() * 10 + 15);
      if (activePickaxe.upgrades.includes('xp_boost')) {
        xpGained *= 2;
        logs.push('🎓 Двойной опыт кирки!');
      }

      activePickaxe.xp += xpGained;
      const xpNeeded = activePickaxe.level * 100;
      let levelUpMsg = '';
      if (activePickaxe.xp >= xpNeeded) {
        activePickaxe.level += 1;
        activePickaxe.xp -= xpNeeded;
        activePickaxe.maxDurability += 50;
        activePickaxe.durability = activePickaxe.maxDurability;
        levelUpMsg = `\n🎉 **УРОБЕНЬ КИРКИ ПОВЫШЕН ДО ${activePickaxe.level}!** (Макс. прочность +50)`;
      }

      // Начисление бесплатного кейса
      let freeCaseMsg = '';
      if (activePickaxe.upgrades.includes('free_case_chance') && Math.random() < 0.05) {
        await addUpgradeToInventory(userId, 'yield_boost', 1);
        freeCaseMsg = '\n📦 **Вам выпало бесплатное улучшение!**';
      }

      await addYuan(userId, baseEarnings);
      player.total_mine_hits = (player.total_mine_hits || 0) + 1;
      await player.save();

      if (player.total_mine_hits >= 100) {
        await giveAchievement(userId, 'mine_master');
      }

      const embed = new EmbedBuilder()
        .setColor(isCrit ? 0xFFD700 : 0x00FF88)
        .setTitle(`⛏️ Добыча киркой: ${typeMeta.name}`)
        .setDescription(
          `Заработанный доход: **+${baseEarnings} юаней**\n` +
          `Прочность: ${progressBar(activePickaxe.durability, activePickaxe.maxDurability)}\n` +
          `Опыт кирки: ${progressBar(activePickaxe.xp, activePickaxe.level * 100)} (Ур. ${activePickaxe.level})\n` +
          (logs.length > 0 ? `\n**Эффекты:**\n` + logs.join('\n') : '') +
          levelUpMsg + freeCaseMsg
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ════════════════════════════════════════════════════════
    // 🔍 КОМАНДА /PICKAXES (СПИСОК КИРОК)
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'pickaxes') {
      const player = await getPlayer(userId);
      const embed = new EmbedBuilder()
        .setColor(0x1E90FF)
        .setTitle(`⚒️ Ваши кирки (${player.pickaxes.length})`)
        .setDescription('Используйте `/equip <id>` для выбора активной кирки.\n---');

      player.pickaxes.forEach((p, idx) => {
        const meta = PICKAXE_TYPES[p.typeKey];
        const isActive = p.instanceId === player.activePickaxeId;
        const upgradeNames = p.upgrades.map(uId => UPGRADES_DB[uId]?.name || uId).join(', ') || 'Нет';

        embed.addFields({
          name: `${isActive ? '✅ [АКТИВНА] ' : ''}${meta.name} (ID: \`${p.instanceId}\`)`,
          value: 
            `**Уровень:** ${p.level} | **Редкость:** ${RARITY_META[meta.rarity].label}\n` +
            `**Прочность:** ${progressBar(p.durability, p.maxDurability)}\n` +
            `**Слоты улучшений (${p.upgrades.length}/${meta.slots}):** ${upgradeNames}`,
          inline: false,
        });
      });

      return interaction.reply({ embeds: [embed] });
    }

    // ════════════════════════════════════════════════════════
    // 🎯 КОМАНДА /EQUIP
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'equip') {
      const pickaxeId = interaction.options.getString('id');
      const pickaxe = await equipPickaxe(userId, pickaxeId);

      if (!pickaxe) {
        return interaction.reply({ content: '❌ Кирка с таким ID не найдена у вас в инвентаре.', flags: 64 });
      }

      const meta = PICKAXE_TYPES[pickaxe.typeKey];
      return interaction.reply({ content: `✅ Вы успешно экипировали **${meta.name}**!` });
    }

    // ════════════════════════════════════════════════════════
    // ⚡ КОМАНДА /APPLYUPGRADE
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'applyupgrade') {
      const pickaxeId = interaction.options.getString('pickaxe_id');
      const upgradeId = interaction.options.getString('upgrade_id');

      const res = await applyUpgrade(userId, pickaxeId, upgradeId);
      if (res.error) return interaction.reply({ content: `❌ ${res.error}`, flags: 64 });

      return interaction.reply({
        content: `✅ Улучшение **${res.upgrade.name}** успешно установлено на кирку! Оно удалено из вашего инвентаря.`
      });
    }

    // ════════════════════════════════════════════════════════
    // ❌ КОМАНДА /REMOVEUPGRADE
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'removeupgrade') {
      const pickaxeId = interaction.options.getString('pickaxe_id');
      const slotIndex = interaction.options.getInteger('slot') - 1;

      const confirmBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm_remove_${pickaxeId}_${slotIndex}`).setLabel('🔥 Уничтожить улучшение').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_remove').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: '⚠️ **ВНИМАНИЕ!** Снятое улучшение будет **ПОЛНОСТЬЮ УНИЧТОЖЕНО** без возможности возврата! Вы уверены?',
        components: [confirmBtn],
        flags: 64
      });
    }

    // ════════════════════════════════════════════════════════
    // 📦 КОМАНДА /CASE
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'case') {
      const eco = await getEco(userId);
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📦 Магазин Кейсов Партии v2.0')
        .setDescription(`Ваш баланс: **${eco.wallet} юаней**\nВыберите кейс для покупки и открытия:`);

      Object.values(CASES_DB).forEach(c => {
        embed.addFields({
          name: `${c.emoji} ${c.name} — ${c.price} ¥`,
          value: `Тип: **${c.type === 'pickaxe' ? 'Кирки' : 'Улучшения'}**`,
          inline: true,
        });
      });

      const row = new ActionRowBuilder().addComponents(
        ...Object.values(CASES_DB).map(c =>
          new ButtonBuilder().setCustomId(`open_case_${c.id}`).setLabel(`${c.name}`).setStyle(ButtonStyle.Primary)
        )
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // ════════════════════════════════════════════════════════
    // 🗂️ КОМАНДА /INVENTORY
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && interaction.commandName === 'inventory') {
      const player = await getPlayer(userId);
      const embed = new EmbedBuilder()
        .setColor(0x9370DB)
        .setTitle(`🗂️ Инвентарь улучшений: ${interaction.user.username}`);

      if (!player.upgradesInventory || player.upgradesInventory.size === 0) {
        embed.setDescription('У вас пока нет свободных улучшений.');
      } else {
        let text = '';
        for (const [uId, qty] of player.upgradesInventory.entries()) {
          const up = UPGRADES_DB[uId];
          if (up) text += `${up.emoji} **${up.name}** (\`${uId}\`) — **${qty} шт.**\n_${up.desc}_\n\n`;
        }
        embed.setDescription(text);
      }

      return interaction.reply({ embeds: [embed] });
    }

    // ════════════════════════════════════════════════════════
    // ОБРАБОТКА НАЖАТИЙ КНОПОК (BUTTONS)
    // ════════════════════════════════════════════════════════
    if (interaction.isButton()) {
      
      // Починка активной кирки по кнопке
      if (interaction.customId === 'repair_active_pickaxe') {
        const res = await repairActivePickaxe(userId);
        if (res.error) return interaction.reply({ content: `❌ ${res.error}`, flags: 64 });
        if (res.alreadyFull) return interaction.reply({ content: '✅ Кирка не нуждается в починке!', flags: 64 });
        return interaction.reply({ content: `🔧 Кирка успешно починена! Потрачено **${res.cost} юаней**.` });
      }

      // Открытие кейсов
      if (interaction.customId.startsWith('open_case_')) {
        const caseId = interaction.customId.replace('open_case_', '');
        const caseMeta = CASES_DB[caseId];
        const eco = await getEco(userId);

        if (eco.wallet < caseMeta.price) {
          return interaction.reply({ content: `❌ Недостаточно юаней! Нужно **${caseMeta.price} ¥**.`, flags: 64 });
        }

        eco.wallet -= caseMeta.price;
        await eco.save();

        const wonItem = rollCaseItem(caseId);
        if (caseMeta.type === 'pickaxe') {
          await givePickaxe(userId, wonItem.id);
        } else {
          await addUpgradeToInventory(userId, wonItem.id, 1);
        }

        const embed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle(`🎉 Вы открыли ${caseMeta.name}!`)
          .setDescription(`Вам выпало: **${wonItem.name}**!\n_${wonItem.desc || 'Добавлено в ваш инвентарь!'}_`);

        return interaction.reply({ embeds: [embed] });
      }

      // Подтверждение уничтожения улучшения
      if (interaction.customId.startsWith('confirm_remove_')) {
        const [, , pickaxeId, slotStr] = interaction.customId.split('_');
        const slotIndex = parseInt(slotStr);

        const res = await removeUpgrade(userId, pickaxeId, slotIndex);
        if (res.error) return interaction.reply({ content: `❌ ${res.error}`, flags: 64 });

        return interaction.update({
          content: `🔥 Улучшение **${res.destroyedUpgrade.name}** снято и **БЕЗВОЗВРАТНО УНИЧТОЖЕНО**!`,
          components: []
        });
      }

      if (interaction.customId === 'cancel_remove') {
        return interaction.update({ content: '❌ Снятие улучшения отменено.', components: [] });
      }
    }

    // ════════════════════════════════════════════════════════
    // СОХРАНЁННЫЕ И ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ
    // ════════════════════════════════════════════════════════
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'work') {
        const cd = await checkCooldown(userId, 'workCooldown', WORK_COOLDOWN_MS);
        if (!cd.allowed) return interaction.reply({ content: `⏳ Смена закончилась! Отдохните **${formatTime(cd.waitMs)}**.`, flags: 64 });
        const earn = Math.floor(Math.random() * 400 + 200);
        await addYuan(userId, earn);
        await trackShift(userId);
        return interaction.reply({ content: `🏭 Вы отработали смену на заводе и получили **+${earn} юаней**!` });
      }

      if (interaction.commandName === 'daily') {
        const cd = await checkCooldown(userId, 'dailyCooldown', DAILY_COOLDOWN_MS);
        if (!cd.allowed) return interaction.reply({ content: `⏳ Следующая награда через **${formatTime(cd.waitMs)}**.`, flags: 64 });
        await addYuan(userId, 1000);
        await addCredits(userId, 300);
        return interaction.reply({ content: '🎁 Ежедневный паёк получен: **+1000 юаней** и **+300 соц. кредитов**!' });
      }

      if (interaction.commandName === 'balance') {
        const credits = await getCredits(userId);
        const eco = await getEco(userId);
        const rating = getRating(credits);
        const embed = new EmbedBuilder().setColor(rating.color)
          .setTitle(`📊 Баланс гражданина: ${interaction.user.username}`)
          .addFields(
            { name: '💴 Юани', value: `${eco.wallet}`, inline: true },
            { name: '⭐ Соц. рейтинг', value: `${credits}`, inline: true },
            { name: '📜 Статус', value: rating.label, inline: false }
          );
        return interaction.reply({ embeds: [embed] });
      }

      if (interaction.commandName === 'pay') {
        const target = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('amount');
        if (target.id === userId || amount <= 0) return interaction.reply({ content: '❌ Некорректный перевод!', flags: 64 });
        const eco = await getEco(userId);
        if (eco.wallet < amount) return interaction.reply({ content: '❌ Недостаточно средств!', flags: 64 });
        eco.wallet -= amount;
        await eco.save();
        await addYuan(target.id, amount);
        return interaction.reply({ content: `💸 Вы успешно перевели **${amount} юаней** пользователю <@${target.id}>.` });
      }

      if (interaction.commandName === 'leaderboard') {
        const top = await getLeaderboard(10);
        const text = top.map((p, i) => `**${i + 1}.** <@${p.userId}> — ${p.credits} баллов`).join('\n');
        const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Топ-10 Граждан').setDescription(text || 'Пусто');
        return interaction.reply({ embeds: [embed] });
      }

      if (interaction.commandName === 'socialcredit') {
        if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только для Администрации!', flags: 64 });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const newCredits = await addCredits(target.id, amount);
        return interaction.reply({ content: `✅ Рейтинг <@${target.id}> изменён на ${amount}. Новый счет: **${newCredits}**.` });
      }

      if (interaction.commandName === 'resetall') {
        if (userId !== OWNER_ID) return interaction.reply({ content: '❌ Только для Владельца!', flags: 64 });
        await resetAll();
        return interaction.reply({ content: '🔥 База данных полностью очищена!' });
      }
    }
  } catch (err) {
    console.error(' Ошибка при обработке взаимодействия:', err);
    if (!interaction.replied) {
      interaction.reply({ content: '❌ Произошла ошибка при выполнении команды.', flags: 64 }).catch(() => {});
    }
  }
});
