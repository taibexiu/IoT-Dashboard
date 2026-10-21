# Hệ thống IoT — React, Node.js, MQTT, SQL Server

## Cách hoạt động để trình bày báo cáo

```text
Cảm biến DHT11/LDR → ESP32 → MQTT datasensor → Node.js → SQL Server
                                                     ↓ WebSocket
                                               React cập nhật biểu đồ

Công tắc trên web → API Node.js → MQTT control → ESP32 bật/tắt LED
                          ↑                            ↓
                    Lưu lịch sử ← xác nhận MQTT status
```

FE hiển thị giao diện. BE xác thực tài khoản, nhận dữ liệu, ghi SQL và chuyển
sự kiện qua WebSocket. Mosquitto chuyển thông điệp giữa ESP32 và BE.
ESP32 dùng nguyên code Arduino đã có: DHT11 chân 33, LDR chân 34, LED chân 27/26/25.

## Chạy trên máy này

SQL Server phải đang chạy. `.env` của BE đã cấu hình SQL và MQTT cho máy này.
Không cần chạy seed lại mỗi lần khởi động.

Mở ba terminal, để chạy trong suốt lúc sử dụng:

```powershell
# Terminal 1: Mosquitto cổng 1111, dùng đúng tài khoản MQTT của ESP32
cd C:\Users\GIGABYTE\Downloads\IoT-Dashboard\BE
npm run broker
```

```powershell
# Terminal 2: backend, cổng 5000
cd C:\Users\GIGABYTE\Downloads\IoT-Dashboard\BE
npm run dev
```

```powershell
# Terminal 3: frontend, cổng 5173
cd C:\Users\GIGABYTE\Downloads\IoT-Dashboard\FE
npm run dev
```

Mở http://127.0.0.1:5173. Tài khoản SQL đã chuẩn bị: **letantai / 123456**.
Nếu báo cổng đang dùng, dùng terminal đang chạy hoặc dừng phiên cũ bằng Ctrl+C;
không mở thêm một bản server trên cùng cổng.

Mosquitto service cũ trên máy đang nghe cổng 1883. Lệnh `npm run broker` mở
listener 1111 riêng đúng code Arduino. Nếu sau này cài listener 1111 thành
Windows service, không cần chạy thêm terminal broker.

## Khi có ESP32

1. Nếu đã nạp code đúng thì chỉ cần cấp nguồn; nếu chưa nạp phải dùng dây USB truyền dữ liệu.
2. ESP32 kết nối Wi-Fi `Todiu` theo code Arduino. Máy tính và ESP32 phải truy cập được nhau.
3. Kiểm tra `ipconfig`: IP Wi-Fi của máy chạy Mosquitto phải khớp `MQTT_SERVER`
   trong Arduino (đang là `172.20.10.3`). Nếu IP đổi, cần sửa và nạp lại Arduino.
4. Cho phép TCP 1111 vào máy chạy Mosquitto qua Windows Firewall trên mạng dùng báo cáo.
5. Bật broker, BE, FE như trên. ESP32 gửi cảm biến mỗi 5 giây; web tự cập nhật.

BE dùng `mqtt://localhost:1111` vì broker cùng máy. ESP32 dùng IP LAN máy tính;
không dùng localhost trên ESP32. Tài khoản MQTT khác tài khoản web và tài khoản SQL.

Khi bấm LED, web hiện Loading và khóa công tắc đó. ESP32 gửi đúng trạng thái
thì lịch sử chuyển SUCCESS. Không có xác nhận trong 8 giây hoặc mất MQTT thì
FAILED/Fail; không tự coi việc gửi lệnh là bật đèn thành công. Không có HW vẫn
đăng nhập, xem dữ liệu đã lưu được; bấm LED sẽ thất bại nếu không có phản hồi.

Ánh sáng đang là ADC (0–4095), không ghi lux vì Arduino chưa hiệu chuẩn LDR.
Thời gian mới lưu UTC, hiển thị/tìm kiếm UTC+7. Có thể dán thời gian rồi xóa
giây/phút để lọc rộng hơn. Bảng chọn 10 hoặc 20 bản ghi mỗi trang.

## Các file chính

| Phần | Vai trò |
|---|---|
| FE/src/components | Các màn hình và CSS, giữ bố cục cũ |
| FE/src/services/apiService.js | fetch API, JWT, kết nối WebSocket |
| FE/src/context/AuthContext.jsx | Đăng nhập/đăng ký bằng BE |
| FE/src/context/IoTContext.jsx | Dữ liệu Dashboard, cập nhật WebSocket, bật/tắt LED |
| BE/index.js | Khởi động và kết nối SQL |
| BE/app.js | API, JWT, WebSocket |
| BE/mqtt.js | Đọc dữ liệu Arduino, gửi lệnh và chờ xác nhận |
| BE/store.js | Truy vấn SQL bằng tham số |
| BE/config.js, database.js | Đọc cấu hình và kết nối SQL |
| BE/dataseed.sql | Tạo/cập nhật cấu trúc và tài khoản; không thêm số đo giả |
| BE/broker.js, mosquitto.conf | Chạy broker cổng 1111 |

Database dùng 5 bảng: Users, Devices, Sensors, DataSensor, ActionHistory.
Seed tương thích cấu trúc database đang có, đổi trạng thái cũ ON/OFF thành
SUCCESS, PENDING thành LOADING. Không xóa dữ liệu cũ. Các bản ghi có từ trước
vẫn hiện trong bảng; số đo mới đến từ ESP32. FE không còn dùng mockData.

## Chuyển sang máy mới

Cài Node.js, SQL Server và Mosquitto. Chạy `npm install` riêng trong FE và BE.
Chép toàn bộ `BE/dataseed.sql` vào SSMS, Execute. Tạo `BE/.env` từ `.env.example`,
điền cấu hình SQL, MQTT và hai khóa riêng JWT_SECRET/DEVICE_API_KEY. Có thể tạo khóa:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tạo file mật khẩu Mosquitto trong BE (lệnh hỏi mật khẩu, nhập đúng mật khẩu MQTT
đã nạp trên ESP32):

```powershell
& 'C:\Program Files\Mosquitto\mosquitto_passwd.exe' -c mqtt-passwords letantai
```

Không đưa `.env` và `mqtt-passwords` lên Git. Cấu hình mẫu không chứa mật khẩu thật.

## Kiểm tra và giới hạn

FE: `npm run build`. BE: `npm test` (kiểm tra riêng, không chạy khi dùng web).
Luồng tích hợp đã thử bằng chương trình thay vai ESP32, qua Mosquitto và SQL
thật; công cụ giả lập nằm ngoài project và không tự chạy cùng hệ thống.
Chưa xác nhận phần cứng thực tế vì chưa có dây/ESP32 trong lần kiểm tra.

Firmware hiện gửi trạng thái ba GPIO, không có mã lệnh/request ID hay last-will.
BE chỉ cho một lệnh chờ trên mỗi LED, bỏ qua retained status và chờ xác nhận
trạng thái mong muốn. Không dùng thêm chương trình khác điều khiển cùng LED
trong lúc thử; bản tin trạng thái không xác minh bóng đèn/vật lý có bị hỏng.
