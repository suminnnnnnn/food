const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nfsezjbsdvqesdbulbic.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mc2V6amJzZHZxZXNkYnVsYmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk5NTUsImV4cCI6MjA5MTE0NTk1NX0.Dajq3RgeeF07SdG0WDMmkRBs3TsnLEdYyB57aBa_9xI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDB() {
  console.log('Clearing database tables for fresh start...');
  
  // restaurant_videos는 복합키이므로 restaurant_id를 기준으로 삭제
  const { error: err1 } = await supabase.from('restaurant_videos').delete().not('restaurant_id', 'is', null);
  if (err1) console.error('Error clearing restaurant_videos:', err1);
  else console.log('Successfully cleared restaurant_videos.');

  const tables = [
    'restaurant_submissions', 
    'restaurants', 
    'videos', 
    'channels'
  ];

  for (const table of tables) {
    console.log(`Attempting to delete all records from ${table}...`);
    // id가 null이 아닌 것 = 모든 행
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null);
      
    if (error) {
      console.error(`Error clearing ${table}:`, error);
    } else {
      console.log(`Successfully cleared ${table}.`);
    }
  }
  
  console.log('Database clearance complete!');
}

clearDB();
