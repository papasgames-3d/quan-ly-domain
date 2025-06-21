# Hướng dẫn Deploy Domain Expiry Tracker lên Render.com

## 🚀 Tại sao chọn Render thay vì Vercel?

- ✅ **Persistent Storage**: Database SQLite sẽ được lưu trữ
- ✅ **Cron Jobs**: Hỗ trợ background tasks
- ✅ **Node.js App**: Phù hợp hơn cho ứng dụng Express
- ✅ **Free Plan**: 750 giờ/tháng miễn phí
- ✅ **Dễ setup**: Ít cấu hình phức tạp hơn

## 📋 Bước 1: Chuẩn bị GitHub Repository

### Nếu chưa có Git:
1. Tải Git: [git-scm.com](https://git-scm.com/download/win)
2. Cài đặt với cài đặt mặc định

### Upload code lên GitHub:
```bash
# Khởi tạo git (nếu chưa có)
git init

# Thêm tất cả files
git add .

# Commit
git commit -m "Initial commit for Render deployment"

# Tạo repository trên GitHub và thêm remote
git remote add origin https://github.com/YOUR_USERNAME/domain-expiry-tracker.git

# Push code
git push -u origin main
```

## 🌐 Bước 2: Deploy trên Render

### 1. Tạo tài khoản Render
- Truy cập [render.com](https://render.com)
- Đăng ký bằng GitHub account

### 2. Tạo Web Service
1. **Dashboard** → **New** → **Web Service**
2. **Connect GitHub repository** → Chọn `domain-expiry-tracker`
3. **Cấu hình deployment:**

```
Name: domain-expiry-tracker
Runtime: Node
Region: Singapore (gần Việt Nam nhất)
Branch: main
Build Command: npm install
Start Command: npm start
```

### 3. Environment Variables (Tùy chọn)
Trong **Environment** tab, thêm:
- `NODE_ENV` = `production`
- `TIME_OVERRIDE` = `2024-12-21` (nếu muốn test thời gian)

### 4. Deploy
- Click **Create Web Service**
- Render sẽ tự động build và deploy
- Thời gian deploy: 3-5 phút

## 📱 Bước 3: Kiểm tra sau deploy

### URLs sẽ có dạng:
- `https://domain-expiry-tracker-xxx.onrender.com`
- `https://domain-expiry-tracker-xxx.onrender.com/api/domains`
- `https://domain-expiry-tracker-xxx.onrender.com/api/system-info`

### Test các chức năng:
1. **Trang chủ**: Load được giao diện
2. **API domains**: Trả về JSON với danh sách domains
3. **Add domain**: Thêm domain mới thành công
4. **WHOIS check**: Domains được kiểm tra tự động

## ⚙️ Tính năng hoạt động trên Render:

✅ **Database**: SQLite file được lưu persistent
✅ **WHOIS checking**: Hoạt động bình thường  
✅ **Cron jobs**: Auto-check domains hàng ngày
✅ **DNS validation**: Enhanced validation hoạt động
✅ **Real-time updates**: Domains được cập nhật

## 🔧 Troubleshooting

### Lỗi thường gặp:

1. **Build failed**: 
   - Kiểm tra `package.json` có đúng dependencies
   - Xem Build Logs trong Render Dashboard

2. **App crash**:
   - Xem Runtime Logs trong Render Dashboard
   - Kiểm tra PORT environment variable

3. **Database issues**:
   - Render tự động tạo persistent disk
   - Database sẽ được lưu giữ qua các lần deploy

4. **Slow first load**:
   - Free plan có "cold start" - app ngủ sau 15 phút không dùng
   - Lần đầu load sẽ chậm ~30 giây

### Debug:
1. **Render Dashboard** → **Logs** tab
2. **Events** tab để xem deploy history
3. **Metrics** tab để monitor performance

## 💰 Chi phí:

**Free Plan:**
- 750 giờ/tháng (đủ cho 1 app chạy 24/7)
- 512MB RAM
- Persistent disk
- Custom domain (nếu có)

**Paid Plan** ($7/tháng):
- Unlimited hours
- 1GB RAM
- Faster builds
- No cold starts

## 🔄 Cập nhật app:

Mỗi khi push code mới lên GitHub:
1. Render tự động detect changes
2. Auto-deploy với code mới
3. Zero-downtime deployment

## 📊 Monitoring:

- **Uptime**: Render monitor 24/7
- **Logs**: Real-time logs trong dashboard
- **Metrics**: CPU, Memory usage
- **Alerts**: Email khi app down

## 🎯 Kết luận:

Render phù hợp hơn Vercel cho ứng dụng này vì:
- Persistent database
- Cron jobs hoạt động
- Ít cấu hình phức tạp
- Free plan generous hơn

Deploy và test ngay! 