# Backend IoT

Hướng dẫn chạy, SQL, Mosquitto và cấu trúc nằm trong [README chung](../README.md).

API dùng prefix `/api`. Login/register không cần JWT; các API đọc/điều khiển
yêu cầu `Authorization: Bearer <token>`.

| Method | Đường dẫn | Nội dung |
|---|---|---|
| GET | /health | Trạng thái server/chế độ dữ liệu |
| POST | /auth/login | username, password; trả user và token |
| POST | /auth/register | username, password, fullname, email |
| GET | /auth/me | Thông tin tài khoản |
| GET | /dashboard | devices, sensors mới nhất, series 30 điểm |
| GET | /devices | Trạng thái LED và pending |
| POST | /devices/:id/control | action ON/OFF; tạo LOADING và gửi MQTT |
| GET | /sensors | page, pageSize (10/20), type, keyword |
| GET | /actions | page, pageSize, deviceId, action, status, time |
| POST | /ws-ticket | Ticket 1 lần, hết hạn sau 30 giây |
| POST | /sensors | temperature, humidity, light; cần X-Device-Key, dành tích hợp HTTP |

WebSocket `/ws?ticket=...`: connected, sensor:created, device:updated,
action:created, action:updated. JWT hết hạn sau 1 giờ. FE tự lấy ticket mới
khi kết nối lại và tải lại dữ liệu SQL để bù các sự kiện bị bỏ lỡ.

MQTT: datasensor nhận `temperature=26.00,humidity=65.00,light=1234`;
control gửi `LED1_ON`/`LED1_OFF`…; status nhận `LED1=ON,LED2=OFF,LED3=OFF`.
Lệnh không retain. Không cần sửa định dạng Arduino.

Mặc định máy này DATA_MODE=sql; DATA_MODE=demo chỉ dành kiểm tra API độc lập,
không nối MQTT hoặc database thật. FE đang dùng BE, không có tài khoản demo riêng.
