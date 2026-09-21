-- 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
-- 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
CREATE DATABASE IF NOT EXISTS zhuatech_queue DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE zhuatech_queue;
CREATE TABLE service_site(id VARCHAR(32) PRIMARY KEY,code VARCHAR(64) UNIQUE,name VARCHAR(128),address VARCHAR(255),business_hours VARCHAR(64),status VARCHAR(24),created_at DATETIME(3));
CREATE TABLE service_type(id VARCHAR(32) PRIMARY KEY,site_id VARCHAR(32),name VARCHAR(128),prefix VARCHAR(3),sla_minutes INT,enabled TINYINT,created_at DATETIME(3),UNIQUE KEY uk_site_prefix(site_id,prefix));
CREATE TABLE service_window(id VARCHAR(32) PRIMARY KEY,site_id VARCHAR(32),window_no VARCHAR(32),name VARCHAR(128),service_ids JSON,operator_name VARCHAR(64),status VARCHAR(24),current_ticket_id VARCHAR(32),created_at DATETIME(3),UNIQUE KEY uk_site_window(site_id,window_no));
CREATE TABLE queue_terminal(id VARCHAR(32) PRIMARY KEY,site_id VARCHAR(32),code VARCHAR(64) UNIQUE,terminal_type VARCHAR(32),status VARCHAR(24),app_version VARCHAR(32),token_hash VARCHAR(128),last_heartbeat_at DATETIME(3),created_at DATETIME(3));
CREATE TABLE queue_ticket(id VARCHAR(32) PRIMARY KEY,site_id VARCHAR(32),service_id VARCHAR(32),ticket_no VARCHAR(32),masked_mobile VARCHAR(32),priority VARCHAR(16),status VARCHAR(24),issued_at DATETIME(3),called_at DATETIME(3),completed_at DATETIME(3),window_id VARCHAR(32),call_count INT,result VARCHAR(512),INDEX idx_queue(site_id,service_id,status,issued_at));
CREATE TABLE audit_event(id VARCHAR(32) PRIMARY KEY,actor VARCHAR(64),action VARCHAR(64),resource_id VARCHAR(64),detail JSON,occurred_at DATETIME(3));
