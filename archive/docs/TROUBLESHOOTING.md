# Troubleshooting "Failed to fetch namespaces" Error

## ✅ Current Status

Your container is now running correctly with:
- ✅ Volume mounts properly configured
- ✅ Certificates accessible: `/root/.minikube/profiles/minikube/client.crt`
- ✅ Backend connected to Kubernetes: "Connection successful for minikube - Found 70 namespaces"
- ✅ Backend API running on port 3006

## 🔍 If You Still See "Failed to fetch namespaces"

This error typically means the **frontend** can't reach the **backend API**. Here's how to fix it:

### 1. **Check Backend is Running**

```bash
# Check container is running
docker ps | grep qa-kubelens-qa

# Check backend logs
docker logs qa-kubelens-qa | tail -20

# Test backend API directly
curl http://localhost:8087/api/environments
```

### 2. **Check Port Mapping**

Your container is mapped to port **8087** (not 8089):
- Container port: `3006`
- Host port: `8087`
- Access URL: `http://localhost:8087`

**Make sure you're accessing the correct port!**

### 3. **Check Browser Console**

Open browser developer tools (F12) and check:
- **Console tab**: Look for CORS errors or network errors
- **Network tab**: Check if API calls are being made and what responses you get

### 4. **Verify API Endpoint**

The frontend should be calling:
```
http://localhost:8087/api/environments
```

If you see CORS errors, the backend might not be configured correctly.

### 5. **Check Authentication**

The error might be authentication-related:
- Make sure you're logged in
- Check if session is valid
- Try logging out and logging back in

### 6. **Common Issues & Solutions**

#### Issue: "Failed to fetch namespaces" after login

**Solution:** Check if the API requires authentication:
```bash
# Test with session (if you have one)
curl -H "x-session-id: YOUR_SESSION_ID" http://localhost:8087/api/environments
```

#### Issue: CORS errors in browser

**Solution:** The backend should handle CORS, but check logs:
```bash
docker logs qa-kubelens-qa | grep -i cors
```

#### Issue: Wrong port

**Solution:** Make sure you're using port **8087**:
- ✅ Correct: `http://localhost:8087`
- ❌ Wrong: `http://localhost:8089` (if that's not mapped)

### 7. **Quick Fix: Restart Container**

```bash
docker restart qa-kubelens-qa
# Wait 5 seconds
docker logs qa-kubelens-qa | tail -10
```

### 8. **Verify Full Setup**

Run this to verify everything:
```bash
# 1. Container running
docker ps | grep qa-kubelens-qa

# 2. Port accessible
curl -I http://localhost:8087

# 3. Backend API responding
curl http://localhost:8087/api/environments

# 4. Kubernetes connection working
docker logs qa-kubelens-qa | grep "Connection successful"
```

## 🎯 Expected Behavior

When everything works:
1. ✅ Container starts and mounts volumes
2. ✅ Backend connects to Kubernetes
3. ✅ Logs show: "Connection successful for minikube - Found 70 namespaces"
4. ✅ Frontend can access: `http://localhost:8087`
5. ✅ Login works
6. ✅ Can fetch environments and namespaces

## 📝 Current Container Info

- **Name:** `qa-kubelens-qa`
- **Port:** `8087:3006`
- **Image:** `iitrkp/dev-kubelens:qa`
- **Status:** ✅ Running with proper mounts
- **Kubernetes:** ✅ Connected (70 namespaces found)

## 🚀 Next Steps

1. **Access the application:** `http://localhost:8087`
2. **Login** with your credentials
3. **Select an environment** (should show: minikube, docker, kind, rancher-desktop)
4. **Select a namespace** (should show all 70 namespaces from minikube)

If you still see errors, check the browser console and share the exact error message!

