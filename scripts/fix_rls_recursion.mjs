import postgres from 'postgres';

const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const dbUrl = rawUrl.replace('postgresql+asyncpg://', 'postgresql://');

const sql = postgres(dbUrl, {
  ssl: 'require'
});

async function main() {
  try {
    console.log("Creating SECURITY DEFINER helper functions to bypass RLS recursion...");
    
    const functionsSql = `
      -- 1. Helper to check folder owner
      CREATE OR REPLACE FUNCTION is_folder_owner(f_id UUID, u_id UUID)
      RETURNS BOOLEAN
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM user_folders WHERE id = f_id AND creator_id = u_id
        );
      END;
      $$ LANGUAGE plpgsql;

      -- 2. Helper to check folder membership
      CREATE OR REPLACE FUNCTION is_folder_member(f_id UUID, u_id UUID)
      RETURNS BOOLEAN
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM folder_members WHERE folder_id = f_id AND user_id = u_id
        );
      END;
      $$ LANGUAGE plpgsql;

      -- 3. Helper to check folder editor role
      CREATE OR REPLACE FUNCTION is_folder_editor(f_id UUID, u_id UUID)
      RETURNS BOOLEAN
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM user_folders WHERE id = f_id AND creator_id = u_id
        ) OR EXISTS (
          SELECT 1 FROM folder_members WHERE folder_id = f_id AND user_id = u_id AND role IN ('owner', 'editor')
        );
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await sql.unsafe(functionsSql);
    console.log("🎉 Helper functions created successfully!");

    console.log("Recreating user_folders RLS policies...");
    const userFoldersPoliciesSql = `
      DROP POLICY IF EXISTS "Users can select folders they created or are members of" ON user_folders;
      DROP POLICY IF EXISTS "Authenticated users can create folders" ON user_folders;
      DROP POLICY IF EXISTS "Creators can update folders" ON user_folders;
      DROP POLICY IF EXISTS "Creators can delete folders" ON user_folders;

      CREATE POLICY "Users can select folders they created or are members of"
        ON user_folders FOR SELECT
        USING (creator_id = auth.uid() OR is_folder_member(id, auth.uid()));

      CREATE POLICY "Authenticated users can create folders"
        ON user_folders FOR INSERT
        WITH CHECK (auth.uid() = creator_id);

      CREATE POLICY "Creators can update folders"
        ON user_folders FOR UPDATE
        USING (auth.uid() = creator_id);

      CREATE POLICY "Creators can delete folders"
        ON user_folders FOR DELETE
        USING (auth.uid() = creator_id);
    `;
    await sql.unsafe(userFoldersPoliciesSql);
    console.log("🎉 user_folders policies recreated!");

    console.log("Recreating folder_members RLS policies...");
    const folderMembersPoliciesSql = `
      DROP POLICY IF EXISTS "Members can select membership info" ON folder_members;
      DROP POLICY IF EXISTS "Folder creators can manage members" ON folder_members;

      CREATE POLICY "Members can select membership info"
        ON folder_members FOR SELECT
        USING (
          user_id = auth.uid() OR
          is_folder_owner(folder_id, auth.uid()) OR
          is_folder_member(folder_id, auth.uid())
        );

      CREATE POLICY "Folder creators can manage members"
        ON folder_members FOR ALL
        USING (is_folder_owner(folder_id, auth.uid()));
    `;
    await sql.unsafe(folderMembersPoliciesSql);
    console.log("🎉 folder_members policies recreated!");

    console.log("Recreating folder_restaurants RLS policies...");
    const folderRestaurantsPoliciesSql = `
      DROP POLICY IF EXISTS "Users can select items from folders they can access" ON folder_restaurants;
      DROP POLICY IF EXISTS "Folder members and creators can insert items" ON folder_restaurants;
      DROP POLICY IF EXISTS "Folder members and creators can update items" ON folder_restaurants;
      DROP POLICY IF EXISTS "Folder members and creators can delete items" ON folder_restaurants;

      CREATE POLICY "Users can select items from folders they can access"
        ON folder_restaurants FOR SELECT
        USING (is_folder_owner(folder_id, auth.uid()) OR is_folder_member(folder_id, auth.uid()));

      CREATE POLICY "Folder members and creators can insert items"
        ON folder_restaurants FOR INSERT
        WITH CHECK (
          user_id = auth.uid() AND
          is_folder_editor(folder_id, auth.uid())
        );

      CREATE POLICY "Folder members and creators can update items"
        ON folder_restaurants FOR UPDATE
        USING (is_folder_editor(folder_id, auth.uid()));

      CREATE POLICY "Folder members and creators can delete items"
        ON folder_restaurants FOR DELETE
        USING (is_folder_editor(folder_id, auth.uid()));
    `;
    await sql.unsafe(folderRestaurantsPoliciesSql);
    console.log("🎉 folder_restaurants policies recreated!");

  } catch (error) {
    console.error("오류 발생:", error);
  } finally {
    await sql.end();
  }
}

main();
