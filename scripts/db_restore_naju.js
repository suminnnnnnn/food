const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('--- RESTORING NAJU RESTAURANTS FROM BACKUP ---');

    const backupPath = 'C:\\Users\\c9611\\.gemini\\antigravity-ide\\brain\\095afa5f-a923-43d1-8579-b4908f3b07a8\\scratch\\db_backup.json';
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found at: ${backupPath}`);
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    console.log(`Loaded backup data. Total restaurants: ${backupData.restaurants.length}`);

    // Filter Naju restaurants
    const najuRestaurants = backupData.restaurants.filter(r => r.address && r.address.includes('나주'));
    console.log(`Found ${najuRestaurants.length} Naju restaurants in backup.`);

    if (najuRestaurants.length === 0) {
      console.log('No Naju restaurants found to restore. Exiting.');
      return;
    }

    const najuRestaurantIds = new Set(najuRestaurants.map(r => r.id));

    // Filter associated restaurant_videos, videos, channels, and embeddings
    const najuRestaurantVideos = backupData.restaurant_videos.filter(rv => najuRestaurantIds.has(rv.restaurant_id));
    const najuVideoIds = new Set(najuRestaurantVideos.map(rv => rv.video_id));
    console.log(`Found ${najuRestaurantVideos.length} restaurant_videos mappings for Naju.`);

    const najuVideos = backupData.videos.filter(v => najuVideoIds.has(v.id));
    const najuChannelIds = new Set(najuVideos.map(v => v.channel_id));
    console.log(`Found ${najuVideos.length} videos associated with Naju.`);

    const najuChannels = backupData.channels.filter(c => najuChannelIds.has(c.id));
    console.log(`Found ${najuChannels.length} channels associated with Naju.`);

    const najuEmbeddings = backupData.restaurant_embeddings.filter(e => najuRestaurantIds.has(e.restaurant_id));
    console.log(`Found ${najuEmbeddings.length} embeddings associated with Naju.`);

    // 1. Restore Channels
    if (najuChannels.length > 0) {
      console.log(`Restoring ${najuChannels.length} channels...`);
      for (const ch of najuChannels) {
        await sql`
          INSERT INTO channels (id, youtube_channel_id, name, profile_image_url, created_at)
          VALUES (${ch.id}, ${ch.youtube_channel_id}, ${ch.name}, ${ch.profile_image_url}, ${ch.created_at})
          ON CONFLICT (youtube_channel_id) DO UPDATE SET
            name = EXCLUDED.name,
            profile_image_url = EXCLUDED.profile_image_url
        `;
      }
    }

    // 2. Restore Videos
    if (najuVideos.length > 0) {
      console.log(`Restoring ${najuVideos.length} videos...`);
      for (const vid of najuVideos) {
        await sql`
          INSERT INTO videos (id, channel_id, series_id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at, created_at)
          VALUES (${vid.id}, ${vid.channel_id}, ${vid.series_id}, ${vid.youtube_video_id}, ${vid.title}, ${vid.thumbnail_url}, ${vid.is_short}, ${vid.view_count}, ${vid.published_at}, ${vid.created_at})
          ON CONFLICT (youtube_video_id) DO UPDATE SET
            title = EXCLUDED.title,
            thumbnail_url = EXCLUDED.thumbnail_url,
            is_short = EXCLUDED.is_short,
            view_count = EXCLUDED.view_count
        `;
      }
    }

    // 3. Restore Restaurants
    console.log(`Restoring ${najuRestaurants.length} restaurants...`);
    for (const rest of najuRestaurants) {
      await sql`
        INSERT INTO restaurants (
          id, kakao_place_id, name, category, address, road_address, lat, lng, 
          created_at, updated_at, is_published, phone, parking, packaging, 
          reservation, business_hours, menu_info
        )
        VALUES (
          ${rest.id}, ${rest.kakao_place_id}, ${rest.name}, ${rest.category}, ${rest.address}, ${rest.road_address}, ${rest.lat}, ${rest.lng},
          ${rest.created_at}, ${rest.updated_at}, ${rest.is_published}, ${rest.phone}, ${rest.parking}, ${rest.packaging},
          ${rest.reservation}, ${rest.business_hours}, ${rest.menu_info}
        )
        ON CONFLICT (kakao_place_id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          road_address = EXCLUDED.road_address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          updated_at = EXCLUDED.updated_at,
          is_published = EXCLUDED.is_published,
          phone = EXCLUDED.phone,
          parking = EXCLUDED.parking,
          packaging = EXCLUDED.packaging,
          reservation = EXCLUDED.reservation,
          business_hours = EXCLUDED.business_hours,
          menu_info = EXCLUDED.menu_info
      `;
    }

    // 4. Restore Restaurant Videos mapping
    if (najuRestaurantVideos.length > 0) {
      console.log(`Restoring ${najuRestaurantVideos.length} mappings...`);
      for (const rv of najuRestaurantVideos) {
        await sql`
          INSERT INTO restaurant_videos (restaurant_id, video_id, mention_time, quote)
          VALUES (${rv.restaurant_id}, ${rv.video_id}, ${rv.mention_time}, ${rv.quote})
          ON CONFLICT (restaurant_id, video_id) DO UPDATE SET
            mention_time = EXCLUDED.mention_time,
            quote = EXCLUDED.quote
        `;
      }
    }

    // 5. Restore Restaurant Embeddings
    if (najuEmbeddings.length > 0) {
      console.log(`Restoring ${najuEmbeddings.length} embeddings...`);
      for (const emb of najuEmbeddings) {
        // e.embedding is already a string formatted like "[0.12, -0.34, ...]"
        await sql`
          INSERT INTO restaurant_embeddings (restaurant_id, embedding, source_text, updated_at)
          VALUES (${emb.restaurant_id}, ${emb.embedding}, ${emb.source_text}, now())
          ON CONFLICT (restaurant_id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            source_text = EXCLUDED.source_text,
            updated_at = now()
        `;
      }
    }

    console.log('🎉 Restoring Naju restaurants completed successfully!');
  } catch (err) {
    console.error('❌ Restore failed:', err);
  } finally {
    await sql.end();
  }
}

run();
