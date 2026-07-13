-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    has_premium BOOLEAN DEFAULT FALSE,
    current_session_token VARCHAR(255), 
    last_login_ip INET,
    stripe_customer_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    secure_slug VARCHAR(100) UNIQUE NOT NULL, 
    internal_storage_path VARCHAR(500) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de optimización
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_session ON users(current_session_token);
CREATE INDEX idx_videos_slug ON videos(secure_slug);
