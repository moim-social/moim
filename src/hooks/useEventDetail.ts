import { useQuery } from "@tanstack/react-query";

// --- Types ---

export type EventData = {
  event: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
    timezone: string | null;
    location: string | null;
    placeId: string | null;
    venueDetail: string | null;
    placeName: string | null;
    placeAddress: string | null;
    placeLatitude: string | null;
    placeLongitude: string | null;
    externalUrl: string | null;
    headerImageUrl: string | null;
    groupHandle: string | null;
    groupName: string | null;
    organizerHandle: string | null;
    organizerDisplayName: string | null;
    organizerActorUrl: string | null;
    createdAt: string;
  };
  organizers: {
    handle: string | null;
    name: string | null;
    profileUrl: string | null;
    imageUrl: string | null;
    domain: string | null;
    isLocal: boolean | null;
    homepageUrl: string | null;
    isExternal: boolean;
  }[];
  rsvpCounts: { accepted: number; declined: number; waitlisted: number };
  attendeePreview: { displayName: string; avatarUrl: string | null }[];
  questionCount: number;
  canEdit: boolean;
  eventNoteApUrl?: string | null;
};

export type RsvpData = {
  questions: Array<{
    id: string;
    question: string;
    sortOrder: number;
    required: boolean;
  }>;
  tiers: TierInfo[];
  rsvpCounts: { accepted: number; declined: number; waitlisted: number };
  tierCounts: Array<{ tierId: string; status: string; count: number }>;
  userRsvp: {
    status: string;
    tierId: string | null;
    answers: Array<{ questionId: string; answer: string }>;
    waitlistPosition: number | null;
  } | null;
  isAuthenticated: boolean;
  allowAnonymousRsvp: boolean;
  anonymousContactFields: { email?: string; phone?: string } | null;
  anonymousCount: number;
};

export type TierInfo = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  priceAmount: number | null;
  capacity: number | null;
  sortOrder: number;
  opensAt: string;
  closesAt: string;
  acceptedCount: number;
  waitlistedCount: number;
};

export type AttendeesData = {
  questions: Array<{ id: string; question: string; sortOrder: number }>;
  tiers: TierInfo[];
  attendees: Array<{
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
    tierId: string | null;
    tierName: string | null;
    createdAt: string;
    answers: Array<{ questionId: string; answer: string }>;
  }>;
};

export type PublicInquiry = {
  id: string;
  content: string;
  published: string;
  createdAt: string;
  lastRepliedAt: string | null;
  apUrl: string | null;
  actorHandle: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorDomain: string | null;
  replyCount: number;
};

export type ThreadMessage = {
  id: string;
  content: string;
  createdAt: string;
  inReplyToPostId: string | null;
  apUrl: string | null;
  actorHandle: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorDomain: string | null;
};

export type PublicNotice = {
  id: string;
  postId: string;
  content: string;
  senderHandle: string;
  senderName: string | null;
  createdAt: string;
};

// --- Hooks ---

export function useEventData(eventId: string) {
  return useQuery<EventData>({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}`);
      if (!r.ok) throw new Error("Event not found");
      return r.json();
    },
  });
}

export function useRsvpData(eventId: string) {
  return useQuery<RsvpData>({
    queryKey: ["event", eventId, "rsvp"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/rsvp`);
      return r.json();
    },
  });
}

export function useFavouriteStatus(eventId: string) {
  return useQuery<{ isFavourite: boolean }>({
    queryKey: ["event", eventId, "favourite"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/favourite`);
      return r.json();
    },
  });
}

export function usePublicDiscussions(eventId: string, enabled: boolean) {
  return useQuery<PublicInquiry[]>({
    queryKey: ["event", eventId, "discussions"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/discussions/public`);
      const d = await r.json();
      return d.inquiries ?? [];
    },
    enabled,
  });
}

export function usePublicNotices(eventId: string) {
  return useQuery<PublicNotice[]>({
    queryKey: ["event", eventId, "notices"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/notices/public`);
      const d = await r.json();
      return d.notices ?? [];
    },
  });
}

export function useAttendeesData(eventId: string) {
  return useQuery<AttendeesData | null>({
    queryKey: ["event", eventId, "attendees"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/attendees`);
      if (!r.ok) return null;
      return r.json();
    },
  });
}

export function useDiscussionThread(eventId: string, inquiryId: string | null) {
  return useQuery<ThreadMessage[]>({
    queryKey: ["event", eventId, "discussion-thread", inquiryId],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/discussions/public/${inquiryId}`);
      const d = await r.json();
      return d.messages ?? [];
    },
    enabled: !!inquiryId,
  });
}
