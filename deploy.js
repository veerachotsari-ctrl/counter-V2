require("dotenv").config();
const { REST, Routes } = require("discord.js");

// ใส่คำสั่งทั้งหมดที่คุณมี
const commands = [
    {
        name: "restorecount",
        description: "กู้ปุ่มนับข้อความกลับมา"
    },
    {
        name: "ออกเวร",
        description: "บันทึกเวลาออกเวร",
        options: [
            {
                name: "ชื่อ",
                description: "ชื่อผู้ปฏิบัติงาน",
                type: 3,
                required: true
            },
            {
                name: "เวลา",
                description: "เวลาออกเวร",
                type: 3,
                required: true
            }
        ]
    }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("⏳ Deploying commands...");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("✅ Commands deployed!");
    } catch (err) {
        console.error("❌ Deploy error:", err);
    }
})();
