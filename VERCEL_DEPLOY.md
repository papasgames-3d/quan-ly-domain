# Hướng dẫn Deploy Domain Expiry Tracker lên Vercel

## Bước 1: Chuẩn bị dự án

Dự án đã được cấu hình sẵn cho Vercel với:
- `vercel.json`: Cấu hình deployment
- `api/index.js`: Serverless function entry point
- `package.json`: Đã có engines và build scripts

## Bước 2: Tạo tài khoản Vercel

1. Truy cập [vercel.com](https://vercel.com)
2. Đăng ký bằng GitHub account
3. Kết nối với GitHub repository

## Bước 3: Deploy từ GitHub

### Cách 1: Deploy qua Vercel Dashboard

1. Đăng nhập vào Vercel Dashboard
2. Click "New Project"
3. Import repository từ GitHub
4. Chọn repository chứa dự án này
5. Vercel sẽ tự động detect và deploy

### Cách 2: Deploy bằng Vercel CLI

```bash
# Cài đặt Vercel CLI
npm i -g vercel

# Login vào Vercel
vercel login

# Deploy dự án
vercel

# Deploy production
vercel --prod
```

## Bước 4: Cấu hình Environment Variables (Tùy chọn)

Trong Vercel Dashboard:
1. Vào Project Settings
2. Tab "Environment Variables"
3. Thêm biến:
   - `TIME_OVERRIDE`: Để test thời gian (format: YYYY-MM-DD)
   - `NODE_ENV`: production

## Bước 5: Cấu hình Domain (Tùy chọn)

1. Trong Project Settings
2. Tab "Domains"
3. Thêm custom domain nếu có

## Lưu ý quan trọng

### Database
- Vercel sử dụng serverless functions, mỗi request tạo instance mới
- Database hiện tại sử dụng in-memory SQLite (dữ liệu sẽ mất sau mỗi request)
- **Khuyến nghị**: Sử dụng cloud database như:
  - [PlanetScale](https://planetscale.com/) (MySQL)
  - [Supabase](https://supabase.com/) (PostgreSQL)
  - [MongoDB Atlas](https://www.mongodb.com/atlas)

### Cron Jobs
- Vercel không hỗ trợ cron jobs trực tiếp
- **Khuyến nghị**: Sử dụng:
  - [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) (Beta)
  - [GitHub Actions](https://github.com/features/actions)
  - External cron service như [cron-job.org](https://cron-job.org)

### Performance
- Cold start có thể chậm lần đầu
- WHOIS lookups có thể timeout trên serverless
- **Khuyến nghị**: Cache kết quả WHOIS trong database

## Cấu trúc File cho Vercel

```
domain-ex/
├── api/
│   └── index.js          # Serverless function
├── public/               # Static files
│   ├── index.html
│   ├── script.js
│   └── style.css
├── vercel.json          # Vercel config
├── package.json         # Dependencies
└── README.md
```

## Troubleshooting

### Lỗi thường gặp:

1. **Build failed**: Kiểm tra `package.json` và dependencies
2. **Function timeout**: WHOIS lookup quá lâu, cần optimize
3. **Database error**: Cần chuyển sang cloud database
4. **Static files không load**: Kiểm tra đường dẫn trong `vercel.json`

### Debug:

1. Xem logs trong Vercel Dashboard
2. Test local với `vercel dev`
3. Kiểm tra Function logs trong Runtime Logs

## URL sau khi deploy

Vercel sẽ cung cấp URL dạng:
- `https://your-project-name.vercel.app`
- `https://your-project-name-git-main-username.vercel.app`

## Cập nhật dự án

Mỗi khi push code lên GitHub, Vercel sẽ tự động deploy lại.

## Chi phí

- Vercel có gói miễn phí với giới hạn:
  - 100GB bandwidth/tháng
  - 100 serverless function executions/ngày
  - Unlimited static sites

Để sử dụng production với traffic cao, cần upgrade plan. 