// backend/server/trpc/routers/chat.ts
import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {protectedProcedure, publicProcedure, router} from '../init';
import {supabaseAsAdmin} from '../../lib/supabaseAdmin';
import {CHAT_MESSAGE_PAGE_SIZE} from '../../../../constants';
import {
    dispatchSystemNotification,
    SystemNotificationMetadata,
    SystemNotificationType
} from '@/services/notificationService';

// Input schemas
const sendMessageInputSchema = z.object({
    message_content: z.string().min(1).max(1000),
});

const getMessagesInputSchema = z.object({
    cursor: z.string().optional().refine((val) => {
        if (!val) return true;
        return !isNaN(Date.parse(val));
    }, {
        message: "Invalid datetime format"
    }),
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
    type: z.string(),
    metadata: z.record(z.any()),
});

// Output schemas
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

// Helper function for error handling
const handleDatabaseError = (error: any, operation: string) => {
    console.error(`❌ Database error in ${operation}:`, error);
    throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Database error: ${error.message}`,
        cause: error,
    });
};

export const chatRouter = router({
    // Test endpoint for debugging
    test: publicProcedure.query(async () => {
        try {
            console.log('🧪 Test endpoint called');

            // Test database connection
            const {data, error} = await supabaseAsAdmin
                .from('chat_messages')
                .select('count')
                .limit(1);

            if (error) {
                console.error('❌ Database connection test failed:', error);
                return {
                    success: false,
                    message: 'Database connection failed!',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }

            console.log('✅ Database connection test successful');
            return {
                success: true,
                message: 'Backend working! Database connected.',
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            console.error('❌ Test endpoint error:', error);
            return {
                success: false,
                message: 'Backend error!',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }),

    // Get messages with pagination
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
            try {
                console.log('🔍 getMessages started with input:', input);

                const {cursor, limit} = input;

                console.log('🔍 Building Supabase query...');
                let query = supabaseAsAdmin
                    .from('chat_messages')
                    .select('*, profile:players!chat_messages_user_id_fkey(id, nickname, avatar_url)')
                    .order('created_at', {ascending: false})
                    .limit(limit);

                if (cursor) {
                    console.log('🔍 Adding cursor filter:', cursor);
                    query = query.lt('created_at', cursor);
                }

                console.log('🔍 Executing Supabase query...');
                const {data: messages, error, count} = await query;

                if (error) {
                    console.error('❌ Supabase query error:', error);
                    handleDatabaseError(error, 'getMessages');
                }

                console.log('✅ Query successful, got', messages?.length || 0, 'messages');

                // Transform messages
                const transformedMessages: ChatMessageWithProfile[] = (messages || []).map(msg => {
                    try {
                        return {
                            id: msg.id,
                            user_id: msg.user_id,
                            message_content: msg.message_content,
                            created_at: msg.created_at || new Date().toISOString(),
                            message_type: msg.message_type === 'system_notification' ? 'system_notification' : 'user_message',
                            metadata: msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata) : null,
                            reactions: msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : null,
                            profile: msg.profile ? (Array.isArray(msg.profile) ? msg.profile[0] : msg.profile) : null,
                        };
                    } catch (transformError) {
                        console.error('❌ Error transforming message:', msg.id, transformError);
                        // Return message with safe defaults
                        return {
                            id: msg.id,
                            user_id: msg.user_id,
                            message_content: msg.message_content,
                            created_at: msg.created_at || new Date().toISOString(),
                            message_type: 'user_message',
                            metadata: null,
                            reactions: null,
                            profile: null,
                        };
                    }
                });

                const nextCursor = messages && messages.length > 0 ? messages[messages.length - 1].created_at : null;

                console.log('✅ getMessages completed successfully');
                return {
                    messages: transformedMessages,
                    nextCursor,
                    total: count || 0
                };

            } catch (error: any) {
                console.error('❌ getMessages error:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to fetch messages: ${error.message}`,
                    cause: error,
                });
            }
        }),

    // Send a new message
    sendMessage: protectedProcedure
        .input(sendMessageInputSchema)
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            try {
                console.log('🚀 sendMessage started for user:', ctx.user.id);

                const {user} = ctx;
                const {message_content} = input;

                // Validate message content
                if (!message_content.trim()) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Message content cannot be empty',
                    });
                }

                console.log('🔍 Inserting message into database...');
                const {data, error} = await supabaseAsAdmin
                    .from('chat_messages')
                    .insert({
                        user_id: user.id,
                        message_content: message_content.trim(),
                        message_type: 'user_message'
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Error inserting message:', error);
                    handleDatabaseError(error, 'sendMessage');
                }

                console.log('🔍 Fetching user profile...');
                const {data: userProfile, error: profileError} = await supabaseAsAdmin
                    .from('players')
                    .select('id, nickname, avatar_url')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (profileError) {
                    console.warn('⚠️ Error fetching user profile:', profileError);
                }

                const result = {
                    id: data.id,
                    user_id: data.user_id,
                    message_content: data.message_content,
                    created_at: data.created_at || new Date().toISOString(),
                    message_type: 'user_message' as const,
                    metadata: null,
                    reactions: null,
                    profile: userProfile || null
                };

                console.log('✅ sendMessage completed successfully:', result.id);
                return result;

            } catch (error: any) {
                console.error('❌ sendMessage error:', error);
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to send message: ${error.message}`,
                    cause: error,
                });
            }
        }),

    // Add reaction to message
    addReaction: protectedProcedure
        .input(addReactionInputSchema)
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            try {
                console.log('👍 addReaction started:', input);

                const {user} = ctx;
                const {message_id, emoji} = input;

                // Get current message
                const {data: message, error: fetchError} = await supabaseAsAdmin
                    .from('chat_messages')
                    .select('reactions')
                    .eq('id', message_id)
                    .single();

                if (fetchError || !message) {
                    console.error('❌ Message not found:', message_id, fetchError);
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Message not found.'
                    });
                }

                // Update reactions
                const currentReactions = (message.reactions as Record<string, string[]>) || {};
                const usersForEmoji = currentReactions[emoji] || [];

                if (!usersForEmoji.includes(user.id)) {
                    usersForEmoji.push(user.id);
                    currentReactions[emoji] = usersForEmoji;

                    // Update message with new reactions
                    const {data: updatedMessage, error: updateError} = await supabaseAsAdmin
                        .from('chat_messages')
                        .update({reactions: currentReactions})
                        .eq('id', message_id)
                        .select('*, profile:players!user_id(id, nickname, avatar_url)')
                        .single();

                    if (updateError) {
                        console.error('❌ Error updating reactions:', updateError);
                        handleDatabaseError(updateError, 'addReaction');
                    }

                    console.log('✅ addReaction completed successfully');
                    return updatedMessage as ChatMessageWithProfile;
                }

                // User already reacted, return current message
                const {data: currentMessage, error: currentError} = await supabaseAsAdmin
                    .from('chat_messages')
                    .select('*, profile:players!user_id(id, nickname, avatar_url)')
                    .eq('id', message_id)
                    .single();

                if (currentError) {
                    handleDatabaseError(currentError, 'addReaction');
                }

                return currentMessage as ChatMessageWithProfile;

            } catch (error: any) {
                console.error('❌ addReaction error:', error);
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to add reaction: ${error.message}`,
                    cause: error,
                });
            }
        }),

    // Remove reaction from message
    removeReaction: protectedProcedure
        .input(removeReactionInputSchema)
        .output(ChatMessageWithProfileSchema)
        .mutation(async ({ctx, input}) => {
            try {
                console.log('👎 removeReaction started:', input);

                const {user} = ctx;
                const {message_id, emoji} = input;

                // Get current message
                const {data: message, error: fetchError} = await supabaseAsAdmin
                    .from('chat_messages')
                    .select('reactions')
                    .eq('id', message_id)
                    .single();

                if (fetchError || !message) {
                    console.error('❌ Message not found:', message_id, fetchError);
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Message not found.'
                    });
                }

                // Update reactions
                const currentReactions = (message.reactions as Record<string, string[]>) || {};
                const usersForEmoji = currentReactions[emoji] || [];
                const userIndex = usersForEmoji.indexOf(user.id);

                if (userIndex > -1) {
                    usersForEmoji.splice(userIndex, 1);
                    if (usersForEmoji.length === 0) {
                        delete currentReactions[emoji];
                    } else {
                        currentReactions[emoji] = usersForEmoji;
                    }

                    // Update message with new reactions
                    const {data: updatedMessage, error: updateError} = await supabaseAsAdmin
                        .from('chat_messages')
                        .update({reactions: currentReactions})
                        .eq('id', message_id)
                        .select('*, profile:players!user_id(id, nickname, avatar_url)')
                        .single();

                    if (updateError) {
                        console.error('❌ Error updating reactions:', updateError);
                        handleDatabaseError(updateError, 'removeReaction');
                    }

                    console.log('✅ removeReaction completed successfully');
                    return updatedMessage as ChatMessageWithProfile;
                }

                // User wasn't reacting, return current message
                const {data: currentMessage, error: currentError} = await supabaseAsAdmin
                    .from('chat_messages')
                    .select('*, profile:players!user_id(id, nickname, avatar_url)')
                    .eq('id', message_id)
                    .single();

                if (currentError) {
                    handleDatabaseError(currentError, 'removeReaction');
                }

                return currentMessage as ChatMessageWithProfile;

            } catch (error: any) {
                console.error('❌ removeReaction error:', error);
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to remove reaction: ${error.message}`,
                    cause: error,
                });
            }
        }),

    // Get players for mention suggestions
    getPlayersForMention: protectedProcedure
        .input(getPlayersForMentionInputSchema)
        .output(z.array(z.object({
            id: z.string(),
            nickname: z.string(),
            avatar_url: z.string().nullable(),
        })))
        .query(async ({input}) => {
            try {
                console.log('🔍 getPlayersForMention:', input.query);

                const {query} = input;

                const {data: players, error} = await supabaseAsAdmin
                    .from('players')
                    .select('id, nickname, avatar_url')
                    .ilike('nickname', `%${query}%`)
                    .limit(10);

                if (error) {
                    console.error('❌ Error fetching players for mention:', error);
                    return [];
                }

                const result = (players || []).map(player => ({
                    id: player.id,
                    nickname: player.nickname || 'Player',
                    avatar_url: player.avatar_url,
                }));

                console.log('✅ Found', result.length, 'players for mention');
                return result;

            } catch (error: any) {
                console.error('❌ getPlayersForMention error:', error);
                return [];
            }
        }),

    // Send system notification
    sendSystemNotification: protectedProcedure
        .input(sendSystemNotificationInputSchema)
        .mutation(async ({input}) => {
            try {
                console.log('📢 sendSystemNotification:', input);

                const {type, metadata} = input;
                const validatedType = type as SystemNotificationType;
                const validatedMetadata = metadata as SystemNotificationMetadata;

                if (validatedMetadata.notification_type !== validatedType) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Metadata type does not match the notification type.',
                    });
                }

                await dispatchSystemNotification(validatedType, validatedMetadata);

                console.log('✅ System notification sent successfully');
                return {success: true};

            } catch (error: any) {
                console.error('❌ sendSystemNotification error:', error);
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to send system notification: ${error.message}`,
                    cause: error,
                });
            }
        }),
});

export type ChatRouter = typeof chatRouter;
