import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "HTT Academy API",
      version: "1.0.0",
      description: "Versioned API for the HTT Academy Admin Management App.",
    },
    servers: [{ url: "/api/v1", description: "Current API version" }],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "htt_access" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        StaffLogin: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
        },
        PlayerInput: {
          type: "object",
          required: ["fullName", "dateOfBirth"],
          additionalProperties: false,
          properties: {
            fullName: { type: "string", maxLength: 200 },
            dateOfBirth: { type: "string", format: "date" },
            ageGroup: {
              type: "string",
              enum: ["8-10", "11-12", "13-14", "other"],
            },
            centreId: { type: "string", format: "uuid", nullable: true },
            programmeId: { type: "string", format: "uuid", nullable: true },
          },
        },
        PlayerPatch: {
          type: "object",
          additionalProperties: false,
          properties: {
            fullName: { type: "string" },
            dateOfBirth: { type: "string", format: "date" },
            ageGroup: { type: "string" },
            centreId: { type: "string", format: "uuid", nullable: true },
            programmeId: { type: "string", format: "uuid", nullable: true },
            school: { type: "string" },
            developmentNotes: { type: "string" },
            matchNotes: { type: "string" },
          },
        },
        PlayerStatus: {
          type: "object",
          required: ["registrationStatus"],
          additionalProperties: false,
          properties: {
            registrationStatus: {
              type: "string",
              enum: ["prospective", "registered", "waitlisted", "archived"],
            },
            archivedReason: { type: "string" },
          },
        },
        GuardianInput: {
          type: "object",
          required: ["fullName", "phone"],
          additionalProperties: false,
          properties: {
            fullName: { type: "string", maxLength: 200 },
            phone: { type: "string", maxLength: 40 },
            email: { type: "string", format: "email", nullable: true },
            address: { type: "string", nullable: true },
            preferredContact: {
              type: "string",
              enum: ["phone", "whatsapp", "email", "sms"],
            },
          },
        },
        GuardianPatch: {
          type: "object",
          additionalProperties: false,
          properties: {
            fullName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", format: "email", nullable: true },
            address: { type: "string", nullable: true },
            preferredContact: {
              type: "string",
              enum: ["phone", "whatsapp", "email", "sms"],
            },
            accountStatus: { type: "string" },
            consentStatus: { type: "string" },
            notes: { type: "string" },
          },
        },
        GuardianLink: {
          type: "object",
          required: ["guardianId", "relationship"],
          additionalProperties: false,
          properties: {
            guardianId: { type: "string", format: "uuid" },
            relationship: {
              type: "string",
              enum: ["mother", "father", "guardian", "other"],
            },
            isPrimary: { type: "boolean" },
            isEmergencyContact: { type: "boolean" },
          },
        },
        RegistrationInput: {
          type: "object",
          required: ["guardianName", "guardianPhone", "childName"],
          additionalProperties: false,
          properties: {
            guardianName: { type: "string" },
            guardianEmail: { type: "string", format: "email" },
            guardianPhone: { type: "string" },
            childName: { type: "string" },
            childDateOfBirth: { type: "string", format: "date" },
            centreId: { type: "string", format: "uuid" },
            programmeId: { type: "string", format: "uuid" },
            pathway: {
              type: "string",
              enum: ["paid_academy", "scholarship_assessment"],
            },
            consentMedia: { type: "boolean" },
            consentData: { type: "boolean" },
            consentMedical: { type: "boolean" },
          },
        },
        RegistrationPatch: {
          type: "object",
          additionalProperties: false,
          properties: {
            guardianName: { type: "string" },
            guardianEmail: { type: "string", format: "email" },
            guardianPhone: { type: "string" },
            childName: { type: "string" },
            childDateOfBirth: { type: "string", format: "date" },
            centreId: { type: "string", format: "uuid", nullable: true },
            programmeId: { type: "string", format: "uuid", nullable: true },
            internalNotes: { type: "string" },
          },
        },
        RegistrationDecision: {
          type: "object",
          additionalProperties: false,
          properties: { note: { type: "string", maxLength: 1000 } },
        },
        RegistrationApproval: {
          type: "object",
          additionalProperties: false,
          properties: {
            note: { type: "string", maxLength: 1000 },
            existingPlayerId: { type: "string", format: "uuid" },
            confirmNewPlayer: { type: "boolean" },
          },
        },
        RegistrationDocuments: {
          type: "object",
          required: ["documents"],
          additionalProperties: false,
          properties: {
            documents: {
              type: "array",
              items: {
                type: "object",
                required: ["name"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  mediaAssetId: {
                    type: "string",
                    format: "uuid",
                    nullable: true,
                  },
                  name: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["pending", "verified", "rejected"],
                  },
                },
              },
            },
          },
        },
        CentreInput: {
          type: "object",
          required: ["name", "code", "area"],
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            code: { type: "string" },
            area: { type: "string" },
            address: { type: "string" },
            status: {
              type: "string",
              enum: [
                "pending_verification",
                "open_for_registration",
                "assessments_open",
                "coming_soon",
                "temporarily_unavailable",
              ],
            },
            reviewStatus: {
              type: "string",
              enum: ["pending_verification", "approved"],
            },
            proposedArea: { type: "boolean" },
            programmeIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
        ProgrammeInput: {
          type: "object",
          required: ["name", "ageGroupLabel"],
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            ageGroupLabel: { type: "string" },
            code: { type: "string" },
            ageMin: { type: "integer", minimum: 0 },
            ageMax: { type: "integer", minimum: 0 },
            approvedFee: { type: "number", minimum: 0 },
            currency: { type: "string", pattern: "^[A-Z]{3}$" },
            status: { type: "string", enum: ["active", "planned", "archived"] },
            availability: {
              type: "string",
              enum: ["open", "waitlist", "closed"],
            },
            centreIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
        ProgrammePatch: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            ageGroupLabel: { type: "string" },
            code: { type: "string" },
            ageMin: { type: "integer", minimum: 0 },
            ageMax: { type: "integer", minimum: 0 },
            approvedFee: { type: "number", minimum: 0 },
            currency: { type: "string", pattern: "^[A-Z]{3}$" },
            centreIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
        CentreStatus: {
          type: "object",
          required: ["status"],
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: [
                "pending_verification",
                "open_for_registration",
                "assessments_open",
                "coming_soon",
                "temporarily_unavailable",
              ],
            },
            reviewStatus: {
              type: "string",
              enum: ["pending_verification", "approved"],
            },
            proposedArea: { type: "boolean" },
            registrationAvailable: { type: "boolean" },
          },
        },
        ProgrammeStatus: {
          type: "object",
          required: ["status"],
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["active", "planned", "archived"] },
            availability: {
              type: "string",
              enum: ["open", "waitlist", "closed"],
            },
          },
        },
      },
    },
    paths: {
      "/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Sign in and establish HttpOnly session cookies",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StaffLogin" },
              },
            },
          },
          responses: {
            "200": { description: "Signed in" },
            "400": { description: "Invalid input" },
            "401": { description: "Invalid credentials" },
            "429": { description: "Rate limit exceeded" },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Authentication"],
          summary: "Rotate the current refresh session",
          responses: {
            "200": { description: "Session rotated" },
            "401": { description: "Invalid or reused session" },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "Revoke the current device session",
          responses: { "200": { description: "Logged out" } },
        },
      },
      "/auth/logout-all": {
        post: {
          tags: ["Authentication"],
          summary: "Revoke all staff sessions",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "All sessions revoked" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current staff identity and effective permissions",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Current staff profile" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          tags: ["Authentication"],
          summary: "Request password reset instructions",
          responses: {
            "200": { description: "Enumeration-safe response" },
            "429": { description: "Rate limit exceeded" },
          },
        },
      },
      "/auth/reset-password": {
        post: {
          tags: ["Authentication"],
          summary: "Consume a one-time reset or invitation token",
          responses: {
            "200": { description: "Password updated" },
            "400": { description: "Invalid or expired token" },
          },
        },
      },
      "/auth/change-password": {
        post: {
          tags: ["Authentication"],
          summary: "Change current password",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Password changed" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/staff": {
        get: {
          tags: ["Staff"],
          summary: "List staff with pagination and search",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Staff page" },
            "403": { description: "Permission denied" },
          },
        },
        post: {
          tags: ["Staff"],
          summary: "Create inactive staff account and invitation",
          security: [{ cookieAuth: [] }],
          responses: {
            "201": { description: "Staff invited" },
            "403": { description: "Permission denied" },
          },
        },
      },
      "/staff/{id}": {
        get: {
          tags: ["Staff"],
          summary: "View staff and assigned permissions",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Staff profile" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["Staff"],
          summary: "Update staff profile or role assignments",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Updated" },
            "403": { description: "Permission denied" },
          },
        },
        delete: {
          tags: ["Staff"],
          summary: "Deactivate staff account",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deactivated" } },
        },
      },
      "/staff/{id}/status": {
        patch: {
          tags: ["Staff"],
          summary: "Activate or suspend a staff account",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Status updated" },
            "409": { description: "Final active admin protected" },
          },
        },
      },
      "/roles": {
        get: {
          tags: ["RBAC"],
          summary: "List roles",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Roles" } },
        },
        post: {
          tags: ["RBAC"],
          summary: "Create a role",
          security: [{ cookieAuth: [] }],
          responses: { "201": { description: "Role created" } },
        },
      },
      "/roles/{id}": {
        get: {
          tags: ["RBAC"],
          summary: "View role",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Role" } },
        },
        patch: {
          tags: ["RBAC"],
          summary: "Update role",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/roles/permissions": {
        get: {
          tags: ["RBAC"],
          summary: "List permission inventory",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Permissions" } },
        },
      },
      "/permissions": {
        get: {
          tags: ["RBAC"],
          summary: "List permission inventory",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Permissions" } },
        },
      },
      "/roles/{id}/permissions": {
        get: {
          tags: ["RBAC"],
          summary: "View role permissions",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Role permissions" } },
        },
        put: {
          tags: ["RBAC"],
          summary: "Replace role permissions",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Permissions replaced" },
            "403": { description: "Permission denied" },
          },
        },
      },
      "/players": {
        get: {
          tags: ["Players"],
          summary: "List and filter players",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "page",
              schema: { type: "integer", default: 1 },
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 25, maximum: 100 },
            },
            { in: "query", name: "search", schema: { type: "string" } },
            {
              in: "query",
              name: "registrationStatus",
              schema: { type: "string" },
            },
          ],
          "x-required-permission": "players.read",
          responses: {
            "200": {
              description:
                "Paginated players; personal fields require players.read_sensitive.",
            },
            "400": { description: "Invalid query parameters" },
            "403": { description: "Permission denied" },
          },
        },
        post: {
          tags: ["Players"],
          summary: "Create a player profile",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "players.create",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlayerInput" },
              },
            },
          },
          responses: {
            "201": { description: "Player created" },
            "400": { description: "Invalid player data" },
            "403": { description: "Permission denied" },
          },
        },
      },
      "/players/{id}": {
        get: {
          tags: ["Players"],
          summary: "Get player, guardians, and registration history",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "players.read",
          responses: {
            "200": {
              description: "Player; personal data is permission filtered",
            },
            "400": { description: "Invalid UUID" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["Players"],
          summary: "Update player profile",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "players.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlayerPatch" },
              },
            },
          },
          responses: {
            "200": { description: "Player updated" },
            "403": {
              description: "Sensitive changes require players.read_sensitive",
            },
          },
        },
        delete: {
          tags: ["Players"],
          summary: "Archive player without deleting history",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "players.delete",
          responses: { "200": { description: "Player archived" } },
        },
      },
      "/players/{id}/status": {
        patch: {
          tags: ["Players"],
          summary: "Change player registration status",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "players.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlayerStatus" },
              },
            },
          },
          responses: {
            "200": { description: "Status updated" },
            "400": { description: "Invalid status" },
          },
        },
      },
      "/guardians": {
        get: {
          tags: ["Guardians"],
          summary: "Search guardians",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "guardians.read",
          responses: {
            "200": {
              description:
                "Paginated guardians; contact data requires guardians.read_contact",
            },
          },
        },
        post: {
          tags: ["Guardians"],
          summary: "Create guardian profile",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "guardians.create",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuardianInput" },
              },
            },
          },
          responses: {
            "201": { description: "Guardian created" },
            "409": { description: "Duplicate phone number" },
          },
        },
      },
      "/guardians/{id}": {
        get: {
          tags: ["Guardians"],
          summary: "Get guardian",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.read",
          responses: {
            "200": {
              description: "Guardian; contact data is permission filtered",
            },
          },
        },
        patch: {
          tags: ["Guardians"],
          summary: "Update guardian",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuardianPatch" },
              },
            },
          },
          responses: { "200": { description: "Guardian updated" } },
        },
        delete: {
          tags: ["Guardians"],
          summary: "Deactivate guardian while preserving relationships",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.delete",
          responses: { "200": { description: "Guardian deactivated" } },
        },
      },
      "/guardians/{id}/players": {
        get: {
          tags: ["Guardians"],
          summary: "List guardian player relationships",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.read",
          responses: { "200": { description: "Player relationships" } },
        },
      },
      "/players/{id}/guardians": {
        post: {
          tags: ["Guardians"],
          summary: "Create or update a player guardian relationship",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuardianLink" },
              },
            },
          },
          responses: {
            "201": { description: "Relationship linked" },
            "409": { description: "Relationship constraint conflict" },
          },
        },
      },
      "/players/{id}/guardians/{guardianId}": {
        delete: {
          tags: ["Guardians"],
          summary: "Remove a player guardian relationship",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              in: "path",
              name: "guardianId",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "guardians.update",
          responses: { "200": { description: "Relationship removed" } },
        },
      },
      "/registrations": {
        get: {
          tags: ["Registrations"],
          summary: "List registrations with pagination and filters",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "registrations.read",
          responses: {
            "200": {
              description:
                "Paginated registration records with permission-filtered personal data",
            },
          },
        },
        post: {
          tags: ["Registrations"],
          summary: "Create a staff-captured registration",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "registrations.create",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Registration created; payment remains unpaid",
            },
            "400": { description: "Invalid registration data" },
          },
        },
      },
      "/registrations/{id}": {
        get: {
          tags: ["Registrations"],
          summary: "Get registration, documents, and status history",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.read",
          responses: { "200": { description: "Registration details" } },
        },
        patch: {
          tags: ["Registrations"],
          summary: "Update a non-final registration",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationPatch" },
              },
            },
          },
          responses: {
            "200": { description: "Registration updated" },
            "409": { description: "Final registration or invalid selection" },
          },
        },
      },
      "/registrations/{id}/approve": {
        post: {
          tags: ["Registrations"],
          summary:
            "Approve and atomically provision or link a player and guardian",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission":
            "registrations.approve and players.read_sensitive",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationApproval" },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Approval result; safe to retry for the same registration",
            },
            "409": {
              description:
                "Invalid state, incomplete data, or possible duplicate player",
            },
          },
        },
      },
      "/registrations/{id}/reject": {
        post: {
          tags: ["Registrations"],
          summary: "Reject registration",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationDecision" },
              },
            },
          },
          responses: {
            "200": { description: "Rejected" },
            "409": { description: "Invalid state transition" },
          },
        },
      },
      "/registrations/{id}/request-changes": {
        post: {
          tags: ["Registrations"],
          summary: "Request additional registration information",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationDecision" },
              },
            },
          },
          responses: { "200": { description: "Information requested" } },
        },
      },
      "/registrations/{id}/start-review": {
        post: {
          tags: ["Registrations"],
          summary: "Move registration into review",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationDecision" },
              },
            },
          },
          responses: { "200": { description: "Review started" } },
        },
      },
      "/registrations/{id}/require-assessment": {
        post: {
          tags: ["Registrations"],
          summary: "Mark that an assessment is required",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationDecision" },
              },
            },
          },
          responses: { "200": { description: "Assessment required" } },
        },
      },
      "/registrations/{id}/documents": {
        put: {
          tags: ["Registrations"],
          summary: "Replace registration document metadata",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "registrations.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationDocuments" },
              },
            },
          },
          responses: { "200": { description: "Documents updated" } },
        },
      },
      "/centres": {
        get: {
          tags: ["Centres"],
          summary: "List centres and their operational classification",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "centres.read",
          responses: {
            "200": {
              description:
                "Centres include isOperational; proposed and unverified locations are not marked operational",
            },
          },
        },
        post: {
          tags: ["Centres"],
          summary: "Create proposed or approved centre",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "centres.create",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CentreInput" },
              },
            },
          },
          responses: {
            "201": { description: "Centre created" },
            "409": { description: "Invalid operational state" },
          },
        },
      },
      "/centres/{id}": {
        get: {
          tags: ["Centres"],
          summary: "Get centre and offered programmes",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "centres.read",
          responses: { "200": { description: "Centre details" } },
        },
        patch: {
          tags: ["Centres"],
          summary: "Update centre details and programme associations",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "centres.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    area: { type: "string" },
                    address: { type: "string" },
                    programmeIds: {
                      type: "array",
                      items: { type: "string", format: "uuid" },
                    },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Centre updated" } },
        },
        delete: {
          tags: ["Centres"],
          summary: "Delete unreferenced centre",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "centres.delete",
          responses: {
            "200": { description: "Deleted" },
            "409": { description: "Centre has historical references" },
          },
        },
      },
      "/centres/{id}/status": {
        patch: {
          tags: ["Centres"],
          summary: "Change verification and operational status",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "centres.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CentreStatus" },
              },
            },
          },
          responses: {
            "200": { description: "Status updated" },
            "409": {
              description:
                "Centre must be approved and non-proposed to operate",
            },
          },
        },
      },
      "/programmes": {
        get: {
          tags: ["Programmes"],
          summary:
            "List programmes, availability, age eligibility, and linked centres",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "programmes.read",
          responses: { "200": { description: "Paginated programmes" } },
        },
        post: {
          tags: ["Programmes"],
          summary: "Create programme",
          security: [{ cookieAuth: [] }],
          "x-required-permission": "programmes.create",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgrammeInput" },
              },
            },
          },
          responses: {
            "201": { description: "Programme created" },
            "400": { description: "Invalid programme data" },
          },
        },
      },
      "/programmes/{id}": {
        get: {
          tags: ["Programmes"],
          summary: "Get programme and centres",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "programmes.read",
          responses: { "200": { description: "Programme details" } },
        },
        patch: {
          tags: ["Programmes"],
          summary: "Update programme profile and centre links",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "programmes.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgrammePatch" },
              },
            },
          },
          responses: { "200": { description: "Programme updated" } },
        },
        delete: {
          tags: ["Programmes"],
          summary: "Delete unreferenced programme",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "programmes.delete",
          responses: {
            "200": { description: "Deleted" },
            "409": { description: "Programme has historical references" },
          },
        },
      },
      "/programmes/{id}/status": {
        patch: {
          tags: ["Programmes"],
          summary: "Update programme status and availability",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          "x-required-permission": "programmes.update",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgrammeStatus" },
              },
            },
          },
          responses: { "200": { description: "Status updated" } },
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts"],
});

const adminResources = [
  ["attendance-sessions", "attendance"], ["assessments", "assessments"],
  ["scholarship-applications", "scholarships"], ["scholarship-awards", "scholarships"],
  ["sponsors", "funding"], ["funding-records", "funding"], ["seasons", "league"],
  ["teams", "league"], ["fixtures", "league"], ["enquiries", "communications"],
  ["follow-up-tasks", "communications"], ["sponsorship-enquiries", "communications"],
  ["stories", "content"], ["consent-records", "safeguarding"], ["settings", "settings"],
] as const;

const mutableSwaggerSpec = swaggerSpec as unknown as { paths: Record<string, unknown> };

for (const [path, permission] of adminResources) {
  mutableSwaggerSpec.paths[`/${path}`] = {
    get: { tags: ["Academy administration"], summary: `List ${path} with pagination and filters`, security: [{ cookieAuth: [] }], parameters: [{ in: "query", name: "page", schema: { type: "integer", minimum: 1 } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } }, { in: "query", name: "search", schema: { type: "string" } }], "x-required-permission": permission, responses: { "200": { description: "Paginated results" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permission" } } },
    post: { tags: ["Academy administration"], summary: `Create ${path} record`, security: [{ cookieAuth: [] }], "x-required-permission": permission, responses: { "201": { description: "Created record" }, "400": { description: "Validation error" }, "403": { description: "Insufficient permission" } } },
  };
  mutableSwaggerSpec.paths[`/${path}/{id}`] = {
    get: { tags: ["Academy administration"], summary: `Read ${path} record`, security: [{ cookieAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }], "x-required-permission": permission, responses: { "200": { description: "Record details" }, "404": { description: "Not found" } } },
    patch: { tags: ["Academy administration"], summary: `Update ${path} record`, security: [{ cookieAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }], "x-required-permission": permission, responses: { "200": { description: "Updated record" }, "400": { description: "Validation error" } } },
    delete: { tags: ["Academy administration"], summary: `Delete ${path} record`, security: [{ cookieAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }], "x-required-permission": permission, responses: { "200": { description: "Deleted record" }, "409": { description: "Record is referenced" } } },
  };
}

Object.assign(mutableSwaggerSpec.paths, {
  "/public/intake": {
    post: {
      tags: ["Public intake"],
      summary: "Submit a public multipart registration",
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["registration", "file"],
              properties: {
                registration: { type: "string", description: "JSON string with the exact website registration payload" },
                file: { type: "string", format: "binary", description: "Required JPEG, PNG or WebP profile picture, up to 5 MB" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Registration, pending player and payment initialization result" },
        "400": { description: "Invalid payload or image" },
        "413": { description: "Image or request exceeds the size limit" },
        "503": { description: "Private image storage unavailable" },
      },
    },
  },
  "/public/payments/{reference}": {
    get: {
      tags: ["Public intake"],
      summary: "Retrieve an existing public registration payment summary",
      parameters: [{ in: "path", name: "reference", required: true, schema: { type: "string", minLength: 20, maxLength: 160 } }],
      responses: {
        "200": { description: "Minimal registration and payment summary, including any stored pending checkout URL" },
        "400": { description: "Invalid payment reference" },
        "404": { description: "Public registration payment not found" },
      },
    },
  },
  "/registrations/{id}/profile-image": {
    get: {
      tags: ["Registrations"],
      summary: "View a private registration profile image",
      security: [{ cookieAuth: [] }],
      parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
      "x-required-permission": "registrations.read and players.read_sensitive",
      responses: { "302": { description: "Redirect to a signed authenticated Cloudinary URL" }, "403": { description: "Insufficient permission" } },
    },
  },
  "/registrations/balances": { get: { tags: ["Finance"], summary: "List paginated registration balances", security: [{ cookieAuth: [] }], "x-required-permission": "registrations.read and payments.read", parameters: [{ in: "query", name: "page", schema: { type: "integer", minimum: 1 } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } }], responses: { "200": { description: "Registration balances with payment totals" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permission" } } } },
  "/dashboard/summary": { get: { tags: ["Analytics"], summary: "Read permission-filtered dashboard metrics and recent activity", security: [{ cookieAuth: [] }], "x-required-permission": "dashboard", responses: { "200": { description: "Dashboard metrics, operational queues, and activity" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permission" } } } },
  "/reports/academy": { get: { tags: ["Analytics"], summary: "Read academy operational report", security: [{ cookieAuth: [] }], "x-required-permission": "reports", responses: { "200": { description: "Academy counts and registration checks" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permission" } } } },
  "/audit-logs": { get: { tags: ["Audit"], summary: "Search paginated audit events", security: [{ cookieAuth: [] }], "x-required-permission": "audit", parameters: [{ in: "query", name: "page", schema: { type: "integer", minimum: 1 } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } }, { in: "query", name: "search", schema: { type: "string" } }], responses: { "200": { description: "Audit log page" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permission" } } } },
  "/registrations/{id}/balance": { get: { tags: ["Finance"], summary: "Read registration balance and payment history", security: [{ cookieAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }], "x-required-permission": "registrations.read and payments.read", responses: { "200": { description: "Amount due, paid, outstanding, and payment details" } } } },
  "/funding-summary": { get: { tags: ["Finance"], summary: "Summarize funding by category, kind, and currency", security: [{ cookieAuth: [] }], "x-required-permission": "funding", responses: { "200": { description: "Grouped funding totals" } } } },
  "/attendance-sessions/{id}/records": { get: { tags: ["Attendance"], summary: "List attendance marks for a session", security: [{ cookieAuth: [] }], "x-required-permission": "attendance", responses: { "200": { description: "Attendance record list" } } }, put: { tags: ["Attendance"], summary: "Atomically upsert session attendance marks", security: [{ cookieAuth: [] }], "x-required-permission": "attendance full", responses: { "200": { description: "Updated session counts" }, "400": { description: "Invalid player or marks" } } } },
  "/scholarship-applications/{id}/approve": { post: { tags: ["Scholarships"], summary: "Approve an application and create its award atomically", security: [{ cookieAuth: [] }], "x-required-permission": "scholarships full", responses: { "200": { description: "Application and award" }, "409": { description: "Application already approved" } } } },
  "/media/signature": { post: { tags: ["Content and media"], summary: "Create a short-lived signed private Cloudinary upload request", security: [{ cookieAuth: [] }], "x-required-permission": "content full", responses: { "200": { description: "Signed direct-upload parameters" }, "503": { description: "Media storage is not configured" } } } },
  "/media/assets": { post: { tags: ["Content and media"], summary: "Register an uploaded private media asset", security: [{ cookieAuth: [] }], "x-required-permission": "content full", responses: { "201": { description: "Media asset metadata" } } } },
  "/media/stories/{id}/media": { post: { tags: ["Content and media"], summary: "Attach a private media asset to a story", security: [{ cookieAuth: [] }], "x-required-permission": "content full", responses: { "201": { description: "Story media association" } } } },
});

const swaggerDocument = swaggerSpec as unknown as {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
};
Object.assign(swaggerDocument.paths, {
  "/payments": {
    get: {
      tags: ["Payments"],
      summary: "List payments with filters and pagination",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "payments.read",
      responses: { "200": { description: "Payment page" } },
    },
  },
  "/payments/{id}": {
    get: {
      tags: ["Payments"],
      summary: "Get payment details",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "payments.read",
      responses: { "200": { description: "Payment" } },
    },
  },
  "/payments/initialize": {
    post: {
      tags: ["Payments"],
      summary: "Initialize a registration payment with Paystack",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "payments.initialize",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PaymentInitialization" },
          },
        },
      },
      responses: {
        "201": { description: "Payment pending provider verification" },
        "503": { description: "Provider unavailable" },
      },
    },
  },
  "/payments/verify/{reference}": {
    post: {
      tags: ["Payments"],
      summary: "Verify Paystack reference server side",
      security: [],
      parameters: [
        {
          in: "path",
          name: "reference",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: { "200": { description: "Verified transaction state" } },
    },
  },
  "/payments/manual": {
    post: {
      tags: ["Payments"],
      summary: "Record a cash, bank transfer, or POS payment",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "payments.record",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ManualPayment" },
          },
        },
      },
      responses: {
        "201": { description: "Manual payment and receipt recorded" },
        "409": { description: "Duplicate request or transaction reference" },
      },
    },
  },
  "/payments/webhook/paystack": {
    post: {
      tags: ["Payments"],
      summary: "Receive a signature-verified Paystack webhook",
      parameters: [
        {
          in: "header",
          name: "x-paystack-signature",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Event acknowledged" },
        "401": { description: "Invalid signature" },
      },
    },
  },
  "/payments/reports/summary": {
    get: {
      tags: ["Finance"],
      summary: "Summarize collections, balances, refunds, and statuses",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "reports.finance.read",
      responses: { "200": { description: "Financial summary in NGN" } },
    },
  },
  "/payments/{id}/receipt": {
    get: {
      tags: ["Payments"],
      summary: "Get successful payment receipt data",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "payments.receipt.read",
      responses: {
        "200": { description: "Receipt data" },
        "404": { description: "Receipt unavailable" },
      },
    },
  },
  "/payments/{id}/refunds": {
    post: {
      tags: ["Payments"],
      summary: "Request a partial or full refund",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "payments.refunds.request",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RefundRequest" },
          },
        },
      },
      responses: {
        "201": { description: "Refund request created" },
        "400": { description: "Refund exceeds remaining payment" },
      },
    },
  },
  "/payments/refunds/{refundId}/approve": {
    post: {
      tags: ["Payments"],
      summary: "Approve and submit Paystack refund",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "refundId",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "payments.refunds.approve",
      responses: {
        "200": {
          description: "Refund submitted and remains pending provider outcome",
        },
      },
    },
  },
  "/payments/refunds/{refundId}/confirm-manual": {
    post: {
      tags: ["Payments"],
      summary: "Record outcome of an externally completed manual refund",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "refundId",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "payments.refunds.approve",
      responses: { "200": { description: "Manual refund outcome recorded" } },
    },
  },
});
Object.assign(swaggerDocument.components.schemas, {
  PaymentInitialization: {
    type: "object",
    required: ["registrationId", "idempotencyKey"],
    additionalProperties: false,
    properties: {
      registrationId: { type: "string", format: "uuid" },
      idempotencyKey: { type: "string", minLength: 8, maxLength: 120 },
      purpose: { type: "string", enum: ["registration", "programme_fee"] },
    },
  },
  ManualPayment: {
    type: "object",
    required: ["payerName", "amount", "method", "idempotencyKey", "paidAt"],
    additionalProperties: false,
    properties: {
      registrationId: { type: "string", format: "uuid" },
      playerId: { type: "string", format: "uuid" },
      payerName: { type: "string" },
      payerEmail: { type: "string", format: "email" },
      amount: { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
      currency: { type: "string", enum: ["NGN"] },
      method: { type: "string", enum: ["bank_transfer", "cash", "pos"] },
      purpose: { type: "string" },
      idempotencyKey: { type: "string" },
      paidAt: { type: "string", format: "date-time" },
    },
  },
  RefundRequest: {
    type: "object",
    required: ["amount", "reason"],
    additionalProperties: false,
    properties: {
      amount: { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
      reason: { type: "string", minLength: 3, maxLength: 1000 },
    },
  },
  NotificationPreferences: {
    type: "object",
    additionalProperties: false,
    properties: {
      emailEnabled: { type: "boolean" },
      smsEnabled: {
        type: "boolean",
        description:
          "Setting true records explicit staff self-service consent.",
      },
      inAppEnabled: { type: "boolean" },
      categoryPreferences: {
        type: "object",
        additionalProperties: { type: "boolean" },
      },
    },
  },
  StaffAnnouncement: {
    type: "object",
    required: ["idempotencyKey", "title", "body"],
    additionalProperties: false,
    properties: {
      idempotencyKey: { type: "string", minLength: 8, maxLength: 100 },
      title: { type: "string", maxLength: 200 },
      body: { type: "string", maxLength: 3000 },
      roleKeys: { type: "array", items: { type: "string" }, maxItems: 8 },
      link: {
        type: "string",
        description: "Optional local relative path only.",
      },
    },
  },
});

for (const path of Object.keys(swaggerDocument.paths)) {
  if (
    path === "/registrations/balances" ||
    path === "/registrations/{id}/balance"
  ) {
    delete swaggerDocument.paths[path];
  }
}

Object.assign(swaggerDocument.paths, {
  "/notifications": {
    get: {
      tags: ["Notifications"],
      summary: "List the authenticated staff member’s in-app notifications",
      security: [{ cookieAuth: [] }],
      responses: { "200": { description: "Paged private notification list" } },
    },
  },
  "/notifications/unread-count": {
    get: {
      tags: ["Notifications"],
      summary: "Get the current staff member’s unread count",
      security: [{ cookieAuth: [] }],
      responses: { "200": { description: "Unread count" } },
    },
  },
  "/notifications/{id}": {
    get: {
      tags: ["Notifications"],
      summary: "Get an owned notification",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": { description: "Notification details" },
        "404": { description: "Not found or not owned by caller" },
      },
    },
  },
  "/notifications/{id}/read": {
    patch: {
      tags: ["Notifications"],
      summary: "Mark an owned notification as read",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: { "200": { description: "Updated notification" } },
    },
  },
  "/notifications/read-all": {
    patch: {
      tags: ["Notifications"],
      summary: "Mark all of the caller’s notifications as read",
      security: [{ cookieAuth: [] }],
      responses: { "200": { description: "Updated count" } },
    },
  },
  "/notifications/preferences": {
    get: {
      tags: ["Notifications"],
      summary: "Get current staff notification preferences",
      security: [{ cookieAuth: [] }],
      responses: { "200": { description: "Preferences" } },
    },
    put: {
      tags: ["Notifications"],
      summary: "Update own channel and category preferences",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NotificationPreferences" },
          },
        },
      },
      responses: { "200": { description: "Updated preferences" } },
    },
  },
  "/admin/notifications/deliveries": {
    get: {
      tags: ["Notification administration"],
      summary: "Page delivery attempts without exposing recipient addresses",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "notifications.admin.read",
      responses: { "200": { description: "Delivery attempt page" } },
    },
  },
  "/admin/notifications/deliveries/{id}/retry": {
    post: {
      tags: ["Notification administration"],
      summary: "Retry an exhausted failed outbox event",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "notifications.retry",
      responses: { "200": { description: "Event queued for retry" } },
    },
  },
  "/admin/notifications/templates": {
    get: {
      tags: ["Notification administration"],
      summary: "List code-managed notification templates",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "notifications.templates.read",
      responses: {
        "200": {
          description:
            "Approved template catalog; templates are not editable through the API",
        },
      },
    },
  },
  "/admin/notifications/announcements": {
    post: {
      tags: ["Notification administration"],
      summary: "Queue an idempotent in-app staff announcement",
      security: [{ cookieAuth: [] }],
      "x-required-permission": "notifications.announce",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/StaffAnnouncement" },
          },
        },
      },
      responses: {
        "202": { description: "Announcement queued for selected active staff" },
      },
    },
  },
  "/admin/notifications/guardians/{id}/sms-consent": {
    put: {
      tags: ["Notification administration"],
      summary: "Record guardian SMS consent or revocation with source audit",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      "x-required-permission": "notifications.preferences.manage",
      responses: { "200": { description: "Consent preference recorded" } },
    },
  },
});
