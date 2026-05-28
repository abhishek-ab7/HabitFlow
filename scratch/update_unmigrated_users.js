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

    // Fetch all user settings
    const res = await client.query('SELECT user_id, user_name, level, xp FROM public.user_settings');
    
    console.log('\nRunning migration updates directly on public.user_settings:');
    for (const row of res.rows) {
      const minCumulativeXp = ((row.level - 1) * row.level / 2) * 100;
      if (row.level > 1 && row.xp < minCumulativeXp) {
        const newXp = minCumulativeXp + row.xp;
        console.log(`Updating user "${row.user_name}" (ID: ${row.user_id}): Level ${row.level}, XP ${row.xp} -> ${newXp}`);
        
        await client.query(
          'UPDATE public.user_settings SET xp = $1 WHERE user_id = $2',
          [newXp, row.user_id]
        );
      }
    }
    console.log('\nMigration complete!');

    // Fetch updated rankings
    const leaderboardRes = await client.query(`
      SELECT user_id, user_name, level, xp 
      FROM public.leaderboards 
      ORDER BY level DESC, xp DESC
    `);
    
    console.log('\nUpdated Leaderboard Rankings:');
    leaderboardRes.rows.forEach((row, i) => {
      console.log(`${i + 1}. Name: ${row.user_name}, Level: ${row.level}, XP: ${row.xp}, ID: ${row.user_id}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
