const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nfsezjbsdvqesdbulbic.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mc2V6amJzZHZxZXNkYnVsYmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk5NTUsImV4cCI6MjA5MTE0NTk1NX0.Dajq3RgeeF07SdG0WDMmkRBs3TsnLEdYyB57aBa_9xI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
  const { count: restaurantCount } = await supabase.from('restaurants').select('*', { count: 'exact', head: true });
  console.log(`Current restaurants count: ${restaurantCount}`);
}

checkDB();
