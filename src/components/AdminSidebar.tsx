import {
  LayoutDashboard,
  Users,
  UsersRound,
  Shield,
  BarChart3,
  Image,
  MapPinned,
  Tags,
  Building2,
  Globe,
  Ticket,
  CalendarDays,
} from "lucide-react";
import { DashboardSidebar } from "~/components/dashboard";
import type { NavSection } from "~/components/dashboard";

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Management",
    items: [
      { to: "/admin/users", icon: Users, label: "Users" },
      { to: "/admin/groups", icon: UsersRound, label: "Groups" },
      { to: "/admin/events", icon: CalendarDays, label: "Events" },
      { to: "/admin/banners", icon: Image, label: "Banners" },
      { to: "/admin/places", icon: MapPinned, label: "Places" },
      { to: "/admin/event-categories", icon: Ticket, label: "Event Categories" },
      { to: "/admin/place-categories", icon: Tags, label: "Place Categories" },
      { to: "/admin/group-places", icon: Building2, label: "Group Places" },
      { to: "/admin/countries", icon: Globe, label: "Countries" },
    ],
  },
  {
    label: "Moderation",
    items: [{ to: "/admin/moderation", icon: Shield, label: "Moderation" }],
  },
  {
    label: "Insights",
    items: [{ to: "/admin/analytics", icon: BarChart3, label: "Analytics" }],
  },
];

export function AdminSidebar({ onClose }: { onClose?: () => void }) {
  return (
    <DashboardSidebar
      backTo="/"
      backLabel="Back to Moim"
      title="Admin Panel"
      sections={NAV_SECTIONS}
      onClose={onClose}
    />
  );
}
