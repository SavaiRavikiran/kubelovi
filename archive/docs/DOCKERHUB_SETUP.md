# Docker Hub Setup Guide

## Issue: Push Access Denied

This error occurs when:
1. You're not logged into Docker Hub
2. The repository doesn't exist
3. You don't have permission to push to the repository

## Solution Steps

### Step 1: Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub credentials:
- Username: `iitrkp` (or your Docker Hub username)
- Password: Your Docker Hub password (or access token)

**Note:** If you have 2FA enabled, you'll need to use an access token instead of your password.

### Step 2: Create Repository on Docker Hub

1. Go to https://hub.docker.com/
2. Click on your profile → "Repositories"
3. Click "Create Repository"
4. Repository details:
   - **Name:** `dev-kubelens`
   - **Visibility:** Public or Private (your choice)
   - **Description:** (optional)
5. Click "Create"

### Step 3: Verify Repository Path

Make sure the repository name matches:
- **Full path:** `iitrkp/dev-kubelens`
- **Tag:** `dev`

### Step 4: Push the Image

```bash
cd /Users/Ravikiran_Savai/kubelens/kubelens
docker push iitrkp/dev-kubelens:dev
```

## Alternative: Use Access Token (Recommended for 2FA)

If you have 2FA enabled:

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Give it a name (e.g., "kubelens-push")
4. Copy the token
5. Use it as password when running `docker login`

```bash
docker login
# Username: iitrkp
# Password: <paste your access token>
```

## Verify Login

```bash
docker info | grep -i username
```

Should show your username if logged in.

## Troubleshooting

### Error: "repository does not exist"
- **Solution:** Create the repository on Docker Hub first (Step 2)

### Error: "insufficient_scope: authorization failed"
- **Solution:** Make sure you're logged in with the correct account that owns the repository

### Error: "unauthorized: authentication required"
- **Solution:** Run `docker login` again

### Check Current Login Status
```bash
cat ~/.docker/config.json | grep -A 5 "auths"
```

## Quick Commands

```bash
# Login
docker login

# Build (if not already built)
docker build -t iitrkp/dev-kubelens:dev .

# Push
docker push iitrkp/dev-kubelens:dev

# Also push as latest (optional)
docker tag iitrkp/dev-kubelens:dev iitrkp/dev-kubelens:latest
docker push iitrkp/dev-kubelens:latest
```

