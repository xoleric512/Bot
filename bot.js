// bot.js
import { Telegraf } from "telegraf";
import axios from "axios";

// ⚠️ Eslatma: Haqiqiy tokenlarni ishlatmaying!
const BOT_TOKEN = "7689583739:AAEjv-It0EICEVYP48lR7toBnvP8Ba2iwOU";
const HF_KEY = "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";
const HF_MODEL = "microsoft/DialoGPT-medium";

const bot = new Telegraf(BOT_TOKEN);

async function queryHF(prompt) {
  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      { 
        inputs: prompt, 
        parameters: { 
          max_new_tokens: 100,
          temperature: 0.7,
          do_sample: true 
        } 
      },
      {
        headers: { 
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const data = response.data;
    
    if (Array.isArray(data)) {
      if (data[0]?.generated_text) {
        return data[0].generated_text.replace(prompt, "").trim() || "Javob generatsiya qilinmadi";
      }
    }
    
    if (data?.generated_text) {
      return data.generated_text.replace(prompt, "").trim() || "Javob generatsiya qilinmadi";
    }
    
    return "AI javobini qayta ishlashda xatolik";
    
  } catch (error) {
    console.error("HF API xatosi:", error.response?.data || error.message);
    
    if (error.response?.status === 503) {
      return "⚠️ Model hozir yuklanmoqda, biroz kuting va qayta urining...";
    }
    
    if (error.code === 'ECONNABORTED') {
      return "⏰ Vaqt tugadi, qayta urinib ko'ring...";
    }
    
    return "❌ AI bilan bog'lanib bo'lmadi. Keyinroq qayta urining.";
  }
}

// /start buyrug'i - yangi versiya
bot.start((ctx) => {
  const welcomeMessage = `👋 Salom! Men @xolerc tomonidan yaratilgan AI test botman.

🤖 AI ga xush kelibsiz!

✨ Yaratuvchi: @xolerc

📝 Istalgan matn yuboring, suhbat qilaylik!`;

  ctx.reply(welcomeMessage);
});

// /stars buyrug'i - yangi versiya
bot.command("stars", (ctx) => {
  ctx.reply("⭐ Bu bot @xolerc tomonidan yaratilgan.");
});

// /creator buyrug'i qo'shamiz
bot.command("creator", (ctx) => {
  ctx.reply("🎯 Bot yaratuvchisi: @xolerc\n\nUshbu bot AI texnologiyalari bilan ishlashni namoyish qiladi.");
});

// /help buyrug'i
bot.command("help", (ctx) => {
  const helpMessage = `ℹ️ Yordam menyusi:

/start - Botni ishga tushirish va ma'lumot
/stars - Bot haqida qisqacha
/creator - Yaratuvchi haqida
/help - Yordam ko'rsatkichi

📩 Istalgan vaqtda matn xabar yuboring, men AI orqali javob beraman.

Yaratuvchi: @xolerc`;

  ctx.reply(helpMessage);
});

// Oddiy xabarlarni AI ga yuborish
bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  
  // Bot buyruqlarini e'tiborsiz qoldirish
  if (userMessage.startsWith('/')) return;
  
  await ctx.sendChatAction("typing");

  try {
    const aiResponse = await queryHF(userMessage);
    await ctx.reply(aiResponse);
  } catch (error) {
    console.error("Bot xatosi:", error);
    await ctx.reply("❌ Xatolik yuz berdi. Iltimos, keyinroq qayta urining.");
  }
});

// Xatoliklarni qayta ishlash
bot.catch((err, ctx) => {
  console.error(`Bot xatosi ${ctx.updateType}:`, err);
});

// To'g'ri ishga tushirish
bot.launch()
  .then(() => {
    console.log("🚀 @xolerc AI bot muvaffaqiyatli ishga tushdi!");
  })
  .catch((error) => {
    console.error("❌ Botni ishga tushirishda xatolik:", error);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));