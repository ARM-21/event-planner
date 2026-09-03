// Hand-written OpenAPI spec, kept in sync with docs/api-contract.md and
// grown alongside implementation — only documents endpoints that actually
// exist, so "Try it out" in Swagger UI never hits an unbuilt route.

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
        },
      },
    },
  },
  // No global `security` block: none of the endpoints documented so far
  // require auth. Protected event/tag endpoints will set
  // `security: [{ bearerAuth: [] }]` on themselves once added.
};
