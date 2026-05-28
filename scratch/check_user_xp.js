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

    // Get matching users in user_settings
    const res = await client.query(`
      SELECT user_id, user_name, level, xp, updated_at, stats
      FROM public.user_settings 
      WHERE user_name ILIKE '%megha%' OR user_name ILIKE '%shive%'
    `);
    
    console.log('\nMatching users in public.user_settings:');
    console.log(JSON.stringify(res.rows, null, 2));

    // Also get all entries in leaderboard to see positions
    const leaderboardRes = await client.query(`
      SELECT user_id, user_name, level, xp 
      FROM public.leaderboards 
      ORDER BY level DESC, xp DESC
    `);
    
    console.log('\nLeaderboard Rankings:');
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
