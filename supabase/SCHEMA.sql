-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
id uuid NOT NULL DEFAULT gen_random_uuid(),
player_id uuid,
type text NOT NULL,
progress integer NOT NULL DEFAULT 0,
unlocked boolean NOT NULL DEFAULT false,
unlocked_at timestamp with time zone,
CONSTRAINT achievements_pkey PRIMARY KEY (id),
CONSTRAINT achievements_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.chat_messages (
id uuid NOT NULL DEFAULT uuid_generate_v4(),
user_id uuid,
message_content text,
created_at timestamp with time zone DEFAULT now(),
message_type text NOT NULL CHECK (message_type = ANY (ARRAY['user_message'::text, 'system_notification'::text])),
metadata jsonb,
reactions jsonb,
room_id uuid,
player_id uuid,
parent_message_id uuid,
CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id),
CONSTRAINT chat_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.chat_messages(id),
CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(user_id),
CONSTRAINT chat_messages_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.chat_room_participants (
room_id uuid NOT NULL,
player_id uuid NOT NULL,
role USER-DEFINED NOT NULL DEFAULT 'member'::participant_role,
joined_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT chat_room_participants_pkey PRIMARY KEY (room_id, player_id),
CONSTRAINT chat_room_participants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
CONSTRAINT chat_room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id)
);
CREATE TABLE public.chat_rooms (
id uuid NOT NULL DEFAULT gen_random_uuid(),
created_by uuid,
name text,
room_type USER-DEFINED NOT NULL DEFAULT 'group'::room_type,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT chat_rooms_pkey PRIMARY KEY (id),
CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.players(id)
);
CREATE TABLE public.matches (
id uuid NOT NULL DEFAULT gen_random_uuid(),
player1_id uuid,
player2_id uuid,
player1_score integer NOT NULL,
player2_score integer NOT NULL,
sets jsonb,
winner uuid,
tournament_id uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
date timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT matches_pkey PRIMARY KEY (id),
CONSTRAINT matches_winner_fkey FOREIGN KEY (winner) REFERENCES public.players(id),
CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id),
CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id)
);
CREATE TABLE public.notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
player_id uuid,
title text,
body text,
type text,
data jsonb,
read boolean NOT NULL DEFAULT false,
timestamp timestamp with time zone NOT NULL DEFAULT now(),
user_id uuid,
CONSTRAINT notifications_pkey PRIMARY KEY (id),
CONSTRAINT notifications_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.players (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
nickname text,
avatar_url text,
elo_rating integer NOT NULL DEFAULT 1500,
wins integer NOT NULL DEFAULT 0,
losses integer NOT NULL DEFAULT 0,
active boolean NOT NULL DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
user_id uuid UNIQUE,
games_played integer NOT NULL DEFAULT 0,
daily_delta double precision NOT NULL DEFAULT 0,
last_match_day text NOT NULL DEFAULT ''::text,
CONSTRAINT players_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tournament_matches (
id uuid NOT NULL DEFAULT gen_random_uuid(),
tournament_id uuid,
match_id uuid,
group integer,
match_number integer,
player1_id text,
player2_id text,
player1_score integer,
player2_score integer,
winner text,
next_match_id text,
status USER-DEFINED DEFAULT 'pending'::match_status,
round integer,
winner_id uuid,
sets jsonb,
bracket text,
stage text,
is_if_game boolean DEFAULT false,
CONSTRAINT tournament_matches_pkey PRIMARY KEY (id),
CONSTRAINT tournament_matches_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
CONSTRAINT tournament_matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_participants (
id uuid NOT NULL DEFAULT gen_random_uuid(),
tournament_id uuid,
player_id uuid,
CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
CONSTRAINT tournament_participants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.tournaments (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
date timestamp with time zone NOT NULL,
format text NOT NULL,
status text NOT NULL DEFAULT 'upcoming'::text,
winner uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
winner_id uuid,
CONSTRAINT tournaments_pkey PRIMARY KEY (id),
CONSTRAINT tournaments_winner_fkey FOREIGN KEY (winner) REFERENCES public.players(id),
CONSTRAINT fk_tournament_winner FOREIGN KEY (winner_id) REFERENCES public.players(id)
);
