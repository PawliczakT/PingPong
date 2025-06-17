//backend/types/supabase.ts
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            achievements: {
                Row: {
                    id: string
                    player_id: string | null
                    progress: number
                    type: string
                    unlocked: boolean
                    unlocked_at: string | null
                }
                Insert: {
                    id?: string
                    player_id?: string | null
                    progress?: number
                    type: string
                    unlocked?: boolean
                    unlocked_at?: string | null
                }
                Update: {
                    id?: string
                    player_id?: string | null
                    progress?: number
                    type?: string
                    unlocked?: boolean
                    unlocked_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "achievements_player_id_fkey"
                        columns: ["player_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                ]
            }
            chat_messages: {
                Row: {
                    created_at: string | null
                    id: string
                    message_content: string | null
                    message_type: string
                    metadata: Json | null
                    reactions: Json | null
                    user_id: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    message_content?: string | null
                    message_type: string
                    metadata?: Json | null
                    reactions?: Json | null
                    user_id?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    message_content?: string | null
                    message_type?: string
                    metadata?: Json | null
                    reactions?: Json | null
                    user_id?: string | null
                }
                Relationships: []
            }
            matches: {
                Row: {
                    created_at: string
                    date: string
                    id: string
                    player1_id: string | null
                    player1_score: number
                    player2_id: string | null
                    player2_score: number
                    sets: Json | null
                    tournament_id: string | null
                    winner: string | null
                }
                Insert: {
                    created_at?: string
                    date?: string
                    id?: string
                    player1_id?: string | null
                    player1_score: number
                    player2_id?: string | null
                    player2_score: number
                    sets?: Json | null
                    tournament_id?: string | null
                    winner?: string | null
                }
                Update: {
                    created_at?: string
                    date?: string
                    id?: string
                    player1_id?: string | null
                    player1_score?: number
                    player2_id?: string | null
                    player2_score?: number
                    sets?: Json | null
                    tournament_id?: string | null
                    winner?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "matches_player1_id_fkey"
                        columns: ["player1_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_player2_id_fkey"
                        columns: ["player2_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_tournament_id_fkey"
                        columns: ["tournament_id"]
                        isOneToOne: false
                        referencedRelation: "tournaments"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_winner_fkey"
                        columns: ["winner"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                ]
            }
            notifications: {
                Row: {
                    body: string | null
                    data: Json | null
                    id: string
                    player_id: string | null
                    read: boolean
                    timestamp: string
                    title: string | null
                    type: string | null
                }
                Insert: {
                    body?: string | null
                    data?: Json | null
                    id?: string
                    player_id?: string | null
                    read?: boolean
                    timestamp?: string
                    title?: string | null
                    type?: string | null
                }
                Update: {
                    body?: string | null
                    data?: Json | null
                    id?: string
                    player_id?: string | null
                    read?: boolean
                    timestamp?: string
                    title?: string | null
                    type?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "notifications_player_id_fkey"
                        columns: ["player_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                ]
            }
            players: {
                Row: {
                    active: boolean
                    avatar_url: string | null
                    created_at: string
                    elo_rating: number
                    id: string
                    losses: number
                    name: string
                    nickname: string | null
                    updated_at: string
                    user_id: string | null
                    wins: number
                }
                Insert: {
                    active?: boolean
                    avatar_url?: string | null
                    created_at?: string
                    elo_rating?: number
                    id?: string
                    losses?: number
                    name: string
                    nickname?: string | null
                    updated_at?: string
                    user_id?: string | null
                    wins?: number
                }
                Update: {
                    active?: boolean
                    avatar_url?: string | null
                    created_at?: string
                    elo_rating?: number
                    id?: string
                    losses?: number
                    name?: string
                    nickname?: string | null
                    updated_at?: string
                    user_id?: string | null
                    wins?: number
                }
                Relationships: []
            }
            tournament_matches: {
                Row: {
                    group: number | null
                    id: string
                    match_id: string | null
                    match_number: number | null
                    next_match_id: string | null
                    player1_id: string | null
                    player1_score: number | null
                    player2_id: string | null
                    player2_score: number | null
                    round: number | null
                    sets: Json | null
                    status: Database["public"]["Enums"]["match_status"] | null
                    tournament_id: string | null
                    winner: string | null
                    winner_id: string | null
                }
                Insert: {
                    group?: number | null
                    id?: string
                    match_id?: string | null
                    match_number?: number | null
                    next_match_id?: string | null
                    player1_id?: string | null
                    player1_score?: number | null
                    player2_id?: string | null
                    player2_score?: number | null
                    round?: number | null
                    sets?: Json | null
                    status?: Database["public"]["Enums"]["match_status"] | null
                    tournament_id?: string | null
                    winner?: string | null
                    winner_id?: string | null
                }
                Update: {
                    group?: number | null
                    id?: string
                    match_id?: string | null
                    match_number?: number | null
                    next_match_id?: string | null
                    player1_id?: string | null
                    player1_score?: number | null
                    player2_id?: string | null
                    player2_score?: number | null
                    round?: number | null
                    sets?: Json | null
                    status?: Database["public"]["Enums"]["match_status"] | null
                    tournament_id?: string | null
                    winner?: string | null
                    winner_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tournament_matches_match_id_fkey"
                        columns: ["match_id"]
                        isOneToOne: false
                        referencedRelation: "matches"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tournament_matches_tournament_id_fkey"
                        columns: ["tournament_id"]
                        isOneToOne: false
                        referencedRelation: "tournaments"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tournament_participants: {
                Row: {
                    id: string
                    player_id: string | null
                    tournament_id: string | null
                }
                Insert: {
                    id?: string
                    player_id?: string | null
                    tournament_id?: string | null
                }
                Update: {
                    id?: string
                    player_id?: string | null
                    tournament_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tournament_participants_player_id_fkey"
                        columns: ["player_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tournament_participants_tournament_id_fkey"
                        columns: ["tournament_id"]
                        isOneToOne: false
                        referencedRelation: "tournaments"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tournaments: {
                Row: {
                    created_at: string
                    date: string
                    format: string
                    id: string
                    name: string
                    status: string
                    updated_at: string
                    winner: string | null
                    winner_id: string | null
                }
                Insert: {
                    created_at?: string
                    date: string
                    format: string
                    id?: string
                    name: string
                    status?: string
                    updated_at?: string
                    winner?: string | null
                    winner_id?: string | null
                }
                Update: {
                    created_at?: string
                    date?: string
                    format?: string
                    id?: string
                    name?: string
                    status?: string
                    updated_at?: string
                    winner?: string | null
                    winner_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "fk_tournament_winner"
                        columns: ["winner_id"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tournaments_winner_fkey"
                        columns: ["winner"]
                        isOneToOne: false
                        referencedRelation: "players"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            clear_my_notifications: {
                Args: Record<PropertyKey, never>
                Returns: undefined
            }
            create_notification: {
                Args: {
                    p_player_id: string
                    p_title: string
                    p_body: string
                    p_type: string
                    p_data: Json
                }
                Returns: undefined
            }
            gtrgm_compress: {
                Args: { "": unknown }
                Returns: unknown
            }
            gtrgm_decompress: {
                Args: { "": unknown }
                Returns: unknown
            }
            gtrgm_in: {
                Args: { "": unknown }
                Returns: unknown
            }
            gtrgm_options: {
                Args: { "": unknown }
                Returns: undefined
            }
            gtrgm_out: {
                Args: { "": unknown }
                Returns: unknown
            }
            set_limit: {
                Args: { "": number }
                Returns: number
            }
            show_limit: {
                Args: Record<PropertyKey, never>
                Returns: number
            }
            show_trgm: {
                Args: { "": string }
                Returns: string[]
            }
        }
        Enums: {
            match_status: "pending" | "scheduled" | "completed" | "bye"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof Database
        }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
            DefaultSchema["Views"])
        ? (DefaultSchema["Tables"] &
            DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
                Row: infer R
            }
            ? R
            : never
        : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends | keyof DefaultSchema["Tables"]
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof Database
        }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
        }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Insert: infer I
            }
            ? I
            : never
        : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends | keyof DefaultSchema["Tables"]
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof Database
        }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
        }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Update: infer U
            }
            ? U
            : never
        : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends | keyof DefaultSchema["Enums"]
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
            schema: keyof Database
        }
        ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
        ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
        : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
            schema: keyof Database
        }
        ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
        ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
        : never

export const Constants = {
    public: {
        Enums: {
            match_status: ["pending", "scheduled", "completed", "bye"],
        },
    },
} as const
