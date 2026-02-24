require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

console.log("CLIENT_ID:", process.env.CLIENT_ID);
console.log("GUILD_ID:", process.env.GUILD_ID);
console.log("TOKEN loaded:", Boolean(process.env.DISCORD_TOKEN));

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  throw new Error("Missing env vars (DISCORD_TOKEN / CLIENT_ID / GUILD_ID)");
}

const commands = [
  new SlashCommandBuilder()
    .setName("motd")
    .setDescription("Meme of the day")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show bot stats for today")
    .toJSON(),
];



const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log("✅ Registered /motd");
})();




