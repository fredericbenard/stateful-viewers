# Public Profiles

This directory contains curated viewer profiles that are tracked in git and distributed with the repository.

## Purpose

Public profiles provide new users with example viewer profiles they can use immediately without needing to generate their own. These profiles are combined with user-generated profiles (stored in `../`) when listing available profiles.

## How It Works

- **Public profiles** (`data/profiles/public/`) → Tracked in git, available to all users
- **User profiles** (`data/profiles/`) → Gitignored, user-specific

When loading profiles:
1. The system reads from both directories
2. User-generated profiles take precedence over public profiles (if same ID exists in both)
3. Profiles are merged and deduplicated automatically

## Adding Public Profiles

To add a new public profile:
1. Place the profile JSON file in this directory
2. Ensure it follows the standard profile schema (see `src/lib/saveProfile.ts`)
3. Commit the file to git
