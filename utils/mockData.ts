import { Player, Match, Tournament, TournamentFormat, TournamentStatus } from "@/types";
import { getInitialEloRating } from "./elo";

// Generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 10);

// Generate current date in ISO format
const now = new Date().toISOString();

// Mock players
export const mockPlayers: Player[] = [
  {
    id: "p1",
    name: "Alex Johnson",
    nickname: "AJ",
    avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop",
    eloRating: 1450,
    wins: 15,
    losses: 7,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p2",
    name: "Sarah Williams",
    nickname: "Spin Queen",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    eloRating: 1380,
    wins: 12,
    losses: 9,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p3",
    name: "Michael Chen",
    nickname: "The Wall",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    eloRating: 1520,
    wins: 18,
    losses: 5,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p4",
    name: "Emma Rodriguez",
    nickname: "Smash Master",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    eloRating: 1410,
    wins: 14,
    losses: 8,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p5",
    name: "David Kim",
    nickname: "Serve King",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    eloRating: 1490,
    wins: 16,
    losses: 6,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
];

// Mock matches
export const mockMatches: Match[] = [
  {
    id: "m1",
    player1Id: "p1",
    player2Id: "p3",
    player1Score: 2,
    player2Score: 3,
    sets: [
      { player1Score: 11, player2Score: 8 },
      { player1Score: 9, player2Score: 11 },
      { player1Score: 11, player2Score: 7 },
      { player1Score: 8, player2Score: 11 },
      { player1Score: 9, player2Score: 11 },
    ],
    winner: "p3",
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  },
  {
    id: "m2",
    player1Id: "p2",
    player2Id: "p4",
    player1Score: 3,
    player2Score: 1,
    sets: [
      { player1Score: 11, player2Score: 7 },
      { player1Score: 11, player2Score: 9 },
      { player1Score: 8, player2Score: 11 },
      { player1Score: 11, player2Score: 6 },
    ],
    winner: "p2",
    date: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
  },
  {
    id: "m3",
    player1Id: "p5",
    player2Id: "p1",
    player1Score: 3,
    player2Score: 0,
    sets: [
      { player1Score: 11, player2Score: 5 },
      { player1Score: 11, player2Score: 8 },
      { player1Score: 11, player2Score: 9 },
    ],
    winner: "p5",
    date: new Date(Date.now() - 86400000 * 0.5).toISOString(), // 12 hours ago
  },
  {
    id: "m4",
    player1Id: "p3",
    player2Id: "p2",
    player1Score: 3,
    player2Score: 2,
    sets: [
      { player1Score: 9, player2Score: 11 },
      { player1Score: 11, player2Score: 7 },
      { player1Score: 8, player2Score: 11 },
      { player1Score: 11, player2Score: 9 },
      { player1Score: 11, player2Score: 8 },
    ],
    winner: "p3",
    date: new Date(Date.now() - 86400000 * 0.2).toISOString(), // ~5 hours ago
  },
];

// Mock tournaments
export const mockTournaments: Tournament[] = [
  {
    id: "t1",
    name: "Office Championship 2023",
    date: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
    format: TournamentFormat.KNOCKOUT,
    status: TournamentStatus.UPCOMING,
    participants: ["p1", "p2", "p3", "p4", "p5"],
    matches: [],
  },
  {
    id: "t2",
    name: "Weekly Round Robin",
    date: new Date(Date.now() - 86400000 * 14).toISOString(), // 14 days ago
    format: TournamentFormat.ROUND_ROBIN,
    status: TournamentStatus.COMPLETED,
    participants: ["p1", "p2", "p3", "p4"],
    matches: ["m1", "m2"],
    winner: "p3",
  },
];

// Function to create a new player
export function createMockPlayer(name: string, nickname?: string): Player {
  return {
    id: generateId(),
    name,
    nickname,
    eloRating: getInitialEloRating(),
    wins: 0,
    losses: 0,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}