const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Создаем клиента бота
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Инициализируем коллекции для отслеживания кулдаунов (ограничений по времени)
const examCooldowns = new Map();
const mineCooldowns = new Map();

// ── ВАШИ ДАННЫЕ И ФУНКЦИИ БАЗЫ ДАННЫХ ─────────────────────────────────
// (Замени эти заглушки на импорт твоих реальных функций из MongoDB/базы данных)

const EXAM_QUESTIONS = [
  { q: "Как называется столица Китая?", hint: "Это не Шанхай...", answers: ["пекин", "beijing"] },
  { q: "Сколько звёзд на флаге Китая?", hint: "Считай внимательно...", answers: ["5", "пять"] }
];

async function addCredits(userId, amount) {
  console.log(`Добавлено ${amount} соц. кредитов пользователю ${userId}`);
  // Твоя логика сохранения в БД
}

async function addYuan(userId, amount) {
  console.log(`Добавлено ${amount} юаней пользователю ${userId}`);
  // Твоя логика сохранения в БД
}

async function getYuan(userId) {
  // Возвращает баланс юаней из твоей БД. Для теста возвращаем 1000
  return 1000; 
}

async function getExamStreak(userId) { return 0; }
async function setExamStreak(userId, streak) {}
async function giveAchievement(userId, achName) { return null; }

// ── ОБРАБОТЧИК СОБЫТИЙ ───────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // ── /exam_v2_0 (Партийный Экзамен) ──────────────────────
  if (interaction.commandName === 'exam_v2_0') {
    const cooldownTime = 5 * 60 * 1000; // 5 минут в миллисекундах
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
        
        return await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
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
        await addCredits(userId, reward);[cite: 2]
        await addYuan(userId, 200);[cite: 2]

        let streak = await getExamStreak(userId);
        streak++;
        await setExamStreak(userId, streak);

        let achMsg = '';
        if (streak >= 3) {
          const ach = await giveAchievement(userId, 'exam_ace');
          if (ach) achMsg = `\n🏅 **Новое achievement:** ${ach.name} (+${ach.reward} кредитов)`;
          await setExamStreak(userId, 0);
        }

        const winEmbed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('✅ Правильно! Партия одобряет!')
          .setDescription(`Ответ принят!\n⭐ +${reward} соц. кредитов\n💴 +200 юаней` + achMsg);
        await interaction.followUp({ embeds: [winEmbed] });
      } else {
        await addCredits(userId, -300);[cite: 2]
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
    const cooldownTime = 30 * 60 * 1000; // 30 минут КД
    const now = Date.now();

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
        return await interaction.reply({ embeds: [cdEmbed], ephemeral: true });
      }
    }

    mineCooldowns.set(userId, now);

    const ores = [
      { name: '🪨 Обычный булыжник', chance: 0.50, credits: 100, yuan: 10 },
      { name: '🪙 Железная руда', chance: 0.30, credits: 250, yuan: 30 },
      { name: '👑 Золотой самородок', chance: 0.15, credits: 500, yuan: 70 },
      { name: '💎 Нефритовый кристалл', chance: 0.05, credits: 1200, yuan: 200 }
    ];

    const roll = Math.random();
    let selectedOre = ores[0];
    let currentWeight = 0;

    for (const ore of ores) {
      currentWeight += ore.chance;
      if (roll <= currentWeight) {
        selectedOre = ore;
        break;
      }
    }

    await addCredits(userId, selectedOre.credits);
    await addYuan(userId, selectedOre.yuan);

    const mineEmbed = new EmbedBuilder()
      .setColor(0x507d91)
      .setTitle('⛏️ Партийная Шахта')
      .setDescription(`<@${userId}> спустился в забой и усердно махал киркой!\n\n**Твоя добыча:** ${selectedOre.name}\n⭐ +${selectedOre.credits} соц. кредитов\n💴 +${selectedOre.yuan} юаней`);

    await interaction.reply({ embeds: [mineEmbed] });
  }

  // ── /case (Партийный Кейс) ──────────────────────────────
  else if (interaction.commandName === 'case') {
    const casePrice = 500; 
    
    const userYuan = await getYuan(userId); 
    if (userYuan < casePrice) {
      return await interaction.reply({ 
        content: `❌ У тебя недостаточно юаней для покупки кейса! Нужно **${casePrice} 💴**, а у тебя только **${userYuan} 💴**.`, 
        ephemeral: true 
      });
    }

    await addYuan(userId, -casePrice);

    const drops = [
      { name: '📉 Минус-коробка (Упс!)', chance: 0.15, action: async () => { await addCredits(userId, -200); return 'Партия разочарована! **-200 соц. кредитов**'; } },
      { name: '🌾 Пачка риса', chance: 0.45, action: async () => { await addCredits(userId, 150); await addYuan(userId, 50); return 'Обычный обед рабочего. **+150 соц. кредитов** и **+50 юаней**'; } },
      { name: '🐱 Кошко-жена', chance: 0.25, action: async () => { await addCredits(userId, 600); return 'Партия выдала тебе кошко-жену! **+600 соц. кредитов**'; } },
      { name: '🏎️ Новенький ВАЗ-2107', chance: 0.12, action: async () => { await addCredits(userId, 1500); await addYuan(userId, 300); return 'Ударный труд вознагражден! **+1500 соц. кредитов** и **+300 юаней**'; } },
      { name: '👑 Фотография Мао Цзэдуна', chance: 0.03, action: async () => { await addCredits(userId, 5000); return 'ВЕЛИЧАЙШАЯ НАГРАДА! Вы нашли портрет Вождя! **+5000 соц. кредитов!**'; } }
    ];

    const roll = Math.random();
    let selectedDrop = drops[0];
    let currentWeight = 0;

    for (const drop of drops) {
      currentWeight += drop.chance;
      if (roll <= currentWeight) {
        selectedDrop = drop;
        break;
      }
    }

    const resultText = await selectedDrop.action();

    const caseEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('📦 Открытие Партийного Кейса')
      .setDescription(`<@${userId}> потратил **${casePrice} юаней** и открыл секретный ящик...\n\n🎁 **Предмет:** ${selectedDrop.name}\n\n**Эффект:** ${resultText}`);

    await interaction.reply({ embeds: [caseEmbed] });
  }
});

client.login('твой_токен_бота');
