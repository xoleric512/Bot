// telegram_ai_bot_new.js
const { Telegraf, Markup } = require('telegraf');
const OpenAI = require('openai');

// --- YANGI KALITLAR ---
const TELEGRAM_TOKEN = "8395679490:AAHqLQ30ADxS2s9_POYHO6Gnzj99w2-BSjg";
const OPENAI_KEY = "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";

// --- Config ---
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 800;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 6;
const RESPONSE_CHUNK_SIZE = 4000;

// Kalitlarni tekshirish
console.log('🔑 Kalitlar tekshirilmoqda...');
console.log('Telegram token uzunligi:', TELEGRAM_TOKEN.length);
console.log('OpenAI key uzunligi:', OPENAI_KEY.length);

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
    console.error('❌ Kalitlar kiritilmagan!');
    process.exit(1);
}

// --- Initialize clients ---
const bot = new Telegraf(TELEGRAM_TOKEN);
// Hugging Face kaliti uchun OpenAIni sozlaymiz
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
    baseURL: 'https://api-inference.huggingface.co/v1/' // Hugging Face endpoint
});

// --- Simple in-memory rate limiter ---
const rateMap = new Map();
function allowRequest(userId) {
    const now = Date.now();
    const rec = rateMap.get(userId) || { count: 0, windowStart: now };
    if (now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
        rec.count = 1;
        rec.windowStart = now;
        rateMap.set(userId, rec);
        return true;
    }
    if (rec.count < RATE_LIMIT_MAX) {
        rec.count += 1;
        rateMap.set(userId, rec);
        return true;
    }
    return false;
}

// --- Helpers ---
function chunkText(text, size) {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
    }
    return chunks;
}

async function callOpenAIChat(userMessage) {
    try {
        console.log('🤖 OpenAI ga soʻrov yuborilmoqda...');
        
        const resp = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
                { 
                    role: 'system', 
                    content: 'Siz foydali va ma\'lumotli AI yordamchisiz. Javoblaringiz aniq, foydali va o\'zbek tilida bo\'lsin.' 
                },
                { role: 'user', content: userMessage }
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.7
        });

        console.log('✅ OpenAI javob qaytdi');

        if (!resp?.choices?.[0]?.message?.content) {
            throw new Error('OpenAI dan notoʻgʻri javob strukturasi');
        }

        return resp.choices[0].message.content.trim();
    } catch (err) {
        console.error('❌ OpenAI soʻrovida xatolik:', err.message);
        
        // Hugging Face uchun maxsus xatoliklar
        if (err.message.includes('401')) {
            throw new Error('Kalit notoʻgʻri yoki muddati oʻtgan');
        } else if (err.message.includes('429')) {
            throw new Error('Soʻrovlar chegarasidan oshib ketdi');
        } else if (err.message.includes('503')) {
            throw new Error('Model hozir ishlamayapti, biroz kutib koʻring');
        }
        
        throw new Error('AI bilan bogʻlanishda xatolik: ' + err.message);
    }
}

// --- Command & handlers ---
bot.start((ctx) => {
    console.log('🚀 Start bosildi:', ctx.from.id);
    return ctx.reply(
        'Assalomu alaykum! 🤖 Men AI yordamchi botman.\n\n' +
        'Istalgan savol yoki matn yuboring, men javob beraman.',
        Markup.inlineKeyboard([
            [Markup.button.callback('📖 Qoʻllanma', 'HELP')],
            [Markup.button.callback('ℹ️ Bot haqida', 'INFO')]
        ])
    );
});

bot.command('help', (ctx) => {
    return ctx.reply(
        '🆘 Yordam\n\n' +
        '• Istalgan matn yuboring - AI javob beradi\n' +
        '• /start - Botni qayta ishga tushirish\n' +
        '• /status - Bot holatini koʻrish\n' +
        '• /help - Yordam\n\n' +
        '📝 Eslatma: Bir daqiqada 6 ta soʻrov chegarasi bor.'
    );
});

bot.action('HELP', (ctx) => {
    ctx.answerCbQuery();
    return ctx.reply('ℹ️ Savolingizni yuboring, men javob beraman!');
});

bot.action('INFO', (ctx) => {
    ctx.answerCbQuery();
    return ctx.reply(
        '🤖 Bot haqida:\n\n' +
        '• AI: OpenAI GPT\n' +
        '• Platforma: Telegram\n' +
        '• Til: Oʻzbek tili\n' +
        '• Yangi kalit bilan ishlamoqda ✅'
    );
});

// Asosiy text handler
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    console.log(`📨 Yangi xabar: ${userId} -> ${userMessage.substring(0, 50)}...`);

    // Tekshirishlar
    if (!userMessage.trim()) {
        return ctx.reply('📝 Iltimos, boʻsh xabar yubormang.');
    }

    if (!allowRequest(userId)) {
        return ctx.reply('⏳ Juda tez-soʻraysiz! Iltimos 1 daqiqa kutib koʻring.');
    }

    // Processing xabari
    let processingMsg;
    try {
        processingMsg = await ctx.reply('🔄 AI javob tayyorlanmoqda...');
    } catch (e) {
        console.log('Processing xabarini yuborishda xatolik');
    }

    try {
        const aiResponse = await callOpenAIChat(userMessage);

        if (!aiResponse) {
            throw new Error('AI javob qaytarmadi');
        }

        // Javobni qismlarga bo'lib yuborish
        const chunks = chunkText(aiResponse, RESPONSE_CHUNK_SIZE);
        for (const chunk of chunks) {
            await ctx.reply(chunk);
        }

        // Processing xabarini o'chirish
        if (processingMsg) {
            try {
                await ctx.deleteMessage(processingMsg.message_id);
            } catch (e) {}
        }

        console.log('✅ Javob muvaffaqiyatli yuborildi');

    } catch (error) {
        console.error('❌ Xatolik:', error.message);

        // Xatolik xabarini yuborish
        let errorMessage = '❌ Xatolik yuz berdi: ' + error.message;
        
        if (error.message.includes('Kalit notoʻgʻri')) {
            errorMessage = '🔑 AI kaliti notoʻgʻri. Iltimos, yangi kalit kiriting.';
        } else if (error.message.includes('chegarasidan')) {
            errorMessage = '📊 Soʻrovlar chegarasidan oshib ketdi. Iltimos, keyinroq urinib koʻring.';
        }

        await ctx.reply(errorMessage);

        // Processing xabarini o'chirish
        if (processingMsg) {
            try {
                await ctx.deleteMessage(processingMsg.message_id);
            } catch (e) {}
        }
    }
});

// Status command
bot.command('status', (ctx) => {
    const userCount = rateMap.size;
    return ctx.reply(
        `🤖 Bot holati: ISHLAYAPTI ✅\n\n` +
        `👥 Faol foydalanuvchilar: ${userCount}\n` +
        `🧠 AI model: ${OPENAI_MODEL}\n` +
        `⚡ Cheklov: ${RATE_LIMIT_MAX} soʻrov / daqiqa\n` +
        `🔑 Kalit: Yangi ✅`
    );
});

// Test command
bot.command('test', async (ctx) => {
    try {
        await ctx.reply('🧪 Test rejimida...');
        const testResponse = await callOpenAIChat('Salom, test uchun javob bering');
        await ctx.reply('✅ Test muvaffaqiyatli: ' + testResponse.substring(0, 100) + '...');
    } catch (error) {
        await ctx.reply('❌ Test muvaffaqiyatsiz: ' + error.message);
    }
});

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 SIGINT - Bot toʻxtatilmoqda...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('🛑 SIGTERM - Bot toʻxtatilmoqda...');
    bot.stop('SIGTERM');
});

// Botni ishga tushirish
console.log('🚀 Bot ishga tushmoqda...');
console.log('📞 Telegram: ' + TELEGRAM_TOKEN.substring(0, 15) + '...');
console.log('🧠 OpenAI: ' + OPENAI_KEY.substring(0, 10) + '...');

bot.launch()
    .then(() => {
        console.log('✅ Bot muvaffaqiyatli ishga tushdi!');
        console.log('⏰ Rate limit: ' + RATE_LIMIT_MAX + ' soʻrov / daqiqa');
        console.log('🤖 Model: ' + OPENAI_MODEL);
    })
    .catch(err => {
        console.error('❌ Bot ishga tushmadi:', err.message);
        console.log('🔄 Qayta urinib koʻring...');
        process.exit(1);
    });

// Memory tozalash
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (let [userId, rec] of rateMap.entries()) {
        if (now - rec.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
            rateMap.delete(userId);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 ${cleaned} foydalanuvchi tozalandi`);
    }
}, 30 * 60 * 1000); // 30 daqiqa

console.log('🎯 Bot kod yuklandi, ishga tushirilmoqda...');