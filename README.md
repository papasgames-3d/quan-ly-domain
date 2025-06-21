# Domain Expiry Tracker

Ứng dụng web để quản lý và theo dõi thời gian hết hạn của các domain. Giúp bạn không bao giờ quên gia hạn domain quan trọng!

## 🌟 Tính năng

- **Dashboard thống kê**: Hiển thị tổng quan về domain của bạn
- **Quản lý domain**: Thêm, xóa, cập nhật thông tin domain
- **Theo dõi thời hạn**: Cảnh báo domain sắp hết hạn (trong vòng 30 ngày)
- **Tự động cập nhật**: Kiểm tra thông tin domain định kỳ
- **Xuất dữ liệu**: Xuất danh sách domain ra file CSV
- **Tìm kiếm và lọc**: Dễ dàng tìm kiếm theo tên domain hoặc trạng thái
- **Giao diện đẹp**: Thiết kế hiện đại, responsive trên mọi thiết bị

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js (version 14 trở lên)
- npm hoặc yarn

### Bước 1: Clone dự án
```bash
git clone <repository-url>
cd domain-ex
```

### Bước 2: Cài đặt dependencies
```bash
npm install
```

### Bước 3: Chạy ứng dụng
```bash
# Chạy trong môi trường development
npm run dev

# Hoặc chạy trong môi trường production
npm start
```

### Bước 4: Truy cập ứng dụng
Mở trình duyệt và truy cập: `http://localhost:3000`

## 📖 Cách sử dụng

### 1. Thêm domain mới
- Nhập tên domain vào ô "Nhập domain mới"
- Nhấn nút "Thêm Domain" hoặc Enter
- Hệ thống sẽ tự động kiểm tra thông tin domain

### 2. Xem thông tin domain
- Domain sẽ được hiển thị dưới dạng card với các thông tin:
  - Tên domain
  - Trạng thái (Hoạt động/Lỗi/Đang kiểm tra)
  - Ngày hết hạn
  - Số ngày còn lại
  - Nhà đăng ký
  - Lần cập nhật cuối

### 3. Quản lý domain
- **Cập nhật**: Nhấn icon đồng hồ để cập nhật thông tin domain
- **Chi tiết**: Nhấn icon thông tin để xem chi tiết
- **Xóa**: Nhấn icon thùng rác để xóa domain

### 4. Lọc và tìm kiếm
- Sử dụng dropdown để lọc theo trạng thái
- Sử dụng ô tìm kiếm để tìm domain cụ thể

### 5. Xuất dữ liệu
- Nhấn nút "Xuất CSV" để tải xuống danh sách domain

## 🎯 Tính năng tự động

### Cập nhật định kỳ
- Ứng dụng tự động kiểm tra thông tin domain mỗi ngày lúc 2h sáng
- Frontend tự động refresh dữ liệu mỗi 5 phút

### Cảnh báo hết hạn
- Domain sắp hết hạn (≤30 ngày) sẽ được highlight màu vàng
- Domain đã hết hạn sẽ được highlight màu đỏ

## 🗂️ Cấu trúc dự án

```
domain-ex/
├── server.js              # Server Node.js chính
├── package.json           # Dependencies và scripts
├── domains.db            # Database SQLite (tự động tạo)
├── public/               # Frontend files
│   ├── index.html        # Giao diện chính
│   ├── style.css         # Stylesheet
│   └── script.js         # JavaScript frontend
└── README.md             # Tài liệu hướng dẫn
```

## 🔧 API Endpoints

- `GET /api/domains` - Lấy danh sách tất cả domain
- `POST /api/domains` - Thêm domain mới
- `DELETE /api/domains/:id` - Xóa domain
- `POST /api/domains/:id/refresh` - Cập nhật thông tin domain

## 🎨 Tùy chỉnh

### Thay đổi thời gian cảnh báo
Mở file `server.js` và sửa đổi giá trị `30` trong hàm kiểm tra:
```javascript
const daysUntilExpiry = expiryMoment.diff(moment(), 'days');
// Thay đổi điều kiện domain sắp hết hạn
```

### Thay đổi tần suất cập nhật tự động
Sửa đổi cron schedule trong `server.js`:
```javascript
// Hiện tại: mỗi ngày lúc 2h sáng
cron.schedule('0 2 * * *', () => {
  // Thay đổi thành tần suất khác
});
```

## 🐛 Khắc phục sự cố

### Lỗi khi cài đặt
```bash
# Xóa node_modules và cài đặt lại
rm -rf node_modules package-lock.json
npm install
```

### Lỗi kết nối database
- Database SQLite sẽ tự động được tạo khi chạy lần đầu
- Nếu gặp lỗi, hãy xóa file `domains.db` và khởi động lại

### Domain không cập nhất được thông tin
- Một số domain có thể không hỗ trợ WHOIS query
- Hãy thử cập nhật thủ công hoặc kiểm tra lại tên domain

## 🤝 Đóng góp

Nếu bạn muốn đóng góp cho dự án:
1. Fork repository
2. Tạo branch mới cho feature
3. Commit changes
4. Push lên branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy tạo issue trên GitHub hoặc liên hệ qua email.

---

**Chúc bạn quản lý domain hiệu quả! 🚀** 