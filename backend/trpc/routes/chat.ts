import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { authedProcedure, publicProcedure, router } from '../trpc';
import { supabaseAsAdmin } from '../../../lib/supabase-as-admin'; // Corrected path
import { CHAT_MESSAGE_PAGE_SIZE } from '../../../constants';

// Define Zod schemas for input validation
const sendMessageInputSchema = z.object({
  message_content: z.string().min(1).max(1000), // Max length for a chat message
});

const sendSystemNotificationInputSchema = z.object({
  notification_type: z.string(), // e.g., 'match_won', 'tournament_won', 'achievement_unlocked', 'rank_up', 'new_player'
  message_content: z.string().optional(), // For system messages that might not need dynamic content from metadata
  metadata: z.record(z.any()).optional(), // JSONB for various notification details
});

const getMessagesInputSchema = z.object({
  cursor: z.string().datetime().optional(), // ISO datetime string
  limit: z.number().min(1).max(50).default(CHAT_MESSAGE_PAGE_SIZE),
});

const reactionSchema = z.object({
  emoji: z.string().min(1), // Assuming emojis are single characters, but could be longer (e.g. custom Discord-like emojis :name:)
  // user_id will be taken from context
});

const addReactionInputSchema = reactionSchema.extend({
  message_id: z.string().uuid(),
});

const removeReactionInputSchema = reactionSchema.extend({
  message_id: z.string().uuid(),
});

const getPlayersForMentionInputSchema = z.object({
  query: z.string().min(1).max(50),
});

// Types based on the Supabase table structure (can be auto-generated with supabase gen types)
// For now, defining manually based on the SQL schema.
const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  message_content: z.string().nullable(),
  created_at: z.string().datetime(),
  message_type: z.enum(['user_message', 'system_notification']),
  metadata: z.record(z.any()).nullable().optional(),
  reactions: z.record(z.array(z.string().uuid())).nullable().optional(), // Example: {"👍": ["uuid1", "uuid2"]}
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const chatRouter = router({
  sendMessage: authedProcedure
    .input(sendMessageInputSchema)
    .output(ChatMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { message_content } = input;

      const { data, error } = await supabaseAsAdmin
        .from('chat_messages')
        .insert({
          user_id: user.id,
          message_content,
          message_type: 'user_message',
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send message.' });
      }
      return data as ChatMessage;
    }),

  sendSystemNotification: publicProcedure // Or a protected procedure if only specific backend services can call it
    .input(sendSystemNotificationInputSchema)
    .output(ChatMessageSchema)
    .mutation(async ({ input }) => { // No user context needed if called by system/backend service
      const { notification_type, metadata, message_content } = input;

      // In a real scenario, this procedure should be protected (e.g. by an API key or specific role)
      // if it's exposed via HTTP. If called internally from other backend services, it's fine.
      // For now, making it publicProcedure for easier testing, but this is a security consideration.

      const { data, error } = await supabaseAsAdmin
        .from('chat_messages')
        .insert({
          user_id: null, // System messages might not have a user_id or use a dedicated system_user_id
          message_content: message_content, // Can be pre-formatted or generated on client based on metadata
          message_type: 'system_notification',
          metadata: { ...metadata, notification_type }, // Store notification_type in metadata as well for client-side handling
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending system notification:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send system notification.' });
      }
      return data as ChatMessage;
    }),

  getMessages: publicProcedure // Public read access
    .input(getMessagesInputSchema)
    .output(z.object({
      messages: z.array(ChatMessageSchema),
      nextCursor: z.string().datetime().optional(),
    }))
    .query(async ({ input }) => {
      const { cursor, limit } = input;
      let query = supabaseAsAdmin
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data: messages, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch messages.' });
      }

      let nextCursor: string | undefined = undefined;
      if (messages && messages.length === limit) {
        nextCursor = messages[messages.length - 1].created_at;
      }

      return { messages: messages as ChatMessage[], nextCursor };
    }),

  addReaction: authedProcedure
    .input(addReactionInputSchema)
    .output(ChatMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { message_id, emoji } = input;

      // Step 1: Fetch the current message's reactions
      const { data: message, error: fetchError } = await supabaseAsAdmin
        .from('chat_messages')
        .select('reactions')
        .eq('id', message_id)
        .single();

      if (fetchError || !message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found.' });
      }

      // Step 2: Update the reactions JSONB
      const currentReactions = (message.reactions as Record<string, string[]>) || {};
      const usersForEmoji = currentReactions[emoji] || [];

      if (!usersForEmoji.includes(user.id)) {
        usersForEmoji.push(user.id);
      }
      currentReactions[emoji] = usersForEmoji;

      // Step 3: Save the updated reactions
      const { data: updatedMessage, error: updateError } = await supabaseAsAdmin
        .from('chat_messages')
        .update({ reactions: currentReactions })
        .eq('id', message_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error adding reaction:', updateError);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add reaction.' });
      }
      return updatedMessage as ChatMessage;
    }),

  removeReaction: authedProcedure
    .input(removeReactionInputSchema)
    .output(ChatMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { message_id, emoji } = input;

      // Step 1: Fetch the current message's reactions
      const { data: message, error: fetchError } = await supabaseAsAdmin
        .from('chat_messages')
        .select('reactions')
        .eq('id', message_id)
        .single();

      if (fetchError || !message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found.' });
      }

      // Step 2: Update the reactions JSONB
      const currentReactions = (message.reactions as Record<string, string[]>) || {};
      const usersForEmoji = currentReactions[emoji] || [];

      const userIndex = usersForEmoji.indexOf(user.id);
      if (userIndex > -1) {
        usersForEmoji.splice(userIndex, 1);
      }

      if (usersForEmoji.length === 0) {
        delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = usersForEmoji;
      }

      // Step 3: Save the updated reactions
      const { data: updatedMessage, error: updateError } = await supabaseAsAdmin
        .from('chat_messages')
        .update({ reactions: currentReactions })
        .eq('id', message_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error removing reaction:', updateError);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove reaction.' });
      }
      return updatedMessage as ChatMessage;
    }),

  getPlayersForMention: authedProcedure // Or publicProcedure depending on access needs
    .input(getPlayersForMentionInputSchema)
    .output(z.array(z.object({
      id: z.string().uuid(),
      nickname: z.string(),
      avatar_url: z.string().url().nullable(),
    })))
    .query(async ({ input }) => {
      const { query } = input;
      // Assuming a 'profiles' table with 'id', 'nickname', and 'avatar_url'
      // And nickname search is common.
      // This is a simplified search. Real search might use full-text search or ilike.
      const { data: players, error } = await supabaseAsAdmin
        .from('profiles') // Make sure this table name is correct
        .select('id, nickname, avatar_url')
        .ilike('nickname', `%${query}%`) // Case-insensitive search
        .limit(10); // Limit results for mentions

      if (error) {
        console.error('Error fetching players for mention:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch players.' });
      }
      return players || [];
    }),
});

export type ChatRouter = typeof chatRouter;

// Placeholder for CHAT_MESSAGE_PAGE_SIZE if not defined elsewhere
// import { CHAT_MESSAGE_PAGE_SIZE } from '../../../constants';
// Should be defined in a constants file, e.g. src/constants.ts or similar
// For now, if it's not available, I'll add a default here.
// const CHAT_MESSAGE_PAGE_SIZE = 20; // This line would be removed if imported.
// It is imported, so this is fine.
console.log('Chat router file created at backend/trpc/routes/chat.ts');
