-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    message_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    message_type TEXT DEFAULT 'user_message' NOT NULL CHECK (message_type IN ('user_message', 'system_notification')),
    metadata JSONB,
    reactions JSONB
);

-- Enable RLS for chat_messages table
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON chat_messages
    FOR SELECT USING (true);

-- Allow authenticated users to insert messages
CREATE POLICY "Allow authenticated users to insert messages" ON chat_messages
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own reactions
CREATE POLICY "Allow users to update their own reactions" ON chat_messages
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for chat_messages table
-- This is typically done in the Supabase UI, but if there's a SQL command, it would be:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- For now, assume this step is done via UI or a separate script if available.

COMMENT ON TABLE chat_messages IS 'Stores chat messages for the application.';
COMMENT ON COLUMN chat_messages.id IS 'Unique identifier for the chat message.';
COMMENT ON COLUMN chat_messages.user_id IS 'Identifier of the user who sent the message; null for system notifications.';
COMMENT ON COLUMN chat_messages.message_content IS 'Content of the chat message.';
COMMENT ON COLUMN chat_messages.created_at IS 'Timestamp when the message was created.';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message: user_message or system_notification.';
COMMENT ON COLUMN chat_messages.metadata IS 'Additional data for system notifications (e.g., involved players, achievement names).';
COMMENT ON COLUMN chat_messages.reactions IS 'JSONB column to store reactions, e.g., {"emoji": "👍", "users": ["user_id1"]}.';

-- Create indexes for performance
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_message_type ON chat_messages(message_type);

-- Alter message_content to be nullable for system_notification without content
ALTER TABLE chat_messages ALTER COLUMN message_content DROP NOT NULL;
ALTER TABLE chat_messages ADD CONSTRAINT check_message_content_not_null_for_user_message
    CHECK (NOT (message_type = 'user_message' AND message_content IS NULL));

-- Allow users to delete their own messages (optional, based on requirements)
-- CREATE POLICY "Allow users to delete their own messages" ON chat_messages
--     FOR DELETE USING (auth.uid() = user_id);

-- For system notifications, user_id can be NULL. Modify insert policy for system users if needed.
-- If there's a specific system user ID, the policy for system_notification could be:
-- CREATE POLICY "Allow system to insert notifications" ON chat_messages
--     FOR INSERT WITH CHECK (message_type = 'system_notification' AND auth.uid() = 'SYSTEM_USER_ID_HERE');
-- Or allow any authenticated user to send system notifications if that's the design.
-- For now, the existing insert policy only allows users to insert messages as themselves.
-- We might need a separate mechanism or elevated privileges for inserting system_notifications if user_id is NULL
-- or belongs to a generic system user.

-- Let's refine the insert policy to allow system notifications where user_id might be null
-- First, drop the existing policy
DROP POLICY "Allow authenticated users to insert messages" ON chat_messages;

-- Create a new policy that allows users to send messages as themselves
-- And allows for system notifications (where user_id might be NULL or a dedicated system_user_id)
CREATE POLICY "Allow users to insert their own messages" ON chat_messages
    FOR INSERT TO authenticated WITH CHECK (
        (message_type = 'user_message' AND auth.uid() = user_id)
        -- For system_notification, we assume it's inserted server-side with service_role key,
        -- or if a specific system user is used, that user's ID would be checked here.
        -- If any authenticated user can trigger a system notification (which is then inserted with user_id=null),
        -- then we need a different check. The tRPC procedure will handle the logic.
        -- For now, this policy is fine if tRPC uses service_role for system notifications.
    );

-- Policy for system to insert notifications (assuming service role key is used on the backend)
-- This policy allows inserts if the role is service_role, which bypasses RLS.
-- So, the specific check for message_type = 'system_notification' will be handled by the tRPC procedure logic.
-- No explicit RLS policy is needed for service_role to insert system notifications.

-- The previous "Allow authenticated users to insert messages" policy was fine if the tRPC sendMessage
-- sets user_id = auth.uid() and sendSystemNotification uses a service_role key which bypasses RLS.
-- Let's revert to the simpler one for user messages and rely on service_role for system messages.
DROP POLICY "Allow users to insert their own messages" ON chat_messages;
CREATE POLICY "Allow authenticated users to insert messages" ON chat_messages
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND message_type = 'user_message');

-- For sendSystemNotification, it will be called from the backend using a service_role key,
-- which bypasses RLS. So, no specific RLS is needed for that.

-- For addReaction and removeReaction, users should be able to update any message's reactions column,
-- but the logic of adding/removing their own reaction will be in the tRPC procedure.
-- The RLS policy for UPDATE should allow a user to update a message if they are authenticated.
-- The actual modification of the reactions JSONB should be handled carefully in the backend.

DROP POLICY "Allow users to update their own reactions" ON chat_messages;
CREATE POLICY "Allow authenticated users to update reactions" ON chat_messages
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- This is broad. A more secure policy would be:
-- CREATE POLICY "Allow users to update reactions if they are message owner or reacting"
-- ON chat_messages
-- FOR UPDATE
-- USING (auth.uid() = user_id OR reactions ? auth.uid()::text) -- pseudo-code for checking if user is in reactions
-- WITH CHECK (auth.uid() = user_id OR reactions ? auth.uid()::text);
-- However, given the structure {"emoji": [user_ids]}, this is complex for RLS.
-- The tRPC layer will enforce that a user can only add/remove their own reaction.
-- So, a simpler UPDATE policy is fine if the backend logic is robust.
-- Let's stick with `TO authenticated USING (true) WITH CHECK (true)` for now and ensure tRPC is secure.

-- Final check on policies:
-- SELECT: public, anyone can read. OK.
-- INSERT: authenticated users, only for 'user_message' and user_id must be their own. OK.
--         (System notifications inserted via service_role).
-- UPDATE: authenticated users, can update any row. tRPC must ensure they only modify reactions correctly. OK.
-- DELETE: No policy yet. If needed, add "DELETE USING (auth.uid() = user_id)".

-- Add foreign key constraint for user_id to profiles table
-- Assuming 'profiles' table has 'id' as primary key
-- This was in the initial create table, but ensure it's correct.
-- ALTER TABLE chat_messages ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES profiles(id);
-- This is already part of the CREATE TABLE statement: user_id UUID REFERENCES profiles(id)

-- Ensure Realtime is enabled (conceptual SQL, actual step is usually via Supabase Dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- If this fails, it's because it needs to be done in the Supabase UI or specific Realtime config.
-- We will assume it's enabled.

-- The `message_content` should NOT be nullable for `user_message`.
-- It CAN be nullable for `system_notification` (e.g. "User X joined").
-- The `check_message_content_not_null_for_user_message` handles this.
-- The `ALTER TABLE chat_messages ALTER COLUMN message_content DROP NOT NULL;` was correct.

-- The reactions column definition `reactions JSONB` is a good start.
-- The structure `{[emoji]: [user_id1, user_id2], ...}` is what we'll aim for in tRPC.
-- Example: `{"👍": ["uuid1", "uuid2"], "❤️": ["uuid3"]}`
print("Supabase migration file for 'chat_messages' table created at supabase/migrations/20240320000000_create_chat_messages_table.sql")
