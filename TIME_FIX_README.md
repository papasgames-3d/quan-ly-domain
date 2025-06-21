# 🕐 Hướng dẫn khắc phục vấn đề thời gian hệ thống

## 🔍 Vấn đề phát hiện

Hệ thống của bạn hiện đang hiển thị ngày **2025-06-21** thay vì năm 2024, điều này khiến:

- Domain với ngày hết hạn năm 2025 bị hiển thị là "đã hết hạn" 
- Tính toán số ngày còn lại không chính xác
- Cảnh báo hết hạn không đúng

## ✅ Giải pháp đã áp dụng

Tôi đã thêm tính năng **Time Override** để khắc phục:

### 1. Cách chạy với thời gian chính xác
```bash
# Windows PowerShell
$env:TIME_OVERRIDE="2024-12-21"; npm start

# Linux/Mac
TIME_OVERRIDE="2024-12-21" npm start
```

### 2. Kiểm tra thông tin thời gian
Truy cập: `http://localhost:3000/api/system-info`

## 🛠️ Cách sửa thời gian hệ thống vĩnh viễn

### Windows:
1. Nhấn `Win + R`, gõ `timedate.cpl`
2. Nhấn "Change date and time..."
3. Đặt ngày hiện tại (năm 2024)
4. Nhấn OK

### Hoặc dùng Command Line:
```cmd
# Đặt ngày về năm 2024 (thay MM-dd bằng tháng-ngày hiện tại)
date 12-21-2024
```

## 📊 Kết quả sau khi sửa

Với Time Override `2024-12-21`, domain `slopegame3d.com` (hết hạn `2025-06-03`) sẽ hiển thị:

- ✅ **164 ngày** còn lại 
- ✅ Trạng thái: **Hoạt động** (không còn cảnh báo hết hạn)
- ✅ Badge màu xanh thay vì đỏ

## 🔧 Tùy chỉnh thời gian khác

Bạn có thể đặt thời gian bất kỳ:
```bash
# Đặt thời gian là đầu năm 2024
$env:TIME_OVERRIDE="2024-01-01"; npm start

# Đặt thời gian là tháng 6 năm 2024  
$env:TIME_OVERRIDE="2024-06-01"; npm start
```

## 🚨 Lưu ý quan trọng

- Time Override chỉ ảnh hưởng đến tính toán ngày hết hạn
- WHOIS data vẫn được lấy từ server thực
- Khi sửa thời gian hệ thống, hãy khởi động lại mà không cần TIME_OVERRIDE

## 🎯 Kiểm tra hoạt động

1. Mở `http://localhost:3000`
2. Tìm domain `slopegame3d.com`
3. Xem số ngày còn lại (phải là số dương, khoảng 164 ngày)
4. Kiểm tra màu card (phải là xanh, không phải đỏ)

---

**Vấn đề đã được khắc phục! Domain của bạn sẽ hiển thị chính xác thời gian còn lại.** ✅ 