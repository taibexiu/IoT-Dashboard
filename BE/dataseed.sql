-- Chạy toàn bộ trong SSMS. Không xóa dữ liệu hoặc tài khoản hiện có.
USE master;
GO
IF DB_ID(N'IoTDashboard') IS NULL CREATE DATABASE IoTDashboard;
GO
USE IoTDashboard;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Users',N'U') IS NULL
CREATE TABLE dbo.Users(ID INT IDENTITY PRIMARY KEY,fullname NVARCHAR(255) NOT NULL,username VARCHAR(100) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,email VARCHAR(255),github VARCHAR(500),postman VARCHAR(500),figma VARCHAR(500),pdf VARCHAR(500));
IF OBJECT_ID(N'dbo.Devices',N'U') IS NULL
CREATE TABLE dbo.Devices(ID INT IDENTITY PRIMARY KEY,devicename NVARCHAR(100) NOT NULL,status VARCHAR(3) NOT NULL CHECK(status IN ('ON','OFF')));
IF OBJECT_ID(N'dbo.Sensors',N'U') IS NULL
CREATE TABLE dbo.Sensors(ID INT IDENTITY PRIMARY KEY,sensorname NVARCHAR(100) NOT NULL,type VARCHAR(20) NOT NULL UNIQUE,unit NVARCHAR(10) NOT NULL);
IF OBJECT_ID(N'dbo.DataSensor',N'U') IS NULL
CREATE TABLE dbo.DataSensor(ID INT IDENTITY PRIMARY KEY,IDsensor INT NOT NULL REFERENCES dbo.Sensors(ID),Value DECIMAL(12,2) NOT NULL,datetime DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID(N'dbo.ActionHistory',N'U') IS NULL
CREATE TABLE dbo.ActionHistory(ID INT IDENTITY PRIMARY KEY,IDdevice INT NOT NULL REFERENCES dbo.Devices(ID),IDuser INT NOT NULL REFERENCES dbo.Users(ID),action VARCHAR(3) NOT NULL CHECK(action IN ('ON','OFF')),status VARCHAR(10) NOT NULL CHECK(status IN ('SUCCESS','LOADING','FAILED')),time DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
-- Tài khoản letantai / 123456. Chuỗi password là bcrypt.
-- Chuyển quy ước trạng thái cũ ON/OFF/PENDING sang kết quả xử lý lệnh.
DECLARE @dropChecks NVARCHAR(MAX)=N'';
SELECT @dropChecks=@dropChecks+N'ALTER TABLE dbo.ActionHistory DROP CONSTRAINT '+QUOTENAME(name)+N';'
FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.ActionHistory') AND definition LIKE N'%status%';
EXEC sp_executesql @dropChecks;
UPDATE dbo.ActionHistory SET status=CASE WHEN status IN ('ON','OFF') THEN 'SUCCESS' WHEN status='PENDING' THEN 'LOADING' ELSE status END;
ALTER TABLE dbo.ActionHistory WITH CHECK ADD CONSTRAINT CK_ActionHistory_Result CHECK(status IN ('SUCCESS','LOADING','FAILED'));
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE username='letantai')
INSERT dbo.Users(fullname,username,password,email,github,postman,figma,pdf)
VALUES(N'Lê Tấn Tài','letantai','$2b$10$Wim50zPhS6dE1nyCQIndSep3qn0zifAiZVZQWHJ7ZXZIBvYI5QgwK','admin@gmail.com','https://github.com/letantai/iot-system','https://postman.com/letantai/workspace/iot','https://figma.com/file/letantai/iot-dashboard','https://drive.google.com/file/d/letantai-iot-report/view');
IF NOT EXISTS(SELECT 1 FROM dbo.Devices)
INSERT dbo.Devices(devicename,status) VALUES(N'LED 1','OFF'),(N'LED 2','OFF'),(N'LED 3','OFF');
IF NOT EXISTS(SELECT 1 FROM dbo.Sensors WHERE type='temperature') INSERT dbo.Sensors(sensorname,type,unit) VALUES(N'Nhiệt độ','temperature',N'°C');
IF NOT EXISTS(SELECT 1 FROM dbo.Sensors WHERE type='humidity') INSERT dbo.Sensors(sensorname,type,unit) VALUES(N'Độ ẩm','humidity','%');
IF NOT EXISTS(SELECT 1 FROM dbo.Sensors WHERE type='light') INSERT dbo.Sensors(sensorname,type,unit) VALUES(N'Độ sáng','light','ADC');
UPDATE dbo.Sensors SET unit='ADC' WHERE type='light';
-- Không thêm số đo/lịch sử giả. ESP32 và thao tác web sẽ tạo dữ liệu mới.
COMMIT;
GO
SELECT ID,username,fullname FROM dbo.Users;
SELECT * FROM dbo.Devices;
SELECT * FROM dbo.Sensors;
