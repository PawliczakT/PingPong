//backend/server/trpc/routers/chat.ts
import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {protectedProcedure, publicProcedure, router,} from '../init';
import {supabaseAsAdmin} from '../../lib/supabaseAdmin';
import {CHAT_MESSAGE_PAGE_SIZE} from '@/constants';
import {
    dispatchSystemNotification,
    SystemNotificationMetadata,
    SystemNotificationType
} from '@/backend/server/trpc/services/notificationService';

// --- Zod Schemas and Types ---
const sendMessageInputSchema = z.object({
    message_content: z.string().min(1).max(1000),
});

const getMessagesInputSchema = z.object({
    cursor: z.string().datetime().optional(),
    limit: z.number().min(1).max(50).default(CHAT_MESSAGE_PAGE_SIZE),
});

const addReactionInputSchema = z.object({
    message_id: z.string().uuid(),
    emoji: z.string().min(1),
});

const removeReactionInputSchema = z.object({
    message_id: z.string().uuid(),
    emoji: z.string().min(1),
});

const getPlayersForMentionInputSchema = z.object({
    query: z.string().min(1).max(50),
});

const sendSystemNotificationInputSchema = z.object({
    type: z.string(), // Używamy string, walidacja konkretnych typów w serwisie
    metadata: z.record(z.any()),
});

const ChatMessageSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid().nullable(),
    message_content: z.string().nullable(),
    created_at: z.string(),
    message_type: z.enum(['user_message', 'system_notification']),
    metadata: z.record(z.any()).nullable().optional(),
    reactions: z.record(z.array(z.string().uuid())).nullable().optional(),
});

const ChatMessageWithProfileSchema = ChatMessageSchema.extend({
    profile: z.object({
        id: z.string(),
        nickname: z.string().nullable(),
        avatar_url: z.string().nullable(),
    }).nullable(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatMessageWithProfile = z.infer<typeof ChatMessageWithProfileSchema>;


// --- Chat Router Definition ---
export const chatRouter = router({
    // Test endpoint
    test: publicProcedure.query(async () => {
        console.log('🧪 Test endpoint called');
        return {success: true, message: 'Backend working!', timestamp: new Date().toISOString()};
    }),

    // Get chat messages with pagination
    getMessages: publicProcedure
        .input(getMessagesInputSchema)
        .output(
            z.object({
                messages: z.array(ChatMessageWithProfileSchema),
                nextCursor: z.string().nullable(),
                total: z.number(),
            })
        )
        .query(async ({input}) => {
            const {cursor, limit} = input;

            let query = supabaseAsAdmin
                .from('chat_messages')
                .select('*, profile:players!user_id(id, nickname, avatar_url)', {count: 'exact'})
                .order('created_at', {ascending: false})
                .limit(limit);

            if (cursor) {
                query = query.lt('created_at', cursor);
            }

            const {data: messages, error, count} = await query;

            if (error) {
                throw new TRPCError({code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch messages'});
            }

            const transformedMessages: ChatMessageWithProfile[] = (messages || []).map(msg => ({
                id: msg.id,
                user_id: msg.user_id,
                message_content: msg.message_content,
                created_at: msg.created_at || new Date().toISOString(),
                message_type: msg.message_type === 'system_notification' ? 'system_notification' : 'user_message',
                metadata: msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata) : null,
                reactions: msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : null,
                profile: msg.profile ? (Array.isArray(msg.profile) ? msg.profile[0] : msg.profile) : null,
            }));

            const nextCursor = messages && messages.length > 0 ? messages[messages.length - 1].created_at : null;

            return {
                messages: transformedMessages,
                nextCursor,
                total: count || 0
            };
        }),

    // Send a new chat message
    sendMessage: protectedProcedure
        .input(sendMessageInputSchema)
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            const {user} = ctx;
            const {message_content} = input;

            const {data, error} = await supabaseAsAdmin
                .from('chat_messages')
                .insert({user_id: user.id, message_content, message_type: 'user_message'})
                .select()
                .single();

            if (error) {
                throw new TRPCError({code: 'INTERNAL_SERVER_ERROR', message: `Database error: ${error.message}`});
            }

            // This assumes 'players' table has a 'user_id' column that is a foreign key to 'auth.users.id'
            const {data: userProfile} = await supabaseAsAdmin
                .from('players')
                .select('id, nickname, avatar_url')
                .eq('user_id', user.id)
                .maybeSingle();

            return {
                id: data.id,
                user_id: data.user_id,
                message_content: data.message_content,
                created_at: data.created_at || new Date().toISOString(),
                message_type: 'user_message',
                metadata: null,
                reactions: null,
                profile: userProfile || null
            };
        }),

    // Add a reaction to a message
    addReaction: protectedProcedure
        .input(addReactionInputSchema)
        // Zmieniono output na pełny profil, aby klient mógł go poprawnie zaktualizować
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            const {user} = ctx;
            const {message_id, emoji} = input;
            const {
                data: message,
                error: fetchError
            } = await supabaseAsAdmin.from('chat_messages').select('reactions').eq('id', message_id).single();
            if (fetchError || !message) throw new TRPCError({code: 'NOT_FOUND', message: 'Message not found.'});
            const currentReactions = (message.reactions as Record<string, string[]>) || {};
            const usersForEmoji = currentReactions[emoji] || [];
            if (!usersForEmoji.includes(user.id)) usersForEmoji.push(user.id);
            currentReactions[emoji] = usersForEmoji;
            const {
                data: updatedMessage,
                error: updateError
            } = await supabaseAsAdmin.from('chat_messages').update({reactions: currentReactions}).eq('id', message_id).select('*, profile:players!user_id(id, nickname, avatar_url)').single();
            if (updateError) throw new TRPCError({code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add reaction.'});
            return updatedMessage as ChatMessageWithProfile;
        }),

    removeReaction: protectedProcedure
        .input(removeReactionInputSchema)
        // Zmieniono output na pełny profil
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            const {user} = ctx;
            const {message_id, emoji} = input;
            const {
                data: message,
                error: fetchError
            } = await supabaseAsAdmin.from('chat_messages').select('reactions').eq('id', message_id).single();
            if (fetchError || !message) throw new TRPCError({code: 'NOT_FOUND', message: 'Message not found.'});
            const currentReactions = (message.reactions as Record<string, string[]>) || {};
            const usersForEmoji = currentReactions[emoji] || [];
            const userIndex = usersForEmoji.indexOf(user.id);
            if (userIndex > -1) usersForEmoji.splice(userIndex, 1);
            if (usersForEmoji.length === 0) delete currentReactions[emoji];
            else currentReactions[emoji] = usersForEmoji;
            const {
                data: updatedMessage,
                error: updateError
            } = await supabaseAsAdmin.from('chat_messages').update({reactions: currentReactions}).eq('id', message_id).select('*, profile:players!user_id(id, nickname, avatar_url)').single();
            if (updateError) throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to remove reaction.'
            });
            return updatedMessage as ChatMessageWithProfile;
        }),

    getPlayersForMention: protectedProcedure
        .input(getPlayersForMentionInputSchema)
        .output(z.array(z.object({id: z.string(), nickname: z.string(), avatar_url: z.string().nullable(),})))
        .query(async ({input}) => {
            const {query} = input;
            const {
                data: players,
                error
            } = await supabaseAsAdmin.from('players').select('id, nickname, avatar_url').ilike('nickname', `%${query}%`).limit(10);
            if (error) {
                console.error('Error fetching players for mention:', error);
                return [];
            }
            return (players || []).map(player => ({
                id: player.id,
                nickname: player.nickname || 'Player',
                avatar_url: player.avatar_url,
            }));
        }),

    // NOWA PROCEDURA DO WYSYŁANIA POWIADOMIEŃ SYSTEMOWYCH
    sendSystemNotification: protectedProcedure
        .input(sendSystemNotificationInputSchema)
        .mutation(async ({input}) => {
            const {type, metadata} = input;
            try {
                // Walidacja i rzutowanie typów, aby upewnić się, że dane są poprawne
                const validatedType = type as SystemNotificationType;
                const validatedMetadata = metadata as SystemNotificationMetadata;

                // Sprawdzenie, czy typ metadanych zgadza się z typem głównym
                if (validatedMetadata.notification_type !== validatedType) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Metadata type does not match the notification type.',
                    });
                }

                await dispatchSystemNotification(validatedType, validatedMetadata);
                return {success: true};
            } catch (error) {
                console.error(`tRPC error in sendSystemNotification:`, error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to send system notification.',
                    cause: error,
                });
            }
        }),
});

export type ChatRouter = typeof chatRouter;
