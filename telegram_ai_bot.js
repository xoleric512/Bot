const { Telegraf, Markup } = require('telegraf');
const OpenAI = require('openai');

// --- Environment variables ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8395679490:AAHqLQ30ADxS2s9_POYHO6Gnzj99w2-BSjg";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "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";

// --- Config ---
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 800;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 6;
const RESPONSE_CHUNK_SIZE = 4000;

// Validation
if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN environment variable required!');
    process.exit(1);
}

if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable required!');
    process.exit(1);
}

console.log('🔑 Environment check:');
console.log('Telegram token length:', TELEGRAM_TOKEN.length);
console.log('OpenAI key length:', OPENAI_KEY.length);

// --- Initialize clients ---
const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
    baseURL: 'https://api-inference.huggingface.co/v1/'
});

// --- Rate limiter ---
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
        console.log('🤖 AI request:', userMessage.substring(0, 100));
        
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

        if (!resp?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from AI');
        }

        return resp.choices[0].message.content.trim();
    } catch (err) {
        console.error('❌ AI error:', err.message);
        throw new Error('AI xizmatida muammo: ' + err.message);
    }
}

// --- Bot handlers ---
bot.start((ctx) => {
    console.log('🚀 Start command from:', ctx.from.id);
    return ctx.reply(
        'Assalomu alaykum! 🤖 Men AI yordamchi botman.\n\n' +
        'Istalgan savol yoki matn yuboring, men javob beraman.',
        Markup.inlineKeyboard([
            [Markup.button.callback('📖 Qoʻllanma', 'HELP')]
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

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    console.log(`📨 Message from ${userId}:`, userMessage.substring(0, 50));

    if (!userMessage.trim()) {
        return ctx.reply('📝 Iltimos, boʻsh xabar yubormang.');
    }

    if (!allowRequest(userId)) {
        return ctx.reply('⏳ Juda tez-soʻraysiz! Iltimos 1 daqiqa kutib koʻring.');
    }

    let processingMsg;
    try {
        processingMsg = await ctx.reply('🔄 AI javob tayyorlanmoqda...');
    } catch (e) {
        console.log('Processing message error');
    }

    try {
        const aiResponse = await callOpenAIChat(userMessage);

        const chunks = chunkText(aiResponse, RESPONSE_CHUNK_SIZE);
        for (const chunk of chunks) {
            await ctx.reply(chunk);
        }

        if (processingMsg) {
            try {
                await ctx.deleteMessage(processingMsg.message_id);
            } catch (e) {}
        }

        console.log('✅ Response sent to', userId);

    } catch (error) {
        console.error('❌ Handler error:', error.message);
        await ctx.reply('❌ Xatolik yuz berdi: ' + error.message);

        if (processingMsg) {
            try {
                await ctx.deleteMessage(processingMsg.message_id);
            } catch (e) {}
        }
    }
});

bot.command('status', (ctx) => {
    const userCount = rateMap.size;
    return ctx.reply(
        `🤖 Bot holati: ISHLAYAPTI ✅\n\n` +
        `👥 Faol foydalanuvchilar: ${userCount}\n` +
        `🧠 AI model: ${OPENAI_MODEL}\n` +
        `⚡ Cheklov: ${RATE_LIMIT_MAX} soʻrov / daqiqa\n` +
        `🌐 Host: Railway`
    );
});

// Health check endpoint for Railway
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running', 
        users: rateMap.size,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Start bot
console.log('🚀 Starting Telegram AI Bot...');
bot.launch()
    .then(() => {
        console.log('✅ Bot started successfully on Railway!');
    })
    .catch(err => {
        console.error('❌ Bot failed to start:', err);
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Clean memory every 30 minutes
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
        console.log(`🧹 Cleaned ${cleaned} users from memory`);
    }
}, 30 * 60 * 1000);