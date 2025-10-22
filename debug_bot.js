// debug_bot.js
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

console.log('🔍 Debug mode started...');

// Tokenlarni tekshirish
const TELEGRAM_TOKEN = "8395679490:AAHqLQ30ADxS2s9_POYHO6Gnzj99w2-BSjg";
const OPENAI_KEY = "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";

console.log('📋 Token lengths:', {
  telegram: TELEGRAM_TOKEN.length,
  openai: OPENAI_KEY.length
});

async function testBot() {
  try {
    console.log('1. Testing Telegram token...');
    const bot = new Telegraf(TELEGRAM_TOKEN);
    const me = await bot.telegram.getMe();
    console.log('✅ Telegram: OK -', me.first_name);

    console.log('2. Testing OpenAI...');
    const openai = new OpenAI({ apiKey: OPENAI_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Salom, test" }],
      max_tokens: 10
    });
    console.log('✅ OpenAI: OK');

    console.log('3. Starting bot...');
    
    bot.start((ctx) => {
      console.log('🎯 Start command received');
      ctx.reply('Debug bot ishga tushdi! ✅');
    });

    bot.on('text', (ctx) => {
      console.log('📨 Message:', ctx.message.text);
      ctx.reply('Qabul qilindi: ' + ctx.message.text);
    });

    await bot.launch();
    console.log('🎉 Bot muvaffaqiyatli ishga tushdi!');
    
  } catch (error) {
    console.log('❌ Xatolik:', error.message);
    console.log('🔧 Stack:', error.stack);
  }
}

testBot();