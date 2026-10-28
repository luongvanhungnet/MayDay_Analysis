console.error('Database lấy nguyên trạng từ mayday_backup.sql. Không chạy migration/seed UUID cũ. Dùng db:generate để tạo client; xem README để import bản sao SQL.');
process.exitCode = 1;
