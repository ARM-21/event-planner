// Top-level keys are frontend page paths; `API` is the backend's endpoint paths — same-looking strings, different namespaces, don't mix them up.
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  EVENTS: '/events',
  EVENT_NEW: '/events/new',
  EVENT_DETAIL: (id: string | number) => `/events/${id}`,
  EVENT_EDIT: (id: string | number) => `/events/${id}/edit`,

  API: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      REFRESH: '/auth/refresh',
      LOGOUT: '/auth/logout',
      VERIFY_EMAIL: '/auth/verify-email',
      RESEND_VERIFICATION: '/auth/resend-verification',
    },
    EVENTS: {
      // Same URL repeated by intent — REST convention, method distinguishes them.
      LIST: '/events',
      CREATE: '/events',
      DETAIL: (id: string | number) => `/events/${id}`,
      UPDATE: (id: string | number) => `/events/${id}`,
      DELETE: (id: string | number) => `/events/${id}`,
      RSVP: (id: string | number) => `/events/${id}/rsvp`,
    },
    TAGS: {
      LIST: '/tags',
    },
  },
} as const;
