# CampusCare API Reference

**Base URL:** `http://<server-ip>:5000`  
**Content-Type:** `application/json` (except file uploads which use `multipart/form-data`)

## Authentication

All endpoints except `/api/auth/login` and `/api/auth/register` require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The token is returned in the login response as `token`. It is a Supabase JWT and expires according to Supabase's session policy.

---

## Auth

### POST /api/auth/register

Create a new user account.

**Request body**

```json
{
  "email": "jane@example.com",
  "password": "min6chars",
  "name": "Jane Smith",
  "role": "community_member"
}
```

`role` must be one of: `community_member`, `facility_manager`, `worker`. Passing `admin` returns 403.

**Response 201**

```json
{
  "message": "Account created successfully",
  "userId": "uuid"
}
```

**Errors**

| Status | Body | Reason |
|---|---|---|
| 400 | `{ "error": "email, password, name, and role are required" }` | Missing field |
| 400 | `{ "error": "<supabase message>" }` | Email already in use or weak password |
| 403 | `{ "error": "Cannot self-register as admin" }` | role = admin |
| 500 | `{ "error": "Failed to create profile" }` | DB write failed |

---

### POST /api/auth/login

Authenticate and receive a session token.

**Request body**

```json
{
  "email": "jane@example.com",
  "password": "min6chars"
}
```

**Response 200**

```json
{
  "token": "<access_token>",
  "refresh_token": "<refresh_token>",
  "user": { "id": "uuid", "email": "jane@example.com" },
  "profile": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "community_member",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

**Errors**

| Status | Body | Reason |
|---|---|---|
| 400 | `{ "error": "Email and password are required" }` | Missing field |
| 401 | `{ "error": "Invalid login credentials" }` | Wrong password or unknown email |
| 403 | `{ "error": "Account is deactivated. Contact an administrator." }` | Account disabled by admin |

---

### POST /api/auth/logout

Invalidate the current session.

**Headers:** `Authorization: Bearer <token>`

**Response 200**

```json
{ "message": "Logged out successfully" }
```

---

## Users (Profiles)

### GET /api/users

List user profiles.

**Auth:** admin or facility_manager  
**Query params**

| Param | Type | Description |
|---|---|---|
| `role` | string | Filter by role |
| `is_active` | boolean | Filter by active status |

**Response 200** — array of profile objects (see profile shape in login response).

---

### GET /api/users/:id

Get a single profile.

**Auth:** any authenticated user

**Response 200** — single profile object.

**Errors**

| Status | Reason |
|---|---|
| 404 | User not found |

---

### PATCH /api/users/:id

Update a profile.

**Auth:** the user themselves, or admin for `is_active` changes

**Request body** (all fields optional)

```json
{
  "name": "New Name",
  "is_active": false
}
```

Only admins can set `is_active`. A non-admin updating another user's profile returns 403.

**Response 200** — updated profile object.

**Errors**

| Status | Reason |
|---|---|
| 400 | No valid fields to update |
| 403 | Not permitted |
| 403 | Cannot deactivate another admin account |

---

### DELETE /api/users/:id

Permanently delete a user account and their auth record.

**Auth:** admin only  
**Constraint:** Cannot delete your own account or another admin.

**Response 200**

```json
{ "message": "Jane Smith has been permanently deleted" }
```

---

## Issues

### GET /api/issues

List issues.

**Auth:** any authenticated user  
**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | `pending`, `in_progress`, or `resolved` |
| `assigned_to` | uuid | Filter to issues assigned to this worker |
| `created_by` | uuid | Filter to issues created by this user |

**Response 200** — array of issue objects.

```json
[
  {
    "id": "uuid",
    "title": "Broken light in corridor B",
    "description": "Fluorescent tube has been out for 3 days.",
    "category": "maintenance",
    "location": "Building A, Floor 2",
    "status": "pending",
    "image_url": "https://…/image.jpg",
    "created_by": "uuid",
    "created_at": "2026-01-01T08:00:00Z",
    "updated_at": "2026-01-01T08:00:00Z"
  }
]
```

---

### GET /api/issues/:id

Get a single issue with full detail.

**Auth:** any authenticated user

**Response 200**

```json
{
  "id": "uuid",
  "title": "…",
  "status": "in_progress",
  "…": "…",
  "assignment": {
    "id": "uuid",
    "issue_id": "uuid",
    "worker_id": "uuid",
    "assigned_by": "uuid",
    "assigned_at": "2026-01-02T09:00:00Z",
    "worker": { "id": "uuid", "name": "Bob", "email": "bob@example.com" }
  },
  "status_history": [
    {
      "id": "uuid",
      "old_status": "pending",
      "new_status": "in_progress",
      "changed_by": "uuid",
      "changed_at": "2026-01-02T09:00:00Z",
      "note": null
    }
  ]
}
```

**Errors**

| Status | Reason |
|---|---|
| 404 | Issue not found |

---

### POST /api/issues

Create a new issue.

**Auth:** community_member or admin

**Request body**

```json
{
  "title": "Broken light in corridor B",
  "description": "Fluorescent tube has been out for 3 days.",
  "category": "maintenance",
  "location": "Building A, Floor 2",
  "image_url": "https://…/image.jpg"
}
```

`category` must be one of: `maintenance`, `infrastructure`, `sustainability`, `cleanliness`, `other`.  
`description` and `image_url` are optional.

**Response 201** — created issue object.

---

### PATCH /api/issues/:id

Update an issue's status.

**Auth:** facility_manager, admin, or the assigned worker (workers limited to `in_progress` / `resolved`)

**Request body**

```json
{ "status": "resolved" }
```

**Response 200** — updated issue object. Also writes a `status_history` row.

**Errors**

| Status | Reason |
|---|---|
| 403 | Worker updating issue not assigned to them |
| 403 | Worker trying to set unsupported status |
| 400 | No valid fields to update |

---

### DELETE /api/issues/:id

Delete an issue.

**Auth:** admin, facility_manager, or the issue creator

**Response 200**

```json
{ "message": "Issue deleted successfully" }
```

---

### POST /api/issues/:id/assign

Assign a worker to an issue.

**Auth:** facility_manager or admin

**Request body**

```json
{ "worker_id": "uuid" }
```

Send `{ "worker_id": null }` to unassign. Assigning a worker to a `pending` issue automatically advances it to `in_progress`.

**Response 200** — assignment object with embedded worker profile.

---

### GET /api/issues/:id/comments

List comments on an issue.

**Auth:** any authenticated user

**Response 200** — array of comment objects ordered by `created_at` ascending.

```json
[
  {
    "id": "uuid",
    "issue_id": "uuid",
    "user_id": "uuid",
    "content": "Ordered the replacement tube, arriving tomorrow.",
    "image_url": "https://…/photo.jpg",
    "created_at": "2026-01-03T11:00:00Z",
    "author": { "id": "uuid", "name": "Bob", "role": "worker" }
  }
]
```

---

### POST /api/issues/:id/comments

Add a comment to an issue.

**Auth:** any authenticated user

**Request body**

```json
{
  "content": "Ordered the replacement tube, arriving tomorrow.",
  "image_url": "https://…/photo.jpg"
}
```

At least one of `content` or `image_url` must be present.

**Response 201** — created comment object with embedded author.

---

## Upload

### POST /api/upload

Upload an image file to Supabase Storage.

**Auth:** any authenticated user  
**Content-Type:** `multipart/form-data`  
**Field name:** `file`  
**Accepted types:** JPEG, PNG, WebP, GIF  
**Max size:** 10 MB

**Response 200**

```json
{ "url": "https://…/storage/v1/object/public/issue-images/uploads/filename.jpg" }
```

Use the returned `url` as `image_url` in subsequent issue or comment requests.

**Errors**

| Status | Reason |
|---|---|
| 400 | No file provided |
| 400 | Unsupported file type |
| 500 | Storage upload failed |
