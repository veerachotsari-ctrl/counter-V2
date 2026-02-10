require("dotenv").config();

/* =====================================================
   🛡️ SAFE AUTO RESTART + ANTI BAN SYSTEM
===================================================== */

// จำกัดจำนวนรี
let restartCount = 0;
let firstCrash = Date.now();

function safeRestart(reason = "Unknown") {

    const now = Date.now();

    // Reset ทุก 24 ชม.
    if (now - firstCrash > 24 * 60 * 60 * 1000) {
        restartCount = 0;
        firstCrash = now;
    }

    restartCount++;

    if (restartCount > 8) {
        console.error("🚫 Restart limit reached (15/day). Stop reboot.");
        return;
    }

    console.error(`♻️ Restarting (${restartCount}/15) | Reason: ${reason}`);

    // Delay กัน Discord rate limit
    setTimeout(() => {
        process.exit(1);
    }, 15000); // 15 วิ
}


// กัน Crash
process.on("uncaughtException", err => {
    console.error("🔥 Uncaught Exception:", err);
    // ไม่ restart ทันที
});

process.on("unhandledRejection", err => {
    console.error("🔥 Unhandled Rejection:", err);
    // ไม่ restart ทันที
});


/* =====================================================
   ❤️ HEARTBEAT + WATCHDOG (ANTI FREEZE)
===================================================== */

let lastAlive = Date.now();

function heartbeat() {
    lastAlive = Date.now();
}


// Watchdog ตรวจทุก 1 นาที
setInterval(() => {

    const diff = Date.now() - lastAlive;

    // เงียบเกิน 15 นาที = พังจริง
    //if (diff > 15 * 60 * 1000) {
    //    safeRestart("Watchdog Timeout");
    //}

}, 60 * 1000);


/* =====================================================
   🤖 DISCORD CLIENT
===================================================== */

const http = require("http");
const https = require("https");
const { Client, GatewayIntentBits } = require("discord.js");

const { initializeWelcomeModule } = require('./welcome.js');
const { initializeCountCase } = require('./CountCase.js');
const { saveLog, initializeLogListener } = require("./logtime.js"); 

const COMMAND_CHANNEL_ID = '1433450340564340889';


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// ===============================
// 🔍 Discord Reconnect Debug
// ===============================

// กำลัง reconnect
client.on("shardReconnecting", (id) => {
    console.warn(`🔄 Reconnecting... (Shard ${id})`);
    console.warn("📌 Time:", new Date().toLocaleString());
});

// หลุดจาก Discord
client.on("shardDisconnect", (event, id) => {
    console.error(`❌ Disconnected (Shard ${id})`);

    if (event) {
        console.error("📌 Code:", event.code);
        console.error("📌 Reason:", event.reason || "No reason");
        console.error("📌 Clean:", event.wasClean);
    }

    console.error("📌 Time:", new Date().toLocaleString());
});

// WebSocket / Network error
client.on("shardError", (error, id) => {
    console.error(`🔥 Shard Error (Shard ${id})`);
    console.error("📌 Message:", error.message);
});

// Session หมดอายุ / Resume ไม่ได้
client.on("invalidated", () => {
    console.error("♻️ Session Invalidated (Token / Resume Failed)");
});

// Client error ทั่วไป
client.on("error", (err) => {
    console.error("🚨 Discord Client Error:", err.message);
});

// ⚠️ เพิ่มอันนี้ (สำคัญ)
client.on("warn", (info) => {
    console.warn("⚠️ Discord Warning:", info);
});


/* =====================================================
   💚 HEARTBEAT SOURCES
===================================================== */

client.on("ready", () => {

    console.log("✅ บอทพร้อมใช้งานแล้ว:", client.user.tag);

    heartbeat();

    // Auto heartbeat กันเงียบ (สำคัญสุด)
    setInterval(() => {
        heartbeat();
    }, 60 * 1000); // ทุก 1 นาที


    // Load modules
    try {
        initializeWelcomeModule(client);
        initializeCountCase(client, COMMAND_CHANNEL_ID);
        initializeLogListener(client);

        console.log("📦 โหลดโมดูลเรียบร้อยแล้ว");
    } catch (e) {
        console.error("Module Error:", e);
        safeRestart("Module Init Failed");
    }
});


client.on("interactionCreate", () => {
    heartbeat();
});

client.on("messageCreate", () => {
    heartbeat();
});


/* =====================================================
   ✨ COMMAND /ออกเวร
===================================================== */

client.on("interactionCreate", async interaction => {

    heartbeat();

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName !== "ออกเวร") return;


    const name = interaction.options.getString("ชื่อ");
    const time = interaction.options.getString("เวลา");

    if (!name || !time) {
        return interaction.reply({
            content: "❌ กรุณากรอกข้อมูลให้ครบ",
            ephemeral: true
        });
    }

    await interaction.reply({
        content: "⏳ กำลังบันทึกข้อมูล...",
        flags: MessageFlags.Ephemeral
    });

    try {

        const ok = await saveLog(name, null, time, null);

        if (ok) {
            await interaction.editReply(
                `✅ บันทึกสำเร็จ\nชื่อ: ${name}\nเวลา: ${time}`
            );
        } else {
            await interaction.editReply("❌ Google Sheet ไม่ตอบสนอง");
        }

    } catch (err) {

        console.error("Save Error:", err);
        await interaction.editReply("❌ เกิดข้อผิดพลาด");

    }
});


/* =====================================================
   📡 KEEP ALIVE (RENDER)
===================================================== */

setInterval(() => {

    if (!process.env.RENDER_EXTERNAL_URL) return;

    https.get(process.env.RENDER_EXTERNAL_URL)
        .on("error", () => {});

}, 5 * 60 * 1000);



http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot Alive");
}).listen(3000);



/* =====================================================
   🚀 LOGIN
===================================================== */

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error("❌ Token missing");
    process.exit(1);
}

console.log("🚀 Logging in...");

client.login(token).catch(err => {

    console.error("Login Error:", err);

    // Login fail ไม่รีรัว
    setTimeout(() => {
        safeRestart("Login Failed");
    }, 120000);
});
