/**
 * OpenAPI (Swagger) spec for the API, served interactively at /api/docs.
 * Written by hand as a plain object instead of a YAML file, and kept in
 * sync manually with the real routes as they're built — see
 * docs/api-contract.md in the repo root for the full written-out design
 * this is describing in machine-readable form.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Event Planner API',
    version: '1.0.0',
    description: 'See docs/api-contract.md in the repo for the full design.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          emailVerified: { type: 'boolean' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          visibility: { type: 'string', enum: ['public', 'private'] },
          creatorId: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      EventInput: {
        type: 'object',
        required: ['title', 'startsAt', 'endsAt', 'location'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time', description: 'Must be at least 24 hours from now' },
          endsAt: { type: 'string', format: 'date-time', description: 'Must be at least 15 minutes after startsAt' },
          location: { type: 'string' },
          visibility: { type: 'string', enum: ['public', 'private'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      EventList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      Tag: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness + DB connectivity check',
        responses: {
          '200': { description: 'ok' },
          '503': { description: 'database unreachable' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
              example: { name: 'test user', email: 'hello@example.com', password: 'correct-horse' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log in and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
              example: { email: 'ada@example.com', password: 'correct-horse' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Logged in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/verify-email': {
      post: {
        summary: 'Verify an email address using the token from the emailed link',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
            },
          },
        },
        responses: {
          '200': { description: 'Verified', content: { 'application/json': { schema: { type: 'object', properties: { verified: { type: 'boolean' } } } } } },
          '400': { description: 'Missing, invalid, or expired token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        summary: "Send a new verification email for the caller's own account",
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Sent', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          '409': { description: 'Email already verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/events': {
      get: {
        summary: 'List events (paginated, filterable)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'visibility', in: 'query', schema: { type: 'string', enum: ['public', 'private'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['upcoming', 'past'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['starts_at', '-starts_at'] } },
        ],
        security: [{ bearerAuth: [] }, {}],
        responses: {
          '200': {
            description: 'Paginated event list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EventList' } } },
          },
        },
      },
      post: {
        summary: 'Create an event',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EventInput' },
              example: {
                title: 'Launch party',
                startsAt: '2026-10-01T18:00:00.000Z',
                endsAt: '2026-10-01T20:00:00.000Z',
                location: 'Kathmandu',
                visibility: 'public',
                tags: ['launch', 'party'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Event created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/events/{id}': {
      get: {
        summary: 'Get a single event',
        security: [{ bearerAuth: [] }, {}],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'Event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          '404': { description: 'Not found or hidden from you', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        summary: 'Update an event (creator only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EventInput' } } },
        },
        responses: {
          '200': {
            description: 'Updated event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Not the creator of a public event', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: "Not found, or a private event you don't own", content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        summary: 'Delete an event (creator only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '204': { description: 'Deleted' },
          '401': { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Not the creator of a public event', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: "Not found, or a private event you don't own", content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/tags': {
      get: {
        summary: 'List all tags',
        responses: {
          '200': {
            description: 'Tag list',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Tag' } } } } } },
          },
        },
      },
    },
  },

};
