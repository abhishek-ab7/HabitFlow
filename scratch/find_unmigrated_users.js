const { Client } = require('pg');
const fs = require('fs');

// Read DATABASE_URL from .env.local
const envPath = '/home/abhi/Downloads/fedora/habit-tracker/.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const connectionString = dbUrlMatch[1].trim();

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    console.log('Connected to database successfully!');

    // Select all user settings
    const res = await client.query('SELECT user_id, user_name, level, xp FROM public.user_settings');
    console.log(`Total user_settings records: ${res.rows.length}`);
    
    console.log('\nChecking for users needing migration or having incorrect cumulative XP:');
    res.rows.forEach(row => {
      const minCumulativeXp = ((row.level - 1) * row.level / 2) * 100;
      if (row.level > 1 && row.xp < minCumulativeXp) {
        console.log(`❌ USER NEEDS UPDATE: Name: "${row.user_name}", Level: ${row.level}, Current DB XP: ${row.xp}, Min Cumulative XP: ${minCumulativeXp}, Expected XP: ${minCumulativeXp + row.xp}`);
      } else {
        console.log(`✅ OK: Name: "${row.user_name}", Level: ${row.level}, Current DB XP: ${row.xp}`);
      }
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
