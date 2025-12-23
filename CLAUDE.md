# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan dự án

Đây là dịch vụ proxy Node.js chuyển đổi API Google Antigravity sang định dạng tương thích với OpenAI, Claude và Gemini. Dịch vụ hỗ trợ nhiều tài khoản, tự động làm mới token và giao diện quản trị web.

## Các lệnh thường dùng

- **Cài đặt dependencies**: `npm install`
- **Khởi động server (Development)**: `npm run dev` (tự động restart khi thay đổi file)
- **Khởi động server (Production)**: `npm start`
- **Build binary**: `npm run build` (hoặc `npm run build:win`, `npm run build:linux`, v.v.)
- **Đăng nhập OAuth**: `npm run login` (để lấy token ban đầu)
- **Làm mới Token**: `npm run refresh`
- **Chạy test**: Chạy từng file test riêng lẻ trong thư mục `test/`:
  - `node test/test-request.js`
  - `node test/test-token-rotation.js`
  - `node test/test-image-generation.js`
  - `node test/test-transform.js`

## Kiến trúc & Cấu trúc mã nguồn

- **Entry Point**: `src/server/index.js` - Khởi tạo Express app, middleware và load routes.
- **Routes (`src/routes/`)**:
  - `admin.js`: API cho giao diện quản trị.
  - `openai.js`: Xử lý các request định dạng OpenAI (`/v1`).
  - `claude.js`: Xử lý các request định dạng Claude (`/v1/messages`).
  - `gemini.js`: Xử lý các request định dạng Gemini (`/v1beta`).
  - `sd.js`: API tương thích Stable Diffusion WebUI.
- **Logic cốt lõi**:
  - `src/api/client.js`: Xử lý giao tiếp với API Antigravity.
  - `src/utils/converters/`: Chuyển đổi giữa các định dạng API (OpenAI/Claude/Gemini -> Antigravity).
  - `src/auth/`: Quản lý JWT, Token rotation và lưu trữ token (`token_manager.js`, `jwt.js`).
- **Cấu hình**:
  - `.env`: Chứa thông tin nhạy cảm (API Key, mật khẩu admin).
  - `config.json`: Cấu hình server và các tham số mặc định.
- **Dữ liệu**: Thư mục `data/` chứa `accounts.json` (token tài khoản) và `quotas.json`.
- **Frontend**: Thư mục `public/` chứa code cho giao diện quản trị web.

## Quy ước Code

- Sử dụng ES Modules (`import`/`export`).
- Ưu tiên sử dụng `logger` từ `src/utils/logger.js` thay vì `console.log`.
- Xử lý lỗi tập trung thông qua `errorHandler` trong `src/utils/errors.js`.
- Cấu trúc thư mục phân tách rõ ràng giữa routes, logic nghiệp vụ (api/utils) và dữ liệu.
