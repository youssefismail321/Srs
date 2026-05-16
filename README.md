# CampusCare

A campus issue-reporting and management platform built with React Native (Expo) and a Node.js/Express REST API backed by Supabase.

## Overview

CampusCare allows community members to report campus issues (maintenance, infrastructure, cleanliness, sustainability), facility managers to assign workers and track resolution, and workers to update task status and communicate via comments and photos.

## Roles

| Role | Capabilities |
|---|---|
| Community Member | Submit issues, track status, view updates |
| Facility Manager | Assign workers, update/close issues, view all issues |
| Worker | View assigned tasks, mark progress, add comments and photos |
| Admin | Manage all user accounts, deactivate/delete users |

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile frontend | React Native 0.81, Expo Router 6, TypeScript |
| Backend API | Node.js 20, Express 4 |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage |

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Expo Go app on your phone (iOS or Android)
- A Supabase project with the schema from `docs/schema.md` applied

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/youssefismail321/Srs.git
cd Srs

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd backend && npm install && cd ..
```

## Environment Variables

### Root `.env` (frontend)

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_API_URL=http://<your-local-ip>:5000
```

### `backend/.env`

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
PORT=5000
ADMIN_EMAIL=admin@yourschool.edu
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Admin
```

Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP so the phone can reach the backend (e.g. `http://192.168.1.10:5000`). Your phone must be on the same Wi-Fi network.

## Running the App

**Terminal 1 — Backend**
```bash
node backend/server.js
```
Expected output: `CampusCare API running on port 5000` and `Supabase connection OK`.

**Terminal 2 — Expo**
```bash
npx expo start --offline
```
Scan the QR code with Expo Go.

## Seeding the Admin Account

Admin accounts cannot be registered through the app. Seed one with:

```bash
node scripts/seedAdmin.js
```

The script skips silently if that email already exists. To reset the admin password:

```bash
node scripts/resetAdmin.js
```

## Project Structure

```
├── app/                    Expo Router screens
│   ├── (auth)/             Login and register
│   ├── (community)/        Community member screens
│   ├── (manager)/          Facility manager screens
│   ├── (worker)/           Worker screens
│   └── (admin)/            Admin screens
├── backend/                Node.js / Express API
│   ├── controllers/        Route handlers
│   ├── middleware/         Auth middleware
│   ├── routes/             Express routers
│   └── lib/                Supabase client
├── src/
│   ├── components/         Shared UI components
│   ├── constants/          Theme tokens
│   ├── contexts/           Auth context
│   ├── lib/                API helper and Supabase client
│   └── types/              TypeScript interfaces
├── scripts/                Admin seed/reset utilities
└── docs/                   SRS, API docs, schema
```

## Documentation

| Document | Path |
|---|---|
| Software Requirements Specification | [docs/SRS.md](docs/SRS.md) |
| API Reference | [docs/API.md](docs/API.md) |
| Database Schema + ERD | [docs/schema.md](docs/schema.md) |

## Team

| Name | Role | Email |
|---|---|---|
| Micho | Frontend – Worker screens & shared components | michonabilsaad123khalil@gmail.com |
| Ali | Backend – Express API & Supabase integration | ali.safwat@student.giu-uni.de |
| Youssef | Frontend – Auth & community member screens | youssefbadereldin@gmail.com |
| Eyad | Frontend – Manager & admin screens | eyad.radwan@student.giu-uni.de |
