# CampusCare

A campus issue-reporting and management platform built with React Native (Expo) and a Node.js/Express REST API backed by Supabase.

## Overview

CampusCare allows community members to report campus issues (maintenance, infrastructure, cleanliness, sustainability), facility managers to assign workers and track resolution, and workers to update task status and communicate via comments.

## Roles

- **Community Member** — submit and track issues
- **Facility Manager** — assign workers, update status, close issues
- **Worker** — view assigned tasks, mark in progress, add comments
- **Admin** — manage all users, deactivate/delete accounts

## Tech Stack

- **Frontend**: React Native, Expo Router, TypeScript
- **Backend**: Node.js, Express, REST API
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)

## Getting Started

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Start backend
node server.js

# Start Expo
cd .. && npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `.env` to your machine's local IP (e.g. `http://192.168.1.x:5000`) when testing on a physical device.

## Seeding the Admin Account

Admin accounts cannot be created through the app. Use the seed script instead.

Add these variables to `backend/.env`:

```
ADMIN_EMAIL=admin@yourschool.edu
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_NAME=Admin
```

Then run:

```bash
node scripts/seedAdmin.js
```

The script skips silently if an admin with that email already exists.
