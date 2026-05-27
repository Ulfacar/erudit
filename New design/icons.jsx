/* global React */
// Lightweight inline SVG icons. Stroke 1.75, currentColor.
const I = ({ d, size = 18, fill = "none", strokeWidth = 1.75, children, ...rest }) =>
  React.createElement(
    "svg",
    {
      width: size, height: size, viewBox: "0 0 24 24",
      fill, stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
      ...rest,
    },
    d ? React.createElement("path", { d }) : children
  );

const Icons = {
  Home: (p) => <I {...p}><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></I>,
  Grid: (p) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></I>,
  Book: (p) => <I {...p}><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5a1.5 1.5 0 0 0 0 3H20"/><path d="M8 7h8M8 11h6"/></I>,
  Calendar: (p) => <I {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></I>,
  Chart: (p) => <I {...p}><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></I>,
  Users: (p) => <I {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14.5c2.8.2 5 2.4 5 5.5"/></I>,
  User: (p) => <I {...p}><circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></I>,
  ClipboardCheck: (p) => <I {...p}><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 13l2 2 4-4"/></I>,
  CheckSquare: (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></I>,
  School: (p) => <I {...p}><path d="M3 10l9-5 9 5-9 5-9-5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M21 10v6"/></I>,
  Award: (p) => <I {...p}><circle cx="12" cy="9" r="5.5"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></I>,
  Bell: (p) => <I {...p}><path d="M6 8.5a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></I>,
  Search: (p) => <I {...p}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.5-3.5"/></I>,
  Menu: (p) => <I {...p}><path d="M4 6h16M4 12h16M4 18h16"/></I>,
  ChevronLeft: (p) => <I {...p}><path d="M15 6l-6 6 6 6"/></I>,
  ChevronRight: (p) => <I {...p}><path d="M9 6l6 6-6 6"/></I>,
  ChevronDown: (p) => <I {...p}><path d="M6 9l6 6 6-6"/></I>,
  ChevronUp: (p) => <I {...p}><path d="M6 15l6-6 6 6"/></I>,
  Plus: (p) => <I {...p}><path d="M12 5v14M5 12h14"/></I>,
  Filter: (p) => <I {...p}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></I>,
  Download: (p) => <I {...p}><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></I>,
  MoreH: (p) => <I {...p}><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></I>,
  Eye: (p) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></I>,
  EyeOff: (p) => <I {...p}><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16.4 16.4 0 0 1-3.3 4"/><path d="M6.5 7.5C3.7 9.2 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></I>,
  Lock: (p) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></I>,
  Mail: (p) => <I {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></I>,
  Settings: (p) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></I>,
  Logout: (p) => <I {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></I>,
  ArrowUp: (p) => <I {...p}><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></I>,
  ArrowDown: (p) => <I {...p}><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></I>,
  ArrowRight: (p) => <I {...p}><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></I>,
  Sparkles: (p) => <I {...p}><path d="M12 3l1.8 4.5L18 9.4l-4.2 1.9L12 16l-1.8-4.7L6 9.4l4.2-1.9z"/><path d="M19 14l.8 2 2 .8-2 .8L19 20l-.8-2.4-2-.8 2-.8z"/></I>,
  Inbox: (p) => <I {...p}><path d="M3 13l3-8h12l3 8"/><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/><path d="M3 13h5l2 3h4l2-3h5"/></I>,
  Clock: (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></I>,
  AlertCircle: (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16v.5"/></I>,
  CheckCircle: (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></I>,
  X: (p) => <I {...p}><path d="M6 6l12 12M18 6l-6 6-6 6"/></I>,
  Briefcase: (p) => <I {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></I>,
  Heart: (p) => <I {...p}><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/></I>,
  Pencil: (p) => <I {...p}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/></I>,
  MessageSquare: (p) => <I {...p}><path d="M4 4h16v12H8l-4 4V4z"/></I>,
  FileText: (p) => <I {...p}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/></I>,
  TrendingUp: (p) => <I {...p}><path d="M3 17l6-6 4 4 8-9"/><path d="M14 6h7v7"/></I>,
  Star: (p) => <I {...p}><path d="M12 3l2.7 6 6.3.6-4.7 4.3 1.4 6.4L12 17l-5.7 3.3 1.4-6.4L3 9.6 9.3 9z"/></I>,
  Phone: (p) => <I {...p}><path d="M5 4h3l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></I>,
  Globe: (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></I>,
};

window.Icons = Icons;
